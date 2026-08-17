# Open Door Live

This repo now holds two components of the platform described in `PROJECT_SPEC.md`:

- **`app/` — the Android broadcaster app** (documented below). Live camera preview
  with a baked-in scoreboard/timer/sponsor overlay, per-sport scoring, resilient
  RTMP push, and setup that survives a restart. Still runs standalone — no backend,
  no accounts, manual RTMP entry — this is Stage 3's hard piece, isolated, so it
  could be proven out before anything else got built around it.
- **`backend/` — the Supabase-backed backend.** Schools, fixtures/scheduling,
  sponsors, subscriptions, and the platform-admin / school-operator / parent account
  model. Not yet wired up to the app or a public web platform — see
  `backend/README.md` for what's there and what isn't yet.

## Broadcaster POC (Android)

## What it does

- Opens the camera + mic, shows a full-screen live preview.
- Composites a scoreboard, a running match timer, a business logo corner, and sponsor
  placements (lower-third + two corners) **onto the video itself**, live — what you see
  on screen is what gets streamed and what ends up in the YouTube recording.
- **Per-sport scoring**, chosen from a dropdown in setup:
  - Rugby / Soccer / Netball / Hockey / Other — a shared home-vs-away scoreboard, with
    rugby additionally getting named scoring-event chips (Try +5, Con +2, Pen +3,
    Drop +3) alongside the plain +/-1.
  - Cricket — a genuinely different model and overlay: runs/wickets/overs with legal-ball
    rollover, extras (wide/no-ball, bye), a wicket cap at 10, swap-innings with a
    target/chase line, and its own undo/reset.
- **RTMP auto-reconnect.** A dropped connection (network switch, dead zone, wifi↔mobile
  handoff) is detected and retried automatically with backoff, including an 8s watchdog
  that forces a retry if an attempt hangs instead of failing outright. Field-tested:
  survived two wifi↔mobile-data switches (~15s each) and a full ~10s data outage,
  continuing the stream each time without operator intervention. See "Connection
  resilience" below for what this does and doesn't cover.
- **Setup persistence.** RTMP URL, stream key, team names, and sport selection are saved
  as you type and restored on launch, so a restart mid-match doesn't mean retyping
  everything.
- **Real sponsor/logo images.** The business logo and all three sponsor slots
  (lower-third, bottom-left, bottom-right) can each be set to an actual uploaded image
  via the device photo picker — aspect-fit, centered, drawn straight into the same slot
  the placeholder text used to occupy. No image picked falls back to placeholder text,
  so the app still works with zero setup. Picks persist across restarts.
- A collapsible side panel (tap "Setup ▸" top-right) holds:
  - Sport selector
  - RTMP URL + stream key entry
  - Team A / Team B name entry
  - Sport-specific score controls, undo, swap/reset
  - Timer start/pause/reset
  - Sponsors & Logo: pick/clear an image for each of the 4 slots
  - Go Live / End Stream (becomes "Stop Reconnecting" mid-retry)

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

- No login, no fixture list, no backend — per spec Section 9, this validates the hard
  compositing+RTMP piece in isolation before the rest is built.
- No YouTube Live API automation — you create the broadcast in YouTube Studio manually
  and paste in the RTMP URL + stream key it gives you (Studio → Go Live → Stream).
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

## Building it

Open the repo root in Android Studio (Koala/2024.x or newer), let Gradle sync (resolves
AGP, AndroidX, and RootEncoder from Google's Maven and JitPack), run on a real device —
camera + RTMP push don't work on the emulator in any useful way. minSdk is 26. Grant
camera + microphone permissions when prompted.

If `app/build.gradle.kts`'s pinned `com.github.pedroSG94.RootEncoder:library` version
ever stops resolving, check https://github.com/pedroSG94/RootEncoder/releases for the
current tag and bump it.

## Files

```
app/src/main/java/com/opendoorproductions/broadcaster/
  MainActivity.kt            screens, permissions, RootEncoder wiring, reconnect logic,
                              sport switching, setup persistence, sponsor image pickers
  Sport.kt                   sport catalog: per-sport scoring presets + layout kind
  ScoreState.kt               home/away score + timer state, no Android dependencies
  CricketState.kt              runs/wickets/overs state, separate from ScoreState
  OverlayAsset.kt              one overlay slot's content: fallback text + optional image
  OverlayChrome.kt            logo + sponsor drawing shared by both overlay renderers
  TeamOverlayRenderer.kt      two-team scoreboard HUD (rugby/soccer/netball/hockey/other)
  CricketOverlayRenderer.kt   runs/wickets/overs HUD with target/chase line
app/src/main/res/layout/activity_main.xml   camera view + status chip + score panel
```

## Known rough edges (expected, for a "just see it work" POC)

- Overlay text uses default Android typography, not the "clean, broadcast-quality"
  look targeted in spec Section 5.5 — this proves the compositing pipeline works, not
  the final visual design.
- Stream resolution/bitrate/fps are hardcoded (1280x720 @ 30fps, 4 Mbps) in
  `MainActivity.kt`.
- Landscape-only, single orientation, no rotation handling beyond that.
- The stream key is stored in plain (unencrypted) app-private `SharedPreferences` —
  fine for a solo POC, worth upgrading to `EncryptedSharedPreferences` before this runs
  on shared crew devices.

## Next steps (not done here — see PROJECT_SPEC.md Section 9)

Real overlay visual design (spec 5.5's "clean, broadcast-quality" look), crew login +
fixture assignment, and the backend/YouTube-API provisioning layer — deliberately left
out of this POC.
