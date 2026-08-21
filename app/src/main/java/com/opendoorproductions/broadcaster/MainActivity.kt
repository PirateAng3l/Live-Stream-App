package com.opendoorproductions.broadcaster

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.toBitmap
import androidx.core.widget.doAfterTextChanged
import com.google.android.material.button.MaterialButton
import com.google.android.material.tabs.TabLayout
import com.opendoorproductions.broadcaster.backend.BackendConfig
import com.opendoorproductions.broadcaster.backend.BroadcastCredentials
import com.opendoorproductions.broadcaster.backend.CrewSession
import com.opendoorproductions.broadcaster.backend.FixtureSummary
import com.opendoorproductions.broadcaster.backend.SupabaseClient
import com.opendoorproductions.broadcaster.databinding.ActivityMainBinding
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.gl.render.filters.`object`.ImageObjectFilterRender
import com.pedro.library.rtmp.RtmpCamera2
import java.io.File
import java.io.FileOutputStream
import java.net.URL
import kotlin.math.abs

class MainActivity : AppCompatActivity(), ConnectChecker {

    private lateinit var binding: ActivityMainBinding
    private lateinit var rtmpCamera2: RtmpCamera2
    private lateinit var teamOverlayRenderer: TeamOverlayRenderer
    private lateinit var cricketOverlayRenderer: CricketOverlayRenderer
    private lateinit var eventOverlayRenderer: EventOverlayRenderer
    private lateinit var overlayFilter: ImageObjectFilterRender
    private lateinit var presetStore: SponsorPresetStore
    private var presetSummaries: List<SponsorPresetSummary> = emptyList()

    private val supabaseClient by lazy { SupabaseClient(BackendConfig.supabaseUrl, BackendConfig.supabaseAnonKey) }
    private var crewFixtures: List<FixtureSummary> = emptyList()

    private val scoreController = ScoreController()
    private val cricketController = CricketController()
    private var currentSport: Sport = Sport.RUGBY
    // Index into currentSport.periodLabels — "1st Half" is 0, "2nd Half" is 1,
    // etc. Meaningless (and periodGroup stays hidden) for a sport with no
    // period labels at all. See setupPeriodControls/refreshPeriodUi.
    private var currentPeriodIndex: Int = 0
    private var deviceZoomRange = 0.6f..5f

    private val uiHandler = Handler(Looper.getMainLooper())
    private var panelOpen = false

    // Starts closed, same as the settings panel — a clean, unobstructed
    // camera view on launch, both floating toggle buttons visible, nothing
    // open until the operator actually wants score/timer controls or settings.
    private var liveControlOpen = false

    private var streamUrl = ""
    private var autoReconnectEnabled = false
    private var reconnectPending = false
    private var suppressDisconnectUi = false
    private var reconnectAttempts = 0
    private var reconnectRunnable: Runnable? = null
    private var reconnectWatchdog: Runnable? = null

    // Resolved once per Activity instance (lazy, so it's safe to reference
    // `prefs` regardless of field-declaration order) from whatever was saved
    // last time the Camera tab's resolution spinner changed — defaults match
    // the original hardcoded 720p/4Mbps exactly, so an install that's never
    // touched the new controls behaves exactly as it always did. Read once
    // and reused everywhere streamWidth/streamHeight/streamBitrateKbps used
    // to be fixed constants (overlay renderer sizing, both prepareVideo
    // calls) — see setupCameraQualityControls for why a change made mid-app
    // only takes effect on recreate() rather than resizing the encoder live.
    private val streamResolution: StreamResolution by lazy {
        StreamResolution.entries.firstOrNull { it.name == prefs.getString(PREF_STREAM_RESOLUTION, null) }
            ?: StreamResolution.HD_720
    }
    private val streamWidth: Int by lazy { streamResolution.width }
    private val streamHeight: Int by lazy { streamResolution.height }
    private val streamBitrateKbps: Int by lazy {
        StreamBitrate.entries.firstOrNull { it.name == prefs.getString(PREF_STREAM_BITRATE, null) }?.kbps
            ?: StreamBitrate.STANDARD.kbps
    }

    // Blank on purpose: OverlayChrome only draws these as a text fallback when a slot
    // has no image, and an unused/not-yet-set-up sponsor slot should be invisible on
    // the overlay rather than showing a generic placeholder label.
    private val businessLabel = ""
    private val sponsorHeadline = ""
    private val sponsorLeft = ""
    private val sponsorRight = ""

    private var logoBitmap: Bitmap? = null
    private var sponsorHeadlineBitmap: Bitmap? = null
    private var sponsorLeftBitmap: Bitmap? = null
    private var sponsorRightBitmap: Bitmap? = null

    // The home-team logo slot in the scoreboard (formerly a flat blue block) —
    // set when a loaded fixture's host school has uploaded a real emblem
    // (see fetchHomeTeamLogo), null otherwise so defaultTeamLogoBitmap shows
    // instead. The away slot has no per-fixture equivalent — there's no
    // reliable link to the actual opposing school's own account today (see
    // README's crew sign-in section) — so it always uses the same default.
    private var homeTeamLogoBitmap: Bitmap? = null
    private var loadedFixtureId: String? = null

    // Open Door Live's own mark, reused as the fallback for both scoreboard
    // logo slots until a real PNG is supplied to replace it outright — the
    // app icon is the closest existing branded asset, decoded once and kept
    // around rather than re-rendered from the drawable on every frame.
    private val defaultTeamLogoBitmap: Bitmap by lazy {
        ContextCompat.getDrawable(this, R.mipmap.ic_launcher)!!.toBitmap()
    }

    private var logoScale = 1f
    private var sponsorHeadlineScale = 1f
    private var sponsorLeftScale = 1f
    private var sponsorRightScale = 1f
    private var sponsorHeadlineOffsetY = 0f
    private var sponsorHeadlinePrefix = ""

    // Encrypted at rest (see BroadcasterApp.encryptedPrefs) — the RTMP stream key and crew
    // sign-in tokens saved here are real credentials, not just UI convenience state.
    private val prefs by lazy { BroadcasterApp.encryptedPrefs(this) }

    private val permissionRequest = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = grants[Manifest.permission.CAMERA] == true &&
            grants[Manifest.permission.RECORD_AUDIO] == true
        if (granted) {
            startPreview()
        } else {
            Toast.makeText(this, R.string.camera_permission_required, Toast.LENGTH_LONG).show()
        }
    }

    private val pickLogoImage = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        applyPickedImage(uri, LOGO_IMAGE_FILE, binding.logoThumbnail) { logoBitmap = it }
    }
    private val pickSponsorHeadlineImage = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        applyPickedImage(uri, SPONSOR_HEADLINE_IMAGE_FILE, binding.sponsorHeadlineThumbnail) { sponsorHeadlineBitmap = it }
    }
    private val pickSponsorLeftImage = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        applyPickedImage(uri, SPONSOR_LEFT_IMAGE_FILE, binding.sponsorLeftThumbnail) { sponsorLeftBitmap = it }
    }
    private val pickSponsorRightImage = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        applyPickedImage(uri, SPONSOR_RIGHT_IMAGE_FILE, binding.sponsorRightThumbnail) { sponsorRightBitmap = it }
    }

    private val timerTick = object : Runnable {
        override fun run() {
            scoreController.tickTimerIfRunning()
            refreshAll()
            uiHandler.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        teamOverlayRenderer = TeamOverlayRenderer(streamWidth, streamHeight)
        cricketOverlayRenderer = CricketOverlayRenderer(streamWidth, streamHeight)
        eventOverlayRenderer = EventOverlayRenderer(streamWidth, streamHeight)
        rtmpCamera2 = RtmpCamera2(binding.openGlView, this)
        presetStore = SponsorPresetStore(this)

        loadSavedFields()
        setupPanelToggle()
        setupLiveControlToggle()
        setupSettingsTabs()
        setupThemeToggle()
        setupSportSpinner()
        setupScoreControls()
        setupCricketControls()
        setupTimerControls()
        setupPeriodControls()
        setupMuteControl()
        setupGoLiveButton()
        setupFieldPersistence()
        setupSponsorImagePickers()
        setupPresetControls()
        setupZoomControl()
        setupCameraQualityControls()
        setupCrewSignIn()
        onSportChanged()
        updateStatus(R.string.status_offline, Color.parseColor("#B7C2CC"))

        if (hasPermissions()) {
            startPreview()
        } else {
            permissionRequest.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
        }
    }

    override fun onResume() {
        super.onResume()
        uiHandler.post(timerTick)
    }

    override fun onPause() {
        super.onPause()
        uiHandler.removeCallbacks(timerTick)
    }

    override fun onDestroy() {
        super.onDestroy()
        cancelPendingReconnect()
        if (rtmpCamera2.isStreaming) {
            rtmpCamera2.stopStream()
        }
        if (rtmpCamera2.isOnPreview) {
            rtmpCamera2.stopPreview()
        }
    }

    private fun hasPermissions(): Boolean {
        val camera = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
        val mic = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
        return camera == PackageManager.PERMISSION_GRANTED && mic == PackageManager.PERMISSION_GRANTED
    }

    private fun startPreview() {
        binding.openGlView.post {
            if (rtmpCamera2.prepareAudio() && rtmpCamera2.prepareVideo(streamWidth, streamHeight, 30, streamBitrateKbps * 1024, 0)) {
                overlayFilter = ImageObjectFilterRender()
                rtmpCamera2.glInterface.setFilter(overlayFilter)
                overlayFilter.setImage(renderCurrentOverlayBitmap())
                overlayFilter.setScale(100f, 100f)
                overlayFilter.setPosition(0f, 0f)
                rtmpCamera2.startPreview()
                readDeviceZoomRange()
            } else {
                Toast.makeText(this, "Could not open camera/mic for preview", Toast.LENGTH_LONG).show()
            }
        }
    }

    /**
     * Every phone reports a different real zoom ceiling and floor
     * (CONTROL_ZOOM_RATIO_RANGE) — some go below 1x via an ultra-wide lens,
     * most don't — so the slider always shows a fixed 0.6x-5x scale but the
     * value actually sent to the camera is clamped to whatever this device
     * supports. 0.5x is just a sanity floor against a malformed device
     * value, not the intended wide-angle target (0.6x is); on a device
     * with no ultra-wide lens, dragging below its real floor (often 1x)
     * just holds at that floor rather than doing anything — same as the
     * 5x UI ceiling already did for phones with a lower real maximum.
     */
    private fun readDeviceZoomRange() {
        try {
            val range = rtmpCamera2.getZoomRange()
            val lower = range.lower.coerceAtLeast(0.5f)
            val upper = range.upper.coerceAtMost(5f).coerceAtLeast(lower)
            deviceZoomRange = lower..upper
            Log.i(TAG, "Camera zoom range: $deviceZoomRange")
        } catch (error: Exception) {
            Log.w(TAG, "Could not read camera zoom range, defaulting to 0.6x-5x", error)
        }
    }

    private fun setupZoomControl() {
        binding.zoomSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(bar: SeekBar, progress: Int, fromUser: Boolean) {
                // Snaps a user drag within ZOOM_SNAP_WINDOW of 1x to exactly
                // DEFAULT_ZOOM_PROGRESS — without this, landing on the true
                // 1x stop by touch is fiddly now that it isn't at either end
                // of the track. Computed once as `snapped` and applied from
                // that (not by relying on the reentrant listener call from
                // `bar.progress = snapped` below) because that call is a
                // no-op — and never re-fires — when progress is already
                // exactly DEFAULT_ZOOM_PROGRESS, which would otherwise skip
                // applying the zoom entirely on that touch.
                val snapped = if (fromUser && abs(progress - DEFAULT_ZOOM_PROGRESS) <= ZOOM_SNAP_WINDOW) {
                    DEFAULT_ZOOM_PROGRESS
                } else {
                    progress
                }
                if (snapped != progress) bar.progress = snapped
                // 0.6x (wide) + progress/100 — matches zoomSeekBar's
                // android:max="440"/android:progress="40" in the layout, so
                // progress 40 is exactly 1.0x, the default on launch.
                applyZoom(0.6f + snapped / 100f)
            }

            override fun onStartTrackingTouch(bar: SeekBar) = Unit
            override fun onStopTrackingTouch(bar: SeekBar) = Unit
        })

        // The XML's 20dp margin on zoomDefaultTick is only a starting guess
        // (progress/max of the container's height) — it doesn't account for
        // the stock SeekBar thumb's own internal inset, which isn't fully
        // documented and turned out not to be fully removed by
        // thumbOffset=0dp either (two rounds of guessing that number by eye
        // didn't land it). Once the SeekBar has actually been laid out, ask
        // it directly where its thumb is really drawn instead of guessing a
        // third number.
        //
        // A plain `.post{}` isn't late enough: called this early (from
        // onCreate, before the SeekBar is attached to the window), it just
        // queues the runnable to fire on attach — not after the first real
        // layout/measure pass that actually positions the thumb at
        // progress=40. It was firing while the thumb was still at its
        // pre-layout default position (effectively progress=0), which is
        // why the tick landed at the 0.6x end instead of 1x. A one-shot
        // OnGlobalLayoutListener guarantees a completed layout pass —
        // thumb.bounds reflects the real progress=40 position — before
        // reading it.
        binding.zoomSeekBar.viewTreeObserver.addOnGlobalLayoutListener(
            object : ViewTreeObserver.OnGlobalLayoutListener {
                override fun onGlobalLayout() {
                    binding.zoomSeekBar.viewTreeObserver.removeOnGlobalLayoutListener(this)
                    alignZoomTickToThumb()
                }
            }
        )
    }

    /**
     * Reads the SeekBar's own thumb.bounds — the exact rectangle Android
     * just drew the thumb in, in the SeekBar's local (pre-rotation)
     * coordinate space — and repositions zoomDefaultTick to match that
     * same fraction of the track, translated into "margin up from the
     * bottom of the vertical-looking container" (progress 0 renders at the
     * bottom after the 270° rotation, max at the top — same orientation
     * the tick's own layout_gravity="bottom" already assumes). The tick
     * itself is static at the DEFAULT_ZOOM_PROGRESS position; the SeekBar
     * is guaranteed to be at exactly that progress when this runs (called
     * once, right after setup, before any user drag).
     */
    private fun alignZoomTickToThumb() {
        val seekBar = binding.zoomSeekBar
        val thumbBounds = seekBar.thumb?.bounds ?: return
        if (seekBar.width == 0) return
        val fraction = thumbBounds.centerX().toFloat() / seekBar.width.toFloat()
        val containerHeightPx = binding.zoomControlContainer.height.toFloat()
        if (containerHeightPx == 0f) return
        val params = binding.zoomDefaultTick.layoutParams as FrameLayout.LayoutParams
        params.bottomMargin = (fraction * containerHeightPx).toInt()
        binding.zoomDefaultTick.layoutParams = params
    }

    private fun applyZoom(requestedZoom: Float) {
        val clamped = requestedZoom.coerceIn(deviceZoomRange)
        try {
            rtmpCamera2.setZoom(clamped)
        } catch (error: Exception) {
            Log.w(TAG, "setZoom($clamped) failed", error)
        }
        binding.zoomValueLabel.text = getString(R.string.zoom_format, clamped)
    }

    /**
     * Resolution and bitrate are read once into streamWidth/streamHeight/
     * streamBitrateKbps (see their declarations) and used both to size the
     * overlay bitmaps and to prepare the encoder — changing either while
     * live would mean tearing down and rebuilding the camera/encoder
     * mid-broadcast, the same real risk setupThemeToggle already avoids by
     * deferring a live change to the next recreate(). So this saves the new
     * choice to prefs immediately either way, and only calls recreate()
     * (which re-reads prefs from scratch and re-preps video at the new
     * settings) when nothing is currently streaming; otherwise it just
     * toasts that the change will apply next time.
     */
    private fun setupCameraQualityControls() {
        setupEnumSpinner(
            binding.resolutionSpinner,
            StreamResolution.entries.toTypedArray(),
            streamResolution,
            PREF_STREAM_RESOLUTION
        )
        setupEnumSpinner(
            binding.bitrateSpinner,
            StreamBitrate.entries.toTypedArray(),
            StreamBitrate.entries.firstOrNull { it.kbps == streamBitrateKbps } ?: StreamBitrate.STANDARD,
            PREF_STREAM_BITRATE
        )
    }

    private fun <T : Enum<T>> setupEnumSpinner(spinner: Spinner, options: Array<T>, current: T, prefKey: String) {
        val adapter = object : ArrayAdapter<T>(this, android.R.layout.simple_spinner_item, options) {
            override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
                val view = super.getView(position, convertView, parent) as TextView
                view.setTextColor(Color.WHITE)
                return view
            }

            override fun getDropDownView(position: Int, convertView: View?, parent: ViewGroup): View {
                val view = super.getDropDownView(position, convertView, parent) as TextView
                view.setTextColor(Color.WHITE)
                view.setPadding(24, 20, 24, 20)
                return view
            }
        }
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinner.adapter = adapter
        spinner.setSelection(options.indexOf(current))
        spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                val selected = options[position]
                if (selected == current) return
                prefs.edit().putString(prefKey, selected.name).apply()
                if (rtmpCamera2.isStreaming) {
                    Toast.makeText(this@MainActivity, R.string.camera_quality_change_after_stream, Toast.LENGTH_LONG).show()
                } else {
                    recreate()
                }
            }

            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
    }

    // Entirely optional layer on top of the manual RTMP URL/key entry, which keeps
    // working exactly as before whether or not anyone signs in — there's no live
    // Supabase project to test this against yet (see BackendConfig), and the app
    // must still work standalone regardless. Loading a fixture just fills in the
    // same fields+prefs the manual flow already writes to, via setText(), which is
    // why loading one also persists it the same way manual entry always has.
    private fun setupCrewSignIn() {
        updateCrewSignInUi()
        if (loadStoredCrewSession() != null) {
            refreshCrewFixturesInBackground()
        }

        binding.crewSignInBtn.setOnClickListener { performCrewSignIn() }
        binding.crewSignOutBtn.setOnClickListener {
            clearCrewSession()
            updateCrewSignInUi()
        }
        binding.loadFixtureBtn.setOnClickListener { performLoadFixture() }
    }

    private fun performCrewSignIn() {
        val email = binding.crewEmailInput.text?.toString()?.trim().orEmpty()
        val password = binding.crewPasswordInput.text?.toString().orEmpty()
        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, R.string.crew_enter_credentials, Toast.LENGTH_SHORT).show()
            return
        }
        if (!BackendConfig.isConfigured) {
            Toast.makeText(this, R.string.backend_not_configured, Toast.LENGTH_LONG).show()
            return
        }
        binding.crewSignInBtn.isEnabled = false
        Thread {
            try {
                val session = supabaseClient.signIn(email, password)
                saveCrewSession(session, email)
                val profile = supabaseClient.getMyProfile(session.accessToken)
                // platform_admin never has a school_id (see the profiles table's shape
                // constraint) — that's how the two crew roles are told apart here, same
                // as the web admin panel's resolveSchoolContext.
                val isAdmin = profile.schoolId == null
                prefs.edit()
                    .putString(PREF_CREW_SCHOOL_ID, profile.schoolId)
                    .putBoolean(PREF_CREW_IS_ADMIN, isAdmin)
                    .apply()
                val fixtures = if (isAdmin) {
                    supabaseClient.getAllUpcomingFixtures(session.accessToken)
                } else {
                    supabaseClient.getUpcomingFixtures(session.accessToken, profile.schoolId!!)
                }
                uiHandler.post {
                    binding.crewSignInBtn.isEnabled = true
                    crewFixtures = fixtures
                    updateCrewSignInUi()
                    refreshFixtureSpinner()
                    Toast.makeText(this, getString(R.string.signed_in_as, email), Toast.LENGTH_SHORT).show()
                }
            } catch (error: Exception) {
                Log.e(TAG, "Crew sign-in failed", error)
                uiHandler.post {
                    binding.crewSignInBtn.isEnabled = true
                    Toast.makeText(
                        this,
                        getString(R.string.sign_in_failed, error.message ?: "unknown error"),
                        Toast.LENGTH_LONG,
                    ).show()
                }
            }
        }.start()
    }

    private fun refreshCrewFixturesInBackground() {
        val session = loadStoredCrewSession() ?: return
        val isAdmin = prefs.getBoolean(PREF_CREW_IS_ADMIN, false)
        val schoolId = prefs.getString(PREF_CREW_SCHOOL_ID, null)
        // A school_operator's schoolId is required to fetch anything; a
        // platform_admin (isAdmin) has none by design and doesn't need one —
        // see performCrewSignIn. Bailing here previously meant an
        // already-signed-in platform_admin's fixtures silently never
        // refreshed on app relaunch.
        if (!isAdmin && schoolId == null) return
        Thread {
            try {
                val fresh = ensureFreshSessionBlocking(session)
                val fixtures = if (isAdmin) {
                    supabaseClient.getAllUpcomingFixtures(fresh.accessToken)
                } else {
                    supabaseClient.getUpcomingFixtures(fresh.accessToken, schoolId!!)
                }
                uiHandler.post {
                    crewFixtures = fixtures
                    refreshFixtureSpinner()
                }
            } catch (error: Exception) {
                // Silent: this runs automatically on startup for an already-signed-in
                // operator, and a stale/offline failure here shouldn't nag them before
                // they've even asked to do anything. performCrewSignIn/performLoadFixture
                // surface real errors when the operator actually takes an action.
                Log.w(TAG, "Could not refresh crew fixtures in background", error)
            }
        }.start()
    }

    private fun performLoadFixture() {
        val fixture = crewFixtures.getOrNull(binding.crewFixtureSpinner.selectedItemPosition)
        val session = loadStoredCrewSession()
        if (fixture == null || session == null) {
            Toast.makeText(this, R.string.select_fixture_first, Toast.LENGTH_SHORT).show()
            return
        }
        binding.loadFixtureBtn.isEnabled = false
        Thread {
            try {
                val fresh = ensureFreshSessionBlocking(session)
                val credentials = supabaseClient.getBroadcastCredentials(fresh.accessToken, fixture.id)
                uiHandler.post {
                    binding.loadFixtureBtn.isEnabled = true
                    applyLoadedFixture(fixture, credentials)
                }
            } catch (error: Exception) {
                Log.e(TAG, "Load fixture failed", error)
                uiHandler.post {
                    binding.loadFixtureBtn.isEnabled = true
                    Toast.makeText(
                        this,
                        getString(R.string.crew_load_error, error.message ?: "unknown error"),
                        Toast.LENGTH_LONG,
                    ).show()
                }
            }
        }.start()
    }

    private fun applyLoadedFixture(fixture: FixtureSummary, credentials: BroadcastCredentials) {
        binding.rtmpUrlInput.setText(credentials.ingestionAddress)
        binding.rtmpKeyInput.setText(credentials.streamKey)
        binding.homeNameInput.setText(fixture.homeTeamName)
        binding.awayNameInput.setText(fixture.awayTeamName)
        Sport.entries.firstOrNull { it.name.equals(fixture.sport, ignoreCase = true) }?.let { matchedSport ->
            currentSport = matchedSport
            binding.sportSpinner.setSelection(Sport.entries.indexOf(matchedSport))
            onSportChanged()
        }
        // Clears any previous fixture's logo immediately (falls back to the
        // default mark while the new one, if any, downloads) rather than
        // leaving the wrong school's emblem on screen in the meantime.
        loadedFixtureId = fixture.id
        homeTeamLogoBitmap = null
        refreshOverlay()
        fixture.homeLogoUrl?.let { fetchHomeTeamLogo(fixture.id, it) }
        Toast.makeText(this, R.string.fixture_loaded, Toast.LENGTH_SHORT).show()
    }

    /**
     * Runs on a background thread; the [expectedFixtureId] check on the way
     * back guards against a slow download from a previously loaded fixture
     * overwriting whichever one the crew has since switched to.
     */
    private fun fetchHomeTeamLogo(expectedFixtureId: String, url: String) {
        Thread {
            val bitmap = try {
                URL(url).openStream().use { BitmapFactory.decodeStream(it) }
            } catch (error: Exception) {
                Log.w(TAG, "Could not download home team logo", error)
                null
            }
            if (bitmap == null || loadedFixtureId != expectedFixtureId) return@Thread
            uiHandler.post {
                if (loadedFixtureId == expectedFixtureId) {
                    homeTeamLogoBitmap = bitmap
                    refreshOverlay()
                }
            }
        }.start()
    }

    private fun refreshFixtureSpinner() {
        val labels = if (crewFixtures.isEmpty()) {
            listOf(getString(R.string.no_fixtures_found))
        } else {
            crewFixtures.map { fixture ->
                val matchLabel = "${fixture.homeTeamName} vs ${fixture.awayTeamName}"
                // Only the platform_admin, every-school list (getAllUpcomingFixtures)
                // populates schoolName — a school_operator's own fixtures are all the
                // same school, so there's nothing to disambiguate.
                fixture.schoolName?.let { "$it — $matchLabel" } ?: matchLabel
            }
        }
        val adapter = object : ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, labels) {
            override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
                val view = super.getView(position, convertView, parent) as TextView
                view.setTextColor(Color.WHITE)
                return view
            }

            override fun getDropDownView(position: Int, convertView: View?, parent: ViewGroup): View {
                val view = super.getDropDownView(position, convertView, parent) as TextView
                view.setTextColor(Color.WHITE)
                view.setPadding(24, 20, 24, 20)
                return view
            }
        }
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.crewFixtureSpinner.adapter = adapter
    }

    private fun updateCrewSignInUi() {
        val signedIn = loadStoredCrewSession() != null
        binding.crewSignedOutGroup.visibility = if (signedIn) View.GONE else View.VISIBLE
        binding.crewSignedInGroup.visibility = if (signedIn) View.VISIBLE else View.GONE
        if (signedIn) {
            binding.crewStatusLabel.text =
                getString(R.string.signed_in_as, prefs.getString(PREF_CREW_EMAIL, "").orEmpty())
        }
    }

    private fun loadStoredCrewSession(): CrewSession? {
        val accessToken = prefs.getString(PREF_CREW_ACCESS_TOKEN, null) ?: return null
        val refreshToken = prefs.getString(PREF_CREW_REFRESH_TOKEN, null) ?: return null
        return CrewSession(accessToken, refreshToken, prefs.getLong(PREF_CREW_EXPIRES_AT, 0L))
    }

    private fun saveCrewSession(session: CrewSession, email: String) {
        prefs.edit()
            .putString(PREF_CREW_ACCESS_TOKEN, session.accessToken)
            .putString(PREF_CREW_REFRESH_TOKEN, session.refreshToken)
            .putLong(PREF_CREW_EXPIRES_AT, session.expiresAtEpochSeconds)
            .putString(PREF_CREW_EMAIL, email)
            .apply()
    }

    private fun clearCrewSession() {
        prefs.edit()
            .remove(PREF_CREW_ACCESS_TOKEN)
            .remove(PREF_CREW_REFRESH_TOKEN)
            .remove(PREF_CREW_EXPIRES_AT)
            .remove(PREF_CREW_EMAIL)
            .remove(PREF_CREW_SCHOOL_ID)
            .remove(PREF_CREW_IS_ADMIN)
            .apply()
        crewFixtures = emptyList()
    }

    /** Refreshes only when close to/past expiry — called from a background thread. */
    private fun ensureFreshSessionBlocking(session: CrewSession): CrewSession {
        val nowPlusBuffer = System.currentTimeMillis() / 1000 + 60
        if (session.expiresAtEpochSeconds > nowPlusBuffer) return session
        val refreshed = supabaseClient.refreshSession(session.refreshToken)
        saveCrewSession(refreshed, prefs.getString(PREF_CREW_EMAIL, "").orEmpty())
        return refreshed
    }

    private fun renderCurrentOverlayBitmap(): Bitmap {
        val logo = OverlayAsset(businessLabel, logoBitmap, logoScale)
        val headline = OverlayAsset(sponsorHeadline, sponsorHeadlineBitmap, sponsorHeadlineScale, sponsorHeadlineOffsetY)
        val left = OverlayAsset(sponsorLeft, sponsorLeftBitmap, sponsorLeftScale)
        val right = OverlayAsset(sponsorRight, sponsorRightBitmap, sponsorRightScale)
        return when (currentSport.layout) {
            ScoreboardLayout.TWO_TEAM -> teamOverlayRenderer.render(
                scoreController.state,
                logo,
                OverlayAsset("", homeTeamLogoBitmap ?: defaultTeamLogoBitmap),
                OverlayAsset("", defaultTeamLogoBitmap),
                currentSport.periodLabels.getOrElse(currentPeriodIndex) { "" },
                sponsorHeadlinePrefix, headline, left, right
            )
            ScoreboardLayout.CRICKET -> cricketOverlayRenderer.render(
                cricketController.state, logo, sponsorHeadlinePrefix, headline, left, right
            )
            // scoreController.state.homeName doubles as the event name here —
            // it's the same field the "Event name" input (repurposed
            // homeNameInput, see onSportChanged) already writes to.
            ScoreboardLayout.NONE -> eventOverlayRenderer.render(
                scoreController.state.homeName, logo, sponsorHeadlinePrefix, headline, left, right
            )
        }
    }

    private fun refreshOverlay() {
        if (!::overlayFilter.isInitialized) return
        overlayFilter.setImage(renderCurrentOverlayBitmap())
    }

    private fun refreshAll() {
        refreshOverlay()
        updateScorePanelUi()
        updateCricketPanelUi()
    }

    private fun loadSavedFields() {
        binding.rtmpUrlInput.setText(prefs.getString(PREF_RTMP_URL, ""))
        binding.rtmpKeyInput.setText(prefs.getString(PREF_RTMP_KEY, ""))
        binding.homeNameInput.setText(prefs.getString(PREF_TEAM_A, getString(R.string.default_home)))
        binding.awayNameInput.setText(prefs.getString(PREF_TEAM_B, getString(R.string.default_away)))
        val savedSport = prefs.getString(PREF_SPORT, Sport.RUGBY.name)
        currentSport = Sport.entries.firstOrNull { it.name == savedSport } ?: Sport.RUGBY

        loadSavedImage(LOGO_IMAGE_FILE, binding.logoThumbnail) { logoBitmap = it }
        loadSavedImage(SPONSOR_HEADLINE_IMAGE_FILE, binding.sponsorHeadlineThumbnail) { sponsorHeadlineBitmap = it }
        loadSavedImage(SPONSOR_LEFT_IMAGE_FILE, binding.sponsorLeftThumbnail) { sponsorLeftBitmap = it }
        loadSavedImage(SPONSOR_RIGHT_IMAGE_FILE, binding.sponsorRightThumbnail) { sponsorRightBitmap = it }

        applySponsorMetaToUi(
            logoScale = prefs.getFloat(PREF_LOGO_SCALE, 1f),
            sponsorHeadlineScale = prefs.getFloat(PREF_SPONSOR_HEADLINE_SCALE, 1f),
            sponsorLeftScale = prefs.getFloat(PREF_SPONSOR_LEFT_SCALE, 1f),
            sponsorRightScale = prefs.getFloat(PREF_SPONSOR_RIGHT_SCALE, 1f),
            sponsorHeadlineOffsetY = prefs.getFloat(PREF_SPONSOR_HEADLINE_OFFSET, 0f),
            sponsorHeadlinePrefix = prefs.getString(PREF_SPONSOR_HEADLINE_PREFIX, "").orEmpty()
        )
    }

    // Shared by loadSavedFields (reading from prefs on startup) and preset loading
    // (reading from a saved preset) so both paths update every size/position control
    // and persist the values the same way, instead of keeping two copies of this logic.
    private fun applySponsorMetaToUi(
        logoScale: Float,
        sponsorHeadlineScale: Float,
        sponsorLeftScale: Float,
        sponsorRightScale: Float,
        sponsorHeadlineOffsetY: Float,
        sponsorHeadlinePrefix: String
    ) {
        this.logoScale = logoScale
        this.sponsorHeadlineScale = sponsorHeadlineScale
        this.sponsorLeftScale = sponsorLeftScale
        this.sponsorRightScale = sponsorRightScale
        this.sponsorHeadlineOffsetY = sponsorHeadlineOffsetY
        this.sponsorHeadlinePrefix = sponsorHeadlinePrefix

        binding.logoSizeSeekBar.progress = (logoScale * 100).toInt()
        binding.sponsorHeadlineSizeSeekBar.progress = (sponsorHeadlineScale * 100).toInt()
        binding.sponsorLeftSizeSeekBar.progress = (sponsorLeftScale * 100).toInt()
        binding.sponsorRightSizeSeekBar.progress = (sponsorRightScale * 100).toInt()
        binding.logoSizeValue.text = getString(R.string.percent_format, binding.logoSizeSeekBar.progress)
        binding.sponsorHeadlineSizeValue.text = getString(R.string.percent_format, binding.sponsorHeadlineSizeSeekBar.progress)
        binding.sponsorLeftSizeValue.text = getString(R.string.percent_format, binding.sponsorLeftSizeSeekBar.progress)
        binding.sponsorRightSizeValue.text = getString(R.string.percent_format, binding.sponsorRightSizeSeekBar.progress)

        binding.sponsorHeadlinePrefixInput.setText(sponsorHeadlinePrefix)

        val positionProgress = 50 - (sponsorHeadlineOffsetY * 200f).toInt()
        binding.sponsorHeadlinePositionSeekBar.progress = positionProgress
        val positionPercent = positionProgress - 50
        binding.sponsorHeadlinePositionValue.text = if (positionPercent == 0) {
            getString(R.string.default_position_label)
        } else {
            getString(R.string.position_format, positionPercent)
        }

        prefs.edit()
            .putFloat(PREF_LOGO_SCALE, logoScale)
            .putFloat(PREF_SPONSOR_HEADLINE_SCALE, sponsorHeadlineScale)
            .putFloat(PREF_SPONSOR_LEFT_SCALE, sponsorLeftScale)
            .putFloat(PREF_SPONSOR_RIGHT_SCALE, sponsorRightScale)
            .putFloat(PREF_SPONSOR_HEADLINE_OFFSET, sponsorHeadlineOffsetY)
            .putString(PREF_SPONSOR_HEADLINE_PREFIX, sponsorHeadlinePrefix)
            .apply()
    }

    private fun setupSponsorImagePickers() {
        val imageOnly = PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
        binding.chooseLogoBtn.setOnClickListener { pickLogoImage.launch(imageOnly) }
        binding.chooseSponsorHeadlineBtn.setOnClickListener { pickSponsorHeadlineImage.launch(imageOnly) }
        binding.chooseSponsorLeftBtn.setOnClickListener { pickSponsorLeftImage.launch(imageOnly) }
        binding.chooseSponsorRightBtn.setOnClickListener { pickSponsorRightImage.launch(imageOnly) }

        binding.clearLogoBtn.setOnClickListener { clearPickedImage(LOGO_IMAGE_FILE, binding.logoThumbnail) { logoBitmap = null } }
        binding.clearSponsorHeadlineBtn.setOnClickListener {
            clearPickedImage(SPONSOR_HEADLINE_IMAGE_FILE, binding.sponsorHeadlineThumbnail) { sponsorHeadlineBitmap = null }
        }
        binding.clearSponsorLeftBtn.setOnClickListener {
            clearPickedImage(SPONSOR_LEFT_IMAGE_FILE, binding.sponsorLeftThumbnail) { sponsorLeftBitmap = null }
        }
        binding.clearSponsorRightBtn.setOnClickListener {
            clearPickedImage(SPONSOR_RIGHT_IMAGE_FILE, binding.sponsorRightThumbnail) { sponsorRightBitmap = null }
        }

        setupSizeSeekBar(binding.logoSizeSeekBar, binding.logoSizeValue, PREF_LOGO_SCALE) { logoScale = it }
        setupSizeSeekBar(binding.sponsorHeadlineSizeSeekBar, binding.sponsorHeadlineSizeValue, PREF_SPONSOR_HEADLINE_SCALE) {
            sponsorHeadlineScale = it
        }
        setupSizeSeekBar(binding.sponsorLeftSizeSeekBar, binding.sponsorLeftSizeValue, PREF_SPONSOR_LEFT_SCALE) {
            sponsorLeftScale = it
        }
        setupSizeSeekBar(binding.sponsorRightSizeSeekBar, binding.sponsorRightSizeValue, PREF_SPONSOR_RIGHT_SCALE) {
            sponsorRightScale = it
        }

        binding.sponsorHeadlinePrefixInput.doAfterTextChanged {
            sponsorHeadlinePrefix = it?.toString().orEmpty()
            prefs.edit().putString(PREF_SPONSOR_HEADLINE_PREFIX, sponsorHeadlinePrefix).apply()
            refreshOverlay()
        }

        binding.sponsorHeadlinePositionSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(bar: SeekBar, progress: Int, fromUser: Boolean) {
                val percent = progress - 50
                binding.sponsorHeadlinePositionValue.text = if (percent == 0) {
                    getString(R.string.default_position_label)
                } else {
                    getString(R.string.position_format, percent)
                }
                if (!fromUser) return
                // Higher progress moves the image up, so the offset is inverted relative to progress.
                sponsorHeadlineOffsetY = (50 - progress) / 200f
                prefs.edit().putFloat(PREF_SPONSOR_HEADLINE_OFFSET, sponsorHeadlineOffsetY).apply()
                refreshOverlay()
            }

            override fun onStartTrackingTouch(bar: SeekBar) = Unit
            override fun onStopTrackingTouch(bar: SeekBar) = Unit
        })
    }

    private fun setupSizeSeekBar(seekBar: SeekBar, valueLabel: TextView, prefKey: String, apply: (Float) -> Unit) {
        seekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(bar: SeekBar, progress: Int, fromUser: Boolean) {
                valueLabel.text = getString(R.string.percent_format, progress)
                if (!fromUser) return
                val scale = progress / 100f
                apply(scale)
                prefs.edit().putFloat(prefKey, scale).apply()
                refreshOverlay()
            }

            override fun onStartTrackingTouch(bar: SeekBar) = Unit
            override fun onStopTrackingTouch(bar: SeekBar) = Unit
        })
    }

    private fun setupPresetControls() {
        refreshPresetSpinner()

        binding.savePresetBtn.setOnClickListener { promptSavePreset() }

        binding.loadPresetBtn.setOnClickListener {
            val summary = selectedPreset()
            if (summary == null) {
                Toast.makeText(this, R.string.select_preset_first, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            loadPreset(summary.id)
        }

        binding.deletePresetBtn.setOnClickListener {
            val summary = selectedPreset()
            if (summary == null) {
                Toast.makeText(this, R.string.select_preset_first, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            AlertDialog.Builder(this)
                .setTitle(R.string.delete_preset_title)
                .setMessage(R.string.delete_preset_message)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.delete_preset) { _, _ ->
                    presetStore.delete(summary.id)
                    refreshPresetSpinner()
                }
                .show()
        }
    }

    private fun selectedPreset(): SponsorPresetSummary? =
        presetSummaries.getOrNull(binding.presetSpinner.selectedItemPosition)

    private fun promptSavePreset() {
        val input = EditText(this).apply {
            hint = getString(R.string.preset_name_hint)
            setSingleLine()
        }
        val padding = (16 * resources.displayMetrics.density).toInt()
        val container = LinearLayout(this).apply {
            setPadding(padding, padding, padding, 0)
            addView(input)
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.save_preset_title)
            .setView(container)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.save_preset) { _, _ ->
                val name = input.text?.toString()?.trim().orEmpty()
                if (name.isEmpty()) {
                    Toast.makeText(this, R.string.preset_name_required, Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                val id = presetStore.save(
                    name = name,
                    logoBitmap = logoBitmap,
                    sponsorHeadlineBitmap = sponsorHeadlineBitmap,
                    sponsorLeftBitmap = sponsorLeftBitmap,
                    sponsorRightBitmap = sponsorRightBitmap,
                    logoScale = logoScale,
                    sponsorHeadlineScale = sponsorHeadlineScale,
                    sponsorLeftScale = sponsorLeftScale,
                    sponsorRightScale = sponsorRightScale,
                    sponsorHeadlineOffsetY = sponsorHeadlineOffsetY,
                    sponsorHeadlinePrefix = sponsorHeadlinePrefix
                )
                refreshPresetSpinner(selectId = id)
                Toast.makeText(this, R.string.preset_saved, Toast.LENGTH_SHORT).show()
            }
            .show()
    }

    private fun loadPreset(id: String) {
        val data = presetStore.load(id) ?: return

        setSponsorSlotImage(data.logoBitmap, LOGO_IMAGE_FILE, binding.logoThumbnail)
        logoBitmap = data.logoBitmap
        setSponsorSlotImage(data.sponsorHeadlineBitmap, SPONSOR_HEADLINE_IMAGE_FILE, binding.sponsorHeadlineThumbnail)
        sponsorHeadlineBitmap = data.sponsorHeadlineBitmap
        setSponsorSlotImage(data.sponsorLeftBitmap, SPONSOR_LEFT_IMAGE_FILE, binding.sponsorLeftThumbnail)
        sponsorLeftBitmap = data.sponsorLeftBitmap
        setSponsorSlotImage(data.sponsorRightBitmap, SPONSOR_RIGHT_IMAGE_FILE, binding.sponsorRightThumbnail)
        sponsorRightBitmap = data.sponsorRightBitmap

        applySponsorMetaToUi(
            logoScale = data.logoScale,
            sponsorHeadlineScale = data.sponsorHeadlineScale,
            sponsorLeftScale = data.sponsorLeftScale,
            sponsorRightScale = data.sponsorRightScale,
            sponsorHeadlineOffsetY = data.sponsorHeadlineOffsetY,
            sponsorHeadlinePrefix = data.sponsorHeadlinePrefix
        )

        refreshOverlay()
        Toast.makeText(this, R.string.preset_loaded, Toast.LENGTH_SHORT).show()
    }

    private fun refreshPresetSpinner(selectId: String? = null) {
        presetSummaries = presetStore.list()
        val names = if (presetSummaries.isEmpty()) {
            listOf(getString(R.string.no_presets_saved))
        } else {
            presetSummaries.map { it.name }
        }
        val adapter = object : ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, names) {
            override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
                val view = super.getView(position, convertView, parent) as TextView
                view.setTextColor(Color.WHITE)
                return view
            }

            override fun getDropDownView(position: Int, convertView: View?, parent: ViewGroup): View {
                val view = super.getDropDownView(position, convertView, parent) as TextView
                view.setTextColor(Color.WHITE)
                view.setPadding(24, 20, 24, 20)
                return view
            }
        }
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.presetSpinner.adapter = adapter
        val selectPosition = selectId?.let { id -> presetSummaries.indexOfFirst { it.id == id } } ?: -1
        if (selectPosition >= 0) {
            binding.presetSpinner.setSelection(selectPosition)
        }
    }

    // The photo picker only grants temporary read access to the URI it returns — that
    // access doesn't reliably survive the app process being killed and restarted, which
    // is why previously-picked sponsor images silently failed to reload after a restart
    // while text prefs (stored in SharedPreferences, no URI involved) kept working fine.
    // Copying the decoded bitmap into our own app-private file the moment it's picked
    // sidesteps that entirely: internal files are always ours to read, no permission or
    // URI lifetime to worry about.
    private fun applyPickedImage(uri: Uri?, fileName: String, thumbnail: ImageView, apply: (Bitmap) -> Unit) {
        if (uri == null) return
        val bitmap = decodeSampledBitmap(uri)
        if (bitmap == null) {
            Toast.makeText(this, "Couldn't load that image", Toast.LENGTH_SHORT).show()
            return
        }
        setSponsorSlotImage(bitmap, fileName, thumbnail)
        apply(bitmap)
        refreshOverlay()
    }

    private fun loadSavedImage(fileName: String, thumbnail: ImageView, apply: (Bitmap) -> Unit) {
        val file = File(filesDir, fileName)
        if (!file.exists()) return
        val bitmap = BitmapFactory.decodeFile(file.absolutePath) ?: return
        apply(bitmap)
        thumbnail.setImageBitmap(bitmap)
        thumbnail.visibility = View.VISIBLE
    }

    private fun clearPickedImage(fileName: String, thumbnail: ImageView, apply: () -> Unit) {
        setSponsorSlotImage(null, fileName, thumbnail)
        apply()
        refreshOverlay()
    }

    // Shared by applyPickedImage/clearPickedImage and preset loading: writes (or removes)
    // the slot's app-private cache file and updates its thumbnail. Callers still set their
    // own in-memory Bitmap field themselves since which field that is varies per slot.
    private fun setSponsorSlotImage(bitmap: Bitmap?, fileName: String, thumbnail: ImageView) {
        if (bitmap != null) {
            saveImageToInternalStorage(bitmap, fileName)
            thumbnail.setImageBitmap(bitmap)
            thumbnail.visibility = View.VISIBLE
        } else {
            File(filesDir, fileName).delete()
            thumbnail.setImageDrawable(null)
            thumbnail.visibility = View.GONE
        }
    }

    private fun saveImageToInternalStorage(bitmap: Bitmap, fileName: String) {
        try {
            FileOutputStream(File(filesDir, fileName)).use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            }
        } catch (error: Exception) {
            Log.e(TAG, "Failed to cache $fileName to internal storage", error)
        }
    }

    private fun decodeSampledBitmap(uri: Uri): Bitmap? {
        return try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            var sampleSize = 1
            while (bounds.outWidth / sampleSize > MAX_SPONSOR_IMAGE_DIMENSION ||
                bounds.outHeight / sampleSize > MAX_SPONSOR_IMAGE_DIMENSION
            ) {
                sampleSize *= 2
            }
            val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
            contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, decodeOptions) }
        } catch (error: Exception) {
            Log.e(TAG, "Failed to decode picked image $uri", error)
            null
        }
    }

    private fun setupFieldPersistence() {
        binding.rtmpUrlInput.doAfterTextChanged {
            prefs.edit().putString(PREF_RTMP_URL, it?.toString().orEmpty()).apply()
        }
        binding.rtmpKeyInput.doAfterTextChanged {
            prefs.edit().putString(PREF_RTMP_KEY, it?.toString().orEmpty()).apply()
        }
    }

    // Both panels live in the same right-edge slot (see the layout comment on
    // liveControlPanel), so opening one always closes the other. Both
    // floating toggle buttons hide together whenever EITHER panel is open —
    // not just the one for its own panel — because they're stacked in the
    // same corner: with only "its own" button hidden, the *other* one stayed
    // visible right over the open panel's content, and since a MaterialButton
    // renders above a plain layout regardless of XML order (elevation), a tap
    // meant for the in-panel ✕ close button could land on that floating
    // button instead and reopen/switch instead of closing. Hiding both while
    // anything is open removes that collision entirely: the only way back to
    // "both buttons visible" is closing via the ✕.
    private fun setupPanelToggle() {
        binding.panelToggleBtn.setOnClickListener { openSettingsPanel() }
        binding.settingsCloseBtn.setOnClickListener { closeSettingsPanel() }
    }

    private fun setupLiveControlToggle() {
        binding.liveControlPanel.visibility = if (liveControlOpen) View.VISIBLE else View.GONE
        updateFloatingToggleVisibility()
        binding.liveControlToggleBtn.setOnClickListener { openLiveControlPanel() }
        binding.liveControlCloseBtn.setOnClickListener { closeLiveControlPanel() }
    }

    private fun updateFloatingToggleVisibility() {
        val anyPanelOpen = panelOpen || liveControlOpen
        binding.panelToggleBtn.visibility = if (anyPanelOpen) View.GONE else View.VISIBLE
        binding.liveControlToggleBtn.visibility = if (anyPanelOpen) View.GONE else View.VISIBLE
    }

    private fun openSettingsPanel() {
        panelOpen = true
        liveControlOpen = false
        binding.settingsPanel.visibility = View.VISIBLE
        binding.liveControlPanel.visibility = View.GONE
        updateFloatingToggleVisibility()
    }

    private fun closeSettingsPanel() {
        panelOpen = false
        binding.settingsPanel.visibility = View.GONE
        updateFloatingToggleVisibility()
    }

    private fun openLiveControlPanel() {
        liveControlOpen = true
        panelOpen = false
        binding.liveControlPanel.visibility = View.VISIBLE
        binding.settingsPanel.visibility = View.GONE
        updateFloatingToggleVisibility()
    }

    private fun closeLiveControlPanel() {
        liveControlOpen = false
        binding.liveControlPanel.visibility = View.GONE
        updateFloatingToggleVisibility()
    }

    /**
     * Settings panel is now four sub-sections (Camera / Sponsor Ads / Sports /
     * Stream Setup) switched by a TabLayout instead of one long scroll — same
     * show-one-hide-the-rest pattern already used for teamScoreGroup vs.
     * cricketGroup, just at the panel level instead of per-sport. Every
     * control inside each group keeps the exact id it always had, so nothing
     * else in this file needed to change — only which parent it lives in.
     */
    private fun setupSettingsTabs() {
        // Order follows the natural setup flow: pick a stream source, pick a
        // sport, pick sponsors, then camera (last since it has no controls
        // yet beyond the note — see cameraSettingsGroup's content).
        val tabGroups = listOf(
            binding.streamSetupGroup,
            binding.sportsSettingsGroup,
            binding.sponsorAdsGroup,
            binding.cameraSettingsGroup,
        )
        val tabTitles = listOf(
            R.string.tab_stream_setup,
            R.string.tab_sports,
            R.string.tab_sponsor_ads,
            R.string.tab_camera,
        )
        tabTitles.forEach { titleRes ->
            binding.settingsTabLayout.addTab(binding.settingsTabLayout.newTab().setText(titleRes))
        }
        binding.settingsTabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab) {
                tabGroups.forEachIndexed { index, group ->
                    group.visibility = if (index == tab.position) View.VISIBLE else View.GONE
                }
            }
            override fun onTabUnselected(tab: TabLayout.Tab) = Unit
            override fun onTabReselected(tab: TabLayout.Tab) = Unit
        })
    }

    /**
     * Persisted in the same prefs file as everything else (see
     * BroadcasterApp.PREFS_NAME), read there too so the app already
     * launches in the right theme before this switch even exists on
     * screen — this only needs to reflect that state and handle changes.
     *
     * recreate() is what actually applies a new theme (Android doesn't
     * hot-swap day/night resource values without one), but calling it
     * while rtmpCamera2.isStreaming would tear down and rebuild the
     * camera/encoder mid-broadcast — a real risk to an active stream, not
     * just a jarring UI moment. So a change made while live is saved and
     * will apply automatically next launch (or whenever you next open a
     * screen that recreates), but doesn't recreate right now — the toast
     * says so instead of silently doing nothing.
     */
    private fun setupThemeToggle() {
        binding.darkModeSwitch.isChecked = prefs.getBoolean(BroadcasterApp.PREF_DARK_MODE, true)
        binding.darkModeSwitch.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(BroadcasterApp.PREF_DARK_MODE, isChecked).apply()
            AppCompatDelegate.setDefaultNightMode(
                if (isChecked) AppCompatDelegate.MODE_NIGHT_YES else AppCompatDelegate.MODE_NIGHT_NO
            )
            if (rtmpCamera2.isStreaming) {
                Toast.makeText(this, R.string.theme_change_after_stream, Toast.LENGTH_LONG).show()
            } else {
                recreate()
            }
        }
    }

    private fun setupSportSpinner() {
        val sports = Sport.entries.toTypedArray()
        val adapter = object : ArrayAdapter<Sport>(this, android.R.layout.simple_spinner_item, sports) {
            override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
                val view = super.getView(position, convertView, parent) as TextView
                view.setTextColor(Color.WHITE)
                return view
            }

            override fun getDropDownView(position: Int, convertView: View?, parent: ViewGroup): View {
                val view = super.getDropDownView(position, convertView, parent) as TextView
                view.setTextColor(Color.WHITE)
                view.setPadding(24, 20, 24, 20)
                return view
            }
        }
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.sportSpinner.adapter = adapter
        binding.sportSpinner.setSelection(sports.indexOf(currentSport))
        binding.sportSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                currentSport = sports[position]
                prefs.edit().putString(PREF_SPORT, currentSport.name).apply()
                onSportChanged()
            }

            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
    }

    private fun onSportChanged() {
        val isCricket = currentSport.layout == ScoreboardLayout.CRICKET
        val isCleanSlate = currentSport.layout == ScoreboardLayout.NONE
        binding.teamScoreGroup.visibility = if (isCricket || isCleanSlate) View.GONE else View.VISIBLE
        binding.cricketGroup.visibility = if (isCricket) View.VISIBLE else View.GONE

        // Clean slate has nothing to call "away" — repurpose homeNameInput as
        // a single free-text event name and hide the away field entirely,
        // rather than adding a whole separate input just for this mode.
        binding.awayNameInput.visibility = if (isCleanSlate) View.GONE else View.VISIBLE
        binding.homeNameInput.hint = getString(if (isCleanSlate) R.string.hint_event_name else R.string.hint_home_team)
        binding.homeNameInput.setTextColor(
            ContextCompat.getColor(this, if (isCleanSlate) R.color.text_primary else R.color.home_color)
        )

        rebuildPresetRows()
        syncNamesFromInputs()
        currentPeriodIndex = 0
        refreshPeriodUi()
    }

    private fun rebuildPresetRows() {
        binding.homePresetsRow.removeAllViews()
        binding.awayPresetsRow.removeAllViews()
        val presets = currentSport.presets
        if (presets.isEmpty()) {
            binding.homePresetsRow.visibility = View.GONE
            binding.awayPresetsRow.visibility = View.GONE
            return
        }
        binding.homePresetsRow.visibility = View.VISIBLE
        binding.awayPresetsRow.visibility = View.VISIBLE
        presets.forEach { preset ->
            binding.homePresetsRow.addView(buildPresetChip(preset) {
                scoreController.adjustHome(preset.delta)
                refreshAll()
            })
            binding.awayPresetsRow.addView(buildPresetChip(preset) {
                scoreController.adjustAway(preset.delta)
                refreshAll()
            })
        }
    }

    private fun buildPresetChip(preset: ScoreIncrement, onClick: () -> Unit): MaterialButton {
        return MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
            text = preset.label
            textSize = 11f
            minWidth = 0
            minimumWidth = 0
            insetTop = 0
            insetBottom = 0
            setPadding(20, 8, 20, 8)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { marginStart = 8 }
            setOnClickListener { onClick() }
        }
    }

    private fun setupScoreControls() {
        binding.homeNameInput.doAfterTextChanged { syncNamesFromInputs() }
        binding.awayNameInput.doAfterTextChanged { syncNamesFromInputs() }

        binding.homeMinusBtn.setOnClickListener { scoreController.adjustHome(-1); refreshAll() }
        binding.homePlusBtn.setOnClickListener { scoreController.adjustHome(1); refreshAll() }
        binding.awayMinusBtn.setOnClickListener { scoreController.adjustAway(-1); refreshAll() }
        binding.awayPlusBtn.setOnClickListener { scoreController.adjustAway(1); refreshAll() }

        binding.undoBtn.setOnClickListener {
            if (scoreController.undo()) {
                refreshAll()
            } else {
                Toast.makeText(this, "Nothing to undo", Toast.LENGTH_SHORT).show()
            }
        }

        binding.swapBtn.setOnClickListener {
            scoreController.swapSides()
            binding.homeNameInput.setText(scoreController.state.homeName)
            binding.awayNameInput.setText(scoreController.state.awayName)
            refreshAll()
        }

        binding.resetScoreBtn.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle(R.string.reset_score_title)
                .setMessage(R.string.reset_score_message)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.reset) { _, _ ->
                    scoreController.resetScore()
                    refreshAll()
                }
                .show()
        }
    }

    private fun setupCricketControls() {
        binding.run0Btn.setOnClickListener { cricketController.addRuns(0); refreshAll() }
        binding.run1Btn.setOnClickListener { cricketController.addRuns(1); refreshAll() }
        binding.run2Btn.setOnClickListener { cricketController.addRuns(2); refreshAll() }
        binding.run3Btn.setOnClickListener { cricketController.addRuns(3); refreshAll() }
        binding.run4Btn.setOnClickListener { cricketController.addRuns(4); refreshAll() }
        binding.run6Btn.setOnClickListener { cricketController.addRuns(6); refreshAll() }
        binding.wideBtn.setOnClickListener { cricketController.addExtra(1); refreshAll() }
        binding.byeBtn.setOnClickListener { cricketController.addRuns(1); refreshAll() }
        binding.wicketBtn.setOnClickListener { cricketController.addWicket(); refreshAll() }

        binding.undoCricketBtn.setOnClickListener {
            if (cricketController.undo()) {
                refreshAll()
            } else {
                Toast.makeText(this, "Nothing to undo", Toast.LENGTH_SHORT).show()
            }
        }

        binding.swapInningsBtn.setOnClickListener {
            cricketController.swapInnings()
            refreshAll()
        }

        binding.resetInningsBtn.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle(R.string.reset_score_title)
                .setMessage(R.string.reset_score_message)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.reset) { _, _ ->
                    cricketController.resetInnings()
                    refreshAll()
                }
                .show()
        }
    }

    private fun syncNamesFromInputs() {
        val teamA = binding.homeNameInput.text?.toString().orEmpty()
        val teamB = binding.awayNameInput.text?.toString().orEmpty()
        scoreController.setNames(teamA, teamB)
        cricketController.setNames(teamA, teamB)
        prefs.edit().putString(PREF_TEAM_A, teamA).putString(PREF_TEAM_B, teamB).apply()
        refreshAll()
    }

    private fun setupTimerControls() {
        binding.timerToggleBtn.setOnClickListener {
            scoreController.toggleTimer()
            binding.timerToggleBtn.setText(if (scoreController.state.timerRunning) R.string.pause else R.string.start)
        }
        binding.timerResetBtn.setOnClickListener {
            scoreController.resetTimer()
            binding.timerToggleBtn.setText(R.string.start)
            // A timer reset is a fresh start for the match, so the period
            // resets with it — same reasoning as onSportChanged doing both.
            currentPeriodIndex = 0
            refreshPeriodUi()
            refreshAll()
        }
    }

    private fun setupPeriodControls() {
        binding.nextPeriodBtn.setOnClickListener {
            if (currentPeriodIndex < currentSport.periodLabels.lastIndex) {
                currentPeriodIndex++
                refreshPeriodUi()
                refreshOverlay()
            }
        }
    }

    /**
     * Shows/hides periodGroup and syncs periodValue/nextPeriodBtn to
     * currentSport/currentPeriodIndex. Called on sport change, a timer
     * reset, and after the crew advances the period — never assume the UI
     * is already in sync, always re-derive it from state.
     */
    private fun refreshPeriodUi() {
        val labels = currentSport.periodLabels
        if (labels.isEmpty()) {
            binding.periodGroup.visibility = View.GONE
            return
        }
        binding.periodGroup.visibility = View.VISIBLE
        binding.periodValue.text = labels[currentPeriodIndex]
        binding.nextPeriodBtn.isEnabled = currentPeriodIndex < labels.lastIndex
    }

    /**
     * disableAudio()/enableAudio() (RootEncoder's Camera2Base) just flips a
     * flag the encoder checks per audio frame — safe to call any time after
     * rtmpCamera2 is constructed, streaming or not, and doesn't tear down or
     * restart anything the way stopping/re-preparing the stream would. Not
     * persisted across restarts: unlike every other setup field, muting is a
     * live in-the-moment decision (half-time, a coaching aside, etc.) that
     * shouldn't silently carry over into the next match on the same device.
     */
    private fun setupMuteControl() {
        binding.muteAudioSwitch.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) rtmpCamera2.disableAudio() else rtmpCamera2.enableAudio()
        }
    }

    private fun setupGoLiveButton() {
        binding.goLiveBtn.setOnClickListener {
            when {
                reconnectPending -> cancelReconnect()
                rtmpCamera2.isStreaming -> stopStreamingManually()
                else -> startStreamingFresh()
            }
        }
    }

    private fun startStreamingFresh() {
        val url = binding.rtmpUrlInput.text?.toString().orEmpty().trim()
        val key = binding.rtmpKeyInput.text?.toString().orEmpty().trim()
        if (url.isBlank() || key.isBlank()) {
            Toast.makeText(this, R.string.enter_rtmp_details, Toast.LENGTH_LONG).show()
            return
        }
        streamUrl = if (url.endsWith("/")) url + key else "$url/$key"
        autoReconnectEnabled = true
        reconnectAttempts = 0
        updateStatus(R.string.status_connecting, Color.parseColor("#F2B33D"))
        if (prepareAndStartStream()) {
            binding.goLiveBtn.setText(R.string.end_stream)
        } else {
            autoReconnectEnabled = false
            updateStatus(R.string.status_failed, Color.parseColor("#E4392F"))
            Toast.makeText(this, "Could not prepare the encoder to start streaming", Toast.LENGTH_LONG).show()
        }
    }

    /**
     * stopStream() fully releases the video/audio encoders (confirmed by RootEncoder
     * throwing "VideoEncoder not prepared yet" when startStream() was called right
     * after stopStream() without this) — so every restart, whether the operator's
     * first Go Live, a manual restart after End Stream, or an auto-reconnect, has to
     * re-prepare before it can start again. The camera preview itself keeps running
     * throughout; only the streaming encoders get torn down and rebuilt here.
     */
    private fun prepareAndStartStream(): Boolean {
        if (!rtmpCamera2.prepareAudio() || !rtmpCamera2.prepareVideo(streamWidth, streamHeight, 30, streamBitrateKbps * 1024, 0)) {
            return false
        }
        overlayFilter = ImageObjectFilterRender()
        rtmpCamera2.glInterface.setFilter(overlayFilter)
        overlayFilter.setImage(renderCurrentOverlayBitmap())
        overlayFilter.setScale(100f, 100f)
        overlayFilter.setPosition(0f, 0f)
        rtmpCamera2.startStream(streamUrl)
        return true
    }

    private fun stopStreamingManually() {
        autoReconnectEnabled = false
        cancelPendingReconnect()
        rtmpCamera2.stopStream()
        binding.goLiveBtn.setText(R.string.go_live)
        updateStatus(R.string.status_offline, Color.parseColor("#B7C2CC"))
    }

    private fun cancelReconnect() {
        autoReconnectEnabled = false
        cancelPendingReconnect()
        if (rtmpCamera2.isStreaming) {
            rtmpCamera2.stopStream()
        }
        binding.goLiveBtn.setText(R.string.go_live)
        updateStatus(R.string.status_offline, Color.parseColor("#B7C2CC"))
        Toast.makeText(this, R.string.reconnect_cancelled, Toast.LENGTH_SHORT).show()
    }

    private fun cancelPendingReconnect() {
        reconnectRunnable?.let { uiHandler.removeCallbacks(it) }
        reconnectRunnable = null
        reconnectPending = false
        cancelReconnectWatchdog()
    }

    private fun scheduleReconnect() {
        cancelReconnectWatchdog()
        reconnectPending = true
        reconnectAttempts += 1
        val delayMs = reconnectDelayMillis(reconnectAttempts)
        Log.i(TAG, "scheduleReconnect attempt=$reconnectAttempts delayMs=$delayMs")
        updateStatus(getString(R.string.status_reconnecting, reconnectAttempts), Color.parseColor("#F2B33D"))
        binding.goLiveBtn.setText(R.string.cancel_reconnect)

        val runnable = Runnable {
            Log.i(TAG, "reconnect attempt=$reconnectAttempts firing now")
            reconnectRunnable = null
            reconnectPending = false
            suppressDisconnectUi = true
            try {
                if (rtmpCamera2.isStreaming) {
                    Log.i(TAG, "reconnect: stopping previous stream first")
                    rtmpCamera2.stopStream()
                }
                if (prepareAndStartStream()) {
                    Log.i(TAG, "reconnect: prepareAndStartStream succeeded, awaiting connection result")
                    armReconnectWatchdog()
                } else {
                    Log.w(TAG, "reconnect: prepareAndStartStream returned false, retrying")
                    scheduleReconnect()
                }
            } catch (error: Exception) {
                Log.e(TAG, "reconnect attempt threw, retrying", error)
                scheduleReconnect()
            }
        }
        reconnectRunnable = runnable
        uiHandler.postDelayed(runnable, delayMs)
    }

    /**
     * The Wi-Fi<->mobile-data test showed a reconnect attempt can send SPS/PPS and then
     * just hang — no onConnectionSuccess, no onConnectionFailed, for as long as we waited.
     * RootEncoder's own timeout for that specific stall (a TCP handshake stuck mid-network
     * handoff) either doesn't cover this path or is too slow to be useful live, so this
     * watchdog forces the next retry itself if an attempt never resolves either way.
     */
    private fun armReconnectWatchdog() {
        cancelReconnectWatchdog()
        val watchdog = Runnable {
            reconnectWatchdog = null
            Log.w(TAG, "reconnect watchdog fired: no result within ${RECONNECT_WATCHDOG_MS}ms, forcing retry")
            if (rtmpCamera2.isStreaming) {
                rtmpCamera2.stopStream()
            }
            scheduleReconnect()
        }
        reconnectWatchdog = watchdog
        uiHandler.postDelayed(watchdog, RECONNECT_WATCHDOG_MS)
    }

    private fun cancelReconnectWatchdog() {
        reconnectWatchdog?.let { uiHandler.removeCallbacks(it) }
        reconnectWatchdog = null
    }

    private fun reconnectDelayMillis(attempt: Int): Long {
        val backoffSeconds = longArrayOf(2, 4, 8, 15, 15)
        val index = (attempt - 1).coerceAtMost(backoffSeconds.lastIndex)
        return backoffSeconds[index] * 1000
    }

    private fun updateScorePanelUi() {
        val state = scoreController.state
        binding.homeScoreLabel.text = state.homeName
        binding.awayScoreLabel.text = state.awayName
        binding.homeScoreValue.text = state.homeScore.toString()
        binding.awayScoreValue.text = state.awayScore.toString()
        val minutes = state.elapsedSeconds / 60
        val seconds = state.elapsedSeconds % 60
        binding.timerValue.text = String.format("%02d:%02d", minutes, seconds)
    }

    private fun updateCricketPanelUi() {
        val state = cricketController.state
        binding.cricketBattingLabel.text = state.battingTeam
        binding.cricketScoreValue.text = "${state.runs}/${state.wickets}"
        binding.cricketOversValue.text = "(${state.overs}.${state.legalBallsInOver} ov)"
        val target = state.target
        binding.cricketTargetValue.text = if (target != null) {
            val need = (target - state.runs).coerceAtLeast(0)
            "Target $target · need $need"
        } else {
            ""
        }
    }

    private fun updateStatus(text: String, dotColor: Int) {
        binding.statusText.text = text
        binding.statusDot.setBackgroundColor(dotColor)
    }

    private fun updateStatus(textRes: Int, dotColor: Int) {
        updateStatus(getString(textRes), dotColor)
    }

    override fun onAuthError() {
        Log.w(TAG, "onAuthError")
        runOnUiThread {
            autoReconnectEnabled = false
            cancelPendingReconnect()
            updateStatus(R.string.status_failed, Color.parseColor("#E4392F"))
            binding.goLiveBtn.setText(R.string.go_live)
            Toast.makeText(this, "RTMP auth error — check the stream key", Toast.LENGTH_LONG).show()
        }
    }

    override fun onAuthSuccess() {
        Log.i(TAG, "onAuthSuccess")
        runOnUiThread { updateStatus(R.string.status_live, Color.parseColor("#3ECF6E")) }
    }

    override fun onConnectionFailed(reason: String) {
        Log.w(TAG, "onConnectionFailed reason=$reason autoReconnectEnabled=$autoReconnectEnabled reconnectPending=$reconnectPending")
        runOnUiThread {
            suppressDisconnectUi = false
            if (!autoReconnectEnabled || reconnectPending) return@runOnUiThread
            scheduleReconnect()
        }
    }

    override fun onConnectionStarted(url: String) {
        Log.i(TAG, "onConnectionStarted url=$url")
        runOnUiThread { updateStatus(R.string.status_connecting, Color.parseColor("#F2B33D")) }
    }

    override fun onConnectionSuccess() {
        Log.i(TAG, "onConnectionSuccess")
        runOnUiThread {
            suppressDisconnectUi = false
            reconnectAttempts = 0
            reconnectPending = false
            cancelReconnectWatchdog()
            binding.goLiveBtn.setText(R.string.end_stream)
            updateStatus(R.string.status_live, Color.parseColor("#3ECF6E"))
        }
    }

    override fun onDisconnect() {
        Log.w(TAG, "onDisconnect suppressDisconnectUi=$suppressDisconnectUi reconnectPending=$reconnectPending")
        runOnUiThread {
            if (suppressDisconnectUi || reconnectPending) return@runOnUiThread
            updateStatus(R.string.status_offline, Color.parseColor("#B7C2CC"))
            binding.goLiveBtn.setText(R.string.go_live)
        }
    }

    override fun onNewBitrate(bitrate: Long) {
        // Available for a future bitrate readout; not surfaced in the POC UI.
    }

    private companion object {
        const val TAG = "Broadcaster"
        const val RECONNECT_WATCHDOG_MS = 8000L
        // zoomSeekBar's default progress (= exactly 1.0x, see setupZoomControl)
        // and how many progress units on either side count as "close enough
        // to snap" — matches the layout comment on zoomSeekBar/its tick mark.
        const val DEFAULT_ZOOM_PROGRESS = 40
        const val ZOOM_SNAP_WINDOW = 15
        const val MAX_SPONSOR_IMAGE_DIMENSION = 512
        const val PREF_RTMP_URL = "rtmp_url"
        const val PREF_RTMP_KEY = "rtmp_key"
        const val PREF_TEAM_A = "team_a"
        const val PREF_TEAM_B = "team_b"
        const val PREF_SPORT = "sport"
        const val LOGO_IMAGE_FILE = "logo_image.png"
        const val SPONSOR_HEADLINE_IMAGE_FILE = "sponsor_headline_image.png"
        const val SPONSOR_LEFT_IMAGE_FILE = "sponsor_left_image.png"
        const val SPONSOR_RIGHT_IMAGE_FILE = "sponsor_right_image.png"
        const val PREF_LOGO_SCALE = "logo_scale"
        const val PREF_SPONSOR_HEADLINE_SCALE = "sponsor_headline_scale"
        const val PREF_SPONSOR_LEFT_SCALE = "sponsor_left_scale"
        const val PREF_SPONSOR_RIGHT_SCALE = "sponsor_right_scale"
        const val PREF_SPONSOR_HEADLINE_PREFIX = "sponsor_headline_prefix"
        const val PREF_SPONSOR_HEADLINE_OFFSET = "sponsor_headline_offset"
        const val PREF_CREW_ACCESS_TOKEN = "crew_access_token"
        const val PREF_CREW_REFRESH_TOKEN = "crew_refresh_token"
        const val PREF_CREW_EXPIRES_AT = "crew_expires_at"
        const val PREF_CREW_EMAIL = "crew_email"
        const val PREF_CREW_SCHOOL_ID = "crew_school_id"
        const val PREF_CREW_IS_ADMIN = "crew_is_admin"
        const val PREF_STREAM_RESOLUTION = "stream_resolution"
        const val PREF_STREAM_BITRATE = "stream_bitrate"
    }
}
