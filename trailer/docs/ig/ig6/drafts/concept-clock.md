# ig6 · concept "clock": Every second

Label `concept:clock`. Written 2026-10-11 on `claude/remotion-trailer` (HEAD `9cb3bc8`). Planning only: this file is the only one written. No code, no voice, no Cartesia call, nothing committed.

**Read first:** `../STYLE.md` (the look, measured), `../RESEARCH-viral.md` (facts F1-F6, scenario S1), `../RESEARCH-product.md` (SAFE S1-S22, UNSAFE U1-U21). This concept is S1 "Every second", built as close to the reference frame as the truth rules allow.

---

## 0. The reel in one table

| | |
|---|---|
| **Title** | Every second |
| **Slug** | `every-second` → `neurotechvoice-ig6-every-second` (the ig5 route: `src/ig/ig6`, `scripts/ig6`, a separate registry, so ig1-ig5 stay byte-identical) |
| **Length** | **26.0 s = 780 timeline frames at 30 fps** (13 bars at 120 BPM; 3120 render frames at 120 fps). Impact **f720** (bar 13 line). END **f780**. Fallback: 28.0 s (impact f780, END f840) if the measured CTA can't end by f705 (§5.3). |
| **Hero object** | One clock, in macro: our own **ring clock** (§2). It has a teal rim arc. A white-centred node marks the start of each ring, and a band marks each ring's 2 s tone. The hand is black with a hollow-diamond tip, and the hub cap is a teal dome. |
| **Palette** | `#FFFFFF` ground, `#0A0A0A` ink, `#6B6B6B` sentence tier, tick greys `#D6D6D6` / `#9A9A9A` / `#222222`, and **one accent, teal `#0A8AA8`** (deep `#0E7490` for the collar and the dome's shading). |
| **Type** | Each lockup has three tiers: an Instrument Sans 580 lead word, a teal **Cormorant Garamond Italic 600** accent phrase, and the spoken sentence in Instrument Sans 450 at 32 px grey (STYLE §1.5). The lockup is **6 words or fewer**, and every word in it is spoken. |
| **Voice** | Tessa (Emotive), the series' voices block, on **every** on-screen line. 47 words before the sign-off. |
| **End card** | `End6`: a white end card in the reference's style (§8). The fallback is `IgEnd` unchanged. |
| **Cuts** | **One cut.** No booking, no price, no minutes. |

**The reel in one breath.** A giant clock, cropped like the reference, ticks once a second. A phone rings on a tick: "One ring, six seconds. You can't answer." The dial steps forward six times, and the second ring lands exactly six real seconds later. It lands in the middle of her sentence: "And every second it rings, [ring] someone's still waiting." We fall through a ring node and come out on the whole dial, which turns out to be a clock that counts rings. Its hand races through a full minute of them: "A missed call is someone else's customer." Then there is a beat of silence and a whip. A fresh clock rings once and the teal hub picks up on the tick. The anxious ticking stops, and the dial glides smoothly under the hand: the reference frame, exactly, now moving calmly. "Your AI receptionist picks up on the first ring. It answers from your words, day or night. Ring it yourself." The teal hub becomes the send button: "Comment AGENT for the link." It then stamps the full stop after NEUROVOICE, and goes back to the hub as the loop starts again on the first ring.

---

## 1. The hook (0-2 s)

### 1.1 Frame 0 (the picture)

This is STYLE §1.6's frame-0 layout: the reference composition, raised 300 px into the safe zone.

- **Ground:** flat white.
- **Dial** (centre (−9, 1814), R 1623):
  - The teal rim arc (9 px) enters the left edge at y ≈ 191 and leaves the right edge at y 611.
  - Fine, seconds and ring ticks sit inside it (§2).
  - **Ring node 1** (Ø 24, 6 px ink ring, white centre) sits 6° (≈ 170 px along the arc) to the right of the needle and is arriving: the f0 step brings it under the needle on f3. Its pop (`SPRING.pop` from 0.6) starts on f0.
  - Ring 1's band waits after it in light grey.
  - Behind the needle, the arc is clean teal: there is no ring before ring 1.
- **Hand:**
  - It pivots at (97, 1183), points at 30° and is 1095 long, so the tip is at (643, 235). It uses STYLE §1.2's width profile: tapered body, hollow concave diamond, 14 px needle, a deep-teal collar.
  - The hub is a black disc Ø 105 with a teal dome Ø 58 on top.
  - The soft long shadow (24, 48, blur 10, 7 %) sits on a non-rotating wrapper.
  - At f0 the hand begins its recoil of +0.8°: the escapement kicks as the dial steps.
- **Lockup, already set at 72 % ink** (the series' frame-0 rule). It is scaled ×1.15 for the small-phone read:
  - lead **"One ring,"**: Instrument Sans 580, 69 px, ink, baseline 1149;
  - accent ***six seconds.***: Cormorant Italic 600, 126 px, teal, baseline 1235, from x ≈ 330 (it must measure 570 px or less; otherwise use 110 px);
  - sentence tier "One ring, six seconds." / "You can't answer.": 32 px grey, centred under the accent, baselines ≈ 1295 / 1333.
  - The lead is indented +15 px from the accent's left edge (STYLE §1.5).
- **Camera:** macro drift already on at f0 (scale +1.5 %/s about the reading point). Nothing on screen is static.
- **Muted read in under a second:** a huge clock face, a phone-ring mark arriving at the hand, and "One ring, six seconds."

### 1.2 Text and voice

| | |
|---|---|
| **On screen (lockup, 4 words)** | **One ring,** / ***six seconds.*** |
| **Sentence tier** | One ring, six seconds. / You can't answer. |
| **Spoken** (`ig6-01` @ f10, after the f0 trill rings out) | "One ring, six seconds. You can't answer." (7 words, about 2.6 s) |
| **hookscore** (`python3 -I`, scratch copy; raw / patched) | **84.4 / 84.4 STRONG**. LENGTH 100, SPECIFICITY 100 ("six", "You"), STAKES 70 ("can't"), FRONTLOAD 100, ADDRESS 100. |

**Alternates, scored in the same run:**

| Hook (spoken) | raw / patched | Use |
|---|---|---|
| One ring, six seconds. Your receptionist can't answer. | 84.4 / 84.4 | **TikTok B, a week later, on the same body.** This is the receptionist family, the only hook family that has doubled our views (ig1: 563). It swaps one take (`ig6-01b`). The IG and TikTok captions then carry ig1's line "Keep your front desk for the work only people can do." |
| One ring, six seconds. You're not free. | 100 / 100 | Not used. "free" is the scorer's stakes word, but here it reads as "not available" or "not free of charge", and it collides with the trial's "free". |
| One ring, six seconds. Your caller's still waiting. | 84.4 / 84.4 | Not used: it steals beat 2's "still waiting". |
| Six seconds a ring. You can't pick up. | 84.4 / 84.4 | Same idea, weaker frame-0 card. |

**The scorer can't separate hooks above 80** (AUC 0.56). The choice rests on clarity, warmth (voice.md: "calm, warm"; "you can't" is empathy, not blame) and the frame. **Risk:** "You can't" repeats ig5's "You can't." That makes it a series motif, but people who saw ig5 may read it as a repeat. Flag for the judges. Body lines scored as hooks all fall between 30 and 41 (WEAK), so the hook is the strongest line in the script.

---

## 2. The ring clock (our dial, not the reference's)

The composition is the reference's (STYLE measured it). **The markings are ours:** the dial is printed with the North American ring cadence, "2 sec on, 4 sec off" (ANSI T1.401-1988 §5.4.2, F1). It is a clock that counts rings.

| Element | Reference | ig6 ring clock |
|---|---|---|
| Fine ticks | about every 0.85°, light grey | every **1.2°** (5 per second), r 1512-1554, 2 px, `#D6D6D6` |
| Seconds ticks | none distinct | every **6°**, r 1505-1556, 3 px, `#9A9A9A` |
| Major ticks | sparse, about every 24° | every **36°**, one at each ring node, r 1497-1560, 4 px, `#222222` |
| Rim arc | green, 9 px | **teal `#0A8AA8`, 9 px**, the whole visible arc, from frame 0 |
| Dots | every 12.2°, Ø 24 | **ring nodes every 36°**, one per ring (6 s at 6°/s): Ø 24, 6 px ink ring, white centre |
| Ring bands | none | **12° after each node** (the 2 s tone): a 24 px stroke centred on the arc, `#D6D6D6` ahead of the needle, turning `#0A0A0A` once the needle has passed (rung). **The agent's clock has no bands.** |
| Numerals | none | none, ever (no reading may be shown, §12) |

- **Reading point.** The needle crosses the arc at s ≈ 1008 from the hub, which is screen (601, 310) at frame 0 and dial angle 22.1°. Node *n* sits at dial angle 28.1° + 36°(*n* − 1), with the dial at rotation 0 just before the f0 step.
- **Tick mode** (before the pickup). The camera rides the hand, the way a watch macro does, and the **dial steps −6° once a second** (f0, f30, f60, ...): 3 f `EASE.expo`, 0.8° overshoot, settling on `SPRING.land` in 5 f. That is 170 px at the needle at ×1. On each step the hand recoils +0.8° and settles. The visible "tick" is the dial jumping one second under a hand that kicks.
  - Node 2 enters the right edge after the f90 step.
  - Node 2 reaches the needle on the **f180** step: 6.0 real seconds after ring 1.
- **Glide mode** (after the pickup). The dial turns **smoothly** at −6°/s (linear: a sweep is never eased). This is the same frame, now calm. The clock's tick sound stops.
- **The grid is the standard.** At 120 BPM, 6 s is exactly 3 bars. One ring is 1 bar of tone plus 2 bars of silence. Rings 1 and 2 land on the lines of bars 1 and 4.

---

## 3. Shots (one camera, 2.5D layers; STYLE §2.8, §5.3)

The lockup box is **screen-locked at x 300-900, y 1080-1400** in every shot except the end card. Every crop keeps the object's strokes out of that box. The parallax factors are dial 1.00, hand 1.12, hub 1.15 and lockup 0.

| Shot | Frames | Crop | Mode | Notes |
|---|---|---|---|---|
| A | f0-90 | **M1 reference**, ×1 | tick | the frame-0 layout (§1.1) |
| B | f90-210 | **M3′ tip macro**, ×1.8 about the reading point, which holds its screen spot (601, 310) | tick | one step = 306 px. The lozenge is at y ≈ 490-780. The hand body passes x 120-195 at y 1080, clear of the box. The rim leaves the right edge at y ≈ 558, above the TikTok rail (y 840). Punch-in ×1.3 at f180 (×2.34). |
| C | f210-232 | M1, ×1 | tick | a T1 back to the reference frame; node 2 sits at (441, 255) after the f210 step |
| D | f222-234 | T2 push into node 2 | | ×1 → ×200 in 10 f (`EASE.in4`) while node 2 pans to the frame centre (`EASE.inOut`). Its white centre fills the frame: **2 f of pure white** (f232-233). |
| E | f234-330 | **M5′ full dial**: centre (510, 660), Ø 820 (zoom ≈ 0.25; STYLE's 0.38 would sit the dial on the lockup) | sweep | The rim fills y 250-1070. At y 840 the rim reaches x 878, inside the rail line. **The hub is at the dial's true centre here**: the T2 cut removes the need to collapse the macro parallax on screen. |
| F | f330-337 | M5′ | | T3 whip: the dial spins +75° in 7 f (`EASE.peel`), cut on **f333** |
| G | f333-364 | **M2′ hub macro**, hub at (260, 900), ×2.2 | none | The dome is Ø 128. **No dial in frame: no ticks, no bands, nothing to read a time from.** The rotation continues −35° → 0 (12 f `EASE.expo`). |
| H | f364-420 | M2′ → **M1** pull-back (×2.2 → ×1, 20 f `EASE.inOut`) | glide from f384 | the agent's clock rebuilds (§4 b4) |
| I | f420-480 | M3′ tip macro | glide | No node within ±8° of the needle during "on the first ring" (§12). |
| J | f480-570 | **M4′ arc horizon** *ahead of* the needle: ×2.6, the arc level at y 700, dots Ø 62, the hand off-frame left | glide | The ticks hang below the arc to y ≈ 1030, clear of the box. One full-turn spin on "day". |
| K | f570-618 | M1 | glide | the reference frame; then the exit |
| L | f618-780 | end card (white), then the seam | | §7, §8 |

---

## 4. Beat sheet (30 fps targets; `timing.ts` re-anchors them on the measured takes)

**Acts** (`SCENES`): `hook` 0-94 · `second` 94-232 · `missed` 232-330 · `pickup` 330-470 · `words` 470-570 · `ring` 570-618 · `end` 618-780.

**Type grammar** (STYLE §2.4):
- **Lead:** a 7 f mask rise (`EASE.expo`).
- **Accent:** a 10 f slide + wipe that lands on the word's onset, the shot's hit. Teal from its first frame.
- **Sentence tier:** set at 72 % ink 2 f before her first word; each word lifts to 100 % on its onset.
- **Exits:** 4-5 f, `EASE.in3`.
- One moving text at a time. A lockup holds at least 1 beat after its last word lands.

| Beat · frames · s | Picture, camera, object | Type (lockup / sentence tier) | Spoken (id @ f) | Sound |
|---|---|---|---|---|
| **b1 Hook** · 0-94 · 0.0-3.1 | **Shot A (M1, tick).**<br>Node 1 reaches the needle on the f0 step (lands f3) and pops.<br>Band 1 inks in two steps (f3, f33), and the ring-1 gap passes under the needle through f60, f90 and the later steps.<br>The hand recoils +0.8° on every step.<br>Node 2 appears at the right edge after the f90 step.<br>Macro drift on. | **One ring,** / ***six seconds.*** (set at 72 % at f0).<br>Sentence tier: "One ring, six seconds." / "You can't answer."<br>Words lift on her onsets. The accent lifts as a unit on "six", with a scale pop of 3 % or less.<br>Exit up through the masks, lead → accent → tier, 2 f apart, from her last word + 6 (≈ f92). | `ig6-01` @10 ("One ring, six seconds. You can't answer.") | **`fx-trill` f0** (ring 1; it rings out by f10, `afterRing`).<br>`fx-tick` f30, `fx-tock` f60, `fx-tick` f90 (−22 dB; −26 dB under her words).<br>`fx-roomtone` floor. **No bed**: a clock and a phone in a quiet room. |
| **b2 Every second** · 94-232 · 3.1-7.7 | **f90 T1 tick cut** to **shot B (M3′, tick)**. The reading point holds its screen spot across the cut (the anchor).<br>Steps on f120 and f150 jump 306 px. Node 2 slides in from the right.<br>**f180: ring 2.** Node 2 lands under the needle on the step and pops.<br>**Snap punch-in** ×1.0 → ×1.3 about the reading point (8 f, `EASE.expo`, no overshoot).<br>Band 2 inks on f183 and f213.<br>**f210 T1** back to **shot C (M1)**. | **Lockup 2a: "And" / *every second*.** "And" rises on her word 0. *every second* lands on "every" (≈ f106).<br>2a **holds through the ring**: the open loop.<br>f186-190: 2a exits.<br>**Lockup 2b: "Someone's" / *still waiting.*** The lead lands on "someone's" (≈ f192), the accent on "still" (≈ f200). Exits f226-232.<br>Sentence tier (one screen across 2a/2b): "And every second it rings," / "someone's still waiting." "someone's still waiting." stays at 72 % through the ring. | `ig6-02a` @100 ("And every second it rings,"; must end by **f174**)<br>`ig6-02b` @192 ("someone's still waiting.") | **The bed enters** on the first beat at or after her word 0 (f105): a 120 BPM soft pulse, with the clock ticks as its hats.<br>`pop` + `sub` on "every" (≈ f106).<br>**f180:** `fx-trill` (ring 2) + `fx-tock` (the step) + `thump` −8 dB with the punch-in.<br>`tap` on "still" (same bar as the ring: one big hit per bar). |
| **b3 Missed** · 232-330 · 7.7-11.0 | **f222-232: T2 push into node 2** (shot D). Its white centre fills the frame; f232-233 are pure white.<br>**f234: shot E (M5′).** The full dial's rim contracts from ×3 to ×1 (12 f, `EASE.expo`): **the ring we fell through is the clock.**<br>Ticks sweep in (tick *i* at f234 + *i*·0.25 f), revealing 10 nodes and 10 bands. Bands 1-2 are inked, and the hand points at 42°.<br>**Time-lapse sweep:** the hand runs linear at 144°/s, phased so that it crosses node 3 on f255. Nodes 3-10 then pop **on 8ths** (f255, 262.5, 270, 277.5, 285, 292.5, 300, 307.5), and each band inks as the hand passes.<br>It reaches 12 o'clock on **f315** and stops (`SPRING.land`, 0.8°). The rim is now a teal circle with ten black bands: a full minute of rings.<br>f322-330: hold, macro drift only. | **Lockup 3: "Someone else's" / *customer.*** The lead lands on "someone" (≈ f279); the accent lands on "customer" (≈ f300).<br>Sentence tier: "A missed call is" / "someone else's customer." (set at f238).<br>Exit f318-324. | `ig6-03` @240 ("A missed call is someone else's customer.") | `whoosh-rev` peaking on the white frame (f232); `thump` on the open (f234); `draw` under the tick sweep.<br>`fx-glass-tick` on each node pop (8ths, −26 dB; drop any within 2 f of an onset).<br>`pop` + `sub` on "customer" (≈ f300; it absorbs node 9's tick).<br>`land` at f315. |
| **b4 Pickup** · 330-470 · 11.0-15.7 | **f322-330: near-silence.**<br>**f330-337: T3 whip.** The dial spins +75°; cut on f333 to **shot G (M2′)**. This is a fresh clock seen only at the hub: no dial, no reading. Its rotation continues −35° → 0 until f345.<br>**f345: the ring.** The dome shivers (scale 1 ↔ 1.04, 12 Hz, damped over 10 f).<br>**f360 (bar 7 line): THE PICKUP, on the tick.**<br>• The dome stamps (`SPRING.pop` 1 → 1.15 → 1; its shadow (6, 10) → (9, 15) and back).<br>• A 3 px teal hairline races from the hub along the hand's axis and off-frame (8 f, `EASE.expo`).<br>• The collar flashes from deep teal to teal for 4 f.<br>**f364-384: pull-back to M1** (shot H). The **agent's clock** rebuilds:<br>• the ticks sweep in;<br>• the teal arc draws on from the needle in both directions (16 f, `EASE.expo`);<br>• nodes pop as the arc reaches them;<br>• **no ring bands**.<br>From f384 the dial **glides** (§2): the reference frame, calm.<br>**f420 T1 cut** (beat) to **shot I (M3′, glide)**. | No text f324-368: the reel's one wordless beat (1.5 s or less).<br>**Lockup 4a: "Your AI" / *receptionist*.** The lead rises f368; the accent lands on "receptionist" (≈ f386).<br>**Lockup 4b: "Picks up" / *on the first ring.*** The lead lands on "picks" (at the f420 cut); the accent lands on "first" (≈ f440). The accent must measure 600 px or less, else "Picks up" / *first ring.*<br>Sentence tier: "Your AI receptionist" / "picks up on the first ring." (persists across the cut).<br>Exit ≈ f466-470. | `ig6-04` @370 ("Your AI receptionist picks up on the first ring.") | **Stop-time:** the bed ducks to near-silence over f322-326, with `riser-short` into it. `swish` peaking on f333.<br>**f345 `fx-trill`** alone, in silence (it rings out by f355).<br>**f360 `fx-pickup` + `fx-tock`** (the tick that answers) + `fx-ting` −6 dB.<br>**The bed returns on f375**, the pad up an octave. **From here there are no clock ticks**: the bed's shaker carries the 8ths.<br>`whoosh-soft` + `draw` under the rebuild.<br>`tap` on "receptionist"; `pop` + `sub` on "first". |
| **b5 Your words** · 470-570 · 15.7-19.0 | **f480 T1 cut** to **shot J (M4′, glide)**: the teal arc as a horizon, white-centred dots Ø 62 drifting right to left, the needle off-frame.<br>**On "day" (≈ f538):** the dial whip-spins one full turn in 10 f (`EASE.peel`). The black needle crosses the frame once at the spin's fastest frame, and the dial lands back in place on "night". | **Lockup 5a: "It answers" / *from your words.*** The accent lands on "from" (≈ f492).<br>2a-style switch on the comma: 5a exits f532-536.<br>**Lockup 5b: "Day" / *or night.*** The accent lands on "night" (≈ f552).<br>Sentence tier: "It answers from your words," / "day or night."<br>Exit f566-570. | `ig6-05` @478 ("It answers from your words, day or night.") | `pop` on "from".<br>`swish` peaking on the spin's fastest frame.<br>`pop` + `sub` on "night". |
| **b6 Ring it** · 570-618 · 19.0-20.6 | **f570 T1 cut** to **shot K (M1, glide)**, the reference frame. The glide is phased so a node reaches the needle on "yourself" (≈ f588) and pops.<br>**f604-618: exit.** The dial and hand recede and leave up-left (×1 → ×0.6, 8 f, `EASE.in3`; the hand plane leads the dial plane). **The teal dome stays** and glides (14 f, `EASE.inOut`) to the send disc's place (848, 1000). It grows from Ø 58 to Ø 72, its gradient flattens to `#0A8AA8`, and the white arrow draws in (6 f). | **Lockup 6: "Ring it" / *yourself.*** The accent lands on "yourself".<br>**No sentence tier**: the lockup already holds all three words.<br>Exit f604-608. | `ig6-06` @576 ("Ring it yourself.") | `fx-glass-tick` on the node pop. **No trill**: a ring never lands on a word.<br>`whoosh-soft` peaking on the exit's fastest frame; `draw` under the arrow. |
| **b7 CTA (`End6`)** · 618-720 · 20.6-24.0 | White ground, no object.<br>**f622:** the comment field rises around the disc: a white pill x 174-906, y 940-1060, r 60, a 1.5 px `#E6E6E6` border plus the long shadow; message-circle icon `#0A0A0A`.<br>AGENT types in the field one letter per 16th from her word "AGENT" (Instrument Sans 600, 50 px, ink).<br>The disc presses (.97) as "link" ends (≈ f690). | **Lockup 7: "Comment" / *AGENT*** (centred on x 540, lead baseline ≈ 760, accent ≈ 835).<br>Sentence tier: "Comment AGENT for the link." (baseline ≈ 885, clear of the field). | `ig6-07` @640 ("Comment AGENT for the link."; ends by **f705**) | The series end stack, `endHits`: `fx-menu-open`, `fx-keys` ×5, `fx-click-down` / `-up`.<br>Half-bar snare roll f690-720; the riser crests. |
| **b8 Brand** · 720-766 · 24.0-25.5 | **Impact on the bar line (f720).** The field and lockup leave up (4 f). The disc (arrow out) flies to the end of the wordmark and **stamps** as its full stop (squash 1.12 → 1, with its own shadow).<br>**NEUROVOICE** surfaces centre-out (Inter Tight 500, −0.07em, 760 px or less, y 760-900, `#0A0A0A`). **No GL bloom.**<br>`neurotechvoice.com` (Instrument Sans 450, 34 px, `#6B6B6B`, y ≈ 1000) types in three chunks on "Neuro \| Tech \| Voice". | wordmark + URL | `ig1-07` @724 (the series' one borrow) | `impactHits(720)`: `riser`, `fx-impact-end`, `thump`, `slam`.<br>The colophon's `draw`. |
| **b9 Seam** · 766-780 · 25.5-26.0 | §7 | Lockup 1 set at 72 % by f779 | none | `MIX.fadeOut` [766, 780] to below −60 dBFS. The replay's first sound is f0's trill. |

**Muted read, frame by frame:**
1. A huge clock, a mark arriving at the hand, "One ring, six seconds."
2. The dial jumps once a second; "And every second it rings, someone's still waiting."
3. We go through a ring and see a whole clock of rings racing around; "Someone else's customer."
4. A whip, a teal hub that clicks; the dial becomes the calm reference frame; "Your AI receptionist picks up on the first ring."
5. "It answers from your words, day or night."
6. "Ring it yourself."
7. The comment field types AGENT, then NEUROVOICE.

**Retention:** something lands at least every beat before the CTA: a tick or step, a ring, a node pop, a word lift, a lockup landing, a cut, a punch-in, the fall-through, the sweep, the whip, the pickup, the rebuild or the spin. Nothing on screen is static for more than 1.0 s.

---

## 5. Screens and voice lines

### 5.1 Screens (lockup words are a subset of her words; numerals stay words: "six", "first")

| Screen | Lockup (6 words or fewer) | Sentence tier | Line |
|---|---|---|---|
| S1 (set at f0) | One ring, / *six seconds.* (4) | One ring, six seconds. / You can't answer. (7) | `ig6-01` [0-6] |
| S2a | And / *every second* (3) | And every second it rings, / someone's still waiting. (8) | `ig6-02a` [0-4] |
| S2b | Someone's / *still waiting.* (3) | (same screen) | `ig6-02b` [0-2] |
| S3 | Someone else's / *customer.* (3) | A missed call is / someone else's customer. (7) | `ig6-03` [0-6] |
| S4a | Your AI / *receptionist* (3) | Your AI receptionist / picks up on the first ring. (9) | `ig6-04` [0-2] |
| S4b | Picks up / *on the first ring.* (6) | (same screen) | `ig6-04` [3-8] |
| S5a | It answers / *from your words.* (5) | It answers from your words, / day or night. (8) | `ig6-05` [0-4] |
| S5b | Day / *or night.* (3) | (same screen) | `ig6-05` [5-7] |
| S6 | Ring it / *yourself.* (3) | none | `ig6-06` [0-2] |
| S7 | Comment / *AGENT* (2) | Comment AGENT for the link. (5) | `ig6-07` [0-4] |

**The sentence tier is the transcript tier**, as in the reference, where the grey line runs 12 words. Here it is **9 words or fewer, in 3 lines or fewer, 540 px wide at most**. That goes past the series' 7-word caption cap. If the judges hold the cap, split S4's tier into "Your AI receptionist" (with 4a) and "picks up on the first ring." (with 4b), and S2's at the comma.

### 5.2 Voice lines (Tessa only; `speak` with no `<break/>`; series voices block)

| id | `say` | Tokens | Note |
|---|---|---|---|
| `ig6-01` | One ring, six seconds. You can't answer. | 7 | hook |
| `ig6-02` | And every second it rings, someone's still waiting. | 8 | **Synthesised as one take** and split at the comma by its word timestamps into `ig6-02a` [0-4] and `ig6-02b` [5-7], so the first half keeps its unfinished intonation. If the split sounds cut, synthesise `ig6-02a` with a rising read and `ig6-02b` alone, and pick by ear. |
| `ig6-03` | A missed call is someone else's customer. | 7 | voice.md position 1 (opinion) |
| `ig6-04` | Your AI receptionist picks up on the first ring. | 9 | site claim (B) |
| `ig6-05` | It answers from your words, day or night. | 8 | |
| `ig6-06` | Ring it yourself. | 3 | the trim (§5.3) |
| `ig6-07` | Comment AGENT for the link. | 5 | a fresh take (the pipeline allows one borrow only); `speak` uses a lowercase "agent" |
| `ig1-07` | Neuro Tech Voice. | 3 | the borrow, byte for byte |

**Alternates** (same batch):
- `ig6-01b` "One ring, six seconds. Your receptionist can't answer." (TikTok B, §1.2).
- `ig6-04d` "It picks up, day or night." (the first-ring fallback, §12). With it, `ig6-05` becomes `ig6-05w` "It answers from your words." so "day or night" is not said twice.
- `ig6-07b` "The link's in our bio." (only if nobody can answer AGENT comments on posting day).

**47 tokens** before the sign-off. That is within the 45-55 the style wants (RESEARCH-viral §2.3) and the 60 or fewer of STYLE §3.

### 5.3 Word-rate and anchors (Tessa: 2.78 tokens/s mean, number-heavy lines 2.45; ig5 measured)

| Anchor | Rule |
|---|---|
| Ring 1 / ring 2 | **f0 / f180, fixed**: six real seconds. That is the honest demonstration of F1. `ig6-01` + `ig6-02a` must end by f174 (no onset in (ring − 6, ring + 10)). At 2.78 tokens/s they end ≈ f152; at 2.45, ≈ f165. If a take is longer, re-take it; never move ring 2. |
| The agent's ring / pickup | The ring falls on the first beat at least 12 f after the whip cut (f345); the pickup lands on the next bar line, or failing that the next beat, at least 15 f after the ring (f360). `ig6-04` starts at the pickup + 8 f or later. |
| CTA | `ig6-07` starts at about 82 % (f640) and must end by **f705** (impact − 15). |
| Plan at 2.78 tokens/s | `ig6-01` 10-88 · `02a` 100-152 · `02b` 192-226 · `03` 240-316 · `04` 370-467 · `05` 478-564 · `06` 576-609 · `07` 640-690. Spare: 15 f. |
| At 2.45 tokens/s | The CTA ends ≈ f703 (tight). **Trim T1:** drop `ig6-06` (−1.1 s; the exit follows `ig6-05`). If it is still long, **move the end card one bar** (impact f780, END f840, 28.0 s) and spend the spare bar on holds. |

**`beats.py` (`--target 26`, 165 wpm):**
- **18.2 s of speech.** The 7.8 s "under target" is the planned air: the ring-2 gap, the fall-through, the sweep, the wordless pickup beat and the end card.
- **"Beats 2-4 have nothing concrete."** The text heuristic misses the picture, which is concrete in every beat (the ring, the full dial, the pickup).
- **"No loop."** The spoken echo is `ig6-06` "**Ring** it yourself" → "One **ring**". The real loop is the seam (§7); the series' last line is always the sign-off.

### 5.4 Bed (`MUSIC`)

- The ig5 stub arrangement, with no new `scripts/ig6/bed.mjs` unless the critics ask for one.
- `bedFrom` f105.
- `stop` [f322, f375), measured from the placed takes, never from plan frames.
- `roll` f690, `impact` f720, `brand` f724.
- Before the pickup, the clock ticks act as the hats. After it, the bed's shaker does.

---

## 6. The two clocks (what the picture says without a word)

| | Before the pickup (your phone) | After the pickup (the agent) |
|---|---|---|
| Motion | **steps** once a second, with a kick | **glides**, linear and silent |
| Sound | tick-tock every second, a trill on each ring | no ticks; the bed's shaker |
| Dial | ring bands inking black, ring after ring | no bands: a clean teal arc with white-centred dots (the reference frame) |
| Hub | teal, idle | stamps on the tick; teal runs up the hand |

---

## 7. The loop seam (f766 → f780 ≡ f0)

1. **f766-770:** the wordmark and URL leave up through their masks (4 f, `EASE.in3`).
2. **f766-776:** the dome (the full stop) glides to the hub's frame-0 spot (97, 1183), sizes to Ø 58 and takes its gradient back.
3. **f770-778:** the black hub disc grows out from under it. The hand extends from the hub to full length (8 f, `EASE.expo`) at 30°, and its shadow wrapper fades in.
4. **f768-779:** the dial draws on from the reading point outward: the teal arc trims on, then the ticks sweep in, then node 1 appears 6° before the needle with ring 1's grey band behind it. This is the exact frame-0 state.
5. **f772-779:** lockup 1 rises to 72 %.
6. **f780 = the replay's f0:** the dial's first step and the trill. Node 1 lands on f3.

The seam lands on frame 0's state **with its velocities**. The step and the node pop both begin on f0, so the replay starts mid-motion, not from rest. The last word heard is "Neuro Tech Voice."; the first is "One ring". The story loops too: a fresh caller rings.

---

## 8. End card: `End6` (the NEUROVOICE wordmark in the white style)

Built in `src/ig/ig6/End6.tsx` from the `End.tsx` exports (`Wordmark`, `WORDMARK_FONT`, `WORDMARK_TEXT`, `END` geometry, `agentKeys`, `ctaLine`) and `impactHits` / `endHits`. **It never edits `End.tsx`.**

| Part | Spec |
|---|---|
| **The through-line** | The teal dome travels hub → send disc (b6) → the wordmark's full stop (b8) → hub (seam). "The agent at the centre of every second." |
| **CTA lockup** | "Comment" (Instrument Sans 580, 60 px, ink) / ***AGENT*** (Cormorant Italic 600, 110 px, teal), centred on x 540 in the series' CTA band (y 700-860). The sentence tier "Comment AGENT for the link." sits at 32 px grey, baseline ≈ 885, and must measure 720 px or less. |
| **Comment field** | `END.field` geometry (x 174-906, y 940-1060, r 60); the series' one zone exception, still about 40 px clear of TikTok's icons. White fill, 1.5 px `#E6E6E6` border, the long shadow (24, 48, 10 px, 7 %). Icon and text are `#0A0A0A`. The send disc is the dome, Ø 72, flat `#0A8AA8`, with a white arrow. |
| **Impact** | `impactHits(720)` on the bar line. No `LightGL` bloom: the impact is the disc's stamp plus the wordmark surfacing centre-out. |
| **Wordmark** | NEUROVOICE exactly as the series sets it (Inter Tight 500, −0.07em, 760 px or less, y 760-900), in `#0A0A0A` (or the brand plum `#1E0B38`, which reads the same on white). Its full stop is the dome, baseline-aligned, Ø = x-height × 0.55. The letters are never altered. |
| **URL** | `neurotechvoice.com` (the series' URL: changing it would re-render ig1-ig5). Instrument Sans 450, 34 px, `#6B6B6B`, typed on "Neuro \| Tech \| Voice". |
| **Fallback** | `IgEnd` unchanged with `tone="pearl"` (series-true, but its teal bloom is a glow on white, which the style excludes). In that case b6's exit ends with the dome shrinking into the white, and `IgEnd`'s own field appears. |
| **TikTok** | TikTok has no keyword auto-DM. Its caption says "Link in bio" (RESEARCH-product §7). One master serves both apps. |

---

## 9. Cover

Custom PNG `IG6-Cover-9x16`, 1080 × 1920. Every word sits inside x 86-900, y 260-1380, so it is legible in the 3:4 grid tile (y 240-1680). Every word on it is spoken in the reel.

- **Picture:** frame 0's composition with node 1 popped under the needle and ring 1's band half-inked. It is drawn bolder for the tile: arc 12 px, bands 30 px, ticks ×1.33, shadow 9 %. The teal accents are the arc, the dome and the italic. Because the tile matches TikTok's autoplay frame 0, the profile grid and the feed agree.
- **Kicker:** `AI RECEPTIONIST · 06` (Instrument Sans 600, 28 px, tracking +0.08em, `#6B6B6B`), left-aligned with the lead word at x ≈ 345, y 1050-1078. It carries the search keyword (spoken in `ig6-04`) and the series number. It sits above the lockup, not under the dial's ticks.
- **Title lockup:** "One ring," (84 px) / ***six seconds.*** (126 px teal, 570 px wide or less); the accent baseline is ≈ 1255.
- **Stakes line:** "You can't answer." (40 px, `#6B6B6B`), centred under the accent, bottom at 1340 or above.
- **No** reading, numeral, price or app UI.
- **Fallback:** frame 0 itself.

---

## 10. Why it gets shared and rewatched on TikTok

1. **You feel the six seconds.** Ring 1 and ring 2 are exactly six real seconds apart, with a tick each second, so a sound-on viewer counts them without being asked. Every owner knows the phone that rings while their hands are full. Here, that feeling becomes a measured unit. [K]
2. **A TIL fact with no claim in it.** "One ring is six seconds" is trivia most people have never heard: shareable, saveable and correctable ("ours rings faster in the UK"). Corrections are comments, and the reply is ready (below). [K; F1]
3. **The open loop is the sentence itself.** "And every second it rings," is cut off by ring 2. Viewers stay to hear it finish (the information gap, Loewenstein [A4], applied to syntax). [K]
4. **A transformation you can hear.** Anxious ticking becomes a silent glide, and black ring bands become a clean teal arc. That "satisfying" layer is what this style trades on (a hypothesis: Live Science notes no dedicated studies, S11). The pickup lands on a downbeat after 1.5 s of near-silence, which is the reel's biggest moment.
5. **Design-forward and faceless.** It reads as a motion piece, not an ad, in a feed of faces. The ring-clock dial (the cadence printed on a clock) rewards a second look. Designers send it ("how did you build this?"), which is the reference's own comment engine.
6. **It loops on a ring.** The end re-forms frame 0 mid-motion, and the replay starts on the trill. TikTok weights completion heavily [P1], and Instagram counts replays as views [S5].
7. **One keyword ask, plus an honest dare.** "Ring it yourself" invites the viewer to test the claim, and AGENT is the way in.

**TikTok caption, first line** (searchable; the caption stage finalises it): "One ring is six seconds. An AI receptionist that picks up on the first ring." Then "Link in bio."

**Pinned reply, prepared for the comments:** "That's the North American ring (2 s on, 4 s off). Yours may ring a little faster."

---

## 11. Facts and claims it uses (nothing else)

| On screen / spoken | Grade | Source |
|---|---|---|
| "One ring, six seconds." and the ring clock's 2 s band plus 4 s gap; 10 nodes per minute (60 / 6, shown, never said) | **A** (a standard, not a survey); **US and Canada only** | ANSI T1.401-1988 §5.4.2, "2 sec on, 4 sec off", via https://www.zytrax.com/tech/telephony/ring_patterns.htm [P3]; https://en.wikipedia.org/wiki/Ringing_tone [S12] (RESEARCH-viral F1). Europe (ETSI) is 1 s on / 4 s off; the UK differs. |
| "And every second it rings, someone's still waiting." | true by definition | RESEARCH-product S20 (its wording plus "And" and "still") |
| "A missed call is someone else's customer." | opinion; **never with a %** | voice.md position 1; RESEARCH-product S21 |
| "Your AI receptionist" | noun | S22 (never with "replace", "fire" or "instead of") |
| "picks up on the first ring" | **B**: site copy, never measured; **no number on our side** | `lib/pages/ai-agents.ts:40`; `lib/site.ts:713, 944`; `lib/pages/home/call.ts:17` (RESEARCH-product S1, §2.1) |
| "It answers from your words" | A | `lib/pages/home/pricing.ts:67`; `lib/voice/session-loader.ts:236`; knowledge base on every plan, `lib/pages/knowledge-base.ts:496-497` (S6) |
| "day or night" | A, as the default always-answer (on screen instead of "24/7") | `lib/site.ts:944`; `lib/voice/router.ts:198-224` (S4) |
| "Ring it yourself." | A (trial test calls are free, 5 a day) | `lib/site.ts:1813`; `lib/billing/entitlements.ts:39`; `lib/billing/usage.ts:623` (S17) |
| "Comment AGENT for the link." | A, **if** AGENT delivers the trial link and setup help | voice.md "The ask"; RESEARCH-product §7 |

**Caption fine print** (paste-ready, from RESEARCH-product §8):
> Free trial: 5 minutes over 14 days, no card needed. On the trial it answers your own test calls; to answer customers, the agent needs its own phone number ($1.15/month, card required). One agent per business, set to one of 14 languages. It tells every caller it's an AI. One ring = 2 s of tone + 4 s of silence, the North American standard (ANSI T1.401).

---

## 12. Self-check

| Rule | Status | How |
|---|---|---|
| No invented statistic, result or testimonial | **PASS** | The one number is a cited standard (F1), scoped in the caption. No %, no hang-up time, no voicemail time (F-U8, F-U9), no caller-behaviour figure. The ten-ring sweep is a visible time-lapse, not a claim. |
| No number on our speed (U3) | **PASS, by design** | The dial never has numerals. **The pickup happens off the scale:** shot G is a hub macro with no dial, no ticks and no bands, and the clock's tick sound has stopped, so no seconds can be counted. When the dial returns, it glides with no bands, so nothing reads as "answered at second X". During "on the first ring", no node passes the needle. "Six seconds" left the screen at f92. |
| No takeover / forwarding picture (U5) | **PASS** | The agent answers **a fresh call** after a whip, on **ring 1** of a new clock. It never takes ring 11 of the unanswered one, and the line itself says "first ring". No "your line", "busy", "forward" or "keep your number". |
| "First ring" is B (unmeasured) | **PASS with a launch check** | Before posting, the owner calls a live agent number 5 times from a US or Canada phone. Each call must be answered before the second ring starts. If any call reaches a second ring, swap in `ig6-04d` "It picks up, day or night." + `ig6-05w`. |
| No absolutes (U1, U2) | **PASS** | No "never miss", no "every call answered". "Every second" describes the caller's side (S19/S20). "Day or night" is used on screen instead of "24/7". |
| No booking, price, minutes or plan names | **PASS** | One cut. Nothing tied to $49. |
| Trial truth | **PASS** | "Ring it yourself" is exactly what the trial allows. "Free" is not said; the fine print carries it. |
| Product scope | **PASS** | No languages switching, no voice cloning, no recordings, no "sounds human". The fine print says it tells every caller it's an AI. |
| No competitor | **PASS** | none |
| Series coherence | **PASS, with one flag** | Teal stays "ours". The receptionist appears only as "your AI receptionist", never replaced or fired. "You can't answer" echoes ig5's "You can't" (motif or repeat: judges). For the B hook, the caption adds "Keep your front desk for the work only people can do." The series sign-off, URL and AGENT CTA are kept, and the end card keeps the series' beats. |
| Voice rule | **PASS** | Tessa speaks every lockup and every tier word. Frame 0's lockup is set 10 f before her first word (the series' frame-0 rule). Lockup 2a holds silently through ring 2 (≈ 1 s), mid-sentence. The one text-free beat (f324-368) is also voice-free. |
| 6 words or fewer per lockup; hook in 0-2 s | **PASS** | The longest lockup is 6 words (S4b). The hook card is readable at f0, and "One ring, six seconds" is heard by ≈ 1.7 s. **Flag:** "AI receptionist" is heard at ≈ 12.5 s, not the ~3 s RESEARCH-viral asks for. It is on the cover kicker and in the TikTok caption's first line, and the B hook moves "receptionist" to ≈ 1.5 s. |
| Safe zone | **PASS by layout** | Text sits in x 300-900, y 1080-1400 (end card y 700-1060). Below y 840, objects stay at x ≤ 880. To be proved with an ig6 copy of ig5's zone rule (`zones.ts`, guard). |
| Reference originality | **PASS, flagged** | The composition copies the reference's measurements, which is the owner's ask. The dial markings, sentence, type pairing, colour and story are ours, and there is no watermark. The hand silhouette is the reference's (variant in §14). |
| Secrets | **PASS** | No key read or printed; no Cartesia call. |

---

## 13. Production risks (Remotion, no three.js)

1. **Ring vs voice.** The series trill lasts 0.32 s, so the 2 s tone is **drawn** (the band), not heard. An ig6-local `fx-ring-na` (2 s, high-cut at 900 Hz, −20 dB under the trill's attack) is optional, and only if `check-mix` passes its onset windows. The anchors (§5.3) keep every ring clear of an onset.
2. **Ticks under her voice.** `fx-tick` / `fx-tock` sound every second under `ig6-01` to `ig6-04`, which risks masking in `check-mix`'s 200 ms onset windows. Duck them to −26 dB under words. Fallback: the bed's hats take the ticks.
3. **The node zoom-through (×200).** At this scale, strokes, the arc and the hand scale off-frame. Cull every layer but the node once it passes ×6. Give the node's ring a non-scaling stroke so it doesn't turn into a 1000 px annulus. The pan toward the centre keeps the needed scale near ×184. Test SVG precision at 120 fps. **Fallback:** a T3 whip into M5′.
4. **The macro parallax.**
   - The hub sits 640 px from the dial's centre in M1 and M3′ (STYLE §2.1), but at the true centre in M5′. The T2 cut hides the change.
   - The M2′ → M1 pull-back keeps one set of k factors (dial 1.00, hand 1.12, hub 1.15).
   - The reading point (where the needle crosses the arc) is computed numerically per frame: about 0.63° of dial per 1° of hand.
5. **Shadows.**
   - The `drop-shadow` sits on a non-rotating wrapper. Otherwise the light turns with the hand in M5′'s sweep and the whips.
   - Run a 2 s probe of the 7 % ramps on white in the 60 fps upload encode for banding before the master (STYLE §7.5).
   - The `IgFinish` paper grain is set to 0.
6. **Render cost.** The world is a 3246 px dial with up to 380 marks, plus 120 fps transforms. Draw only the visible angular window. Put transforms on layer divs, not on SVG children. Use `geometricPrecision` and strokes of 2 px or more.
7. **Motion at 60 fps without blur.**
   - Steps move 28-51 px per 60 fps frame.
   - The 75° whip moves ≈ 38 px per frame at the rim.
   - The full-turn spin in 10 f is the fastest move (≈ 150 px per 60 fps frame at the M4′ arc). Check it for strobing. If it strobes, slow it to 14 f.
8. **Fonts and widths.**
   - Cormorant Garamond Italic 600 loads from `src/ig/ig6/fonts.ts` (never `src/lib/fonts.ts`), and canvas measurement waits on `useIg6Faces()`.
   - Measure *six seconds.* (570 px or less at 126 px), *on the first ring.* (600 px or less, else *first ring.*), *from your words.* and *AGENT*.
   - The zone guard doesn't test text against object strokes, so add a still-frame overlap check of the lockup box against the object layers.
9. **The seam.** f779 → f0 must match in position **and** in motion (the step and the node pop). Render a two-pass loop strip and diff the frames around the seam.
10. **The split take** (`ig6-02`). The prosody across a 1 s ring gap may sound cut. Keep the two-take fallback (§5.2).
11. **Time-lapse phase.** The node pops sit on 8ths only at exactly 144°/s, phased to f255. If `ig6-03` runs long, keep the sweep and hold longer; never stretch the sweep.
12. **Path drawing.** Use the `strokeDasharray` / `strokeDashoffset` trims, so no new dependency is needed. `@remotion/paths` is importable but not in `package.json`.

---

## 14. Open decisions for the owner and the judges

1. **End card:** `End6` (recommended, style-true, with the dome through-line) or `IgEnd` unchanged.
2. **Serif-italic exception:** the accent phrase only (STYLE §4.2).
3. **Sentence tier:** 32 px, up to 9 words (past the series' 7-word cap), or split it (§5.1).
4. **Hook:** "You can't answer." as the series motif, or accept the repeat risk. B hook `ig6-01b` for TikTok a week later.
5. **Launch check** for "first ring" (§12), and the `ig6-04d` fallback.
6. **Hand tip:** the reference's hollow diamond (most faithful, recommended), or a hollow-ring "pomme" tip (a classic watch hand, and a pun on "ring") if the judges read the diamond as a copy.
7. **26.0 s** (13 bars), with 28.0 s only if the measured CTA overruns.
