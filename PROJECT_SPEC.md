# School Livestreaming Platform — Project Specification

**Version:** 1.0
**Date:** 14 August 2026
**Owner:** JD (Open Door Productions)
**Purpose of this document:** A complete, build-ready specification for a livestreaming-as-a-service platform for schools. Written so that a software developer or AI coding agent can build the system from scratch without further context. Read the whole document before writing code — the architecture decisions in Sections 3 and 4 drive everything else.

---

## 1. Executive Summary

### 1.1 What this is
A **livestreaming-as-a-service operation** for school sports and cultural events, supported by proprietary software. A trained field crew is dispatched to schools with a phone and gear to livestream matches and events. Streams carry a broadcast-quality overlay (team names, live score, timer, sponsor placements) burned into the video, are delivered to viewers via YouTube Live as the delivery backbone, and are surfaced to parents through a branded web platform with scheduling, match listings, live viewing, and replays.

### 1.2 What this is NOT
- **Not** a self-serve SaaS product sold to the public. The broadcaster app is for internal, provisioned crew only (with an optional future path to open signups).
- **Not** dependent on paid streaming infrastructure (Mux/Cloudflare/AWS IVS) for delivery. YouTube Live carries ingest, transcoding, and per-viewer delivery at no cost. This is the core economic insight of the model.

### 1.3 Business model
Free (or low-cost) to schools. Funded by local businesses buying sponsor placements on the streams. Each individual fixture must cover crew time + travel + margin through its sponsor slots.

### 1.4 The core technical insight
The expensive part of streaming (transcoding + per-viewer delivery bandwidth) is outsourced to YouTube Live for free. The proprietary product is:
1. **The broadcaster app** — bakes a designed overlay onto the camera feed and pushes to YouTube over RTMP. (The one genuinely hard engineering piece.)
2. **The web platform** — scheduling, match listings, gated viewing, embedded playback with additional web-layer sponsor slots, and replays. (Standard web CRUD.)

---

## 2. Reference / Competitor Context

A live competitor, **Cool Schools** (coolschools.co.za), validates this exact model in the South African market. Their implementation confirms:
- Overlays (scoreboard, team names, timer, logo) are **burned into the video** and persist on YouTube replays.
- The website is a **wrapper around embedded YouTube** with a match schedule (Upcoming / Completed), per-sport filters, per-match pages, a "Notify Me" for upcoming streams, and share buttons.
- Their videos are **public on YouTube** (open-access model).

**Where this project deliberately improves on the competitor:**
1. **Better overlay design.** The competitor's overlay is functional but dated (blocky black bars, basic type). This project targets a cleaner, broadcast-quality overlay as a visible differentiator.
2. **Structured sponsor system.** The competitor drops a static logo in a corner. This project treats sponsors as structured, positioned, tiered placements set per match.
3. **Gated / closed viewing (see Section 4.4).** The competitor is fully public on YouTube. This project aims for access-controlled viewing for child-safeguarding and POPIA reasons — a genuine selling point and a deliberate architectural divergence.
4. **Cross-platform broadcaster (iOS + Android).** The competitor is iOS-only because they serve an uncontrolled public user base and must guarantee quality across unknown devices. This project controls its own crew and devices, so it can support both platforms and choose devices on quality-per-cost.

---

## 3. System Architecture Overview

Three components:

```
┌─────────────────────────┐     RTMP push      ┌──────────────────┐
│  BROADCASTER APP         │  ───────────────►  │  YOUTUBE LIVE     │
│  (iOS + Android)         │   (baked-in         │  (ingest,         │
│  - camera capture        │    overlay)         │   transcode,      │
│  - overlay compositing   │                     │   deliver, record)│
│  - score control panel   │                     └────────┬─────────┘
│  - encode + RTMP push    │                              │ embed / API
└───────────┬─────────────┘                              │
            │ reads stream key,                           │
            │ fixture data                                ▼
            ▼                              ┌──────────────────────────┐
┌─────────────────────────┐               │  PUBLIC WEB PLATFORM      │
│  BACKEND / API           │ ◄──────────► │  - match schedule          │
│  - YouTube Live API      │   provisions │  - gated live viewing      │
│  - fixtures / scheduling │   broadcasts │  - embedded player + web   │
│  - sponsors              │              │    sponsor slots            │
│  - crew accounts / auth  │              │  - replays                 │
│  - notify subscriptions  │              │  - parent accounts          │
└─────────────────────────┘               └──────────────────────────┘
```

**Data flow for one fixture:**
1. Admin creates a fixture in the backend (school, sport, teams, date/time, assigned crew, sponsors).
2. Backend calls the YouTube Live API to create a scheduled broadcast + stream, binds them, and stores the broadcast/video ID + RTMP stream key.
3. At match time, the assigned crew member opens the broadcaster app, which pulls the fixture + stream key from the backend.
4. Crew sets team names + sponsors (pre-populated from the fixture), starts streaming. The app composites the overlay onto the camera feed, encodes, and pushes to YouTube's RTMP ingest.
5. Score is controlled live in-app via an expandable side panel; the number is burned into the outgoing video.
6. Parents watch on the web platform (embedded player) or on YouTube. Web platform may render additional dynamic sponsor slots around the player.
7. Match ends; YouTube finalizes the recording. The same video ID becomes the on-demand replay, surfaced under "Completed" on the web platform.

---

## 4. Key Architectural Decisions (decide/confirm before build)

### 4.1 Overlay is baked into the video (DECIDED)
The score, team names, timer, and primary sponsor placements are composited onto the camera frames **on the phone, before encoding**. They are permanent — present live and on the replay, on the web platform and on YouTube. This is a deliberate choice favouring permanence and ownership over post-hoc editability.

**Consequence:** score-entry mistakes are permanent. Operator discipline required. Consider an "undo last" in the score panel to mitigate.

### 4.2 Score lives in-app; no scoring backend required for the burn-in (DECIDED)
Because scoring is controlled in the same app that does the compositing, the score is local app state drawn straight onto frames. No realtime database is needed for the *burned-in* score. (A realtime backend is only needed if a web-layer live scoreboard is ever added on top of the embed — out of scope for v1.)

### 4.3 YouTube channel strategy (DECIDE BEFORE BUILD)
Two options:
- **(A) Central channel** — all schools stream onto one channel the business owns. Simpler auth (one OAuth token), unified brand, all content in one basket. **Recommended for MVP.**
- **(B) Per-school channels** — each school authorizes its own channel. More setup friction and per-school token management, but content lives under the school's identity and ownership.

**Recommendation: Build (A) first.** Design the fixtures/broadcast layer so a `channel_id` could later be attached per school, keeping (B) open without a rewrite.

### 4.4 Viewing access model (DECIDE BEFORE BUILD — highest-stakes decision)
There is a real tension between "free YouTube delivery" and "closed/gated viewing", and it matters for POPIA and child safeguarding because minors are being streamed.

- **Unlisted YouTube + share-link:** easy for parents, but anyone with the link can watch, and links get forwarded. Weak control over children's footage.
- **Gated behind login on the web platform:** you control who sees it and it's more sellable to safeguarding-conscious schools — BUT if the underlying YouTube video is merely unlisted, a technical user could extract the raw YouTube URL and bypass the login.
- **True access control** requires the video itself to be private/restricted, which fights the simple "just embed a YouTube player" approach.

**Recommendation for v1:** Unlisted YouTube + login-gated web platform ("good enough" access control), with an explicit, documented understanding that it is not cryptographically closed. Present this honestly to schools. Revisit true-private embedding if a school's safeguarding requirements demand it. **This decision must be made consciously — do not default into fully-public videos.**

**Update (post-launch):** Reversed to fully-public YouTube videos, deliberately and consciously — the exact decision this section warned not to default into, made explicitly rather than by accident. Rationale: channel growth, sponsor visibility, and giving prospective schools real match coverage to see before signing up outweighed the narrower access-control benefit of "unlisted," especially once a separate, unrelated YouTube API limitation (the `embeddable` flag not reliably taking effect via `videos.update` — see `backend/supabase/functions/provision-fixture-broadcast/README.md`) forced the web player to link out to YouTube's own watch page instead of embedding anyway, at which point "unlisted" was only ever protecting against search discovery, not against a stranger with the link. Login-gating on the web platform itself is unchanged — only whether the underlying YouTube video is independently discoverable changed. Documented honestly on `/safety` and `/privacy` per this section's own instruction to "present this honestly to schools." One real consequence worth flagging: the existing takedown lever (`hidden_from_viewers`, spec 4.5) only ever stopped this platform from serving a video — with the video now public, that gap matters much more, since anyone can already be watching independent of this site. Raised with the school owner and deliberately left manual, not automated: a takedown request is rare enough, and serious enough, that it should trigger an internal "why was this asked for" review before the underlying YouTube video's own visibility changes — not silently flip on an API call. Making the YouTube video itself private is a manual YouTube Studio step for whoever handles that review, not something this software does on its own.

### 4.5 POPIA & child-safeguarding (MUST be resolved before public launch)
Streaming minors is the single biggest legal exposure. Required before going live with real schools:
- School-level consent framework and per-parent consent handling.
- A clear data-processing position and privacy policy.
- Access controls consistent with 4.4.
- A takedown / opt-out process for any child whose guardian objects.
*Out of scope for the software build itself, but the software must support consent flags per school/team and access gating. Engage someone with POPIA expertise before launch, not after.*

**Update (post-launch):** The four software-side items above were built —
the school-level consent-attestation gate (migration 0011), `/privacy` and
`/safety` as the data-processing position, access gating per 4.4, and the
takedown lever (`hidden_from_viewers`, migration 0012). Formal outside
POPIA legal review was consciously decided against before launch, reversing
this section's closing instruction — a deliberate business decision, not an
oversight. Rationale: responsibility for a child's consent to be filmed and
broadcast is placed on the school itself, via the enforced consent
attestation a school must complete before it can create its first fixture;
the school, not Open Door Live, is the one making the representation about
its own students. `/privacy` and `/safety` were rewritten to state this
position plainly rather than flag it as pending review.

---

## 5. Component A — Broadcaster App

### 5.1 Purpose
A native mobile app (iOS + Android) used by internal crew to capture, overlay, and stream a match to YouTube Live. This is the hardest engineering piece; everything else is standard.

### 5.2 Recommended tech
- **Cross-platform UI:** Flutter (single codebase for both platforms).
- **Streaming engine (iOS):** HaishinKit (Swift) — camera capture, overlay, H.264 encode, RTMP/RTMPS push.
- **Streaming engine (Android):** RootEncoder (formerly rtmp-rtsp-stream-client-java) — equivalent.
- Wrap the native streaming engines via platform channels; build the operator UI (setup screen, score panel, overlay rendering/positioning) in Flutter.
- **RTMP target:** YouTube Live ingest URL + stream key (provisioned by backend via YouTube Live API).
- **Connection resilience:** prefer SRT where supported for weak/cellular connections (recovers from packet loss without interrupting the stream); fall back to RTMP/RTMPS. School wifi is frequently poor — treat connection resilience as a first-class requirement and test on real networks.

### 5.3 Screens & flows

**5.3.1 Login**
- Crew-only authenticated login (accounts provisioned by admin; no public signup in v1).
- On login, app fetches the crew member's assigned upcoming fixtures.

**5.3.2 Fixture selection**
- List of fixtures assigned to this crew member (from backend).
- Selecting a fixture pulls: school, sport, home/away team names, scheduled time, sponsor set + positions, and the YouTube RTMP stream key/URL.

**5.3.3 Pre-match setup**
- Confirm/edit **home team name** and **away team name** (pre-filled from fixture).
- Confirm/select **sponsor(s)** and their **positions** (see 5.5).
- Choose overlay options (e.g., show/hide timer; sport-appropriate score increments — see 5.4).
- Preview the overlay composited over the live camera before going live.
- "Go Live" button → transitions the YouTube broadcast to live and begins RTMP push.

**5.3.4 Live view (operator screen)**
- Full-screen camera preview with the overlay composited on top exactly as it will appear on the stream (WYSIWYG).
- **Expandable/collapsible side score-control panel** (see 5.4). Collapsed by default so it doesn't block the operator's view; expandable on a score event.
- Timer control (start/pause/reset if manual; or auto-run from go-live).
- "End Stream" control → transitions the YouTube broadcast to complete.
- Connection/health indicator (bitrate, dropped-frame warning, thermal/battery warning).

### 5.4 Score control panel (the one live element)
- Collapsible side panel (hovering/expandable) over the live view.
- Controls: **+ / − for home**, **+ / − for away**, configurable increment presets per sport (default +1; e.g., rugby presets +5 try, +3 penalty/drop, +2 conversion — configurable, not hardcoded).
- **Undo last score change** (mitigates permanent burn-in of mistakes).
- **Swap sides** (home/away positions).
- **Reset score** (with confirmation).
- Score is local app state, drawn onto every composited frame in real time.

### 5.5 Overlay specification (baked-in graphic layer)
The overlay is the most visible differentiator. Target a clean, modern broadcast look (materially better than the competitor's blocky style). Elements:

1. **Scoreboard block** (default top-left): two rows, each with a **team-name holder** (space for a small team badge/crest + team name) and the **score integer**. Home row and away row visually distinct. Clean type, subtle transparency, not heavy black bars.
2. **Match timer** (default top-centre): running clock.
3. **Business/channel logo** (default top-right).
4. **Sponsor placement(s)** (see below): structured, positioned, per match.

**Sponsor placement system (structured — the improvement over the competitor):**
- Defined position slots: **lower-third bar** (bottom, full-width or partial), **bottom-left corner**, **bottom-right corner**.
- Tiering: e.g., a **headline sponsor** occupies the lower-third bar; **supporting sponsors** occupy corners.
- Sponsors and positions are set per fixture from a sponsor list managed in the backend.
- Sponsor assets = uploaded logos/images placed statically for the duration of the match (they don't change mid-stream, so no live plumbing needed).

**Overlay must be:**
- Reusable across every match (it's a template; only names/score/sponsors change per fixture).
- Sport-agnostic in layout (works for rugby, netball, cricket, choir/cultural events, etc.).
- Configurable position defaults, but sensible out-of-the-box.
- Legible over bright outdoor footage (grass, sky) — sufficient contrast/backing.

### 5.6 Device/field constraints (design for these)
- **Thermal:** phones streaming with live compositing + encoding for 60–90 min run hot. Test thermal throttling on target devices. Consider active cooling or device selection.
- **Battery:** a full match drains fast. Support external power / power-bank use.
- **Connectivity:** school wifi is often poor; mobile data varies. SRT resilience + adaptive bitrate. Test on real networks before relying on any venue.
- **One-operator ergonomics:** the operator films AND may manage score. UI must be usable one-handed / glanceable. (Score can optionally be delegated to a second person on a second device in a future version — not v1.)
- **Standardize on chosen devices:** since crew and gear are controlled, pick specific devices that perform well and standardize the fleet.

---

## 6. Component B — Backend / API

### 6.1 Purpose
Provisions YouTube broadcasts, manages fixtures/scheduling, sponsors, crew and parent accounts, and notify subscriptions. Serves data to both the broadcaster app and the web platform.

### 6.2 Recommended tech
- Backend: Node.js (NestJS/Express) or similar; or a BaaS like Supabase/Firebase for speed to MVP.
- Database: PostgreSQL (via Supabase) or Firestore.
- Auth: role-based (admin, crew, parent). Supabase Auth / Firebase Auth acceptable.
- Hosting: Vercel/Netlify (web) + managed backend; cheap free tiers cover the trial.

### 6.3 YouTube Live API integration (the automation core)
YouTube splits one live event into three objects that must be glued together:
- **liveBroadcast** — the event (title, description, scheduled start, privacy, → video ID / watch page). This is what you embed.
- **liveStream** — the ingest pipe (RTMP URL + stream key). Reusable across broadcasts.
- **bind** — explicitly connects a liveStream to a liveBroadcast.

**Lifecycle to automate per fixture:**
1. `liveBroadcasts.insert` — create broadcast with title, description, scheduled start time, privacy = **unlisted** (per 4.4). Returns broadcast ID + video ID.
2. `liveStreams.insert` — create/reuse stream. Returns RTMP ingest address + stream key. (A stream key is reusable — consider one persistent key per crew device, re-bound to a fresh broadcast each fixture.)
3. `liveBroadcasts.bind` — bind stream to broadcast.
4. Broadcaster app pushes RTMP → status `ready`.
5. `liveBroadcasts.transition` → `testing` → `live` (or use `enableAutoStart` / `enableAutoStop` so YouTube starts/stops automatically when the RTMP feed begins/ends — recommended, simplifies app logic).
6. Match ends → `transition` → `complete` (or auto-stop). Same video ID becomes the replay.

**Auth:** OAuth against a Google account owning a YouTube channel (per 4.3, one central channel for MVP).

**⚠️ Quota:** The YouTube Data/Live API runs on a daily quota; write operations (insert broadcast/stream, bind, transition) are relatively expensive. A handful of schools is fine; a busy Saturday of many concurrent fixtures at scale may exceed the default daily quota and require a quota increase request from Google. **Verify current per-call quota costs and the default daily limit in the official docs before building at scale** — these numbers change. Docs: https://developers.google.com/youtube/v3/live/getting-started

### 6.4 Core responsibilities
- Create/manage fixtures (scheduling).
- On fixture creation (or scheduled ahead), provision the YouTube broadcast + stream + bind; store IDs and stream key.
- Manage sponsors and per-fixture sponsor assignments + positions.
- Manage crew accounts and fixture assignments.
- Manage parent accounts and access (per 4.4 gating).
- Manage "Notify Me" subscriptions for upcoming fixtures (email/push at go-live time).
- Serve fixture lists (Upcoming / Live / Completed) and video IDs to the web platform.

---

## 7. Component C — Public Web Platform

### 7.1 Purpose
The parent-facing branded website: discover upcoming fixtures (scheduling), watch live (gated), watch replays, with the platform's own branding and additional web-layer sponsor slots around the embedded player.

### 7.2 Recommended tech
- Frontend: React/Next.js. Hosting: Vercel/Netlify.
- Embeds the YouTube player by video ID with a branded wrapper (configure the embed to minimize YouTube branding/related-video leakage).

### 7.3 Pages & features

**7.3.1 Match schedule / home ("Live Matches")**
- List of fixtures with: sport, date, time, teams, status (Live / Upcoming / Completed).
- Filters by sport.
- Tabs: **Upcoming** / **Completed** (and a Live section/indicator).
- Per-match **share** button.
- (Competitor reference: Image 1.)

**7.3.2 Match page**
- Match title, teams, scheduled time.
- If upcoming: "Live in X hours" countdown + **Notify Me** (captures email/push, ties to the scheduled broadcast).
- If live: embedded player (gated per 4.4) + web-layer sponsor slots around the player.
- If completed: embedded replay + result + sponsor slots.
- Tabs: Match Info / Previous Results / Teams.
- (Competitor reference: Image 3.)

**7.3.3 Viewing (live & replay)**
- Embedded YouTube player (video ID from backend).
- **Access gating** per 4.4 (login-gated in v1).
- Optional additional **web-layer sponsor slots** around the player — these CAN be dynamic/rotating/clickable/trackable (unlike the baked-in ones), enabling extra/tiered ad inventory on top of the in-video placements.

**7.3.4 Parent accounts**
- Login/registration (gated access per 4.4).
- Favourites (follow a school/team).
- Notify subscriptions.

**Update (post-launch):** Favourites shipped at school-level only — a parent
follows a whole school, not an individual team (`favourites.team_id` exists
in the schema but nothing writes to it yet). Notify subscriptions were never
built at all — the `notify_subscriptions` table exists, unused; no email or
push goes out today when a followed fixture is about to go live. Both were
deliberately deferred rather than dropped: school-level following covers the
common case, and shipping without notifications avoided a chunk of
send-time complexity (deliverability, unsubscribe, scheduling) before launch.
Explicitly flagged by the owner as a feature they want — **push notifications
specifically**, not just email — and asked to have this raised again the
next time this platform gets updated or a new feature gets built, rather
than waiting to be asked. Treat "team-level notify, push-first" as the
standing next-feature candidate until it's built or the owner says
otherwise.

**7.3.5 Marketing / about pages**
- Static informational pages (competitor reference: Image 2).

**7.3.6 Admin panel (internal)**
- Create/edit fixtures (triggers YouTube provisioning in backend) — this IS the scheduling feature.
- Manage sponsors and per-fixture assignments.
- Manage crew accounts and assignments.
- View fixture statuses.

---

## 8. Data Model (indicative)

```
School
  id, name, logo, contacts, consent_flags, (optional) youtube_channel_id

Team
  id, school_id, name, age_group, sport, crest/badge

Fixture
  id, sport, home_team_id, away_team_id, school_id (host),
  scheduled_start, status (scheduled|live|completed),
  assigned_crew_id,
  youtube_broadcast_id, youtube_video_id, youtube_stream_key,
  final_home_score, final_away_score

Sponsor
  id, name, logo_asset, default_position, tier, (optional) click_url

FixtureSponsor            (join: sponsors placed on a given fixture)
  fixture_id, sponsor_id, position (lower_third|bottom_left|bottom_right),
  tier, layer (baked_in | web_overlay)

CrewMember
  id, name, auth, assigned_fixtures[]

ParentUser
  id, auth, favourites[], notify_subscriptions[]

NotifySubscription
  id, parent_user_id (or email), fixture_id, channel (email|push)
```

---

## 9. Build Sequencing (de-risk cheapest first — IMPORTANT)

Do NOT build the custom broadcaster app first. It is the hardest, riskiest piece and must be validated last, after the service and the wrapper are proven.

**Stage 0 — No-code manual proof (days)**
- Use an off-the-shelf mobile RTMP app (PRISM Live Studio / Wirecast Go / Streamlabs / Larix) to stream to a manually-created YouTube Live broadcast.
- Bake in a static sponsor PNG + simple overlay via the app.
- Embed the video on a scratch web page.
- Test latency, audio (DJI mic), zoom, and school-wifi vs mobile-data reliability.
- Goal: prove the streaming spine with zero code.

**Stage 1 — One real school fixture (a weekend)**
- Same off-the-shelf tools, but a real match with real parents watching via a shared link.
- Learn the OPERATIONAL realities: battery, thermal, connectivity dropouts, wind/audio, one-operator ergonomics, framing fast sport on a phone.
- Goal: prove the service is deliverable in the field.

**Stage 2 — Thin MVP software (weeks)**
- Backend + admin page: create a fixture → auto-provision YouTube broadcast via API → store video ID + share-link. (This is the scheduling feature.)
- Public web platform: schedule list, gated viewing, embedded player + web sponsor slots, replays.
- STILL use an off-the-shelf phone app for streaming at this stage.
- Goal: prove scheduling + gated viewing + replays end-to-end across a handful of schools.

**Stage 3 — Custom broadcaster app (the hard build)**
- Build the Flutter + HaishinKit/RootEncoder app ONLY once Stages 0–2 are proven and the friction of the off-the-shelf app is real (need: crew login, auto fixture/stream-key assignment, designed baked-in overlay, live score panel, locked quality).
- Extensive on-device testing (thermal, battery, connection).
- Goal: the polished, proprietary, differentiated product.

**Rationale:** every stage fails cheaply. Building the hard broadcaster before validating field operations is the classic way these projects stall.

---

## 10. Cost Notes (indicative, verify current pricing)

- **YouTube Live delivery:** free (the core economic lever).
- **Off-the-shelf streaming app premium tiers:** modest per-device; unlock clean overlays / remove watermarks (Stages 0–2).
- **Backend (Supabase/Firebase):** free tier covers trial; low monthly as it scales.
- **Web hosting (Vercel/Netlify):** free tier to start.
- **Custom app development (Stage 3):** the main build investment; a well-scoped, single hard component plus straightforward UI.
- **Unit economics reminder:** this is a SERVICE business (labour-bound: crew time + travel per fixture), not a zero-marginal-cost SaaS. Each fixture's sponsor revenue must exceed its fully-loaded delivery cost. Validate sponsor sell-through before scaling.

---

## 11. Open Decisions Checklist (resolve before/early in build)

- [ ] **4.3** Central vs per-school YouTube channel (recommend central for MVP; keep per-school path open in schema).
- [ ] **4.4** Viewing access model (recommend unlisted + login-gated for v1; document the limitation honestly).
- [ ] **4.5** POPIA/consent framework and safeguarding process (engage expertise before public launch).
- [ ] **5.5** Final overlay visual design (lock via the interactive mockup before Stage 3).
- [ ] **6.3** Confirm current YouTube Live API quota costs + request increase if scaling to many concurrent fixtures.
- [ ] Device standardization (which specific phones the crew fleet uses).
- [ ] Sponsor pricing/tier structure (business side; drives the FixtureSponsor tiering).

---

## 12. Glossary

- **RTMP / RTMPS** — the streaming protocol the phone uses to push video to YouTube's ingest server. Open protocol; YouTube accepts any compliant encoder.
- **SRT** — a more resilient streaming protocol that recovers from packet loss without interrupting the stream; preferable on weak/cellular connections where supported.
- **Baked-in / burned-in overlay** — graphics composited into the video pixels before encoding, so they are permanent (live + replay, web + YouTube).
- **liveBroadcast / liveStream / bind** — the three YouTube Live API objects that together define one streamed event.
- **Ingest / transcode / delivery** — receiving the stream / converting it to adaptive bitrates / sending it to each viewer. All handled free by YouTube in this model.

---

*End of specification.*
