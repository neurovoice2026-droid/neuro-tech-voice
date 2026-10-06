# IG reels · concepts B: PROOF / DEMO ("watch it work")

Label `concepts:B`. Draft for the synthesis, written 2026-10-06 at HEAD `743247a`. Planning only: this file is the only one I wrote.
Read first: `docs/ig/RESEARCH-product.md` (product truth, kit, pipeline) and `docs/ig/RESEARCH-reels.md` (platform). Every product line below is checked against the site code, and the source is cited where it matters.

**The angle.** Strangers don't believe "AI receptionist" claims. They believe what they see happen. Each reel is one uninterrupted demonstration on the real app's UI, rebuilt in the house style:
- a call answered and booked;
- the four-screen setup;
- the language setting;
- a knowledge base someone tries to trip up.

What keeps people watching is the UI itself: things the eye can follow, such as a cursor arc, a field typing, a pill rolling to "Ready", a transcript writing itself, cards landing on the beat. The voice says what the picture proves.

---

## 0. Ground rules shared by B1–B4

### 0.1 Three corrections to the brief (product truth)
1. **"The language switch mid-call" does not exist. Do not show it.**
   - The agent is told: "Always speak ${language}, even when the caller, the business instructions or tool results use another language." (`lib/voice/prompt.ts:255`)
   - A business has **exactly one agent** on every plan: "there's no product mechanism to create more than one" (`types/index.ts:570-573`, `lib/site.ts:1622-1629`).
   - **The true demo** is a setting: Agent → General → "Name and language" → Language, a list of 14 entries with flags (`components/agent/tabs/TabGeneral.tsx:163-218`). Change it, save, and the next call is in that language. The documents can stay in another language: "the agent answers in the language it's set to speak" (`lib/pages/knowledge-base.ts:470-473`). B3 is built on exactly this.
2. **"5-minute setup" → "Real time? Under ten minutes."** The site says "Ready in under ten minutes" (`lib/pages/ai-agents.ts:40`). The real onboarding has four screens: Company → Agent → Voice → Go live (`app/onboarding/_lib/onboarding-state.ts:19-24`). B2 says both and never shows a stopwatch.
3. **Free means test calls. A real line is a separate purchase. Booking is Pro.**
   - The trial answers only test calls in the browser: "Test calls don't use your plan minutes." (`components/voice/TestCallPanel.tsx:786`)
   - A number is bought separately (`lib/site.ts:1813`).
   - Booking needs **Pro and up plus a connected Google Calendar (beta)** (`lib/voice/tools/calendar.ts:27-29`).
   - So **B1 says the Pro gate aloud**, and no reel puts "free" next to booking.

### 0.2 New fact that makes the demos honest: Tessa is a voice an owner can pick
- On 2026-10-06 I ran a read-only `GET https://api.cartesia.ai/voices/6ccbfb76-1fc6-48f7-b71d-91ac6298247b` and printed only safe fields: `name: "Tessa"`, `language: "en"`, `access: "public"`, `is_owner: false`.
- The product's voice catalogue is Cartesia's public library, kept by `isPublicLibraryVoice` = not owner and access public (`app/api/voices/_lib/catalog.ts:19-60`, `filters.ts:140-143`).
- So an agent **can really be set to Tessa**. B2 can show "Selected: Tessa" in the voice step, and the in-call agent voice in B1, B2 and B4 is a real configuration, not a trick.
- **Builder check:** before building B2, confirm in the running app that Tessa appears under the English filter, which ranks native speakers first (`Step3Voice.tsx:57`).
- Tessa is still **not** "the voice you get". The defaults are Skylar and Daniel (`lib/voice/voice-map.ts`). The captions say "Voice in this video: Tessa, from the voice library."

### 0.3 Cast
- **Tessa (Emotive)** `6ccbfb76…`, speed 1.05, plays two parts:
  - the **narrator**: film 2's clean, dry narrator path, captions with no tag;
  - the **agent "Ava"**: film 2's in-call path, captions tagged `● AVA` in sunday teal.
  - Ava and Northside Studio are the site's own sample names. The site's credits call them "A made-up business and agent name" (`lib/pages/home/credits.ts:15-18`).
- **Callers** (B1, B3, B4) are short lines, ≤ 7 words, captioned in slate and voiced on the phone chain. They use the voices film 2 already pinned: Kyle `c961b81c…`, Dana `cc00e582…`, Marian `26403c37…`, Daniel `47c38ca4…`. B3 adds one Spanish caller (es-ES default Marcos `13ff5deb…`, from `lib/voice/voice-map.ts`).
  - *Why a second voice:* the client asked for "the woman's voice whenever there's text on screen, **like in the others**", and film 2's calls had caller voices.
  - *Tessa-only fallback*, if the synthesis rules out callers, is given per concept in §8.
- **Brand line:** borrow `kb2-brand` "Neuro Tech Voice." (1.51 s) on every end card. This meets check-mix's `MIX.name.voice` contract and keeps one sonic signature across the films and reels.

### 0.4 What counts as a "line" (the voice rule)
- **Lines are spoken.** Every caption, heading or call turn **is** the line's `say`, word-synced through the forked Captions: words lead the voice by 2 f, rise as a unit, and hold ≥ 1 beat after the last word. Emphasis words (marked **bold** below) take the sunday-teal glint on their onset.
- **App chrome is not a line.** Tab names, pills, field labels, tool rows, document lines and the SMS text are app chrome or objects, as in film 2. They stay small (≤ 44 px), so nothing heading-sized ever appears without her voice.
- Where the app's own text is the caption (B1's live transcript, B4's fallback field), the words light as she says them.

### 0.5 Layout template (1080×1920, Reels zones from both research files)

| Band | y | Content |
|---|---|---|
| Top UI | 0–220 | Mesh only. No text, no orb. |
| Label band | 240–340 | eyebrow labels (label role 28): clock, "SAMPLE CALL", step rail |
| Stage | 360–1180 | the app panel / call panel / doc page. **Any part below y 900 stays inside x 72–936** (the right action column is x 950–1080 at y 900–1650). |
| Caption band | 1200–1480 | Tessa's captions, caption role 64–68, ≤ 2 lines, ≤ 7 words. Either left-aligned at x 86 (max width 840), or centred at cx 508 (width ≤ 820). |
| Bottom UI | 1520–1920 | Mesh only (the IG caption, username and audio label sit here). |

- **Hook frames** put the first line higher (y 300–1000) in display 112 / headline 92, as the research says. The layout settles into the template on the first cut.
- **Cover** is a custom 1080×1920 PNG (not a video frame, so its words need no voice). Its words sit inside **x 86–930, y 260–1500**, which is the 3:4 grid crop (y 240–1680) intersected with the feed UI. Use 3–5 words at ≥ 120 px cap height (≈ 170 px Instrument Sans 600).

### 0.6 Sound family (one campaign)
- **Tempo and key:** 120 BPM, E major (film 1 and 2's key). Bars fall on even seconds; the impact is on a bar line. Each reel needs its own `scripts/ig/bed.mjs` voicing, copied from film 2's instruments (RESEARCH-product §2.5).
- **The desk trill** `fx-trill` (G#4/B4) is the series' sonic logo: every call in every reel starts with it.
- **Clicks:** `fx-click-down/up` for every press, keys from `fx-keys`, "Ready" from the `fx-mallet` pentatonic. All are read-only from `public/kb/sfx`.
- **Levels:** film 1's targets (dialogue −20 LUFS, master −15.5 LUFS / −1.5 dBTP). The delivery copy is normalised to about −14 LUFS for IG (RESEARCH-reels §2.5).
- **Ending:** the last frame fades below −60 dBFS (check-mix). The audio loop therefore restarts on frame 0's attack (a ring or a key).

### 0.7 End card and loop template (≈ 3.5 s)
1. **CTA line (spoken) on the product shot**, landing at 75–90 % of the runtime.
2. **Impact on a bar line.** Film 2's close is shortened: one LightGL emitter (her teal) blooms into the filled backlight; the NEUROVOICE wordmark surfaces (y 760–900, width ≤ 800); `kb2-brand` plays into the impact; `neurotechvoice.com` (Geist Mono 44, y 1000) types on "neuro | tech | voice". `StartFree` (y 1120) appears only where the reel's CTA is "Start free".
3. **Loop seam (last 0.25–0.6 s):** the wordmark leaves up through its masks and frame 0's composition is already re-forming, so the autoplay replay reads as one continuous move.

---

## B1 · "Watch it book" (a real-feeling call, answered and booked)
**24.0 s · 12 bars · 720 f (timeline) / 2880 f at 120 fps**

### 1. Premise, views, conversion
**One line:** an after-hours sample call to Northside Studio. The agent answers on the first ring, says it's an AI, checks the calendar, offers two times, books, and texts a confirmation. Then the whole call files itself into the dashboard.

**Why it gets views:**
- **Hook mechanism:** a phone ringing at 0.0 s (half the hook is sound; about 80 % watch with sound on) plus a promise, "Watch an AI book this call." This is the research's #7 "listen to this" demo pattern, the Duplex template.
- **Retention device:**
  - the live transcript writing itself word by word as each turn is spoken;
  - the "Call time" counter;
  - a tool row spinning to a check;
  - a slot strip lighting up;
  - three cards landing on the beat.

  Something changes every 0.6–1.2 s.
- **Shareability:** an owner forwards it to the person who answers their phones ("this is what I meant").

**How it converts:** this is the **paid** feature (Pro). The CTA is the comment keyword **BOOK**, which triggers an automated DM with `/register?utm_source=instagram&utm_medium=social&utm_campaign=reel_b1` plus one line ("Try the agent free; calendar booking is on Pro"). So the free trial is offered in the DM and the caption, never on screen next to booking.

### 2. Hook (frames 0–45)
- **Picture at f0 (a designed frame):**
  - Night ground: `MeshGround variant='deep'`, `MOMENT_LIGHTS.night` (ground + ink), keyLight on the orb, already drifting.
  - Ava's teal orb, Ø 240 at (540, 560), in its `listen` palette. A slate hairline RingPulse is **mid-flight** (it starts at f −4).
  - Label band: film 1's `ClockLockup` reads `TUE` `21:14`, with `CLOSED` (label 28, graphite) under it. Clock and label are y 250–340, centred.
  - Headline (display 112, ink-on-dark, centred, ≤ 780 px wide, y 760–1000): `Watch an AI / book this call.` It is already fully up at f0.
- **f3 (0.10 s):** Tessa begins. On "book" (≈ f22) the word takes the teal glint.
- **f30:** the second trill and a second RingPulse.
- **f40–45:** a white call panel's top edge starts rising from y 1920, so the eye is pulled down into the demo.
- **Sound:** `fx-trill` at f0 and f30 on the downbeats. Room tone only, no bed yet: the ring *is* the opener.
- **Tessa's first words:** "Watch an AI book this call."

### 3. VO script and on-screen text
Spoken words: Tessa 44 (narrator 22 + Ava 22), callers 9, brand 3 → **56 words over 24 s ≈ 2.3 w/s**. This is just under the 2.4–2.8 target on purpose: the ring, pickup and cascade beats are sound-led. Measured pace: Tessa ≈ 3.0 w/s inside lines.

| Beat | Time (s) | Voice | `say` (**emphasis**) | On screen (≤ 7 words/screen) |
|---|---|---|---|---|
| b1 Hook | 0.00–2.00 | Tessa · narrator | "Watch an AI **book** this call." | `Watch an AI / book this call.` (display 112, y 760–1000) |
| b2 The ask | 2.00–4.75 | Caller (Dana, phone) | "Can I book a massage Thursday evening?" | `● CALLER` row in the live transcript (title 56, slate) |
| b3 Checking | 4.75–6.50 | Tessa · Ava | "One moment, let me check." (**borrow `kb2-call-1`**, 1.62 s: the product's real filler, `lib/voice/greetings.ts:184`) | `● AVA` row; tool row `Checked your availability` spins → ✓ |
| b4 Offer | 6.50–8.70 | Tessa · Ava | "Thursday, I have **5:30** or **6:30**." | `● AVA` row; slot chips 17:30 and 18:30 light teal |
| b5 Pick | 8.70–9.80 | Caller (Dana) | "6:30, please." | `● CALLER` row; the 18:30 chip fills |
| b6 Confirm | 9.80–13.75 | Tessa · Ava | "You're **booked**. Thursday, 6:30. / A confirmation **text** is on its way." | two transcript screens; tool rows `Booked an appointment`, `Sent the caller a text message` |
| b7 Cascade | 13.75–16.75 | Tessa · narrator | "In the **calendar**. Texted. Written **down**." | three caption screens: `In the calendar.` · `Texted.` · `Written down.` (caption 68, y 1300–1460) |
| b8 The gate | 16.75–18.25 | Tessa · narrator | "Calendar booking comes with **Pro**." | `Calendar booking comes with Pro.` |
| b9 CTA | 18.25–20.00 | Tessa · narrator | "Comment **BOOK** for the link." | `Comment BOOK / for the link.` (headline 92, BOOK in teal) |
| b10 End | 20.00–23.40 | Tessa · brand | "Neuro Tech Voice." (**borrow `kb2-brand`**) at 20.25 | `NEUROVOICE` · `neurotechvoice.com` |
| b11 Seam | 23.40–24.00 | — | — | frame 0 re-forming |

**Line directions:**
- Hook: curious, a little conspiratorial ("watch this").
- Ava: warm, efficient, smiling. Her times are spoken "five-thirty or six-thirty".
- b7: three beats with `<break time="250ms"/>`, light and pleased.
- b8: plain and matter-of-fact. This is the honesty line, not a disclaimer voice.
- b9: confident, slightly lower. Record **an alternate take**, "Start with the link in our bio.", for the case where the DM automation isn't live on posting day.

**Why the greeting is not voiced:**
- It already happened (the timer opens at `00:05`). It is the dim first transcript row: `Ava: …This is Ava, an AI assistant.` (meta 30), as film 2 b11 did.
- This keeps the AI disclosure **on screen** without spending 5 s.

### 4. Visuals per beat (house style)
- **b1** is as in §2.
- **b2 (pickup at 2.00, bar 2):**
  - The handset click cuts the ring. The headline leaves up through its masks.
  - The orb glides on `EASE.inOut` to the label band, top-left (160, 300), Ø 132, and wakes to listen.
  - The **call panel** (white `Panel`, `meshElevation` with `INK_MESH` shadow ink, x 72–936, y 420–1090) finishes rising on `SPRING.site`. Its header row (y 450) holds `● SAMPLE CALL` (the site's own kicker, `REEL.kicker` in `lib/pages/ai-agents.ts:63`) and a mono `Call time 00:05` (Geist Mono 30, right edge x 900), which ticks in real time from now on.
  - The body is a **live transcript**, the TestCallPanel's "Live transcript" idiom. Rows append as each turn is spoken: tag (`TurnLabel` fork: slate `● CALLER` / teal `● AVA`) plus words in title 56, word-synced. Two turns are visible; older rows scroll up under a paper fade mask. The scroll is the satisfying motion.
  - A slim slate `Waveform` (fork) under the caller's row follows the take's envelope.
- **b3:**
  - An inline **tool row** (meta 30, a lucide loader icon turning) reads `Checked your availability`, the exact dashboard string (`components/calls/call-display.tsx:29-45` `TOOL_LABELS`). It resolves to a drawn `CheckMark` at 6.40.
  - Under the panel, the **slot strip** rises (white card x 86–930, y 1140–1330): label `THU 8 OCT` and five chips (150 px, 16 px gaps) `17:00 17:30 18:00 18:30 19:00`. Taken slots sit at 35 % ink with a hairline strike; free ones get a teal outline as the check lands.
  - The orb speaks: in-call volume formula, palette `MOMENT_LIGHTS.sunday`.
- **b4:** on "5:30" and "6:30" the two free chips pulse once each (scale 1 → 1.04 → 1, `SPRING.pop`).
- **b5:** on "6:30, please." the 18:30 chip fills teal and its label turns paper-white.
- **b6:**
  - On "booked", the chip **becomes an event block** (`Sports massage · 18:30–19:30`) by widening in place.
  - Tool rows `Booked an appointment` and (on "text") `Sent the caller a text message` tick in.
  - **13.75:** the call ends (`Call ended`). The panel's header row flips with `Swap` to the dashboard's outcome pill `Booked` (the app's emerald, `OUTCOME_META.booked`, the only emerald in the reel).
- **b7 (bar 8 at 14.0), the cascade:**
  - The transcript panel folds down to its header and steps back (scale .92, shade .06).
  - Three white cards land on 16ths, each on its word, stacked x 72–936 between y 420 and 1180, with `SPRING.land` and contact shadows thickening:
    1. On "calendar": an **event card**. A neutral day column, **not Google's UI and no logo**, with the block `Sports massage · Thu 8 Oct · 18:30`, a text label `Google Calendar` and a small `BETA` chip (the app's own beta badge, as on "Connect Google Calendar" in `Step5Launch.tsx:696`).
    2. On "Texted": an **SMS card** with the real template at meta 30: `Northside Studio: your appointment on Thursday, 8 October at 18:30 is confirmed. Service: Sports massage. To change or cancel it, just call us.` (`lib/sms/templates.ts:35`; check the date format against `bookingConfirmationSms` at build).
    3. On "Written down": the **record card** `Summary · Booked a sports massage for Thursday at 18:30. Confirmation sent by text.` plus a `TRANSCRIPT` row and `Appointment booked: Sports massage` (the `CallDetailSheet.tsx:486` title pattern).
- **b8:**
  - A `Pro` plan pill (label 28, violet `APP.primary` outline) clips onto the event card beside `BETA` on "Pro". This is the one moment the gate is visual as well as spoken.
  - A slow push on the stack (×1.00 → 1.04, container transform).
- **b9:** the stack drifts up and dims to 40 %. The headline CTA rises centred (y 900–1140, width ≤ 800); `BOOK` takes the teal glint word-synced. No Instagram UI is imitated.
- **b10 (impact 20.0, bar 11):**
  - The deep ground grades into film 2's violet close (`INK_MESH`, floor ≈ #20004b). The small orb flies to centre and blooms into the backlight (`cta/LightGL`, one emitter).
  - The wordmark surfaces letter by letter; the URL types on her words.
  - **No Start-free button** in B1, so "free" never sits next to booking.
- **b11:**
  - The wordmark leaves up. The room cools back to the night mesh.
  - The orb settles to (540, 560), Ø 240; the clock windows flick to `21:14`.
  - A RingPulse launches at f −4 of the loop, so the replay begins mid-pulse exactly as frame 0 shows it.

**Kit reused unchanged:**
- `MeshGround`, `Panel`/`meshElevation`, `Swap`, `CheckMark`, `Icon` (loader, check), `type.ui()`;
- film 1 `components/Orb`, `ClockLockup`/Flick (`scenes/hook/Clock`), `hook/Rings` (RingPulse);
- `cta/LightGL` + `lightShader`, `EndCard` (Wordmark, Url), `Grain`, `lib/motion`/`glide`.

**Forked (bound to timing/voice):** `Captions`, `TurnLabel`, `Waveform`, the orb wrapper.

**New:**
- `LiveTranscript` (rows append word-synced, masked scroll, inline `ToolRow` with spinner → check);
- `SlotStrip` (chips → event block);
- `CallRecord` cascade (outcome pill, `EventCard`, `SmsCard`, `SummaryCard`);
- the `Pro`/`BETA` chips.

### 5. Sound
- **Bed ("after hours"):** 120 BPM, E major coloured by C#m.
  - Room tone only for b1.
  - **At the pickup (2.0):** a muted one-bar felt-piano ostinato (B–E eighths, film 2's Part I idea) with a sub on 1.
  - **b3:** a brushed 16th shaker comes in under "let me check".
  - **b6 "booked":** the harmony lifts A → B.
  - **b7:** soft strings swell under the cascade.
  - **b8–b9:** thins to piano and pad.
  - **Impact at 20.0:** resolves on E. The chord rings into the exponential fade.
- **Cues (HITS):**
  - 0.00 / 1.00 `fx-trill`;
  - 2.00 `fx-pickup` (handset click) and line hiss in;
  - 4.85 a quiet `fx-tick` roll under the spinner, then 6.40 `fx-ting` on the check;
  - 6.9 and 7.6 `fx-pluck` G#5 / B5 on the two times;
  - 9.0 `fx-tock` as 18:30 fills;
  - 9.95 "booked": `fx-mallet-e5` with a tiny `pop` for the event block;
  - 11.7 "text": `fx-glass` ping;
  - 13.75 `fx-click-down/up` (hang-up) and the line hiss cut on the sample;
  - 14.1 / 14.9 / 15.7 three card lands (`fx-paper` slap tuned E4 / G#4 / B4);
  - 16.9 `fx-tag` on the Pro pill;
  - 18.6 `glint` on "BOOK";
  - 20.00 `impact` + `sub` (`MIX.impact`, ≥ dialogue max + 1 LU);
  - 20.6–21.5 URL keys on her syllables.

### 6. End card / CTA and loop
- **Spoken CTA:** "Comment BOOK for the link." (alternate: "Start with the link in our bio.")
- **On screen:** `Comment BOOK / for the link.`, then `NEUROVOICE` · `neurotechvoice.com`.
- **Loop:** the night room, orb and clock re-form. Replay opens on the RingPulse and the trill, so the reel reads as "the next call is already coming in".

### 7. Posting copy
- **Cover** (custom PNG): a b7 frame (the stack with the emerald `Booked` pill) under the cover title **`AI booked this call`**, 4 words at ≈ 170 px, y 300–700, x 86–930.
- **Caption** (no em dashes):
  > Watch an AI receptionist take an after-hours call and book it into the calendar, start to finish.
  >
  > It says it's an AI in its first sentence, checks the free times, offers two, books the one the caller picks, texts a confirmation and files the transcript with a summary.
  >
  > Calendar booking is on Pro and up, with Google Calendar connected (in beta). Text confirmations: Starter and up. Sample call, recreated. Northside Studio and Ava are made-up names; the voice is Tessa from the voice library.
  >
  > Comment BOOK and we'll DM you the link. Want to try the agent first? 5 free minutes for 14 days, no card needed. Link in bio.
  >
  > Google Calendar™ is a trademark of Google LLC. Neuro Tech Voice works with it and is not endorsed by Google.
- **Hashtags (5):** #AIReceptionist #VoiceAI #AppointmentBooking #SmallBusinessTips #AIAgents
- **Comment keyword:** `BOOK` → DM with `utm_campaign=reel_b1`.

### 8. Production estimate and risks
**Medium–heavy.** Four new UI parts (LiveTranscript, SlotStrip, the cascade cards, chips); everything else is kit.

**Voices:**
- 5 new Tessa takes: hook, Ava ×2, narrator ×3, plus the CTA alternate;
- 2 Dana takes;
- 2 borrows (`kb2-call-1`, `kb2-brand`).

**Risks:**
1. *Gated feature in a growth reel.* The gate is spoken (b8), shown (Pro/BETA chips) and captioned; the DM offers the trial. Judges must check that nothing implies the trial books.
2. *Google trademark.* Text only, no logo, no Google-styled calendar; the trademark line is in the caption.
3. *The call must not be cut inside.* The timer must stay truthful for this recreation: no jump cuts between 2.0 and 13.75.
4. *Two voices.* **Tessa-only fallback:** Ava restates the request ("Thursday evening? I have 5:30 or 6:30." / "6:30, lovely. You're booked…"). Caller turns become slate waveform rows with no words, over a faint phone-line murmur.
5. *Real date.* "Thursday 8 October" fits a post in the week of 6 Oct 2026. If it posts later, show the weekday only.

---

## B2 · "Four screens" (the setup speedrun on the real app)
**24.0 s · 12 bars · 720 f / 2880 f at 120 fps**

### 1. Premise, views, conversion
**One line:** a cursor builds Northside Studio's agent through the real onboarding (Company → Agent → Voice → Go live on the free trial). It adds a price list, rings the agent in the browser, and hears it answer with the business's name. Then it adds a number "when you're ready".

**Why it gets views:**
- **Hook mechanism:** process curiosity. A field is already typing at f0, with the promise "Let's build an AI receptionist. Four screens."
- **Retention device:**
  - a countdown the viewer can see: the step rail 1 → 4, one screen per bar, each with a spoken number;
  - then a payoff the viewer is waiting for: *what does it sound like?*

  The cursor work (arcs, presses, typing, a file drop, pills rolling to Ready) changes something every ≈ 0.5 s.
- **Shareability and saves:** it is a how-to, so people save it. It is also the one reel that answers "how hard is it?"

**How it converts:** this is the **trial path itself**, so it is the best direct converter. Spoken CTA: "Start free. No card needed." Comment keyword **BUILD** → DM with the `/register` link, plus "test calls don't use your minutes".

### 2. Hook (frames 0–45)
- **Picture at f0:**
  - Pearl mesh (`HOME_KB_MESH`, `variant='light'`).
  - The onboarding card (white `Panel`, x 72–936, y 380–1160, radius 28) shows:
    - its **step rail** (4 dots, labels `Company · Agent · Voice · Go live`, dot 1 violet `APP.primary`);
    - the UI title `Tell us about your company`;
    - the field `Company name` with the caret after `North`, already typing.
  - Caption (headline 92, left at x 86, y 1240–1460): `Let's build an / AI receptionist.` It is up at f0.
- **f0–30:** `Northside Studio` completes, one key per 32nd (`typedCount`, no rise, caret jumps). Keys tick in rhythm.
- **f3:** Tessa begins. The caption swaps to `Four screens.` at ≈ f44.
- **f32–45:** the cursor (kit `Cursor`, arrow) arcs to the industry chip `Gyms & studios` (the real `INDUSTRY_OPTIONS` label, `lib/agent-prompts.ts:338`). It is hovering at f45.
- **Sound:** `fx-keys` from f0; kick and shaker from f0 (the bed starts on frame 0: the drive *is* the hook).
- **Tessa's first words:** "Let's build an AI receptionist."

### 3. VO script and on-screen text
Spoken words: Tessa narrator 42, Ava 17 (borrowed), brand 3 → **62 words / 24 s ≈ 2.6 w/s**.

| Beat | Time (s) | Voice | `say` (**emphasis**) | On screen |
|---|---|---|---|---|
| b1 Hook | 0.00–2.00 | narrator | "Let's build an AI **receptionist**. Four screens." | `Let's build an / AI receptionist.` → `Four screens.` |
| b2 Screen 1 | 2.00–3.50 | narrator | "One. Your **business**." | `1 · Your business.` (the digit in teal) |
| b3 Screen 2 | 3.50–5.00 | narrator | "Two. Your **agent**." | `2 · Your agent.` |
| b4 Screen 3 | 5.00–6.50 | narrator | "Three. Its **voice**." | `3 · Its voice.` |
| b5 Screen 4 | 6.50–8.00 | narrator | "Four. Free **trial**." | `4 · Free trial.` |
| b6 Ready | 8.00–10.00 | narrator | "Real time? Under ten **minutes**." | `Real time? / Under ten minutes.` |
| b7 Knowledge | 10.00–11.50 | narrator | "Add your **price list**." | `Add your price list.` |
| b8 Call it | 11.50–12.40 | narrator | "Now call it." | `Now call it.` |
| b9 Test call | 12.40–18.20 | Tessa · Ava | "Thank you for calling **Northside Studio**. This is Ava, an AI assistant. How can I help you today?" (**borrow film 1 `call-1`**, 5.27 s; the app's exact neutral greeting, `lib/voice/greetings.ts:243-247`) | the live transcript row in the test-call card, title 52, word-synced; `Northside Studio` takes the teal glint |
| b10 Number | 18.20–19.80 | narrator | "Add a number when you're **ready**." | `Add a number / when you're ready.` |
| b11 CTA | 19.80–21.80 | narrator | "**Start free**. No card needed." | `Start free. / No card needed.` |
| b12 End | 22.00–23.40 | brand | "Neuro Tech Voice." (`kb2-brand`) | `NEUROVOICE` · `neurotechvoice.com` |
| b13 Seam | 23.40–24.00 | — | — | the empty company card returns |

**Line directions:**
- **Counting beats (b2–b5):** brisk, smiling, on the downbeats. Record them as one take with `<break time="…"/>` sized to the bar, so the four numbers sit in one performance.
- **b6:** a wink, then sincere. It is the honesty line that also sells.
- **b11:** warm and certain.
- **Alternate CTA take:** "Comment BUILD for the link."

### 4. Visuals per beat
- **General:**
  - The card stays put. Each screen's contents leave left and the next ones arrive from the right through the card's own mask: one `Swap`-style move per bar, on the downbeat, with `SPRING.site`.
  - The step rail's dot fills with a drawn `CheckMark` and the violet active marker slides to the next dot.
  - A slow container push (×1.00 → 1.03) per screen keeps the frame alive between clicks.
  - Every press: cursor arrives 6 f early, presses (.9) and springs back; the button presses (.97).
- **b2 Company:**
  - Click `Gyms & studios`; the chip fills violet.
  - `Time zone` auto-fills (UI).
  - The cursor presses `Continue` on 3.25. Rail 1 ✓.
- **b3 Agent:**
  - The title is `Set up your AI agent`. `Agent name` types `Ava` (its placeholder `e.g. Sarah, Alex, Max` vanishes on the first key).
  - The language trigger shows a US flag + `English`.
  - Tone grid (`Tone of voice`): click **`Professional`**. This tone produces the neutral greeting borrowed in b9.
  - The greeting preview line fades in at meta 30: `Thank you for calling Northside Studio. This is Ava, an AI assistant…`.
  - Continue on 4.75.
- **b4 Voice:**
  - The title is `Choose your agent's voice`. A 2×2 grid of voice cards (name + accent + a play glyph), English natives first; Tessa is one of them.
  - The cursor hovers Tessa's play glyph (a 0.4 s bar-meter animates, silently, so no voice collides with the narrator).
  - Clicks the card; it outlines violet. The footer reads `Selected: Tessa`.
  - Continue on 6.25.
- **b5 Go live:**
  - The title is `Go live`.
  - **Only the `Free Trial` card is in frame:** `Free Trial` / `Set everything up, no payment` (`Step5Launch.tsx:338-339`). The paid cards with prices sit outside the crop. **No price ever enters the frame** (RESEARCH-product §1.10).
  - Click it. `Your setup` rows fill on 16ths: `Company Northside Studio · Agent Ava · Language English · Voice Tessa · Plan Free Trial`.
  - `Create my agent` presses on 7.75.
- **b6 Ready:**
  - `Creating your agent…` with a turning loader (8.00–8.60).
  - An emerald disc draws its check and `Your agent is ready` rises (8.75).
  - The three checklist rows fade in muted: `Test your agent now` · `Get a phone number` · `Connect Google Calendar` with `BETA`.
- **b7 Knowledge:**
  - The card re-forms as the agent page. Kit `TabBar` slides in at its top (General · Conversation · Voice · **Knowledge** · Skills); the cursor clicks Knowledge on 10.25 (underline spring).
  - A `Price list.pdf` file tile flies in on an arc from the lower left (sub-pixel glide) into `Drop files here or choose them`.
  - A `DocRow` lands: `Price list` · `PDF`, `Pill` `Reading…` → `Ready · 3 passages` on 11.25. The count is illustrative, as in film 2.
- **b8:** the cursor arcs to `Test call in your browser` (a TestCallPanel facsimile button) and presses on 12.25.
- **b9 Test call:**
  - The card becomes the **test-call card**:
    - the status dot + `Connecting…` (12.4) → `Speaking…` (12.9);
    - mono `Call time 00:01…00:06`;
    - Ava's teal **orb**, Ø 240, at the card's top centre (y 560), speaking on her envelope;
    - the **Live transcript** box (y 760–1080) writing her greeting word-synced (title 52, ink), which **is** the caption;
    - an outline `Hang up` button;
    - the note `Test calls don't use your plan minutes.` (meta 28, `TestCallPanel.tsx:786`).
  - The ground deepens to a teal pool behind the orb (keyLight on the orb, `sunday` tint .07).
- **b10 Number:**
  - A phone-number card slides up over the test card (y 700–940): `+1 555 0142` in Geist Mono 64 (the site's fiction range, `credits.ts`), a `US` chip, a green dot and `Answered by Ava` (`PhoneNumberCard.tsx:75`).
  - No price on screen.
- **b11 CTA:**
  - Cards step back and dim. `cta/StartFree` rises centred at y 1030; the cursor arrives and presses on "free" (hover plum, press .97).
  - Caption: `Start free. / No card needed.`
- **b12 End:** as in §0.7, pearl → violet close, with StartFree held above the URL.
- **b13 Seam:**
  - The wordmark lifts. The onboarding card slides back in from the right, empty.
  - The rail resets to 1 and the caret blinks in `Company name`.
  - `N` types at 23.97, so the replay continues "…orth".

**Kit reused:**
- `MeshGround`, `Panel`, `Button` (primary/outline/site), `Cursor` + `click()`/`hoverAt`/`pressAt`;
- `FieldCard` (label, caret, typed words), `typedCount`/`typedOpacity`;
- `TabBar`, `DocRow`, `Pill`, `CheckMark`, `Swap`, `Icon`;
- film 1 `Orb`, `cta/StartFree`, `LightGL`, `EndCard`.

**Forked:** `Captions` and the orb wrapper.

**New (this is the heavy one):**
- `OnboardingCard` + `StepRail`;
- `IndustryChips`, `ToneGrid`, `VoiceCardGrid` (+ silent preview meter), `PlanCard`, `SetupSummary`;
- `TestCallCard` (status, timer, transcript box, Hang up);
- `PhoneNumberCard`;
- a file-tile flight.

### 5. Sound
- **Bed ("speedrun"):** 120 BPM, E major. A kick on every beat and a 16th shaker from f0. A felt-piano arpeggio climbs **one chord per screen** (E – F#m – A – B on bars 2–5). Each screen change lands a soft tom/`fx-settle` thump on the downbeat.
  - **8.0:** half a bar of inhale (filtered pad) under `Creating your agent…`.
  - **8.75:** resolves to E on "ready".
  - **b9:** the drums drop out and the pad holds under the greeting.
  - **18.2:** the arpeggio returns.
  - **22.0:** impact on E, then the fade.
- **Cues:**
  - `fx-keys` on every typed character (32nds for `Northside Studio`, 16ths for `Ava`);
  - `fx-click-down/up` on each of the ≈ 11 presses (from `clicksOf(keys)`);
  - a soft `swish` on each screen swap;
  - the step-rail checks ring `fx-mallet` E4, F#4, G#4, B4, and **`fx-mallet-e5` on "ready"** completes the phrase, as film 2's Ready phrase does;
  - file drop: `fx-paper` slap; `Reading…` tick roll; Ready `fx-ting`;
  - call connect: `fx-seed`, then the orb's soft `ting`;
  - number card: `chime-sunday-soft`;
  - StartFree press `click`; impact + `sub`; URL keys;
  - the seam's `N` key at 23.97 is part of the fade-out, so the replay's keys feel continuous.

### 6. End card / CTA and loop
- **Spoken:** "Start free. No card needed." (alternate: "Comment BUILD for the link.")
- **On screen:** `Start free. / No card needed.`, the `Start free` button, `NEUROVOICE`, `neurotechvoice.com`.
- **Loop:** back to the empty company card, which is already typing as frame 0 does.

### 7. Posting copy
- **Cover:** a b6 frame (rail 4/4 ✓, `Your agent is ready`) with **`AI receptionist in 4 screens`** (5 words, two lines, ≈ 150 px, y 300–700).
- **Caption:**
  > How to set up an AI receptionist: four screens, then a test call. Real time: under ten minutes.
  >
  > 1 Company. 2 Agent: name, language, tone. 3 Voice. 4 Start on the free trial. Then add your price list and ring it from your browser to hear it answer with your business name.
  >
  > Ready for real callers? Add a phone number in the dashboard (bought separately; numbers in 21 countries).
  >
  > Comment BUILD and we'll DM you the link, or use the link in bio. 5 free minutes for 14 days, no card needed. Test calls don't use your minutes.
  >
  > Northside Studio and Ava are made-up sample names; the voice is Tessa from the voice library.
- **Hashtags (5):** #AIReceptionist #VoiceAI #NoCode #SmallBusinessTips #AIAgents
- **Comment keyword:** `BUILD` → `utm_campaign=reel_b2`.

### 8. Production estimate and risks
**Heavy.** About ten new UI facsimiles and the busiest cursor choreography (≈ 11 presses, 3 typing runs, 1 drag). Voices: one narrator take set (b1–b8, b10–b11) plus the CTA alternate; borrows `call-1` and `kb2-brand`; **no callers**, so it is Tessa-only as is.

**Risks:**
1. *UI fidelity.* The facsimiles must match today's onboarding (strings are cited above). Take reference screenshots of the running app (the `run` skill) before drawing. If the app changes, the reel ages.
2. *Tessa in the picker.* See §0.2.
3. *Speed honesty.* No timer is shown; b6 says the real figure.
4. *The 5.3 s greeting* may sag. The transcript writing, timer, orb and teal glint on the business name carry it. If the critics still feel a dip, cut to b10 under "How can I help you today?" (an L-cut; the audio continues).
5. *Prices on Go live* must stay out of the crop.
6. *The `+1 555 0142` number* is in a fiction range. Never show a real one.

---

## B3 · "One setting, 14 languages" (the true version of the language switch)
**26.0 s · 13 bars · 780 f / 3120 f at 120 fps**

### 1. Premise, views, conversion
**One line:** the agent greets in Japanese. Then the cursor opens the real Language setting and picks German, then Spanish, and each time the same agent greets in that language, saying it's an AI. Finally a Spanish caller asks a price that only exists in an **English** price list, and Ava answers in Spanish from it.

**Why it gets views:**
- **Hook mechanism:** sound and script pattern interrupt. Japanese speech and Japanese type on frame 0 in an English-language feed.
- **Retention device:** a "which language next?" rhythm, with a dropdown snapping open each time and a flag swap. Then the "wait, the document is in English" proof: a hairline joins `85 dólares` to `$85`.
- **Shareability:** among the most sendable true claims (RESEARCH-reels §8 #2). "Show this to Maria." The global audience fits the bio's "global business".

**How it converts:** "Start free. Hear it in your language." Every one of the 14 languages works on the trial's free test calls. Comment keyword **HOLA** → DM.

### 2. Hook (frames 0–45)
- **Picture at f0:**
  - Pearl mesh (`HOME_KB_MESH`), keyLight high right.
  - Ava's orb, Ø 180, at (820, 300), speaking.
  - The **agent's greeting in Japanese**, display 96, Noto Sans JP, centred, y 340–600 (2 lines): `AIアシスタントの / Avaと申します。` It is already up at f0 and takes ink word by word on her onsets.
  - Below (y 700–1100), the General tab card `Name and language`. Its `Language` select (UI 40) shows a JP flag + `Japanese` (the app's flag-per-language mapping, `lib/agent-languages.ts:6-21`).
- **f1:** Tessa (as Ava, in-call path) begins. This is the **borrowed film 1 take `lang-ja`** (2.73 s; the app's Japanese intro, already delivered in film 1).
- **f30–45:** the cursor enters from the lower right toward the select. Its hover ring starts at f45.
- **Sound:** a soft `pickup` click at f0 (we are inside a test call) under a bright pad.
- **Tessa's first words:** "AIアシスタントのAvaと申します。" ("I'm Ava, an AI assistant.")

### 3. VO script and on-screen text
Spoken: Japanese, German and Spanish greetings ≈ 21 words, narrator 24, caller 6, Ava Spanish 8, brand 3 → **≈ 62 / 26 s ≈ 2.4 w/s**. The foreign greetings are slow film 1 reads.

| Beat | Time (s) | Voice | `say` (**emphasis**) | On screen |
|---|---|---|---|---|
| b1 Hook | 0.00–2.85 | Tessa · Ava (ja) | "AIアシスタントのAvaと申します。" (borrow `lang-ja`) | the Japanese line (display 96); select = Japanese |
| b2 The setting | 2.85–5.25 | narrator | "Same agent. Pick one of **fourteen** languages." | `Same agent.` → `Pick one of / fourteen languages.` |
| b3 German | 5.25–8.60 | Tessa · Ava (de) | "Sie sprechen mit Ava, dem KI-Assistenten." (borrow `lang-de`, 3.03 s) | `● AVA` `Sie sprechen mit Ava, / dem KI-Assistenten.` |
| b4 Spanish | 8.60–12.90 | Tessa · Ava (es) | "Soy Ava, el asistente virtual con inteligencia artificial." (borrow `lang-es`, 3.98 s) | `Soy Ava, el asistente virtual / con inteligencia artificial.` |
| b5 The proof | 12.90–15.40 | narrator | "Your price list can stay in **English**." | `Your price list / can stay in English.` |
| b6 Caller | 15.40–17.60 | Caller (es, phone) | "¿Cuánto cuesta una hora de masaje?" | `● CALLER` slate |
| b7 Answer | 17.60–20.30 | Tessa · Ava (es) | "Una hora de masaje deportivo cuesta **85 dólares**." | `Una hora de masaje deportivo / cuesta 85 dólares.` |
| b8 CTA | 20.30–23.70 | narrator | "**Start free**. Hear it in your language. / No card needed." | `Start free.` → `Hear it in / your language.` → `No card needed.` |
| b9 End | 24.00–25.76 | brand | "Neuro Tech Voice." (`kb2-brand`) | `NEUROVOICE` · `neurotechvoice.com` |
| b10 Seam | 25.76–26.00 | — | — | the select reopens; the cursor heads for Japanese |

**Notes:**
- **b4's caption is 8 words in two lines on one screen**, which breaks the ≤ 7 rule. Either accept it for a foreign greeting (it is the app's exact sentence, `lib/voice/greetings.ts` es neutral intro), or split it at the comma: `Soy Ava,` / `el asistente virtual con inteligencia artificial.`
- **b7 is 8 words** and splits at "deportivo".
- **Line directions:**
  - b2 and b5: confident, slightly amused.
  - b6 caller: casual, curious.
  - b7: Tessa in Spanish, warm. Generate with `language: "es"`, speed 1.05, as film 1's lang lines were.

### 4. Visuals per beat
- **b2:**
  - The Japanese line leaves up through its masks. The General card glides up into the stage (y 420–940) with the kit `TabBar` above it (y 330–400, **General** underlined). The card holds the real `CardTitle` `Name and language` and its description (meta 28): `How your agent introduces itself, and the language it speaks with callers.`
  - The cursor presses the select on 3.25. The **popover list** opens (`SPRING.pop`, x 120–700, y 600–1180, 8 rows visible, flag + label, UI 36).
  - On "fourteen" the list scrolls through all 14 entries in one smooth move (`EASE.inOut`, 0.6 s, masked top and bottom) and lands back on `German`. The rows ripple in sequence as they pass: this is the count, shown rather than captioned.
- **b3:**
  - Click `German` (5.20); the popover closes; the trigger reads a DE flag + `German`.
  - The **real hint** rises under it (meta 28): `After saving, check the Voice tab and pick a voice that speaks German naturally.` (`TabGeneral.tsx:214-217`, honest and on-brand).
  - `Save changes` presses; a toast at the panel's foot reads `Saved. Your greeting now matches the new settings.` (`TabGeneral.tsx:143`).
  - Ava's caption rises in the caption band with the `● AVA` teal tag, and the orb speaks.
- **b4:**
  - The cursor reopens the select **during the last word of the German line** (one gesture overlapping the voice tail, so the rhythm never stops). The list scrolls down, ES is hovered, click on 8.70; the trigger flips to an ES flag + `Spanish`. Save.
  - Spanish caption, orb speaking.
  - Keep the ground's key light, but nudge its position per language (a ¼-frame drift). **No hue change per language** (film 1's critics rejected a "rainbow ground").
- **b5:**
  - Camera move on the container: the TabBar underline springs to **Knowledge**, and the page shows the `DocRow` `Price list` · `PDF` · `Ready · 3 passages`.
  - The row opens into a `DocPage` (kit `paper.tsx`): kind `PDF`, heading `Price list`, lines (tabular figures) `Sports massage · 30 min · $50` / `Sports massage · 60 min · $85` / `Physio assessment · 45 min · $95`. These are the site's sample KB (`lib/pages/knowledge-base.ts:76-82`).
  - A small chip at the panel's top-right keeps `Spanish` in view: the agent's setting, unchanged.
- **b6:**
  - `fx-trill` (one chirp) and pickup. A compact call strip (fork) at y 250–330: `● CALLER` + slate `Waveform`.
  - The caller's Spanish question rises in slate in the caption band.
- **b7:**
  - Ava answers. On "85 dólares" a **`MeaningLink`** hairline draws from the caption's `85 dólares` up to the page's `$85`. A sunday **`InkSweep`** runs under `Sports massage · 60 min · $85`, and the other two lines settle to 40 %.
  - The tag on the hairline is the site's own `Lands on` (`MEANING.landsOn`, `knowledge-base.ts:215`).
- **b8:**
  - The page steps back. `cta/StartFree` rises at y 1030; the cursor presses on "free".
  - Captions run in sequence in the band.
- **b9:** end card (§0.7) with StartFree.
- **b10:**
  - The wordmark lifts. The General card returns, the select pops open, and the cursor is already arcing to `Japanese`.
  - Frame 0's Japanese line is rising, so the replay lands on her greeting.

**Kit reused:**
- `MeshGround`, `TabBar`, `Panel`, `Button`, `Cursor`, `DocRow`, `Pill`, `DocPage`, `InkSweep`, `MeaningLink`, `Swap`, `Icon`;
- film 1 `Orb`, Noto Sans JP (`lib/fonts`), `cta/StartFree`, `LightGL`, `EndCard`.

**Forked:** `Captions`, `TurnLabel`, `Waveform`, the call strip, the orb wrapper.

**New:**
- `LanguageSelect` (trigger + popover + scrolling list with hover/press);
- `FlagIcon` set (14 simple SVG flags matching `AGENT_LANGUAGES[].country`);
- `Toast`;
- the hint line.

### 5. Sound
- **Bed ("bright, international"):** 120 BPM, E major.
  - A plucked-guitar ostinato (`fx-pluck` family) over a soft kick on 1 and 3.
  - **Each language pick changes the chord on the downbeat:** E (ja) → C#m (de) → A (es) → B (proof) → E (CTA). The greetings ride a held pad, ducked −9 dB.
  - **b5–b7:** the groove thins to plucks and pad so the Spanish dialogue is clear.
  - **24.0:** impact on E.
- **Cues:**
  - f0 `fx-pickup` (soft);
  - each select open `fx-menu-open`, the list scroll `fx-scroll`, the "fourteen" ripple as **14 tiny `fx-tick`s at 64ths** (≈ 0.47 s, panned across);
  - each pick `fx-click-down/up` plus a `chime-sunday-soft` stepped up a tone per language;
  - Save `fx-tick`, toast `fx-tag`;
  - b6 `fx-trill` (one chirp) and `fx-pickup` with line hiss;
  - b7 `fx-felttip` on the sweep, a pen scratch and `fx-pluck` B5 on the hairline landing;
  - StartFree press; impact + `sub`; URL keys.

### 6. End card / CTA and loop
- **Spoken:** "Start free. Hear it in your language. No card needed." (alternate: "Comment HOLA for the link.")
- **Loop:** the select reopens on Japanese. The replay is the Japanese greeting, so "which language next?" starts again.

### 7. Posting copy
- **Cover:** the open language list (flags) with **`1 agent. 14 languages.`** (4 words, ≈ 160 px, y 300–640).
- **Caption:**
  > An AI receptionist that answers in any of 14 languages, and your price list can stay in English.
  >
  > Pick its language in one setting: English, Spanish, French, German, Italian, Portuguese, Polish, Dutch, Romanian, Japanese, Korean, Chinese (Mandarin), Arabic or Hindi. It greets callers in that language, tells them it's an AI, and answers from your documents in it, whatever language they're written in.
  >
  > It speaks one language at a time, the one you choose, and you can change it whenever you like. For each language you can pick a native-speaking voice; the voice in this video is Tessa from the voice library.
  >
  > Comment HOLA and we'll DM you the link, or use the link in bio. Start free: 5 free minutes for 14 days, no card needed.
  >
  > Sample call; Northside Studio and Ava are made-up names.
- **Hashtags (5):** #AIReceptionist #VoiceAI #MultilingualBusiness #SmallBusinessTips #AIAgents
- **Comment keyword:** `HOLA` → `utm_campaign=reel_b3`.

### 8. Production estimate and risks
**Medium.** Three new parts (LanguageSelect, flags, toast) on top of a kit-heavy body.

**Voices:**
- borrows `lang-ja`, `lang-de`, `lang-es` (film 1) and `kb2-brand`;
- new: narrator ×3 (b2, b5, b8) plus the alternate CTA, Ava-es ×1, one Spanish caller.

**Risks:**
1. *Implying automatic or mid-call language switching.* Prevented by:
   - the visible setting change before every greeting;
   - "Pick **one** of fourteen";
   - the caption sentence "one language at a time".

   Judges should still watch for it.
2. *Tessa's accent in de/es/ja* is non-native. The app itself says to pick a native voice, so the reel shows that hint on screen and the caption says it. **Option:** voice Ava's b7 Spanish answer with the es-ES default (Marta `de38f545…`). That is truer to the product but breaks "the woman's voice = Tessa". A synthesis decision.
3. *The borrowed greetings are slow* (film 1 read them at speed 1.0). That is fine for the montage; measure before locking the grid.
4. *Flags show countries, not languages* (the app's own comment). Mirror the app exactly (English = US, Arabic = SA…).
5. *Japanese font loading:* `waitForFonts()` must include Noto Sans JP before frame 0 renders.

---

## B4 · "Can you trip it up?" (the knowledge base under test)
**26.0 s · 13 bars · 780 f / 3120 f at 120 fps**

### 1. Premise, views, conversion
**One line:** three callers ask for the same price three different ways, and every phrasing lands on the same line of the price list. Then a fourth asks something the documents don't cover, and instead of guessing, the agent says the owner's own fallback line.

**Why it gets views:**
- **Hook mechanism:** a challenge put to the viewer: "Can you trip up this AI receptionist?"
- **Retention device:**
  - "will it fail?" suspense;
  - a quick-fire rhythm (ring, question, hairline: three times in 5 s);
  - a stop-time on the curveball;
  - the twist that the best answer is honesty.
- **Engagement:** it practically asks for comments ("ask it about parking!"). Those comments are engagement, and they are material for reply-with-a-reel follow-ups.
- **Loop:** verbal. "…Then try to trip it up." → "Can you trip up this AI receptionist?"

**How it converts:** the challenge *is* the trial. Upload a price list and ring it for free: "test calls never touch the five minutes" (`lib/site.ts:1813`). Spoken CTA "Start free. Then try to trip it up." Keyword **TEST**.

### 2. Hook (frames 0–45)
- **Picture at f0:**
  - Pearl mesh (`KB_MESH` light), warm key.
  - The **Price list** `DocPage` centred (x 140–940, y 380–980, `meshElevation` 3): kind `PDF`, heading `Price list`, three lines in title 56 with tabular figures.
  - Ava's small teal orb at (150, 300), Ø 120, listening.
  - Headline (display 92, centred, width ≤ 820, y 1080–1340): `Can you trip up this / AI receptionist?` It is up at f0.
- **f3:** Tessa begins. On "trip up" the words take the teal glint and the page gives a 1 px "nudge" (a tiny shake, `SPRING.pop`, 4 f), a visual pun.
- **f36–45:** the headline starts leaving up and the page rises toward y 300.
- **Sound:** the bed starts on f0 with a playful pluck riff and a kick.
- **Tessa's first words:** "Can you trip up this AI receptionist?"

### 3. VO script and on-screen text
Spoken: narrator 31, callers 22, Ava 16, brand 3 → **72 words / 26 s ≈ 2.8 w/s** (the top of the range; the caller lines are short and fast).

| Beat | Time (s) | Voice | `say` (**emphasis**) | On screen |
|---|---|---|---|---|
| b1 Hook | 0.00–2.20 | narrator | "Can you **trip up** this AI receptionist?" | `Can you trip up this / AI receptionist?` |
| b2 Setup | 2.20–3.90 | narrator | "Three ways to ask." | `Three ways to ask.` |
| b3a | 3.90–5.50 | Caller 1 (Kyle) | "How much is an hour?" | `● CALLER` slate, single slot |
| b3b | 5.50–7.40 | Caller 2 (Marian) | "What would a session set me back?" | slot (replaces b3a) |
| b3c | 7.40–8.90 | Caller 3 (Daniel) | "Is the long massage **pricey**?" | slot |
| b4 Answer | 8.90–11.20 | Tessa · Ava | "An hour of sports massage is **$85**." | `● AVA` `An hour of sports massage / is $85.` |
| b5 Turn | 11.20–13.40 | narrator | "Now one that isn't written **down**." | `Now one that / isn't written down.` |
| b6 Curveball | 13.40–15.40 | Caller 4 (Dana) | "Do you do home **visits**?" | slot |
| b7 Fallback | 15.40–19.00 | Tessa · Ava | "I won't **guess**. The team will call you back." | the owner's line in the field card, lighting as she says it |
| b8 Thesis | 19.00–21.20 | narrator | "Where your documents stop, it **says so**." | `Where your documents stop, / it says so.` |
| b9 CTA | 21.20–23.70 | narrator | "**Start free**. Then try to trip it **up**." | `Start free.` → `Then try to trip it up.` |
| b10 End | 24.00–25.76 | brand | "Neuro Tech Voice." (`kb2-brand`) | `NEUROVOICE` · `neurotechvoice.com` |
| b11 Seam | 25.76–26.00 | — | — | the hook headline rising over the price list |

**Sources:**
- The phrasings are the site's own `MEANING.sets.prices` (`lib/pages/knowledge-base.ts:238-240`). "What would a full session set me back?" is trimmed to 7 words.
- b4 is the site's sample answer, shortened (`:131-134`).
- b6 is the site's own fallback example question (`:153-158`; `LIMITS.figure.question`).
- b8 is the site's heading verbatim (`:362`).

**Line directions:**
- **b7 is the business's fallback line.** Owners write their own (`not_in_documents_message`), and the agent says it verbatim (`lib/voice/prompt.ts` fallback rule). The reel uses a short one an owner could write.
- **Callers:** four quick, different personalities on the phone chain.
- **Ava:** b4 bright, b7 calm and kind.

### 4. Visuals per beat
- **b2:** the page settles at y 300–800 (scale .85, glide). Under it, a thin slate **single slot** forms at y 1180–1420: the one-phrasing-at-a-time device from film 2's 9:16 judge fix.
- **b3a–c, each:**
  - A one-chirp ring and the slot's question rises in slate (title 60).
  - On its last word a **`MeaningLink`** hairline draws up from the slot to the line `Sports massage · 60 min · $85`, tagged with the site's own `Lands on`.
  - The old question leaves up on the next ring. The hairlines **stay**, so by b3c three hairlines converge on one line.
  - The line's **`InkSweep`** (sunday 12 %) darkens a step per landing.
  - On "pricey" the word gets a slate underline: the word the page never says.
- **b4:**
  - Ava's answer replaces the slot. The three hairlines contract into the swept line, and `$85` takes the teal glint on her "eighty-five".
  - The orb speaks.
- **b5:**
  - The page shrinks back into a **column of five `DocRow`s** (x 86–930, y 340–1000): `Price list · PDF`, `Cancellation policy · Word`, `Aftercare · Markdown`, `Opening hours · Text`, `FAQ page · Web page`. These are the site's sample KB with the app's `TYPE_LABELS` (`TabKnowledge.tsx:44-50`).
  - A hairline **threshold rule** draws across under the rows at y 1060, labelled `Close enough to answer` (meta 28, the site's own `LIMITS.figure.threshold`, `knowledge-base.ts:365`).
- **b6:**
  - Ring and question. On "visits", **five hairlines** rise from the slot toward the five rows **and stop short of the threshold**, in sequence on 32nds, each ending in a tiny open circle.
  - **Stop-time at 15.0:** the mesh desaturates a touch, the bed cuts on the sample, and nothing moves for ½ beat.
- **b7:**
  - The rows step back. A white **`FieldCard`** slides up (x 72–936, y 420–900) with the dashboard's real label `When the answer isn't in your documents` (film 2 b12's field). Its text is the owner's line: `I won't guess. The team will call you back.`
  - The words light from 40 % to full ink as Ava says them (WordReset spirit, no movement). A sunday focus ring settles round the field on "back".
  - **Typographic apostrophes** (`typo()`).
- **b8:** the field steps back. The narrator caption is centred (width ≤ 820) and `says so` takes the teal glint. The five rows behind brighten to 100 %, the knowledge base at rest.
- **b9:** `cta/StartFree` rises (y 1030); the cursor presses on "free". On "trip it **up**" the button gives the same 1 px nudge as the hook (a callback).
- **b10:** end card (§0.7) with StartFree.
- **b11:** the wordmark lifts. The price-list page slides back to centre and the hook headline is already rising: the verbal and visual loop.

**Kit reused (mostly kit):**
- `MeshGround`, `DocPage`/`useDocPage`, `InkSweep`, `MeaningLink`, `DocRow`, `FieldCard`/`useFieldCard`, `Panel`, `Cursor`, `Icon`, `labelWidth`;
- film 1 `Orb`, `cta/StartFree`, `LightGL`, `EndCard`.

**Forked:** `Captions`, `TurnLabel`, the orb wrapper.

**New:** the `SingleSlot` caller lane, the threshold rule with short-falling hairlines (a variant built *around* `MeaningLink`, not an edit), and the stop-time grade.

### 5. Sound
- **Bed ("the quiz that isn't cheesy"):** 120 BPM, E major. A call-and-response pluck riff (pizzicato-like `fx-pluck`), soft kick and rim.
  - **Each caller:** one `fx-trill` chirp, cut by `fx-pickup` a 16th later, on beats 1 and 3: a quick-fire meter.
  - **Each hairline landing:** a pluck building the chord E5 → G#5 → B5. Ava's answer resolves it with `fx-mallet-e5` on "$85".
  - **b6:** the hairlines falling short are five muted, low-passed `fx-tock`s descending. **15.0: a hard stop on the sample** (film 2's idiom), leaving room tone and line hiss only.
  - **b7:** the fallback line in near-silence over one warm pad (sympathy). A glassy tick on the focus ring.
  - **b8 "says so":** the bed returns with a lift.
  - **24.0:** impact on E.
- **Cues:**
  - 0.0 bed downbeat;
  - 3.9 / 5.5 / 7.4 / 13.4 rings and pickups;
  - three hairline scratches + plucks; the `$85` mallet;
  - five miss-tocks; 15.0 stop; focus-ring `fx-glass` tick;
  - StartFree click; impact + `sub`; URL keys.

### 6. End card / CTA and loop
- **Spoken:** "Start free. Then try to trip it up." (alternate: "Comment TEST for the link.")
- **Loop:** the last spoken idea, *trip it up*, flows into the first ("Can you trip up…"). The page and headline return to their frame-0 positions.

### 7. Posting copy
- **Cover:** the price-list page with three hairlines converging, under **`Can you trip it up?`** (5 words, ≈ 160 px, y 1000–1400 under the page, inside the crop).
- **Caption:**
  > Can you trip up an AI receptionist? Three ways to ask the price, and one question it can't answer.
  >
  > It answers from your own documents, matched on meaning, so "set me back" and "pricey" still land on your price list. Where your documents stop, it says so in the words you wrote instead of guessing.
  >
  > Like any AI it can occasionally get something wrong, so test it on your own price list. Test calls don't use your minutes.
  >
  > Comment TEST and we'll DM you the link, or use the link in bio. Start free: 5 free minutes for 14 days, no card needed.
  >
  > Sample calls with a made-up studio's price list.
- **Hashtags (5):** #AIReceptionist #VoiceAI #CustomerService #SmallBusinessTips #AIAgents
- **Comment keyword:** `TEST` → `utm_campaign=reel_b4`.
- **Bonus:** pin a comment, "What would you ask it? Best question gets tested in the next reel." This sets up reply-with-reel follow-ups (organic content from comments).

### 8. Production estimate and risks
**Simple–medium.** It is the most kit-heavy: film 2's paper parts do most of the work.

**Voices:** narrator ×5 plus the CTA alternate, Ava ×2, 4 caller lines (all four voice IDs are already pinned in film 2), the `kb2-brand` borrow.

**Risks:**
1. *Inviting failure.* Real users will try to break it. The caption carries the site's own honesty line ("can occasionally get something wrong", `knowledge-base.ts:393`). The fallback beat shows what happens at the edge.
2. *"Matched on meaning" is a product claim* (the site states it). Real retrieval varies. Before posting, run the three phrasings on a real agent loaded with the sample price list, as a cheap validation.
3. *One answer for three callers* is a compression. The single-slot hairlines show three separate questions, and Ava answers once. If the judges call that misleading, add a "×3" counter on her answer row (unspoken chrome).
4. *Four caller voices is busy.* Fall back to two (Kyle / Dana) alternating.
5. **Tessa-only fallback:** the narrator voices the three phrasings in quotes ("'How much is an hour?' 'What would a session set me back?' 'Is the long massage pricey?'"). It reads as her demonstrating, and it works because the reel is about phrasings.

---

## 6. Side by side, and the posting order

| | B1 Watch it book | B2 Four screens | B3 One setting, 14 languages | B4 Can you trip it up? |
|---|---|---|---|---|
| Length | 24 s | 24 s | 26 s | 26 s |
| Hook | ring + "Watch an AI book this call." | typing + "Let's build an AI receptionist." | Japanese greeting (sound/script interrupt) | viewer challenge |
| Retention | live transcript, timer, slots, cascade | step rail 1→4, cursor speedrun, "what will it sound like?" | "which language next?", the English-doc proof | "will it fail?", stop-time twist |
| Loop | next ring | empty form retyping | select reopens on Japanese | verbal "trip it up" |
| CTA (spoken) | Comment BOOK | Start free. No card needed. | Start free. Hear it in your language. | Start free. Then try to trip it up. |
| Keyword | BOOK | BUILD | HOLA | TEST |
| Plan gate shown | **Pro + Calendar beta (spoken)** | none (trial path) | none | none |
| Voices | Tessa + Dana | Tessa only | Tessa (en/de/es/ja) + es caller | Tessa + 4 callers |
| Build | medium–heavy | heavy | medium | simple–medium |
| Best for | paid intent (Pro) | trial sign-ups | reach / sends (global) | comments + trial |

**Posting order** (Tue/Thu, two weeks, per RESEARCH-reels §3.6):
1. **B4** (week 1 Tue): cheapest build, broadest hook, comment engine.
2. **B1** (week 1 Thu): strongest "wow".
3. **B3** (week 2 Tue): sends.
4. **B2** (week 2 Thu): the "how do I try it" closer.

**Pin:** B1, B3, B2.

**Reels linking (since Aug 2025):** B4 → B1 → B3 → B2. Each still closes on its own CTA.

## 7. Open decisions for the synthesis
1. **Caller voices** (B1, B3, B4) versus Tessa-only. Fallbacks are given per concept.
2. **One shared keyword (AGENT)** versus per-reel keywords. Per-reel keywords give attribution; the UTM in each DM does that anyway.
3. **B3's Spanish answer:** Tessa (the client's voice rule) or the es-ES default Marta (truer to the "native voice" advice).
4. **Unspoken app chrome** (≤ 44 px): accept it as in film 2, or reduce it further.
5. **Real dates in B1** ("Thursday, 8 October") versus weekday only, depending on the posting date.
