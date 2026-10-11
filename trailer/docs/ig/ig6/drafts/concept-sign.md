# ig6 · concept "sign": The other side

Label `concept:sign`. Written 2026-10-11 on `claude/remotion-trailer` (HEAD `9cb3bc8`). Planning only: this is the only file written. No code, no voice, no Cartesia call, nothing committed.

**Read first:** `../STYLE.md` (the look, measured; the crop names M1/M5 and the motion grammar T1-T5), `../RESEARCH-viral.md` (scenario S3 "The sign", facts F1-F6), `../RESEARCH-product.md` (SAFE S1-S22, UNSAFE U1-U21). This concept rebuilds S3, which RESEARCH-viral ranked last. It adds a new hook (84.4 against S3's 77.8), a new idea (the inside face of the sign) and the clock beyond the sign, which gives it the reference's own picture.

**Layout mock** (geometry check only, not the art): `scratchpad/ig6sign/mocks.png` shows frame 0, the night clock, the "open" reveal, the house line, the full dial, the morning and the cover side by side. Each panel is drawn with the real faces. The safe zone is red, the TikTok rail orange and the bottom UI band blue. Larger copies are `f0.png` and `cover.png`; the scripts are `mock.py` and `measure.py`, and the hook runs are `hooks*.txt`, all in the same folder.

---

## 0. The reel in one table

| | |
|---|---|
| **Title** | **The other side** (slug `the-other-side`, out name `neurotechvoice-ig6-the-other-side`) |
| **One object** | A hanging two-sided door sign in flat 2.5D paper. Its front face says **CLOSED** in heavy black grotesk. Its back face says ***open*** in teal Cormorant italic. The sign *is* the type contrast the style is built on: CLOSED is always black sans, open is always teal serif italic. |
| **The clock beyond it** | A wall clock on a far depth plane, seen only when the camera looks past the sign. It is the reference frame exactly (STYLE M1): arc across the top, ticks, one black hand, hub. Its dots mean calls at night. It shares the sign's parts: the hub dome is the sign's nail dome, the dots are its eyelets, the hand is its cord. |
| **Angle** | You flip the sign to CLOSED at six. The phone doesn't close. Through the night the clock beyond the sign collects calls. Then the turn: **"The other side says open."** Every shop owner has seen it as they lock up: the face pointed back at them says OPEN. "Closed is for the door, not the phone." On a fresh night the teal hub picks up, and the dial fills with teal. In the morning the sign flips to open, and the loop flips it back to CLOSED. |
| **Hook (0-2.9 s)** | Picture: the sign landing mid-flip on CLOSED, swinging on its cord, with a ring on frame 0. Big type (5 words): **CLOSED** (the sign) + **Your phone's** / ***still open.*** Spoken: **"Closed at six. Your phone's still open."** hookscore **84.4 STRONG** (raw and patched). |
| **Length** | **28.0 s = 840 timeline frames at 30 fps** (14 bars at 120 BPM; 3360 render frames at 120 fps). Impact **f780**, END **f840**. Trim to 26.0 s (impact f720) by dropping line 6 (§5.3). |
| **Words** | **44 spoken before the sign-off** (+ "Neuro Tech Voice."). That is one under RESEARCH-viral's 45-55 band (the style wants air) and well under STYLE's 60. |
| **Claims** | Only SAFE product lines (§10). No statistic, no price, no booking, no minutes. No seconds or timer anywhere, so nothing can read as a pickup speed. The ring cadence (F1) is not used. |
| **Colour story** | Black and grey = closed: the CLOSED face, the night clock's grey rim, graphite hub and **hollow** dots. **Teal = open:** the sign's back face, the accent type, and on the agent's night the teal hub, the teal rim and **filled** teal dots. |
| **Voice** | Tessa (Emotive), the series' voices block, on every on-screen word, including both sign faces. One wordless beat (1.3 s) has no text and no voice. |
| **End card** | `End6`, the white end card from STYLE §4.4. The sign's nail dome travels to the send disc, then becomes the wordmark's full stop. The fallback is `IgEnd` unchanged. |
| **Cuts** | **One cut.** No booking, no price. TikTok B hook (receptionist family) is one swapped take (§1.3). |
| **Route** | ig5's separate-registry route (`src/ig/ig6`, `scripts/ig6`), so ig1-ig5 stay byte-identical. |

**The reel in one breath.** A white sign lands on CLOSED as a phone rings. "Closed at six. Your phone's still open." The camera slides past the sign to the clock beyond it. Its hand sweeps through the night, and each ring drops a hollow dot on the dial: "At eight. At ten. At midnight." The camera comes back to the sign, which turns over. Its other face, in teal italic, says "open". "The other side says open." The sign flips back to CLOSED on her word: "Closed is for the door, *not the phone.*" The camera climbs the cord to the nail's teal dome and falls through it into the clock's hub as a phone rings. On a clean dial the hub stamps, and teal runs round the rim. "Your AI receptionist picks up, day or night." The whole dial spins once and fills with teal dots. A whip: morning, and the sign flips to open. "It answers from your words." The sign lifts away and the dome becomes the send button: "Comment AGENT for the link." It stamps the full stop after NEUROVOICE, then flies back up to the nail. The sign swings in on CLOSED, and the replay starts on its ring.

---

## 1. The hook (0-2 s)

### 1.1 Frame 0 (the picture)

Mock: `f0.png`. Everything is in screen px at 1080 × 1920.

- **Ground:** flat `#FFFFFF`. There is no door frame or glass: the white is the door.
- **The sign** (shot S1):
  - **Card:** 1080 × 600, r 43, centred (490, 680) at rest, so the left edge is cropped by about 50 px.
    - The card is white on white. It reads through a 2.5 px `#D4D4D4` edge and the long shadow (24, 48, blur 10, 7 %) on the ground layer.
    - A printed inner border sits 36 px inside the edge: 5 px `#0A0A0A`, r 22.
  - **Face:** **CLOSED** in Instrument Sans wght 680, 150 px caps, tracking +0.06em, `#0A0A0A`, centred on the card. It is 661 px wide (x ≈ 160-821) with a cap height of about 108 px.
  - **Eyelets:** 95 px in from the top corners and 75 px down. Each is Ø 36 with a 7 px ink ring and a white centre (the reference's dots).
  - **Cord:** 5 px ink. It runs from both eyelets up to the nail at (490, −200), off-frame top. That gives two black diagonals at about 34° from vertical, so the object is cropped by the top and left edges.
- **Motion already running at f0:**
  - **Flip:** the card is mid-flip at rotateY θ = 25° (scaleX 0.906, a light keystone). It lands at 0° on f5, overshoots to −5° at f9 and settles on `SPRING.land` by f20.
  - **Swing:** the pendulum is at φ = +2.0° about the nail, damped (period about 33 f; under 0.3° by f90).
  - **Camera:** macro drift is already on (scale +1.5 %/s about CLOSED's centre).
  - So frame 0 is never a still.
- **Lockup, set at 72 % ink** (the series' frame-0 rule). It is scaled ×1.15 for the small-phone read and centred on x 540:
  - **Lead:** **Your phone's**, Instrument Sans 580, 69 px, `#0A0A0A`. It is 390 px wide, left-aligned 15 px inside the accent's left edge (x 346), baseline 1150.
  - **Accent:** ***still open.***, Cormorant Garamond Italic 600, 126 px, teal `#0A8AA8`. It is 418 px wide (x 331-749), baseline 1236.
  - **Sentence tier:** "Closed at 6. Your phone's still open.", Instrument Sans 450, 32 px, `#6B6B6B`, one line, 507 px wide (x 287-794), baseline 1300.
- **No teal on the object at f0.** The only teal is the italic "still open.": the phone's side.
- **The muted read in under a second:** a CLOSED sign, and directly under it, in a different voice, "Your phone's *still open.*" The contradiction is the hook.

### 1.2 Text and voice

| | |
|---|---|
| **Big type (5 words)** | **CLOSED** (the sign) · **Your phone's** / ***still open.*** |
| **Sentence tier (7 words)** | Closed at 6. Your phone's still open. |
| **Spoken** (`ig6-01` @ f10, after the f0 ring rings out) | "Closed at six. Your phone's still open." (7 words, about 2.5-2.9 s; "Closed at six" is heard by about 1.0 s) |
| **hookscore** (`python3 -I`, raw / patched) | **84.4 / 84.4 STRONG**. LENGTH 100 (7 words) · SPECIFICITY 100 ("six", "Your") · STAKES 70 ("still") · FRONTLOAD 100 (payload at word 3) · ADDRESS 100 |

**Scorer quirk, stated:** "Your" scores as a proper noun when it opens the second sentence, so part of SPECIFICITY is an artefact. "six" is the real marker. The scorer cannot separate hooks above 80 (AUC 0.56), so the choice below rests on the picture and the truth pass.

### 1.3 Alternates (same run, `scratchpad/ig6sign/hooks*.txt`)

| Hook (spoken) | raw / patched | Use |
|---|---|---|
| **Your receptionist left at six. The phone's still open.** | 65.2 / 80.8 | **TikTok B, a week later, on the same body.** This is the receptionist family, the only hook family that has doubled our TikTok views (ig1: 563). The lockup becomes **The phone's** / ***still open.*** It is pro-staff: they get to go home, and nobody is replaced. It is 9 words (about 3.2 s), so the B cut drops line 6 (§5.3). The caption adds ig1's line: "Keep your front desk for the work only people can do." (The raw 65.2 is the "You/Your" opener quirk from ig5.) |
| Closed at six. Your phone's not. | 84.4 / 84.4 | Reserve. It is the same idea but loses the word "open", which the whole reel turns on. |
| Closed at six. Your receptionist went home. Not the calls. | 84.4 / 84.4 | Not used: 10 words (3.6 s) misses the 2-second window. |
| You close at six. Your phone doesn't. | 80.8 / 84.4 | Reserve (no "open"). |
| Your sign has two sides. You only use one. | 80.8 / 84.4 | A curiosity hook for a later test. Risk: "I use both" nitpicks, because the line isn't literally true. |
| The sign says closed. Your phone doesn't. | 77.8 / 77.8 | RESEARCH-viral S3's hook. Beaten by the number and the open/closed contrast. |
| You flipped the sign. Not the phone. | 62.2 / 77.8 | Ambiguous: it can read as "you should switch the phone off too". |
| Closed at six. Your phone isn't. | 58.4 / 58.4 | The scorer has no "isn't" in its stakes list. It is the same line as the 84.4, so this is a scorer gap, not a weaker hook. |
| Closed is for the door, not the phone. | 40.8 / 40.8 | The house line: the payoff (b4), never the hook. |

The body lines scored as hooks all fall between 37.8 and 50.6. The hook is the strongest line in the script.

---

## 2. The objects (one world, two depth planes; STYLE §5.3)

### 2.1 The sign (near plane, parallax k 1.25)

| Part | Spec | Notes |
|---|---|---|
| Card | 1.8 : 1, r = 4 % of width, white, 2.5 px `#D4D4D4` edge, the long shadow on the ground layer | Same object in every crop. Screen sizes per crop are in §3. |
| Inner border | 36 px inset (at S1 scale), 5 px `#0A0A0A` on the CLOSED face, 3 px teal on the open face | The one decoration. It makes the card read as a real sign. |
| CLOSED face | Instrument Sans wght 680, caps, +0.06em, `#0A0A0A` | Black sans = the door. Never in teal, never in italic. |
| open face | Cormorant Garamond Italic 600, lowercase, teal `#0A8AA8`, 260 px at S1 scale (417 px wide) | Teal serif italic = the phone's side. The accent typeface on the object itself. |
| Eyelets | Ø 36, 7 px ink ring, white centre | The reference's white-centred dots. They rhyme with the clock's dots. |
| Cord | 5 px ink, eyelet → nail → eyelet, recomputed every frame from the transformed eyelets | It stays attached through the flip and the swing. |
| Nail | black disc Ø 52 + **teal dome Ø 30** (STYLE §4.3 gradient), small shadow (6, 10, 4 px, 18 %) | The pivot of every swing: the hub. Off-frame top in S1 and S2; visible in S3 and in the b4 tilt. |
| Edge-on | when \|cos θ\| < 0.04, draw the card's thickness as a 6 px `#0A0A0A` line | The card never vanishes mid-flip; it becomes a black line for 1-2 frames. |
| Motion model | θ = flip (rotateY about the cord axis) · φ = pendulum about the nail (damped spring, period about 1.1 s, ζ ≈ 0.12) · a small drop in y | All pure functions of `t`. Flips: 10-14 f on `EASE.expo`, edge-on at the fastest frame, overshoot 4-5° and settle on `SPRING.land`. |

**Two faces, one rule.** Whichever face is visible, its word has been said or is being said. CLOSED is spoken in lines 1 and 4. "open" is spoken in lines 1 and 3, and it is not legible on the object until line 3 (§11).

### 2.2 The clock beyond (far plane, k 1.00)

| State | Spec |
|---|---|
| **Geometry (C1 = STYLE M1)** | Dial centre (−9, 1814), R 1623; the hand pivots at (97, 1183) (the reference's parallax offset) and is 1095 long, using STYLE §1.2's width profile. Ticks: fine every 1.2° (`#D6D6D6`), every 6° (`#9A9A9A`), every 30° (`#222222`). **No numerals, ever.** |
| **Night 1 (your phone)** | Rim: a 3 px `#C8C8C8` hairline (**no accent**). Hub dome: graphite `#3A3A3A` (**no teal**). Calls: **hollow** dots (Ø 24, 6 px ink ring, white centre) at 6°, 20° and 34°. The hand sweeps linearly at 9.33°/s, from −1.5° at f96 to 47° at f252. Its body stays left of x 210 inside the lockup band (y 1080-1400). |
| **Night 2 (the agent)** | A clean dial: **no hollow dots carry over**. The hub dome is teal from the cut. On the pickup, the teal rim (9 px) draws both ways from the reading point, and every call after it is a **filled teal dot** (a flat dome, Ø 24). |
| **C2 full dial (M5′)** | Centre (560, 620), Ø 760 (zoom ≈ 0.234), with the hub at the true centre. A T1 cut gets there, so the macro parallax never has to resolve on screen. Dots are drawn at a constant screen Ø 28 and the rim at 6 px. At y ≥ 840 the rim stays at x ≤ 870, clear of the TikTok rail. 12 hour marks, no numerals. |

**The dial has no numerals**, so its scale is never readable. The dot spacing is chosen for the frame and does not measure hours. Time is carried by her words (eight, ten, midnight) and by the sweep.

---

## 3. Shots (one camera, 2.5D planes)

The lockup is screen-locked. In sign shots it is centred on x 540 (lead baseline 1150, accent 1225, tier 1290). In clock shots it uses STYLE §1.6's position (lead x 411 / 1160, accent x 396 / 1235, tier centred on x 630, 1290). Every crop keeps object strokes out of y 1080-1400 between x 300 and 900, and the zone guard checks this per frame.

| Shot | Frames | Crop | Notes |
|---|---|---|---|
| **A** S1 sign, outside | f0-96 | card 1080 × 600 centred (490, 680) | Frame 0 (§1.1). Snap punch-in ×1.00 → ×1.12 on "six" (8 f, `EASE.expo`). It is ×1.12, not STYLE's ×1.30, so the card's bottom stays above about y 1016. |
| **B** dolly past the sign | f96-118 | S1 → C1 | **One continuous camera move, no cut.** The camera moves forward and up-right (zoom ×1.12 → ×1.9 on the near plane). The sign plane (k 1.25) slides down-left and out past the bottom-left corner. The clock plane (k 1.00) enters from the top-right and settles at C1 on `EASE.expo`. Fallback: a T1 match cut from the right eyelet to night dot 1 at the same screen spot. |
| **C** C1 night 1 | f118-252 | STYLE M1 | Three rings, three hollow dots, the lockup swaps (§4 b2). Mock panel 2. |
| **D** reverse dolly | f250-268 | C1 → S2 | The mirror of B. The sign comes back showing CLOSED. |
| **E** S2 sign, close | f268-433 | card 1140 × 634 centred (540, 760); faces scale ×1.055 (CLOSED 158 px, open 274 px) | The flip to open (b3), the flip back to CLOSED on "Closed" and the peek on "phone" (b4). Mock panels 3-4. |
| **F** tilt + T2 | f433-451 | S2 → the nail → into the dome | Pan up the cords to the nail (8 f, `EASE.inOut`; the dome enters from the top), then a T2 push into the dome, ×1 → ×36 (10 f, `EASE.in4`). It fills the frame teal on f450 (1 f). The tilt starts only after lockup 4 has left, because a tilt moves the card down through the lockup box. |
| **G** C1 night 2 | f451-540 | M1, agent state | It opens out of the clock's hub dome (×36 → ×1, 12 f, `EASE.expo`): "the agent at the centre". Then the pickup and the teal rim. |
| **H** C2 full dial | f540-576 | M5′ (§2.2) | **T1 cut on the beat after "day".** The hand makes one full turn and teal dots pop on 8ths. Mock panel 5. |
| **I** S3 sign, morning | f576-656 | card 1000 × 556 centred (540, 760), nail visible at (540, 300) | T3 whip in. The sign flips to open facing out. Mock panel 6. |
| **J** end card + seam | f656-840 | `End6` | §6, §7 |

---

## 4. Beat sheet (30 fps targets; `timing.ts` re-anchors them on the measured takes)

**Acts** (`SCENES`): `hook` 0-96 · `night` 96-252 · `flip` 252-330 · `door` 330-451 · `pickup` 451-576 · `morning` 576-656 · `end` 656-840.

**Type grammar** (STYLE §2.4):
- **Lead:** a 7 f mask rise (`EASE.expo`).
- **Accent:** a 10 f slide + wipe, teal from its first frame, landing on the word's onset (the shot's hit).
- **Sentence tier:** set at 72 % ink 2 f before her first word; each word lifts on its onset.
- **Exits:** 4-5 f, `EASE.in3`.
- One moving text at a time. A lockup holds at least 1 beat after its last word lands.
- **Sign faces stand in for type twice:** CLOSED as the scene word (b1, b4), open as the accent (b3).

| Beat · frames · s | Picture, camera, object | Type (big / sentence tier) | Spoken (id @ f) | Sound |
|---|---|---|---|---|
| **b1 Hook** · 0-96 · 0.0-3.2 | **Shot A.**<br>• The flip lands on CLOSED f0-5 (overshoot f9, settled f20). The swing decays.<br>• **f29, "six":** snap punch-in ×1.12.<br>• **f66, "still":** the card gives a 1° answering sway (the type hit).<br>• Macro drift throughout. | **Big:** CLOSED (sign) + **Your phone's** / ***still open.*** (set at 72 % at f0). The lead lifts on "Your" (≈ f45). The accent lifts as a unit on "still" (≈ f66) with a scale pop of 3 % or less.<br>**Tier:** "Closed at 6. Your phone's still open." (display map: "six" → "6").<br>Exit up through the masks from ≈ f91 (lead → accent → tier, 2 f apart). | `ig6-01` @10 | **`fx-trill` f0** (it rings out by f10: `afterRing`).<br>`fx-tag` f5 (the card lands, −6 dB, inside the trill's tail).<br>`creak` −14 dB under the swing (f12).<br>`fx-roomtone` floor. **No bed**: a door, a phone, a quiet room. |
| **b2 Night** · 96-252 · 3.2-8.4 | **f96-118 shot B:** the dolly past the sign to the clock beyond.<br>**Shot C (C1, night 1):** the hand sweeps linearly (graphite hub, grey rim).<br>• **f120 ring N1:** hollow dot 1 pops at 6° (`SPRING.pop` from 0) as the needle reaches it.<br>• **f165 ring N2:** dot 2 at 20°.<br>• **f210 ring N3:** dot 3 at 34°.<br>Three hollow dots on a grey arc: the reference picture, now meaning three calls nobody took. | **Lead "At"** rises at f128 and stays.<br>**The accent swaps on each ring:** ***eight.*** lands on "eight" (≈ f138) and exits f158-163. ***ten.*** lands on "ten" (≈ f183) and exits f203-208. ***midnight.*** lands on "mid-" (≈ f228).<br>**Tier** (one screen, set at f128): "At eight. At ten. At midnight."<br>Exit f248-253. | `ig6-02a` @130 "At eight." (ends ≤ f159)<br>`ig6-02b` @175 "At ten." (ends ≤ f204)<br>`ig6-02c` @220 "At midnight." | `whoosh-soft` peaking f108 (the dolly).<br>**`fx-trill` f120 / f165 / f210**, alone in the room.<br>`tap` (−26 dB) on each dot pop.<br>`fx-tick` on beats at −26 dB (the clock's tick as the hats; ducked under words).<br>`pop` + `sub` on "midnight." (≈ f228, the bar's one big landing). |
| **b3 The other side** · 252-330 · 8.4-11.0 | **f250-268 shot D:** the reverse dolly back to the sign (S2), CLOSED facing.<br>**f296-310 THE TURN:** the sign flips. It is edge-on (a black line) at f303, and **the open face lands on "open" (f310)** with a 4° overshoot. It then sways φ ±1.5°. | **Big:** the sign's face ***open*** **is the accent** (no lockup accent, no lead).<br>**Tier:** "The other side says open." (set at 72 % at f268, baseline 1250). | `ig6-03` @270 | `swish` peaking f303 (the edge-on frame).<br>**Near-silence f304-309**: the room tone ducks 6 dB and nothing sounds.<br>**f310:** `pop` + `sub` + `fx-mallet-e5` (the series' "true / done" mallet).<br>**The bed enters on f315**, the first beat after "open": the music arrives with "open". |
| **b4 The door** · 330-451 · 11.0-15.0 | **Shot E (S2).**<br>• **f330-340, "Closed":** the sign flips back to CLOSED (edge-on f334, lands f340). The flip lands on her word.<br>• **f396, "phone":** a **peek**. The card half-turns to 35° and back (12 f), flashing the teal side for a few frames.<br>• **f433-451 shot F:** the camera climbs the cords to the nail (f433-441). The teal dome enters at the top. T2 push into it (f440-450), and the frame fills teal on f450. | **Tier 4a** "Closed is for the door," (set f328). On "not" it swaps to **tier 4b** "not the phone."<br>**Big:** CLOSED (sign) + ***not the phone.*** (542 px, centred, baseline 1225), landing on "not" (≈ f380). No lead: the sign is the lead.<br>Lockup 4b holds to f430 and exits f430-435. | `ig6-04` @330 | `flip` peaking f334; `fx-tag` f340.<br>`pop` + `sub` on "not" (≈ f380).<br>`fx-flap` (−10 dB) on the peek.<br>`whoosh-rev` peaking f450 (the push into the dome), at −4 dB under the ring that lands on the same frame (b5). |
| **b5 Pickup** · 451-576 · 15.0-19.2 | **f450 ring A1, on the teal frame** (the last frame of b4): the phone rings as we fall into the dome.<br>**f451 shot G:** the clock's teal hub dome fills the frame and opens out to C1 (12 f), shivering with the ring (scale 1 ↔ 1.04, damped over 10 f). It is night 2: a **clean dial**, grey rim, no dots, a **teal hub**.<br>**f465 (beat): THE PICKUP.**<br>• The dome stamps (`SPRING.pop` 1 → 1.15 → 1).<br>• A 3 px teal hairline races up the hand (8 f).<br>• **The rim draws teal both ways** from the reading point (16 f, `EASE.expo`).<br>• A filled teal dot pops at the reading point.<br>**f540 T1 cut, the beat after "day",** to **shot H (C2 full dial).** The hand makes one full turn, linear in 45 f. Six teal dots at 30° + 60°n pop on 8ths as the needle passes. It lands at 12 on f585 (`SPRING.land`). | No text f435-473: the reel's **one wordless beat** (1.3 s, no voice).<br>**5a: "Your AI" / *receptionist*.** The lead rises f473; the accent (435 px, x 396-831) lands on "receptionist" (≈ f492). Tier 5a: "Your AI receptionist".<br>**5b: "Picks up," / *day or night.*** It switches on "picks" (5a exits f511-515). The accent (495 px, x 396-891) lands on "day" (≈ f535). Tier 5b: "picks up, day or night."<br>The lockup holds through the cut (screen-locked). Exit f566-571. | `ig6-05` @475 | **Stop-time:** the bed ducks to near-silence over f436-440 (`riser-short` into it).<br>**f450 `fx-trill`** alone in the hush; `thump` on the open-out (f451).<br>**f465 `fx-pickup` + `fx-tock` + `fx-ting` (−6 dB).** The bed returns on f465, its pad up an octave. `draw` under the rim.<br>`tap` on "receptionist"; `pop` + `sub` on "day" (with the cut).<br>`fx-glass-tick` (−26 dB) on each teal dot (drop any within 2 f of an onset); `land` f585. |
| **b6 Morning** · 576-656 · 19.2-21.9 | **f572-579 T3 whip:** the dial spins +75° (`EASE.peel`); cut on **f576** to **shot I (S3)**. It is morning, outside. The nail and its teal dome are visible at the top.<br>The sign is mid-flip from CLOSED: edge-on f581, **open lands facing out on f588**, then a gentle sway. | **"It answers" / *from your words.*** (accent 660 px, centred, x 210-870, baseline 1225). The lead rises f590; the accent lands on "from" (≈ f610).<br>Tier: "It answers from your words."<br>Exit f654-659. | `ig6-06` @592 | `swish` peaking f576; `flip` peaking f581; `fx-tag` f588.<br>`pop` + `sub` on "from". |
| **b7 CTA (`End6`)** · 656-780 · 21.9-26.0 | **f656-662:** the card, cords and black nail disc lift up out of frame (6 f, `EASE.in3`). **The teal dome stays.** It glides (f660-674, `EASE.inOut`) to the send disc's place (848, 1000), grows from Ø 30 to Ø 72, flattens to `#0A8AA8`, and its white arrow draws (f674-680).<br>**f672:** the comment field rises around it (§7).<br>AGENT types one letter per 16th from her word. The disc presses (.97) as "link" ends. | **"Comment" / *AGENT*** (centred, CTA band y 700-860).<br>Tier: "Comment AGENT for the link." (baseline ≈ 885). | `ig6-07` @684 (ends ≤ **f765**) | `whoosh-soft` peaking f659; `draw` under the arrow.<br>`endHits`: `fx-menu-open`, `fx-keys` ×5, `fx-click-down` / `-up`.<br>Half-bar snare roll f750-780; the riser crests. |
| **b8 Brand** · 780-826 · 26.0-27.5 | **Impact on the bar line (f780).** The field and lockup leave up (4 f). The disc (arrow out) flies to the end of the wordmark and **stamps** as its full stop (1.12 → 1, its own shadow).<br>**NEUROVOICE** surfaces centre-out. `neurotechvoice.com` types on "Neuro \| Tech \| Voice". | wordmark + URL | `ig1-07` @784 (the series' one borrow) | `impactHits(780)`: `riser`, `fx-impact-end`, `thump`, `slam`. The colophon's `draw`. |
| **b9 Seam** · 826-840 · 27.5-28.0 | §6 | lockup 1 set at 72 % by f839 | none | `MIX.fadeOut` [826, 840] to below −60 dBFS. The replay's first sound is f0's trill. |

**Muted read, beat by beat:**
1. CLOSED. "Your phone's *still open.*"
2. A clock, three hollow dots arriving: "At *eight.* / *ten.* / *midnight.*"
3. The sign turns over: teal "*open*". "The other side says open."
4. CLOSED again, "*not the phone.*"
5. A teal hub stamps, teal runs round the dial: "Your AI *receptionist* / Picks up, *day or night.*"
6. Morning, "*open*" outside: "It answers *from your words.*"
7. The comment field types AGENT, then NEUROVOICE.

**Retention.** Something lands every beat before the CTA: a flip, a swing, a ring, a dot, a word lift, an accent landing, the dolly, the turn, the peek, the push into the dome, the pickup, the rim draw, the spin, the whip. Nothing on screen is static for more than 1.0 s. There is a cut or a big camera move every 2-4 beats: punch-in f29, dolly f96, reverse f250, turn f296, flip f330, tilt f433, T2 f450, cut f540, whip f576.

---

## 5. Screens and voice lines

### 5.1 Screens (big words are always a subset of her words; tiers are 7 words or fewer, the series cap)

| Screen | Big (6 words or fewer) | Sentence tier | Line |
|---|---|---|---|
| S1 (set at f0) | CLOSED (sign) + Your phone's / *still open.* (5) | Closed at 6. Your phone's still open. (7) | `ig6-01` [0-6] |
| S2a / b / c | At / *eight.* → At / *ten.* → At / *midnight.* (2 each) | At eight. At ten. At midnight. (6, one screen) | `ig6-02a/b/c` |
| S3 | *open* (the sign's face) (1) | The other side says open. (5) | `ig6-03` [0-4] |
| S4a | CLOSED (sign) (1) | Closed is for the door, (5) | `ig6-04` [0-4] |
| S4b | CLOSED (sign) + *not the phone.* (4) | not the phone. (3) | `ig6-04` [5-7] |
| S5a | Your AI / *receptionist* (3) | Your AI receptionist (3) | `ig6-05` [0-2] |
| S5b | Picks up, / *day or night.* (5) | picks up, day or night. (5) | `ig6-05` [3-7] |
| S6 | It answers / *from your words.* (5) | It answers from your words. (5) | `ig6-06` [0-4] |
| S7 | Comment / *AGENT* (2) | Comment AGENT for the link. (5) | `ig6-07` [0-4] |

### 5.2 Voice lines (Tessa only; `speak` with no `<break/>`; series voices block)

| id | `say` | Tokens | Note |
|---|---|---|---|
| `ig6-01` | Closed at six. Your phone's still open. | 7 | the hook; display map "six" → "6" (tier only) |
| `ig6-02` | At eight. At ten. At midnight. | 6 | **Synthesised as one take** and split at the full stops by its word timestamps into `02a` [0-1], `02b` [2-3] and `02c` [4-5], so the list keeps its intonation (a flat, flat, falling read). If the splits sound cut, synthesise three takes and pick by ear. |
| `ig6-03` | The other side says open. | 5 | the turn; a warm, slightly amused read |
| `ig6-04` | Closed is for the door, not the phone. | 8 | voice.md, verbatim (the house line) |
| `ig6-05` | Your AI receptionist picks up, day or night. | 8 | S4 + S22 |
| `ig6-06` | It answers from your words. | 5 | S6. **Trim T1** drops it (§5.3). |
| `ig6-07` | Comment AGENT for the link. | 5 | a fresh take (the pipeline allows one borrow only); `speak` uses a lowercase "agent" |
| `ig1-07` | Neuro Tech Voice. | 3 | the borrow, byte for byte |

**Alternates** (same batch):
- `ig6-01b` "Your receptionist left at six. The phone's still open." (TikTok B, §1.3).
- `ig6-07b` "The link's in our bio." (only if nobody can answer AGENT comments on posting day).

**44 tokens** before the sign-off.

### 5.3 Word rate and anchors (Tessa: 2.78 tokens/s mean, 2.45 on number-heavy lines; ig5 measured)

| Anchor | Rule |
|---|---|
| f0 ring | Fixed. `ig6-01` starts at `afterRing` (f10). |
| Night rings N1-N3 | **Equally spaced, 45 f (3 beats)**, the first on the first beat at or after the dolly settles (plan f120). Each `02x` piece starts 10 f after its ring and must end 6 f before the next ring (no onset in ring − 6 … ring + 10). The hand's speed is computed from the placed spacing (14° per spacing), so it stays linear. If any piece is longer than 29 f, re-space all three to 60 f; never space them unevenly. |
| The turn | The open face lands on the measured onset of "open" (`ig6-03` word 4); the flip starts 14 f before it. |
| The pickup | Ring A1 on the T2's teal frame (the first beat at or after lockup 4's exit + 15 f; plan f450). The pickup on the next beat at least 15 f later (f465). `ig6-05` starts at the pickup + 10 f or later. The text-free gap from lockup 4's exit to lockup 5a must stay at 1.5 s or less: if lockup 4 leaves early, hold it longer rather than open a longer silence. |
| CTA | `ig6-07` must end by **f765** (impact − 15). |
| Plan at 2.78 | `01` 10-86 · `02a` 130-153 · `02b` 175-196 · `02c` 220-248 · `03` 270-324 · `04` 330-416 · `05` 475-561 · `06` 592-646 · `07` 684-738. **Spare: 27 f.** |
| At 2.45 | Everything after the hook slips by about 55 f, about 28 f past the limit. **Trim T1:** drop `ig6-06`. The morning flip becomes a wordless 1.2 s beat (sign only, no text), and the CTA moves up by about 60 f, so it fits. **Trim T2** (only if still long): two night rings, "At ten. At midnight." (−45 f). **The 26.0 s cut** (impact f720) is T1 applied at plan rate. |
| TikTok B | `ig6-01b` adds about 20 f to the hook, so the B cut always uses T1. |

**`beats.py` (`--target 28`, 165 wpm; `scratchpad/ig6sign/script.txt`):**
- **47 words, about 17.1 s of speech.** The 10.9 s "under target" is the planned air: four ring-outs, the dolly and its reverse, the turn's near-silence, the wordless pickup beat, the spin, the whip, the end card and the seam.
- **"Beats 2-4 have nothing concrete."** Its regex misses spoken numbers ("eight", "ten", "midnight") and it can't see the picture. Every beat has a concrete object event.
- **"No loop."** The real loop is the seam (§6). The spoken echoes are "Closed" (lines 1 → 4) and "open" (lines 1 → 3). The series' last line is always the sign-off.

### 5.4 Bed (`MUSIC`)

- The ig5 stub arrangement, with no new `scripts/ig6/bed.mjs` unless the critics ask for one.
- **`bedFrom` f315** (the first beat after "open"). The closed half of the reel has no music, only the room, the clock and the rings.
- `stop` [f436, f465), measured from the placed takes; the pad returns up an octave on the pickup.
- `roll` f750, `impact` f780, `brand` f784.

---

## 6. The loop seam (f826 → f840 ≡ f0)

1. **f826-830:** the wordmark and URL leave up through their masks (4 f, `EASE.in3`).
2. **f826-834:** the full-stop dome rises and leaves through the top edge at x 490, shrinking to Ø 30. It is going back to the nail, which is off-frame at (490, −200) in shot A.
3. **f828-834:** the two cords draw down from the top edge to the frame-0 eyelet positions (trim path from the nail end, 6 f, `EASE.expo`).
4. **f830-839:** the sign swings in on the cords from **edge-on**, a vertical black line on the cord axis. θ runs from 90° to about 30°, decelerating to 5°/f: exactly frame 0's flip velocity. It drops in about 40 px, with φ = +2°.
5. **f832-839:** lockup 1 and its tier rise to 72 % ink.
6. **f840 = the replay's f0:** θ = 25°, landing on CLOSED by f5, and the trill.

The seam lands on frame 0's state **with its velocities**: the flip and the swing are mid-motion on both sides of the cut. The story loops too. The last picture was the morning's open, then the brand. The first is the evening's CLOSED. The last word heard is "Neuro Tech Voice."; the first is "Closed".

---

## 7. End card: `End6` (the NEUROVOICE wordmark in the white style)

Built in `src/ig/ig6/End6.tsx` from the `End.tsx` exports (`Wordmark`, `WORDMARK_FONT`, `WORDMARK_TEXT`, `END` geometry, `agentKeys`, `ctaLine`) and `impactHits` / `endHits`. **It never edits `End.tsx`** (STYLE §4.4).

| Part | Spec |
|---|---|
| **The through-line** | The teal dome travels: the sign's nail → the send disc (b7) → the wordmark's full stop (b8) → back up to the nail (seam). The sign hangs from the agent. |
| **CTA lockup** | "Comment" (Instrument Sans 580, 60 px, ink) / ***AGENT*** (Cormorant Italic 600, 110 px, teal, 321 px), centred on x 540 in the series' CTA band (y 700-860). The sentence tier "Comment AGENT for the link." is 32 px grey (435 px), baseline ≈ 885. |
| **Comment field** | `END.field` geometry (x 174-906, y 940-1060, r 60): the series' one zone exception. White fill, 1.5 px `#E6E6E6` border, the long shadow (24, 48, 10 px, 7 %). The lucide message-circle icon and the text are `#0A0A0A`. The send disc is the dome: Ø 72, flat `#0A8AA8`, white arrow. Nothing imitates Instagram's own UI. |
| **Impact** | `impactHits(780)` on the bar line. **No GL bloom:** the impact is the disc's stamp plus the wordmark surfacing centre-out. |
| **Wordmark** | NEUROVOICE exactly as the series sets it (Inter Tight 500, −0.07em, 760 px or less, y 760-900), in `#0A0A0A`. Its full stop is the dome, baseline-aligned, Ø = x-height × 0.55. The letters are never altered. |
| **URL** | `neurotechvoice.com` (the series' URL; changing it would re-render ig1-ig5). Instrument Sans 450, 34 px, `#6B6B6B`, typed on "Neuro \| Tech \| Voice". |
| **Fallback** | `IgEnd` unchanged with `tone="pearl"`. It is series-true, but its teal bloom is a glow on white, which the style excludes. In that case b7's lift ends with the dome shrinking into the white, and `IgEnd`'s own field appears. |
| **TikTok** | TikTok has no keyword auto-DM. Its caption says "Link in bio" (RESEARCH-product §7). One master serves both apps. |

---

## 8. Cover

Custom PNG `IG6-Cover-9x16`, 1080 × 1920. Mock: `scratchpad/ig6sign/cover.png`. Every word is spoken in the reel, and every word sits inside x 86-900, y 260-1380, so it reads in the 3:4 grid tile (y 240-1680).

- **Picture:** frame 0's composition at rest (θ = 0, φ = 0): the CLOSED sign with its cords. It is drawn bolder for the tile: the card edge `#C8C8C8` 3 px, the border 6 px, the shadow 9 %. The same picture is TikTok's autoplay frame 0, so the grid and the feed agree.
- **Kicker:** `AI RECEPTIONIST · 06` (Instrument Sans 600, 28 px, +0.08em, `#6B6B6B`, 330 px), at x 346, baseline ≈ 1062, between the card's shadow and the lead. It carries the search keyword (spoken in `ig6-05`) and the series number.
- **Title lockup:** **Your phone's** (78 px, 440 px wide, baseline 1150) / ***still open.*** (140 px teal, 465 px, baseline 1245).
- **Tier:** "Closed at 6. Your phone's still open." (32 px grey, baseline 1312).
- **No** price, numeral other than the closing time, clock, app UI or teal on the sign.
- **Fallback:** frame 0 itself.

---

## 9. Why it gets shared and rewatched on TikTok

1. **A "huh, that's true" observation, aimed at owners.** Every shop owner has stood at the door at closing and seen OPEN facing them. "The other side says open" turns that private moment into the reel's twist. It is a send-to-a-friend line for owners and front-desk staff ("this is us at 6"), and it needs no statistic. [K]
2. **The contradiction works muted.** Big black CLOSED, then teal italic "still open." directly under it, in a different typeface. The two-tier style turns the open/closed contrast into a two-word read in under a second. [K; the style's isolation effect, A5]
3. **The sign flips on her words.** CLOSED lands on "Closed", the open face lands on "open", and the teal side peeks on "phone". Catching that sync is the kind of detail people replay. [K]
4. **The reference's own picture, with a meaning.** The clock beyond is STYLE M1 exactly, but its white-centred dots are calls that came at night. Then, on the agent's night, the dial fills with teal. That is the "satisfying" layer the style trades on (a hypothesis: Live Science notes no dedicated studies, S11).
5. **A day that loops.** Close, night, the turn, a better night, morning open, and close again at the seam. The replay starts mid-flip on a ring, so it feels continuous. TikTok weights completion heavily [P1], and Instagram counts replays as views [S5].
6. **Design-forward and faceless.** It reads as a motion piece, not an ad, in a feed of faces. The craft audience's "how did you make the flip?" comments are the reference's own comment engine.
7. **One ask.** AGENT, with the comment field typing it on screen for muted viewers.

**Honest limits.** The after-hours angle is ig2's (250 views, the series floor) and the house line was the first post (52 views on IG, as a film 1 cut). The new twist, the white style and the 84.4 hook are this concept's answer. The **TikTok B hook** moves it into the receptionist family, the only family with a record. RESEARCH-viral's own ranking puts the clock closer to the reference. The sign is the more universal object and the cheaper build.

**TikTok caption, first line** (searchable; the caption stage finalises it): "Closed at 6? Your phone's still open. An AI receptionist that picks up, day or night." Then "Link in bio."

---

## 10. Facts and claims it uses (nothing else)

| On screen / spoken | Grade | Source |
|---|---|---|
| "Closed at six." | a scene, not a claim (a typical closing time, like ig2's "9:47 pm") | none needed |
| "At eight. At ten. At midnight." and three hollow dots | a scene: **no count, rate or share of calls is stated or implied**, and the dial has no numerals | none needed. Never add "most calls come after hours" or any % (RESEARCH-viral §5.3, all UNUSABLE). |
| "The other side says open." | a physical fact about the common two-sided OPEN/CLOSED hanging sign | the object itself |
| "Closed is for the door, not the phone." | brand position (opinion) | `.claude/instagram/voice.md` (a top line and position 4); RESEARCH-product S3. It holds as the default always-answer: `lib/voice/router.ts:198-224`. |
| "Your AI receptionist" | a noun | RESEARCH-product S22 (never with "replace", "fire" or "instead of") |
| "picks up, day or night" | A, as the default always-answer (on screen instead of "24/7") | `lib/site.ts:944`; `lib/voice/router.ts:198-224` (S4) |
| "It answers from your words." | A | `lib/pages/home/pricing.ts:67`; `lib/voice/session-loader.ts:236`; knowledge base on every plan, `lib/pages/knowledge-base.ts:496-497` (S6) |
| "Comment AGENT for the link." | A, **if** AGENT delivers the trial link and setup help | voice.md "The ask"; RESEARCH-product §7 |
| B hook: "Your receptionist left at six." | a scene; pro-staff | ig1 coherence (nobody is replaced) |

**Not used, deliberately:** the ring cadence (F1), "on the first ring" (B, unmeasured), any third-party figure, "24/7" on screen, the trial terms in the VO (they go in the caption).

**Caption fine print** (paste-ready, RESEARCH-product §8 standard):
> Free trial: 5 minutes over 14 days, no card needed. On the trial it answers your own test calls; to answer customers, the agent needs its own phone number ($1.15/month, card required). One agent per business, set to one of 14 languages. It tells every caller it's an AI.

---

## 11. Self-check

| Rule | Status | How |
|---|---|---|
| No invented statistic, result or testimonial | **PASS** | No number in the reel except the closing time, a scene. The hollow and teal dots are illustrations with no count on screen or in the VO. No hang-up, voicemail or wait figure (F-U1 to F-U9). |
| No number on our speed (U3) | **PASS, by design** | There are no seconds, timers or numerals anywhere. The clock is an hour-scale time-lapse, so the 15 f between ring A1 and the pickup can't be read as a latency. "First ring" is not said. |
| No takeover or forwarding picture (U5) | **PASS** | The agent answers on **night 2, a clean dial**: a fresh ring is picked up. **The night-1 hollow dots never turn teal**, which would imply missed calls handled or called back afterwards (not a product feature). No "your line", "busy", "forward" or "keep your number". The fine print says the agent needs its own number. |
| No absolutes (U1, U2) | **PASS** | No "never miss" and no "every call answered". "Day or night" is used on screen instead of "24/7". The teal dots are a handful, not "all calls". |
| No booking, price, minutes or plan names | **PASS** | One cut. Nothing tied to $49. |
| Trial truth | **PASS** | The trial is not in the VO. The caption fine print carries it, and AGENT delivers the link. |
| Product scope | **PASS** | No language switching, cloning, recordings or texts, and no "sounds human". The fine print says it tells every caller it's an AI. |
| No competitor | **PASS** | none |
| Series coherence | **PASS, with one flag** | Teal stays "ours" and the receptionist is only "your AI receptionist". The B hook keeps the human receptionist ("left at six"), with ig1's caption line. The house line is used verbatim, as the payoff. The sign-off, URL, AGENT CTA and the end card's beats are kept. **Flag:** the after-hours angle (ig2) and the house line (film 1 twist, IG post 1) risk déjà vu. The new twist ("the other side says open") and the white style are the answer. Judges decide. |
| Voice rule | **PASS** | Tessa speaks every lockup word, every tier word and **both sign faces**. CLOSED is legible from f0, spoken at f10 (the frame-0 rule) and again in line 4. "open" is first legible on the turn (f310), on her word. Before that the open face is never shown: the b1 flip lands from the CLOSED side, and the peek in b4 comes after line 3. The only text-free beat (f435-473, 1.3 s) is also voice-free. |
| 6 words or fewer per card; tiers 7 or fewer; hook in 0-2 s | **PASS** | The largest card is 5 big words (S1, S5b, S6); the longest tier is 7 (S1). "Closed at six" is heard by about 1.0 s and the whole hook by about 2.9 s. **Flag:** "AI receptionist" is heard at about 16.5 s, not the ~3 s RESEARCH-viral asks for. It is on the cover kicker and in the TikTok caption's first line, and the B hook says "receptionist" at about 0.4 s. |
| Safe zone | **PASS by layout** | Text sits in x 210-891, y 1095-1312 (end card y 700-1060), plus the sign faces in x 160-888, y 560-900. Below y 840, objects stay at x ≤ 880, or are unimportant edges (the card's right edge in S1). Checked on the mock (`mocks.png`); to be proved with an ig6 copy of ig5's zone rule (`zones.ts`) plus an object-overlap still check. |
| Reference originality | **PASS, flagged** | The sign, its faces, the story, the sentence and the colour are ours, and there is no watermark. **The night clock copies the reference's measured composition (M1)**, which is the owner's ask ("exactly in this style"), and it carries our own meaning: night calls, then teal. The hand silhouette is the reference's (STYLE §1.2); a plain baton hand is the variant if the judges read it as a copy. |
| Secrets | **PASS** | No key read or printed; no Cartesia call. |

---

## 12. Production risks (Remotion, no three.js)

1. **The flip without 3D.**
   - **Recommended:** a 2D "graphic flip". scaleX = |cos θ| about the cord axis, the face swaps at 90°, plus a keystone of ±2° skewY scaled by sin θ to suggest depth, and the 6 px edge line at edge-on.
   - It is deterministic, has no 3D anti-aliasing, and keeps the lettering as crisp SVG.
   - **Optional upgrade:** CSS `perspective(2400px) rotateY(θ)` with `backface-visibility: hidden`, after a probe. Chrome rasterises 3D-transformed layers and may soften the lettering, and a CSS filter on a `preserve-3d` parent flattens it.
2. **The shadow of a turning card.**
   - Never a `drop-shadow` on the rotating element: the light would turn with it.
   - Draw the card's silhouette on the ground layer (non-rotating), scaled by |cos θ|, swung by φ about the nail's projected point and offset (24, 48). Blur it with `feGaussianBlur` σ 5 at 7 %. The light is fixed upper-left in screen space.
3. **Cord attachment.** The cord endpoints come from the *transformed* eyelets every frame (they move with scaleX, keystone and φ). Otherwise the cords detach mid-flip, which is the most visible failure.
4. **White-on-white legibility after the encode.** The card exists only as a 2.5 px `#D4D4D4` edge plus a 7 % shadow. Run STYLE §7.5's 2 s probe of the 60 fps upload copy. If the edge or the shadow ramp bands or vanishes, go to `#C8C8C8` / 9 %. Keep `IgFinish` grain at 0.
5. **The two-plane dolly (shots B and D).**
   - One camera with k = 1.25 (sign) and 1.00 (clock), using STYLE §5.3's transform.
   - Cull the sign plane once it is past ×3 and off-frame.
   - The clock starts off-frame top-right in shot A, so the hook frame keeps one object.
   - **Fallback:** a T1 match cut from the eyelet to night dot 1 at the same screen spot.
6. **The macro parallax.** C1 puts the hub 640 px from the dial's centre (STYLE §2.1). C2 needs the hub at the centre, and the T1 cut on "day" hides the change: never pull back continuously from C1 to C2.
7. **Rings and words in b2.** Three rings within 4 s around three short pieces of one take. The anchors (§5.3) keep every onset clear of every ring. The hand speed is derived from the placed spacing, so the dots always land under the needle. Test the split of `ig6-02` by ear.
8. **The T2 into the nail dome.** The nail dome is only Ø 30 in S2, so filling the frame needs ×36. Cull the cords and card once they are past ×6, and give the dome's rim a non-scaling stroke. The open-out lands on the clock's Ø 58 hub, in the same teal gradient, so the match holds.
9. **Fonts and widths.**
   - Cormorant Garamond Italic 600 comes from `src/ig/ig6/fonts.ts` (never `src/lib/fonts.ts`).
   - Instrument Sans needs **three** instances ready before measuring: 580 (lead), 450 (tier) and **680 (the sign)**. Use `useIg6Faces()` + `useFaceReady` for each.
   - Measured (`measure.py`): *from your words.* 660 px at 110 (centre it, or drop to 100 px), *day or night.* 495 (ends at x 891), *not the phone.* 542, *still open.* 418 at 126.
10. **Rotated object lettering.** The sign's words sway with the card (φ up to 2°) and keystone in the flips. STYLE's "no rotated text" rule is written for the type tiers; this is object lettering. Flag it for the judges; the sway can be capped at 1° while a face is being read.
11. **The seam.** f839 → f0 must match in position **and** in flip and swing velocity. Render a two-pass loop strip and diff the frames around the seam.
12. **Strobing at 60 fps without blur.** The flips (90° in 7 f), the 75° whip and the full-turn sweep in C2 (8°/f, about 50 px per 60 fps frame at the rim) are the fast moves. If the C2 sweep strobes, slow it to 60 f and drop one dot.
13. **Render cost:** low. One card, one dial window (only the visible ticks are drawn), and transforms on the layer divs, not on the SVG children.

---

## 13. Open decisions for the owner and the judges

1. **Hook:** A "Closed at six. Your phone's still open." everywhere, and B "Your receptionist left at six. The phone's still open." on TikTok a week later (it needs trim T1).
2. **The clock beyond:** keep it (the brief, and the reference's picture), or cut it for one-object purity. Without it, the night beat would play on the sign alone, as wordless rings, and lose the "three hollow dots" image.
3. **Length:** 28.0 s with "It answers from your words.", or 26.0 s without it (trim T1).
4. **End card:** `End6` (recommended, with the dome through-line) or `IgEnd` unchanged.
5. **Serif-italic exception** (STYLE §4.2): the accent phrase plus the sign's open face. Both are spoken, both are teal, and both are the same face.
6. **The flip technique:** the 2D graphic flip (recommended) or CSS 3D after a probe.
7. **The peek on "phone"** (b4): charming or gimmicky? It is cheap to remove.
8. **The hand silhouette** on the night clock: the reference's hollow diamond (faithful) or a plain baton (more our own).
