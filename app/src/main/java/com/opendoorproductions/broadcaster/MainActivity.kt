package com.opendoorproductions.broadcaster

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.widget.doAfterTextChanged
import com.opendoorproductions.broadcaster.databinding.ActivityMainBinding
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.gl.render.filters.`object`.ImageObjectFilterRender
import com.pedro.library.rtmp.RtmpCamera2

class MainActivity : AppCompatActivity(), ConnectChecker {

    private lateinit var binding: ActivityMainBinding
    private lateinit var rtmpCamera2: RtmpCamera2
    private lateinit var overlayRenderer: OverlayRenderer
    private lateinit var overlayFilter: ImageObjectFilterRender

    private val scoreController = ScoreController()
    private val uiHandler = Handler(Looper.getMainLooper())
    private var panelOpen = false

    private val streamWidth = 1280
    private val streamHeight = 720

    private val businessLabel = "OPEN DOOR"
    private val sponsorHeadline = "HEADLINE SPONSOR"
    private val sponsorLeft = "SPONSOR A"
    private val sponsorRight = "SPONSOR B"

    private val permissionRequest = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = grants[Manifest.permission.CAMERA] == true &&
            grants[Manifest.permission.RECORD_AUDIO] == true
        if (granted) {
            startPreview()
        } else {
            Toast.makeText(this, R.string.camera_permission_required, Toast.LENGTH_LONG).show()
        }
    }

    private val timerTick = object : Runnable {
        override fun run() {
            scoreController.tickTimerIfRunning()
            refreshOverlay()
            updateScorePanelUi()
            uiHandler.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        overlayRenderer = OverlayRenderer(streamWidth, streamHeight)
        rtmpCamera2 = RtmpCamera2(binding.openGlView, this)

        setupPanelToggle()
        setupScoreControls()
        setupTimerControls()
        setupGoLiveButton()
        updateScorePanelUi()
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
            if (rtmpCamera2.prepareAudio() && rtmpCamera2.prepareVideo(streamWidth, streamHeight, 30, 4_000 * 1024, 0)) {
                overlayFilter = ImageObjectFilterRender()
                rtmpCamera2.glInterface.setFilter(overlayFilter)
                overlayFilter.setImage(overlayRenderer.render(scoreController.state, businessLabel, sponsorHeadline, sponsorLeft, sponsorRight))
                overlayFilter.setScale(100f, 100f)
                overlayFilter.setPosition(0f, 0f)
                rtmpCamera2.startPreview()
            } else {
                Toast.makeText(this, "Could not open camera/mic for preview", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun refreshOverlay() {
        if (!::overlayFilter.isInitialized) return
        overlayFilter.setImage(
            overlayRenderer.render(scoreController.state, businessLabel, sponsorHeadline, sponsorLeft, sponsorRight)
        )
    }

    private fun setupPanelToggle() {
        binding.panelToggleBtn.setOnClickListener {
            panelOpen = !panelOpen
            binding.scorePanel.visibility = if (panelOpen) android.view.View.VISIBLE else android.view.View.GONE
            binding.panelToggleBtn.setText(if (panelOpen) R.string.panel_toggle_hide else R.string.panel_toggle_show)
        }
    }

    private fun setupScoreControls() {
        binding.homeNameInput.doAfterTextChanged { syncNamesFromInputs() }
        binding.awayNameInput.doAfterTextChanged { syncNamesFromInputs() }

        binding.homeMinusBtn.setOnClickListener { scoreController.adjustHome(-1); onScoreChanged() }
        binding.homePlusBtn.setOnClickListener { scoreController.adjustHome(1); onScoreChanged() }
        binding.awayMinusBtn.setOnClickListener { scoreController.adjustAway(-1); onScoreChanged() }
        binding.awayPlusBtn.setOnClickListener { scoreController.adjustAway(1); onScoreChanged() }

        binding.undoBtn.setOnClickListener {
            if (scoreController.undo()) {
                onScoreChanged()
            } else {
                Toast.makeText(this, "Nothing to undo", Toast.LENGTH_SHORT).show()
            }
        }

        binding.swapBtn.setOnClickListener {
            scoreController.swapSides()
            binding.homeNameInput.setText(scoreController.state.homeName)
            binding.awayNameInput.setText(scoreController.state.awayName)
            onScoreChanged()
        }

        binding.resetScoreBtn.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle(R.string.reset_score_title)
                .setMessage(R.string.reset_score_message)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.reset) { _, _ ->
                    scoreController.resetScore()
                    onScoreChanged()
                }
                .show()
        }
    }

    private fun syncNamesFromInputs() {
        scoreController.setNames(
            binding.homeNameInput.text?.toString().orEmpty(),
            binding.awayNameInput.text?.toString().orEmpty()
        )
        onScoreChanged()
    }

    private fun setupTimerControls() {
        binding.timerToggleBtn.setOnClickListener {
            scoreController.toggleTimer()
            binding.timerToggleBtn.setText(if (scoreController.state.timerRunning) R.string.pause else R.string.start)
        }
        binding.timerResetBtn.setOnClickListener {
            scoreController.resetTimer()
            binding.timerToggleBtn.setText(R.string.start)
            refreshOverlay()
            updateScorePanelUi()
        }
    }

    private fun setupGoLiveButton() {
        binding.goLiveBtn.setOnClickListener {
            if (rtmpCamera2.isStreaming) {
                rtmpCamera2.stopStream()
                binding.goLiveBtn.setText(R.string.go_live)
                updateStatus(R.string.status_offline, Color.parseColor("#B7C2CC"))
            } else {
                val url = binding.rtmpUrlInput.text?.toString().orEmpty().trim()
                val key = binding.rtmpKeyInput.text?.toString().orEmpty().trim()
                if (url.isBlank() || key.isBlank()) {
                    Toast.makeText(this, R.string.enter_rtmp_details, Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }
                val fullUrl = if (url.endsWith("/")) url + key else "$url/$key"
                updateStatus(R.string.status_connecting, Color.parseColor("#F2B33D"))
                rtmpCamera2.startStream(fullUrl)
                binding.goLiveBtn.setText(R.string.end_stream)
            }
        }
    }

    private fun onScoreChanged() {
        refreshOverlay()
        updateScorePanelUi()
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

    private fun updateStatus(textRes: Int, dotColor: Int) {
        binding.statusText.setText(textRes)
        binding.statusDot.setBackgroundColor(dotColor)
    }

    override fun onAuthError() {
        runOnUiThread {
            updateStatus(R.string.status_failed, Color.parseColor("#E4392F"))
            binding.goLiveBtn.setText(R.string.go_live)
            Toast.makeText(this, "RTMP auth error — check the stream key", Toast.LENGTH_LONG).show()
        }
    }

    override fun onAuthSuccess() {
        runOnUiThread { updateStatus(R.string.status_live, Color.parseColor("#3ECF6E")) }
    }

    override fun onConnectionFailed(reason: String) {
        runOnUiThread {
            updateStatus(R.string.status_failed, Color.parseColor("#E4392F"))
            binding.goLiveBtn.setText(R.string.go_live)
            Toast.makeText(this, "Connection failed: $reason", Toast.LENGTH_LONG).show()
        }
    }

    override fun onConnectionStarted(url: String) {
        runOnUiThread { updateStatus(R.string.status_connecting, Color.parseColor("#F2B33D")) }
    }

    override fun onConnectionSuccess() {
        runOnUiThread { updateStatus(R.string.status_live, Color.parseColor("#3ECF6E")) }
    }

    override fun onDisconnect() {
        runOnUiThread {
            updateStatus(R.string.status_offline, Color.parseColor("#B7C2CC"))
            binding.goLiveBtn.setText(R.string.go_live)
        }
    }

    override fun onNewBitrate(bitrate: Long) {
        // Available for a future bitrate readout; not surfaced in the POC UI.
    }
}
