# Open Door Live

This repo now holds all three components of the platform described in
`PROJECT_SPEC.md`:

- **`app/` — the Android broadcaster app** (documented below). Live camera preview
  with a baked-in scoreboard/timer/sponsor overlay, per-sport scoring, resilient
  RTMP push, and setup that survives a restart. Still runs standalone with manual
  RTMP entry if nobody signs in — this is Stage 3's hard piece, proven out on its
  own before everything else got built around it. Now also has an optional "crew
  sign-in" that pulls a fixture + its stream key from the backend instead.
- **`backend/` — the Supabase-backed backend.** Schools, fixtures/scheduling,
  sponsors, subscriptions, the platform-admin / school-operator / parent account
  model, and an edge function that auto-provisions each fixture's YouTube Live
  broadcast. See `backend/README.md`.
- **`web/` — the public site + admin panel.** The match schedule (Upcoming /
  Completed, filterable by sport), per-match pages with a login-gated embedded
  YouTube player, parent sign-up/sign-in, and an internal `/admin` panel
  (create fixtures/teams/sponsors — creating a fixture is what triggers
  YouTube provisioning — and assign sponsors to individual fixtures) for
  `platform_admin`/`school_operator` accounts. See `web/README.md`.

## Broadcaster POC (Android)

## What it does

- Opens the camera + mic, shows a full-screen live preview.
- Composites a scoreboard, a running match timer, a business logo corner, and sponsor
  placements (lower-third + two corners) **onto the video itself**, live — what you see
  on screen is what gets streamed and what ends up in the YouTube recording.
- **Per-sport scoring**, chosen from a dropdown in setup:
  - Rugby / Soccer / Netball / Hockey — a shared home-vs-away scoreboard, with
    rugby additionally getting named scoring-event chips (Try +5, Con +2, Pen +3,
    Drop +3) alongside the plain +/-1.
  - Cricket — a genuinely different model and overlay: runs/wickets/overs with legal-ball
    rollover, extras (wide/no-ball, bye), a wicket cap at 10, swap-innings with a
    target/chase line, and its own undo/reset.
  - **Clean Slate / Event** — no scoreboard at all, for a broadcast that isn't a
    team-vs-team match: a school assembly, concert, play, or other cultural
    event. The single name field becomes a free-text event name (e.g. "Spring
    Concert") instead of a team name, and the overlay shows just that name
    plus the usual logo/sponsor chrome — no score panel, no timer pill.
    (`EventOverlayRenderer.kt`; still `Sport.OTHER` under the hood, so a
    fixture's `sport` string stays `"other"` and nothing on the backend/web
    side needed to change.)
- **Half/period indicator**, shown under the timer pill on rugby/soccer/hockey
  ("1st Half"/"2nd Half") and netball ("1st"–"4th Quarter"). Crew advances it
  manually with a **Next Period** button in the live control panel (same
  manual-control philosophy as score/timer — no guessing at when a half
  actually starts from the clock alone), which appears only for sports with
  labels defined (`Sport.periodLabels`) — cricket already shows its own
  overs/innings state, and Clean Slate/Event has no scoreboard to attach one
  to. Resets to the first period on a sport change or a timer reset, same as
  the rest of the match state.
- **Mute audio**, a switch in the live control panel that cuts the stream's
  audio without touching the video or the RTMP connection — for half-time,
  a sideline conversation, or any other moment the crew doesn't want to go
  out live. Works whether or not the stream has started yet, and isn't saved
  between sessions: it's a live in-the-moment decision, not a setup default,
  so every new stream starts unmuted.
- **Camera settings** (Camera tab): resolution (720p or 1080p) and stream
  quality/bitrate (Data saver 2.5 Mbps, Standard 4 Mbps — the original
  hardcoded default, High 6 Mbps). Both are saved to the same prefs file as
  everything else and, like the dark/light theme switch, only take effect on
  the next app open if changed mid-stream — resizing the encoder while live
  would tear down the camera/RTMP session mid-broadcast, so a change made
  while streaming is saved but not applied until the app restarts.
- **RTMP auto-reconnect.** A dropped connection (network switch, dead zone, wifi↔mobile
  handoff) is detected and retried automatically with backoff, including an 8s watchdog
  that forces a retry if an attempt hangs instead of failing outright. Field-tested:
  survived two wifi↔mobile-data switches (~15s each) and a full ~10s data outage,
  continuing the stream each time without operator intervention. See "Connection
  resilience" below for what this does and doesn't cover.
- **Setup persistence.** RTMP URL, stream key, team names, and sport selection are saved
  as you type and restored on launch, so a restart mid-match doesn't mean retyping
  everything. The prefs file backing all of this (and the crew sign-in tokens) is
  encrypted at rest via AndroidX Security's `EncryptedSharedPreferences`
  (`BroadcasterApp.encryptedPrefs`, key held in the Android Keystore) rather than a
  plain XML file — a lost or shared device shouldn't leak a school's stream key. It's
  also excluded from Android's backup/device-transfer (`backup_rules.xml`/
  `data_extraction_rules.xml`) since the Keystore key itself never travels with a
  backup, so a restored copy of the file could never be decrypted anyway.
- **Real sponsor/logo images.** The business logo and all three sponsor slots
  (lower-third, bottom-left, bottom-right) can each be set to an actual uploaded image
  via the device photo picker — aspect-fit, centered, drawn straight into the same slot
  the placeholder text used to occupy. No image picked falls back to placeholder text,
  so the app still works with zero setup. Picks persist across restarts.
- **Zoom, 0.6x (wide) to 5x**, a vertical slider on the left edge of the preview —
  always visible, not tucked in Settings, since it's a live framing adjustment made
  while watching the shot, not a one-time setting. **Snaps to exactly 1.0x** when
  dragged within about ±0.15x of it — landing on the true default stop by touch
  alone is fiddly now that it isn't at either end of the track, so the slider does
  the precision for you. A subtle static tick also marks that spot — positioned by
  reading the SeekBar's own `thumb.bounds` at runtime (`alignZoomTickToThumb()`)
  rather than a hand-calculated margin, since two rounds of guessing the stock
  thumb's internal inset by eye (including `android:thumbOffset="0dp"`, which
  helps but wasn't the whole story) didn't land it exactly; asking Android
  directly where it actually drew the thumb is the one source of truth that
  can't be off. The slider always
  starts at 1.0x on launch (not persisted, unlike every other setup field, so a
  restart mid-match doesn't leave the last operator's zoom choice as a surprise
  starting point for whoever's on the phone next). The 0.6x end only does something
  on a device with an ultra-wide lens reporting that range — otherwise the real
  hardware floor (usually 1x) clamps it, same as the 5x ceiling already did on
  phones with a lower real maximum.
- **Two panels sharing the same right-edge slot, opened by a floating icon
  button and closed by a ✕ inside the panel itself. Both closed on
  launch** — a clean, unobstructed preview until you actually open
  something, not a settings tab or the score panel already sitting open.
  Both floating icon buttons hide together the moment either panel
  opens, and both reappear once it's closed — not just "its own" button,
  because they're stacked in the same corner and a MaterialButton renders
  above plain content regardless of XML order (elevation), so leaving the
  *other* one visible meant it could actually catch a tap meant for the ✕
  underneath and reopen/switch instead of closing. Opening one panel
  always closes the other, so they never overlap the camera preview or
  each other:
  - **A scoreboard icon — the live control panel.** Score
    controls (undo/swap/reset), the timer, and Go Live / End Stream
    (becomes "Stop Reconnecting" mid-retry). This is what actually gets
    touched during a match, right on the edge rather than sitting over the
    middle of the shot.
  - **A gear icon — the settings panel, tabbed in setup order**
    (opens on *Stream Setup*, the natural first
    step):
    - *Stream Setup* — crew sign-in, RTMP URL + stream key entry.
    - *Sports* — sport selector, team name entry (or a single event name
      when Clean Slate / Event is selected).
    - *Sponsor Ads* — logo + all three sponsor slots (pick/clear/size/
      position), sponsor presets.
    - *Camera* — last, since it's the one tab with nothing to configure
      yet — currently just a note; zoom itself is the always-visible
      slider on the left edge of the preview, not tucked in here (it's a
      live framing adjustment, not a one-time setting). Placeholder for
      resolution/bitrate/fps controls once those stop being hardcoded.
- **Dark/light theme, switchable in-app** (Settings panel, top, above the
  tabs) — a real Android day/night resource split
  (`values/colors.xml` = light, `values-night/colors.xml` = dark), not
  just the one icon color: backgrounds, panel chrome, text, dividers all
  swap. Defaults to dark (the app's original look) so an install that
  never touches the switch is unchanged. Applying a change calls
  `Activity.recreate()`, which Android needs to actually repaint with the
  new resource set — except while a broadcast is live
  (`rtmpCamera2.isStreaming`), where recreating would tear down and
  rebuild the camera/encoder mid-stream, a real risk to an active
  broadcast, not just a jarring UI moment. A change made while live is
  saved and takes effect next launch instead, with a toast saying so.
  **Does not touch the broadcast overlay itself** — `TeamOverlayRenderer`
  / `CricketOverlayRenderer` / `EventOverlayRenderer` / `OverlayChrome`
  all draw with their own hardcoded colors, never reading from this
  file, on purpose: what a viewer sees in the stream shouldn't change
  because the operator's phone is in light or dark mode.

## Connection resilience — what it actually covers

- Detects a dropped RTMP connection (via RootEncoder's `onConnectionFailed`) and retries
  with backoff (2s → 4s → 8s → 15s, then holds at 15s), indefinitely — it does not give
  up and require a manual restart.
- A per-attempt watchdog (8s) forces the next retry if an attempt neither succeeds nor
  fails — this was a real bug found in field testing: a stalled TCP handshake right
  after a network interface switch produced neither callback, so the naive
  callback-only version just sat there forever. The watchdog is what actually fixes
  "never reconnects."
- Auth errors (bad stream key) are excluded from the retry loop — that can't be fixed by
  retrying, so it fails immediately with a clear message instead of looping.
- The operator can bail out any time via the Go Live button, which becomes
  "Stop Reconnecting" during a retry cycle.
- What it does *not* do: SRT fallback or adaptive bitrate (spec 5.6 flags both as
  follow-ups), and it can't make a genuinely dead network resolve faster — a long real
  outage means a proportionally long visible gap before it catches back up.

## What it deliberately does NOT do (yet)

- No SRT fallback, no adaptive bitrate, no thermal/battery instrumentation.
- Sponsor/logo *text* (the fallback shown when no image is picked) is still hardcoded
  in `MainActivity.kt` (`businessLabel`, `sponsorHeadline`, `sponsorLeft`,
  `sponsorRight`) — only the images are operator-editable so far, not the labels.
- No position/tier reassignment (spec 5.5's headline-vs-corner tiering) — each of the
  4 slots is fixed to its named position; you can change *what* image is shown, not
  *where* it appears.

## Getting a stream key to test with

1. Go to YouTube Studio → **Create** → **Go live**.
2. Choose **Stream** (not webcam). Copy the **Stream URL** (e.g.
   `rtmp://a.rtmp.youtube.com/live2`) and the **Stream key** separately.
3. Paste the URL into the app's "RTMP URL" field and the key into "Stream key". The app
   joins them into one push target when you tap **Go Live**.
4. It can take ~20-60s for YouTube to recognize the incoming stream before its own
   preview shows video.

Any other RTMP-accepting target (e.g. a local `nginx-rtmp` / `MediaMTX` server, or
restream.io) works the same way for a first no-YouTube-account test.

## Crew sign-in (optional) — pulling a fixture from the backend

The manual RTMP URL/key entry above always works and is untouched — but there's now
an optional "CREW SIGN-IN" section above it, in the Settings panel's Stream Setup
tab, that talks to the `backend/` project (see its own README): sign in with a crew email/password, pick an
upcoming fixture from a dropdown, tap **Load Fixture**, and it fills
in the RTMP URL/key (pulled from `fixture_broadcast_credentials`, provisioned
automatically when the fixture was created — see
`backend/supabase/functions/provision-fixture-broadcast/`), plus the team names and
sport, exactly the way manual entry would. Sign out to clear the stored session.
If a team has a `short_name` set on the web (`/admin/teams`, e.g. "Rev High 1st
Team" for "Revelation High 1st Team"), that's what fills the name field instead
of the full name (`SupabaseClient.getUpcomingFixtures`/`getAllUpcomingFixtures`)
— still just plain text in an editable field, so crew can override it per match
same as manual entry. `TeamOverlayRenderer`'s own auto-shrink/ellipsis
(`drawFittedName`) is the backstop regardless — a name with no `short_name` set,
or one still too long even so, never overflows into the score.

**Setup:** the app needs a Supabase project URL + anon key to talk to, read from
`local.properties` (gitignored, never committed) at build time — add:
```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your project's anon key>
```
Without these, the sign-in button just shows "Backend not configured" instead of
crashing — this feature is additive, not a requirement to use the app.

**Two crew roles, two fixture lists.** A `school_operator` account (always tied to
exactly one school — see the `profiles` table's shape constraint) sees only that
school's upcoming fixtures (`SupabaseClient.getUpcomingFixtures`). A
`platform_admin` account has no single school by design, so it gets every upcoming
fixture across every school instead (`getAllUpcomingFixtures`), with each dropdown
entry prefixed by its school name (e.g. "Riverside High — Team A vs Team B") since a
plain "Team A vs Team B" would be ambiguous once fixtures from different schools are
mixed into one list. Which path a signed-in account gets is decided purely by
whether its profile has a `school_id` — the same way the web admin panel's
`resolveSchoolContext` tells the two roles apart.

**Loading a fixture also fetches the home team's real logo.** The small mark to the
left of each team's name/score in the scoreboard — previously a flat blue (home) /
red (away) block — is now that team's actual emblem. If the fixture's host school
has uploaded one (`/admin/school` on the web, stored via Supabase Storage — see
`backend/supabase/migrations/0006_school_logo_storage.sql`), it's downloaded and
composited into the home slot (`MainActivity.fetchHomeTeamLogo`,
`TeamOverlayRenderer.drawTeamMark`). Otherwise — and always for the away side, since
there's no reliable link from a typed-in opponent name to that school's actual
account today — it falls back to Open Door Live's own mark
(`R.drawable.odl_mark`, `defaultTeamLogoBitmap`). Cricket's scoreboard has no
equivalent stripe to begin with, so this only applies to the `TWO_TEAM` sports
(rugby/soccer/netball/hockey/other).

**Loading a fixture also fetches its assigned sponsor logos.** Whatever a
school assigned to the fixture on the web (`/admin/fixtures/[id]`'s "Assign
sponsor" form, `layer=baked_in`) downloads and fills the headline/left/right
sponsor slots automatically — the same three slots the Settings panel's
Sponsor Ads tab lets crew pick manually, so an auto-loaded logo shows up
there too (thumbnail, persisted to disk) and can still be overridden by hand
afterward if needed. All three slots are cleared first, then repopulated
from whatever this fixture actually has assigned (`applyFixtureSponsors`,
`SupabaseClient.getFixtureSponsors`) — same "Load Fixture overwrites
wholesale" behavior as the RTMP credentials/team names/sport above, so a
previous fixture's sponsor doesn't linger in a slot this one leaves empty.
A sponsor's logo has to actually be uploaded on the web
(`/admin/sponsors/[id]/edit`, Supabase Storage — see
`backend/supabase/migrations/0009_sponsor_logo_storage.sql`) for any of this
to have something to fetch; a sponsor with no logo set yet is skipped, same
as a school with no logo falls back to the default mark above.

**Brand assets.** `res/drawable-nodpi/odl_mark.png` (the scoreboard fallback
above) and `res/drawable-nodpi/ic_launcher_foreground.png` (the actual app
launcher icon, referenced from `mipmap-anydpi-v26/ic_launcher.xml`) are both
crops of the same source logo — a transparent-background isolation of just
the circular door/play mark, without the "OPEN DOOR LIVE" wordmark/tagline
that only reads at full logo size. The two crops differ in padding:
`ic_launcher_foreground.png` insets its content to ~60% of the canvas so it
survives Android's adaptive-icon masking (circle, squircle, etc. — anything
outside the guaranteed-visible ~66% safe zone gets clipped on some
launchers), while `odl_mark.png` fills its frame edge-to-edge since it's
never masked — `TeamOverlayRenderer.drawTeamMark`/`OverlayChrome.drawBitmapFit`
just aspect-fit it into whatever corner slot is available. `drawable-nodpi`
(not a plain `drawable`) so neither gets density-rescaled the way a
per-density-bucket resource would.

## Building it

Open the repo root in Android Studio (Koala/2024.x or newer), let Gradle sync (resolves
AGP, AndroidX, and RootEncoder from Google's Maven and JitPack), run on a real device —
camera + RTMP push don't work on the emulator in any useful way. minSdk is 26. Grant
camera + microphone permissions when prompted.

If `app/build.gradle.kts`'s pinned `com.github.pedroSG94.RootEncoder:library` version
ever stops resolving, check https://github.com/pedroSG94/RootEncoder/releases for the
current tag and bump it.

### Getting a built APK without Android Studio

`.github/workflows/build-apk.yml` builds a debug APK on every push to this branch that
touches `app/`, or on demand via the Actions tab's "Run workflow" button. Grab the
result from that workflow run's Summary page → Artifacts → `broadcaster-debug-apk`,
unzip it, and sideload `app-debug.apk` onto a device (unknown sources must be allowed).
It's a debug build (auto-generated debug keystore, `isMinifyEnabled = false`) — fine for
testing, not for a Play Store submission. `SUPABASE_URL`/`SUPABASE_ANON_KEY` repo secrets
are wired in if set; otherwise the build degrades the same way an unconfigured
`local.properties` does locally — crew sign-in unavailable, everything else unaffected.

## Files

```
app/src/main/java/com/opendoorproductions/broadcaster/
  MainActivity.kt            screens, permissions, RootEncoder wiring, reconnect logic,
                              sport switching, setup persistence, sponsor image pickers
  Sport.kt                   sport catalog: per-sport scoring presets + layout kind
  ScoreState.kt               home/away score + timer state, no Android dependencies
  CricketState.kt              runs/wickets/overs state, separate from ScoreState
  OverlayAsset.kt              one overlay slot's content: fallback text + optional image
  OverlayChrome.kt            logo + sponsor drawing shared by all overlay renderers
  TeamOverlayRenderer.kt      two-team scoreboard HUD (rugby/soccer/netball/hockey)
  CricketOverlayRenderer.kt   runs/wickets/overs HUD with target/chase line
  EventOverlayRenderer.kt     no-scoreboard HUD for Clean Slate / Event (just a name + chrome)
  SponsorPresetStore.kt       named save/load/delete of a full sponsor setup
  BroadcasterApp.kt           applies the saved dark/light preference at process start
  backend/
    BackendConfig.kt          reads SUPABASE_URL/SUPABASE_ANON_KEY from BuildConfig
    SupabaseClient.kt         blocking HTTP client: crew sign-in, fixtures, credentials
app/src/main/res/layout/activity_main.xml   camera view + status chip (bottom-left,
                                              moved off the team names) + live control
                                              panel (score/timer/Go Live) + tabbed
                                              settings panel
app/src/main/res/values/colors.xml          light theme palette (the default resource set)
app/src/main/res/values-night/colors.xml    dark theme palette (the app's original look)
```

## Known rough edges (expected, for a "just see it work" POC)

- Overlay text uses default Android typography, not the "clean, broadcast-quality"
  look targeted in spec Section 5.5 — this proves the compositing pipeline works, not
  the final visual design.
- Frame rate is still hardcoded at 30fps in `MainActivity.kt` — resolution and
  bitrate are now configurable (see "Camera settings" above).
- Landscape-only, single orientation, no rotation handling beyond that.

## Next steps (not done here — see PROJECT_SPEC.md Section 9)

Real overlay visual design (spec 5.5's "clean, broadcast-quality" look), crew login +
fixture assignment, and the backend/YouTube-API provisioning layer — deliberately left
out of this POC.
