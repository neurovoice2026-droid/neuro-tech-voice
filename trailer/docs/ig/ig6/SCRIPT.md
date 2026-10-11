# ig6 · "One ring" (SCRIPT)

Label `synth`. Written 2026-10-11 on `claude/remotion-trailer` (HEAD `7b67638`; product code unchanged since `9cb3bc8`). Planning only: every file of this run is in `docs/ig/ig6/`. No code, no Cartesia call, nothing committed.

**Inputs:** `STYLE.md` (the look, measured), `RESEARCH-viral.md` (format, facts F1-F6), `RESEARCH-product.md` (SAFE S1-S22, UNSAFE U1-U21), the four concepts in `drafts/` and the four judges (`judge-style.md`, `judge-growth.md`, `judge-truth.md`, `judge-viewers.md`). Companion files: `STYLE.md` §9 (the build spec for this script), `voice-lines-draft.json`, `POSTING.md`, `PIPELINE.md`.

**Geometry mocks** (layout check, not the art): `scratchpad/synth6/mocks.png` (frame 0, f100, f318, f392, f470, the end card, the cover; safe zone red, TikTok rail orange, lockup box blue), drawn with the real faces by `scratchpad/synth6/mock.py`; a copy is `docs/ig/ig6/mock-one-ring.png`. The timing model is `scratchpad/synth6/fit.py`.

---

## 0. Decisions

### 0.1 The reel in one table

| | |
|---|---|
| **Title** | **One ring** |
| **Slug** | `one-ring` → out name `neurotechvoice-ig6-one-ring` (ig5's separate-registry route: `scripts/ig6/`, `src/ig/ig6/`, PIPELINE.md) |
| **Length** | **28.0 s = 840 timeline frames at 30 fps** (14 bars at 120 BPM; 3360 render frames at 120 fps). **Impact f780** (bar 14 line), brand f784, seam f826-840, END f840. |
| **Hero object** | One clock in macro, our own **ring clock**: a teal rim with a hollow node every 36° (one per North American ring of 6 s) and fine ticks, one black hand with a hollow-lozenge tip drawn in our own proportions, a hub dome. Two states of the same object: **your phone** (it ticks, its ring stretches turn black, graphite hub) and **the agent** (it glides, clean teal rim, teal hub, teal domes where calls were picked up). |
| **Hook (spoken)** | **"One ring, six seconds. Your receptionist can't answer."** hookscore 84.4 STRONG (raw and patched). |
| **Frame 0 (muted)** | The reference composition raised into the safe zone: giant cropped dial, black hand on the diagonal, a ring node arriving at the needle with a hairline ping, and the lockup **One ring, / *six seconds.*** set at 72 % ink. By 2.0 s the big type becomes **Your receptionist / *can't answer.*** |
| **Voice** | Tessa (Emotive), the series voices block, on every on-screen word. **42 words before the sign-off** + `ig1-07` "Neuro Tech Voice." (borrow). |
| **Palette** | `#FFFFFF` ground, `#0A0A0A` ink, `#6B6B6B` sentence tier, tick greys, graphite `#3A3A3A` (your phone's hub), and **one accent, teal `#0A8AA8`** (deep `#0E7490`). |
| **Type** | Instrument Sans 580 lead / teal **Cormorant Garamond Italic 600** accent / Instrument Sans 450 32 px grey sentence tier (the transcript). Big lockup ≤ 6 words, tier ≤ 7 words per screen. |
| **End card** | `End6`, the white end card (STYLE §4.4, §9.10): comment field types AGENT, the teal dome stamps as the full stop of NEUROVOICE, URL typed on "Neuro \| Tech \| Voice". Fallback: `IgEnd` unchanged. |
| **Claims** | One cited standard (the North American ring, ANSI T1.401) and SAFE product lines only. **No statistic, no price, no booking, no minutes, no number on our speed, no "first ring".** |
| **Cuts** | **No content split**: nothing waits on the unshipped Starter booking (`lib/billing/entitlements.ts`: starter `googleIntegrations: false`), so there is no booking/no-booking pair. **Two hook renders** of the same body, made together in the master step (PIPELINE.md §6.4): **A** (`ig6-01`, posted on both apps) and **B** (`ig6-01b`, the TikTok re-cut a week later). They differ by one voice id and the S1b lockup. |

**The reel in one breath.** A giant clock, cropped like the reference, ticks once a second. A phone rings on a tick: "One ring, six seconds. Your receptionist can't answer." The dial steps forward six times and the second ring lands exactly six real seconds later, in the middle of her sentence: "While it rings, [ring] someone's still waiting." We fall through the ring marker and come out on the whole dial: a clock that counts rings. Its hand jumps through a minute of them and the rim fills with black stretches of ringing: "A missed call is someone else's customer." Silence, a whip. A fresh call rings at the hub of a clean clock, and on the bar line the hub stamps and turns teal: picked up. The clock rebuilds in teal, the anxious ticking stops and the dial glides: "Our AI receptionist picks up, day or night." The hand sweeps a whole day and teal dots land where calls came in. "It answers from your words. Ring it yourself." The teal dome becomes the send button, "Comment AGENT for the link.", stamps the full stop after NEUROVOICE, and flies back to the hub as the loop restarts on the first ring.

### 0.2 What was chosen, and from where

**Winner: the clock concept** (`drafts/concept-clock.md`), rebuilt with every judge's required fixes and the best parts of the other three.

| Judge | Clock | Phone | Sign | Free | How it weighed here |
|---|---|---|---|---|---|
| Style fidelity (`judge-style`) | **9** (9.5 after fixes) | 5 (6) | 6.5 (7.5) | 7 (7.5) | weighted highest with growth: the owner asked for a clip "exactly in this style" |
| Growth (`judge-growth`) | 6.5 (**≈ 7.0** with a day-1 receptionist hook) | **8.0** (8.5) | 6.0 | 6.2 | weighted highest with style |
| Truth (`judge-truth`), hard gate | 7 → **9** after fixes | 6.5 → 8.5 | 9 → 9.5 | 8.5 → 9.5 | every concept passes once fixed; the clock's one blocker (T-C1) is fixed below |
| Production (`judge-truth`) | 6 → 7.5 | 4.5 → 6.5 | 7.5 → 8.5 | 7 → 8 | |
| Viewers, first 3 s (`judge-viewers`) | 60 | **70** | 65 | 60 | an input on the opening, not the verdict |

**Style + growth after fixes:** clock 9.5 + 7.0 = **16.5**, phone 6 + 8.5 = 14.5, free 7.5 + 6.2 = 13.7, sign 7.5 + 6.0 = 13.5. The clock is the literal reference look the owner pointed at; its growth weaknesses (no receptionist keyword on day 1, a weak muted frame 0, a late keyword) are fixable with grafts, while the phone's style gap (10 % ink, a stock ☎ silhouette, comic ring lines) and its build risk are not.

**Grafts and fixes (each one traced):**

| # | Change | From | Why |
|---|---|---|---|
| G1 | **Receptionist hook on day 1**: "One ring, six seconds. Your receptionist can't answer." (the clock's TikTok B / ig7 hook, 84.4) becomes the A hook; the original "…You can't answer." becomes the B hook a week later. | growth §2 runner-up note; viewers §3.2 (owner-operator B hook) | the only hook family with a record (ig1 563 vs ≤ 283); "receptionist" heard at ≈ 1.9 s instead of 12.5 s; removes the "You can't" repeat of ig5 |
| G2 | **The stake in big type by 2 s**: the hook card switches from "One ring, / *six seconds.*" to "Your receptionist / *can't answer.*" on "Your". | growth §1 (frame-0 card 45.2 WEAK), viewers §5.2, sign's muted logic | a muted viewer gets object + ring + stake from big type alone |
| G3 | **The ring reads muted**: each ring sends one 2 px ink hairline ping out of its node and the node shivers. | viewers §3.1 ask (ring arcs), toned down by style §2 T8 (no comic lines: one hairline ping, no arcs) | "ring" no longer depends on the 32 px tier |
| G4 | **Teal for the agent only**: your phone's hub is graphite and its nodes hollow; the agent's hub is teal and its calls are filled teal domes. The teal rim stays at frame 0 so it still reads as the reference. | style fix 5; sign's grey → teal story | the colour carries the plot |
| G5 | **Ring stretches are the rim itself**: the 9 px rim turns grey → ink over each ring's 2 s, no 24 px bands. | style fix 2 | the bands read as a progress bar |
| G6 | **No reference words in the accent tier**: `ig6-02` "While it rings, someone's still waiting." replaces "And every second it rings…"; the title "Every second" becomes "One ring". | style fix 1 (approved by truth §8; "And" dropped for the f174 deadline, §5.2) | STYLE §6: copy the style, not the sentence |
| G7 | **"First ring" is out**; the payoff is "Our AI receptionist picks up, day or night." | truth T-C1 | "one ring = 6 s" + "first ring" = a speed number by arithmetic (U3) |
| G8 | **The full-turn spin at M4′ is gone**; the agent's day is a linear sweep at M5′ (17 px per 60 fps frame). | style fix 3 | the spin ran ≈ 1,325 px per frame |
| G9 | **T2 push-throughs use a computed screen-space disc** (world ×12, then a circle drawn per frame). | style fix 4, §4.3 | no ×200 SVG stack |
| G10 | **The hand in our own proportions** (lozenge longer and narrower, collar lower, needle thinner; STYLE §9.5). | style fix 6 | frame 0 is not a trace of the reference |
| G11 | **T4 line match**: on "receptionist" a teal line draws out of the hub and underlines the keyword. | phone's T4 (style fix 7) + growth G1 (keyword in big type) | "AI receptionist" in 110 px teal, underlined by the agent |
| G12 | **Plan at 28.0 s**, with the hook ladder and holds that keep every deadline at 2.45 words/s. | truth P-C1 | §5 |
| G13 | **Agent calls are a handful at irregular times**, never a full ring of teal. | truth on sign (§4.1: "a handful, not all calls") | no "every call" picture (U1, U2) |
| G14 | Caption question, reply bank, the North American scoping, its-own-number line. | free §8 (G4), truth R1, R3 | POSTING.md |

### 0.3 Rejected, with the reason

| Idea | Why not |
|---|---|
| Phone "Off the hook" as the winner | Best growth score, but style fidelity 5 (frame-0 ink 10 % vs the reference's 2.6 %, a stock ☎ silhouette, comic ring lines), production 4.5 (coiled cord, two drawings of one handset), 54 words that miss the CTA deadline at 2.5 words/s, and the closest picture to a takeover (U5). Its two best ideas (the receptionist family, the T4 underline) are grafted. |
| "…picks up on the first ring." | T-C1: with "one ring, six seconds" it tells the viewer we answer within 6 s, a latency the product has never measured (`lib/site.ts:706-713`). Parked; it could only come back after a logged launch check on a US/Canada number (truth R2), and the owner would have to ask. |
| The sentence tier as one 8-word screen at frame 0 | Truth R9 holds the series' 7-word caption cap. Split per sentence (owner question 3 can lift it). |
| "And while it rings, …" (with "And") | +1 word pushes `ig6-02a` past its f174 deadline at 2.5 words/s (§5.2). |
| A full 10-node teal ring on the agent's clock | Reads as "every call answered" (U2). Five calls at irregular times instead. |
| The 26.0 s cut | Fits at 2.78 words/s but only 4 f spare at 2.5 and fails at 2.45 (§5.2). |
| Ring arcs around the node (phone style) | Comic convention (style T8). One hairline ping only. |
| A bell or a 2 s North American ring tone | Masks her onsets; the series `fx-trill` is kept and the 2 s tone is **drawn** (the rim inking). |

### 0.4 Series rules kept

120 BPM grid, impact on the bar line, Tessa on every on-screen line, frame-0 lockup set at 72 % ink 10 f before her first word, one moving text at a time, AGENT CTA typed per 16th in the comment field, NEUROVOICE wordmark, `neurotechvoice.com`, the `ig1-07` sign-off borrow, a 14 f seam that re-forms frame 0, "AI receptionist" as the search keyword, never "replace/fire your receptionist", no prices on Instagram, typographic apostrophes everywhere text renders.

---

## 1. The hook (f0-f120, 0.0-4.0 s)

### 1.1 Frame 0, exactly

Everything in screen px at 1080 × 1920 (STYLE §1.6 layout). Mock: `mocks.png` panel 1.

| Element | Frame-0 state |
|---|---|
| Ground | flat `#FFFFFF`; no grain (STYLE §9.2) |
| Dial (your phone) | centre (−9, 1814), R 1623, **rotation 0**. Teal rim 9 px enters the left edge at y ≈ 191 and leaves the right edge at y ≈ 611. Ticks inside the rim: fine every 1.2° (r 1512-1554, 2 px `#D6D6D6`), seconds every 6° (r 1505-1556, 3 px `#9A9A9A`), majors every 36° at each node (r 1497-1560, 4 px `#222222`). Nothing reaches below y 787: the dial clears the TikTok rail. |
| Ring node 1 | at dial angle 28.1°, screen ≈ (755, 381): 6° right of the needle. Ø 24, 6 px ink ring, white centre. **Its 2 s ring stretch** (the rim from 28.1° to 40.1°) is pending grey `#D6D6D6`. Behind the needle the rim is clean teal: there is no ring before ring 1. |
| Ping | one 2 px ink hairline circle centred on node 1, Ø 24 at f0 (it expands from f0, §1.2). |
| Hand | pivot (97, 1183), 30° clockwise from vertical, 1095 long, tip (644, 235). Our profile (STYLE §9.5): tapered body, hollow concave lozenge (waist s 772), 12 px needle, deep-teal collar at s 618-632. The needle crosses the rim at the **reading point (601, 310)**, dial angle 22.07°. |
| Hub | black disc Ø 96 with a **graphite** dome Ø 54 (`#3A3A3A`, no teal: your phone). |
| Shadow | the long shadow (24, 48, blur 10 px, 7 %) under hand + hub, on a non-rotating wrapper; the dial casts none. |
| Lockup 1a (set at 72 % ink) | lead **One ring,** Instrument Sans 580 69 px, tracking −0.03em, x 345, baseline 1150 (281 px wide). Accent ***six seconds.*** Cormorant Garamond Italic 600 126 px, −0.01em, teal, x 330, baseline 1236 (499 px, ends x 829). Tier "One ring, six seconds." Instrument Sans 450 32 px `#6B6B6B`, centred on x 580, baseline 1296 (317 px). |
| Camera | M1 (screen = world) with the macro drift already running (scale +1.5 %/s about the reading point). |
| Muted read in under a second | a huge clock, a mark on its rim pinging at the hand, "One ring, *six seconds.*" |

### 1.2 Frame by frame (30 fps timeline frames; voice onsets are plan values at 2.78 words/s, `timing.ts` re-anchors them on the measured take)

| Frame | Picture | Type | Voice | Sound |
|---|---|---|---|---|
| **f0** | **Step 1 begins**: dial rotation 0 → −6° (3 f, `EASE.expo`, overshoot to −6.8°, settles on `SPRING.land` by f8). Hand recoil +0.8° (2 f) and settle. Node 1 **pulses** (scale 1 → 1.15 → 1, `SPRING.pop`) and **shivers** (±2 px across the rim, 12 Hz, damped over 12 f). The ping expands Ø 24 → Ø 220 and fades 60 % → 0 (14 f, `EASE.expo`). | 1a at 72 % | (none yet) | **`fx-trill`** (ring 1; series HEAD −4 dB); `fx-roomtone` floor. No bed. |
| f3 | Step lands: **node 1 sits under the needle**. Its ring stretch starts inking: the rim between node 1 and the needle turns ink as the needle passes it. | | | |
| f10 | | | **`ig6-01`** "One" | trill has rung out (`afterRing`) |
| f16 | | "One ring," lifts to full ink (each word on its onset, 2 f) | "ring," | |
| f24 | | ***six seconds.*** lifts to full ink as a unit, scale pop ≤ 3 % | "six" | |
| f30 | Step 2 (−12°): the first 6° of ring 1's stretch are ink. Recoil. | | | `fx-tick` −26 dB (under words) |
| f30 | | tier word "seconds." lifts (the step's tick is dropped if check-mix flags this onset) | "seconds." | |
| f45-50 | | **1a exits** up through its masks (from "seconds." + 15 f), 1 f apart: lead f45-48, accent f46-49, tier f47-50 (`EASE.in3`) | (sentence pause) | |
| f50 | | **Lockup 1b** (only once 1a has cleared): tier "Your receptionist can't answer." set at 72 % (6 f rise of 16 px, `EASE.house`); lead word "Your" mask-rises from its onset (7 f, `EASE.expo`), Instrument Sans 580 66 px, x 360, baseline 1150 | f50 "Your" | |
| f54 | | lead word "receptionist" mask-rises | f56 "receptionist" | |
| f60 | Step 3 (−18°): ring 1's stretch is fully ink (2 s of tone done; the rest of the 6 s is silence). Recoil. | | | `fx-tock` −26 dB |
| f68-78 | | accent ***can't answer.*** Cormorant 120 px, x 345, baseline 1230 (545 px, ends x 890): slide −40 px → 0 + left-to-right wipe, 10 f `EASE.expo`, **landing on "can't"** | f78 "can't" | **`pop`** −10 dB + `sub` on f78 (bar 2's landing) |
| **f90** | Step 4 (−24°) **and T1 tick cut to shot B** (M3′ tip macro ×1.8 about the reading point, which keeps its screen spot (601, 310) across the cut: the eye-trace anchor). In M3′ one step moves the rim 306 px. Node 1 now sits 18° behind the needle with its black stretch. | 1b holds (screen-locked: the object changes under it) | | `fx-tick` −26 dB |
| f84 | | tier word "answer." lifts | "answer." | |
| f100 | | | take ends (f110 at 2.5 words/s) | |
| f99-106 | | **1b exits** (from "answer." + 15 f), text-free until f118 | | |
| f118 | | tier 2 "While it rings," / "someone's still waiting." set at 72 % | | |
| **f120** | Step 5. | lead "While" mask-rises (lockup 2a) | **`ig6-02a`** "While" | **the bed enters** on the bar 3 line (§6) |

**hookscore** (`python3 -I .claude/skills/ig-reel/hookscore.py`, raw / patched with RESEARCH-viral's whole-word fix):

| What | Score |
|---|---|
| Spoken: "One ring, six seconds. Your receptionist can't answer." | **84.4 / 84.4 STRONG** (LENGTH 100, SPECIFICITY 100, STAKES 70, FRONTLOAD 100, ADDRESS 100) |
| B hook: "One ring, six seconds. You can't answer." | 84.4 / 84.4 |
| Frame-0 big card alone "One ring, six seconds." | 45.2 WEAK; the stake arrives in big type at f50-78 (1b), and the full muted read by 2.8 s is the 84.4 line |
| Body lines scored as hooks | 30.0-40.8 WEAK (they are payoffs, not openers) |

The scorer cannot separate hooks above 80 (AUC 0.56, its own header). The choice rests on the account data (the receptionist family) and on the muted read.

### 1.3 The hook's timing ladder (`timing.ts` `HOOK`)

`ig6-02a` must end by **f174** (ring 2 is fixed at f180; no onset in (ring − 6, ring + 10)). `timing.ts` places, in order, the first rung that fits on the measured takes:
1. `ig6-01` with lockup 1b holding 15 f after "answer.";
2. `ig6-01` with 1b holding 8 f;
3. `ig6-01r` (the same words, a tighter two-breath reading);
4. `ig6-01b` "One ring, six seconds. You can't answer." (lockup 1b becomes "You" / *can't answer.*).

**Never move ring 2.** It is the reel's honest demonstration of F1: six real seconds between two rings.

---

## 2. The ring clock (our dial, not the reference's)

The composition is the reference's (STYLE §1). The markings are ours: the dial is printed with the North American ring cadence, "2 sec on, 4 sec off" (ANSI T1.401-1988 §5.4.2, F1). It is a clock that counts rings. No numerals, ever.

| | Your phone (before the pickup) | The agent (after the pickup) |
|---|---|---|
| Rim | teal 9 px; each ring's 2 s stretch (12° after its node) is grey `#D6D6D6` ahead of the needle and turns ink `#0A0A0A` as the needle passes it ("rung") | clean teal, no stretches |
| Markers | hollow nodes every 36° (Ø 24, 6 px ink ring, white centre: the reference's dots), one per ring | no hollow nodes; a **filled teal dome** (Ø 26, STYLE §9.3 gradient) appears only where a call was picked up, at irregular times |
| Hub | graphite dome `#3A3A3A` | teal dome |
| Motion | **steps** −6° once a second with a kick (3 f `EASE.expo`, 0.8° overshoot, `SPRING.land`), the hand recoils +0.8° | **glides** −6° per second, linear, silent |
| Sound | `fx-tick` / `fx-tock` every second (the hats); `fx-trill` per ring | no clock ticks; the bed's shaker |

**Coordinates.** Dial angle φ (clockwise from the dial's own 12 o'clock). Node n (n = 1…10) sits at φ = 36(n − 1). In the M1/M3′ frame, world angle = φ + 28.1° + ρ (ρ = the dial's rotation, −6° per step). The needle reads φ = −6.03 − ρ. Node 2 reaches the needle on step 7 (**f180**: 6.0 s after ring 1). At 120 BPM, 6 s = 3 bars: one ring = 1 bar of tone + 2 bars of silence; rings 1 and 2 land on the bar 1 and bar 4 lines.

---

## 3. Shots (one camera, 2.5D layers; STYLE §2.8, §9.6)

The lockup is screen-locked (parallax k 0) at x 296-900, y 1080-1400; every crop keeps object strokes out of that box. Plane factors: dial 1.00, hand 1.12, hub 1.15.

| Shot | Frames (plan) | Crop | Mode | Notes |
|---|---|---|---|---|
| A | f0-90 | **M1** reference, ×1 | your phone, tick | frame 0 (§1.1) |
| B | f90-210 | **M3′** tip macro ×1.8 about the reading point (601, 310) | tick | one step = 306 px at the needle; node 2 slides in on the f150 step and lands on f180; snap punch-in ×1.0 → ×1.3 at f180 (8 f `EASE.expo`, no overshoot). Hand body at x 120-195 where it crosses y 1080 (shadow to x ≈ 236): clear of the box. The rim leaves the right edge at y ≈ 558. |
| C | f210-222 | M1 | tick | T1 back to the reference frame; node 2 sits at (441, 255) after the f210 step |
| D | f222-234 | **T2 push into node 2** | | world ×1 → ×12 (f222-228, `EASE.in4`) while node 2 pans to the frame centre (`EASE.inOut`); past ×6 every layer but node 2 is culled; from ×12 the node is a screen-space ring (inner r = 6·z, outer r = 12·z) and z climbs to ≥ 184 by f232. **f232-233: pure white** (its white centre). |
| E | f234-330 | **M5′** full dial, centre (520, 600), R 410 (zoom 0.2526) | your phone, stepped time-lapse | rim y 190-1010; at y 840 it reaches x 852 (rail clear); hand redrawn at the true centre, 430 px long (scale 0.393, a cut, so no parallax collapse on screen); the hand pointing straight down ends at y 1030 + shadow 1049 (box clear). |
| F | f330-337 | M5′ | | **T3 whip**: the dial plane spins +75° in 7 f (`EASE.peel`); cut on **f333** |
| G | f333-364 | **M2′** hub macro of a fresh clock: hub (260, 900), ×2.2 | none | graphite dome Ø 119; **no dial in frame** (no rim, ticks or markers: nothing to read a time from); its rotation continues −35° → 0 (12 f `EASE.expo`) |
| H | f364-435 | M2′ → **M1** pull-back (×2.2 → ×1, f364-384, `EASE.inOut`), then M1 | the agent, glide from f384 | the hub travels (260, 900) → (97, 1183), always left of x 300 |
| I | f435-525 | **M5′** full dial, same geometry as E | the agent: one full turn f435-510, then glide | T1 cut on "day" |
| J | f525-570 | **M3′** tip macro | glide | a −8° orbit of the dial plane (40 f `EASE.inOut`) |
| K | f570-654 | **M1** | glide | the reference frame, calm; exit f640-654 |
| L | f654-840 | `End6` (white), seam f826-840 | | §7, §8 |

---

## 4. Beat table (30 fps plan targets at 2.78 words/s; `src/ig/ig6/timing.ts` re-anchors every line on the measured takes)

**Acts** (`SCENES`, plan): `hook` 0-116 · `wait` 116-234 · `missed` 234-333 · `pickup` 333-435 · `day` 435-525 · `words` 525-570 · `ring` 570-654 · `end` 654-840.

**Type grammar** (STYLE §2.4, §9.8): lead = mask rise per word, 7 f `EASE.expo`, each word on its onset; accent = 10 f slide + wipe landing on its first word's onset, teal from its first frame; tier = set at 72 % ink 2 f before her first word, each word lifts to full ink on its onset; exits 4-5 f `EASE.in3`; one moving text at a time; a lockup holds ≥ 15 f after its last word, and longer to keep any text-free gap ≤ 30 f (the two wordless beats excepted, ≤ 45 f each).

| Beat · frames · s | Picture · camera · object | Big lockup / tier (on screen) | Voice (id @ f) | Sound |
|---|---|---|---|---|
| **b1 HOOK** · 0-116 · 0.0-3.9 | §1.2. Shot A (M1, tick): ring 1 at f0, node 1 pulse + ping + shiver; steps f0/30/60, ring stretch 1 inks f3-63; f90 step + **T1 tick cut** to shot B (M3′). | **1a** One ring, / *six seconds.* · tier "One ring, six seconds." (set at 72 % from f0) → **1b** Your receptionist / *can't answer.* · tier "Your receptionist can't answer." | `ig6-01` @10 | `fx-trill` f0 (HEAD −4 dB) · `fx-tick` f30, `fx-tock` f60, `fx-tick` f90 (−26 dB under words) · `pop` −10 dB + `sub` f78 · room tone, **no bed** |
| **b2 WAIT** · 116-234 · 3.9-7.8 | Shot B (M3′, tick): steps f120, f150 (node 2 slides in from the right). **f180 RING 2**: node 2 lands under the needle on the step, pulse + ping + shiver; **snap punch-in** ×1.0 → ×1.3; its stretch inks f183-243. **f210 T1** to shot C (M1). **f222-234 T2 push into node 2** (shot D); f232-233 pure white. | **2a** While it / *rings,* (accent lands on "rings" ≈ f132), **holds silently through ring 2** (the open loop), exits f186-190 → **2b** Someone's / *still waiting.* (lead on "someone's" f190, accent lands on "still" ≈ f201), exits f224-229 · tier (one screen) "While it rings," / "someone's still waiting." | `ig6-02a` @120 (ends ≤ f174) · `ig6-02b` @190 | **bed enters f120** (120 BPM soft pulse; the clock's tick/tock are its hats) · `tap` f132 · **f180 `fx-trill` + `fx-tock` + `thump` −8 dB** (bar 4's hit) · `tap` on "still" · `fx-tick` f210 · `whoosh-rev` peaking f232 |
| **b3 MISSED** · 234-333 · 7.8-11.1 | **f234 shot E (M5′)**: out of the white the whole dial appears, its rim contracting ×3 → ×1 (12 f `EASE.expo`): **the ring we fell through is the clock.** Ticks sweep in clockwise (10 f). Hand at φ 42, stretch 1 black, stretch 2 half. f240 a normal step to φ 48. **Stepped time-lapse**: f255 jump to node 3 (φ 72), then +36° on every 8th (f262.5, 270, 277.5, 285, 292.5, 300, **f307.5 node 10**); each jump 3 f `EASE.expo` + 0.8° overshoot + `SPRING.land`, inking the stretch it crosses, the landed node pulsing; f315 the last +12° to φ 336. **Ten black stretches on the teal rim**: a minute of ringing, never said. f318-330 hold, drift only. | Tier "A missed call is" / "someone else's customer." set at f238 · big **Someone else's** / *customer.* (lead on "someone" ≈ f266, accent lands on "customer" ≈ f286); holds until the whip, exits f326-330 (ending on the cut) | `ig6-03` @240 | `thump` f234 (the open) · `draw` under the tick sweep · each time-lapse jump `fx-tick`/`fx-tock` alternating −24 dB (any within 6 f after an onset drops to −30 dB) · `pop` + `sub` on "customer" (bar 5's landing) · `land` f315 |
| **b4 PICKUP** · 333-435 · 11.1-14.5 | **f322-330 near-silence.** **f330-337 T3 whip** (shot F), cut on f333 to **shot G (M2′)**: a fresh clock seen only at its hub (graphite), rotation settling −35° → 0 by f345. **f345 THE RING**: the dome shivers (scale 1 ↔ 1.04, 12 Hz, damped 10 f) and one ping leaves the hub (Ø 119 → 420, 14 f). **f360 THE PICKUP, on the bar 7 line**: the dome **stamps** (`SPRING.pop` 1 → 1.15 → 1; its shadow (6, 10) → (9, 15) and back) and turns **graphite → teal** in a radial wipe from its centre (4 f); the collar flashes deep teal → teal for 4 f. **f364-384 pull-back to M1** (shot H): the agent's clock rebuilds: ticks sweep in outward from the needle (10 f), the teal rim draws on from the reading point both ways (16 f `EASE.expo`), and the first teal dome (this call, picked up) pops at the reading point as the rim reaches it. No hollow nodes, no stretches. **From f384 the dial glides** (−6°/s, linear): the reference frame, calm. | **No text f330-366** (the first wordless beat, 1.2 s, voice-free) · **4a** Our AI / *receptionist* (lead words on "Our" f368 and "AI" f375; this lockup sits 10 px higher: lead baseline 1150, accent 1225) · accent lands on "receptionist" ≈ f389 **with the T4 underline**: a 3 px teal line draws out of the hub disc's lower edge (x 97, y 1232) to the accent's right end (x 831), 10 f `EASE.expo`, skip-ink 6 px around descenders · tier "Our AI receptionist" (set f366) · on "picks" (≈ f417) 4a and its underline exit (4 f) and **4b** begins: lead **Picks up,** rises · tier "picks up, day or night." | `ig6-04` @368 | **`MIX.stop` from f322** (the bed ducks to near-silence over 4 f, `riser-short` into it) · `swish` peaking f333 · **f345 `fx-trill` alone** (rings out by f355) · **f360 `fx-pickup` + `fx-tock` + `fx-ting` −6 dB** · **bed returns f375**, pad up an octave; **no clock ticks from here** (the bed's shaker carries the 8ths) · `whoosh-soft` + `draw` under the rebuild · `tap` + `draw` on "receptionist" (the underline) |
| **b5 DAY** · 435-525 · 14.5-17.5 | **f435 T1 cut on "day"** to **shot I (M5′, the agent)**: clean teal rim, teal hub, the hand at 12 o'clock over the pickup's dome. **One full turn, linear, 4.8°/f, f435-510**: the agent's day or night. **Five teal domes** pop (`SPRING.pop` from 0) as the needle passes φ 36, 108, 144, 252, 324 (f442.5, 457.5, 465, 487.5, 502.5): calls at irregular times, each picked up. Lands at 12 on **f510** (`SPRING.land`, 0.8°), then glides. | **4b** Picks up, / *day or night.*: accent lands on "day" with the cut (f436) · exits f467-471 · **5** It answers / *from your words.* (accent 100 px, x 296-896; lead x 311): lead on "It" f492, accent lands on "from" ≈ **f510, with the sweep's landing** · tier "It answers from your words." | `ig6-05` @492 | **`pop` + `sub` on "day"** (bar 8's landing) · `fx-glass-tick` −26 dB on each dome (any within 6 f after an onset dropped) · `land` + `pop` + `sub` on "from" f510 (bar 9's landing) |
| **b6 WORDS** · 525-570 · 17.5-19.0 | **f525 T1 cut** (beat) to **shot J (M3′, glide)**: the hollow lozenge and needle over the teal rim; a teal dome pops under the needle on the cut (another call, from your words); the dial plane orbits −8° (40 f `EASE.inOut`). | **5** holds (screen-locked) to f566, exits f566-570 | | `fx-glass-tick` on the pop · bed only |
| **b7 RING** · 570-654 · 19.0-21.8 | **f570 T1 cut** to **shot K (M1, glide)**, the reference frame, calm. The glide is phased so a teal dome pops at the reading point on "yourself" (≈ f598). f604-640 hold, drift. **f640-654 exit**: the dial and the hand recede up-left (×1 → ×0.6, 8 f `EASE.in3`, the hand plane 2 f ahead) and leave; **the teal dome stays** and glides (14 f `EASE.inOut`) to the send disc's place (848, 1000), Ø 54 → 72, its gradient flattening to `#0A8AA8`. | **6** Ring it / *yourself.* (lead on "Ring" f585, accent lands on "yourself" ≈ f598) · tier "Ring it yourself." · holds to f640, exits f640-644 | `ig6-06` @585 | `fx-glass-tick` + `pop` on "yourself" (bar 10's landing) · **no trill** (a ring never lands on a word) · `whoosh-soft` peaking on the exit's fastest frame (≈ f646) |
| **b8 CTA (`End6`)** · 654-780 · 21.8-26.0 | White ground, no object. f654-660 the white arrow draws into the disc (6 f). **f662** the comment field rises around the disc (§8). AGENT types one letter per 16th from her word "AGENT" (f690, 693.75, 697.5, 701.25, 705). The disc presses (.97) as "link." ends (≈ f730). Hold. | Text-free f644-678 (the second wordless beat, 1.1 s: the exit move and the field) · **7** Comment / *AGENT* (centred on x 540; lead baseline 760, accent 845; lead on "Comment" f680, accent lands on "AGENT" ≈ f690) · tier "Comment AGENT for the link." baseline 905 | `ig6-07` @680 (ends ≤ **f765**) | the series end stack `endHits`: `fx-menu-open` (field), `fx-keys` ×5, `fx-click-down`/`-up` (press) · half-bar snare roll f750-780 (`MUSIC.roll`), riser crest |
| **b9 BRAND** · 780-826 · 26.0-27.5 | **Impact on the bar 14 line (f780).** Field and lockup leave up (4 f). The disc (arrow out) flies to the end of the wordmark (8 f `EASE.expo`) and **stamps as its full stop** (0.85 → 1.12 → 1, `SPRING.pop`, its own shadow (6, 10, 4 px, 18 %)). **NEUROVOICE** surfaces centre-out (Inter Tight 500, −0.07em, 720 px wide, ink `#0A0A0A`, y 760-900; the wordmark + dot group centred on x 540). No GL bloom. `neurotechvoice.com` types in three chunks on "Neuro \| Tech \| Voice". | wordmark + URL | `ig1-07` @784 (the borrow) | `impactHits(780)` with `slam` −6 dB (ig5's AAC-peak lesson, ig5 DELIVERY §2) |
| **b10 SEAM** · 826-840 · 27.5-28.0 | §7 | 1a + tier rise to 72 % by f839 | none | `MIX.fadeOut` [826, 840] to < −60 dBFS; the replay's first sound is f0's trill |

**Muted read, beat by beat:**
1. A huge clock, a mark pinging on its rim: "One ring, *six seconds.*" → "Your receptionist *can't answer.*"
2. The dial jumps once a second; a second mark arrives and pings: "While it *rings,*" … "Someone's *still waiting.*"
3. Through the mark, the whole clock, its rim filling with black stretches: "Someone else's *customer.*"
4. A whip, a dark hub that pings, then stamps teal; the clock rebuilds in teal and glides: "Our AI *receptionist*" (underlined by the hub) → "Picks up, *day or night.*"
5. The hand sweeps a whole turn and teal dots land: "It answers *from your words.*"
6. "Ring it *yourself.*"
7. The comment field types AGENT, then NEUROVOICE with a teal full stop.

**Retention.** Something lands on every beat before the CTA: a step, a ring, a ping, a word lift, an accent landing, a cut, the punch-in, the fall-through, the time-lapse jumps on 8ths, the whip, the ring, the pickup, the rebuild, the sweep's dots, a dome. Nothing is static for more than 1.0 s (the drift never stops). The two longest holds (f604-640, the end card) carry the glide and the typing.

---

## 5. Screens, voice lines and the word-rate check

### 5.1 Screens (big words are a subset of her words; numerals stay words)

| Screen | Big lockup (≤ 6 words) | Sentence tier (≤ 7 words) | Line [words] |
|---|---|---|---|
| S1a (set at f0) | One ring, / *six seconds.* (4) | One ring, six seconds. (4) | `ig6-01` [0-3] |
| S1b | Your receptionist / *can't answer.* (4) | Your receptionist can't answer. (4) | `ig6-01` [4-7] |
| S2a | While it / *rings,* (3) | While it rings, / someone's still waiting. (6, one screen across 2a-2b) | `ig6-02a` [0-2] |
| S2b | Someone's / *still waiting.* (3) | (same screen) | `ig6-02b` [0-2] |
| S3 | Someone else's / *customer.* (3) | A missed call is / someone else's customer. (7) | `ig6-03` [4-6] |
| S4a | Our AI / *receptionist* (3) + the teal underline | Our AI receptionist (3) | `ig6-04` [0-2] |
| S4b | Picks up, / *day or night.* (5) | picks up, day or night. (5) | `ig6-04` [3-7] |
| S5 | It answers / *from your words.* (5) | It answers from your words. (5) | `ig6-05` [0-4] |
| S6 | Ring it / *yourself.* (3) | Ring it yourself. (3) | `ig6-06` [0-2] |
| S7 | Comment / *AGENT* (2) | Comment AGENT for the link. (5) | `ig6-07` [0-4] |

**Display map** (`timing.ts` `DISPLAY`): `ig6-02b` [0] "someone's" shows as "Someone's" in the big lockup only (the tier keeps the lowercase continuation); every apostrophe renders typographic (’). No numerals are shown anywhere.

### 5.2 Voice lines (full entries in `voice-lines-draft.json`)

| id | say | Words | Placed |
|---|---|---|---|
| `ig6-01` | One ring, six seconds. Your receptionist can't answer. | 8 | yes (A hook) |
| `ig6-02a` | While it rings, | 3 | yes; must end by f174 |
| `ig6-02b` | someone's still waiting. | 3 | yes; starts ≥ ring 2 + 10 (f190) |
| `ig6-03` | A missed call is someone else's customer. | 7 | yes |
| `ig6-04` | Our AI receptionist picks up, day or night. | 8 | yes |
| `ig6-05` | It answers from your words. | 5 | yes |
| `ig6-06` | Ring it yourself. | 3 | yes (trim T1 drops it) |
| `ig6-07` | Comment AGENT for the link. | 5 | yes (a fresh take: one borrow only) |
| `ig1-07` | Neuro Tech Voice. | 3 | yes (borrow, byte for byte) |
| `ig6-01r` | (same words as `ig6-01`, tighter reading) | 8 | alternate (hook ladder rung 3) |
| `ig6-01b` | One ring, six seconds. You can't answer. | 7 | alternate: TikTok B re-cut a week later, and hook ladder rung 4 |
| `ig6-07b` | The link's in our bio. | 5 | alternate: only if nobody can answer AGENT comments on posting day (truth R4) |

**42 words before the sign-off**, 45 with it (STYLE ≤ 60; RESEARCH-viral's 45-55 band counts the sign-off: the style wants air).

### 5.3 Word-rate check per beat (speech = words ÷ rate + a 4 f tail; "air" = what the picture needs)

| Beat | Window | Words | Speech at 2.78 / 2.5 w/s | Fit |
|---|---|---|---|---|
| b1 hook | f0-116 (3.9 s) | 8 | 2.9 / 3.2 s from f10 | ok: ends f100 / f110; 1b exits by ≈ f106 / f116 |
| b2 wait | f116-234 (3.9 s) | 6 (two takes) | 1.2 + 1.2 s / 1.3 + 1.3 s around the fixed ring 2 | 02a ends f156 / f160 (deadline f174); 02b f190-226 / f190-230 |
| b3 missed | f234-333 (3.3 s) | 7 | 2.5 / 2.8 s from f240 | ends f320 / f328; the whip is anchored at last word + 8 f, so it slides to f336 at 2.5 |
| b4 pickup | f333-435 (3.4 s) | 8 (from f368) | 2.9 / 3.2 s | wordless f330-366 first; at 2.5 the ring and pickup move one beat (f360 / f375) and 04 runs f383-483 |
| b5 day | f435-525 (3.0 s) | 5 | 1.8 / 2.0 s | 05 at f492 / f493 |
| b6 words | f525-570 (1.5 s) | 0 | none | hold |
| b7 ring | f570-654 (2.8 s) | 3 | 1.1 / 1.2 s | 06 at f585 (plan) in both |
| b8 CTA | f654-780 (4.2 s) | 5 | 1.8 / 2.0 s | CTA ends f738 / f744 against the f765 deadline |

**Placement simulation** (`scratchpad/synth6/fit.py`; 6 f minimum gap, lockup holds, ring/pickup anchors on beats; CTA plan f680, deadline impact − 15 = f765):

| Rate | 01 | 02a (≤ 174) | 02b | 03 | whip / cut / ring / pickup | 04 | 05 | 06 | 07 | CTA spare |
|---|---|---|---|---|---|---|---|---|---|---|
| 2.78 (Tessa's measured mean) | 10-100 | 120-156 | 190-226 | 240-320 | 330 / 333 / 345 / **360** | 368-458 | 492-550 | 585-621 | 680-738 | **27 f** |
| 2.50 (voice.md pace) | 10-110 | 120-160 | 190-230 | 240-328 | 336 / 339 / 360 / 375 | 383-483 | 493-557 | 585-625 | 680-744 | **21 f** |
| 2.45 (ig5's number-heavy lines) | 10-112 | 120-161 | 190-231 | 240-330 | 338 / 341 / 360 / 375 | 383-485 | 495-560 | 585-626 | 680-745 | **20 f** |
| 26.0 s cut at 2.50, for reference | | | | | | | | | 637-701 | 4 f (rejected) |

**Rules for `timing.ts`:** assert ring 2 = f180 and 02a ≤ f174; the ring falls on the first beat ≥ the whip cut + 12, the pickup on the next bar line or, failing that, the next beat ≥ the ring + 15; `ig6-04` ≥ pickup + 8; assert the CTA ends ≤ f765 on the measured takes. **Trim order** if it ever fails: T1 drop `ig6-06` (the b7 beat becomes a wordless glide ≤ 1.5 s, the dome still pops); never squeeze ring 2, the pickup or the seam.

**`beats.py --target 28`** (165 wpm): hook 2.9 s; ~16.4 s of speech; flags "beats 2-4 have nothing concrete" (its regex sees no digits; the picture is concrete in each beat), "no loop" (the loop is the seam, §7) and "11.6 s under target" (the planned air: the ring-2 gap, the fall-through, the time-lapse, the wordless pickup, the day sweep, the end card). At 150 wpm it flags the hook at 3.2 s; "One ring, six seconds" is heard by 1.3 s and "receptionist" by 1.9 s.

---

## 6. Sound (`HITS`, `MUSIC`, `MIX`)

- **Bed:** the `scripts/ig/bed.mjs` stub (felt-piano 8ths, shaker, low strings, sub in E), imported unchanged; no `scripts/ig6/bed.mjs` unless the critics ask. `bedFrom` f120 (bar 3 line). Before the pickup the clock's `fx-tick`/`fx-tock` act as the hats.
- **Stop-time:** `MUSIC.stop` = [whip − 8, pickup + 15), measured from the placed takes (plan [322, 375)); the pad returns an octave up.
- **End:** `roll` f750, `impact` f780, `brand` f784, `MIX.fadeOut` [826, 840].
- **Arc:** `MIX.arc.windows` = the agent's day sweep (cut on "day" → f510), the music-forward passage.
- **Ticks under her voice:** every clock sound under a word sits at −26 dB; any that check-mix flags inside a word's first 200 ms is dropped (the step stays silent), never moved.
- **Library only:** every sound is in the shared `public/ig/sfx/lib` (`fx-trill`, `fx-tick-*`, `fx-tock`, `fx-glass-tick`, `fx-pickup-*`, `fx-ting`, `fx-roomtone`, `pop`, `sub`, `tap`, `thump`, `swish`, `whoosh-soft`, `whoosh-rev`, `draw`, `riser-short`, `land`, `fx-menu-open`, `fx-keys-*`, `fx-click-*`, `riser`, `slam`) or the shared `fx-impact-end`. No new sound is needed.
- **check-mix targets** (series): −14 ± 1 LUFS, ≤ −1.0 dBTP, dialogue −18.5 ± 0.5 LUFS, word SII ≥ 0.7, the name ≥ 0.9, climax ≥ +1 LU, tail < −60 dBFS.

---

## 7. The loop seam (f826 → f840 ≡ f0)

1. **f826-830** the wordmark and URL leave up through their masks (4 f `EASE.in3`).
2. **f826-836** the dome leaves the full stop and glides to the hub's frame-0 spot (97, 1183), sizes to Ø 54, takes its gradient back and, over its last 4 f, **drains teal → graphite**: your phone again.
3. **f828-836** the hub disc grows out under it (Ø 0 → 96, 8 f `EASE.expo`), the hand extends from the hub to full length at 30° (8 f `EASE.expo`), its shadow wrapper fades in.
4. **f828-839** the dial draws on from the reading point outward: the teal rim trims on both ways (10 f), the ticks sweep in, node 1 pops in 6° right of the needle with its grey ring stretch behind it. This is the exact frame-0 state at rotation 0.
5. **f832-839** lockup 1a and its tier rise to 72 % ink.
6. **f840 = the replay's f0**: the first step and the trill.

The seam lands on frame 0's state; f0 itself starts mid-motion (the step, the pulse, the ping), so the replay never begins from rest. The last word is "Voice."; the first is "One ring". The story loops too: a fresh caller rings a phone nobody can answer. Check it with a two-pass loop strip and a frame diff of f839 against f0 (< 2 % of pixels changed at 30 fps).

---

## 8. End card: `End6` (STYLE §4.4, §9.10)

| Part | Spec |
|---|---|
| Through-line | the teal dome travels: the hub (f360, stamped teal) → the send disc (b7) → the wordmark's full stop (b9) → the hub, drained to graphite (seam). "The agent at the centre of every call." |
| CTA lockup | **Comment** Instrument Sans 580 60 px ink, centred on x 540, baseline 760 / ***AGENT*** Cormorant Italic 600 110 px teal (321 px), baseline 845 / tier "Comment AGENT for the link." 32 px grey (435 px), baseline 905. |
| Comment field | `END.field` geometry (x 174-906, y 940-1060, r 60): white fill, 1.5 px `#E6E6E6` border, the long shadow (24, 48, 10 px, 7 %); lucide message-circle `#0A0A0A` at x 214; caret blinking on the beat while idle; AGENT typed in Instrument Sans 600 50 px `#0A0A0A`, one letter per 16th from her word; send disc = the dome, Ø 72, flat `#0A8AA8`, white arrow. Nothing imitates Instagram's UI. |
| Impact | `impactHits(780)` (slam −6 dB) on the bar line; the disc stamps as the full stop; letters surface centre-out. No `LightGL` bloom. |
| Wordmark | NEUROVOICE exactly as the series sets it (Inter Tight 500, −0.07em), **720 px wide** (≤ 760), ink `#0A0A0A`, y 760-900; the full stop is the dome, baseline-aligned, Ø = the wordmark's x-height × 0.55, 12 px after the R; the group (≈ x 155-925) is centred on x 540. The letters are never altered. |
| URL | `neurotechvoice.com`, Instrument Sans 450 34 px `#6B6B6B`, y ≈ 1000, typed in three chunks on "Neuro \| Tech \| Voice". No price, no "Start free" button, no booking. |
| Fallback | `IgEnd` unchanged with `tone="pearl"` (series-true, but its teal bloom is a glow on white); b7's exit then ends with the dome shrinking into the white. |
| TikTok | the same master; the TikTok caption says "Link in bio" (TikTok has no keyword auto-DM; truth R4). |

---

## 9. Cover (`src/ig/ig6/Cover.tsx` → `IG6-Cover-9x16`, PNG 1080 × 1920)

Mock: `mocks.png` panel 7. Every word is spoken in the reel and sits inside x 86-900, y 260-1380 (both apps' 3:4 grid tile is y 240-1680).

- **Picture:** frame 0's composition with node 1 under the needle and its ring stretch half inked, drawn bolder for the tile (rim 12 px, ticks ×1.33, shadow 9 %); graphite hub. The teal accents are the rim and the italic.
- **Kicker:** `AI RECEPTIONIST · 06`, Instrument Sans 600 28 px, tracking +0.08em, `#6B6B6B` (330 px), x 345, baseline 1080.
- **Title:** **One ring,** Instrument Sans 580 84 px (342 px), x 345, baseline 1168 / ***six seconds.*** Cormorant Italic 600 126 px teal (499 px), x 330, baseline 1256.
- **Stakes line:** "Your receptionist can't answer." Instrument Sans 450 40 px `#6B6B6B` (554 px), centred on x 580, baseline 1322.
- **No** numerals, price, app UI or teal on the hub.
- **TikTok:** the feed autoplays from frame 0, which is the cover's composition, so the grid and the feed agree. Instagram: upload the PNG (fallback: frame 0).

---

## 10. Facts and claims (every one, with its source)

| On screen / spoken | Grade | Source |
|---|---|---|
| "One ring, six seconds." + the ring clock (a node every 6 s, a 2 s stretch, 4 s of silence) | **A**, a standard, not a survey; **US and Canada only** | ANSI T1.401-1988 §5.4.2 "2 sec on, 4 sec off", via https://www.zytrax.com/tech/telephony/ring_patterns.htm (re-fetched by the truth judge 2026-10-11; Europe/ETSI "1 sec on, 4 sec off"); https://en.wikipedia.org/wiki/Ringing_tone. Scoped in both captions and the pinned comments (POSTING.md). |
| "Your receptionist can't answer." | a scene (pro-staff: she is busy, never replaced) | none needed; ig1 coherence |
| "While it rings, someone's still waiting." | true by definition | RESEARCH-product S20 (its wording reshaped; approved by the truth judge §8) |
| The ten black stretches (a minute of ringing) | picture only: never said, numbered or captioned | truth T-C4; no "how long before voicemail" claim (F-U8) |
| "A missed call is someone else's customer." | opinion; never with a % | `.claude/instagram/voice.md` position 1; RESEARCH-product S21 |
| "Our AI receptionist" | a noun | RESEARCH-product S22; never with "replace", "fire" or "instead of" |
| "picks up, day or night" + the pickup on a fresh call | **A**: the default always-answer, used on screen instead of "24/7"; a **fresh** call to the agent, never a ring-out taken over | `lib/site.ts:944`; `lib/voice/router.ts:198-224` (S4); U5 avoided |
| Five teal domes in the day sweep | picture: a handful of answered calls at irregular times; no count, never "all" | U1, U2 avoided |
| "It answers from your words." | **A** | `lib/pages/home/pricing.ts:67`; `lib/voice/session-loader.ts:236`; knowledge base on every plan, `lib/pages/knowledge-base.ts:496-497` (S6) |
| "Ring it yourself." | **A**: trial test calls are free, 5 a day | `lib/site.ts:1813`; `lib/billing/entitlements.ts:39`; `lib/billing/usage.ts:623` (S17) |
| "Comment AGENT for the link." | **A**, if AGENT delivers the trial link and setup help | `voice.md` "The ask"; RESEARCH-product §7; POSTING.md §0 |
| "Neuro Tech Voice." + `neurotechvoice.com` | brand | series |

**Caption fine print** (word for word from RESEARCH-product §8, both captions):
> One ring = 2 s of tone + 4 s of silence, the North American standard (ANSI T1.401). Free trial: 5 minutes over 14 days, no card needed. On the trial it answers your own test calls; to answer customers, the agent needs its own phone number ($1.15/month, card required). One agent per business, set to one of 14 languages. It tells every caller it's an AI.

**Not used, on purpose:** "first ring" (B, and a latency by arithmetic here), any third-party statistic (Clio, NHS, HBR: RESEARCH-viral §5.1), prices, plan names, minutes, booking or a calendar (Pro-only in code), "24/7" on screen, "14 languages" on screen (caption only), "under ten minutes" (reply bank only).

---

## 11. Safe zone (TikTok + Instagram combined; ig5's rule, copied to `src/ig/ig6/zones.ts`)

| Rule | Value | How ig6 meets it |
|---|---|---|
| Text | x 86-900, y 240-1400 | lockups x 296-896, cap tops ≥ 1100, tier bottoms ≤ 1336; end card y 700-1060 (centred); cover x 303-857, y 1060-1330 |
| Objects below y 840 | x ≤ 880 (TikTok rail) | M1: majors end at y 787, the hand crosses y 840 at x ≈ 295; M3′: the rim leaves the right edge at y ≈ 558; M5′: the rim reaches x 852 at y 840; M2′: the hub disc spans x 155-366; the comment field (x 906) is the series' one zone exception |
| Lockup box clear of object strokes | x 296-900, y 1080-1400 | checked on every crop in the mocks; M5′ hand pointing down ends at y 1030 (shadow 1049) |
| Wordmark | x 60-1020 (ig5's logo exception) | group ≈ x 155-925 |
| Cover | words in x 86-900, y 260-1380 | §9 |
| Build check | `check:zones:ig -- --film=ig6` with ig6's own registered rule, **plus** a still-frame overlap check of the lockup box against the object layers (the zone guard tests text against the frame only) | PIPELINE.md §6 |

---

## 12. Self-check

| Rule | Status | How |
|---|---|---|
| No invented statistic, result or testimonial | **PASS** | one number, a cited standard, scoped in the captions; no %, no wait time, no voicemail time, no caller behaviour |
| No number on our speed (U3) | **PASS** | "first ring" is not said; the pickup happens in a hub macro with no dial; the agent's clock has no ring stretches and no numerals, so no seconds can be read |
| No takeover or forwarding picture (U5) | **PASS** | the agent picks up a **fresh** call on a fresh clock after a whip, never ring 11 of the unanswered one; captions and pinned comments say it answers its own number, next to your line, no porting (truth R3) |
| No absolutes (U1, U2) | **PASS** | no "never miss", no "every call"; five calls at irregular times |
| Booking / $49 / plan names / minutes | **PASS** | none; nothing waits on the Starter booking ship |
| Trial truth | **PASS** | "Ring it yourself" is what the trial allows; the trial terms are in the captions |
| Product scope | **PASS** | no language switching, cloning, recordings or "sounds human"; Tessa is never presented as the product voice (no waveform, no greeting) |
| No competitor | **PASS** | none |
| Series coherence | **PASS** | the receptionist is busy, never replaced; captions carry "Keep your front desk for the work only people can do"; teal = ours; sign-off, URL, AGENT CTA, end-card beats kept |
| Voice rule | **PASS** | every big word and tier word is spoken; frame-0 lockup set 10 f before her first word; lockup 2a holds silently through ring 2 (≈ 1 s, mid-sentence); the two text-free beats (f330-366, f644-678) are voice-free |
| Card rule | **PASS** (reading to confirm, owner question 3) | big lockups ≤ 6 words; tiers ≤ 7 words per screen |
| Hook in 0-2 s, readable muted | **PASS** | lockup readable at f0; "One ring, six seconds" heard by 1.3 s; the stake in big type from f50-78 |
| Reference originality | **PASS** | our dial markings, sentences, colour, type pairing and hand proportions; the reference's words never in the accent tier; no watermark. The composition copies the reference's measurements, which is the owner's ask. |
| Secrets | **PASS** | no key read or printed; no Cartesia call |

---

## 13. Production risks (details and recipes in STYLE §9)

1. **The T2 fall-through** (b2 → b3): world ×12 then a computed ring; test at 120 fps first. Fallback: a T3 whip into M5′.
2. **The seam**: position and the f0 step must match; two-pass loop strip + frame diff.
3. **Clock sounds under words**: −26 dB and the drop rule (§6).
4. **Density**: draw ticks only for the visible angular window; transforms on layer divs; strokes ≥ 2 px.
5. **Shadow banding** in the 60 fps upload on white: a 2 s probe strip before the master (PIPELINE §6.3).
6. **Fonts**: Cormorant loads ig6-locally; canvas measurement waits on `useIg6Faces()`; measure *can't answer.* ≤ 560 px at 120 px and *from your words.* ≤ 604 px at 100 px on the real faces (PIL measured 545 / 600).
7. **The split take** (`ig6-02a` / `ig6-02b`): pick 02a by ear for a continuing (not falling) intonation; several candidates.
8. **The stepped time-lapse phase**: jumps on 8ths only if anchored to f255; if `ig6-03` runs long, hold longer, never stretch the jumps.

---

## 14. Open owner questions

1. **Approve the clock "One ring"** with the receptionist hook on day 1, and the B hook "One ring, six seconds. You can't answer." as a separate TikTok re-cut a week later.
2. **End card:** `End6` (recommended) or `IgEnd` unchanged.
3. **Card rule reading:** big lockup ≤ 6 words, grey transcript tier ≤ 7 words per screen (split per sentence). Or allow the frame-0 tier to show the whole 8-word hook (stronger muted read at f0).
4. **Serif-italic exception:** Cormorant Italic for the accent phrase only (breaks film 1's "captions never serif italic").
5. **AGENT on posting day:** who answers AGENT comments by hand on TikTok within the hour, and is the Instagram automation set with an ig6 rule (`utm_campaign=reel_ig6`)? If neither, render with `ig6-07b`.
6. **The bio** on both apps still says "Every call answered, in every language. AI agents deployed in 5 minutes - worldwide." Every "link in bio" sends viewers to it. A true replacement is in POSTING.md §7 (recommended before posting, not blocking).
7. **The hand:** our own hollow-lozenge proportions (recommended) or a classic "pomme" tip if the owner wants it further from the reference.
8. **"First ring":** parked. It returns only if the owner asks and a logged launch check passes on a US/Canada agent number (truth R2).
