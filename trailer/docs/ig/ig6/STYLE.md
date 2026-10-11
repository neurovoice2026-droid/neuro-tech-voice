# ig6 · STYLE: the "minimal faceless" look, as a Remotion recipe

Label `style`. Written 2026-10-11 on `claude/remotion-trailer` (HEAD `9cb3bc8`). Planning only: no code, no voice, nothing
outside `docs/ig/ig6/` touched, nothing committed.

**The reference.** `instagram.com/reel/Da0DayIpsie` by @divyansh.fx_ ("Divyansh | Motion Designer", posted 2026-07-15,
caption "Faceless video edit. Minimal visuals. Maximum impact."). The video is login-walled. All we have is the
360 × 640 thumbnail (`scratchpad/ref6/thumb.jpg`) and the page metadata. §1 measures that frame pixel by pixel. §2 infers
the motion from the style family and cited practice; every inferred rule is marked **[inferred]**.

**Companion.** `RESEARCH-viral.md` (the scenarios and the facts). This file covers only the look, the motion, the sound
grammar and the tooling, so a developer can build any of those scenarios in it.

**Chosen script:** "One ring" (`SCRIPT.md`). Its exact build values (fonts and loading, colour tokens, shadow, object
construction, easing, type and transition recipes) are in **§9**, which wins where it differs from §1-§8.

---

## 0. Decisions (TL;DR)

| | Decision | Why |
|---|---|---|
| Ground | Flat `#FFFFFF`. No mesh, gradient, vignette or visible grain. | The reference is pure 255 in every corner. |
| Ink | Near-black `#0A0A0A` for the object and the lead word. Grey `#6B6B6B` for the sentence tier. Tick greys `#D6D6D6` / `#222222`. | Measured (§1.3). |
| The ONE accent | **Teal `#0A8AA8`** (the site's Sunday clock figures, `LIGHTS.sunday.num`). Deep `#0E7490` for small accent text and dome shading. | Same lightness and saturation as the reference green (§4.1); teal is "ours / the agent" in ig1-ig5. |
| Type | Lead word: **Instrument Sans 580**. Accent phrase: **Cormorant Garamond Italic 600** (the site's own spoken-line face). Sentence tier: **Instrument Sans 450**. | Brand-native pair. Both are installed offline (§5.1). |
| Hero object | A real object in macro, drawn as flat 2.5D vector paper. The clock dial is the reference's own object and fits our story. **The orb is NOT the hero.** It becomes a flat teal dome: the hub cap, the arc dots, the end card's full stop. | §4.3 |
| Depth | 2.5D SVG layers + CSS transforms, with parallax factors and a soft long shadow (24, 48, blur 10, 7 %). **No three.js** (it is not installed). | §5.3 |
| Voice | **Keep Tessa on every on-screen line.** The style is voice-native: its small grey paragraph *is* the spoken sentence, and its big words are lifted out of it. | §3 |
| Safe zone | ig5's combined TikTok + Instagram rule (text x 86-900, y 240-1400). The reference's lockup sits too low (y 1413-1640), so ig6 lifts the whole composition by 300 px (§1.6). | `src/ig/ig5/zones.ts` |
| End card | A white, minimal end card (new, ig6-local) that keeps the series' beats and the NEUROVOICE wordmark but drops the GL bloom. The fallback is `IgEnd` unchanged. | §4.4 |

---

## 1. The reference frame, measured

**Method.** The thumbnail is 360 × 640, so every value below is ×3 to 1080 × 1920. It was measured in Python (PIL +
numpy: circle fit, row and column profiles, a width profile along the hand's axis, colour medians of the
most-saturated pixels). Then it was re-drawn from these numbers and laid over the reference (scripts and the overlay are
in `scratchpad/ref6an/`: `an*.py`, `profile.py`, `overlay_small.png`, `mock.png`). The re-draw lines up with the
reference to within JPEG blur. At ×3, the error is about ±3 px for positions and ±1-2 px for stroke widths.

Watermarks: two faint grey "divyansh.fx" stamps (rotated text on light-grey plates at about (165-195, 855-1035) and
(675-765, 1185-1290)). They are the creator's protection. **Never reproduce them.** The Instagram play button covers
about (395-690, 810-1110) and is not part of the design.

### 1.1 Composition (1080 × 1920)

| Element | Measured | Notes |
|---|---|---|
| Ground | `#FFFFFF` (255,255,255 in all four corners and the open areas) | flat |
| Dial ring (accent arc) | circle, **centre (−9, 2114)**, **R 1623**; fit residual ≤ 2.7 px at 360 scale | The centre is far off-frame, lower left. The arc enters at (0, 486) and leaves the right edge at (1080, 911). |
| Arc stroke | **9 px** (FWHM 3-4 px at 360) | accent, round caps where it ends |
| Minor ticks | radial, **r 1512-1554** (42 px long), every **≈ 0.85°** (≈ 22 px apart along the band), **2-3 px**, `#D6D6D6` | Very light. They fade toward the frame edges. |
| Major ticks | radial, **r 1497-1560** (63 px), **3-4 px**, `#222222`; seen at **12.5°** and **37.0°** (clockwise from 12 o'clock about the centre) | Sparse: about one per 24°. |
| Dots on the arc | centred on the arc, at **7.75° + n·12.2°**; outer Ø **24 px**, ring **6 px** near-black `#0A0A0A`, fill **white** | The "white-centred dots" read as markers. |
| Hand pivot (hub) | **(97, 1483)**. Note: **not** the dial's centre. It sits (+106, −631) from it. | The hand sits on a nearer layer than the dial. That reads as a 3D-camera parallax offset (§5.3). |
| Hand angle / length | **30° clockwise from vertical**; tip at **(645, 534)**; hub-to-tip **1095 px** | straight axis |
| Hub | black disc Ø **105**; teal (ref: green) dome Ø **58** | The dome is shaded dark → light (ref `#034603` → `#75A46E`). |
| Lockup block | "Because" x 411-636, cap top 1413, baseline 1460 · "every second" x 396-873, ascender 1458, **baseline 1535**, descender 1557 · paragraph x 450-804, lines at about 1572 / 1597 / 1623 (pitch 25.5) | The block is centred on **x ≈ 630**, i.e. +90 px right of the frame centre, in the white space beside the hand. |

### 1.2 The hand, as a width profile along its axis (s = distance from the hub, px; w = full width)

| s | w | Part |
|---|---|---|
| −260 … −60 | 55-60 | **tail / counterweight paddle**, running off-frame lower left |
| 0 | Ø 105 | hub disc (black) + dome Ø 58 |
| 54 | 36 | body starts |
| 250-360 | 48 | widest body |
| 430 · 486 · 540 · 594 · 630 · 666 | 46 · 36 · 31 · 28 · 22 · 19 | concave taper |
| 677-691 | 52 × 14 band | **accent collar** across the hand (ref dark green `#1F5F1F`). In the reference it is probably the green seconds hand's tail passing underneath. ig6: a deep-teal `#0E7490` band. |
| 702-720 | 17 | neck |
| 745 → 828 → 905 | 0 → **102** → 0 (outer) | **hollow lozenge**, sides **concave** (width grows 12, 17, 20, 22 px per 18 px toward the waist, then falls 25, 23, 14, 12). Waist at s 828. |
| 772 → 828 → 893 | 0 → 66 → 0 (inner) | The hole shows the white ground. Outline stroke ≈ 10-12 px measured normal to the edge. |
| 905-1095 | **14** | needle, square end at s 1095 |

**Draw it as one SVG path in hand-local coordinates** (pivot (0, 0), pointing up −y): the outer contour with the
lozenge's inner contour as a second sub-path and `fill-rule="evenodd"`. Use quadratic or cubic curves for the concave
lozenge sides: control points pulled about 35 % toward the axis.

### 1.3 Colour (median of the most saturated or darkest pixels)

| Role | Reference | ig6 |
|---|---|---|
| Ground | `#FFFFFF` | `#FFFFFF` |
| Object ink (hand, hub, major ticks, dot rings) | `#0A0A0A` (median 10,10,10) | `#0A0A0A` |
| Lead word | `#0A0A0A` | `#0A0A0A` |
| Accent (arc, italic words) | arc core `#1CA112`, type core `#24A018` (HSL 115° 79 % 35 %, 3.41:1 on white) | **`#0A8AA8`** (HSL 191° 88 % 34 %, 4.03:1) |
| Accent deep (collar, dome shade) | `#1F5F1F` / `#034603` | `#0E7490` / `#052A33` |
| Accent light (dome highlight) | `#75A46E` | `#A5EAF5` (`LIGHTS.sunday.orb[3]`) |
| Sentence tier | `#686868` darkest, so about `#6B6B6B` | `#6B6B6B` (5.33:1) |
| Minor ticks | about `#D6D6D6` | `#D6D6D6` |
| Major ticks | `#222222` | `#222222` |
| Shadow | plateau 238/255, i.e. black at **≈ 7 %** | `rgba(10,10,10,0.07)` |

### 1.4 The shadow (the "paper" in the 2.5D look)

Measured beside the hand's right edge and below the hub: a plateau at 238/255 that is 42-48 px wide, then a 12-15 px
falloff.

- **Offset (+24, +48) px.** The light comes from the upper left. The hand floats about 50 px above the dial plane.
- **Blur:** CSS `drop-shadow(... 10px ...)` (σ ≈ 5 px). **Opacity 7 %.** It is a soft long shadow, not a glow.
- **Only raised parts cast it:** hand, hub, collar. The dial (arc, ticks, dots) is printed on the ground and casts none.
- The hub dome adds its own small shadow on the hub disc: (6, 10), blur 4, 18 %.

### 1.5 Typography (the lockup)

| Tier | Reference | ig6 face | ig6 setting (reference proportions) |
|---|---|---|---|
| **Lead word** ("Because") | Helvetica-like grotesk, cap height 45-48 px, x-height 36 px (x/cap 0.75), stem 7.5 px, so weight ≈ 560-600 (medium-semibold); width 228 px; tight | Instrument Sans Variable (400-700) | **60 px, wght 580, tracking −0.03em** (`TRACK.section`), line box 1.0. Measured: "Because" = 238 px untracked, about 227 px at −0.03em. |
| **Accent phrase** ("every second") | transitional italic serif, x-height 49 px, ascender 30 px above x, descender 27 px below baseline, width 477 px, moderate contrast, stems about 9 px; narrow, Times-like texture | Cormorant Garamond Italic **600** (installed: `@fontsource/cormorant-garamond`) | **110 px, tracking −0.01em, accent colour.** Measured: "every second" = 496 px at 110 px (x-height 42 px: Cormorant's x-height is 0.386 em, so it reads a touch more calligraphic and less Times-like than the reference). |
| **Sentence tier** (the spoken line) | about 24 px grotesk, `#6B6B6B`, centred, 3 lines, pitch 25.5 px (lh ≈ 1.06), max width 354 px | Instrument Sans | **32 px, wght 450, tracking −0.005em, lh 1.2, `#6B6B6B`, centred, max width 540 px, ≤ 3 lines.** Scaled up from 24 px: at 24 px it falls below the series' legibility floor (labels ≥ 28 px), and TikTok viewers read on small phones. |

**Stacking (the signature).**
- The lead word is **left-aligned with the accent line's left edge** (+15 px optical indent, because the italic overhangs).
- The accent baseline sits **75 px** below the lead baseline. The italic's ascenders almost touch the lead word's
  baseline: negative-feeling leading.
- The sentence tier's cap line sits about **31 px** below the accent baseline (clear of the descenders), centred under
  the accent line.
- The lockup is centred in the object's negative space, not on the frame.

**Hook frames** may scale the whole lockup ×1.15-1.25 (italic ≥ 120 px) for TikTok's small-phone read
(RESEARCH-viral §2.3). Keep the proportions.

**Fidelity alternate (not recommended):** Liberation Serif Italic (a Times-metric clone in `/usr/share/fonts`) at 104 px
matches the reference's x-height and texture more closely but is 539 px wide. It is a system font, so it is
non-portable, and it is off-brand. Cormorant is the site's own spoken-line face (`components/site/home/fonts.ts`,
`homeCinema`: Cormorant Garamond 500 italic), so the pair Instrument Sans + Cormorant Italic is exactly the website's.

### 1.6 The ig6 frame-0 layout (the reference adapted to our safe zone)

The reference's lockup (y 1413-1640) sits in TikTok's caption block and Instagram's bottom band. **Shift the whole
composition up 300 px.** Nothing else changes:

| Element | ig6 frame 0 |
|---|---|
| Dial centre / R | (−9, **1814**) / 1623. The arc leaves the right edge at **y 611**. Minor ticks leave at y 705, majors at y 787. **All above y 840**, so the dial clears the TikTok rail with no exemption. |
| Hub | (97, **1183**) |
| Hand | 30°, length 1095, tip (643, **235**). The tip is an object, not text: it may sit at the header margin. |
| Lead word | x 411, baseline **1160** (cap top ≈ 1117) |
| Accent phrase | x 396, baseline **1235** (descender ≈ 1258) |
| Sentence tier | centred on x 630, baselines **1290 / 1328 / 1366** (bottom ≈ 1374 ≤ 1400) |
| Text x range | 396-890 at most (≤ 900). Check with the zone guard on the real string. |

A quick re-draw with these faces and numbers (`scratchpad/ref6an/mock.png`, right half) reads as the reference.

---

## 2. Motion grammar

The reel itself could not be watched (Instagram returned a login wall and HTTP 429). No Behance, YouTube or Dribbble page
could be tied to @divyansh.fx_. A Dribbble "Divyansh Kala, motion designer, Jaipur" exists but is unconfirmed. So this
grammar comes from three things: (a) what the frame proves (macro crop, layer parallax, accent arc with markers, lockup
with a spoken-sentence tier); (b) the "minimal kinetic type + one object" family as described in current practice (§8);
(c) our own 120 BPM grid. All durations are **30 fps timeline frames** (render at 120 fps = ×4; everything is a pure
function of fractional `t`). The grid: beat 15 f, bar 60 f, 16th 3.75 f.

### 2.1 What the frame itself proves about motion

1. **The camera is a 3D camera on layered artwork.** The hand pivots 640 px away from the dial's centre. A flat clock
   cannot do that. Two layers at different depths, seen by a camera that has moved or rotated, can. So: **parallax
   between the dial plane and the hand plane** (§5.3).
2. **The accent is the "live" part.** The black hand is the object; the green is the arc, the markers, the hub and the
   key words. **[inferred]** The arc draws on (trim path) as the hand sweeps, so the accent literally measures "every
   second". Rule for ig6: *the accent colour moves or grows; black only rotates.*
3. **The type is two-tier and voice-led.** The small grey paragraph is a full sentence ("Because every second your
   audience spends trying to understand your message"). The big words are two of its words. It is a subtitle with a
   typographic highlight, so the words appear on the voice.

### 2.2 Camera

| Move | Spec | Use |
|---|---|---|
| **Macro drift** (always on) | Scale +1.5 % per second, linear, about the shot's focus point; the dial plane rotates +0.6° per second about the dial centre | Every shot. Nothing is ever frozen [inferred; RESEARCH-viral §1 "continuous motion"]. |
| **Snap punch-in** | Zoom ×1.00 → ×1.30 in **8 f**, `EASE.expo` (0.19, 1, 0.22, 1), no overshoot | On a keyword's onset, at most 1 per bar |
| **Pull-back reveal** | Zoom ×1.0 → ×0.38 (the whole dial in frame, Ø ≈ 1230) in **20 f**, `EASE.inOut` (0.65, 0, 0.35, 1) | Once, late (the "it was a clock all along" beat) |
| **Orbit** | The dial rotates ±20° about its own centre in 12-16 f, `EASE.inOut` | Re-frames the macro without a cut |
| **Parallax pan** | Camera translation × layer factor: dial 1.00, hand 1.12, hub 1.15, lockup 0 (screen-locked) | With any pan or zoom, so depth shows |
| ~~Rack focus~~ | **Not used** (house rule: no blur). A crop change plus a scale step does the job. | |

The camera never overshoots. Objects may. One rule from School of Motion's match-cut guidance applies to every camera
move that ends in a cut: **cut mid-move and let the next shot continue the motion on the next frame** [S1].

### 2.3 How objects enter, move and leave

| Move | Spec |
|---|---|
| **Pop-in** (an object appears) | Scale 0.6 → 1 on `SPRING.pop` {420, 24, 0.8} (≈ 6 % overshoot, settled in ≈ 12 f); rotation −25° → 0 on the same spring; opacity 0 → 1 over the first 2 f only. No fade-ins longer than 2 f. |
| **Stroke draw** (arc, ticks, rings) | Trim path 0 → 1 in **12-20 f**, `EASE.expo` (arc) or `EASE.draw` (long lines). Ticks reveal as a sweep: tick *i* turns on at `t0 + i·0.25 f`, each in 3 f. Use `evolvePath` from `@remotion/paths`, or `strokeDasharray`/`strokeDashoffset` with `getLength`. |
| **Hand tick** (a clock step) | +6° in **3 f** `EASE.expo`, overshoot +0.8°, settle in 5 f (`SPRING.land` {210, 13, 1}). One tick per beat (15 f) or per second (30 f). Each tick gets a sound. |
| **Hand sweep** (continuous) | Constant angular speed (6° per second = a seconds hand; 30-60° per second for a "time flying" beat). Linear: a sweep is the "satisfying" layer, so never ease it. |
| **Accent arc grows** | The arc's trim end follows the hand's angle: `end = hand angle − 2°`, so the accent fills behind the hand [inferred]. |
| **Dot lands** | A white-centred dot pops on the arc as the hand passes it: scale 0 → 1 on `SPRING.pop`, plus one soft tick. |
| **Exit** | 4-6 f, `EASE.in3` (0.55, 0.055, 0.675, 0.19): scale → 0.92 + opacity → 0, or out of frame along the motion direction. Exits are faster than entrances. |

### 2.4 Text animation (the lockup)

Per series rule, one moving text at a time; each word appears on or 2 f before its spoken onset (`CAP_LEAD`).

| Tier | Entrance | Exit |
|---|---|---|
| **Sentence tier** (grey) | The whole line is **set at 72 % ink** (`#6B6B6B` at .72 ≈ `#9A9A9A`) as a unit, 2 f before its first word: a 6 f rise of 16 px out of a mask, `EASE.house` (0.16, 1, 0.3, 1). Then **each word lifts to full ink on its onset** in 2 f. This is the series' set-and-lift idiom; here it doubles as the reference's subtitle. | Up through the mask, 4 f, `EASE.in3` |
| **Lead word** (sans) | **Mask rise**: the word rises from +105 % of its line box behind a clip line, in **7 f**, `EASE.expo`. Alternative for short punchy words: a **pop**, scale 0.86 → 1.0 on `SPRING.pop` with opacity 0 → 1 over 2 f. | 4 f, up through the mask |
| **Accent phrase** (serif italic) | **Slide + wipe**: x −40 px → 0 while a left-to-right clip (`inset(0 100% 0 0)` → `inset(0 0 0 0)`) opens, **9-10 f**, `EASE.expo`, staggered 2 f per word, in the accent colour from its first frame (no colour fade). It lands on the word's onset; that landing is the shot's "hit" (§2.7). | 5 f: scale 1 → 0.94 + opacity → 0, `EASE.in3` |
| Overshoot cap | Text overshoot ≤ 3 % scale, never on the sentence tier, never rotated, never skewed. |

**Holds.** After the last word of a lockup lands, it holds **≥ 1 beat (15 f)** completely still while the object keeps
moving. Nothing on screen is fully static for more than 1.0 s.

### 2.5 Transitions (in order of preference)

| Transition | Spec | Sound |
|---|---|---|
| **T1 Tick cut** | A hard cut on the beat to a new macro crop of the same object. One element (the hub, or a dot) stays at the **same screen position** across the cut: the eye-trace anchor [S1]. | the tick itself |
| **T2 Dot / disc match cut** | Push into a round element (the hub dome, an arc dot) until it fills the frame: zoom ×1 → ×16 in **10 f**, `EASE.in4` (0.895, 0.03, 0.685, 0.22). On the frame it covers the frame (accent colour, 1 f), hard cut to the next shot opening out of an accent disc: ×16 → ×1 in **12 f**, `EASE.expo`. | `whoosh-rev` peaking on the cut, `thump` on the open |
| **T3 Rotation whip** | The dial plane spins 75° about its centre in **7 f**, `EASE.peel` (0.7, 0, 0.2, 1). Cut on frame 3-4 (the fastest frame) to a shot whose own rotation continues −35° → 0 on `EASE.expo`. No motion blur (house rule). At 60/120 fps the whip reads crisp. | `swish` peaking on the cut frame |
| **T4 Line match** | The needle (14 px black line) rotates to 0° and stretches into a full-width hairline that becomes the next shot's baseline (an underline, a waveform's zero line, a desk). 10 f, `EASE.inOut`. | `draw` |
| **T5 Morph** | `interpolatePath` (`@remotion/paths`) between two outlines with matched point counts, e.g. the hollow lozenge to a speech-bubble tail, or a dot to the orb's full stop. 12 f, `EASE.inOut`. Use it at most once; morphs get gimmicky fast. | `sheen` |

**Never:** cross-dissolves, glitch, zoom-blur, light leaks, spin-blur, page curls.

### 2.6 Rhythm and length

- **Something lands on every beat (0.5 s):** a word, a tick or a dot.
- **A cut or a big camera move every 2-4 beats (1-2 s).**
- **A big landing** (accent phrase + sub/thump) **every 1-2 bars.**
- **One near-silence of 3-8 f** just before the payoff word [S2].
- **Length and structure** (matches our 20-30 s target and RESEARCH-viral §1):

| Part | Duration | What happens |
|---|---|---|
| Hook | 0-2.5 s | Frame 0 is already mid-sweep; the lockup is set at 72 %. |
| Lines | 4-6 sentences, about 2.5-4 s each | One sentence = one shot state of the hero object. Sub-cuts land on its keywords. |
| CTA | about 3 s | |
| Brand | about 1.5 s | |
| Seam | 14 f | Re-forms frame 0 (the series loop). |

A 28 s reel is 14 bars, like ig5.

### 2.7 Sound design in this style (our library names)

The style's sound is **dry, close and rhythmic**: the object's own mechanical sound is the percussion. The music is a
sparse pulse. Every visual hit has a sound, and sounds come from a few families [S2, S3]:

| Event | Sound (library) | Sync rule |
|---|---|---|
| Hand tick / tock | `fx-tick` / `fx-tock` alternating (`tick` from film 1 as a lighter variant), −22 dB send, near-centre | on the frame the hand starts its 3 f step |
| Dot lands / word lift | `tap` or `fx-glass-tick`, very low (−26 dB); **keywords only, never every word** | on the pop's first frame |
| Accent phrase lands | `pop` + `sub` (or `thump` at −8 dB layered) | on the landing frame (the expo's end), ≤ 1 per bar |
| Whip / zoom-through | `swish` / `whoosh-soft` / `whoosh-rev` | **peak on the fastest frame or the cut frame**, so start early [S2, S3] |
| Stroke draws | `draw` (film 1) | under the trim, tail on its end |
| Before the payoff | music ducked to near-silence for 3-8 f; `riser-short` into it | |
| Brand impact | the series stack `impactHits()` (riser + `fx-impact-end` + thump + slam) | on the bar line |

**Bed.** 120 BPM, minimal: a soft kick or pulse on beats, the clock ticks acting as the hats. No trap drop, no vocal
chops (voice.md: calm, precise, never hype). Duck the bed under Tessa as the series does (check-mix scores every word's
first 200 ms).

### 2.8 A crop library for one hero object (world coordinates = the reference frame at zoom 1)

Camera = {focus (world px), zoom, rotation}. The focus maps to the screen anchor; the dial plane uses the world
coordinates of §1.1 shifted −300 px in y (§1.6).

| Crop | Focus / zoom / rotation | What it shows |
|---|---|---|
| **M1 Reference** (frame 0) | screen = world, ×1, 0° | The arc across the top, the hand on a diagonal, the lockup lower right. |
| **M2 Hub macro** | (97, 1183) → screen (300, 1000), ×2.2 | The dome fills about 128 px; the hand's body is a thick diagonal; the tail leaves frame. |
| **M3 Tip macro** | the lozenge waist → screen (540, 760), ×1.8, −10° | The lozenge outline is 18-20 px; the ticks run 75-110 px; the arc is a big curve. |
| **M4 Arc horizon** | an arc point at 20° → screen (540, 700), ×2.6, rotated so the arc's tangent is level | The accent arc is a horizon; the dots are Ø 62 (good for counting, e.g. 14 dots = 14 languages). |
| **M5 Full dial** | the dial centre → screen (540, 820), ×0.38 | The whole dial, Ø ≈ 1230 (once, the reveal). |

---

## 3. Voice-over in this style: keep Tessa on every on-screen line

**No reason to reduce the VO was found, and one strong reason to keep it.** The reference's own layout is voice-led: the
grey paragraph is a complete spoken sentence, and the big words are lifted from it. Mapping our rule ("the woman's voice
is heard when there is text on screen") onto it gives four rules:

1. **The sentence tier = the full VO line**, word-synced with set-and-lift.
2. **The lockup = 1-4 words she says in that line.** Never a word she does not say. Numerals follow the series display
   map.
3. **No unspoken text tier.** Chrome ≤ 32 px stays claim-free (series rule).
4. **Pace.** Her lines run about 2.5 words per second (voice.md). The style wants air (RESEARCH-viral §2.3), so budget
   ≤ 60 words for 28 s including the CTA. Shot sub-cuts ride her keywords, so the 0.5-1 s visual rhythm never depends on
   her talking faster.

Only if a scenario wants a purely visual beat (e.g. a 1.5 s ring with no text) is that beat silent of VO. That is
already allowed: no text, no voice.

---

## 4. Our brand in this style

### 4.1 The ONE accent: teal `#0A8AA8`

| Candidate | Hex (on white) | Verdict |
|---|---|---|
| **Teal (Sunday clock figures)** | `#0A8AA8`: 4.03:1, HSL 191° 88 % 34 % | **Chosen.** Its lightness and saturation are almost the reference green's (`#1CA112`: 3.41:1, 115° 79 % 35 %), so the single pop on white has the same weight and only the hue changes. It is brand-native: `LIGHTS.sunday.num`, the site's clock figures, and the gradient top of the orb's disc. Teal has meant "ours / the agent" in all five reels. |
| Teal ink | `#0E7490`: 5.36:1 | Use for accent text < 40 px and for dome shading. Too dark to be the pop. |
| Emerald (closing) | `#059669` / `#10B981` | **Rejected.** Closest in hue to the reference, but in our system emerald is the **Booked** pill and the closing light. A green accent would read as a booking claim, and booking is Pro-only in code (`starter.googleIntegrations = false`). |
| Rose (rush) | `#BE185D` | **Rejected** as the accent. It is the series' "problem" colour. In this style the problem is simply black and grey, the *absence* of the accent. |
| Plum (wordmark) | `#1E0B38`: 18:1 | Reads as black on white. It is kept for the wordmark only. |

**Colour story the accent enables:** *black and grey = the phone nobody answers; teal = the agent.* The accent can arrive
late (e.g. the arc, the dome and the italic word turn teal on the pickup) and carry the plot without a word.

### 4.2 Type

- **Instrument Sans** (the site's display face, the series' only face so far) for the lead word and the sentence tier.
- **Cormorant Garamond Italic** for the accent phrase only.

This deliberately breaks `theme.ts`'s "captions never in a serif italic" rule. The rule is film 1's and kept a single
family. The exception is scoped: one accent phrase per lockup, always spoken, always in the accent colour. The website
already pairs these two faces (`homeDisplay` + `homeCinema`), so the brand allows it.

### 4.3 The hero object, and the orb

**The orb is not the hero object.** The style's object must be a real, instantly recognisable thing seen in macro, drawn
as flat paper with a soft long shadow. The orb is a glowing WebGL fluid mesh (`MeshOrb`, `FluidOrb`). Glow, gradient
mesh and bloom are exactly what this look excludes, and an abstract sphere in macro reads as nothing.

**The orb becomes a flat teal dome:**
- the clock's **hub cap** (Ø 58): a radial gradient through the Sunday orb stops, `#052A33` rim → `#0E7490` → `#0A8AA8`
  → `#A5EAF5` highlight at (30 %, 30 %);
- the **dots** on the arc;
- the end card's **full stop**.

That is the brand thread through the reel: "the agent at the centre of every second".

Objects that fit the style and our story (the scenario picks; RESEARCH-viral §6 ranks them):
- the **clock dial** (time, nights, Sundays; the reference's own object; S1);
- a **desk phone / handset** in flat vector (only if the scenario needs it; ig5 avoided a handset);
- the **open/closed sign**;
- the **dial of 14 dots** (14 languages = 14 white-centred dots on the teal arc, crop M4);
- a **message pad**;
- the **sound line / waveform** (the needle's T4 match).

Whatever the object, draw it in this file's language: flat fills, ≤ 3 greys, the one accent, hairline details, the
long shadow, cropped by ≥ 2 frame edges.

### 4.4 The end card in this style (the NEUROVOICE wordmark on white)

Keep the series' beats (CTA, comment field, AGENT typed per 16th, impact on the bar line, wordmark, URL on
"Neuro | Tech | Voice", 14-frame seam). Draw them in this style:

| Part | Spec |
|---|---|
| **CTA lockup** | Lead word "Comment" (Instrument Sans 580) + the accent phrase in teal Cormorant Italic, per the scenario's spoken CTA (e.g. "*for the link.*"). Grey sentence tier = the whole spoken CTA. Centred at y 700-860 (the series' CTA band). |
| **Comment field** | White pill x 174-906, y 940-1060, r 60, **1.5 px `#E6E6E6` border + the style's long shadow** (24, 48, 10 px, 7 %) instead of the mesh-tinted elevation. Icon and caret `#0A0A0A`. AGENT typed in Instrument Sans 600 `#0A0A0A`. Send disc Ø 72 teal `#0A8AA8`, white arrow. |
| **Impact (bar line)** | **No GL bloom.** The teal dome travels to the wordmark's end and **stamps**: scale 0 → 1.12 → 1 on `SPRING.pop` with its own shadow, on the `impactHits` stack. The wordmark letters surface centre-out behind it (the series' order). |
| **Wordmark** | NEUROVOICE exactly as the series sets it: Inter Tight 500, −0.07em, ≤ 760 px wide, y 760-900. Ink **`#0A0A0A`** (or the brand plum `#1E0B38`, which reads identical on white). The letters are never altered. The teal dome sits after it as a full stop, baseline-aligned, Ø = the wordmark's x-height × 0.55. |
| **URL** | `neurotechvoice.com` in Instrument Sans 450, 34 px, `#6B6B6B` (the sentence tier's voice), typed in three chunks on "Neuro \| Tech \| Voice", y ≈ 1000. No hairline flourish and no corner dots. |
| **Seam** | The dome shrinks back into the hub. The frame-0 lockup is set at 72 % by the last frame. |

Built as `src/ig/ig6/End6.tsx`, importing from `components/End.tsx`:
- `Wordmark`, `WORDMARK_FONT`, `WORDMARK_TEXT`;
- `END` geometry;
- `endState`, `agentKeys`, `ctaLine`;
- `impactHits` from `common/series.ts`.

It must not edit `End.tsx`: ig1-ig5's pictures are guarded byte-for-byte. **Fallback:** `IgEnd` unchanged with
`tone="pearl"` (ig5's precedent, series coherence). Its teal backlight bloom is a glow on white and is off-style. Flag
this for the judges.

---

## 5. Tooling in our repo

### 5.1 What is installed (we cannot npm install)

| Need | Available | Not available |
|---|---|---|
| 3D | none | `three`, `@remotion/three` (absent), so the look is **2.5D SVG** (§5.3) |
| Paths | **`@remotion/paths` 4.0.530** (present in `node_modules` as a dependency of `@remotion/studio`; importable but not declared in `package.json`): `evolvePath`, `getLength`, `getPointAtLength`, `getTangentAtLength`, `interpolatePath`, `getBoundingBox` | `@remotion/shapes`, `@remotion/transitions`, `@remotion/motion-blur`, `@remotion/lottie`, `gsap` |
| Noise | `@remotion/noise` (a subtle drift if wanted; keep it deterministic) | |
| Sans | **Instrument Sans Variable** wght 400-**700** (+ true italic), `@fontsource-variable/instrument-sans` | weights > 700. RESEARCH-viral's "700-800" is not possible; the reference measures about 580-600 anyway. |
| Serif italic | **Cormorant Garamond** 300/400/500/600/700, normal + italic, latin + latin-ext (+ cyrillic, vietnamese), `@fontsource/cormorant-garamond` 5.3.0, family `'Cormorant Garamond'` | **Instrument Serif, Playfair Display, Fraunces, DM Serif, Libre Caslon: none offline.** `@remotion/google-fonts` is absent; next/font downloads at build time. A lone `fraunces-latin-600-normal.woff2` exists inside an unrelated skill folder: do not use it. |
| Wordmark | Inter Tight Variable (`src/scenes/cta/font/`, wordmark only) | |
| Mono | Geist Mono Variable | |
| System | Liberation Serif Italic (Times clone, `/usr/share/fonts`): fidelity alternate only (§1.5) | |
| Icons | `lucide-react` (only the comment field's message-circle) | |

### 5.2 Fonts: load them ig6-locally

`src/lib/fonts.ts` (shared by every film) stopped loading Cormorant in v7. **Do not edit it.** Add
`src/ig/ig6/fonts.ts`:

```ts
import '@fontsource/cormorant-garamond/600-italic.css'; // + 700-italic.css if a small accent size needs it
// useIg6Faces(): useFaceReady('italic 600 110px "Cormorant Garamond"', 'every second Comment AGENT') &&
//                useFaceReady('580 60px "Instrument Sans Variable"') && useFaceReady('450 32px "Instrument Sans Variable"')
```

The ig6 acts call `useIg6Faces()` (with `useKitFaces()`) before measuring. Instrument Sans is already declared by
`lib/fonts.ts` via `IgReel`'s `waitForFonts()`; only the 580/450 instances need the explicit `useFaceReady` (canvas
`measureText` must see the real face).

### 5.3 2.5D without three.js: depth, shadows, the macro crop

1. **The macro crop is free in SVG.** Draw the dial at its true geometry (centre (−9, 1814), R 1623) in one
   `viewBox="0 0 1080 1920"` SVG with `overflow: hidden`. The off-canvas parts cost nothing. Generate ticks only for the
   visible angular window (about −5° … 50° at M1; compute from the camera) to keep the DOM small at 120 fps.
2. **Layers = depth.** Each plane is its own absolutely positioned SVG or `div` with a CSS transform from one camera:

   ```
   S = 1 + (cam.zoom − 1)·k
   transform = translate(anchor) rotate(cam.rot·k_rot) scale(S) translate(−(focus + cam.pan·k))
   ```

   with k: dial 1.00, hand 1.12, hub 1.15, lockup 0 (screen-locked). A shared camera with different k is what puts the
   hub 640 px from the dial's centre in the reference.
3. **The shadow, done right.** Put the shadow filter on a **non-rotated wrapper** and rotate the child inside it. CSS
   filters apply in the element's local space, so a `drop-shadow` on a rotated element rotates its light direction with
   it (gotcha). Settings: `filter: drop-shadow(24px 48px 10px rgba(10,10,10,.07))` on the hand+hub plane's wrapper;
   the dome gets `drop-shadow(6px 10px 4px rgba(10,10,10,.18))`. For true parallax of the shadow (it lies on the dial
   plane, k = 1.0), draw it as a separate blurred copy of the hand path (`<feGaussianBlur stdDeviation="5">`) in the
   dial layer, offset by (24, 48) + (k_dial − k_hand)·(camera displacement). Only do this if a shot pans a lot.
4. **The dome** is an SVG `radialGradient` (cx 30 %, cy 30 %; Sunday orb stops, §4.3) plus a 1 px `#052A33` rim at
   40 % opacity.
5. **Crispness at 120 fps.** Stroke widths ≥ 2 px; `shape-rendering="geometricPrecision"`; `vector-effect` off (strokes
   should scale with the camera, as in a macro); transforms on the layer `div`, not on hundreds of SVG children; text
   positioned with `lib/glide` `subpixel` like the series.
6. **No motion blur** (house rule since v7). The 120 fps master and the 60 fps upload carry the fast moves.

### 5.4 Reuse vs new

| Reuse by import (unchanged) | New in `src/ig/ig6/` |
|---|---|
| `IgReel` shell, `ReelProps`, the registry route of ig5 (separate `films.mjs`, hash, guard) | `style.ts`: the tokens of this file (colours, type specs, shadow, eases, durations, parallax k) |
| `lib/motion` (`EASE.expo/house/peel/inOut/in3/in4/draw`, `SPRING.pop/land/site`, `springUnit`, `tween`, `mix`) | `fonts.ts` (§5.2) |
| `components/ZoneGuard` (`ZoneRect`, `registerZones`) with an ig6 copy of ig5's zone rule (`zones.ts`) | `Camera.tsx`: the 2.5D camera + layer planes |
| `components/Captions` timing (`captionScreens`, `wordAt`, `CAP_LEAD`, `SET_INK`, `speechEnd`) | `Dial.tsx`: arc (trim), ticks (sweep reveal), dots |
| `components/Finish` `IgFinish`. **Paper grain → 0** (crisp white). Keep the dither if a probe shows banding in the 7 % shadow ramps. | `Hand.tsx`: hand path (§1.2), hub disc + dome, collar, tick/sweep drivers, shadow wrapper |
| `common/series` (`BAR`, `upBar`, `place`, `SEAM`, `impactHits`, `H`) and `cues.ts` | `Lockup.tsx`: lead + accent + sentence tiers, word-synced, zone-reported |
| `End.tsx` exports (§4.4); `kb/kit` `measureText`, `useKitFaces` | `Transitions.ts`: T1-T5 as pure functions of t |
| The SFX library (`ig/sfx/lib`) | `End6.tsx` (§4.4); `Cover.tsx` (the hook frame, words in x 86-900, y 260-1380) |

**Not used:** `PearlGround` / `NightGround` (mesh), `MeshOrb` / `FluidOrb`, `IgLightGL` (bloom), `TitleCard`,
`OutcomePill` (app-UI colour pills break the one-accent rule; if the app must appear, render it monochrome with teal
only).

---

## 6. Do / Don't

**Do**
- Flat white ground; black + grey + **one** teal; the accent is the live, moving or growing part.
- One hero object per shot, larger than the frame, cropped by ≥ 2 edges; ≤ 3 things moving at once; one moving text at
  a time.
- The three-tier lockup (sans lead / teal serif-italic accent / grey spoken sentence) with tight stacking, set in the
  object's negative space.
- Every word on screen spoken by Tessa; the accent phrase lands on its spoken onset.
- The soft long shadow (24, 48, 10 px, 7 %) on raised parts only, with the light fixed upper left in screen space.
- Short snappy moves (3-10 f) on `EASE.expo`, `EASE.house` or `SPRING.pop`; objects overshoot, the camera never does;
  exits faster than entrances.
- Something lands every beat; a cut every 2-4 beats; a 3-8 f near-silence before the payoff.
- Match cuts that keep one element fixed on screen across the cut; cut mid-move.
- A sound for every visual hit, from a few families; peaks on the fastest frame.

**Don't**
- No glow, bloom, bokeh, mesh gradients, lens flares, light leaks, grain texture, vignette, motion blur, 3D renders,
  stock icons, emoji or drop shadows under text.
- No second accent: no rose, no emerald, no app-pill colours.
- No synthesised italic or bold; no italic sans; no letter-by-letter typing except AGENT in the field; no
  skewed or rotated text.
- No text outside x 86-900, y 240-1400; no text over the object's strokes; nothing important under the TikTok rail
  (x > 880 below y 840).
- Don't copy the reference's frames, sentence ("Because every second…") or watermark. Copy the style, design our own
  dial and write our own lines (originality is ranked; RESEARCH-viral §2.1).
- Never "replace / fire your receptionist" (ig1 coherence); no invented numbers; no booking claim tied to $49.

---

## 7. Open points for the script and the judges

1. **End card:** the minimal `End6` (recommended, style-true) or `IgEnd` unchanged (series-true, with a teal glow on
   white)?
2. **The serif-italic exception** to the film-1 type rule: confirm it is scoped to the accent phrase only.
3. **Sentence tier size:** 32 px (recommended) or the reference's 24 px (truer, below the series' floor).
4. **Fidelity vs brand in the italic:** Cormorant Garamond (site face, recommended) or Liberation Serif Italic (closer
   to the reference's Times-like texture, system font, off-brand).
5. **A bit-budget probe** of a 2 s strip (`src/ig/qa/Probe.tsx` pattern) on the white ground with the shadow ramps,
   before the master: a white frame is cheap, but a 7 % shadow over 12-15 px can band at the 60 fps upload's bitrate.

---

## 8. Sources

- [S1] School of Motion, "Seamless Storytelling: The Power of Match Cuts in Animation": the subject stays in about the
  same position; cut mid-move and continue on the next frame; sound reinforces the match.
  https://schoolofmotion.com/blog/match-cuts. Also "Six Essential Motion Design Transitions":
  https://schoolofmotion.com/blog/six-essential-motion-design-transitions-tutorial
- [S2] Sonilo, "Whoosh sound effect guide": separate the move from the landing; use an impact or pop only when the object
  stops or appears; the widest cue for the largest move; restraint. https://sonilo.com/ai-music/whoosh-sound-effect-guide
- [S3] Practitioner sync rules, via search summary (a click on the press frame; a whoosh peaking on the fastest frame; an
  impact on the flash frame; 3-8 f near-silence before a reveal; 3-4 sound families). Pixflow:
  https://pixflow.net/blog/enhancing-motion-graphics-with-cinematic-transition-sounds/; IRPR glossary:
  https://sounddesign.irpr.agency/glossary/whoosh/
- [S4] Demotion, "7 Trending Motion Graphic Styles in 2026": kinetic type with staggered word or character reveals,
  physics curves with slight overshoot, sync to speech or beats; parallax depth planes (background about 50-70 %,
  foreground about 130-150 % of the midground's speed). https://trydemotion.com/blog/trending-motion-graphic-styles
- [S5] Typography trend roundups 2026 (serif revival in editorial and display; kinetic type as the main motion trend):
  https://www.andacademy.com/resources/blog/graphic-design/typography-trends/,
  https://www.designmonks.co/blog/typography-trends-2026
- [S6] Motion Array, "Create Better Eases in After Effects" (graph-editor eases over default easy-ease; the expo-out
  shape is a steep burst then a long settle). https://motionarray.com/learn/after-effects/create-better-eases-in-after-effects/
- Reference metadata: `scratchpad/ref6/page.html` (og:title "Divyansh | Motion Designer (@divyansh.fx_)", og:description
  "divyansh.fx_ on July 15, 2026: Faceless video edit"). The creator's profile returned HTTP 429. No Behance, YouTube or
  Dribbble could be confirmed (a Dribbble "Divyansh_kala" motion designer is unverified: https://dribbble.com/Divyansh_kala/about).
- Repo facts: `src/theme.ts` (LIGHTS, TYPE, TRACK), `src/lib/motion.ts` (EASE, SPRING), `src/ig/ig5/zones.ts`,
  `src/ig/components/End.tsx`, `src/scenes/cta/EndCard.tsx` (WORDMARK_*), `components/site/home/fonts.ts` (Instrument Sans
  + Cormorant Garamond italic on the site), `trailer/package.json`, `node_modules/@fontsource*`, `node_modules/@remotion/paths`.

---

## 9. Build spec for "One ring" (the script in `SCRIPT.md`)

Label `synth`, added 2026-10-11. This section turns §1-§8 into exact values for the chosen script. Where it differs from
§1-§8 it wins (the differences are marked **changed**). Frames are 30 fps timeline frames; everything is a pure function
of fractional `t`, rendered at 120 fps (×4). Geometry mocks: `docs/ig/ig6/mock-one-ring.png`.

### 9.1 Modules (`src/ig/ig6/`, PIPELINE.md §3)

| File | Role | In `ig6Hash`? |
|---|---|---|
| `timing.ts` | the reel's timeline (§6.1 contract of `docs/ig/PIPELINE.md`, `REEL = 'ig6'`) | yes (via igHash) |
| `voice.generated.ts` | generated by `generate-voice --film=ig6` | yes |
| `zones.ts` | ig5's combined TikTok + Instagram rule, renamed (§9.12) | yes (top-level `.ts`) |
| `Reel6.tsx` | **ig6's own shell** (a 30-line copy-adapt of `IgReel`: white base, no grain, §9.12) | no (`.tsx`) |
| `Cover.tsx` | `IG6-Cover-9x16` | no |
| `acts/Acts.tsx` | the eight acts (`hook wait missed pickup day words ring end`) on one continuous stage | no |
| `stage/style.ts` | the tokens of §9.3-§9.7 | no (subfolder) |
| `stage/fonts.ts` | §9.2 | no |
| `stage/Camera.tsx` | the 2.5D camera and the planes (§9.6) | no |
| `stage/Dial.tsx`, `stage/Hand.tsx` | the object (§9.5) | no |
| `stage/Lockup.tsx` | the three tiers, word-synced, zone-reported (§9.8) | no |
| `stage/Transitions.ts` | T1-T4 as pure functions (§9.9) | no |
| `stage/End6.tsx` | the white end card (§9.10) | no |

Keep picture-only modules in subfolders: `ig6Hash` hashes every **top-level** `.ts` of `src/ig/ig6/` (as ig5's does), so
a picture module there would only cost a needless re-stamp.

### 9.2 Fonts (offline; no network at bundle or render time)

| Face | Use | How it loads |
|---|---|---|
| **Instrument Sans Variable** wght 580 | lead words, "Comment" | already declared by `src/lib/fonts.ts` (`@fontsource-variable/instrument-sans/wght.css`, bundled from `node_modules`); `Reel6`'s shell calls `waitForFonts()` exactly as `IgReel` does |
| Instrument Sans Variable wght 450 | sentence tier (32 px), URL (34 px), cover stakes line (40 px) | same |
| Instrument Sans Variable wght 600 | AGENT in the field (50 px), cover kicker (28 px, +0.08em) | same |
| **Cormorant Garamond Italic 600** | the accent phrase only | `src/ig/ig6/stage/fonts.ts`: `import '@fontsource/cormorant-garamond/latin-600-italic.css';` (declared dependency `@fontsource/cormorant-garamond` ^5.3.0; the woff2 ships in `node_modules`; the latin subset covers every glyph used, the ’ included, checked). **Never edit `src/lib/fonts.ts`.** |
| Inter Tight Variable 500 | the NEUROVOICE wordmark | `import '../../../scenes/cta/font/wordmark.css'` (film 1's file, import only, as `End.tsx` does) |

**`useIg6Faces()`** (in `stage/fonts.ts`) returns true once all of these pass `useFaceReady` (`src/lib/fonts.ts`), which
holds the frame with `delayRender` until the face is in:
`italic 600 110px "Cormorant Garamond"` (sample "six seconds can’t answer receptionist AGENT"),
`580 60px "Instrument Sans Variable"`, `450 32px "Instrument Sans Variable"`, `600 50px "Instrument Sans Variable"`, and
in `End6` `500 100px ${WORDMARK_FONT}`. Every layout that measures text waits on it. `kb/kit` `measureText` handles the
sans only; add `measureSerif(text, size)` in `stage/` (canvas `italic 600 ${size}px "Cormorant Garamond"`, tracking
−0.01em applied as `letterSpacing`, `fontKerning = 'normal'`, cached). Set `font-synthesis: none` on every lockup node.
Apostrophes render typographic (’).

**Measured on the real faces** (PIL, `scratchpad/synth6/measure.py`; the browser should agree within ±1 %): *six seconds.*
499 px at 126 · *can’t answer.* 545 at 120 · *receptionist* 435 at 110 · *day or night.* 495 at 110 · *from your words.*
600 at 100 · *still waiting.* 479 at 110 · *customer.* 364 · *rings,* 213 · *yourself.* 324 · *AGENT* 321 · "Your
receptionist" 500 at 66 · tier "Comment AGENT for the link." 435.

### 9.3 Colour tokens (`stage/style.ts`)

| Token | Value | Use |
|---|---|---|
| `ground` | `#FFFFFF` | every frame (the shell paints it; **changed**: not `#f3f2f6`) |
| `ink` | `#0A0A0A` | hand, hub disc, node rings, rung stretches, lead words, wordmark, AGENT, field icon |
| `tier` | `#6B6B6B` | sentence tier, URL, cover kicker and stakes line |
| `setInk` | `0.72` | the set state of a frame-0 / tier word before its onset (colour mixed toward white) |
| `tickMinor` / `tickSec` / `tickMajor` | `#D6D6D6` / `#9A9A9A` / `#222222` | ticks every 1.2° / 6° / 36° |
| `pending` | `#D6D6D6` | a ring stretch not yet rung |
| `teal` | `#0A8AA8` | the ONE accent: rim, accent type, the agent's dome and domes, underline, send disc |
| `tealDeep` | `#0E7490` | collar; dome gradient mid stop |
| `tealRim` / `tealHi` | `#052A33` / `#A5EAF5` | dome gradient rim / highlight |
| `graphite` | `#3A3A3A` | your phone's hub dome (**changed** from §4.3: teal is the agent's only) |
| `fieldBorder` | `#E6E6E6` | the comment field's 1.5 px border |
| `shadow` / `domeShadow` | `rgba(10,10,10,.07)` / `rgba(10,10,10,.18)` | §9.4 |

The dome gradient: SVG `radialGradient` cx 30 % cy 30 %, stops `#A5EAF5` 0 → `#0A8AA8` 0.45 → `#0E7490` 0.8 → `#052A33`
1, plus a 1 px `#052A33` rim at 40 %. The graphite dome is the same gradient in greys (`#8A8A8A` → `#3A3A3A` →
`#2A2A2A` → `#151515`). The graphite → teal pickup is a radial wipe of the teal dome over the graphite one (4 f, from the
centre out), never a colour fade through grey-green.

### 9.4 Shadow recipe

- **The long shadow:** `filter: drop-shadow(24px 48px 10px rgba(10,10,10,.07))` on the hand+hub plane's **non-rotating
  wrapper**; the hand rotates inside it (a filter on a rotated element turns its light with it). The offset and blur
  scale with the plane's S (so in M5′, at S 0.393, it is (9, 19, 4 px)).
- **Who casts it:** hand, hub, collar; in the end card the comment field (the same values) and the stamped full stop.
  **The dial casts none** (rim, ticks, nodes, domes are printed on the ground). No shadow under text, ever.
- **The dome's own:** `drop-shadow(6px 10px 4px rgba(10,10,10,.18))` on the dome over the hub disc; at the pickup stamp it
  grows to (9, 15) and settles back with the scale.
- **Banding:** the 7 % ramp over 12-15 px can band in the 60 fps upload. Probe before the master (PIPELINE §6.3). If it
  bands, first raise the opacity to 9 % and the blur to 12 px; only then add a static dither (`IgFinish` paper 0.02).

### 9.5 The object (SVG, one `viewBox="0 0 1080 1920"` per plane, `overflow: hidden`, `shape-rendering="geometricPrecision"`)

**Dial plane** (`Dial.tsx`, k 1.00). Centre (−9, 1814), R 1623 in M1 world coordinates (§1.6).
- **Rim:** `<circle>` stroke 9, `teal`. Ring stretches (your phone only): `<path>` arcs (SVG `A`) over φ ∈ [36(n−1),
  36(n−1)+12], stroke 9 on top of the rim: the part behind the needle `ink`, the rest `pending`.
- **Ticks** (radial lines, butt caps): fine every 1.2°, r 1512-1554, 2 px; seconds every 6°, r 1505-1556, 3 px; majors every
  36° (at each node), r 1497-1560, 4 px. Generate **only the visible angular window**: invert the camera for the frame's
  four corners, take the dial angles they span, pad 3°. That is ≈ 40-60 marks in M1/M3′ and 300 in M5′ (still cheap).
- **Nodes** (your phone): `<circle r=9>` stroke 6 `ink`, fill white (outer Ø 24, white centre Ø 12).
- **Domes** (the agent): `<circle r=13>` with the dome gradient. In M5′ they keep a constant screen Ø 28 (draw r = 14/S).
- **Coordinates:** dial angle φ clockwise from the dial's 12 o'clock; world angle = φ + 28.1° + ρ (ρ = rotation, −6° per
  step); the needle reads φ = −6.03° − ρ. In M5′ the dial is drawn upright (φ 0 at the top).
- **Ping:** a `<circle>` stroke 2 `ink`, centred on the ringing node (or the hub at f345), r 12 → 110 (M1) / 60 → 210 (M2′),
  opacity 0.6 → 0, 14 f `EASE.expo`. One per ring, never concentric arcs.
- **Shiver:** the ringing node (or dome) offsets ±2 px along the rim tangent at 12 Hz, amplitude × e^(−t/4 f), 12 f.

**Hand plane** (`Hand.tsx`, k 1.12; hub k 1.15). One path in hand-local coordinates (pivot (0, 0), pointing up −y), outer
contour plus the lozenge's inner contour as a second sub-path, `fill-rule="evenodd"`. **Our proportions (changed from
§1.2's measured reference; ≈ 10-15 % different, judge-style fix 6):**

| s (px from pivot) | full width w | Part |
|---|---|---|
| −230 … −50 | 50, round end r 25 | tail (counterweight), off-frame lower left |
| 0 | hub disc Ø **96**, dome Ø **54** | hub (graphite or teal dome) |
| 48 → 220-320 → 400 → 460 → 520 → 570 → 610 → 640 | 32 → **44** → 40 → 32 → 26 → 22 → 18 → 15 | tapered body (concave taper after s 400) |
| 618-632 | 46 × 14 band, `tealDeep` | collar |
| 640-668 | 15 | neck |
| 668 → **772** → 880 | 0 → **92** → 0 (outer) | hollow lozenge, concave sides (control points pulled ≈ 35 % toward the axis; width ∝ u^1.75 from each end) |
| 694 → 772 → 866 | 0 → 58 → 0 (inner) | the hole (white ground shows through); outline ≈ 10-12 px |
| 880-1095 | **12**, square end | needle; crosses the rim at s ≈ 1008 = the reading point (601, 310) |

Hub disc `<circle r=48>` `ink`; dome `<circle r=27>` (graphite or teal gradient). In M5′ the hand is a **separate
drawing at the dial's true centre**, scaled 0.393 (430 px long, hub Ø 38, dome Ø 21): the T2 cut hides the change.

**Motion of the object** (all from `stage/style.ts`):

| Move | Spec |
|---|---|
| Step (your phone) | ρ −6° in 3 f `EASE.expo`, overshoot −0.8°, settle `SPRING.land` {210, 13, 1} by +8 f; the hand recoils +0.8° in 2 f and settles on `SPRING.land`. On f0, 30, 60, … until the pull-back. |
| Time-lapse jump (b3, M5′) | the hand +36° in 3 f `EASE.expo`, overshoot 0.8°, `SPRING.land`; f255 to φ 72, then every 7.5 f to φ 324 (f307.5), then +12° to φ 336 at f315 |
| Glide (the agent) | ρ −6°/s, linear (never eased) |
| Day sweep (b5, M5′) | the hand +360° in 75 f, linear (4.8°/f); domes pop as the needle passes φ 36, 108, 144, 252, 324 |
| Pulse | scale 1 → 1.15 → 1, `SPRING.pop` {420, 24, 0.8} |
| Pop-in (domes) | scale 0 → 1, `SPRING.pop`; opacity 0 → 1 over 2 f |
| Pickup stamp | dome scale 1 → 1.15 → 1 (`SPRING.pop`) + graphite → teal radial wipe (4 f) + collar `tealDeep` → `teal` → `tealDeep` (4 f each way) |
| Rebuild (f364-384) | ticks sweep in outward from the needle (tick i at +0.1·i f, each 3 f); the rim trims on both ways from the reading point (16 f `EASE.expo`, `pathLength="1"` dash offset); the first dome pops as the trim passes it |
| Macro drift | always on: scale +1.5 %/s about the shot's focus (the reading point in M1/M3′, the dial centre in M5′, the hub in M2′) |

### 9.6 Camera and crops (`Camera.tsx`)

`S = 1 + (cam.zoom − 1)·k`; `transform = translate(anchor) rotate(cam.rot·k) scale(S) translate(−focus)` on each plane's
`div` (never on SVG children). Planes: dial k 1.00, hand 1.12, hub 1.15, lockup 0 (screen-locked).

| Crop | focus → anchor, zoom | Used |
|---|---|---|
| M1 | identity, ×1 | shots A, C, H (from f384), K |
| M3′ | reading point (601, 310) → (601, 310), ×1.8 (punch to ×2.34 at f180) | B, J |
| M5′ | a separate upright drawing: dial centre (520, 600), R 410 on screen | E, F, I |
| M2′ | hub (97, 1183) → (260, 900), ×2.2; dial plane hidden (a fresh clock seen only at its hub) | G, and the start of H |

The camera never overshoots. Cut mid-move (T1 at the step's first frame; T3 on the whip's fastest frame).

### 9.7 Easing and springs (`src/lib/motion.ts`, imported)

| Name | Curve | Used for |
|---|---|---|
| `EASE.expo` | cubic-bezier(0.19, 1, 0.22, 1) | steps, punch-ins, lead mask rise, accent slide + wipe, trims, T2 open, T4 underline |
| `EASE.house` | (0.16, 1, 0.3, 1) | tier set-rise |
| `EASE.inOut` | (0.65, 0, 0.35, 1) | pull-back, node pan in T2, dome glide, orbit |
| `EASE.peel` | (0.7, 0, 0.2, 1) | T3 whip |
| `EASE.in3` | (0.55, 0.055, 0.675, 0.19) | exits, the recede |
| `EASE.in4` | (0.895, 0.03, 0.685, 0.22) | T2 push |
| `SPRING.pop` | {420, 24, 0.8}, ≈ 6 % over, settled ≈ 12 f | pulses, domes, stamp, full stop |
| `SPRING.land` | {210, 13, 1} | step settle, sweep landing |
| linear | | glide, day sweep, ring 2's honest six seconds |

### 9.8 Type animation recipe (`Lockup.tsx`)

| Tier | In | Out |
|---|---|---|
| Frame-0 lockup (1a) and the seam | set at 72 % ink from f0 / by f839; each word lifts to full ink on its onset (2 f); the accent lifts as a unit on its first word with a scale pop ≤ 3 % | 4 f up through the mask, lead → accent → tier 1 f apart |
| Lead (sans) | **per word**: rises from +105 % of its line box behind a clip line, 7 f `EASE.expo`, starting 2 f before the word's onset | 4 f up through the mask, `EASE.in3` |
| Accent (serif italic) | x −40 → 0 px while `clip-path: inset(0 100% 0 0)` opens to `inset(0 0 0 0)`, 10 f `EASE.expo`, **landing on its first word's onset**; teal from its first frame | 5 f: scale 1 → 0.94 + opacity → 0, `EASE.in3` |
| Sentence tier | the whole screen set at 72 % (a 6 f rise of 16 px, `EASE.house`) 2 f before its first word; each word lifts to 100 % on its onset (2 f) | 4 f up through the mask |
| T4 underline (S4a only) | 3 px teal, from the hub disc's lower edge (97, 1232) to the accent's right end, at accent baseline + 7 px, 10 f `EASE.expo` from the "receptionist" onset; skip-ink gaps of 6 px around descenders | wipes off left to right with 4a's exit (4 f) |

**Positions** (screen px; lockup screen-locked):

| Lockup | Lead | Accent | Tier |
|---|---|---|---|
| default (2a, 2b, 3, 4b, 6) | 60 px, x 411, baseline 1160 | 110 px, x 396, baseline 1235 | centred under the accent, baselines 1290 / 1328 |
| hook 1a (×1.15) | 69 px, x 345, b 1150 | 126 px, x 330, b 1236 | centred x 580, b 1296 |
| hook 1b (×1.1) | 66 px, x 360, b 1150 | 120 px, x 345, b 1230 | centred x 617, b 1292 |
| 4a (10 px higher for the underline) | 60 px, x 411, b 1150 | 110 px, x 396, b 1225 | centred, b 1282 |
| 5 (wide accent) | 60 px, x 311, b 1160 | **100 px**, x 296, b 1235 | centred x 596, b 1290 |
| End6 CTA | 60 px, centred x 540, b 760 | 110 px, centred, b 845 | centred, b 905 |

Rules: the lead is left-aligned 15 px inside the accent's left edge (the italic overhang); one moving text at a time; a
lockup holds ≥ 15 f after its last word and longer to keep text-free gaps ≤ 30 f (the two wordless beats ≤ 45 f); text
never rotates, skews, blurs or carries a shadow; every lockup reports its rect to `ZoneRect` (labels: `text …`).

### 9.9 Transition recipe (`Transitions.ts`)

| | Spec | Where |
|---|---|---|
| **T1 tick cut** | a hard cut on the step or beat frame to a new crop of the same object; the reading point (601, 310) keeps its screen spot across M1 ↔ M3′ cuts; the lockup holds across every cut (k 0) | f90, f210, f435, f525, f570 |
| **T2 fall-through** (computed disc, judge-style §4.3) | f222-228: world ×1 → ×12 about node 2 (`EASE.in4`) while node 2 pans to the frame centre (`EASE.inOut`); past ×6 every layer but node 2 is culled. f228-232: node 2 is drawn in screen space as a ring, inner r = 6·z, outer r = 12·z, z continuing on the same curve to ≥ 184 (the white centre covers the 1101 px half-diagonal). f232-233 pure white. f234 open: M5′'s rim drawn at ×3 → ×1 (12 f `EASE.expo`). | b2 → b3 |
| **T3 whip** | the dial plane +75° about its centre in 7 f (`EASE.peel`); cut on the fastest frame (f333) to M2′, whose own rotation continues −35° → 0 (12 f `EASE.expo`). No motion blur. | b3 → b4 |
| **T4 line match** | the hub's teal line becomes the keyword's underline (§9.8) | S4a |
| **Exit to End6** | f640-654: dial + hand recede up-left ×1 → ×0.6 (8 f `EASE.in3`, the hand plane 2 f ahead); the dome glides to (848, 1000) on `EASE.inOut` (14 f), Ø 54 → 72, gradient → flat `teal`; the white arrow draws (6 f) | b7 → b8 |

Never: cross-dissolves, zoom blur, spin blur, glitches, light leaks, page curls, morphs (T5 is unused in this script).

### 9.10 `End6` (`stage/End6.tsx`)

Built from `components/End.tsx`'s exports (`END` geometry, `endState`, `ctaLine`, `agentKeys`, `CommentField` only if its
props allow a white-style field, otherwise a local field), `Wordmark`, `WORDMARK_FONT`, `WORDMARK_TEXT` from
`scenes/cta/EndCard.tsx`, and `impactHits` / `endHits` / `AGENT_STEP` from `common/series.ts`. **No shared file is edited.**
`wordmarkEm` in `End.tsx` is not exported: copy its 8 lines (measure at `500 1000px`, −0.07em). Values: SCRIPT.md §8.

### 9.11 Speed budget (60 fps upload, no motion blur; judge-style §4.2: ≈ 120 px average, ≈ 250 px peak per frame)

| Move | Average px per 60 fps frame | Verdict |
|---|---|---|
| M1 step, 6° at R 1623 (170 px in 3 f) | ≈ 28 (peak ≈ 85) | ok (a tick: exempt anyway) |
| M3′ step (306 px in 3 f) | ≈ 51 (peak ≈ 150) | ok (tick) |
| M5′ time-lapse jump, 36° at R 410 (258 px in 3 f) | ≈ 43 (peak ≈ 130) | ok |
| M5′ day sweep, 4.8°/f at R 410 | ≈ 17 | ok |
| T3 whip, 75° at R 410 (537 px in 7 f) | ≈ 38 (peak ≈ 120) | ok |
| Pull-back M2′ → M1 (hub 327 px + scale, 20 f) | ≈ 8-25 | ok |
| Recede ×1 → ×0.6 (8 f) | ≈ 25 | ok |
| Dome glide to the send disc (≈ 770 px in 14 f) | ≈ 28 (peak ≈ 55) | ok |

### 9.12 Shell, finish, zones, QA

- **`Reel6.tsx` shell:** a copy-adapt of `src/ig/Reel.tsx` `IgReel` (imports `ZoneProvider`, `ZoneOverlay`, `ZoneRect`,
  `Soundtrack`, `useSub`, `useTimelineFrame`, `waitForFonts`; nothing edited) with `background: '#FFFFFF'` and
  `<IgFinish white={1} spec={{ ...FINISH, paper: 0 }} />` (or no finish at all): flat white, no grain. `IgReel` itself
  is untouched (ig1-ig5 render through it). `ZoneProvider` gets `reel: 'ig6'`.
- **Zones:** `src/ig/ig6/zones.ts` = ig5's rule values (text x 86-900, y 240-1400; objects x ≤ 880 below y 840; wordmark
  x 60-1020; cover words x 86-900, y 260-1380), registered with `registerZones('ig6', …)` from `Reel6.tsx` and
  `Cover.tsx` at module scope. Dial, hand, domes and the field report as `object …`; the wordmark group as `wordmark …`.
- **Overlap check:** a still-frame test of the lockup box (x 296-900, y 1080-1400) against the object layers at every
  screen onset (the zone guard tests text against the frame only).
- **Probe:** a 2 s 120 fps strip of frame 0 + the M5′ shadowed hand through the real encode chain at the 28 s budget
  (`scripts/ig/qa/probe-encode.mjs` pattern), checked for banding before the master.
- **Review gates** (series): stills at every screen onset, a contact sheet every 6th frame, 120 fps strips of the T2
  fall-through, the T3 whip and the time-lapse, the seam diff, ≥ 2 critic rounds.
