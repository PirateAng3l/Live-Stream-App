# Broadcaster POC (Android)

A narrow proof-of-concept for the broadcaster app described in `PROJECT_SPEC.md`: live
camera preview with a baked-in scoreboard/timer/sponsor overlay, a collapsible score
panel, and a real RTMP push to YouTube Live (or any RTMP target). No backend, no
accounts, no YouTube API automation — this is Stage 3's hard piece, isolated, so you can
see it actually work before anything else gets built around it.

## What it does

- Opens the camera + mic, shows a full-screen live preview.
- Composites a scoreboard (home/away name + score), a running match timer, a business
  logo corner, and sponsor placements (lower-third + two corners) **onto the video
  itself**, live — what you see on screen is what gets streamed and what ends up in the
  YouTube recording.
- A collapsible side panel (tap "Setup ▸" top-right) holds:
  - RTMP URL + stream key entry
  - Home/away team name entry
  - Score +/- for both sides, undo, swap sides, reset (with confirmation)
  - Timer start/pause/reset
  - Go Live / End Stream

## What it deliberately does NOT do (yet)

- No login, no fixture list, no backend — per spec Section 9, this validates the hard
  compositing+RTMP piece in isolation before the rest is built.
- No YouTube Live API automation — you create the broadcast in YouTube Studio manually
  and paste in the RTMP URL + stream key it gives you (Studio → Go Live → Stream).
- No SRT fallback, no adaptive bitrate, no thermal/battery instrumentation — all called
  out in spec Section 5.6 as follow-ups once the basic pipeline is proven.
- Sponsor/logo content is hardcoded placeholder text in `MainActivity.kt`
  (`businessLabel`, `sponsorHeadline`, `sponsorLeft`, `sponsorRight`) — swap those for
  real assets/images once you have brand material.

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

This project was scaffolded in a sandboxed cloud environment **with no access to
Google's Maven repository** (`dl.google.com` / `maven.google.com` were unreachable
here), so the Android Gradle Plugin, AndroidX, and the RootEncoder streaming library
could not actually be resolved or compiled in this session. Everything below was
written carefully by hand and cross-checked for consistency (view IDs, resource
references, imports), but **it has not been through a real compiler yet.** Treat the
first build in Android Studio as the actual verification step, not a formality.

1. Open the repo root in Android Studio (Koala/2024.x or newer recommended).
2. Let it sync — this resolves AGP, AndroidX, and RootEncoder from Google's Maven and
   JitPack, none of which were reachable from the build sandbox.
3. Most likely friction point: `app/build.gradle.kts` pins
   `com.github.pedroSG94.RootEncoder:library:2.5.2`. If that version doesn't resolve,
   check the latest tag at https://github.com/pedroSG94/RootEncoder/releases and bump
   it. The RootEncoder API surface used here (`RtmpCamera2`, `ConnectChecker`,
   `ImageObjectFilterRender`, `glInterface.setFilter/addFilter`) is stable across
   recent 2.x releases but exact package paths (`com.pedro.common.ConnectChecker` vs.
   an older `com.pedro.library.util.ConnectChecker`) have moved between versions —
   if the import doesn't resolve, Android Studio's "fix imports" will find the right
   package for whatever version actually resolves.
4. Run on a real device (camera + RTMP push don't work on the emulator in any useful
   way). minSdk is 26; targeting a higher-end phone per the spec's device guidance.
5. Grant camera + microphone permissions when prompted.

## Files

```
app/src/main/java/com/opendoorproductions/broadcaster/
  MainActivity.kt      screens, permissions, RootEncoder wiring, panel/timer logic
  OverlayRenderer.kt    draws the HUD bitmap (scoreboard/timer/logo/sponsors) fed to
                        RootEncoder's image filter every time state changes
  ScoreState.kt         score/timer state + undo history, no Android dependencies
app/src/main/res/layout/activity_main.xml   camera view + status chip + score panel
```

## Known rough edges (expected, for a "just see it work" POC)

- Overlay text uses default Android typography, not the "clean, broadcast-quality"
  look targeted in spec Section 5.5 — this proves the compositing pipeline works, not
  the final visual design.
- Stream resolution/bitrate/fps are hardcoded (1280x720 @ 30fps, 4 Mbps) in
  `MainActivity.kt`.
- No reconnect/resilience logic on connection drop (spec 5.6 flags SRT + real network
  testing as a first-class requirement before relying on this in the field).
- Landscape-only, single orientation, no rotation handling beyond that.

## Next steps (not done here — see PROJECT_SPEC.md Section 9)

Once this proves the camera→overlay→RTMP pipeline works on your actual target phone
over real wifi/cellular, the natural next steps per the spec are: real overlay design,
crew login + fixture assignment, and the backend/YouTube-API provisioning layer —
deliberately left out of this POC.
