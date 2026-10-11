# ig6 · concept "free": While you were out

Label `concept:free`. Written 2026-10-11 on `claude/remotion-trailer` (HEAD `9cb3bc8`). Planning only: this file is the only file written in the repo. No code, no voice, no Cartesia call, nothing committed.

**Read first:** `../STYLE.md` (the look, measured), `../RESEARCH-viral.md` (scenario S5, §5 facts, §8 hook runs), `../RESEARCH-product.md` (SAFE S1-S22, UNSAFE U1-U21). The other two drafts in this folder already take S1 (clock) and S2 (desk phone). This one takes **S5 "While you were out"** and rebuilds it for the style.

**Layout mock** (a geometry check, not the art): `scratchpad/ig6free/mocks_concept_free.png` shows frame 0, the pickup macro, the whole-slip reveal, the fields macro and the cover. It is drawn with the real faces (`ref6an/fonts`), with the safe zone in red, the TikTok rail in orange and the lockup box in blue. The scripts are `mock.py` and `measure.py` in the same folder, and the hook runs are `hooks*.txt`.

---

## 0. The reel in one table

| | |
|---|---|
| **Title** | While you were out |
| **Slug** | `while-you-were-out` → `neurotechvoice-ig6-while-you-were-out`. It uses the ig5 route (`src/ig/ig6`, `scripts/ig6`, a separate registry), so ig1-ig5 stay byte-identical. |
| **Why S5 over S4, S6 and S3** | It has the lowest truth risk of the four. The pad's three printed fields are the agent's own `take_message` fields (§9). It is also the closest translation of the reference after the clock, without being a clock:<br>• the reference's 2.5D paper look becomes real paper;<br>• the black hand with its hollow diamond tip becomes a black fountain pen whose nib is a hollow diamond;<br>• the dots on the arc become the perforation holes.<br>Why not the others:<br>• **S4** needs greetings in other languages, each with its AI disclosure (RESEARCH-product C7), and unspoken language names on a dial.<br>• **S6** hints at a hang-up statistic.<br>• **S3** is ig2's sibling. |
| **Length** | **28.0 s = 840 timeline frames at 30 fps** (14 bars at 120 BPM; 3360 render frames at 120 fps). Impact **f780** (bar 14 line), END **f840**. Fallback: 26.0 s (impact f720, END f780) if every take through `ig6-07` ends by f560 (§4.3). |
| **Hero object** | A classic **"While You Were Out" message pad**, drawn as flat 2.5D paper on white. Its moving part is a **black fountain pen** that nobody holds. |
| **Colour story** | **Black and grey:** the blank slips and the dry pen, meaning nobody took the call.<br>**Teal `#0A8AA8`:** the agent's ink. Teal first touches the object at the pickup (f240): the ink bead, then the tick, the writing and the pen's collar. The type's accent phrase is teal throughout, as the style requires. |
| **Palette** | Ground `#FFFFFF`. Ink `#0A0A0A`. Sentence tier and printed labels `#6B6B6B`. Hairlines `#D6D6D6`, `#E6E6E6` and `#222222`. The one accent is teal `#0A8AA8`; deep teal `#0E7490` is used only for dome shading. |
| **Type** | The STYLE §1.5 three-tier lockup: Instrument Sans 580 lead / teal **Cormorant Garamond Italic 600** accent / Instrument Sans 450 sentence tier at 32 px. Every lockup is **6 words or fewer**, and every word in it is spoken. |
| **Voice** | Tessa (Emotive), the series' voices block, on **every** on-screen line. **45 words** before the sign-off. |
| **Claims** | Only SAFE product lines (§9). **No statistic, no price, no booking, no minutes, no number tied to our speed.** |
| **End card** | `End6`, the white end card from STYLE §4.4. The fallback is `IgEnd` unchanged. |
| **Cuts** | One cut. |

**The reel in one breath.** A message pad, in macro. A phone rings, and a blank slip tears off the pad and drifts away. Then another, and a third. "Three calls while you were out. No names." The camera snaps into the empty fields: "Somebody needed something. Nobody wrote it down." The pen on the desk has not moved. One ring, and **the pen picks itself up**. Its nib lands in the empty ANSWERED box and a teal bead of ink blooms there, the first colour on the object. "Your AI receptionist picks up." The nib ticks the box: "Answered, from your words." The camera pulls back to the whole slip: "The rest, it writes down." The nib writes in teal: "A name. A number. A message." The filled slip tears off the pad, like the three blank ones did, but it **flies up and away**, delivered: "Your team gets the message." We push into the teal bead on the nib, and it opens into the send button: "Comment AGENT for the link." The bead stamps the full stop after NEUROVOICE, then sinks back into the pen as the pad slides in and the next blank slip starts to tear.

---

## 1. The hero object, in the STYLE.md grammar

### 1.1 Parts (slip-local units: 1 unit = 1 px at zoom 1; origin = the slip's top-left corner on the perforation line)

Flat fills, three greys at most, the one accent, hairline details. The soft long shadow (24, 48, blur 10, 7 %) falls on raised parts only and sits on a **non-rotating wrapper** (STYLE §5.3.3). A resting part gets a tight contact shadow (4, 8, blur 3, 12 %). A lift is sold by the shadow growing, never by perspective.

| Part | Geometry | Look |
|---|---|---|
| **Pad** | Slip 560 × 760, with 5 sheets under it (each offset (2.2, 3), `#E6E6E6` edge). The whole pad rotates −6° in every crop (a desk, not a scan). | white paper, `#DCDCDC` 1.5 px edge; the pad casts the long shadow |
| **Binding strip** | y −60 … −22, full width; it is part of the pad, so it stays behind when a slip tears | flat `#0A0A0A`: the pad's only black mass |
| **Perforation** | holes Ø 8 every 18 at y 0: the reference's dots on the arc, re-cast as the tear line | `#C8C8C8` |
| **Header** | "WHILE YOU WERE OUT": Instrument Sans 580 caps, 26 px, +0.12em, centred, baseline y 62; a 2 px `#222222` rule at y 86 | It is printed on the slip and spoken in the hook (§2). |
| **NAME / NUMBER** | label (Instrument Sans 520 caps, **12 px**, +0.08em, `#6B6B6B`) + a 2 px `#D6D6D6` underline to x 520; at y 140 and y 196 | They are the tool's `caller_name` and `callback_number` (§9). |
| **ANSWERED** | a 26 px square box (2.5 px `#222222`) at x 40-66, y 228-254, plus its label | It is empty on every slip until the agent ticks it. |
| **MESSAGE** | label at y 300. **No ruled lines.** Below it, the slip is blank down to its bottom edge at y 760. | The blank lower 60 % is where the lockup sits in the macro crops (§1.2), as the reference's lockup sits on the white clock face. |
| **Pen** (k 1.12) | Width profile along the axis, measured from the tip (s, in px at ×1):<br>• tip 0-40 (w 4 → 14);<br>• **nib** 40-190: a **hollow lozenge** 70 wide at the waist (s 120) with concave sides (STYLE §1.2's curve), a 3 px slit from the tip into the hole, and a Ø 12 breather ring at the waist;<br>• neck 190-205 (w 24);<br>• **collar** 205-219 (w 50);<br>• grip 219-420 (w 44 → 50, slightly concave);<br>• barrel 420 and up (w 54), always leaving frame.<br>Drawn as one SVG path with an `evenodd` hole, like the reference hand. | `#0A0A0A`. The collar is graphite `#222222` at rest and **turns teal at the pickup**. The **ink bead** at the tip is the STYLE §4.3 **teal dome** (Ø 30; `#052A33` rim → `#0E7490` → `#0A8AA8` → `#A5EAF5` highlight at 30 %, 30 %): the series' orb, flattened. |
| **Ink** | Monoline teal strokes 4.5 px with round caps:<br>• a **tick** (two strokes);<br>• a **name scribble** on NAME;<br>• a **number scribble** on NUMBER;<br>• **two message lines** under MESSAGE (y 344 and 392). | Cursive-like loops, **with no legible letters or digits** (no unspoken words, no invented caller), drawn on with `strokeDashoffset`. The nib tracks the draw head. |

**Pen poses:**
- **Rest** (b1-b3): lying on the desk, nib up and to the right, barrel to the lower left, contact shadow, **dry** (no bead). The stillness says that nobody is here.
- **Writing** (b3-b7): lifted about 50 px (long shadow), barrel to the lower right at about 24° below horizontal, as a right hand holds it. It never crosses the lockup box.

### 1.2 Crop library (camera = a slip point → a screen anchor, zoom, plus the pad's −6°)

| Crop | Slip point → screen, zoom | In frame | Lockup sits on | Used in |
|---|---|---|---|---|
| **P0 Pad corner** (frame 0) | slip (0, 0) → (430, 60), ×1.25 | The pad is cropped by the top edge (binding) and the right edge (slip x > ≈ 520). The header is 32 px caps. The rows and the ☐ box are visible, and the slip's bottom-left corner sits at about (530, 1005), with its shadow above y 1055. The resting pen's tip is at (296, 960) and its barrel leaves the left edge at y ≈ 1440. | the desk: lead x 360, baseline 1170 / accent x 345, baseline 1268 / tier baselines 1326, 1364 | b1, b3 (start), b7 |
| **P2 = P3 Box macro** | box centre (53, 241) → (360, 400), ×2.6 | NAME and NUMBER rows (labels 31 px), the box (68 px), the ANSWERED label (31 px), the MESSAGE label at y ≈ 553. The header is above the frame. Blank paper runs from y 600 to the slip's bottom edge at y ≈ 1750. | blank paper (x 300-900, y 1110-1370) | b2 (blank slip, no pen), b3-b4 (pickup) |
| **P4 Box tight** | box centre → (400, 520), ×3.4 (a ×1.31 snap punch-in from P3) | The box is 88 px and the ANSWERED label 41 px; ANSWERED is **spoken in this beat**. | blank paper | b5 (the tick) |
| **P5 Whole slip** (the pull-back reveal, once) | slip (0, 0) → (300, 150), ×1.05 | The whole pad from above (the slip spans y ≈ 90-950), plus the pen in writing pose with its barrel leaving the right edge at y ≈ 560. The header is 27 px. | the desk | b5 |
| **P6 Fields** | slip (40, 140) → (150, 150), ×2.2 | NAME, NUMBER, the ticked box and MESSAGE. The writing runs from y 150 to y ≈ 705, and the header sits above the frame. The slip's bottom edge is at y ≈ 1515, below the tier. The barrel leaves the right edge at y ≤ 760. | blank paper | b6 |

**Rules held in every crop** (checked on the mock; the build proves them per frame, §11.4-5):
- No object stroke under the lockup box.
- Nothing at x > 880 below y 840 (the TikTok rail).
- **Printed slip words show above 32 px only in the beat where Tessa says them.** The header is said in b1. ANSWERED is said in b5. NAME, NUMBER and MESSAGE are said in b6. Everywhere else every printed word is 32 px or less (chrome).

---

## 2. The hook (f0-f112, 0-3.7 s; the 2-second window carries "Three calls while you were out")

### 2.1 Frame 0 (the picture)

- **P0.** Flat white ground. The pad sits upper right, cropped by the top and right edges. The pen lies still on the desk at lower left, its hollow-diamond nib pointing at the pad. **This is the reference's composition, with our object:** the black diagonal comes up from the lower left, the dotted line runs across the top, and the lockup sits in the white space.
- **Slip A is already 40 % torn.** The tear front is at slip x ≈ 340 and runs right to left at 42 units/f, so the slip is free on f8. The torn part hinges up to 2.5° about the front. There is **no teal on the object**.
- **Lockup L1 is set at 72 % ink** (the series' frame-0 set screen), scaled ×1.2 for the small-phone read:
  - lead **"Three calls."**: Instrument Sans 580, 72 px, 362 px wide;
  - accent ***No names.***: Cormorant Italic 600, 132 px, teal, about 486 px wide;
  - sentence tier "Three calls while you were out." / "No names.": 32 px grey, 442 px wide.
- **Camera:** macro drift is already on at f0 (+1.5 %/s about the box). The tear is moving. Nothing starts from rest.
- **Muted read in under a second:** a message pad tearing, an idle pen, "Three calls. *No names.*"

### 2.2 Text, voice, score

| | |
|---|---|
| **On screen (lockup, 4 words)** | **Three calls.** / ***No names.*** |
| **Sentence tier** | Three calls while you were out. / No names. |
| **Printed on the object** | WHILE YOU WERE OUT (32 px caps; spoken in this line) |
| **Spoken** (`ig6-01` @ f10, after the f0 ring peaks) | "Three calls while you were out. No names." (8 words, about 2.9 s; "while you were out" is heard by about 2.2 s) |
| **hookscore** (`python3 -I`, scratch copy; raw / patched) | **81.4 / 81.4 STRONG**: LENGTH 100 (8 words, ~2.9 s), SPECIFICITY 75 ("three"), STAKES 70 ("no"), FRONTLOAD 100 (payload at word 1), ADDRESS 100 |

**Alternates, scored in the same run** (`scratchpad/ig6free/hooks*.txt`):

| Hook (spoken) | raw / patched | Verdict |
|---|---|---|
| Three calls while you were out. Not one name. | 84.4 / 84.4 | **Reserve.** Higher score, but 9 words (3.3 s). `beats.py` flags anything over 8 words as landing "after the decision has been made". |
| Three calls on your receptionist's lunch break. Not one name. | 83.0 / 83.0 | **TikTok B, a week later, on the same body** (receptionist family: ig1 563 vs ≤ 283). It is 10 words (3.6 s), so it is long. Truth note in §10 (no takeover picture). |
| Your receptionist stepped out. Three calls. Not one name. | 65.2 / 80.8 | Reserve B. The raw score drops on the "Your" opener quirk. |
| Three calls while you were out. Nobody wrote them down. | 84.4 / 84.4 | Not used: it spends b2's line. |
| Three calls while you were out. Not one message. | 84.4 / 84.4 | Not used: it spends the payoff word "message". |
| Three calls. No names. No messages. | 59.6 / 59.6 | Not used: no "you" (ADDRESS 35). |
| You missed three calls. Who were they? | 54.8 / 54.8 | Not used: no stakes. |

Every hook above 80 is a tie (the scorer's AUC is 0.56 between good hooks). The choice rests on three things: it fits `beats.py`'s 8-word ceiling; the printed header and the spoken words agree, so the muted and sound-on reads match; and it is a scene, not a statistic. The body lines, scored as hooks, run 28-60, so the hook is the strongest line in the script.

**Series flag:** ig5 opened "Three rings. Gloves on. You can't." Ours opens "Three calls." It is a different noun and a different picture, and no "You can't". The judges decide whether "Three…" reads as a motif or a repeat.

---

## 3. Beat sheet (28.0 s, 840 f at 30 fps, 120 BPM: beat 15 f, bar 60 f)

Frames are plan targets. `src/ig/ig6/timing.ts` re-anchors every line on the measured takes (`place` / `upBeat`, 6 f gap, snap to the next 16th), as ig1-ig5 did. Act boundaries, the pickup bar, IMPACT and END stay on their bars.

**Acts** (`SCENES`): `hook` 0-112 · `blank` 112-212 · `pickup` 212-315 · `answered` 315-450 · `fields` 450-555 · `sent` 555-645 · `cta` 645-780 · `brand` 780-826 · `seam` 826-840.

**Type grammar** (STYLE §2.4):
- **Lead:** 7 f mask rise, `EASE.expo`.
- **Accent:** 9-10 f slide + wipe, landing on its spoken onset (the shot's hit), teal from its first frame.
- **Sentence tier:** set at 72 % ink 2 f before her first word; each word lifts on its onset.
- **Exits:** 4-5 f, `EASE.in3`.
- One moving text at a time. Every lockup holds at least 15 f after it lands.
- The lockup is **screen-locked (k 0)**, so the object changes under it.

| Beat · frames · s | Picture: crop, camera, object | Type (lockup / sentence tier) | Spoken (id @ f) | Sound |
|---|---|---|---|---|
| **b1 HOOK** · 0-112 · 0.0-3.7 | **P0.**<br>• Slip A finishes its tear (f0-8), lifts (shadow (24, 48, 10, 7 %) → (40, 80, 16, 6 %), scale 1 → 1.03), slides (−760, −60) rotating −12° (`EASE.in3`) and is gone by f24. Its shadow crosses the resting pen.<br>• **Slip B** tears on f30 and slides f38-54. **Slip C** tears on f60 and slides f68-84. Torn slips stay above y 1050 (clear of the lockup).<br>• f84-106: slip D, blank, holds. Macro drift.<br>• The pen never moves. | **L1** set at f0: **Three calls.** / ***No names.***<br>Words lift on her onsets. The accent lands on "No" (≈ f82).<br>Tier: "Three calls while you were out." / "No names."<br>Exit f106-112 (lead → accent → tier, 2 f apart). | `ig6-01` @10 | **`fx-trill` f0** (the series desk ring; it peaks before f10).<br>**`fx-tear` (new, §11.7)** f0 / f30 / f60: −20 dB at f0, −26 dB under her words.<br>`fx-paper-lift` on each slide (−26 dB).<br>`fx-roomtone` floor. **No bed**: a quiet office.<br>`pop` + `sub` (−8 dB) on "No". |
| **b2 BLANK** · 112-212 · 3.7-7.1 | **f106-114 macro snap P0 → P2** (×1.25 → ×2.6, 8 f, `EASE.expo`, no overshoot), into slip D's empty fields: the bare NAME and NUMBER lines and the empty ☐ ANSWERED. No pen in frame.<br>Drift plus a slow 30 px/s slide along the empty NAME line.<br>**f168 snap punch-in** ×1.0 → ×1.3 about the empty box (8 f, `EASE.expo`). | **L2a: "Somebody" / *needed something.*** The accent (110 px, 692 px wide, x ≥ 190; there is no pen in P2) lands on "needed" (≈ f135).<br>**f168, on "Nobody", the lead swaps:** "Some" exits up through its mask (4 f), "No" rises (7 f), and "body" slides left 81 px (7 f, `EASE.house`). The accent swaps to ***wrote it down.*** (lands on "wrote", ≈ f180).<br>Tier (one screen): "Somebody needed something." / "Nobody wrote it down."<br>Exit f208-212. | `ig6-02` @120 (must end by **f204**) | `tap` on "needed" (≈ f135); `tap` on "Nobody" with the punch-in (f168).<br>`pop` + `sub` on "wrote" (≈ f180, bar 4). |
| **b3 PICKUP** · 212-250 · 7.1-8.3 | **f206-214 snap out to P0** (×2.6 → ×1.25, 8 f). The pen is still at rest.<br>**f212-224: near-silence.**<br>**f225: a ring.** **The pen picks itself up** (f225-235, `SPRING.pop`, ≈ 4 % overshoot):<br>• it lifts (contact shadow → long shadow; scale 1 → 1.06, nearer the camera);<br>• it swings from rest to the writing pose (barrel to the lower right);<br>• it glides until its nib hangs over slip D's empty box.<br>**f232-240: push-in P0 → P3** (×1.25 → ×2.6, 8 f, `EASE.expo`) about the box.<br>**f240 (bar 5 line): touch-down, on the bar.**<br>• The nib drops 6 px (shadow tightens to (8, 16)).<br>• **The teal ink bead blooms** in the box (Ø 0 → 30 on `SPRING.pop`, ≈ 6 % overshoot), the STYLE dome.<br>• The collar flashes graphite → teal in 4 f and stays teal.<br>This is the first teal on the object. | **No text f212-248** (1.2 s): the reel's one wordless beat (1.5 s or less, no voice). | none | `fx-roomtone` only through f224.<br>**f225 `fx-trill`** alone.<br>`whoosh-soft` under the lift and swing (peaks ≈ f231).<br>**f240 `fx-pickup`** (the click that answers: the pen is "picked up") + `fx-felttip-short` (nib on paper) + `fx-ting` −6 dB.<br>**The bed enters on f240**, the series 120 BPM felt-piano pulse in E: the music arrives with the agent. |
| **b4 PICKS UP** · 240-315 · 8.0-10.5 | **P3**, nib macro.<br>• The nib rests in the box on its bead; the pen breathes (±0.4°, 1.6 s period).<br>• Drift continues: P3 is a rare crop with the hollow-diamond nib about 330 px long.<br>• On "picks" (≈ f292) the pen lifts 8 px, ready to write; the bead stays on the nib. | **L4: "Your AI receptionist"** (lead rises f246) / ***picks up.*** (lands on "picks", ≈ f292).<br>Tier: "Your AI receptionist picks up."<br>Exit f309-315. | `ig6-03` @250 | `tap` on "picks" (the bar's big hit was the pickup). |
| **b5 ANSWERED** · 315-450 · 10.5-15.0 | **f315 snap punch-in P3 → P4** (×1.31, 8 f).<br>**On "Answered" (≈ f322): the nib ticks the box.** The short stroke starts from the bead (5 f), then the long one (7 f, `EASE.expo`). The tick is teal.<br>**f372-392: the pull-back reveal, once** (P4 → P5, ×3.4 → ×1.05, 20 f, `EASE.inOut`). The whole slip and the pen show together for the first time: header, rows, a ticked box, blank fields.<br>On "down" (≈ f440) the pen travels to the NAME line start and lowers (shadow tightens). | **L5a: "Answered," / *from your words.*** The accent (110 px, 660 px wide) lands on "from" (≈ f340).<br>**L5b: "The rest," / *it writes down.*** lands on "writes" (≈ f420).<br>Tier, one screen across 5a/5b: "Answered, from your words." / "The rest, it writes down."<br>Exit f446-450. | `ig6-04` @322<br>`ig6-05` @396 | `fx-scratch` ×2 on the tick strokes (`-0`, `-1`).<br>`pop` + `sub` on "from" (bar 6).<br>`whoosh-soft` under the pull-back.<br>`pop` + `sub` on "writes" (bar 8 line). |
| **b6 FIELDS** · 450-555 · 15.0-18.5 | **f450 T1 tick cut to P6.** The pen's 24° diagonal holds its angle across the cut (the eye-trace anchor). The camera's focus trails the draw head with an 8 f `EASE.house` lag; the pen has parallax k 1.12.<br>• **On "name" (≈ f468):** a teal scribble writes along NAME (12 f).<br>• **On "number" (≈ f494):** a 4 f hop (`SPRING.land`) to NUMBER, then the scribble (12 f).<br>• **On "message" (≈ f524):** two message lines (14 f + 10 f).<br>Each stroke ends as a word ends. | **L6:** the lead slot shows "A name." (on "name"), then swaps to "A number." (on "number"; a 4 f out, 7 f in). The accent ***A message.*** (415 px) lands on "message".<br>Tier: "A name. A number. A message."<br>Exit f548-555. | `ig6-06` @460 | `fx-scratch` on NAME and NUMBER; `fx-felttip` under the message lines.<br>`pop` + `sub` on "message" (bar 9). |
| **b7 SENT** · 555-645 · 18.5-21.5 | **f555 T1 cut back to P0** (the pen's angle is again the anchor). Slip D is now filled and ticked in teal. The pen lifts away to hover over the slip's middle (f555-566).<br>**On "gets" (≈ f588): the filled slip tears** along the perforation (8 f; same motion as the hook), lifts, and **flies up and to the right**, off-frame (14 f, `EASE.in4`, rotation +10°). It is delivered, not drifting. Blank slip E is underneath.<br>**f610-625: breath.** The pen hovers over a blank slip with its teal bead.<br>**f625-635: T2 push into the bead** (×1 → ×16, 10 f, `EASE.in4`). **f635 is one frame of flat teal.** | **L7: "Your team" / *gets the message.*** The accent (636 px at 110) lands on "gets" with the rip.<br>Tier: "Your team gets the message."<br>Exit f620-625. | `ig6-07` @566 | **`fx-tear`** at full level + `pop` + `sub` on "gets" (bar 10).<br>`swish` peaking on the slip's fastest frame (≈ f603) + `fx-paper-lift`.<br>`whoosh-rev` peaking on f635. |
| **b8 CTA (`End6`)** · 645-780 · 21.5-26.0 | **f636-648: End6 opens out of the send disc** (teal, ×16 → ×1, 12 f, `EASE.expo`).<br>**f648:** the comment field rises around it: a white pill x 174-906, y 940-1060, r 60, a 1.5 px `#E6E6E6` border plus the long shadow; message-circle icon `#0A0A0A`; caret.<br>AGENT types one letter per 16th from her word "AGENT" (Instrument Sans 600, ink). The disc presses (.97) as "link" ends.<br>Hold to f780. | **L8: "Comment" / *AGENT*** (centred on x 540, lead baseline ≈ 760, accent ≈ 835).<br>Tier: "Comment AGENT for the link." (baseline ≈ 885, 435 px). | `ig6-08` @660 (ends by **f765**) | The series end stack, `endHits`: `fx-menu-open`, `fx-keys` ×5, `fx-click-down` / `-up`.<br>`thump` on the f636 open.<br>Snare roll f750-780; the riser crests. |
| **b9 BRAND** · 780-826 · 26.0-27.5 | **Impact on the bar line (f780).** The field and lockup leave up (4 f). The send disc flies to the wordmark's end and **stamps** as its full stop (1.12 → 1, with its own shadow). **NEUROVOICE** surfaces centre-out (Inter Tight 500, −0.07em, 760 px or less, y 760-900, `#0A0A0A`). **No GL bloom.** `neurotechvoice.com` (Instrument Sans 450, 34 px, `#6B6B6B`, y ≈ 1000) types in three chunks on "Neuro \| Tech \| Voice". | wordmark + URL | `ig1-07` @784 (the series' one borrow) | `impactHits(780)`: `riser`, `fx-impact-end`, `thump`, `slam`. |
| **b10 SEAM** · 826-840 · 27.5-28.0 | §5 | L1 set at 72 % by f839 | none | `MIX.fadeOut` [826, 840] to below −60 dBFS. The replay's first sounds are f0's ring and tear. |

**Muted read, beat by beat:**
1. A pad of message slips; three blank ones tear off and drift away; "Three calls. *No names.*"
2. Empty fields, huge; "Somebody needed something. Nobody wrote it down."
3. The pen picks itself up; a teal bead lands in the empty box.
4. "Your AI receptionist *picks up.*"
5. A teal tick in ANSWERED; "*from your words*"; the whole slip; "The rest, *it writes down.*"
6. Teal writing fills NAME, NUMBER and MESSAGE; "A name. A number. *A message.*"
7. The filled slip tears off and flies up; "Your team *gets the message.*"
8. The comment field types AGENT, then NEUROVOICE with a teal full stop.

**Retention:** before the end card, something lands on every beat:
- a tear or a slide;
- a word lift or a lockup landing;
- the swap;
- a snap or a punch-in;
- the ring, the lift, the touch-down;
- the tick, the reveal, a stroke;
- the rip, the fly-off, the push.

Nothing on screen is static for more than 1.0 s. The pen's 7 s of stillness (b1-b3) is the one deliberate stillness, and the camera drift keeps even that moving on screen.

---

## 4. Screens and voice lines

### 4.1 Screens (lockup words are a subset of her words, in her order)

| Screen | Lockup (6 words or fewer) | Sentence tier | Line |
|---|---|---|---|
| L1 (set at f0) | Three calls. / *No names.* (4) | Three calls while you were out. / No names. (8) | `ig6-01` |
| L2a | Somebody / *needed something.* (3) | Somebody needed something. / Nobody wrote it down. (7) | `ig6-02` [0-2] |
| L2b | Nobody / *wrote it down.* (4) | (same screen) | `ig6-02` [3-6] |
| L4 | Your AI receptionist / *picks up.* (5) | Your AI receptionist picks up. (5) | `ig6-03` |
| L5a | Answered, / *from your words.* (4) | Answered, from your words. / The rest, it writes down. (9) | `ig6-04` |
| L5b | The rest, / *it writes down.* (5) | (same screen) | `ig6-05` |
| L6 | A name. → A number. / *A message.* (6 at most on screen) | A name. A number. A message. (6) | `ig6-06` |
| L7 | Your team / *gets the message.* (5) | Your team gets the message. (5) | `ig6-07` |
| L8 | Comment / *AGENT* (2) | Comment AGENT for the link. (5) | `ig6-08` |

- **The sentence tier is shown on every screen,** even where the lockup already holds the whole line (L4, L7). That is the reference's signature: the big words, and under them their whole sentence.
- **The tier is 9 words or fewer, at most 2 lines, and at most 540 px wide** (measured widest: "A name. A number. A message." at 452 px). L5's tier spans two sentences, and that passes the series' 7-word caption cap (the clock draft has the same flag). If the judges hold the cap, split it at the sentence.
- **Printed slip words** (header, NAME, NUMBER, ANSWERED, MESSAGE) are object print. Each is spoken in the beat where it shows above 32 px (§1.2).

### 4.2 Voice lines (Tessa only; `speak` with no `<break/>`; the series voices block as in ig5)

| id | `say` | Words | Note |
|---|---|---|---|
| `ig6-01` | Three calls while you were out. No names. | 8 | Hook. Matter-of-fact, a small drop on "No names." |
| `ig6-02` | Somebody needed something. Nobody wrote it down. | 7 | One take. A light stress on "Some-" / "No-" (they rhyme on screen). |
| `ig6-03` | Your AI receptionist picks up. | 5 | The keyword line. Warm. |
| `ig6-04` | Answered, from your words. | 4 | A short comma pause. |
| `ig6-05` | The rest, it writes down. | 5 | |
| `ig6-06` | A name. A number. A message. | 6 | Even, list rhythm. Each noun is a pen stroke. |
| `ig6-07` | Your team gets the message. | 5 | The payoff. A gentle smile on "gets the message" (the idiom). |
| `ig6-08` | Comment AGENT for the link. | 5 | A fresh take; `speak` uses a lowercase "agent". |
| `ig1-07` | Neuro Tech Voice. | 3 | The borrow, byte for byte. |

**Alternates** (same batch):
- `ig6-01b` "Three calls on your receptionist's lunch break. Not one name." (TikTok B).
- `ig6-01c` "Three calls while you were out. Not one name." (if the measured take still ends by f100).
- `ig6-07b` "Your team gets it, by text or email." (more concrete, +3 words; only on the 28 s plan with spare).
- `ig6-08b` "The link's in our bio." (only if nobody can answer AGENT comments on posting day).

**45 words before the sign-off.** That is within RESEARCH-viral's 45-55 and STYLE's 60 or fewer.

### 4.3 Word-rate and anchors (Tessa: 2.78 words/s mean, 2.45 on dense lines; ig5 measured)

| Anchor | Rule |
|---|---|
| Ring 1 + tears | **f0 / f30 / f60, fixed.** No onset of hers within ±4 f of a tear's loudest frame (−26 dB anyway). |
| The pickup | **The ring** falls on the first beat at least 6 f after `ig6-02` ends. **The touch-down** falls on the next bar line or half-bar at least 15 f after the ring. Plan: ring f225, touch-down f240. If `ig6-02` ends after f219, the ring moves to f240 and the touch-down to f270. `ig6-03` starts at the touch-down + 8 f or later. **The text-free gap must stay 1.5 s or less**; if it would not, shorten the near-silence, never the lift. |
| Rip | The tear starts on the onset of "gets" (−2 f). |
| CTA | `ig6-08` starts at about f660 and must end by **f765** (impact − 15). |
| Plan at 2.78 words/s | `01` 10-100 · `02` 120-204 · `03` 250-310 · `04` 322-370 · `05` 396-452 · `06` 460-541 · `07` 566-620 · `08` 660-715. Spare: about 50 f before the CTA deadline. |
| At 2.45 words/s | +13 %, about +2.1 s overall. Holds absorb it (b7's breath and the CTA's spare). **Trim T1:** `ig6-02` → "Nobody wrote it down." (−3 words, −1.2 s; L2a and the swap go, and L2b enters directly). **Never cut** `ig6-03`, `ig6-04` or `ig6-06`. |
| 26.0 s cut | Only if `ig6-07` ends by f560 on the measured takes. The end card moves back one bar (impact f720, END f780), and nothing else changes. |

**`beats.py` (`--target 26`)** on `scratchpad/ig6free/script.txt`:
- "~17.8 s at 165 wpm": the rest is the planned air (the tears, the wordless pickup, the reveal, the rip, the end card).
- "Beats 3-5 have nothing concrete": the heuristic reads only text. The picture is concrete in each (the bead, the tick, the slip).
- "No loop": the real loop is the seam (§5). The series' last line is always the sign-off.
- The hook flag cleared once the hook was cut to 8 words.

---

## 5. The loop seam (f826 → f840 ≡ f0)

1. **f826-830:** the wordmark and URL leave up through their masks (4 f, `EASE.in3`).
2. **f826-836:** the teal full stop (the dome) glides to the frame-0 nib tip (296, 960), shrinks to Ø 0 and **sinks into the nib**: the ink goes back into the pen, which is dry at f0.
3. **f828-839:** the pen slides in along its own axis from the lower left into its rest pose (10 f, `EASE.house`), and its contact shadow fades in.
4. **f826-839:** the pad slides in from the upper right (from +(260, −180), 12 f, `EASE.house`) to the P0 framing, carrying blank slip A. **A's tear starts on f834**, moving at frame 0's speed, so at f839 it is one frame short of 40 %.
5. **f832-839:** L1 rises to 72 % ink.
6. **f840 = the replay's f0:** the ring, and the tear runs on.

The seam lands on frame 0's state **with its velocities**: the tear and the drift are both already moving. The last word heard is "Neuro Tech Voice."; the first is "Three calls". The story loops too: the agent's slip has gone, and the pad starts tearing off blanks again until someone picks up.

---

## 6. End card: `End6` (the NEUROVOICE wordmark in the white style)

Built in `src/ig/ig6/End6.tsx` from the `End.tsx` exports (`Wordmark`, `WORDMARK_FONT`, `WORDMARK_TEXT`, `END` geometry, `agentKeys`, `ctaLine`) and `impactHits` / `endHits`. **It never edits `End.tsx`.** Same spec as STYLE §4.4. Only the entry and the through-line are this concept's:

| Part | Spec |
|---|---|
| **Through-line** | The teal dome travels: ink bead on the nib (f240) → the tick's first stroke → the T2 push → the send disc → NEUROVOICE's full stop → back into the nib (seam). The agent's ink is the brand's full stop. |
| **Entry** | A T2 match cut: flat teal for 1 f (f635), then the end card opens out of the send disc (×16 → ×1). |
| **CTA lockup** | "Comment" (Instrument Sans 580, 64 px, ink) / ***AGENT*** (Cormorant Italic 600, 110 px, teal, 321 px), centred on x 540 in the series' CTA band (y 700-860). Tier "Comment AGENT for the link." at 32 px grey, baseline ≈ 885. |
| **Comment field** | `END.field` geometry (x 174-906, y 940-1060, r 60): the series' one zone exception, still about 40 px clear of TikTok's icons. White fill, 1.5 px `#E6E6E6` border, the long shadow. AGENT is typed in Instrument Sans 600 `#0A0A0A`. The send disc is the dome, Ø 72, flattened to `#0A8AA8`, with a white arrow. |
| **Impact** | `impactHits(780)` on the bar line. The disc stamps as the full stop and the letters surface centre-out. No `LightGL` bloom. |
| **Wordmark** | NEUROVOICE exactly as the series sets it, in `#0A0A0A` (or the brand plum `#1E0B38`, which reads the same on white). The full stop is the dome, baseline-aligned, Ø = x-height × 0.55. The letters are never altered. |
| **URL** | `neurotechvoice.com` (the series URL; changing it would re-render ig1-ig5), typed on "Neuro \| Tech \| Voice". |
| **Fallback** | `IgEnd` unchanged with `tone="pearl"`. It is series-true, but its teal bloom is a glow on white, which the style excludes. b7's push then ends with the bead shrinking into white, and `IgEnd`'s own field appears. |
| **Rejected variant** | The pen writing "AGENT" on a fresh slip instead of the comment field. It is more on-object, but it breaks the series' field-and-keys beat and AGENT's typed-per-16th rhythm. Noted for the judges only. |
| **TikTok** | TikTok has no keyword auto-DM, so its caption says "Link in bio" (RESEARCH-product §7). One master serves both apps. |

---

## 7. Cover

Custom PNG `IG6-Cover-9x16`, 1080 × 1920. All words sit inside x 86-900, y 260-1380, so they stay legible in the 3:4 grid tile. Every word is spoken in the reel. Mock: the right-hand panel of `mocks_concept_free.png`.

- **Picture:** frame 0's composition, drawn bolder for the tile: header 30 px, perforation Ø 10, pad shadow 9 %, slip D blank, the pen at rest. No teal on the object: the accent is the italic alone, which makes the promise.
- **Kicker:** `AI RECEPTIONIST · 06` (Instrument Sans 600, 28 px, +0.08em, `#6B6B6B`, 351 px), left-aligned with the lead at x ≈ 345, y 1050-1078. It carries the search keyword (spoken in `ig6-03`) and the series number.
- **Title lockup:** "Three calls." (80 px) / ***No names.*** (150 px teal, ≈ 515 px); accent baseline ≈ 1290.
- **Line:** "Three calls while you were out." (36 px `#6B6B6B`), centred under the accent, bottom at 1360 or above.
- **No** price, numeral, app UI or legible handwriting.
- **Alternate (IG grid A/B):** the payoff frame. The filled slip with the teal tick and writing, "A name. A number." / ***A message.***, and the same kicker. It reads as a finished thought in the grid. TikTok keeps frame 0 so that the tile and the autoplay agree.

---

## 8. Why it gets shared and rewatched on TikTok

1. **Everyone has held this slip, or wished someone had filled one in.** The "While You Were Out" pad is an office icon that front desks still use. "Someone called, no idea who" is a universal annoyance. Nostalgia plus a pain point is a comment engine ("we still have these at reception"). [K]
2. **The before and after are visible with the sound off.** Three blank slips tear and **drift away**; one filled, ticked slip tears and **flies up**. It is the same gesture with the opposite meaning, so a second viewing pays off, and the reel loops straight back into a blank tear. [K]
3. **"Somebody needed something. Nobody wrote it down."** is the line people send to a colleague. It blames nobody (the slip was blank because nobody was there), so the share is pro-staff, in line with ig1's stance. [K]
4. **Satisfying, sound-on micro-motion,** the trade of this style:
   - the perforation rip;
   - a pen lifting by itself;
   - the nib landing with a bead of ink;
   - handwriting drawing on;
   - a tick;
   - and their paper and nib sounds.

   This is a hypothesis: Live Science notes there are no dedicated studies of "oddly satisfying" video (RESEARCH-viral S11). The retention graph tests it. TikTok opens sound-on [P2].
5. **The magic beat is a pun you can see.** "Picks up": the pen is picked up by nobody, on the ring, on the bar line, after 1.2 s of near-silence. It is the reel's one wordless moment and its biggest hit.
6. **Concrete, checkable mechanics instead of hype.** The three fields are exactly what the agent asks for (§9). "What if it can't answer?" is answered on screen: it ticks what it answered and writes down the rest. That earns trust in the comments instead of "AI slop" replies. [K]
7. **Design-forward and faceless.** It reads as a motion piece, not an ad (RESEARCH-viral §2.2). Designers notice the nib that rhymes with the reference's clock hand, which is the reference's own comment engine.
8. **It loops on a tear.** The end re-forms frame 0 mid-motion. TikTok weights completion heavily [P1], and Instagram counts replays as views [S5].

**TikTok caption, first line** (the caption stage finalises it): "Missed calls with no names? An AI receptionist answers from your words and takes the message." Then "Link in bio. Start free: 5 minutes, 14 days, no card." Then a comment question: "Still got a pad of these at your front desk?"

**Prepared replies** (no claims beyond §9):
- "What if it doesn't know the answer?" → "It says so, then takes a name, a number and a message for your team."
- "Does it text me?" → "Your team gets the message by text or email, and it's in your Inbox."

---

## 9. Facts and claims it uses (nothing else)

| On screen / spoken | Grade | Source |
|---|---|---|
| "Three calls while you were out. No names." / "Somebody needed something. Nobody wrote it down." | **A scene, not a claim.** No %, no hang-up rate, no caller behaviour. | none needed. It avoids every UNUSABLE figure in RESEARCH-viral §5.3. |
| The slip's fields **NAME / NUMBER / MESSAGE** and "A name. A number. A message." | **A**, as the agent's instruction and its tool schema. The caller may decline a name (`caller_name` can be null; the notification then says "not given"). | `lib/voice/tools/definitions.ts:145-158` (`take_message`: "First collect the caller's name, callback number and message, and read them back"; `caller_name`, `callback_number`, `message`); `lib/voice/tools/messages.ts:51-58` ("Caller:", "Call back on:"). `take_message: true` on every plan: `lib/voice/session-loader.ts:240`. |
| "Your AI receptionist" | noun | RESEARCH-product S22 (never with "replace", "fire" or "instead of") |
| "picks up" | **A**, the core function on a paid plan with a number, by default always answering. **No speed and no "first ring".** | `lib/voice/router.ts:198-224`; RESEARCH-product S4 ("It picks up, day or night") |
| "Answered, from your words." + the ANSWERED tick | **A** | `lib/voice/tools/definitions.ts:57-60` (`search_knowledge`: "Answer only from those passages … if none is relevant, say you don't have that information"); `lib/pages/home/pricing.ts:67`; the knowledge base is on every plan (`lib/pages/knowledge-base.ts:496-497`). RESEARCH-product S6. |
| "The rest, it writes down." | **B: an instruction, not a guarantee** (the same grade as S7) | `take_message`: "Call it when nobody can help right now, the caller asks for a callback, or you cannot answer their question" (`definitions.ts:147-148`); `prompt.ts` rule "If you are not sure, say so." |
| "Your team gets the message." | **A**, on every plan including the trial (team alerts are not the caller-facing SMS). Not "instantly". | `lib/voice/tools/messages.ts:48-80` (text or email per contact, "also in the Inbox of your dashboard"); `lib/notifications/index.ts:13-15, 81-138`. RESEARCH-product S9, §2.6. |
| "Comment AGENT for the link." | **A**, **if** AGENT delivers the trial link and setup help | `voice.md` "The ask"; RESEARCH-product §7 |
| Caption: "Start free: 5 minutes, 14 days, no card." | **A**, trial only | `lib/site.ts:1812`; `lib/pages/ai-agents.ts:44` (S15, S16) |

**Not used, on purpose:**
- the ring cadence (F1);
- "first ring" (B);
- "every call written down" (true, but it would blur transcripts with message slips);
- "day or night";
- languages, prices, booking, texts to callers, recordings.

**Caption fine print** (paste-ready, from RESEARCH-product §8, plus one line):
> Free trial: 5 minutes over 14 days, no card needed. On the trial it answers your own test calls; to answer customers, the agent needs its own phone number ($1.15/month, card required). One agent per business, set to one of 14 languages. It tells every caller it's an AI. Messages reach your team by text or email and land in your dashboard Inbox.

---

## 10. Self-check

| Rule | Status | How |
|---|---|---|
| No invented statistic, result or testimonial | **PASS** | No number anywhere except "three" in a staged scene. No caller name is shown: the handwriting has no legible letters or digits. No customer story. |
| No number on our speed (U3) | **PASS** | No clock, no seconds, no "first ring", no "instantly". The ring-to-touch-down gap (15 f) is choreography with no reading on screen. |
| No takeover or forwarding picture (U5) | **PASS, by design** | The three blank slips are past calls. The agent picks up a **fresh** ring, and the slip it fills is a new one. It never "catches" one of the three. No "your line", "your number", "when you're out it takes over", "busy" or "forward". The fine print says the agent answers its own number. For the **TikTok B hook** ("…your receptionist's lunch break…"), the body stays the same and the caption repeats "its own number"; the B hook's risk is the implied coverage, and the judges decide whether to run it. |
| No absolutes (U1, U2) | **PASS** | No "never miss", no "every call". "The rest, it writes down" is scoped to what it can't answer. |
| No booking, price, minutes or plan names | **PASS** | One cut. Nothing tied to $49. The trial facts appear only in the caption. |
| Trial truth | **PASS** | Messages reaching the team works on the trial (no plan gate). The reel doesn't promise texts to callers (U: paid only). |
| Product scope | **PASS** | No language switching, no voice cloning, no recordings, no "sounds human". Tessa narrates; the reel never implies she is the agent's voice (no waveform, no "this is our agent"). The disclosure is in the fine print. |
| Instruction vs guarantee | **FLAGGED (B)** | "The rest, it writes down" and the name/number collection are prompt and tool instructions. They are worded as behaviour, never as a guarantee ("always", "never fails"). |
| No competitor | **PASS** | none |
| Series coherence | **PASS, with one flag** | Teal stays "ours". The receptionist appears only as "your AI receptionist", and the slip is the receptionist's own tool, honoured rather than replaced. The sign-off, URL, AGENT CTA and end-card beats are kept. **Flag:** "Three calls." opens like ig5's "Three rings." (§2.2). |
| Voice rule | **PASS** | Tessa speaks every lockup word and every tier word. Printed slip words above 32 px appear only in the beat where she says them. The one text-free beat (f212-248, 1.2 s) is also voice-free. L1 is set at f0, 10 f before her first word (the series' frame-0 rule). |
| 6 words or fewer per lockup; hook in 0-2 s | **PASS, one flag** | Lockups run 2-6 words. The hook card is readable at f0, and "Three calls while you were out" is heard by ≈ 2.2 s. **Flag:** "AI receptionist" is heard at ≈ 8.3 s, not ~3 s. It is on the cover kicker and in the TikTok caption's first line, and the B hook moves "receptionist" to ≈ 1.6 s. |
| Safe zone | **PASS by layout** | Lockups sit in x 190-900, y 1110-1370 (end card y 700-1060). Below y 840, objects stay at x ≤ 880. Checked on the mock; proved by an ig6 copy of ig5's `zones.ts` guard plus the overlap check (§11.4). |
| Reference originality | **PASS** | Different object, our own sentence, no watermark. The nib rhymes with the reference hand's hollow diamond but is a pen part. The composition (dark diagonal from the lower left, dotted line across the top, lockup in the white) is the style, not a copy of the frame. |
| Secrets | **PASS** | No key read or printed; no Cartesia call. |

---

## 11. Production risks (Remotion, no three.js)

1. **The tear in 2D.**
   - **Build:** a slip is one SVG group, clipped by a path whose top edge is the perforation scallop (half-holes). The tear front is a moving x; the freed part rotates up to 2.5° about the front, then lifts (scale plus a growing shadow) and slides.
   - **Risk:** with no curl (no 3D, no gradient strip allowed) it can read as a "slide", not a tear. The `fx-tear` sound and the scalloped edge carry it.
   - **Fallback:** a 2 f white gap line that opens along the perforation just ahead of the front.
2. **Handwriting that looks written, not like a sine wave.**
   - Hand-author 4 strokes once (traced from a real scribble to cubic Béziers, monoline, round caps) and keep them deterministic in `src/ig/ig6/ink.ts`.
   - Each stroke draws with `strokeDasharray` / `strokeDashoffset`. The nib tip tracks the draw head through a polyline length table (own code, or `@remotion/paths` `getPointAtLength`, which is importable but not declared in `package.json`).
   - **Check by eye that no stroke forms a legible word or digit** (unspoken text, and an invented caller).
3. **The pen.**
   - Rotation lives on an inner element; the `drop-shadow` sits on the non-rotating wrapper (STYLE gotcha), or the light would turn with the swing in b3.
   - The rest → writing swing is about 98°. Check that its shadow interpolation (contact → long) never pops.
   - The nib must read as a fountain-pen nib at f0 scale (about 150 px): test a muted read on a phone.
4. **Text over the object.** The zone guard checks text against the frame, not against object strokes. Render each act's anchor frames, mask the lockup box, and assert no object stroke or edge under it: only blank paper or desk.
   - **The danger frames:** the torn slips' slide paths in b1 (they must stay above y 1050), the bottom edge in P3 and P6, and the pen in P0 at f0 (its tip is clear of "Three" by about 45 px on the mock).
5. **Unspoken printed words.** Add a per-crop check that every printed slip word renders at 32 px or less except in its spoken beat (§1.2). This is easy to break with a later punch-in.
6. **Macro snaps at ×2.1** (b2 in and out, b3 push) are bigger than STYLE's ×1.3 punch.
   - They run 8 f with `EASE.expo` and no overshoot.
   - Check 60 fps strobing on the header and the ticks; slow to 10 f if needed.
   - The T2 push to ×16 into the bead: cull every layer but the bead past ×6.
7. **A new sound.**
   - The ig library has no tear (`public/ig/sfx/lib`: `fx-paper-lift`, `fx-paper-fold`, `fx-scratch`, `fx-felttip`, `fx-riffle` and others, but no rip). Synthesise `fx-tear` ig6-locally in `scripts/ig6/` from the `scratch()` impulse-train family in `scripts/kb/sounds.mjs` (lower band, about 0.18 s, slight downward sweep), so `public/ig/sfx/lib` and ig1-ig5 stay byte-identical.
   - **Fallback:** `fx-paper-fold` + `fx-paper-lift` layered.
   - `check-mix` must pass with paper sounds under her words (−26 dB, never within 200 ms of an onset at full level).
8. **Speed without blur at 60 fps.** The slide-offs move about 50 px per 60 fps frame; the b7 fly-off (`EASE.in4`) peaks at about 90. Check for strobing, and cap the fly-off at 14 f.
9. **Shadows and hairlines on white.**
   - Run STYLE §7.5's 2 s probe for banding in the 7 % ramps in the 60 fps upload.
   - The pad's `#E6E6E6` stack edges can shimmer at sub-pixel drift: use 2 px strokes, `geometricPrecision`, and layer transforms on divs.
   - Paper grain in `IgFinish` is set to 0.
10. **Fonts and widths** (measured on the real faces, `measure.py`):
    - *needed something.* 692 px at 110 (P2 has no pen, so the lockup starts at x ≥ 190);
    - *from your words.* 660 px;
    - *gets the message.* 636 px;
    - *No names.* 486 px at 132.
    - Cormorant Italic 600 loads from `src/ig/ig6/fonts.ts` only, and canvas measurement waits on `useIg6Faces()`.
11. **The "Some → No" swap.** It is three moving parts in one lockup for 7 f, which bends "one moving text at a time". **Fallback:** a plain lockup change (L2a out, L2b in).
12. **The seam.** f839 → f0 must match in position **and** motion (the tear front's speed, the drift, the pen at rest). Render a two-pass loop strip and diff the frames around the seam.
13. **New files on the ig5 route:**
    - `style.ts`, `fonts.ts`, `Camera.tsx` (one camera; planes: pad 1.00, pen 1.12, lockup 0);
    - `Pad.tsx` (stack, binding, perforation, tear);
    - `Pen.tsx` (path, bead dome, collar, poses);
    - `Ink.tsx` (strokes and draw head);
    - `Lockup.tsx`, `End6.tsx`, `Cover.tsx`, `timing.ts`.

    `scripts/ig6` gets the voices and `fx-tear`. Nothing in ig1-ig5 is edited.

---

## 12. Open decisions for the owner and the judges

1. **Pick this concept or the clock or the phone.** This one trades the reference's literal clock for the lowest truth risk and the most "satisfying" paper-and-ink motion.
2. **Hook:** "No names." (8 words, recommended) or "Not one name." (9 words, scores higher). Also whether to run the TikTok B hook (receptionist's lunch break) a week later.
3. **End card:** `End6` (recommended, with the ink-bead through-line) or `IgEnd` unchanged.
4. **Serif-italic exception:** the accent phrase only (STYLE §4.2).
5. **Sentence tier:** 32 px, up to 9 words (L5 spans two sentences), or split it to keep the series' 7-word cap.
6. **The "Some → No" swap** (recommended) or a plain change.
7. **28.0 s** (14 bars, recommended), with 26.0 s only if the measured takes run fast.
8. **Cover:** frame 0 (TikTok-matched) or the payoff alternate for the Instagram grid.
