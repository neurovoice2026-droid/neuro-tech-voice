# Concepts A: pain / POV story (4 reels)

Label `concepts:A`. Written 2026-10-06 by the senior social-video creative director for the PAIN / POV angle. It is a planning draft only: no code, scripts, `public/` or `src/` were touched.
Inputs: `docs/ig/RESEARCH-product.md` (product truth, kit, pipeline), `docs/ig/RESEARCH-reels.md` (platform research), `docs/kb/SCRIPT.md` (film 2's house style), and the site source I re-checked for this angle (paths below). Paths are relative to the repo root (`lib/`, `components/`) or to `trailer/` (`src/`, `scripts/`).

---

## 0. The four at a glance

| # | Title | Length | Owner moment (the pain) | What the agent does (all on every plan) | Hook score* |
|---|---|---|---|---|---|
| **A1** | **9:47 PM** | 26.0 s · 13 bars | Closed for the night. The phone rings, voicemail answers, she calls someone else. | Picks up on the first ring, answers from the documents, takes a message. By morning it is in the Inbox with **Call back**. | 84 |
| **A2** | **Twelve minutes** | 24.0 s · 12 bars | Mid-colour, gloves in tint, timer running. The phone is across the room. | Answers the caller from the salon's own service list while the timer runs. The call ends as the timer hits 00:00. | 84 |
| **A3** | **Ninth time today** | 24.0 s · 12 bars | The same question, all day ("Do you have parking?"). | Write it once into the knowledge base. The tenth caller asks it differently ("Where do I leave the car?") and gets the answer. | 81 |
| **A4** | **2:13 AM** | 26.0 s · 13 bars | Owners sleep with the phone on the pillow because one call might be a flood. | Takes messages for the calls that can wait. Puts the leak straight through to the on-call person the owner listed, by the owner's own rule. | 84 |

\* `.claude/skills/ig-reel/hookscore.py` on Tessa's spoken hook line (0–100; ≥ 80 = STRONG). It is a text heuristic: it catches weak hooks, it does not predict views.

**Together they work as a landing page for a stranger who opens the grid.** A1 answers *what is it*. A3 answers *will it know my business*. A4 answers *can I trust it with the call that matters*. A2 answers *is it for me* and is the template for a per-trade series.
**Suggested order inside this set:** A1, A4, A3, A2. Link each reel to the next with Reels linking. Pin A1, A4 and A3.

---

## 1. Rules all four share

### 1.1 Truth traps (checked in the source for this angle; please carry them into the synthesis)

1. **One agent speaks one language. It does not switch to the caller's language.**
   - `lib/voice/prompt.ts:255`: "Always speak ${language}, even when the caller, the business instructions or tool results use another language."
   - `types/index.ts:572`: "Every org gets exactly one AI voice agent regardless of tier."
   - So the brief's "a caller in another language" moment cannot be shown as the agent answering each caller in their own language. RESEARCH-reels §8 angle 2 ("the agent answers in kind, the language flips every 1.5 s") would show something the product does not do if it is presented as one agent taking callers in several languages.
   - The true version: the owner sets the agent to one of 14 languages, and its documents can be in another ("Yes — the agent answers in the language it's set to speak", `lib/pages/knowledge-base.ts:470-473`).
   - `~/.claude/instagram/voice.md` says "in the caller's language". That line is wrong and should be fixed by whoever owns that file.
2. **No booking in any of my four.** "Booked" needs Pro plus a connected Google Calendar (beta). None of the four needs it, so no plan gate appears on screen.
   - The agent's moves here are `search_knowledge`, `take_message`, `notify_team` and `transfer_call`. `lib/pages/industries/schema.ts:80-104` (`TOOL_NEEDS`, `CAPABILITY_PLAN`) maps each to `null`: no plan needed.
   - A transfer needs a real phone line and a contact with live transfers on (`lib/voice/session-loader.ts:239`).
3. **The trial is never implied to answer customers.** Every CTA is "Five free minutes, no card", and every caption says a phone number is connected separately.
4. **No statistics.** Clock times, "ninth time today" and the "three calls tonight" are POV scenario details, framed by "POV:" in every caption. The sample business, agent and caller names are labelled as samples in the caption.
5. **No absolutes.** The reels never say "every call", "never misses" or "always". "Answered on the first ring" is said about one call.
6. **The agent always discloses.** The in-call speaker tag is `● AI AGENT`. In A1 the call record shows the real greeting's disclosure line: "This is Ava, an AI assistant." (`lib/voice/greetings.ts`).
7. **Moments I rejected for this angle, and why:**
   - **"Mid-surgery."** On a clinic line the agent stops booking and gets a person "the moment anyone says pain, swelling, bleeding or an injury" (`lib/pages/industries/clinics-dental.ts:51`). A surgery POV invites viewers to read it as handling clinical calls. A2's dental variant ("patient in the chair", an admin call) is the safe version.
   - **"Mid-delivery."** There is "no tracking feed, no courier integration" (`schema.ts:57-58`), so the natural caller question ("where's my parcel?") cannot be answered.
   - **"A caller in another language."** See trap 1. If the synthesis wants a language reel, it must show one business whose agent is set to that language, not a switching agent.

### 1.2 Format and timeline
- 1080×1920, a 30 fps timeline × 4 sub-frames = 120 fps master. 120 BPM: a bar is 2.0 s (60 f), a beat 0.5 s (15 f), a 16th 0.125 s.
- Rings land on bar lines or beat 3. The logo impact lands on a bar line, two bars before the end.

### 1.3 Voices (the client's rule: the woman's voice whenever there is text on screen)

| Role | Voice | Chain | Used in |
|---|---|---|---|
| Narrator | Tessa (Emotive) `6ccbfb76-…`, speed 1.05 | clean, dry, close (film 2's narrator path) | all four |
| In-call agent | Tessa | film 2's in-call path (presence + very short room) | all four |
| Caller | Dana `cc00e582-…` / Marian `26403c37-…` / Kyle `c961b81c-…` / Daniel `47c38ca4-…` | phone line | short lines only |
| "You" (the owner at the desk) | Leo `0834f3df-…` | full-band, close | A3 only (one line) |

- Narration is second person ("you"), always in Tessa's voice.
- Caller lines are voiced by caller voices and shown as slate captions under `● CALLER`, as in film 2. Text is never on screen without a voice.
- UI chrome (outcome pills, field labels, "Message taken") is product UI, not a line, as it was in film 2.

### 1.4 On-screen text
- On-screen text is the line's `say`, word-synced through the forked Captions, at most 7 words per screen, rising as a unit.
- Captions use the spoken form ("Nine forty-seven"). The clock lockups carry the numerals as UI.
- *Optional improvement for the Captions fork:* a `display` map (for example `{text: '9:47 pm.', words: [0, 2]}`), so a caption can show numerals over a span of spoken words. Numerals read faster on a phone.
- **Emphasis:** `**bold**` in the scripts below means a stressed word for Sonic and the key phrase that takes the accent ink on its onset.
- **One colour system for the series:** rose = ringing or missed (film 2's rush line light); sunday teal = answered (Ava's orb). Every reel turns rose into teal.

### 1.5 Layout (inside the Reels safe zones)
- Nothing above y 220.
- Narrator captions sit in y 1180–1440, either left-aligned at x 86 with maxWidth ≤ 820, or centred at cx 540 with width ≤ 820.
- Hook captions sit in y 780–1000, under the clock or object band (y 280–700).
- UI cards sit in x 86–906 (always clear of the right rail at x > 950 in y 900–1650) and y 560–1160.
- Nothing below y 1520.

### 1.6 The shared CTA and brand moment (identical in all four; built once, voiced once)

| What | Detail |
|---|---|
| CTA line (spoken, ≈ 3.4 s) | `cta`: "Five free minutes, no card. Comment **AGENT** for the link." (10 words) |
| Alternate take | `cta-bio`: "Five free minutes, no card. The link's in our bio." Use it if the comment-to-DM automation (ManyChat or another Meta-approved tool) is not live on posting day. |
| Brand line | `brand`: borrow film 2's `kb2-brand` "Neuro Tech Voice." (Tessa's falling, proud read: `{"id":"kb2-brand","borrow":"kb"}`). It satisfies check-mix's `MIX.name`. |
| CTA picture (`IgEndCard`, new) | The scene steps back (× .92, shade). "Five free minutes, no card." rises as a caption (y 760–840). A white comment field rises under it (x 160–920, y 940–1060). Inside it: an IG-local lucide `message-circle` icon, and **AGENT** types one letter per 16th on her word "AGENT". A send-arrow button presses (.97) on "link". |
| Brand picture | **Impact on the bar line.** The field leaves up through its mask. The **NEUROVOICE** wordmark surfaces centre-out (film 1 `cta/EndCard` Wordmark) over `kb/scenes/cta/LightGL` with the teal emitter first. `neurotechvoice.com` (EndCard `Url`, ≤ 820 px wide, y ≈ 1000) types on "Neuro | Tech | Voice". |
| What is not on the end card | No "Start free" button or note. Unspoken, they would break the client's rule, and the trial line is already spoken. |
| Loop | The last 0.5 s returns the frame to frame 0's picture, so the next play's first ring reads as continuous. The master still fades to < −60 dBFS on the last frame (check-mix contract). The ring at frame 0 is the seam. |

### 1.7 Posting, shared
- The comment keyword is **AGENT** on all four, with one automation per post so each reel's DM link carries its own UTM (`?utm_source=instagram&utm_medium=social&utm_campaign=reel_a1` … `a4`).
- Series cover mark: **"POV · your phone"** with a numbered tag 01–04 at top left inside the crop (x 86, y 280, label role, 28 px), on alternating night and day grounds.
- Captions below passed `.claude/skills/ig-caption/caption.py` (one ask, ≤ 125-character first line, no links, no em dashes, 4–5 hashtags). A3 has one deliberate WARN, noted under A3.

---

## A1 · "9:47 PM" (26.0 s · 13 bars · 780 f)

### 1. Premise, views, conversion
- **Premise:** you're closed, the phone rings at 9:47 pm, voicemail picks up, and she rings someone else. Rewind: the same call is answered on the first ring, her question is answered and her message is taken. By morning she is waiting for *your* call.
- **Why it gets views:**
  - The hook is a pattern interrupt: a ring at 0.0 s over a dark room and a big "21:47".
  - The retention device is an open loop with a rewind. Viewers stay to see the "same call" go the other way.
  - The payoff is a satisfying UI press (Call back).
  - It is the most universal small-business pain, so it is the most sendable one ("this is us every night").
  - The loop is the ring returning at 21:47.
- **How it converts:** the CTA comes at 78% of the runtime. Comment AGENT, the DM brings the link, and the viewer builds the agent and rings it (test calls are free). The morning Inbox card *is* the product demo.

### 2. The hook, frames 0–45 (0.0–1.5 s)
- **f0:**
  - Deep night ground: `MeshGround variant='deep'` on `INK_MESH`, floor near #14062b, low lift.
  - The clock lockup `21:47` at display size, centred at y 300–620. Its colon is the rose line light (rush rose), already mid-pulse with one hairline `RingPulse` leaving it.
  - The first ring chirp (`fx-trill`, G#4/B4) sounds at 0.0.
  - Fine grain is already moving, so frame 0 is a designed still. It is also the default cover.
- **f5–9:** the caption "Nine forty-seven." rises as a unit at y 820–900 (caption 68 px, paper ink on night).
- **f7:** Tessa's first word. **By f45 she has said "Nine forty-seven. You're…"** and "You're closed." rises on its onset.
- **Tessa's first words:** "Nine forty-seven. You're closed."

### 3. Script

| Beat | Time (s) | Line (voice · `say` · emphasis) | On-screen (one row per screen) |
|---|---|---|---|
| b1 Hook | 0.00–3.25 | **Tessa** `a1-vo-1` @0.25: "Nine forty-seven. You're **closed**. Your phone's **still ringing**." (9 w) | "Nine forty-seven. You're closed." · "Your phone's still ringing." |
| b2 Voicemail | 3.25–6.00 | **Tessa** `a1-vo-2` @3.75: "Voicemail. So she rings **someone else**." (6 w) | "Voicemail." · "So she rings someone else." |
| b3 Rewind | 6.00–10.00 | **Tessa** `a1-vo-3` @7.0: "Same call." `<break 700ms/>` "Answered on the **first ring**." (6 w; the ring falls at 8.0, inside the break) | "Same call." · "Answered on the first ring." |
| b4 The call | 10.00–16.50 | **Dana** `a1-c1` @10.1: "Do you do Saturday mornings?" (5 w) · **Tessa, in-call** `a1-call-1` @12.0: "We **do**, from nine! I'll ask the team to call you back." (11 w) | `● CALLER` "Do you do Saturday mornings?" · `● AI AGENT` "We do, from nine!" · "I'll ask the team to call you back." |
| b5 Morning | 16.50–20.25 | **Tessa** `a1-vo-4` @16.75: "By **morning**, she's waiting on **your** call. Not someone else's." (10 w) | "By morning, she's waiting on your call." · "Not someone else's." |
| b6 CTA | 20.25–24.00 | **Tessa** `cta` @20.4 (shared) | "Five free minutes, no card." · "Comment AGENT for the link." |
| b7 Brand | 24.00–25.50 | **Tessa** `brand` @24.25 (borrowed) | NEUROVOICE · neurotechvoice.com |
| b8 Seam | 25.50–26.00 | — | the clock returns to 21:47 |

- **Totals:** 60 words, 2.3 w/s overall, at most 2.9 w/s inside a line.
- **Sonic directions:**
  - vo-1 calm, low, unhurried ("calm").
  - vo-2 flat on "Voicemail.", a small drop on "someone else" ("content" or "calm").
  - vo-3 a lift on "first ring" ("confident").
  - call-1 warm and brisk ("happy").
  - vo-4 warm, a smile on "your" ("content").

### 4. Visuals per beat
- **b1:**
  - The camera holds, with a 0.4% breathing push.
  - Rings at 0.0 and 2.0 (bar lines). Each sends a `RingPulse` and lifts the rose tint on the ground (.03 → .06, then relaxes).
  - No "CLOSED" sign or other unspoken text: the dark room is the "closed".
  - *Kit:* film 1 `scenes/hook/Clock` (`chainPos`/`Flick`) through a fork of `kb/scenes/repeat/Clock` (bound to `REPEAT_LOCAL`, so it must be forked); film 1 `hook/Rings`; `MeshGround`; forked Captions.
- **b2:**
  - 3.5: the ring stops on the voicemail beep. Under the clock a slate `LineWave` draws (fork of `kb/scenes/repeat/LineWave`) and flatlines.
  - 4.25: the hang-up. The **`Missed`** outcome pill (rose, the dashboard's own `OUTCOME_META` label) lands under the clock with `21:47`.
  - On "someone else" the rose colon dot detaches and slides out of frame right on `EASE.in3`, leaving the colon empty. The call leaves; there are no people, no phone, no logos.
  - *New:* `OutcomePill` (label + dot in the app's outcome colours: Missed rose, Answered blue, Message taken indigo, Transferred violet).
- **b3:**
  - **The rewind** is cheap because every part is a pure function of `t`. For 0.75 s the scene plays b2 backwards at ×3 (`t' = t_b2_end − 3·(t − 6.0)`): the dot slides back in, the pill un-lands, the clock flicks back to 21:47.
  - A one-frame pearl exposure lift marks the turn (a light change, not a flash or a glow).
  - 8.0: the ring. **On the pickup (8.25) the rose dot springs open into the teal orb.** This is film 2's birth: the 3-frame seed, `SPRING.pop` 0 → 1.06 → 1, one hairline ring, and the palette `mixPalette` rush → sunday over 6 frames.
  - The orb moves to y 360, Ø 240. The ground's key moves onto it (sunday tint .06).
  - *Kit:* film 1 `components/Orb`; a fork of `kb/scenes/turn/Orb` for the birth.
- **b4:**
  - The call strip (fork of `kb/scenes/call/Strip` + TurnLabel with an ink prop): `● CALLER` slate at y 600, caption at y 640–760, waveform y 800.
  - On the agent's first word the tag rolls to `● AI AGENT` (teal). The orb speaks (`.44 + .38·env`).
  - On "from nine" a white `DocPage` slides up at y 860–1160 (kind `Text`, heading `Opening hours`, lines `Monday to Friday · 8:00–20:00` / `Saturday · 9:00–14:00` / `Sunday · closed`: film 2's sample page, for continuity). An `InkSweep` (teal, 12%) runs under the Saturday line. The chip `Looked it up in your documents` (the dashboard's `TOOL_LABELS.search_knowledge`) rises beside the page heading.
  - On "call you back" the page steps back.
  - 16.0 (bar 8): the strip folds into a `RecordRow`:
    - `TRANSCRIPT`
    - dim row `00:00 Ava: … This is Ava, an AI assistant.`
    - outcome `Message taken`
    - the teal check disc
- **b5:**
  - 16.5: night → morning in one bar. `MeshGround` crossfades `INK_MESH` deep → `MUTED_MESH` pearl (`paletteB` + `mix`), and the orb shrinks to a small teal `MeshOrb` dot that becomes the clock's colon.
  - The clock flicks 21:48 → 08:58 (minutes and hours roll, `Flick`).
  - 16.75: the **Inbox message card** lands (x 86–906, y 620–1000, `SPRING.land`, mesh-tinted elevation):
    - unread dot + **Maya**, time `21:48` at right
    - body: "Asked about Saturday mornings. Please call back to book."
    - buttons `Call back +44 7700 900418` (primary violet) and `Mark as read` (outline)
    - Ofcom reserves 07700 900xxx for drama, so the number cannot ring anyone.
  - The kit `Cursor` enters from bottom right on an eased arc, arrives `pressLead` early, and **presses `Call back` on "your"** (≈ 18.4; .97, release spring).
  - *New:* `InboxCard`, a copy of `components/inbox/MessagesPanel.tsx`'s card markup in kit `Panel` + `Button`. The strings are verbatim: `Call back`, `Mark as read`, `Done`, `Urgent`.
- **b6–b8:** the shared end card (§1.6). At 25.5 the pearl ground darkens back to the night and the 21:47 lockup rises into its frame-0 place.

### 5. Sound
- **Bed** (120 BPM, E major, a fork of film 2's instruments in `scripts/ig/bed.mjs`):
  - 0–3.5: muted felt-piano B–E eighths under a night pad (`night` room), very sparse.
  - **3.5: hard stop on the voicemail beep.** Line hiss only: the dead air *is* the beat.
  - 6.0–6.75: the rewind. The previous 0.75 s of the mix plays reversed, plus `whoosh-rev`.
  - 7.0: one held E pad.
  - 10.0: chords E – C#m7 – Amaj7 – B, felt piano, soft kick on 1 and 3, ducked −8 dB under the call.
  - 16.5: a high piano line and shaker for the morning.
  - 20.25: strings swell, with a snare roll in the last half bar into the impact.
  - 24.0: impact on E. The E chord rings into an exponential fade.
- **Cues (HITS):**

  | Time (s) | Cue |
  |---|---|
  | 0.0, 2.0 | ring (`fx-trill`) |
  | 3.5 | voicemail beep (**new** `fx-beep`: a sine at B5 so it sits in E major, 0.45 s, soft attack) |
  | 4.25 | hang-up click (`fx-pickup` reversed) |
  | 4.3 | `Missed` pill land (`tick`) |
  | ≈ 5.3 | dot slide-out (`whoosh-soft`, panned right ±0.15) |
  | 6.0 | rewind (`whoosh-rev`) |
  | 8.0 / 8.25 | ring / pickup |
  | 8.25 | orb birth (seed tone + `ting`) |
  | ≈ 12.6 | the sweep on "nine" (`fx-felttip`) |
  | 16.0 | record row (paper click + check tick) |
  | 16.5–16.9 | clock flicks (`tick` on 16ths) |
  | 16.75 | Inbox card land (pitched `tock`) |
  | ≈ 18.4 | the press (`click-down` / `click-up`), then two quiet ringback burrs (**new** `fx-ringback`): she is being called back |
  | 20.25 on | the shared CTA cues (§1.6): AGENT keys on 16ths, send click |
  | 24.0 | `impact` + wordmark `shimmer` + URL keys on her words |

### 6. End card, CTA, loop
The shared CTA and brand moment (§1.6), CTA at 20.4 s (78%). The loop: the pearl darkens to night and the clock settles at 21:47 by f779. Frame 0's ring is the next play's first sound.

### 7. Posting copy
- **Cover** (frame 0 or a custom upload, inside x 86–930, y 260–1500): `9:47 pm.` (display, ≈ 200 px) over `Your phone's still ringing.` (headline 92), series tag `01 · POV · your phone`.
- **Caption:**
  ```
  Comment AGENT for the link. An AI receptionist for the missed calls that come in after 6 pm.

  POV: it's 9:47 pm, the shop is dark, and the phone rings. Voicemail used to be the end of that call.

  Your AI phone agent picks up on the first ring, tells the caller it's an AI, answers from the hours and price lists you gave it, and takes a message for the morning.

  Five free minutes for 14 days, no card needed. Test calls are free, so you can ring your own agent tonight.

  Sample business and sample agent. To answer real callers, you connect a phone number in the dashboard.

  #AIReceptionist #MissedCalls #AfterHours #SmallBusinessOwner
  ```
- **Keyword:** AGENT. **Trial-reel hook B (for later A/B):** "You closed at six. Your phone didn't." (hookscore 81)

### 8. Production
- **Estimate: medium–heavy.**
  - New: `InboxCard`, `OutcomePill`, the rewind mapping, `fx-beep`, `fx-ringback`, the night → morning crossfade.
  - Everything else is kit, film 1 or forked film 2 parts.
- **Risks:**
  1. Dark `INK_MESH` gradients band at ≈ 8 Mb/s. Keep dither and use a lighter, static grain on the IG finish; check after encode.
  2. The call is compressed. A real `take_message` reads back the name and number first. The card's "Maya" and number imply it; if a judge wants it shown, add a 1 s "Can I take your name?" exchange and go to 28 s (14 bars).
  3. "So she rings someone else" is a scenario. Keep it about *her*, never "most callers".

---

## A2 · "Twelve minutes" (24.0 s · 12 bars · 720 f) · salon, the template for a trade series

### 1. Premise, views, conversion
- **Premise:** the site's own salon kicker, "Gloves on, tint on, timer running — and the phone is across the room" (`lib/pages/industries/salons-spas.ts:49`). Pick it up and the colour over-processes; leave it and she books somewhere else.
  - The agent answers the caller from the salon's own service list while the timer runs.
  - **The call ends on the same frame the timer hits 00:00.**
- **Why it gets views:**
  - A countdown is a built-in retention device: viewers wait for zero.
  - The ring-vs-timer tug is a visual dilemma every stylist feels.
  - The timer and call landing together is the satisfying, rewatchable payoff.
  - Sends among stylists ("literally us on Saturdays") and owners.
  - The trade-specific POV self-selects buyers.
- **How it converts:** it qualifies hard. Salon owners stay, comment AGENT, and test the agent with their own price list.
  - **Series:** swap four lines and the document for other trades (variants below) and link them as "POV · your phone: salons / dental / trades / restaurants".

### 2. The hook, frames 0–45
- **f0:**
  - Daytime pearl ground keyed rose: `MeshGround variant='light'` on `MUTED_MESH`, with a `MOMENT_LIGHTS.rush` tint pool top-left.
  - Centre (y 520–1000): a white **timer card**, Ø 440, with a circular progress arc (rose stroke, SVG) and big tabular `12:00` (Instrument Sans, tabular figures, 150 px), already rolling to `11:59` on f30.
  - **Far top-left (x 150, y 300): the small rose line light pulsing**, the phone "across the room", with one `RingPulse` hairline.
  - The ring at 0.0.
- **f5:** "Twelve minutes on the colour." rises at y 1180–1260.
- **f6:** Tessa's first word.
- **Tessa's first words:** "Twelve minutes on the colour."

### 3. Script

| Beat | Time (s) | Line | On-screen |
|---|---|---|---|
| b1 Hook | 0.00–3.50 | **Tessa** `a2-vo-1` @0.2: "Twelve minutes on the **colour**. You **can't touch** the phone." (10 w) | "Twelve minutes on the colour." · "You can't touch the phone." |
| b2 The pull | 3.50–8.00 | **Tessa** `a2-vo-2` @3.7: "Pick it up, her colour **over-processes**. Leave it, she books **somewhere else**." (12 w) | "Pick it up, her colour over-processes." · "Leave it, she books somewhere else." |
| b3 Pickup + call | 8.00–14.50 | **Marian** `a2-c1` @8.3: "Can I walk in for a trim?" (7 w) · **Tessa, in-call** `a2-call-1` @10.4: "You **can**! Walk-in trims, Tuesday to Saturday." (7 w) | `● CALLER` "Can I walk in for a trim?" · `● AI AGENT` "You can! Walk-in trims, Tuesday to Saturday." |
| b4 Payoff | 14.50–18.00 | **Tessa** `a2-vo-3` @15.1: "Timer's done. Caller's **sorted**. You never **looked up**." (8 w) | "Timer's done. Caller's sorted." · "You never looked up." |
| b5 CTA | 18.00–22.00 | `cta` @18.3 | (shared) |
| b6 Brand | 22.00–23.50 | `brand` @22.25 | NEUROVOICE · neurotechvoice.com |
| b7 Seam | 23.50–24.00 | — | timer resets to 12:00, the rose dot returns top-left |

- **Totals:** 57 words, 2.4 w/s.
- **Sonic directions:**
  - vo-1 calm and intimate.
  - vo-2 a wry, small rise on "over-processes".
  - call-1 bright ("happy").
  - vo-3 content, with a smile on "looked up".
- "Trim" is used instead of "fringe" or "bangs" so UK and US viewers read it the same way.

### 4. Visuals per beat
- **b1:** the timer ticks in real seconds. Rings at 0.0, then 2.0 (bar lines). The dot's `RingPulse` hairlines travel toward the card and die short of it.
- **b2:**
  - Rings at 4.0 and 6.0.
  - **"Pick it up":** the card is *tugged* toward the dot: a translate of 60 px plus a 2° rotation toward top-left, `SPRING.site`. On "over-processes" the arc overshoots past 12 o'clock in a darker rush ink, and the digits flash `+05:00` in rose for 8 frames, rising and leaving through a mask. Then the card snaps back.
  - **"Leave it":** the card holds still and the dot begins to slide out of the top-left corner on "somewhere else".
  - Exactly one text moves at a time.
- **b3:**
  - 8.0: **before the dot is gone, it springs open into the teal orb** (the same birth as A1, Ø 200 at x 220, y 340).
  - The timer card shrinks and glides to a corner chip (x 700–906, y 300–420, clear of the rail), its arc now teal, **and time-lapses** from 11:40 down toward 00:00 over the call.
  - Call strip captions at y 560–760 (`● CALLER` slate → `● AI AGENT` teal).
  - On "walk-in" a `DocPage` at y 820–1160: kind `PDF`, heading `Price list`, lines `Cut & finish` / `Trim · walk-in · Tue–Sat` / `Colour · consultation first`, with an `InkSweep` under the Trim line. There are no figures on the page, so no price can be misread as ours.
  - The chip `Looked it up in your documents`.
- **b4:**
  - 14.5: the strip folds.
  - **15.0 (beat 3): the timer chip reads `00:00`.** It springs back to centre at full size, the arc closes, and a teal `CheckMark` draws in the disc.
  - The `RecordRow` lands under it with outcome **`Answered`** (blue).
  - On "looked up" the orb dims to rest.
- **b5–b7:** the shared end card. At 23.5 the timer card rises back to centre reading `12:00`, rose, and the dot fades in top-left.
- **New:** `TimerCard` (tabular countdown + SVG arc + time-lapse mapping). `OutcomePill` and the orb birth are shared with A1.
- **Kit:** `DocPage`/`InkSweep`, `RecordRow`, `CheckMark`, `MeshGround`, film 1 `Orb`, forked Captions/Strip.

### 5. Sound
- **Bed:**
  - **The timer is the rhythm:** a dry `tick` on every 2nd beat (real seconds) from f0, over a low pulsing E pedal and felt-piano B–E dyads.
  - The rings (`fx-trill`) cut across on 0, 2, 4 and 6.
  - The tug: `whoosh-soft` + a sub thump on "Pick it up".
  - "over-processes": `tick` doubles to 16ths for 8 frames.
  - "somewhere else": the dot's `whoosh-soft` panned left.
  - **8.0: pickup click + teal `ting`.** The bed resolves to E – C#m7 – A – B, ducked under the call.
  - The time-lapse: the ticks accelerate into a `riser-short` under the call (very low).
  - **15.0: the payoff hit.** `mallet-e5` + `glass` ting on beat 3, the "Answered" pill `tock`.
  - Then the CTA build, impact at 22.0, fade.

### 6. End card, CTA, loop
The shared end card, CTA at 18.3 s (76%). The loop: the timer reads 12:00 and the rose dot pulses top-left. Frame 0 is the same picture plus the first ring.

### 7. Posting copy
- **Cover:** the timer card at `12:00` with `You can't touch the phone.` under it, tag `02 · POV · your phone`.
- **Caption:**
  ```
  Comment AGENT for the link. An AI receptionist for salons: the calls you miss with 12 minutes on the colour.

  POV: gloves covered in tint, the timer running, and the phone across the room.

  Your AI phone agent picks up and answers from your own service list: walk-ins, prices, opening hours, policies. Every call is written down with a transcript and a summary, so you can see what was asked once the timer's done.

  Five free minutes for 14 days, no card needed. Test calls are free, so you can ring your own agent before your next client.

  Sample salon and sample call.

  #SalonOwner #AIReceptionist #HairSalon #SalonBusiness
  ```
- **Keyword:** AGENT. **Trial-reel hook B:** "Gloves on. Tint on. And it's ringing." (the site's kicker, for a salon-insider A/B)
- **Trade variants** (same body and timing; swap b1 / b2 / c1 / call-1, the document and the cover):

  | Trade | Hook (b1) | Pull (b2) | Caller | Agent (from their document) | Source of the moment |
  |---|---|---|---|---|---|
  | Dental | "Patient in the chair. You can't touch the phone." | "Pick it up, she waits numb. Leave it, they ring elsewhere." | "Are you taking new patients?" | "We are! I'll ask the team to call you to book." (`take_message`) | `clinics-dental.ts:49` (an admin call only, never clinical) |
  | Trades | "Under a sink. You can't touch the phone." | "Pick it up, the job floods. Leave it, they ring the next plumber." | "Do you cover Clifton?" | "We do! I'll get the team to call you back about the job." | `home-services.ts:49` "Three calls come in while you're under somebody's sink." |
  | Restaurant | "Walking a six to table twelve. It rings." | — | "Do you have gluten-free options?" | "We do! They're marked on our menu." | `restaurants.ts:43` |

### 8. Production
- **Estimate: medium** (the `TimerCard` is the only real new part). Each trade variant adds about half a day: new voice lines, a document and a cover.
- **Risks:**
  1. Comments will ask "how does it know I'm busy?". The product has no ring-delay setting in the code, so do not claim one. Reply: "it answers the calls that reach its number; how they reach it is your phone setup."
  2. "Over-processes" is salon vocabulary. Owners get it; the general public may not (acceptable: it is the qualifier).
  3. The in-hours premise depends on how the salon's calls reach the agent. The reel shows only the answer, never a mechanism.

---

## A3 · "Ninth time today" (24.0 s · 12 bars · 720 f)

### 1. Premise, views, conversion
- **Premise:** the same question all day ("Do you have parking?"). You answer it again, the slips pile up, and you've become a recording.
  - Write it once into the knowledge base.
  - The tenth caller asks it with no shared word ("Where do I leave the car?") and the agent finds the answer by meaning.
- **Why it gets views:**
  - The relatable groan ("the parking question!") gets comments.
  - The slip stack visualises the day without a number on screen.
  - The "matched on meaning" hairline from *leave the car* to *Parking* is a small aha people rewatch.
  - Educational, so it gets **saves**.
  - The cheapest of the four to build: film 2's kit, compressed.
- **How it converts:** it answers the buyer's main doubt ("will it know my business?"), and the knowledge base is on every plan, the trial included (`knowledge-base.ts:495-497`). The DM can offer help setting up the first documents (voice.md's keyword promise).

### 2. The hook, frames 0–45
- **f0:**
  - Daytime `PaperRoom` / pearl `MUTED_MESH`. A desk pad (y 900–1300) holds a neat **stack of eight slips** (`SlipStack`, each the same line in title role).
  - The rose `LINE 1` light top centre.
  - The ring chirp at 0.0.
  - The **ninth slip** already hangs half-torn at the top of the pad.
- **f5:** "Ninth time today." rises at y 300–380 (headline 92).
- **f6:** Tessa.
- **f42:** Dana's caller line begins, its slate caption rising at y 480–560.
- **Tessa's first words:** "Ninth time today."

### 3. Script

| Beat | Time (s) | Line | On-screen |
|---|---|---|---|
| b1 Hook | 0.00–3.75 | **Tessa** `a3-vo-1` @0.2: "**Ninth** time today." (3 w) · **Dana** `a3-c1` @1.4: "Do you have parking?" (4 w) · **Leo** `a3-desk-1` @2.4: "Yes, free, behind the building." (5 w, weary, flat) | "Ninth time today." · `● CALLER` "Do you have parking?" · `● YOU` "Yes, free, behind the building." |
| b2 The day | 3.75–6.00 | **Tessa** `a3-vo-2` @3.9: "Same question. You're **still** answering it." (6 w) | "Same question." · "You're still answering it." |
| b3 Write it once | 6.00–10.75 | (6.0 hard stop; 1 beat of silence) **Tessa** `a3-vo-3` @6.5: "Write it **once**. Your hours, your prices, your **parking**." (9 w) | "Write it once." · "Your hours, your prices, your parking." |
| b4 The tenth call | 10.75–15.75 | ring @11.0 · **Kyle** `a3-c2` @11.4: "Where do I leave the car?" (6 w) · **Tessa, in-call** `a3-call-1` @13.3: "There's **free parking** behind the building." (6 w) | `● CALLER` "Where do I leave the car?" · `● AI AGENT` "There's free parking behind the building." |
| b5 The point | 15.75–18.25 | **Tessa** `a3-vo-4` @15.9: "It follows what they **mean**. Not the words." (8 w) | "It follows what they mean." · "Not the words." |
| b6 CTA | 18.25–22.00 | `cta` @18.4 | (shared) |
| b7 Brand | 22.00–23.50 | `brand` @22.25 | NEUROVOICE · neurotechvoice.com |
| b8 Seam | 23.50–24.00 | — | the pad, eight slips, the hanging ninth |

- **Totals:** 60 words, 2.5 w/s.
- vo-4 is the site's own idea ("It follows what the caller means, not the words they happen to use", `knowledge-base.ts:213`).
- **Sonic directions:**
  - vo-1 dry, deadpan.
  - vo-2 a small sigh in the read ("calm").
  - vo-3 decisive ("confident").
  - call-1 warm ("happy").
  - vo-4 "content".
- Leo's desk line is the "identical file" gag from film 2, delivered weary.

### 4. Visuals per beat
- **b1:**
  - The caller caption rises (slate, `● CALLER`). On the desk voice the `● YOU` reply rises (graphite).
  - On "building" the ninth slip tears off and lands on the stack: `SPRING.land`, a seeded 3 px offset and +0.4°, contact shadow thickening.
  - *Kit:* `SlipStack` (kit `paper.tsx`); `TurnLabel`/Captions forks; film 1 `ContactShadow`.
- **b2:**
  - The camera pulls back (`camMotion`, 1.0 → 0.86). The stack is now a tall column of the same slip reaching y 420: the day.
  - Behind it the clock (fork of `repeat/Clock`) rolls 09:14 → 16:52 on 8ths, in Flick windows.
- **b3:**
  - **6.0: everything stops on the bar** (one beat of stillness).
  - On "once" the column **collapses into one** (film 2's collapse: each slip slides under the one above on 16ths) and draws its edges into a `DocRow` `Getting here`, type `Text`.
  - The **`Add knowledge`** `Panel` slides in from the right along its own band (y 600–1100, x 86–906).
  - Rows land on their nouns:
    - "hours" → `Opening hours` · Text
    - "prices" → `Price list` · PDF
    - "parking" → the `Getting here` row slots in
  - Each row's `Pill` rolls `Reading…` → `Ready · 1 passage` / `Ready · 2 passages` (illustrative counts, as in film 2).
- **b4:**
  - 11.0: ring; 11.25: pickup. The `LINE 1` dot springs open into the teal orb (y 330, Ø 200).
  - The `Getting here` row rises into a `DocPage` (y 760–1140) with these lines:
    - `Parking · free, behind the building`
    - `Nearest stop · Mill Road`
    - `Step-free entrance at the side`
  - On "car" a hairline **`MeaningLink`** draws from *leave the car* to the Parking line, with the midpoint tag `MATCHED ON MEANING` (film 2's tag). The caller's sentence shares no word with the page.
  - The sweep runs on "free parking". The chip `Looked it up in your documents`.
  - **The desk pad (now small, bottom-left) gets no new slip.** Nobody tore one off.
- **b5:**
  - The caller's first phrasing ("Do you have parking?") returns in the one-at-a-time slot at y 480 and sends its own hairline to the same line. Two phrasings, one written answer.
  - The orb rests.
- **b6–b8:** the shared end card. The seam rebuilds the pad with eight slips and the hanging ninth.
- **New:** nothing beyond the shared IG pieces. This reel is film 2's kit compressed: `SlipStack`, `Panel`, `DocRow`, `Pill`, `DocPage`, `InkSweep`, `MeaningLink`, forks of `written/Slips` and `call/Meaning` geometry.

### 5. Sound
- **Bed:**
  - From f0: film 2's deadpan one-bar loop (muted felt piano B–E eighths + soft shaker), the *identical* bar repeating.
  - It doubles to 16ths with the filter opening under vo-2 as the column grows.
  - **6.0: hard stop on the sample** (every bus cut, film 2's Part I stop). Room tone only for one beat.
  - vo-3 in near-silence. Then the chords enter on the collapse (E – C#m7 – A – B).
- **Cues:**

  | Time (s) | Cue |
  |---|---|
  | 0.0 | ring |
  | ≈ 3.5 | slip tear + slap + desk thud (`fx-slip`) |
  | under b2 | clock flicks (`tick`) |
  | from ≈ 6.7 | the collapse: descending paper clicks on 16ths ending in a `settle` thud |
  | on the nouns | row lands as tuned `tock`s; the Ready mallets E4 · F#4 · G#4 |
  | 11.0 / 11.25 | ring / pickup + orb `ting` |
  | on "car" | the hairline: pen scratch + `pluck` B4 |
  | on "free parking" | the sweep: felt-tip, with the fourth Ready note B4 a 16th later (the phrase resolves) |
  | ≈ 16.5 | the second hairline: pluck E5 |
  | 18.25 on | shared CTA; impact at 22.0 on E; fade |

### 6. End card, CTA, loop
The shared end card, CTA at 18.4 s (77%). The loop: the eight-slip pad with the ninth slip hanging and the ring at frame 0. A replay reads as "and again", which is the joke.

### 7. Posting copy
- **Cover:** the slip stack with `Ninth time today.` (display 160) and tag `03 · POV · your phone`.
- **Caption:**
  ```
  Comment AGENT for the link. An AI receptionist that answers "do you have parking?" so you can stop.

  POV: ninth time today. Same question, same answer, same pen.

  Add your opening hours, price list, policies and FAQ to your AI phone agent's knowledge base once. It finds the answer by meaning, so "where do I leave the car?" still lands on your parking line. When the answer isn't written down, it says so, in words you choose.

  Five free minutes for 14 days, no card needed. The knowledge base is on every plan, the trial included.

  Sample business and sample calls.

  #AIReceptionist #SmallBusinessTips #CustomerService #SmallBusinessOwner
  ```
  The linter WARNs that the visible window has no number. That is deliberate: this is a Job A caption, and the reel carries the hook.
- **Keyword:** AGENT. **Trial-reel hook B:** "Do you have parking? Ninth time today." (open on the caller's voice instead of Tessa's; not scored, use only as an A/B).
- **Accuracy notes:**
  - "in words you choose" is the owner's fallback line (`knowledge-base.ts:362, 373`).
  - The file types (PDF, Word, Text) are `TabKnowledge.tsx` `TYPE_LABELS`.
  - There is no auto-sync and no learning. Do not imply either.

### 8. Production
- **Estimate: simple–medium** (≈ 1.5 days on top of the shared pieces).
- **Risks:**
  1. It is close to film 2's mechanism. The topic (parking, not Saturday hours), the hook and the 24 s compression keep it distinct. If film 2's 9:16 cut is also posted, space them at least a week apart.
  2. Leo is a male "you". The owner could be anyone. Keep his read neutral and tired, not characterful.
  3. One `● YOU` line is the only non-Tessa, non-caller voice in the series. If the judges want Tessa and callers only, the slip can land silently (film 2's b05 precedent), but the client's rule then argues for cutting the reply caption too.

---

## A4 · "2:13 AM" (26.0 s · 13 bars · 780 f)

### 1. Premise, views, conversion
- **Premise:** owners keep the phone on the pillow because one call in a hundred is a flood. Tonight three calls could wait; the agent took messages. At 2:13 water is coming through a customer's ceiling, and the agent puts the caller **straight through to Dan, who's on call**, because the owner wrote that rule. Everything else waits for morning.
- **Why it gets views:**
  - A high-stakes hook: a night ring plus a distressed line.
  - It answers the #1 objection to an AI receptionist ("what if it's an emergency?") with the product's real mechanism.
  - It is emotional ("sleep") and sendable to every trades and property owner.
  - The contrast of three parked messages against one live transfer is the retention device: "which one is it?".
- **How it converts:** trust converts paying customers. Transfers are where a free tester becomes a paying customer, because a phone number is needed. The CTA brings them in to set up their own team list.

### 2. The hook, frames 0–45
- **f0:**
  - The darkest ground of the series: `MeshGround variant='deep'` on `INK_MESH` with `MOMENT_LIGHTS.night` (lilac) at very low lift; a near-black floor, colour only around the light.
  - The clock lockup `02:13` (display) at y 300–620; its colon the rose line light, mid-ring.
  - The ring at 0.0, in the `night` room.
- **f6:** "Two thirteen a.m." rises at y 820–900.
- **f7:** Tessa.
- **By f45:** "Two thirteen a.m. The only…".
- **Tessa's first words:** "Two thirteen a.m."

### 3. Script

| Beat | Time (s) | Line | On-screen |
|---|---|---|---|
| b1 Hook | 0.00–3.50 | **Tessa** `a4-vo-1` @0.25: "Two thirteen a.m. The **only** call worth **waking you** for." (10 w) | "Two thirteen a.m." · "The only call worth waking you for." |
| b2 The call | 3.50–5.75 | **Daniel** `a4-c1` @3.6: "Water's coming through my **ceiling**!" (5 w) | `● CALLER` "Water's coming through my ceiling!" |
| b3 The night so far | 5.75–9.50 | **Tessa** `a4-vo-2` @5.9: "Three calls tonight could wait for **morning**. This one **can't**." (10 w) | "Three calls tonight could wait for morning." · "This one can't." |
| b4 The transfer | 9.50–16.00 | **Tessa, in-call** `a4-call-1` @9.6: "I'm putting you through to **Dan**, who's on call tonight." (10 w) · ringback 12.9–14.1 · connect 14.25 · **Tessa** `a4-vo-3` @14.4: "Because you wrote the **rule**." (5 w) | `● AI AGENT` "I'm putting you through to Dan," · "who's on call tonight." · "Because you wrote the rule." |
| b5 Morning | 16.00–20.25 | **Tessa** `a4-vo-4` @16.4: "Sleep through the ones that can **wait**." (7 w) | "Sleep through the ones that can wait." |
| b6 CTA | 20.25–24.00 | `cta` @20.4 | (shared) |
| b7 Brand | 24.00–25.50 | `brand` @24.25 | NEUROVOICE · neurotechvoice.com |
| b8 Seam | 25.50–26.00 | — | night returns, 02:13 |

- **Totals:** 57 words, 2.2 w/s. This is the calmest pace of the set, on purpose: it is night.
- **Sonic directions:**
  - vo-1 low and close ("calm").
  - c1: worried and quick. Sonic has no "anxious" emotion; try "enthusiastic" at speed 1.15, and fall back to "calm" read fast. Judge by ear (see risks).
  - call-1 steady and reassuring ("sympathetic" if accepted, else "calm").
  - vo-3 "confident".
  - vo-4 soft, warm ("content").
- **Truth:** "I'm putting you through to Dan" matches the product exactly. It names the person before it dials (`lib/site.ts:1895`, `definitions.ts` `transfer_call`).

### 4. Visuals per beat
- **b1:** the clock and colon. The ring's rose `RingPulse` hairlines reach far across the dark.
- **b2:**
  - 3.25: pickup. The colon dot springs open into the teal orb (shared birth). It listens (`listen` palette).
  - The caller caption at y 600–700 in slate. A slate `LineWave` with an agitated envelope (the take's real one).
- **b3:**
  - On "Three calls tonight" the clock **flicks back** through `23:12` → `00:48` → `01:40` (Flick windows, on 8ths).
  - At each stop a compact white Inbox row stacks at y 1160–1420 (x 86–906): time + **`Message taken`** pill (indigo) + unread dot. **No body text** (unspoken). On "morning" the three dim to 50%: parked.
  - On "This one can't" the clock snaps forward to `02:13` and the orb brightens.
- **b4:**
  - The **owner's rule card** rises (x 86–906, y 620–1100). It is a new `TeamContactCard` with the labels verbatim from `components/skills/ContactDialog.tsx`:
    - name **Dan**, role `On-call technician`
    - ☑ `Put live calls through to this person`
    - ☑ `On call: the first person to reach when something is urgent`
    - the field `When should your agent involve them?` reading `Leaks, floods, no heating.` (kit `FieldCard`, already filled)
  - On "Dan" the teal `InkSweep` runs under the name. On "on call" it runs under the On call row.
  - 12.9: the orb pulses with an *outgoing* ring: two slate hairline rings travelling outward, the opposite direction to the incoming ring.
  - 14.25: connect. The orb steps back to rest; the agent has left the call, as the real blind transfer does.
  - A `RecordRow` lands at y 1160: outcome **`Transferred`** (violet) with the tool label `Transferred the call`.
  - "Because you wrote the rule": the field's text takes the sweep.
- **b5:**
  - 16.0: night → dawn in one bar. `INK_MESH` → `MUTED_MESH` pearl with a faint `MOMENT_LIGHTS.closing` (emerald) pool low-right.
  - The clock rolls 02:14 → 07:30.
  - The three message rows come forward to full ink as Inbox cards (`InboxCard`: `Call back` / `Mark as read`). The cursor clicks **`Mark as read`** on the first one at ≈ 18.6, a small domestic gesture rather than A1's call-back.
  - The `Transferred` row sits above them.
- **b6–b8:** the shared end card. At 25.5 the pearl darkens back to night and `02:13` settles.
- **New:** `TeamContactCard` (label rows + checkboxes, a small new `Checkbox` with a drawn tick), the outgoing-ring orb state. Shared with A1: `InboxCard`, `OutcomePill`, the crossfade.

### 5. Sound
- **Bed:** no beat until dawn.
  - A low sustained E add9 pad in the `night` room, and a sub pulse under each ring.
  - The caller on the phone chain, centre-right.
  - On the flick-back, three reversed `tick`s and three muted paper `tock`s descending E – C#4 – B3 as the message rows land; the snap forward is a `whoosh-soft`.
  - The pad lifts a step on "can't".
  - On "Dan" the felt-tip sweep plus a `glass` tick on each checked box.
  - **12.9–14.1: the outgoing ringback** (**new** `fx-ringback`: two soft burrs, synthetic and in tune, not a carrier tone).
  - 14.25: connect click and an orb "exhale" tone.
  - **16.0: dawn.** The bed finally gets its pulse: felt piano, soft kick on 1 and 3, strings swell. Inbox card `tock`s; the cursor `click-down` / `click-up`.
  - 20.25 on: shared CTA; impact at 24.0; fade.

### 6. End card, CTA, loop
The shared end card, CTA at 20.4 s (78%). The loop: the night returns with `02:13` and a pulsing colon. Frame 0's ring follows.

### 7. Posting copy
- **Cover:** `2:13 a.m.` (display) over `The only call worth waking you for.` (headline), tag `04 · POV · your phone`.
- **Caption:**
  ```
  Comment AGENT for the link. An AI receptionist that puts the 2 am emergency through to you.

  POV: 2:13 am. Water is coming through a customer's ceiling. Three earlier calls tonight could wait until morning. This one can't.

  You list who can take a live call and write when, in your own words: leaks, floods, no heating. Your AI phone agent names the person, puts the caller through, and takes messages for everything else. If nobody picks up, the caller is told and the team gets the message.

  Five free minutes for 14 days, no card needed. Live transfers need a phone number connected.

  Sample business and sample names.

  #AIReceptionist #Plumber #HomeServices #OnCall #SmallBusinessOwner
  ```
- **Keyword:** AGENT. **Trial-reel hook B:** "Two thirteen a.m. Three calls could wait. This one can't." (hookscore 63)
- **Accuracy notes:**
  - It is a straight (blind) transfer: Dan "picks up cold and reads the transcript afterwards". If nobody answers inside 25 s, the caller is told and the message goes to the team (`lib/site.ts:1895-1902`). Neither the reel nor the caption claims a briefing.
  - The "on call" flag and the "When should your agent involve them?" conditions are real fields (`ContactDialog.tsx:185-196`; `session-loader.ts:189-192`).
  - A water leak is not a life-or-health emergency. For gas or injury, the agent's guardrail sends the caller to the emergency number instead (`prompt.ts:267`, `home-services.ts:170`). That is why the story uses water and never gas.

### 8. Production
- **Estimate: medium–heavy.** New: `TeamContactCard` + `Checkbox`, `fx-ringback`, the outgoing-ring orb state, and the darkest ground of the set.
- **Risks:**
  1. **The caller's urgency:** Sonic's emotion set has no "anxious" or "urgent". Generate 4–6 candidates and pick by ear. If none convinces, write the urgency into the words ("It's coming through the ceiling!") and keep the read fast.
  2. **Banding** on the near-black ground at the bit budget: dither on, grain static or light, checked after encode.
  3. **Comments:** "what if Dan doesn't pick up?". The pinned reply quotes the 25 s fallback.
  4. **Audience:** trades and property owners are less concentrated on IG than salons. The emotional premise still travels, and the caption keywords target them.

---

## 9. Shared build list (what these four need, beyond the kit)

| Piece | New or fork | Used by |
|---|---|---|
| `src/ig/components/Captions` (+ optional `display` numerals map) | fork of `kb/components/Captions` | all |
| Call strip + `TurnLabel` (`● CALLER` slate, `● AI AGENT` teal, `● YOU` graphite) + `LineWave` | fork of `kb/scenes/call/Strip`, `repeat/LineWave`, `repeat/CallerTurn` | all |
| Orb birth (rose line light → teal orb), listen/speak, outgoing-ring state | fork of `kb/scenes/turn/Orb` + film 1 `components/Orb` | all |
| Clock lockup with Flick windows (forward and back rolls) | fork of `kb/scenes/repeat/Clock` on film 1 `hook/Clock` | A1, A3, A4 |
| `OutcomePill` (Missed / Answered / Message taken / Transferred, from `call-display.tsx`) | new | A1, A2, A4 |
| `InboxCard` (from `MessagesPanel.tsx`: name, unread dot, time, body, `Call back` / `Mark as read`) | new | A1, A4 |
| `TimerCard` | new | A2 |
| `TeamContactCard` + `Checkbox` (from `ContactDialog.tsx`) | new | A4 |
| `IgEndCard` (CTA caption + comment field typing AGENT + wordmark + URL over `LightGL`) | new, from film 1 `EndCard` parts + `kb/scenes/cta/LightGL` | all |
| Night ↔ pearl ground crossfade | `MeshGround` `paletteB`/`mix` (kit) | A1, A4 |
| SFX extras: `fx-beep` (B5), `fx-ringback` | new, in the IG sounds driver | A1, A4 |
| Voice lines (a single `scripts/voice-lines-ig.json`): **27 new** (A1 6, A2 5, A3 8, A4 6, `cta`, `cta-bio`) + 1 borrow (`kb2-brand`) | — | — |

- **Effort:**
  - Shared pieces ≈ 2 days.
  - Then A3 ≈ 1.5, A2 ≈ 2, A1 ≈ 2.5, A4 ≈ 2.5 days each at the house bar (critic loops included).
  - Shorter takes give time back to breathing room between beats, never to longer holds.
- **The house rules each reel inherits:**
  - pure functions of `t`
  - mask reveals, no blur, no glow
  - one moving text at a time
  - typographic apostrophes (`typo()`)
  - sub-pixel glide on moving type
  - no people, no handset drawn: the ring is the rose light and its sound
- **Durations:** 26 / 24 / 24 / 26 s, all inside 20–30.
- **CTA position:** 76–78% of each runtime.
- **Pace:** Tessa's measured pace is 2.3–3.3 w/s and every line here sits under 3.0 w/s, so real takes will fit. If a take runs long, the slack is in the pre-CTA beats, never in the hook.
