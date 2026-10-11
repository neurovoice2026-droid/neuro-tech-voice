# ig6 · concept "phone" · "Off the hook"

Label `concept-phone`. Written 2026-10-11 on `claude/remotion-trailer` (HEAD `9cb3bc8`). Planning only: this file is the only one written. No code, no Cartesia call, nothing committed.

**Built on:** `ig6/STYLE.md` (the look, motion grammar, sound grammar, tooling), `ig6/RESEARCH-viral.md` (format mechanics, facts, hook runs), `ig6/RESEARCH-product.md` (SAFE / CONDITIONAL / UNSAFE lines), `.claude/instagram/voice.md` + `profile.md`, the ig5 docs (route, safe zone, end-card and cover conventions), `src/ig/ig5/timing.ts` and `common/series.ts` (ring and pickup sounds), `lib/site.ts:1812-1813` and `lib/pages/home/call.ts:17` (site wording).

**Layout mocks** (geometry check only, not the art): `scratchpad/ig6phone/mocks_v2.png` shows frame 0, the cover and the reveal frame side by side, drawn with the real faces, with the safe zone in red and the TikTok rail in orange. The script is `mock2.py` in the same folder.

---

## 0. The reel in one table

| | |
|---|---|
| **Title** | **Off the hook** (slug `off-the-hook`, out name `neurotechvoice-ig6-off-the-hook`) |
| **One object** | A classic desk phone in flat 2.5D vector on pure white: black handset, white base, rotary dial, coiled cord. It is drawn as the universal ☎ silhouette, so it reads in a fraction of a second even in a macro crop. It is never shown whole until one late pull-back. |
| **Angle** | The phone rings while the people who would answer it are busy. Before its second ring, the handset lifts itself (no hand, no face) and the cord turns teal: the agent has the call. Three more first-ring pickups follow on the beat, then what it does on the call. The pull-back shows the handset literally off the hook, and the line lands the pun: "You're both off the hook." The loop: the handset is hung up and the phone rings again. |
| **Hook (0-2.6 s)** | Picture: a macro of the black handset rattling in its cradle, with hairline ring arcs. Ring at f0. On screen (big tier, 5 words): **Can't be / *in two places.*** Spoken: **"Your receptionist can't be in two places."** Hookscore **77.8 STRONG** (patched 81.4). With the kicker "Neither can you." it scores **80.8** (patched 84.4). |
| **Length** | **28.0 s = 840 f at 30 fps** (14 bars at 120 BPM; 3360 render frames at 120 fps). Impact **f780**, END **f840**. Fallback 26.0 s (impact f720) if the takes come in fast (§3.4). |
| **Words** | **54 spoken before the sign-off** (+ "Neuro Tech Voice."). That is under STYLE's ≤ 60 and within RESEARCH-viral's 45-55 band. |
| **Claims** | Only SAFE product lines (§8). **No statistic, no price, no booking, no number attached to our speed.** The ring cadence (F1) is deliberately not used: in this concept a seconds figure would sit right next to our pickup and read as a latency claim (RESEARCH-product §2.1). |
| **Colour story** | Black and grey = the phone nobody can get to. **Teal arrives on the object at the pickup** (plunger caps, the cord, later the dial's centre dome) and leaves at the hang-up. The type's accent phrase is teal throughout, as the style requires. |
| **CTA** | "Ring it yourself." (site copy, trial test calls) + "Comment AGENT for the link." on a white end card. |
| **Series** | Receptionist hook family (ig1, the TikTok winner). The receptionist stays ("You're **both** off the hook"). Never "replace" or "fire". |
| **Route** | ig5's separate-registry route (`src/ig/ig6`, `scripts/ig6`), so ig1-ig5 stay byte-identical. |

---

## 1. The hero object, in the STYLE.md grammar

### 1.1 Parts (world coordinates = the reveal frame M5, 1080 × 1920, zoom 1)

The phone is a **front elevation**, like the ☎ icon. The handset is in profile, and the dial faces the camera, so the dial is a true circle. Flat fills, at most three greys plus the one accent, hairline details, and the long shadow on raised parts only (STYLE §1.4: 24, 48, blur 10 px, 7 %, on a non-rotating wrapper).

| Part | Geometry (M5) | Look | Layer k |
|---|---|---|---|
| **Base** | trapezoid, bottom y 1060 (x 160-880), top y 590 (x 250-790), corners r 40 | `#FFFFFF`, 2 px `#E2E2E2` edge, long shadow: white on white, like the reference's clock face | 1.00 |
| **Cradle horns** | two rounded bars 140 × 50, r 25, centred (270, 560) and (770, 560) | white, 2 px `#D6D6D6` edge, own small shadow | 1.00 |
| **Hookswitch plungers** | two pegs 36 wide at (370, 568) and (670, 568); pressed 14 px tall, up 45 px tall | white, `#D6D6D6` edge; **when up, a 12 px teal cap `#0A8AA8`** | 1.00 |
| **Handset** | profile path (one closed SVG path: a gentle arch, grip 64 thick, two flared cups 190 wide at the mouth), length ≈ 860, resting centred (520, 455) with its cups on the horns. Lifted (M5): centred (560, 340), −8°, scale 1.06 | **solid `#0A0A0A`**: the moving black object, the reference's hand | 1.12 |
| **Earpiece face** (cut-away, P7 only) | black disc, 12 holes on a ring + a centre hole | holes white; the centre hole becomes the **teal dome** | 1.12 |
| **Coiled cord** | from the mouthpiece cup's foot (≈ 190, 590) down the base's left side to (180, 960). Coil r 16, pitch 26 at rest; pitch 40 stretched; straight when amplitude reaches 0 | 5 px stroke, `#0A0A0A` → **teal** from the pickup | 1.06 (between) |
| **Rotary dial** | centre (520, 830), R 200 rim (2 px `#D6D6D6`). 10 finger holes Ø 60 on r 150, on a 270° arc, with the gap at 1-2 o'clock. Finger stop: a black tapered bar at ≈ 40°, r 130-215 | holes are **white-centred rings** (white fill, 5 px `#0A0A0A` ring): the reference's dots, at our scale. No digits (no unspoken text). | 1.00 |
| **Dial centre card** | Ø 140, 4 ruled hairlines (2 px `#D6D6D6`); centre pin = **teal dome** Ø 40 (STYLE §4.3 gradient: `#052A33` rim → `#0E7490` → `#0A8AA8` → `#A5EAF5` highlight) | the lines are "your written answers": never legible text | 1.00 |
| **Ring arcs** | three concentric hairline arcs around the earpiece cup, r 250 / 310 / 370 (P1 scale), spanning about 70° | 3 / 2.5 / 2 px, `#222222` → `#6B6B6B` → `#D6D6D6` (fading outward). Stroke-drawn, never a glow. | 1.12 |

**Whole phone in M5:** x 160-880 below y 840 (TikTok rail clear), handset above at y 250-480.

### 1.2 Crop library (camera = focus in world px → screen anchor, zoom, rotation)

| Crop | Focus → anchor, zoom, rotation | What it shows | Used in |
|---|---|---|---|
| **P1 Cradle** (frame 0) | right cup (850, 455) → (580, 560), ×1.75, −56° | The handset as a black diagonal from lower left (mouthpiece off the left edge, at about y 1580) to the earpiece cup at the upper middle, cup mouth facing lower right onto the horn. The horn is a white bump at about (855, 700), kept above y 840. Ring arcs sit above the cup. The lockup sits in the lower-right white space. | b1, b3, seam |
| **P2 Cord** | cord midpoint (185, 780) → (560, 640), ×3.2, +12° | Big black loops on a diagonal (loop r ≈ 51 px, stroke 16 px), the base's left hairline behind. | b2, b4c |
| **P3 Horn** | right horn (770, 560) → (540, 760), ×3.0 | The cup landing on and leaving the horn. | b4a |
| **P4 Plungers** | (520, 568) → (540, 760), ×4.0 | Two white pegs (≈ 144 × 180 px) between the horns; the caps pop teal. | b4b |
| **P5 Dial arc** | dial centre (520, 830) → (−60, 1250), ×4.5 | **The reference's composition, with our object.** The dial centre is far off-frame lower left. An arc of white-centred finger holes (Ø 270, 22 px rings) sweeps across the top. The black finger stop is the "hand" at the upper right. The lockup sits lower right. | b7 |
| **P6 Dial centre card** | dial centre → (540, 640), ×4.8 | The card (Ø 672) with its four ruled hairlines and the teal dome (Ø 192); the finger holes' inner edges at the frame edges. | b5 |
| **P7 Earpiece face** | cut-away drawing at (540, 640) | Black disc Ø 760, 12 white holes Ø 34 on r 230, centre hole = teal dome Ø 120. | b5c |
| **M5 Reveal** | world as is, ×1 | The whole phone, handset off the hook above the cradle. | b6 (once, late) |

**Text never sits over an object stroke.** Every crop leaves y 1080-1400 (x 300-900) as white space for the lockup. The zone guard checks this per frame.

---

## 2. The hook (f0-f81, 0-2.7 s)

**Frame 0 picture (P1).**
- Ground `#FFFFFF`.
- The handset is caught **mid-hop** in its cradle: lifted 6 px along its normal and rotated −0.6°, its shadow 2 px wider than at rest.
- The first ring arc is already 40 % drawn.
- The plunger is pressed (grey). No teal on the object.
- The lockup is set at 72 % ink (the series' frame-0 set screen).

| Tier | Text | Setting (measured with the real faces, `scratchpad/ig6phone/measure.py`) |
|---|---|---|
| Lead (sans) | **Can't be** | Instrument Sans 580, 66 px (×1.1 hook scale), −0.03em, `#0A0A0A`, x 392, baseline 1160. Width 239 px. |
| Accent (serif italic) | ***in two places.*** | Cormorant Garamond Italic 600, 110 px, −0.01em, teal `#0A8AA8`, x 376, baseline 1243. Width 516 px, so it ends at x 892 (≤ 900). If the real string renders wider, drop to 104 px (488 px). |
| Sentence (grey) | Your receptionist can't be / in two places. | Instrument Sans 450, 32 px, `#6B6B6B`, centred x 634, baselines 1300 / 1338. Width 571 px on one line, so it is set on two lines (max 540 px). |

**On-screen words:** big tier 5 (≤ 6). The sentence tier carries the keyword "receptionist" at f0, for muted viewers and for TikTok's text read.

**Spoken (Tessa):** "Your receptionist can't be in two places." Onset ≈ f10 (after the trill's 10 f peak, as ig5 placed its hook), ends ≈ f82. Words lift to full ink on her onsets. "Can't be" lands on "can't". "*in two places.*" slides in on "in" and lands on "places" (≈ f75) with `pop` + `sub`.

**Motion:**
- The handset rattles through the ring's 2 s "on" phase (f0-60): a hop of 0 → 10 px along its normal on `SPRING.land` every 4 f, with rotation alternating ±0.8°.
- Each hop's landing tightens the shadow.
- The ring arcs draw out (10 f, `EASE.expo`) and wipe off (6 f), twice.
- Macro drift is always on: scale +1.5 %/s about the cup.
- After f60 the phone is **still** (the ring's "off" phase) and only the drift moves.

**Sound:**
- `fx-trill` at f0 (the series' desk trill; it peaks 10 f before falling 30 dB, `common/series.ts:41`).
- A second `fx-trill-1` chirp only if the measured take has a ≥ 4 f gap after "receptionist". Otherwise the second half of the burst is visual only (series rule: a ring never covers a word's onset).
- No bed yet: dry room tone. The music arrives with the agent.

**Hookscore** (`python3 -I .claude/skills/ig-reel/hookscore.py`; patched = RESEARCH-viral's whole-word "yo" fix, `scratchpad/ig6r/hs/hs_patched.py`):

| Spoken line | Raw | Patched | Notes |
|---|---|---|---|
| **Your receptionist can't be in two places.** (chosen) | **77.8 STRONG** | **81.4** | 7 words, ~2.5 s. Payload "can't" at word 3; concrete "two". The receptionist keyword is heard at ≈ 0.4 s. |
| …+ "Neither can you." (the b2 kicker) | 80.8 STRONG | 84.4 | Widens the hook to owners who are their own front desk. |
| Two places at once? Your receptionist can't. | 84.4 STRONG | 84.4 | **A/B reserve.** Same idea; "two" leads. |
| Your receptionist has two hands. Not three. | 80.8 STRONG | 84.4 | Reserve: the "invisible third hand" read of the pickup. Slightly cryptic cold. |
| Phone ringing off the hook? You can't pick up. | 77.8 STRONG | 77.8 | The title idiom as the hook. It spends the pun up front, so it is rejected. |
| You can't be in two places. Your phone doesn't care. | 84.4 STRONG | 100 | 10 words, ~3.6 s: too long for the 2 s window, and "your phone" invites the forwarding question. Rejected. |
| It rings. Your hands are full. Still ringing. | 80.8 STRONG | 80.8 | **Rejected on truth:** "still ringing" means a second ring, which breaks the first-ring pickup. |

Scorer caveat (its own header): AUC 0.56 between good hooks, so everything above 77 is a tie. The pick is made on fit: the receptionist family (563 vs ≤ 283 TikTok views, profile.md), a pro-staff stance, and a frame 0 that reads muted.

---

## 3. Beat sheet (28.0 s, 840 f at 30 fps, 120 BPM: beat 15 f, bar 60 f)

Frames are plan targets. `src/ig/ig6/timing.ts` re-anchors every line to the measured takes (`place` / `upBeat`, 6 f gap, snap to the next 16th), as ig1-ig5 did. Act boundaries, IMPACT and END stay on their bars. **One moving text at a time.** Big lockups use STYLE §2.4: the lead word rises through its mask in 7 f on `EASE.expo`; the accent slides and wipes in over 9-10 f, landing on its spoken word; the sentence tier is set at 72 % as a unit 2 f before its first word, and each word lifts on its onset. Every lockup holds ≥ 15 f after it lands. Lockups are screen-locked (k = 0), so **a lockup holds still across a cut while the object changes under it**: the type is the eye-trace anchor for the match cuts.

| Beat · frames · time | Picture: crop, camera, object motion | Type: big lockup (≤ 6 words) + sentence tier | Spoken (Tessa) | Sound |
|---|---|---|---|---|
| **b1 HOOK** · f0-81 · 0.0-2.7 s | §2. P1. The handset rattles in the cradle through the ring's "on" phase (f0-60), with the ring arcs drawing out twice. Then it is still; only the macro drift moves. | **Can't be / *in two places.*** (set at 72 % at f0)<br>sentence: "Your receptionist can't be in two places." | **ig6-01** @10: "Your receptionist can't be in two places." | `fx-trill` f0. Optional `fx-trill-1` in a measured gap. `pop` + `sub` (−8 dB) on "places". Room tone only. |
| **b2 KICKER** · f81-135 · 2.7-4.5 s | **f78-85 T3 rotation whip:** the frame spins 75° about the cup in 7 f on `EASE.peel` and cuts on its fastest frame (f81) to **P2 Cord**, whose own rotation continues −35° → 0 on `EASE.expo`. The black coils still tremble from the ring (a damped oscillation of loop phase, ±6 %, decaying over 30 f): the cord as the tether that keeps you at the phone.<br>**f126 T1 tick cut back to P1.** Anchor: a cord loop at screen (575, 565) cuts to the earpiece cup at (579, 561). The phone is silent, in the ring's off phase. **Near-silence f127-134.** | **Neither / *can you.*** (the lead pops in: scale .86 → 1 on `SPRING.pop`; the accent lands on "you")<br>sentence: "Neither can you." | **ig6-02** @90: "Neither can you." | `swish` peaking on the f81 cut. `tap` (−26 dB) on "Neither". Near-silence f127-134 (room tone at the floor). |
| **b3 PICKUP** · f135-240 · 4.5-8.0 s | **f135: the handset lifts itself, before a second ring.**<br>- The handset translates 220 px off the horn along its normal and drifts +40 px x, rotation +6°, scale 1.00 → 1.06 (nearer the camera), over 9 f on `SPRING.pop` (≈ 4 % overshoot).<br>- Its shadow grows from (24, 48, 10 px, 7 %) to (56, 112, 20 px, 5 %): the height cue that sells the lift without 3D.<br>- **f136:** the plunger springs up beside the horn (`SPRING.pop`, 8 f) with its **teal cap**: the first teal on the object.<br>- **f137-150:** the camera follows up and right (×1.00 → ×0.85, `EASE.house`). The coiled cord comes into frame from the lower left, stretching, and **turns teal from the handset end along its length** (a trim-path colour wipe, 12 f, `EASE.expo`).<br>- **f150-162, T4 line match:** the camera pans down the cord; the coil's amplitude goes to 0 and it **straightens into one 6 px teal line** across the frame at y 1285, which becomes the underline of the coming accent phrase. The line hands off from the cord's plane to the screen-locked lockup plane on f162.<br>- **f162-240:** the handset floats upper right (cup at about (760, 420)), rising 1 px/f. The teal line is the horizon. | sentence (set f140): "Our AI receptionist / picks up on the first ring." (2 lines)<br>**Picks up / *on the first ring.*** The lead lands on "picks" (≈ f180). The accent lands on "ring" (≈ f228), sitting on the teal line. | **ig6-03** @142: "Our AI receptionist picks up on the first ring." | **f135 `fx-pickup`** (0 dB: the click). `pop` (−10 dB) on the plunger at f136. `draw` under the cord wipe and the straightening (f137-162). **The bed enters on f135:** 120 BPM, minimal soft kick on 1 and 3, felt-piano pulse in E (the series key). The music arrives with the agent. `pop` + `sub` on "ring". |
| **b4 MONTAGE** · f240-348 · 8.0-11.6 s | **Three more first-ring pickups, each in a new macro of the same phone.** Each one goes: hard cut with the handset landing in the cradle (onset − 15 f), one chirp (onset − 8 f), the lift on her onset. Cut on the landing; the motion continues across the cut.<br>**(a) f240 → P3 Horn:** the cup drops onto the horn (the plunger presses), the chirp, then the cup leaves the frame upward on "Lunch" (f255). The ring arcs flick once.<br>**(b) f270 → P4 Plungers:** both pegs press down as the handset lands, the chirp, then **both pop up with teal caps** on "After" (f285), `SPRING.pop`, staggered 2 f.<br>**(c) f300 → P2 Cord:** the coils slacken (black, the handset down), the chirp, then they **snap taut and teal** on "At" (f315), a 4 f colour wipe. | (a) **Lunch / *rush.*** f255-281<br>(b) **After / *closing.*** f285-311<br>(c) **At / *3 a.m.*** f315-348. The display map shows "3 a.m." for "three a.m.". Set Cormorant's `lnum`, because its default "3" is old-style and sits at x-height.<br>Each lockup holds through the next cut and exits up through its mask (4 f, `EASE.in3`) as the next one enters. Sentence tier = the phrase itself. | **ig6-04a** @255 "Lunch rush."<br>**ig6-04b** @285 "After closing."<br>**ig6-04c** @315 "At 3 a.m."<br>(three short takes, so the lifts can sit on her onsets) | Per call: `fx-click-down` on the cut/landing, `fx-trill-1` (4 f) in her gap, `fx-pickup` at −6 dB on the lift. The kick keeps the grid. No accent `pop` here (≤ 1 big landing per bar). |
| **b5 FROM YOUR WORDS** · f348-456 · 11.6-15.2 s | **f348 T1 tick cut to P6 Dial centre card.** Anchor: the "3 a.m." lockup stays put while the object changes under it.<br>- The card (Ø 672) carries four grey ruled hairlines, with the teal dome at its centre and the finger holes' inner edges at the frame edges.<br>- Macro drift, plus the dial plane rotating +0.6°/s.<br>- **On "your words" (≈ f392):** the four ruled lines **draw over in teal**, left to right (12 f each, `EASE.draw`, staggered 3 f): the agent reading what you wrote.<br>- **On "takes the message" (≈ f425):** a fifth line **writes itself** below them as a teal felt-tip stroke (14 f, `EASE.draw`). It is a stroke, not text. | **It answers / *from your words.*** (accent 100 px = 600 px wide) lands on "words"<br>**It takes / *the message.*** lands on "message"<br>sentence: each sentence as said | **ig6-05** @360: "It answers from your words. It takes the message." | `draw` (−18 dB) under the line draws. `fx-felttip` on the written stroke. `pop` + `sub` on "message" (bar 8 landing). |
| **b5c IT'S AN AI** · f456-526 · 15.2-17.5 s | **f456 T1 tick cut to P7 Earpiece face.** Anchor: the card's teal dome (540, 640, Ø 192) cuts to the earpiece's centre-hole dome at the same place and size. The disc is black with 12 white holes on a ring.<br>- **On "hears" (≈ f475):** **one** teal hairline ring (3 px) expands from the centre hole to Ø 900 and fades (12 f, `EASE.expo`). It is a single pulse, **never a waveform synced to Tessa** (she is not the product voice).<br>- **On "AI" (≈ f515):** the 12 holes turn teal-centred one by one, clockwise (`SPRING.pop`, 1 f stagger): the reference's dots-on-an-arc, our way. | **Every caller hears / *it's an AI.*** (6 words, the cap; lead 60 px = 460 px wide) lands on "AI"<br>sentence: "Every caller hears it's an AI." | **ig6-06** @462: "Every caller hears it's an AI." (**first trim**, §3.4) | `fx-glass-tick` (−26 dB) under the 12 holes. `tap` on "hears". |
| **b6 REVEAL + PAYOFF** · f526-645 · 17.5-21.5 s | **f526-533 T3 whip, then a pull-back reveal (once, late):** the frame spins out of P7 and cuts on f529 to **M5**, settling ×1.6 → ×1.0 over 20 f (`EASE.inOut`, no overshoot). The whip hides the change of view.<br>- **The whole phone, for the first time:** the white base with hairline and shadow; the dial with its teal dome; the plungers up with teal caps.<br>- The handset **floats above the cradle, off the hook**, bobbing on its teal coiled cord (sine, 1.2 s period, ±8 px, ±1°; the coils breathe with it).<br>- Its long shadow lies farther away on the base (60, 120, 22 px, 5 %).<br>**Near-silence f556-563.**<br>**f605-645: hold.** This is the screenshot frame (≈ f625) and the alternate cover. | **You're both / *off the hook.*** (accent 120 px = 513 px) lands on "hook" (≈ f597)<br>sentence: "You're both off the hook." | **ig6-07** @565: "You're both off the hook." | `swish` peaking on f529. `whoosh-soft` under the settle. **Bed ducked to near-silence f556-563**, with `riser-short` into it. On "hook": `pop` + `sub` + `thump` (−8 dB), the bed back with the pad an octave up. The reel's biggest landing. |
| **b7 CTA** · f645-780 · 21.5-26.0 s | **f645 T1 tick cut to P5 Dial arc** (the reference's own composition). On "Ring" (≈ f645) the dial winds clockwise by one hole spacing to the finger stop (8 f, `EASE.house`), then **returns at constant speed** (24 f, linear, like a real dial's governor), with a ratchet tick at each hole.<br>**f676-686 T2 zoom-through:** the camera pushes into one white finger hole (×1 → ×16 in 10 f, `EASE.in4`) until white fills the frame, and opens on the **white end card** (§5) at f687: white to white, no seam.<br>**f687:** the comment field rises, before she says "Comment AGENT". AGENT types one letter per 16th from her word "AGENT" (≈ f706). The send disc presses as "link" ends (≈ f740). Hold to f780. | **Ring it / *yourself.*** lands on "yourself"<br>End card: **Comment** / [field: AGENT] / ***for the link.*** (the lockup splits around the field and reads top to bottom as her sentence) | **ig6-08** @645: "Ring it yourself."<br>**ig6-09** @694: "Comment AGENT for the link." | `fx-tick` × 4 (one per hole) under the dial's return: the satisfying layer. `whoosh-rev` peaking on f686, `thump` on the open. The series end stack: `fx-menu-open` on the field, `fx-keys` per letter, snare roll from f750, riser crest. |
| **b8 BRAND** · f780-826 · 26.0-27.5 s | **Impact on the bar line (f780, bar 14).** The field and lockup exit up through their masks (5 f). The teal dome travels from the send disc to the wordmark's end and **stamps**: scale 0 → 1.12 → 1 on `SPRING.pop`, with its own shadow. NEUROVOICE surfaces centre-out behind it; the URL types on her syllables (§5). | wordmark + `neurotechvoice.com` | `ig1-07` @784 (borrow): "Neuro Tech Voice." | `impactHits()` (riser + `fx-impact-end` + thump + slam). The name into its ring. |
| **b9 SEAM** · f826-840 · 27.5-28.0 s | §4: the handset is **hung up** and the phone **rings again**. | the hook lockup rises as a unit and is set at 72 % by f839 | none | `fx-click-down` + `fx-click-up` (layer) at f834. `fx-trill-1` at f836. `MIX.fadeOut` [826, 840]. |

### 3.1 Acts (`SCENES`)

| Act | Frames | Bar |
|---|---|---|
| hook | 0-135 | 1-3 (pickup on beat 2 of bar 3, f135) |
| pickup | 135-240 | 3-4 |
| montage | 240-348 | 5-6 |
| words | 348-526 | 6-9 |
| reveal | 526-645 | 9-11 |
| cta | 645-780 | 11-13 |
| end | 780-840 | 14 |

### 3.2 Voice lines (Tessa = `ava`, Tessa (Emotive) `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`, speed 1.05, the series setting)

| Id | Text | Words | Note |
|---|---|---|---|
| ig6-01 | Your receptionist can't be in two places. | 7 | Warm, matter-of-fact; no stress on "can't". |
| ig6-02 | Neither can you. | 3 | A small smile. |
| ig6-03 | Our AI receptionist picks up on the first ring. | 9 | Light lift on "first ring". |
| ig6-04a / b / c | Lunch rush. / After closing. / At three a.m. | 2 / 2 / 3 | Three takes, so each lift lands on an onset. |
| ig6-05 | It answers from your words. It takes the message. | 9 | Two even sentences. |
| ig6-06 | Every caller hears it's an AI. | 6 | Plain, unapologetic. First trim. |
| ig6-07 | You're both off the hook. | 5 | The payoff: relief, not a punchline voice. |
| ig6-08 | Ring it yourself. | 3 | An invitation. |
| ig6-09 | Comment AGENT for the link. | 5 | The series CTA. The bio variant "The link's in our bio." is the fallback if nobody can answer DMs (ig5-07-bio precedent). |
| ig1-07 (borrow) | Neuro Tech Voice. | 3 | Installed. |

**54 words before the sign-off.** At the series' measured 2.65-2.78 words/s that is 19.4-20.4 s of speech. At a syllable rate (75 syllables at about 4.5/s) it is about 17 s. The plan budgets about 21 s of speech plus 3 s of air (the near-silence before the pickup, the 1.3 s reveal, the payoff hold), so the CTA should end around f720-740.

### 3.3 `beats.py` and the style

`beats.py script.txt --target 28` reports 58 words, ~21.1 s at 165 wpm, the hook inside 3 s, and every beat ≤ 3.3 s. Its flags, and why they stand:
- **"6.9 s under target."** This is deliberate: the style wants air, and the gap is the wordless reveal, the pickup silence, the AGENT typing and the brand.
- **"No number in beats 1-3 / 5-7."** Its regex counts digits only. "two places" and "3 a.m." are the concrete markers, and this reel has no statistic by design.
- **"No loop (no shared word)."** The loop here is picture plus sound: the same ring opens and closes the reel, and the handset goes back to frame 0's cradle (§4). "both" also answers "two places" / "Neither can you".

### 3.4 If the takes run long or short

- **CTA ends after f750:**
  1. Cut **ig6-06** (−2.4 s). The disclosure stays in the caption fine print ("It tells every caller it's an AI").
  2. Then cut **ig6-08** "Ring it yourself." (−1.3 s); the dial beat becomes wordless (≤ 1.5 s, SFX only, allowed).
  - Never cut "on the first ring", "Neither can you" or "You're both off the hook".
- **CTA ends before f690:** use the **26.0 s** cut (impact f720, END f780). Only the end card moves.
- **Invariant to assert in `timing.ts`:** no ring hit between the end of f0's burst and the f135 pickup. The reel must never show a second ring before the first pickup.

---

## 4. The loop seam (f826 → f839 → f0)

| Frame | What happens |
|---|---|
| f826-831 | The wordmark, the URL and the dome exit up through their masks (5 f, `EASE.in3`). The ground stays white, so nothing changes colour. |
| f826-834 | The camera is already at **P1**. The handset **drops in from the upper right along its lift path, reversed** (8 f, `EASE.in3`), and lands in the cradle at **f834**: the hang-up. |
| f834-837 | The plunger presses down (teal cap → grey). The cord's teal drains back to black, wiping from the base end toward the handset (4 f). The shadow tightens back to (24, 48, 10 px, 7 %). |
| f836 | **It rings again**: the first hop, and the first ring arc starts drawing. `fx-trill-1` (4 f), which hands into f0's `fx-trill`. On replay the reel starts mid-ring, as ig5's seam does. |
| f832-839 | The hook lockup ("Can't be / *in two places.*" + sentence tier) rises as a unit and is **set at 72 % by f839**. |
| f839 ≈ f0 | Same crop, same pose (mid-hop), same arc phase, same lockup at 72 %, same zero teal on the object. Frame-diff target: < 2 % of pixels changed between f839 and f0 at 30 fps. |

**Story of the loop:** the agent hangs up, and the phone rings again. "Ringing off the hook" happens in picture, which is the title's third meaning. The last spoken word, "Voice.", hands to the ring and then "Your receptionist…".

---

## 5. The end card: NEUROVOICE on white (`End6`, ig6-local)

Recommended: **`End6`**, the white minimal end card of STYLE §4.4, built in `src/ig/ig6/End6.tsx` from `components/End.tsx`'s exports (`Wordmark`, `WORDMARK_FONT`, `WORDMARK_TEXT`, `END`, `endState`, `agentKeys`, `ctaLine`) and `impactHits` from `common/series.ts`, **without editing `End.tsx`**. Fallback: `IgEnd` unchanged with `tone="pearl"` (ig5 precedent; its teal bloom is a glow on white, which is off-style).

| Part | Spec |
|---|---|
| **Entry** | b7's T2 zoom through a white finger hole: white fills the frame (f686), and the end card opens on the same white (f687). |
| **CTA lockup, split around the field** | **"Comment"**: Instrument Sans 580, 64 px (295 px wide), `#0A0A0A`, centred, baseline y 860. Mask rise on "Comment" (≈ f694).<br>**Comment field:** white pill **x 174-880** (TikTok rail clear; IgEnd's 906 is pulled in), y 900-1020, r 60. 1.5 px `#E6E6E6` border plus the style's long shadow (24, 48, 10 px, 7 %). Message icon and caret in `#0A0A0A`. **AGENT** typed in Instrument Sans 600 `#0A0A0A`, one letter per 16th from her "AGENT". Send disc Ø 72, teal, white arrow. It presses (scale .94, 4 f) as "link" ends.<br>**"*for the link.*"**: Cormorant Italic 600, 110 px (445 px), teal, centred, baseline y 1140, wiping in to land on "link".<br>No separate sentence tier: the three parts read top to bottom as her sentence. |
| **Impact (f780)** | No bloom. The field and lockup exit up (5 f). The **teal dome** (the dial's centre pin, the agent) flies from the send disc to the wordmark's end on `EASE.expo` (8 f) and stamps (0 → 1.12 → 1, `SPRING.pop`, its own (6, 10, 4 px, 18 %) shadow), on the `impactHits` stack. |
| **Wordmark** | NEUROVOICE exactly as the series sets it: Inter Tight 500, −0.07em, ≤ 760 px wide, y 760-900, ink `#0A0A0A`. The letters surface centre-out behind the dome and are never altered. The teal dome is the **full stop**, baseline-aligned, Ø = x-height × 0.55. |
| **URL** | `neurotechvoice.com`, Instrument Sans 450, 34 px, `#6B6B6B`, y ≈ 1000, typed in three chunks on "Neuro \| Tech \| Voice". No price, no "Start free" button, no booking (series rules). |
| **Seam** | §4. |

---

## 6. Cover (`src/ig/ig6/Cover.tsx`, PNG `IG6-Cover-9x16`)

A title and one graphic, as in ig1-ig5. All words sit inside ig5's cover box (x 86-900, y 260-1380), inside both apps' 3:4 grid tile and clear of TikTok's grid view count.

| Element | Spec |
|---|---|
| **Graphic** | Frame 0's handset group (P1 handset, horn, ring arcs), moved up to handset centre (120, 760) so the title is clear, as in the mock. Strokes ×1.5 for the grid tile (ring arcs 4.5 / 3.75 / 3 px). |
| **Kicker** | **AI RECEPTIONIST · 06** (label role: Instrument Sans 560, 30 px, +0.08em, `#6B6B6B`), x 300, baseline 1000. It carries the search keyword and the series number (ig5's `AI RECEPTIONIST · 05` precedent). |
| **Title** | **Your receptionist** (Instrument Sans 580, 76 px = 576 px wide, `#0A0A0A`, x 300, baseline 1090) / ***can't be*** (Cormorant Italic 600, 140 px, teal, x 286, baseline 1220) / ***in two places.*** (140 px = 657 px, x 232, baseline 1350, ending at x 889). Every word is spoken in the reel. |
| **Instagram** | Upload the PNG (Edit cover → Add from camera roll). Fallback: frame 0. |
| **TikTok** | The feed autoplays from frame 0, which is the hook itself. Upload the PNG if the app offers it; otherwise pick the payoff hold (f620-630: the whole phone, "You're both / *off the hook.*"), with no text sticker. |

---

## 7. Why it gets shared and rewatched on TikTok

1. **Identity hook, in the account's only proven family.** "Your receptionist can't be in two places" is something every front-desk person and owner agrees with on sight. The natural send is "this is literally me at 12:30" or a tag of the front desk. The receptionist family is the only one that has doubled our TikTok views (ig1 563 vs ≤ 283, profile.md) [R]. "Neither can you." pulls in owners who are their own front desk, most of our customers.
2. **A pattern break at 4.5 s, past the first swipe point.** The handset lifts with no hand and no face. "Who picked up?" is a curiosity gap that carries the viewer past the 3-5 s drop [K; information gap, RESEARCH-viral A4]. The faceless style makes the magic read as design, not as an ad (RESEARCH-viral §2.2).
3. **A mechanical satisfying layer.** The plunger pops, the cord stretches into a straight line, three lift-drops land on the beat, and the dial winds and ratchets back. This is the "oddly satisfying" family, a hypothesis our retention graph tests, since no controlled study exists [K; S11].
4. **A pun that pays on the reveal, so people rewatch.** "You're both off the hook" lands while the pull-back shows the handset literally off the hook. People replay to catch it and comment to explain it to each other. The hold frame is the screenshot [K].
5. **A loop with a story.** The agent hangs up, and the phone rings again (the title's third meaning). Instagram counts replays as views [S5, via RESEARCH-reels]; TikTok weights watching to the end [P1].
6. **Works with the sound on and with it off.** A ringing phone at f0 is a sound people turn toward. The keyword pair is on screen at f0. The key message is spoken by 2.5 s and on screen at f0, in line with TikTok's "key message within the first 3 seconds" ad finding [P2; an ads document, directional].
7. **Searchable.** "receptionist" is spoken at ≈ 0.4 s and on screen at f0; "AI receptionist" is spoken and on screen at ≈ 5 s; the cover kicker and the caption's first line carry it too [K].
8. **Comment drivers with clean answers** (reply bank, §9 note): "How does it get my calls?" (its own number, next to your line), "Do callers know it's AI?" (yes, every caller hears it), "So it replaces the receptionist?" (no: you're *both* off the hook). Each answer is true, and each reply keeps the thread going.

---

## 8. Facts used (SAFE lines only; no third-party figures)

| On screen + spoken | Status | Source in code (RESEARCH-product §3) |
|---|---|---|
| "Our AI receptionist picks up on the first ring." | **B**: site copy, no measured speed; **no number attached**, and the picture shows no timer | `lib/pages/ai-agents.ts:40` ("picks up on the first ring"); `lib/site.ts:713, 944`; `lib/pages/home/call.ts:17`. Nothing in the code delays the answer (`router.ts`, no ring-count setting). |
| "Lunch rush." / "After closing." / "At 3 a.m." | **A** (default always-answer) | `call.ts:17`: "Answered on the first ring — at 3 a.m., on a Sunday, just after closing, in the middle of a rush." "Lunch rush" paraphrases "in the middle of a rush". `router.ts:198-224`. |
| "It answers from your words." | **A** (knowledge base on every plan) | `lib/pages/home/pricing.ts:67`; `session-loader.ts:236`; `knowledge-base.ts:496-497` (S6) |
| "It takes the message." | **A** (every plan) | `lib/voice/session-loader.ts:240` `take_message: true` (S8) |
| "Every caller hears it's an AI." | **A** | `lib/voice/prompt.ts:265`; `lib/voice/greetings.ts:13-15`; `site.ts:2527` (S11) |
| "Ring it yourself." | **A** (trial test calls are free, 5 a day) | `lib/site.ts:1813` ("give it your documents and ring it yourself"); `entitlements.ts:39`; `lib/billing/usage.ts:623` (S17) |
| "Comment AGENT for the link." | series CTA | `voice.md` "The ask"; RESEARCH-product §7 |
| "Your receptionist can't be in two places." / "Neither can you." / "You're both off the hook." | opinion and idiom, not product claims | none needed |

**Not used, on purpose:** the ring cadence F1 ("one ring = 6 s"), the Clio, NHS and HBR figures, prices, booking, "24/7", "14 languages" (it can go in the caption), "under ten minutes".

**Caption fine print** (paste from RESEARCH-product §8, standard version, unchanged): "Free trial: 5 minutes over 14 days, no card needed. On the trial it answers your own test calls; to answer customers, the agent needs its own phone number ($1.15/month, card required). One agent per business, set to one of 14 languages. It tells every caller it's an AI."

---

## 9. Self-check: truth rules and series coherence

| Rule | Status | How |
|---|---|---|
| No invented statistics, results or testimonials | **PASS** | There is no figure in the reel at all. "two places", "3 a.m." and "first ring" are not statistics. |
| Every product claim verified in code | **PASS** | §8, line by line. "First ring" is B, said exactly as the site says it, with no number. |
| No number on our speed; no picture implying one (U3) | **PASS** | No timer, clock or seconds anywhere near a pickup. F1 is deliberately absent. The pickup simply comes before a second ring is heard. |
| No forwarding or takeover picture (U5) | **PASS, with care** | **Every pickup happens on that call's first ring.** No call rings out and is then "taken". No line-one/line-two hand-off, no "your number", no "keep your number", no "when your line is busy". The caption says the agent answers **its own number**, and the pinned comment repeats it, as ig1 and ig3 did (`docs/ig/SCRIPT.md` §0.4 row "its own number alongside your line, no porting": caption + pinned comment). Reply bank: "It has its own number, next to your line." |
| No concurrency claim (U4) | **PASS** | Never two rings at once. The montage is sequential calls at different times of day (lunch, after closing, 3 a.m.). |
| No absolutes (U1, U2) | **PASS** | No "never miss a call", no "every call answered". "Every" is used only in "Every caller hears it's an AI" (literally true). |
| Booking / calendar / $49 | **PASS** | None. One cut; nothing waits on the Starter-booking ship. |
| Trial facts | **PASS** | "Ring it yourself" only. The trial terms are in the caption, never next to booking or texts. |
| Tessa is not the product voice (`docs/ig/SCRIPT.md` §0.4: never "Tessa is the voice you get") | **PASS** | She narrates in the third person ("It answers…"). The earpiece pulse is one ring, not a waveform synced to her, and nothing says "this is our agent speaking". No greeting is shown, so the per-language disclosure rule (C7) does not apply. |
| "Off the hook" as an overclaim? | **PASS (flag for the truth judge)** | An idiom for relief from answering every call, not a guarantee. It sits after the honesty line and before the trial CTA, and is never paired with "never" or "every call". |
| No competitor | **PASS** | None. |
| Never "replace / fire your receptionist" (ig1) | **PASS** | The receptionist is defended in the hook and still there at the payoff ("You're **both** off the hook"). The AI takes the phone, and the people stay with the people in front of them (voice.md position 5). |
| Tessa on every on-screen line; no unspoken text | **PASS** | Every lockup word and every sentence-tier word is spoken. The dial has no digits and the card's lines are not text. The cover is an image (its words are spoken in the reel anyway). |
| ≤ 6 words per card (big lockup) | **PASS** | Max 6 ("Every caller hears / *it's an AI.*"). The hook card has 5. The sentence tier is the subtitle of her line (≤ 9 words, ≤ 2 lines). Strict variant if the judges count it as a card: split ig6-03's tier at "receptionist" (3 + 6). |
| Safe zone | **PASS (zone guard to confirm)** | All text inside x 86-900, y 240-1400; every lockup in y 1117-1374. Objects: x ≤ 880 below y 840 (the P1 horn sits above y 840; M5 is inside x 160-880; the field is pulled in to x 880). |
| One accent; style don'ts | **PASS** | Teal only (no rose, no emerald, no app pills). No glow, bloom, mesh, blur, emoji or skewed text. The only serif-italic use is the accent phrase (STYLE §4.2 exception). |
| Series beats | **PASS** | 120 BPM grid, impact on the bar line, NEUROVOICE wordmark, AGENT CTA, URL, 14 f seam that re-forms frame 0, "AI receptionist" keyword. |
| Echoes of earlier reels | **noted** | "can't" echoes ig5's "You can't": a series motif, not a repeat. **ig6 introduces a handset**, where ig5 kept "no people, no handset". STYLE §4.3 lists the desk phone as an allowed hero object; the change belongs to the new style. |

---

## 10. Production risks in Remotion without 3D libraries

| # | Risk | Mitigation |
|---|---|---|
| R1 | **The coiled cord.** A helix has to read as a phone cord in 2D, stretch smoothly, straighten into a line, and change colour along its length, as a pure function of t at 120 fps. | Procedural prolate-trochoid path along a spline (≈ 400-600 points per frame), with parameters r, pitch and amplitude. Draw it as one stroke plus a blurred shadow copy. Do the colour wipe as two overlapping strokes with a `strokeDasharray` trim, using `getLength` from `@remotion/paths` (present in node_modules, not declared in package.json; or a small local length function). Check a still at P2 ×3.2 first: thick coils can read as a spring or a slinky. Reference shots before building. |
| R2 | **The lift is a 3D move faked in 2D.** It can read as a slide instead of a lift. | Scale 1.00 → 1.06, plus a shadow that moves farther, blurs more and fades (STYLE §5.3: the shadow on a **non-rotating wrapper**), plus the plunger popping up in the same frame. 120 fps strip check of f135-150. |
| R3 | **Two views of one handset** (profile in P1/M5, the cup face in P7). | The view change is never animated. It happens only on cuts and whips (f456 T1 dome anchor, f526-533 T3 whip). P7 is a separate cut-away drawing. |
| R4 | **The M5 reveal could read as an abstract shape** at grid size. | The front elevation is the ☎ icon, which the mock confirms reads at 360 px wide. Test again at a 390 px tile. Fallback: drop the plunger caps and keep only the cord and dome teal. |
| R5 | **Match-cut anchors** (cord loop → cup, dome → dome, white hole → white card) must land on exactly the same screen pixels. | Compute each anchor's screen position from the camera at the cut frame (shared `Camera.tsx`). Unit test: anchor drift < 4 px across each cut. |
| R6 | **The T4 cord-to-underline hand-off between planes** (cord k 1.06 → lockup k 0). | At f162 the line is redrawn in screen space at exactly y 1285. Before that frame it is the cord; after it, the lockup's underline. Assert continuity in a 120 fps strip. |
| R7 | **Montage sound density**: 9 events in 3.6 s around three short takes (check-mix scores each word's first 200 ms). | Chirps sit in her gaps (≥ 4 f) and clicks fall on cuts, before her onsets. If check-mix fails, drop the chirps on (b) and (c) and keep the ring arcs as a visual-only ring. |
| R8 | **Ring sound vs object.** A rotary-dial phone suggests a bell, but a 2 s bell would mask her first words. | Keep the series' `fx-trill` (sonic continuity with ig3 and ig5, short bursts). Optional ig6-local `fx-bell`: a single dry strike at f0 only, in `scripts/ig6`, if the panel wants it. |
| R9 | **Fonts.** Cormorant Garamond Italic 600 isn't loaded by `lib/fonts.ts`, and its default figures are old-style (its GSUB has `lnum`, `pnum` and `tnum`). | `src/ig/ig6/fonts.ts` imports `@fontsource/cormorant-garamond/600-italic.css`, plus `useFaceReady` before `measureText`. Set `font-feature-settings: "lnum"` on "3 a.m." (and check the "3" clears the sentence tier by 31 px). |
| R10 | **Banding** in the 7 % long shadows on white in the 60 fps upload. | STYLE open point 5: a 2 s probe strip (`src/ig/qa/Probe.tsx` pattern) before the master. Keep `IgFinish` grain at 0 and dither only if needed. |
| R11 | **Zone guard.** The series zones are Instagram's; ig5 had to pass its own. | Copy `src/ig/ig5/zones.ts` into `src/ig/ig6/zones.ts` (text bottom 1400, rail from y 840, x 880 for objects). Every lockup is reported through `ZoneRect`, and the cover is checked in cover mode. |
| R12 | **The first-ring invariant** can break when lines are re-anchored. | `timing.ts` asserts no ring `H(...)` between f60 and the pickup, and pins the pickup to `vWord('ig6-02', last) + ≥ 9 f` (so it always follows "Neither can you."). |
| R13 | **Performance at 120 fps** (3360 frames, SVG with ~600-point cord paths and drop-shadow filters). | Transforms on the layer `div`s, not on SVG children. Shadow filters only on the three raised groups. Generate dial holes and ring arcs only for the visible crop. |
| R14 | **Takes.** "Lunch rush / After closing / At three a.m." as one take may come out rushed or run-on. | Three separate takes (ig6-04a/b/c), as ig5 split its lines; pick by measured onsets. |

---

## 11. Open decisions for the judges and the owner

1. **End card:** `End6` on white (recommended, style-true) or `IgEnd` unchanged (series-true, with a teal glow on white).
2. **ig6-06 "Every caller hears it's an AI."**: keep it (trust, pre-empts "it's deceptive" comments) or trim it to the caption if the takes run long (§3.4).
3. **Hook A/B for TikTok a week later:** "Two places at once? Your receptionist can't." (84.4) over the same body.
4. **Ring sound:** the series `fx-trill` (recommended) or an ig6-local bell strike at f0.
5. **Cover:** the hook frame (recommended: it promises, it doesn't spoil) or the payoff hold.
