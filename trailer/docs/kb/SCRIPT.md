# Two Kinds of Work: trailer #2 final script ("kb")

**Film:** Neuro Tech Voice, trailer #2, the knowledge-base film
**Formats:** 16:9 and 9:16, 4K (3840×2160 / 2160×3840) at 120 fps (`RENDER_FPS=120`, `SUB=4`). The timeline is in 30 fps units.
**Duration:** 90.0 s = 2700 frames = 45 bars at 120 BPM. The impact lands on bar 44 (86.0 s, frame 2580).
**As built:** 100.0 s = 3000 frames = 50 bars. The real takes push the anchors by whole bars (98.0 s), and b12 takes one bar more than this plan so CLIENT DIRECTION v2's full order fits (Conversation tab click → field click → the 22 words → Save → vo-6; orchestrator decision, 2026-10-04). Placed anchors (`src/kb/timing.ts` `ANCHORS`): "Waiting." 26.0, live ring 44.0, resume 54.0, desk ring 82.5, impact 96.0 (bar 49, frame 2880), end 100.0 (frame 3000). The times below are the plan's.
**Language:** English. **Explaining voice:** Ava = Cartesia "Tessa (Emotive)", sonic-3.6, speed 1.05, as the client asked.
**Built from:** the winning draft "contrast" (both judges), plus grafts from "empathy" and "demo". Every must-fix from both judges is resolved (ledger at the end).

## Logline

"Are you open on Saturdays?" rings three times in three voices, and the same answer goes out each time. The client at the desk never gets to finish her sentence. Ava, the AI that answers the phone, takes the work that repeats. She shows the owner how the knowledge base works: answers written once, found by meaning, said in a sentence or two, in the owner's own words when the answer isn't there, and changed by changing one line. Then the desk gets its conversation back.

## The idea in one line

One written fact (the Saturday hours) travels through the whole knowledge base. Three callers ask it and the desk answers by hand. The answers collapse into one document. A fourth phrasing finds it by meaning, and Ava answers in her own words. The owner edits the line, and the same caller gets the new answer.

## Grid and anchors (120 BPM: beat 0.5 s · 8th 0.25 s · 16th 0.125 s · bar 2.0 s = 60 frames)

Bars fall on even seconds. "Strong beat" means beat 1 (bar line) or beat 3 (bar + 1.0 s). Times below are targets. `src/kb/timing.ts` derives every voiced time from the real take lengths and word timings, as film 1 does, and keeps these **fixed anchors**:

| Anchor | Time | Frame | Rule |
|---|---|---|---|
| Ring one | 2.0 | 60 | bar line |
| Hard stop, end of Part I | 18.0 | 540 | bar line: every bus cut on the sample |
| "Waiting." | 24.0 | 720 | bar line. The line is placed so this word's onset hits the bar. If the measured takes leave less than 0.25 s between vo-1 and vo-2, shift Part II onward by one bar (+2 s) rather than break the bar. |
| Ava's orb is born | on "Ava" in vo-3 | snapped to 16th | |
| Live call rings | 40.0 | 1200 | bar line |
| Stop-time ends, answer starts | 50.0 | 1500 | bar line |
| Owner's line types | 55.0–57.75 | 1650–1732 | one word per 16th (22 words) |
| Ready phrase completes | on "the new answer" | snapped to beat | 5th mallet note |
| Desk payoff ring | 74.5 | 2235 | beat 2 of the bar, under the staff line (deliberately not a strong beat: it moves nothing) |
| Room-tone breath | from end of desk-2 to vo-8 | ≥ 60 frames | at least one full bar |
| Logo impact | 86.0 | 2580 | bar line (beat 1), `MIX.impact.at` |
| End | 90.0 | 2700 | `MIX.fadeOut = [2670, 2700]` |

**Colour logic (one accent per part).** Part I has one source: a rush-rose line light (the colon of the clock, labelled LINE 1), with key phrases in rush ink (`LIGHTS.rush.ink`). From Ava's arrival onward the accent is sunday teal. Her orb is born *from* that rose dot and relights teal, so the colour that interrupted becomes the colour that answers. Sunday is film 1's knowledge-base accent, which keeps the campaign's colour logic. Callers are slate, the front desk is graphite, and there is no second chromatic ink. Ember is not used (it means "Booked").

**No phone is drawn and no faces are shown.** The ring is the rose dot, its RingPulse and the sound. People exist as type on cards, voices and slips of paper.

**Rooms.** Paper acts (0–80.5 s) use `PaperRoom` and the mix room `white`. The night close (82.0–90.0) uses `NightRoom` and the mix room `night`. `FilmGrain` white window = 0–81.0, crossfading to dark grain by 82.0.

---

## PART I · THE REPEAT

### b01 · The sentence · 0.0–2.0
**Picture.** Daytime `PaperRoom`: neutral warm paper, tint 0, low horizon (y .64), light `Vignette2`. Camera: `camMotion` from zoom 1.00 to 1.06 across all of Part I, over three Layers: ground 0.2, desk objects 0.6 (in-person card, message pad), near 1.0 (clock lockup, caller captions).
- *16:9:* a white in-person Card (`elevation` lift 2) at x 180–1180, y 330–760, headed `● IN PERSON` (label role, graphite dot). Her sentence rises word by word from 0.25 (`Words by='word'`, `SPRING.caption`, about 0.2 s per word), caption role 76, ink. It stops on a hanging em dash at 1.75. Top right, x 1330–1740, y 150–300: `ClockLockup` with meta `TUE` and `09:13` in Flick windows. Its colon is a small rush-rose dot, the line light, breathing slowly. `LINE 1` (label role) sits under it. The dot is the room's only light source (rose tint .03 at rest). Bottom right, x 1300–1740, y 700–960: an empty message pad (white slip, hairline rule, `ContactShadow`).
- *9:16:* clock band y 270–420, centred. Card x 64–1016, y 480–1000, sentence on 3 lines (caption 68). Pad y 1150–1440.

**On screen:** `● IN PERSON` · `First session since my injury, and I'm a bit—` · `TUE` `09:13` · `LINE 1`
**Voice:** none (the client is type only).
**Sound:** room tone at −52 dBFS (soft HVAC, far street) from frame 0. A cup set down on wood at 0.25. A pen click as the em dash lands (1.75). No music.

### b02 · Ring one · 2.0–7.0
**Picture.**
- 2.0, bar 2: the minutes window flips 09:13 → 09:14. The rose colon sends one hairline `RingPulse`. The PaperRoom light jumps to the dot (rose tint .06) and relaxes: a pulse, not a glow.
- The in-person card steps back one depth (scale 1 → .96, shade .05, `SPRING.site`): attention leaves the person.
- 2.5: pickup. `TurnLabel` `● CALLER` (slate ink prop) and Kyle's caption rise beside the clock (16:9 x 1180–1820, y 380–520, caption role, slate). A `Waveform` (slate, the take's real envelope) draws out from the centre under it.
- On the desk voice's first word, the caller caption leaves up. On the pad, `● FRONT DESK` (label, graphite) and the answer rise word by word on Leo's word timings, title role 64, ink: `Yes, Saturdays, / nine till two.`
- On "two" the slip tears off and lands at the stack position (`SPRING.land`, contact shadow thickening).
- *9:16:* caller caption centred at y 1040–1130 under the card, waveform y 1150, pad y 1180–1440.

**On screen:** `09:14` · `● CALLER` `Hi! Are you open on Saturdays?` · `● FRONT DESK` `Yes, Saturdays, nine till two.`
**Voice:** kb2-c1 (Kyle, phone) at ≈2.625 · kb2-desk-1 (Leo, full-band) at ≈4.875
**Sound:**
- **The ring:** one two-chirp desk trill on the downbeat, tuned to G#4/B4 (the score is E major). It is the same sample for every ring in the film. The handset pickup click at 2.5 cuts it.
- **Voices:** Kyle on the phone-line chain, slightly right. Leo full-band, close and dry, centre-left, with any room colour coming only from the mix's existing `white` room send (no new reverb).
- **The bed starts on the ring:** one bar of muted felt piano (B–E eighths) with a soft shaker. The *identical* bar loops through all of Part I.
- **Slip land:** a paper slap plus a soft desk thud on the 16th of "two".
- **HITS:** 2.0 ring, 2.5 pickup, slip land.

### b03 · Ring two · 7.0–12.0
**Picture.**
- The card drifts forward but stops at .97: it never quite comes back.
- 7.0 (beat 3): ring. All four clock windows roll 09:14 → 11:02, the hour strip running longer. Rose pulse, and the card goes back to .95.
- Dana's caption and waveform.
- The *same* answer follows: same words, same word timings, on a fresh slip. It lands on the first with a fixed 3 px offset and +0.4° rotation (seeded per slip, a pure function of t).
- *9:16:* as b02, with the stack building on the pad.

**On screen:** `11:02` · `● CALLER` `Quick one. Can I pop in on Saturday?` · `Yes, Saturdays, nine till two.`
**Voice:** kb2-c2 (Dana, phone) at ≈7.375 · kb2-desk-1, the **identical file**, at ≈10.0
**Sound:** the same trill, cut at one and a half chirps (pickup at 7.25: they answer faster). Dana on the phone chain with film 1's caller2 presence EQ. Desk-1 is the same file at the same gain, pan and slap. The loop is unchanged. HITS: 7.0 ring, 7.25 pickup, slip land.

### b04 · Ring three · 12.0–16.5
**Picture.**
- 12.0, bar: ring, picked up after one chirp (12.125). The clock rolls 11:02 → 14:30.
- The card falls back to .93 (shade .08), its em dash still hanging. Marian's caption and waveform.
- The same answer a third time, on slip #3. This slip alone lands crooked (+1.2°).
- **The autopilot gag is deliberate.** "Yes," does not answer "What are your weekend hours?". He is on autopilot, and this sets up "The phone turned them into a recording."
- 16.0–16.5, dead line: the waveform lies flat for half a beat, the caller's silence after an answer to a question she didn't ask.
- The camera's slow push has drifted toward the pad, and the near-layer caller caption now half covers the card.
- *9:16:* card at .93, with the caption overlapping its lower edge.

**On screen:** `14:30` · `● CALLER` `What are your weekend hours?` · `Yes, Saturdays, nine till two.`
**Voice:** kb2-c3 (Marian, phone) at ≈12.25 · kb2-desk-1, the **identical file**, at ≈14.125
**Sound:** one chirp, then the click. Marian on the phone chain. Desk-1 a third time, identical. The bed adds a low pulse on beats 1 and 3. 16.0–16.5: line hiss only, with no music change; the half beat of nothing *is* the joke. HITS: 12.0 ring, 12.125 pickup, slip land.

### b05 · The rest of the day · 16.5–18.0
**Picture.**
- Six 8th notes: the clock rolls 15:05 · 15:41 · 16:20 · 16:58 · 17:26 · 17:58 at 16.5, 16.75, 17.0, 17.25, 17.5 and 17.75.
- Each roll sends a rose pulse and lands a new slip. There are no captions or voices: we know the question and the answer.
- The stack grows into a neat column of paper, and the card sits far back at .90. The height of the paper is the count; no number is shown.
- **18.0, bar 10: everything stops.** The last pulse is cut, the rose tint drains to neutral in one frame, and the camera holds.
- *9:16:* the stack grows upward from y 1440 to about y 1160.

**On screen:** `15:05` `15:41` `16:20` `16:58` `17:26` `17:58` (Flick windows)
**Voice:** none.
**Sound:** six chirps on 8ths, each with a pickup click and a slap. The loop's filter opens and it doubles to 16ths. **Hard stop on the downbeat at 18.0:** music and SFX are cut on the sample with no tail. Room tone only. HITS: six rolls on 8ths, 18.0 stop.

### b06 · A recording · 18.0–25.0
**Picture.**
- In the silence the camera glides up and right onto the slip stack (`camMotion`, three layers). The stack fans out vertically into one column of the same line, `Yes, Saturdays, nine till two.` (title role, slate), twelve rows deep. It is masked top and bottom by many-stop paper fades and scrolls slowly upward like a teleprompter.
- Over it, the house `Title` (headline 100/92): `You hired someone brilliant.` rises on "You" (≈18.25) and leaves up on "The". Then `The phone turned them / into a recording.` rises. The key phrase **`a recording.`** eases into **rush ink** as the glint runs word by word.
- On "And the customer" the camera pulls back and left to the in-person card, still at .90 with its em dash. It comes forward to 1.0 (`SPRING.site`).
- `And the customer in front of them?` rises beside it (caption role). **`Waiting.`** locks in display role 128/112 *on the bar line at 24.0* (`DisplayWord`). It holds to 25.0.
- There is no orb yet: Ava is only a voice, so her arrival in b07 is an event.
- *16:9:* title left-aligned at x 160, y 180–420; column x 160–1100, y 480–1000. Then the card centre-right, the question x 160–900 y 300, and `Waiting.` x 160 y 520.
- *9:16:* title y 300–560, column y 640–1440. Then the card y 420–940, the question y 1000–1140 (2 lines), `Waiting.` y 1240.

**On screen:** `You hired someone brilliant.` · `The phone turned them into a recording.` [key **a recording.** in rush ink] · `Yes, Saturdays, nine till two.` ×12 · `And the customer in front of them?` · `Waiting.` · `First session since my injury, and I'm a bit—`
**Voice:** kb2-vo-1 at 18.25 · kb2-vo-2, placed so that "Waiting" starts at 24.0
**Sound:** room tone only. One low felt-piano E2 under "brilliant". A faint paper riffle as the column scrolls. On "Waiting." a single high B5 that does not resolve. Ava's narrator path: clean (90 Hz high-pass), dry, intimate and close. HITS: 18.25 vo-1, title rises, 24.0 "Waiting."

---

## PART II · THE TURN

### b07 · Two kinds · 25.0–32.0
**Picture.**
- **25.0 (beat 3):** a hairline `Seam` draws top to bottom on `EASE.draw` over one beat (16:9 vertical at x 960; 9:16 horizontal at y 900). The desk sorts itself: the slip column slides into the left half, the card into the right half, and the clock rides to the top of the left half.
- **Left:** `Some work repeats.` (headline). `repeats.` sits in a flip window that turns over on every beat and **only ever flips to the same word** ("repeats." → "repeats."), in slate, with a flap tick.
- **Right:** `Some work matters.`, still and in full ink.
- **On "Ava" (snapped to the 16th), the orb is born from the line light.** The rose colon dot lifts off the clock as the 3-frame seed. It rises above the left title and springs open into **Ava's orb**: `Orb`, `SPRING.pop` 0 → 1.06 → 1, one hairline ring leaving the rim, rim and bloom as CSS on a div behind the canvas, `resolution 1.5 × dpr()`. As it opens, its palette crossfades from rush to **sunday** (`mixPalette`, 6 frames): the same light, now hers.
- The left half's `PaperRoom` key moves onto the orb (sunday tint .06). The right half stays neutral. The clock is left with an empty colon.
- **On "the first kind":** the flip window stops for good, and the left column eases toward the orb, into its light.
- Narrator caption under the seam, **no speaker tag** (narrator captions never carry ● AVA; that tag belongs to calls).
- *16:9:* orb Ø 300 at (480, 300); left title x 160–900, y 470; slips y 560–860; right title x 1060, y 470; card at .8, x 1060–1760, y 560–880; caption centred at y 960.
- *9:16 (judge fix: five elements only):* orb Ø 260 at y 330; `Some work repeats.` y 560; seam y 900; `Some work matters.` y 1040; caption y 1300–1440. **The slip column and card are not shown in 9:16.**

**On screen:** `Some work repeats.` · `Some work matters.` · caption `I'm Ava, an AI that answers your phone, and I'll take the first kind.` [key **the first kind** in sunday ink]
**Voice:** kb2-vo-3 at ≈25.25
**Sound:** the Part I loop returns for exactly one bar under "Some work repeats.", deadpan. On "Some work matters." it stops and the harmony opens (E – C#m7 – Amaj7 – B; soft strings, warm sub). A small flap tick on each flip. On "Ava": a soft seed tone, then one sine "ting" with the hairline ring. On "the first kind": a quiet paper slide. HITS: 25.0 seam, the flips, orb pop on "Ava", slide on "kind".

---

## PART III · WRITTEN ONCE

### b08 · Written once · 32.0–40.0
**Picture.**
- The seam retracts. Daytime `PaperRoom` keyed on the orb (sunday tint .07). Slow push.
- *16:9:* orb top-left (x 330, y 300, Ø 220). A white panel Card at x 760–1720, y 170–880 (`elevation` 2). It carries the dashboard's real card title **`Add knowledge`** and drop-zone line **`Drop files here or choose them`** (label role), a URL field and an **`Add page`** button. Under it, the list area shows the dashboard's empty-state title **`Teach your agent about your business`** (title role, 40% ink), exactly what the app shows with no documents.
- **On "once": the graft from "empathy".** The slip column at the left stacks upward into **one**: each slip slides under the one above on 16ths (`SPRING.land`), contact shadows thickening, over about 1 s. The last slip draws its edges into a document row, `TXT · Opening hours` (kind token label role, name title role). As that row exists, the empty-state title leaves up through its mask.
- Rows land in the panel's list on the 16th after their nouns (`SPRING.land`, sub-pixel glide):

  | Word | Row that lands |
  |---|---|
  | "prices" | `PDF · Price list` |
  | "hours" | the `TXT · Opening hours` row slots in |
  | "policies" | `DOCX · Cancellation policy` |
  | "pages from your website" | the URL field types `https://your-site/faq` (Geist Mono, a real token with no TLD, so it cannot point to a real domain), `Add page` presses (.97), and `URL · FAQ page` lands |

- Each row's pill reads `Reading…` (`Reading page…` for the page). It rolls on a 16th to `Ready · 2 passages`, `Ready · 1 passage`, `Ready · 2 passages` and `Ready · 3 passages`. These counts are illustrative.
- **On "knowledge":** the eyebrow `● KNOWLEDGE BASE` (label role, sunday dot) rises above the panel.
- Narrator caption at the bottom, no tag.
- *9:16:* orb Ø 180 at y 300; eyebrow y 430; panel x 64–1016, y 470–1220, rows stacked. The slip collapse happens above the panel (y 470–640) and drops in. Caption y 1300–1440.

**On screen:** `Add knowledge` · `Drop files here or choose them` · `Teach your agent about your business` (leaves) · `TXT · Opening hours` · `PDF · Price list` · `DOCX · Cancellation policy` · `https://your-site/faq` · `Add page` · `URL · FAQ page` · `Reading…` / `Reading page…` → `Ready · N passages` · `● KNOWLEDGE BASE` · caption `Give me your answers once. Your prices, your hours, your policies, pages from your website. That's your knowledge base.` [key **knowledge base** in sunday ink]
**Fix round (written act), overrides the row and URL notes above:** the rows are drawn as the app draws them (TabKnowledge.tsx DocumentRow): the icon tile with lucide FileText (Globe for the page) and the TYPE_LABELS word after the pill (`PDF` · `Word` · `Text` · `Web page`), never the reading-room kind tokens (DOCX / TXT / URL); in b10 and b14 the page's own `TXT` kind line rises in on the page. The address is typed bare, one key per 16th (8 keys/s), as owners type it; the app adds https:// itself (lib/knowledge/shared.ts normalizeKnowledgeUrl).
**Polish pass (written act), overrides the address above and in the table / On screen:** the typed address is `yoursite.com/faq` — a host with a dot, so it passes the real app's normalizeKnowledgeUrl (the old no-TLD `your-site/faq` would have been rejected); the field's placeholder stays the app's own `https://yourbusiness.com/faq` (TabKnowledge.tsx). Its 16 keys run on 16ths from 131.25 to 187.5 (act-local): the field is clicked four 16ths before the policies row (a 16th earlier than before) and Add page pressed a 16th later, so the FAQ page lands at 210 and its Ready (B4) rolls at 225, still before "knowledge" and 9:16's scroll; the key run's HIT counts 16 keys. *9:16:* the app panel comes in from the right along its own band (as 16:9's does), never up through the caption's band under "Give me your answers once."
**Voice:** kb2-vo-4 at ≈32.25. **The feature is named aloud** (judges' must-fix).
**Sound:**
- **Bed, Part III:** felt-piano eighths, a soft kick on beats 1 and 3, and the chords E – C#m7 – Amaj7 – B.
- **Collapse:** dry paper clicks on 16ths, pitch descending, ending in a soft settle thud.
- **Rows:** each landing row is a pitched paper "tock" tuned to the chord.
- **URL:** soft low-profile keystrokes, then a small click on `Add page`. The pill rolls are tiny ticks.
- **Ready phrase:** each `Ready` plays one mallet note rising up the E major pentatonic: E4, F#4, G#4, B4. The phrase is left open; its last note comes in b13.
- **Eyebrow:** a soft felt-piano E.
- **HITS:** collapse 16ths from "once", four row lands, URL keys, Add page, four Ready notes, eyebrow on "knowledge".

### b09 · Live call · 40.0–44.5
**Picture.**
- The panel steps back one depth (scale .9, shade .06) and slides right. The orb comes forward to centre-left.
- **40.0, bar:** a single slate hairline `RingPulse` leaves the orb. At 40.25 the orb wakes to listen (rest .12 → listen .15): picked up on the first ring, shown rather than captioned.
- A call strip appears: `TurnLabel` `● CALLER` (slate ink prop), a mono call timer `00:04` ticking (the greeting has already been said), and the caller caption (caption role, slate) over the take's `Waveform`.
- On her filler, the TurnLabel rolls to `● AVA` (sunday tag, caption in ink): `One moment, let me check.` This is the product's real filler. The orb speaks (.44 + .38·env, attack 14/s, release 5/s).
- **44.5: freeze.**
- *16:9:* orb Ø 240 at (420, 470); strip x 700–1760 (label y 360, caption y 420–520, waveform y 560).
- *9:16:* orb Ø 200 at y 380; label y 600; caption y 640–800 (2 lines); waveform y 850.

**On screen:** `● CALLER` `00:04` `Are you guys around this weekend?` · `● AVA` `One moment, let me check.`
**Voice:** kb2-c4 (phone) at ≈40.375 · kb2-call-1 (Ava, in-call) at ≈42.625
**Sound:** the same trill sample, cut after its first chirp by the handset click at 40.25. The bed ducks −8 dB. c4 on the phone chain, slightly right. Ava's in-call path is the clean voice with a touch more presence and a very short room (film 1's call chain). HITS: 40.0 ring, 40.25 pickup.

### b10 · By meaning · 44.5–50.0 (stop-time)
**Picture.**
- **44.5:** the label `BETWEEN QUESTION AND ANSWER` rises at the top (label role). The call freezes: the timer holds at `00:07`, the waveform keeps its last shape, and the strip's layer desaturates a touch and steps back.
- **The page.** The camera glides (`camMotion`, about 1.2 s, `EASE.inOut`) to the Opening hours row. It rises out of the panel as a full-size paper **DocPage** (white, `elevation` 3): kind `TXT`, heading `Opening hours`, and three lines in title role with tabular figures. These are the site's own sample lines:
  - `Monday to Friday · 8:00–20:00`
  - `Saturday · 9:00–14:00`
  - `Sunday · closed`
- **On "the part that answers them":** a sunday ink sweep runs under the Saturday and Sunday lines only (a flat band at 12% opacity, `EASE.draw`, 0.5 s, no glow). The weekday line settles to 40%.
- **On "even when they put it differently":**
  - The caller's words `around this weekend` get a slate underline.
  - **The hero link:** one hairline curve draws from "weekend" to the swept lines, with the midpoint tag `MATCHED ON MEANING` (label role). The caller's sentence shares no word with the page.
  - Then the day's three questions return on successive 8ths as smaller slate lines, and each sends its own hairline to the same two lines: four phrasings, one written answer.
- Narrator caption at the bottom.
- *16:9:* label y 110; the three questions stacked at x 160–820, y 200–400 (title role 64, slate at 70%); frozen caller caption x 160–820, y 470–560; page x 980–1760, y 200–820; caption y 960.
- *9:16 (judge fix: one phrasing at a time):* label y 280; frozen caller caption y 330–450; page y 520–1080; the three earlier questions appear **one at a time** in a single slot at y 1120–1200. Each rises, sends its hairline up to the page, and leaves up on the next 8th. Caption y 1300–1440.

**On screen:** `BETWEEN QUESTION AND ANSWER` · `00:07` · `TXT` `Opening hours` · `Monday to Friday · 8:00–20:00` · `Saturday · 9:00–14:00` · `Sunday · closed` · `MATCHED ON MEANING` · `Are you open on Saturdays?` · `Can I pop in on Saturday?` · `What are your weekend hours?` · caption `When someone calls, I find the part that answers them, even when they put it differently.` [key **the part that answers them** in sunday ink]
**Voice:** kb2-vo-5 at ≈44.75
**Sound:** the bed's beat drops out and a sustained E add9 holds: time has stopped. The frozen call's line hiss sits very low. The ink sweep is a soft felt-tip swipe. Each hairline is a fine pen scratch landing on a pitched pluck. The four plucks (E5, G#5, B5, F#5: key hits an octave over the held pad, so they are heard under her line) build the chord on 8ths. HITS: 44.5 freeze, the sweep, four links.

### b11 · The answer · 50.0–54.5
**Picture.**
- **50.0, bar:** time resumes. The label leaves up, the strip unfreezes, and the timer runs 00:07 → 00:11. The `TurnLabel` holds `● AVA` (sunday) and the orb speaks.
- **The word re-set (the graft from "demo").** *(Build B fix: ONE move, no lifted strip.)* The tokens she doesn't say leave the page up through their masks with the sweep bands; on "We" the kept words fly from the page together straight into their pen positions in her sentence and wait at 40 %; on her onsets (− 2 f) her own words rise in and each kept word takes full ink. The sentence is complete ≥ a beat before the record. The plan's version, for reference: the two swept lines **re-set into what she actually says**, using `layoutText` pen positions:
  - The words that stay (`Saturday`, `Sunday`, `closed`) glide sub-pixel to their new places. `Sunday` gains its "s" as one letter rising in.
  - The tokens she doesn't say (`·`, `9:00–14:00`) leave up through their masks.
  - Her own words (`We are!`, `from nine till two.`, `we're`) rise in.
- The result **is** her caption: `We are! Saturday from nine till two. Sundays, we're closed.` (caption role, ink, with **nine till two** keyed in sunday on the word).
- Behind it the page stays tall and dim (25%): a page against a sentence, showing "a sentence or two" without reading the page out.
- **53.5:** the call strip folds into a compact white record row (Card):
  - meta `TRANSCRIPT`
  - a dim first row `00:00  Ava: … This is Ava, an AI assistant.` (an excerpt of the real greeting — every English greeting opens "Thank you for calling…" before the intro, `lib/voice/greetings.ts:237–252` — carrying the disclosure)
  - the section title `Answered from your documents` with a chip `Opening hours`
  - a white check drawn in a teal disc (the Flow check idiom)

  It holds to 54.5.
- *16:9:* re-set line centred at y 540 (max width 1500); page behind at x 980–1760; record row x 560–1360, y 760–960.
- *9:16:* re-set line y 640–860 (3 lines); page behind at .85 scale; record row y 1100–1340.

**On screen:** `● AVA` `We are! Saturday from nine till two. Sundays, we're closed.` [key **nine till two** in sunday] · `00:11` · `TRANSCRIPT` · `Ava: … This is Ava, an AI assistant.` · `Answered from your documents` · `Opening hours`
**Voice:** kb2-call-2 (Ava, in-call) at ≈50.25
**Sound:** the bed returns on the beat at 50.0. One paper lift as the kept words take off (the per-word ticks were inaudible and went with the per-word flights). The record row lands with a paper click and a check tick at 53.5. HITS: 50.0 resume, the re-set lift, 53.5 record.

### b12 · Your line · 54.5–62.0
**Picture.**
- The record row slides away and a white settings Card comes in. It carries the dashboard's real field label **`When the answer isn't in your documents`** (label role) and a two-line field. The field shows the product's default line as grey placeholder text: `I don't have that information, but I can take a message so the team calls you back.`
- **55.0:** the caret clicks in. The owner's own line replaces the placeholder **word by word on 16ths**, each word appearing in place as a real field shows a keystroke (title role, ink; no rise, no mask — the caret jumps after it): `I don't have an answer for that, and I don't want to guess. I'll ask the team to call you back today.` This is film 1's line, now shown as something the business wrote.
- **Only one text moves at a time** (judge fix). Nothing is narrated while it types. The small orb (top-left) dims to rest while the owner types, because these are not her words.
- **57.75:** a save tick.
- **58.0:** Ava narrates and the orb relights on her first word. On "in the words you chose" a sunday focus ring settles round the field.
- The dashboard's helper text ("Your agent never guesses…") is deliberately not shown, and no line in the film says "never".
- *16:9:* card x 360–1560, y 260–700 (label y 300; field text y 360–640, 2 lines); orb Ø 140 at (180, 180); caption y 960.
- *9:16:* card x 64–1016, y 520–1120 (label y 560; field text in 4 lines at title 56, y 620–1060); orb Ø 140 at y 320; caption y 1300–1440.

**On screen:** `When the answer isn't in your documents` · placeholder `I don't have that information, but I can take a message so the team calls you back.` → `I don't have an answer for that, and I don't want to guess. I'll ask the team to call you back today.` · caption `If it isn't written down, I say so, in the words you chose.` [key **in the words you chose** in sunday]
**Voice:** kb2-vo-6 at 58.0
**Sound:** the bed thins to piano and pad. Soft real keystrokes, one per word on 16ths (no typewriter bell). A save tick at 57.75. A glassy tick on the focus ring ("words"). HITS: 55.0 caret, 22 key events, 57.75 save, focus ring.

*As built (CLIENT DIRECTION v2, b12 one bar longer: 60.0–69.5 s on the 100 s cut):* the page comes back on its **Knowledge** tab (b08's list at rest); the pointer settles onto **Conversation** as the page lands, presses it on beat 2 and releases (underline slide, content swap), crosses to the field and clicks it (the caret), the 22 words type on 16ths, the pointer hops back off the keys to **Save changes** after the last word and clicks it (the amber dot goes), a beat, then vo-6 (5.5 s into the act). While the line types the camera pushes slowly in (16:9 ×1.30: the page fills the frame, the field's type 48 → 62 px, the orb carried out past the left edge; 9:16 ×1.08 about the field, inside the platform-safe width), holds through the Save click, and pulls back on its release so the orb returns to relight on her first word. HITS add the tab's down / up and the underline's slide. *Line fix pass:* the cut from b11 is a card stack — the agent page comes up from below the frame's bottom edge, opaque, over the record row, which steps back (× .92) and goes; the pointer enters with the page. The tab and field are crisp 2.25 f clicks so the hand crosses from the tab to the field at its natural pace (22 f, leaving during the tab's release); typed words appear in place (a one-frame ramp, no travel) with the caret after the last half-visible word.

### b13 · Change it · 62.0–67.0
**Picture.**
- The Opening hours page comes back to fill the frame, shown as **the owner's own file**: plain paper, with the file name `Opening hours.txt` in Geist Mono at the top (the name its row reads, plus the extension: the app names a document by its file — `lib/knowledge/documents.ts` cleanDocumentName keeps it) and **no dashboard chrome**. There is no in-app editor, so the edit happens outside the app.
- **On "Hours change?":** a caret clicks into `14:00`, the digits are selected (sunday wash at 12%), and `16:00` is typed, one keystroke per 16th.
- **On "Change the document":**
  - The dashboard row slides up under the page: `TXT · Opening hours`, `Ready · 1 passage`.
  - Its `…` menu is open on the real items `Read again` / `Replace with new file` / `Remove`, and `Replace with new file` presses (.97).
  - A **second row** for the new version appears with the pill `Reading…`. The old row stays `Ready`: the current version keeps answering until the new one is read.
- **On "the new answer":** the new row rolls to `Ready · 1 passage`, and the old row leaves up through its mask.
- *16:9:* page x 360–1560, y 140–620; rows y 680–860; menu x 1180–1560, y 700–900; caption y 960.
- *9:16:* page y 280–800; rows y 860–1080; menu right-aligned at y 1100–1260; caption y 1320–1440.

**On screen:** `Opening hours.txt` · `Opening hours` · `Saturday · 9:00–14:00` → `Saturday · 9:00–16:00` · `TXT · Opening hours` · `Read again` · `Replace with new file` · `Remove` · `Reading…` · `Ready · 1 passage` · caption `Hours change? Change the document. The next call gets the new answer.` [key **the new answer** in sunday]
**Voice:** kb2-vo-7 at ≈62.25
**Sound:** caret click, a selection tick and keystrokes for "16:00". A soft click as the menu opens, then the button press. A tick-roll under `Reading…`. **The fifth Ready mallet, E5 (the octave), lands on the beat with "the new answer"** and completes the phrase begun in b08. HITS: caret, keys, menu, press, Ready (phrase end).

*As built (critic fix round, build B):* b12's page recedes (.9, shade) and eases out left, gone before the file eases in (opacity over 4 frames) with its words rising inside it — two white cards never overlap, the paper is never empty; the pointer, hidden since Save, comes back as an I-beam on the settled page and drags across `14:00` a 16th before "change?" (two 16ths); `16:00` types in place (no travel), the selection gone on the first key's frame, the edited line set by the browser in the line's own flow (identical spacing to b14's `Saturday · 9:00–16:00`). The app rises on Knowledge behind the file during the keys; a 16th after the last key the file steps up into its corner (16:9: up first, across after — 80 px under the top, clear of the panel; 9:16: across first, up after — past Ava's orb), the pointer returns as an arrow to the row's … (pressed five 16ths after the last key), and once the menu is drawn hops at its natural pace into the right-hand padding of `Replace with new file` (the label stays readable). The flight brings the row's own face in (never an empty box in the list). b14: the row narrows and opens downwards into its page in one move, the page's lines revealed by the paper's moving bottom edge; the sweep (b10's band) runs on her "Saturday" and holds lit through "from nine till four."; "four." takes a bright pluck on E6 as a key hit; the L-cut is 24 frames from under "nine till four.", both pictures moving 40 % of the frame on one sine curve under a constant soft edge (≤ 13 px / 120 fps frame of content, ≤ 34 px for the edge). The Knowledge tab click (CLIENT DIRECTION v2 §2) is not shown: the app comes back already on Knowledge, behind the file — no room in vo-7 for a natural-speed click without rushing the menu hop.
*Polish pass:* the hand-off from b12 is one continuous move — the page recedes and eases out left (sliding on out at its exit speed) while the file eases in OVER it (its paper opaque within 2.5 frames, so text never fades over text for more than a frame) and the page fades out beneath it: one card or the other is on screen in every frame (the old hand-off left ≈ 3 frames with neither). *9:16:* the app's sheet comes in from the right over the file, along its own band, instead of climbing from under the frame through the caption "Change the document."

### b14 · The next call · 67.0–73.0
**Picture.**
- The menu and rows step back. **67.0 (beat 3):** a slate hairline ring leaves the orb; pickup at 67.25.
- `● CALLER` `Quick one. Can I pop in on Saturday?` is **Dana's exact recording from the desk**, shown with a meta tag **`SAME QUESTION`** beside it.
- `● AVA` `You can! We're open Saturday from nine till four.` On "four" the page's new line `Saturday · 9:00–16:00` takes the ink sweep.
- **72.75:** L-cut. The frame starts crossing back to the desk under her last word.
- *16:9:* captions x 160–900, y 300–700 (with `SAME QUESTION` at the caller label's right); page x 980–1760, y 220–700.
- *9:16:* `SAME QUESTION` y 290; captions y 330–760; page y 860–1300.

**On screen:** `● CALLER` `Quick one. Can I pop in on Saturday?` `SAME QUESTION` · `● AVA` `You can! We're open Saturday from nine till four.` [key **nine till four** in sunday] · `Saturday · 9:00–16:00`
**Voice:** kb2-c2, a **replay of the identical file** from b03, at ≈67.375 · kb2-call-3 (Ava, in-call) at ≈70.0
**Sound:** one chirp, then the click. Dana on the phone chain (same file, same EQ). Ava on the in-call path. The bed lifts with a high piano line, and a bright pluck lands on "four" with the sweep. HITS: 67.0 ring, 67.25 pickup, sweep on "four".

---

## PART IV · WORK THAT MATTERS

### b15 · Work that matters · 73.0–78.0
**Picture.**
- Back to the desk from b01: same framing, same paper. The clock reads `WED 09:14`, another morning and a rhyme with ring one. **Its colon is now Ava's small teal dot** (`MeshOrb`) instead of the rose line light.
- The pad is empty, and the old slip stack sits at the desk's edge.
- The in-person card sits at full depth, centred, and its sentence finally completes: **`nervous.`** rises at 73.0. Below it, `● FRONT DESK` and the staff reply as a caption (caption role, graphite).
- **74.5:** the line rings once. The teal colon sends one hairline ring, and before a second chirp a label rolls in under the clock: `AVA · ON A CALL`.
- **The in-person card does not move.** The missing motion is the payoff.
- From the end of the staff line until vo-8: at least one full bar of room tone (judge fix). Nothing moves except the colon's breathing.
- *16:9:* the b01 layout.
- *9:16:* clock y 280–420; `AVA · ON A CALL` y 440; card y 480–1040; staff caption y 1100–1260.

**On screen:** `WED 09:14` · `LINE 1` · `AVA · ON A CALL` · `● IN PERSON` `First session since my injury, and I'm a bit nervous.` · `● FRONT DESK` `That's completely normal. We'll take it slow.`
**Voice:** kb2-desk-2 (Leo, full-band, close) at ≈73.5
**Sound:** the bed drops to room tone and one warm sustained pad. Leo, unhurried. Under him the trill is ducked −14 dB and cut after one chirp by Ava's soft pickup tone (her arrival "ting", very quiet). Then a bar of room tone. HITS: 73.0 "nervous.", 74.5 ducked ring, 74.75 label.

### b16 · Only people · 78.0–82.0
**Picture.**
- A slow push toward the card (zoom 1.0 → 1.05). The `Title` sits over the desk's upper band (headline 100/92): `That's the work / only people can do.` The key phrase **`only people can do.`** eases into sunday ink as the glint runs through it.
- **On "do."** the old slip stack lifts from the desk's edge and glides off-frame toward the teal colon dot (`EASE.inOut`, sub-pixel layer). Every slip still reads "nine till two", which is now out of date.
- **80.5–82.0:** the paper darkens into night (`LightGround` crossfade from paper to `NightRoom` over three beats). The teal dot becomes the key light.
- *9:16:* title y 300–560 (3 lines); card y 640–1150; slips leave to the right.

**On screen:** `That's the work only people can do.` [key **only people can do.** in sunday]
**Voice:** kb2-vo-8 at ≥ 78.25 (at least 2.0 s after the desk line ends)
**Sound:** the bed returns fuller (strings and piano) with a gentle lift. A soft paper slide as the stack glides away. The drop into the dark lands on 82.0.

*As built (matters fix pass, b15–b16 at 81.0–90.0 s on the 100 s cut):* the ground is Part I's `MUTED_MESH` keyed on her teal colon the way Part I was keyed rose — a visible sunday tint pool at the dot (its light pool pulled toward it, ≈ .12 of tint at rest, a pulse on the ring and the pickup, growing across b16), the mesh breathing (drift × 1.4, clocks × 1.2). b15's ring sits 8 dB under the desk rings (not 14: at −14 Leo's "normal." masked it) and her pickup ting is a key hit. b16: the clock's figures and labels leave up before vo-8 in both orientations (her dot stays); on "That's" the desk steps back (Part I's step back, SPRING.site: card, reply and paper to .84, a .06 shade, the reply dimmed; the paper rises a little to keep its bottom margin) and the thesis takes the frame — the display role a step up (16:9 144 px, a clean left block at x 160, caps 120 px under the top, 80 px over the card; 9:16 three lines at 120 px). A beat's fifth after "do." the slips lift and glide off one after another (2.25 f apart, 8 f each, `EASE.inOut`) on an arc up toward the teal dot and out of the frame (16:9 over the top edge past the dot, clear of the thesis; 9:16 out through the right edge, rising), shrinking to .8 — all gone by 88.9 s — with one long glide sound (`fx-slip-glide`) that swells with their speeds and peaks where the cascade is fastest. The dark is a CLOSING KEY, not a dissolve: the room's light is pulled in from the frame's far edges onto the dot (a deep soft vignette); the desk goes into silhouette pixel by pixel with the ground (type first, by opacity); the lit core gives way to the night's own teal key pool; the thesis is cut along the half-light contour — ink where the room is lit, the night's type (paper, her teal on dark) where the dark has reached it — so it stays lit, the last thing standing, and leaves up through its masks over the last 10 frames, landing on b17's first picture.

---

## CLOSE

### b17 · Your answers · 82.0–86.0
**Picture.**
- Night room (`NightRoom`, keyed on the teal light, low floor sheen, `FilmGrain` dither on).
- Ava's closing line as the house two-tone heading (`Title`, headline role, `weightOnDark` 440): `Your answers. / Written once, there for every call.` The key phrase **`there for every call.`** is in `inkFor('sunday','dark')`.
- As the heading completes, the four orb lights arrive one at a time on 8ths from the corners, **sunday first** (hers), then rush, closing and night. They drift toward centre: `HeroGL` with `art = 0`, the scene's single WebGL context.
- On the converge (≈85.0) the heading leaves up through its masks word by word (film 1's converge idiom).
- *9:16:* heading y 560–900 in 3 lines (`Your answers.` / `Written once,` / `there for every call.`).

**On screen:** `Your answers.` · `Written once, there for every call.` [key **there for every call.** in sunday on dark]
**Voice:** kb2-vo-9 at ≈82.25
**Sound:** **the rings come back as music.** The Part I trill pitches (G#, B) plus E, two octaves up (E6, G#6, B6), play as a soft resolving glass arpeggio on 8ths under the heading. Then come the four light chimes (film 1's end-card chime family, re-cued, sunday first), a converge swell and the inhale. HITS: four light arrivals on 8ths, converge.

### b18 · End card · 86.0–90.0
**Picture.**
- **86.0, bar 44: impact.** The four lights merge into the **filled luminous backlight**, and the **NEUROVOICE** wordmark (Inter Tight 500, −0.07em, `WORDMARK_INK`) surfaces letter by letter from the centre out.
- **86.5:** Ava's sign-off. `neurotechvoice.com` types on her words (neuro | tech | voice.com).
- **On "Voice.":** the site's **`Start free`** button rises.
- **88.0:** `5 free minutes, no card`.
- **88.5:** the button takes its hover (plum) and presses at .97. A still hold follows until 90.0, with the picture fading with the master fade from 89.0 to 90.0.
- 16:9 and 9:16 use film 1's end-card geometry and 9:16 safe zone.
- **Build route:** because the headline differs from film 1's, this is the pipeline plan's §7 *fallback* route. It is a film-2 Cta built from the timing-free parts (`EndCard` Wordmark/StartFree/Note/Url, `Headline`, `HeroGL`, `heroShader`, `orbPass`) with a `CTA2_LOCAL`, not film 1's `Cta` mounted as is.

**On screen:** `NEUROVOICE` · `neurotechvoice.com` · `Start free` · `5 free minutes, no card`
**Voice:** kb2-brand at ≈86.5 (`MIX.name.voice`)
**Sound:** the impact on 86.0, with momentary loudness at least dialogue max + 1 LU (as check-mix asserts). The letter shimmer is a sound, not a glow. Ava's sign-off is clean, with URL keys on her words, the button rise and a press click at 88.5. The held E major chord rings out into an exponential master fade below −60 dBFS at 90.0. **Master:** voices + bed + film 2's CUES through film 1's unchanged `master()`. `DUCK` comes from film 1; −15.5 LUFS integrated, ceiling −1.5 dBTP.

*As built (critic fix round, build B, b17–b18 on the 100 s cut: 90.0–100.0 s):* the close opens out of b16's dark into **a violet room** — the deep INK_MESH graded to a floor ≈ #20004b with a third of the mesh's lift (the lower-right pool a deep violet, never crushed to black), its pools drifting a little wider and quicker, her teal pool the key; it comes up C¹ from the cut, a third of the way by frame 8 (white heading ≥ 10.6:1, the teal key phrase ≥ 9.3:1 on it). **The four lights are emitters**, not orbs: a white-hot core (Ø 9 px at 1080) in a thin hot halation and a tight bloom of its own colour (σ 13 px, peak ≤ .6), no surface, no specular; b16's dot settles into her point of light as the room comes up and springs open on her 8th; at the merge the colour is only in the bloom and the four-hue rim round her core. **The click** runs button → note → hover → press: `5 free minutes, no card` an 8th after the button (a word every 2 frames, in by 98.1 s), the pointer crossing in from off-frame right at 98.08 s as its last word lands, the plum hover from ≈ 98.3 s (the label stays ink until paper reads better on the plate, then switches — never a washed-out label), at rest 4 f before the press, which lands a 16th after the beat (98.63 s), released 3 f later. The four light arrivals are trimmed per light (night's pop at its own pitch) so their own energy sits within ±1 dB, hers first not the quietest.

---

## Voice roster (19 generated lines, plus 3 replays of existing takes)

| Role | Voice | Chain | Lines |
|---|---|---|---|
| ava | Cartesia **Tessa (Emotive)** `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`, sonic-3.6, speed 1.05 | full-band. Narrator path for vo-1…vo-9 and brand; in-call path for call-1…call-3 | 13 |
| desk | Cartesia **Leo** `0834f3df-e650-4766-a20c-5a93a43aa6e3` (masculine, verified with GET /voices in `voice-candidates/README.md`) | full-band, close; never phone EQ | 2 (desk-1 is played three times as the identical file) |
| caller | **Kyle (Emotive)** `c961b81c-a935-4c17-bfb3-ba2239de8c2f` | phone line | 1 |
| caller2 | **Dana (Emotive)** `cc00e582-ed66-4004-8336-0175b85c85f6` | phone line + film 1's presence EQ | 1 (replayed identically in b14) |
| caller3 | **Marian** `26403c37-80c1-4a1a-8692-540551ca2ae5` (mature feminine, verified in `voice-candidates/README.md`) | phone line | 1 |
| caller4 | masculine. `cartesia.id` is left empty so the generator auto-picks one other than Kyle and Leo. Suggested pin: Daniel `47c38ca4-5f35-497b-b1a3-415245fb35e1`, listed as masculine in `lib/voice/voice-map.ts` (verified 2026-09-17). | phone line | 1 |

The lines are in `trailer/out/kb-plan/voice-lines-kb.json`, in the format of `scripts/voice-lines.json`. Install it as `scripts/voice-lines-kb.json` per the pipeline plan.

## Line sheet (film order)

| # | id | voice | say | emotion | est s | at (target) |
|---|---|---|---|---|---|---|
| 1 | kb2-c1 | caller | Hi! Are you open on Saturdays? | curious | 2.1 | 2.625 |
| 2 | kb2-desk-1 | desk | Yes, Saturdays, nine till two. | content | 1.9 | 4.875 / 10.0 / 14.125 |
| 3 | kb2-c2 | caller2 | Quick one. Can I pop in on Saturday? | happy | 2.5 | 7.375 / 67.375 |
| 4 | kb2-c3 | caller3 | What are your weekend hours? | calm | 1.8 | 12.25 |
| 5 | kb2-vo-1 | ava | You hired someone brilliant. The phone turned them into a recording. | calm | 3.6 | 18.25 |
| 6 | kb2-vo-2 | ava | And the customer in front of them? Waiting. | calm | 2.6 | "Waiting" on 24.0 |
| 7 | kb2-vo-3 | ava | Some work repeats. Some work matters. I'm Ava, an AI that answers your phone, and I'll take the first kind. | confident | 6.0 | 25.25 |
| 8 | kb2-vo-4 | ava | Give me your answers once. Your prices, your hours, your policies, pages from your website. That's your knowledge base. | content | 6.0 | 32.25 |
| 9 | kb2-c4 | caller4 | Are you guys around this weekend? | content | 2.1 | 40.375 |
| 10 | kb2-call-1 | ava | One moment, let me check. | calm | 1.5 | 42.625 |
| 11 | kb2-vo-5 | ava | When someone calls, I find the part that answers them, even when they put it differently. | confident | 4.6 | 44.75 |
| 12 | kb2-call-2 | ava | We are! Saturday from nine till two. Sundays, we're closed. | happy | 3.2 | 50.25 |
| 13 | kb2-vo-6 | ava | If it isn't written down, I say so, in the words you chose. | calm | 3.8 | 58.0 |
| 14 | kb2-vo-7 | ava | Hours change? Change the document. The next call gets the new answer. | confident | 3.9 | 62.25 |
| 15 | kb2-call-3 | ava | You can! We're open Saturday from nine till four. | enthusiastic | 2.8 | 70.0 |
| 16 | kb2-desk-2 | desk | That's completely normal. We'll take it slow. | sympathetic (fallback calm) | 2.6 | 73.5 |
| 17 | kb2-vo-8 | ava | That's the work only people can do. | content | 2.2 | ≥ 78.25 |
| 18 | kb2-vo-9 | ava | Your answers. Written once, there for every call. | confident | 2.8 | 82.25 |
| 19 | kb2-brand | ava | Neuro Tech Voice. | proud | 1.4 | 86.5 |

**Timing note.** The estimates use about 3.4 words/s for Tessa at speed 1.05, which is what film 1's takes measured (call-1: 18 words in 5.27 s; kb-2: 23 words in 6.13 s). Callers are estimated at about 2.8 words/s. If the real takes run short, give the time back as breath after b08 ("knowledge base") and b11 (the record row), never as dead holds inside caption windows. If they run long, the unvoiced b05 and the b08/b11 holds absorb it first. Keep the anchors in the grid table.

## Build notes (pipeline: `out/kb-plan/pipeline.md`)

- **Reused from film 1** (props only, never edited): `Title`, `Words`/`Label`, `ClockLockup`/Flick, `Waveform` (by props), `Card`/`elevation`/`ContactShadow`, `Seam`, `DisplayWord`, `Orb` + the Reader arrival pattern (copied with film-2 timings), `MeshOrb`, `Camera`/`Layer`/`camMotion`, `PaperRoom`/`NightRoom`/`LightGround`, `FilmGrain`, `layoutText`, and the CTA parts (`EndCard`, `Headline`, `HeroGL`).
- **Forked into `src/kb/`:** `Captions` (bound to film 2's `VOICE`/`vWord`), `TurnLabel` with an ink prop, and `useKbSceneFrame`.
- **New:** `SlipStack` (stack, fan to column, collapse into a row), `KnowledgePanel` (empty state, rows, pills, URL field, Add page, menu), `DocPage` with `InkSweep`, `MeaningLink` (hairline + midpoint tag), `WordReset` (layoutText re-set synced to word onsets), `FieldCard` (placeholder, word-on-16ths caret, focus ring), `RecordRow`, and `FlipWord` (same-word flip window).
- **New speaker ink** in `src/kb/theme.ts`: `desk` = graphite (desaturated, no chroma).
- **Bed:** `scripts/kb/bed.mjs`, 120 BPM, E major. The Part I one-bar loop is B–E felt piano. Part II–III use E – C#m7 – Amaj7 – B. The b10 stop-time is a held E add9. b17 has the ring-pitch arpeggio, and b18 ends on the held E chord.
- **Extras** (only if the library lacks them), all in `scripts/kb/sounds.mjs` → `public/kb/sfx/fx-*.wav`: `fx-trill` (G#4/B4 two-chirp desk trill), `fx-slip` (paper slap + desk thud), `fx-keys` (low-profile keystroke set), `fx-flap` (flip tick), `fx-mallet` (E major pentatonic, 5 notes), `fx-felttip` (sweep swipe), `fx-roomtone` (front-desk room tone; this replaces a third reverb).

---

## Must-fix and graft ledger

| From | Item | Resolution |
|---|---|---|
| J1 + J2 | "knowledge base" never spoken | vo-4 ends "That's your knowledge base."; the eyebrow lands on "knowledge" |
| J1 | "the AI on your phone" reads as a smartphone assistant | "I'm Ava, an AI that answers your phone" |
| J1 | Grid | ring one 2.0, hard stop 18.0 and "Waiting." 24.0 are all on bar lines. Rings sit on strong beats; the impact is on bar 44. |
| J1 | 9:16 b07 and b10 overcrowded | b07 9:16 drops the slip column and card. b10 9:16 shows the earlier phrasings one at a time. |
| J1 | The peak needs room | at least one full bar of room tone after desk-2 before vo-8 |
| J1 | Autopilot gag | written in deliberately: c3 asks "weekend hours", the identical "Yes, Saturdays…" plays, slip #3 lands crooked, half a beat of dead line |
| J1 | Flip window unspecified | it flips only to the same word, "repeats.", with a flap tick |
| J1 | b17 checks implied Ava took Part I's calls | removed. The close is the CTA headline. |
| J2 | "I'll take the Saturdays" implies covering shifts | cut. vo-8 is "That's the work only people can do." |
| J2 | "said every time" is an absolute | "Written once, there for every call." |
| J2 | b10 false "none in the document's words" | the hero link is "around this weekend", which shares no word with the page. The other phrasings are shown as phrasings only. c3 is rewritten to "weekend hours". |
| J2 | b12 three texts compete | the owner's line types under the bed alone, then Ava narrates. One text moves at a time. |
| J2 | Empty-state title shown with documents | it shows only while the list is empty and leaves as the first row exists. The card title is "Add knowledge". |
| J2 | ● AVA tag on narrator captions | narrator captions are untagged. ● AVA appears only in calls. |
| J2 | Voices unpicked | Leo (desk) and Marian (caller3) are pinned. caller4 is masculine, auto-picked, with Daniel suggested. |
| J2 | Replace mechanics | two rows: the old row stays Ready while the new row reads, then the old row leaves |
| J2 | Edits must look like the owner's own file | `Opening hours.txt` on plain paper, no app chrome |
| graft (empathy) | Collapse into one line | b08: the slips stack into one, which becomes the `TXT · Opening hours` row |
| graft (empathy) | One light, two meanings | the rose colon dot becomes Ava's orb and relights teal; in b15 the colon is her teal dot |
| graft (empathy) | AI disclosure in the record | the record row's first line is "Ava: … This is Ava, an AI assistant." (an excerpt of the greeting) |
| graft (demo) | Word re-set | b11: the swept lines re-set into her spoken caption |
| graft (demo) | Real filler before stop-time | "One moment, let me check." |
| graft (demo) | `MATCHED ON MEANING` and `SAME QUESTION` tags | b10 and b14 |
| graft (demo) | Score-tuned trill, Ready phrase, rings as music | trill G#4/B4; the Ready phrase's 5th note lands on "the new answer"; the ring pitches return two octaves up in b17 |
| considered, not taken | Demo's in-call miss with the owner's line | about 6 s longer, and it re-runs film 1's miss call (J1's main criticism of "demo"). The typed field plus narration keeps film 1's line as the link without repeating its scene. |

## Truth table: every product claim and its source

| # | Claim in the film | Where | Source |
|---|---|---|---|
| 1 | Ava is an AI that answers the business's phone | vo-3; record row "Ava: … This is Ava, an AI assistant." (excerpt; the greeting opens "Thank you for calling…", `greetings.ts:237–252`) | `lib/voice/prompt.ts:265` (AI, never claims to be human); `lib/voice/greetings.ts:245` (intro "This is {agent}, an AI assistant."); product summary (picks up the business's calls) |
| 2 | Some work repeats, some matters; the agent takes the first kind; "That's the work only people can do." | vo-3, vo-8 | `lib/pages/ai-agents.ts:149-150` ("Give your team its day back… the same five questions are handled end to end, so the people on payroll do the work only people can do"); `lib/pages/industries/veterinary.ts:259`. The staff member stays and is shown doing the in-person work; nothing says the product replaces staff. |
| 3 | "You hired someone brilliant. The phone turned them into a recording." | vo-1 | An argument, not a statistic. Consistent with `lib/pages/knowledge-base.ts:274` ("The questions your team answers ten times a day are already written down somewhere"). |
| 4 | "Give me your answers once. Your prices, your hours, your policies, pages from your website." | vo-4 | `lib/pages/knowledge-base.ts:28` ("Add your price lists, policies, FAQs and web pages once"); `:302-311` (Hours, location and access; Pages from your website); `components/agent/tabs/TabKnowledge.tsx:158` (empty state lists price list, opening hours, policies, FAQs as files or web pages) |
| 5 | "That's your knowledge base." | vo-4 | Feature name: `lib/pages/knowledge-base.ts` KB_META.title "Knowledge Base"; `components/dashboard/KnowledgeUploadDialog.tsx` ("Add to your knowledge base") |
| 6 | Dashboard strings shown verbatim: Add knowledge · Drop files here or choose them · Add page · Teach your agent about your business (empty state only) · Reading… / Reading page… · Ready · N passage(s) · Read again / Replace with new file / Remove | b08, b13 | `components/agent/tabs/TabKnowledge.tsx:258, 343, 301, 157, 493, 454, 602, 607, 214`. Passage counts are illustrative. |
| 7 | Accepted kinds shown: PDF, DOCX, TXT and a web page by address | b08 | `lib/knowledge/shared.ts` KNOWLEDGE_ACCEPT; `lib/pages/knowledge-base.ts` KB_FILES (PDF, DOCX, TXT, MD) and the URL route. No scans, images, spreadsheets, Drive or Notion are shown. |
| 8 | Sample documents and lines ("Monday to Friday · 8:00–20:00", "Saturday · 9:00–14:00", "Sunday · closed"; Price list, Cancellation policy, FAQ page) | b08, b10 | `lib/pages/knowledge-base.ts:76-118` (ROOM.docs, the site's labelled sample); the business is unnamed and illustrative (`lib/pages/home/credits.ts:17`) |
| 9 | "One moment, let me check." | b09 in-call | `lib/voice/greetings.ts:185` (English filler phrases); search_knowledge pre-tool speech (`lib/voice/tools/definitions.ts:57-66`) |
| 10 | "I find the part that answers them, even when they put it differently." / MATCHED ON MEANING | vo-5, b10 | `lib/pages/knowledge-base.ts:28` ("finds the part that answers them"), `:213` ("It follows what the caller means, not the words they happen to use"), `:260` ("matched on meaning"); `lib/knowledge/search.ts` (embeddings, MIN_SIMILARITY at `:18`). The hero example ("around this weekend" → Saturday/Sunday lines) shares no word with the page. |
| 11 | In-call answers are short, in her own words, and never mention documents | b11, b14 | `lib/voice/tools/definitions.ts:60` ("Answer only from those passages, in your own words… Never mention documents or searching to the caller"); `lib/pages/knowledge-base.ts:264-266` ("in a sentence or two — it doesn't read the document out"). The word re-set shows paraphrase; only the owner-facing record mentions documents. |
| 12 | Calls are transcribed; the call detail shows "Answered from your documents" with the document's name | b11 | `components/calls/CallDetailSheet.tsx:190-199` (SectionTitle `:192`); `lib/pages/knowledge-base.ts:383-386` ("Calls are transcribed…") |
| 13 | Field "When the answer isn't in your documents", with the default line as placeholder | b12 | `components/agent/tabs/TabConversation.tsx:312-318`; default line `lib/voice/prompt.ts:39` |
| 14 | The owner's line is the site's own example (also film 1's line) | b12 | `lib/pages/knowledge-base.ts:159` ("Said word for word: this is the business's own fallback line"); page header comment (the line is the customer's to write) |
| 15 | "If it isn't written down, I say so, in the words you chose." | vo-6 | `lib/voice/prompt.ts:152` (if nothing relevant comes back, say the owner's line exactly); `lib/voice/tools/knowledge.ts:34-38` ("Do not guess"); `lib/pages/knowledge-base.ts:362` ("Where your documents stop, it says so"). The helper text "never guesses" is not shown, and no line says "never". |
| 16 | "Hours change? Change the document. The next call gets the new answer." | vo-7, b13–b14 | `lib/pages/knowledge-base.ts:400` ("Change the document, and the next call gives the new answer"); Replace with new file (`TabKnowledge.tsx:604-608`) uploads a new document that replaces the old one, and the old one is removed server-side only once the new one is ready (`hooks/useKnowledge.ts:97-98, 157-171, 285-287`; `app/api/agent/knowledge/route.ts` replaces_document_id). The same rule holds for Read again (`TabKnowledge.tsx:564-568`). The edit is in the owner's own file: no in-app editor, no auto-sync. |
| 17 | It does not learn from calls; the new answer exists because the owner wrote it | b13–b14 (implied by the edit) | `lib/pages/knowledge-base.ts:465-467` ("Nothing a caller says is added to your knowledge base. To teach it something new, write it into a document.") |
| 18 | "Your answers. Written once, there for every call." | vo-9 | "Written once" = `lib/pages/knowledge-base.ts:28` ("…once"). "There for every call" = `lib/voice/prompt.ts:150-153` (the agent consults the documents before answering any business question on every call). A slogan about availability, not an accuracy promise; `knowledge-base.ts:392-393` still applies. |
| 19 | End card "Start free", "5 free minutes, no card", neurotechvoice.com | b18 | film 1 `trailer/src/scenes/cta/EndCard.tsx:250`; `lib/pages/knowledge-base.ts:511` and `lib/pages/ai-agents.ts:44` ("5 free minutes for 14 days · No card needed") |
| 20 | No statistics | whole film | The repetition is one staged day shown as paper height and clock times, with no counts or percentages. The site refuses circulating figures (`salons-spas.ts:245`, `insurance.ts:234`, `veterinary.ts:237`). |

**Never claimed:** learning, training or fine-tuning on calls or documents; website sync or self-updating; reading scans, photos or spreadsheets; unlimited documents or sizes; 100% accuracy or "never guesses"; instant updates in every case; replacing staff; the agent deciding its own fallback line; medical or other advice (the client's injury is handled by the person, and Ava says nothing about it); caller-record lookups; testimonials or a named customer.


---

## CLIENT DIRECTION v2 (2026-10-03) — overrides the rooms and UI notes above

The client, after reading the plan: *"For the colour palette use the gradient meshes for the background, the way they are on the
site; it has to be a monster trailer; you can also add the site's tabs, but with the animation done properly and the way the click
is pressed, etc."*

### 1. Grounds = the site's gradient meshes (not plain paper)
- Every act's background is the site's gradient mesh, built exactly like `app/globals.css` `.pp-mesh-flow` (five radial pools over the
  palette's floor colour `--m2`, pools at 26/24, 80/26, 76/80, 20/78, 50/52 with the palette's m4, m2, m0, m3, m1; softened and
  saturated ×1.35), plus the second looser counter-turning field `.pp-mesh-flow-b`, the lit shade `.pp-mesh-shade` and fine grain.
  The pools move independently like `components/site/home/mesh-flow.ts` (each pool its own element / layer), as a PURE FUNCTION OF
  TIME (no CSS animation), slow (the site drifts over 14 s / turns over 21 s). Reuse/generalise film 1's call mesh
  (`src/scenes/call/Mesh.tsx`) if it fits; it must be DPR-sized for 4K and cheap enough to render.
- Palettes come only from `components/site/home/palettes.ts`:
  `MUTED_MESH` (the site's "no answer" grey — the grind of Part I, with the rose line light as the only colour),
  `KB_MESH` = `HOME_KB_MESH` (the site's knowledge-base indigo → violet → lilac — Ava and the knowledge base, Parts II–III),
  `MOMENT_LIGHTS` (rush rose / closing emerald / sunday teal / night violet — moments, accents, the payoff),
  `INK_MESH`, `PLAN_LIGHTS`, `STUDIO_PANEL`. Mesh transitions between acts are designed (a palette crossfade or a pool hand-off on
  the beat), never a dissolve to grey.
- The white UI cards (panel, doc page, record row, settings card) sit ON the mesh like the site's product shots: real elevation,
  the mesh's colour in their shadows, legible type. Accent inks are re-checked against the new grounds (the art director chooses
  whether Ava's accent stays sunday teal or takes the KB mesh's lilac/violet; one accent per part still holds).
- The "no AI slop" rule still applies: the mesh is the site's material, crisp-edged UI on top, no bokeh, no glow soup, no
  random blobs.

### 2. Real app tabs, faithfully
- Use the agent page's real tab bar (`components/agent/AgentPageClient.tsx` + `components/ui/tabs.tsx`, line variant): labels
  **General · Conversation · Voice · Knowledge · Skills** with their lucide icons (Settings2, MessagesSquare, Volume2, BookOpen,
  Sparkles), h-11, inactive text at 60 %, active = font-medium + full ink + the 2 px underline (after: bottom −5 px) — rebuilt in
  the house type system at trailer scale, pixel-faithful in proportions.
- Use the app's real details as storytelling:
  - b08: the cursor clicks **Knowledge**; the Knowledge tab's count badge (`size-4 rounded-full bg-primary/15 text-primary`)
    appears and counts **1 → 2 → 3 → 4** as the rows land.
  - b12: the cursor clicks **Conversation**; while the owner types the fallback line the tab shows the app's amber
    **unsaved-changes dot**; **Save** is clicked and the dot goes away (the save tick). (b12 is one bar longer than the plan for this:
    the film runs 100 s.)
  - b13: back to **Knowledge**; the row's `…` menu opens and **Replace with new file** is clicked.

### 3. The cursor and the click, done properly
- A crisp vector pointer (and the I-beam over text fields), rendered DPR-sharp, with a soft contact shadow; hidden when nobody is
  interacting; it enters from off-frame or from its last position — never teleports.
- Movement: eased arcs (slight curve, ease-out deceleration, no linear moves, no overshoot), speed of a calm, expert user; it
  arrives a few frames before the click so the eye can read the target.
- Hover: the target reacts as the app does (tab text 60 % → 100 %, button hover colour) when the pointer enters.
- Press (on the beat or 16th the score gives it): pointer scales to ~0.9 and the target to 0.97 + a pressed shade for ~3
  timeline frames; release springs back; THEN the state changes (the tab underline slides to the new tab with a spring, the panel
  content swaps with a short masked transition, the menu opens from its trigger). A two-part click sound (down + up) lands exactly on
  press/release; keystrokes are per word on 16ths with a caret.
- At 120 fps all of it must be smooth by frame rate (sub-pixel glide layers for moving UI), never by blur.

### 4. Bar
"Monster trailer": every shot designed, every move motivated, every sound placed; the bar is a top-agency product film.
