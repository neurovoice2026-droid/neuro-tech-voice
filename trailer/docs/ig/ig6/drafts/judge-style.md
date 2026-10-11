# ig6 · judge: style fidelity

Label `judge:style`. Written 2026-10-11 on `claude/remotion-trailer`. Planning only: this is the only file written. No code, no voice, no Cartesia call, nothing committed.

## 1. Scores

| Concept | Frame look | Motion grammar | Stack fit | **Style fidelity** | **Craft safety** (10 = safest) | Weighted (0.7 F + 0.3 S) | Fidelity after the §3 fixes |
|---|---|---|---|---|---|---|---|
| **clock** "Every second" | 9.5 | 9 | 9 | **9** | 6.5 | **8.3** | 9.5 |
| **free** "While you were out" | 7 | 7 | 6 | **7** | 5 | 6.4 | 7.5 |
| **sign** "The other side" | 6 | 7 | 8 | **6.5** | 7 | 6.7 | 7.5 |
| **phone** "Off the hook" | 4.5 | 6 | 5 | **5** | 4 | 4.7 | 6 |

**What the columns mean:**
- **Frame look:** how close a typical frame is to the thumbnail. It is scored on the tests in §2, using each concept's own mock.
- **Motion grammar:** how well it follows STYLE §2:
  - one object under one camera;
  - macro drift, snap punch-ins, ticks or sweeps;
  - T1-T5 match cuts;
  - the accent is the part that moves or grows;
  - no cartoon conventions.

  The reel itself can't be watched, so §2 of STYLE is inferred, and this column is scored against that inference.
- **Stack fit:** how much of the look the STYLE §5 tool plan already covers (2.5D SVG planes, one camera, no three.js, fonts loaded in `src/ig/ig6/fonts.ts`), and how much new drawing or simulation the concept needs.
- **Craft safety:** how likely the build is to look cheap or break at 120 / 60 fps.

**The most faithful concept is clock, by a wide margin.**
- It is the only concept whose frame 0 lines up with the reference. STYLE's own redraw (`scratchpad/ref6an/mock.png`, right half) is its frame 0.
- STYLE's tool plan was written for this object: `Dial.tsx`, `Hand.tsx` and the M1-M5 crops.
- It still has to change four things (§3.1). The most important one: it reuses the reference's own signature lockup, with *every second* as the teal italic.

**Order:** on fidelity, clock > free > sign > phone. On the weighted score, sign moves just ahead of free, because sign is the easiest of the two to build well.

---

## 2. The yardstick: what "exactly this style" means, tested

These are seven tests for the look and one for motion. They come from the thumbnail (measured in STYLE §1) and the reference's caption, "Minimal visuals".

"Ink" is the share of pixels darker than 60/255 on each concept's frame-0 mock (my measurement: reference thumbnail 2.6 %, STYLE clock mock 2.4 %, phone f0 10.0 %, sign f0 2.2 %, free f0 1.5 %).

| Test | Reference | clock | free | sign | phone |
|---|---|---|---|---|---|
| **T1** Flat white ground, no texture | yes | yes | yes | yes | yes |
| **T2** One object in macro, bigger than the frame, cropped by at least 2 edges | dial cut by 3 edges, hand by 2 | **yes** (same crop) | **yes** (the pad is cut by the top and right edges, the pen by the left and bottom) | **part.** The sign shots are medium shots: the card loses only about 50 px on one side. The clock shots pass. | **part.** The macro crops pass. The M5 reveal shows the whole phone. |
| **T3** Fine lines: one thin black element and hairline detail; ink about 2-3 % of the frame | 2.6 % | 2.4 %; **part:** the 24 px ring bands are the heaviest marks in the reel | 1.5 %; **part:** in the mock the nib reads as tweezers | 2.2 %, but most of that ink is the CLOSED lettering | **no.** 10.0 % at frame 0, four times the reference, and a solid ☎ silhouette. |
| **T4** Round shapes: one giant arc across the top third, with ticks and dots on it | the signature | **yes** | **no.** Everything is straight lines; the straight perforation stands in for the arc. | **part.** Only in the clock shots, about 9 s of the 22 s before the CTA. | **part.** Only the rotary-dial crop P5, in the CTA. |
| **T5** Black + one accent, and the accent is the part that moves or grows | green arc, dots, hub, italic | **yes**; part: the teal hub sits idle on the unanswered clock | **yes**, the most literal: the teal ink is what writes | **yes**, the clearest colour story (grey rim → teal) | **yes** (teal arrives at the pickup) |
| **T6** One type system: the three-tier lockup in the object's empty space, and no other type | yes | **yes**; the lockup sits right of centre, as in the reference | **part.** The printed slip labels add a fourth type voice (32 px or less, and spoken). | **no in the sign shots.** CLOSED, in 150 px heavy caps, becomes a second headline above the lockup, and the layout is a centred poster. | **yes** |
| **T7** 2.5D paper: flat fills, soft long shadow on raised parts only | yes | **yes** | **yes**, the strongest (it is real paper) | **yes** | **yes** |
| **T8** Motion: always moving, snappy eased moves, ticks or sweeps, match cuts on one object, no cartoon conventions | (inferred) | **yes**; one move breaks the speed budget (§4.2) | **part.** The sine-wave scribbles and the 2D tear look hand-made. | **yes**: flip, damped swing, two-plane dolly. Part: the lettering sways and keystones. | **part.** Ring motion lines and a 4 f hop rattle are comic conventions. There are two drawings of one handset, and the whip strobes. |

---

## 3. Each concept: what it does best, what must change, the craft risks

### 3.1 clock (fidelity 9, the most faithful)

**What it does best:**
- **Frame 0** is the reference's composition, moved into our safe zone.
- **The dial markings are ours:** ring nodes every 36°, fine ticks every 1.2°.
- **The hook lockup** "One ring, / *six seconds.*" has the reference's structure (a short sans lead, then a two-word italic) with our own words.
- **It uses the whole STYLE crop library:**
  1. M1, the reference frame;
  2. M3′, the tip macro;
  3. a T2 push-through;
  4. M5′, the full dial;
  5. a T3 whip;
  6. M2′, the hub macro;
  7. a pull-back to M1;
  8. M4′, the arc as a horizon.
- **Tick versus glide** tells the colour story in motion.
- **The sound comes from the object itself:** tick and tock act as the hats, as STYLE §2.7 asks.

**Must change:**
1. **Stop reusing the reference's signature words.**
   - **The problem:** lockup S2a "And" / *every second* is the reference's "Because" / *every second* with one word swapped, set in the same tiers. The title "Every second" repeats it. STYLE §6 says to copy the style, not the sentence.
   - **Fix:** change `ig6-02` to "And while it rings, someone's still waiting." The lockup becomes "And" / *while it rings,* (536 px at 110 px, measured on the real Cormorant 600 italic; the limit is 570). The open loop across ring 2 stays, and the line is still true by definition. The truth judge should confirm the new wording.
   - **Retitle** it "One ring" (slug `one-ring`).
2. **Thin the ring bands.**
   - **The problem:** a 24 px band is 2.7 times the rim's width and heavier than any mark in the reference. In the M1 crop a 12° band is about 340 px of black bar, which reads as a progress bar, not a dial.
   - **Fix:** make the band the rim itself: over those 12° the 9 px arc changes colour (teal or `#D6D6D6` → ink). If it must read in the grid tile, use 12 px at most, on the cover only.
3. **Fix the fastest move: the b5 full-turn spin at M4′ ×2.6.**
   - **The problem:** it averages about 1,300 px per 60 fps frame, not the draft's "≈ 150" (§4.2). Even at 14 f it averages about 950 px. With no motion blur, that strobes.
   - **Fix:** replace it with a T3 75° whip in M5′, or a ±20° orbit at M4′ (about 50 px per frame on average).
4. **Replace the ×200 push into node 2** with STYLE's T2 grammar.
   - Push the world from ×1 to about ×12.
   - Then hand over to a screen-space disc whose radius is computed each frame (§4.3) until it covers the frame.
   - Then 2 f of white, and open on M5′.
   - It is the same picture, without a 200× scaled SVG stack.

**Should change:**
5. **Keep teal for the agent only.**
   - On the unanswered clock, make the hub dome graphite `#3A3A3A` (the sign concept's idea) and keep the nodes hollow.
   - On the agent's clock, make the dome teal and fill the nodes as flat teal domes (STYLE §4.3).
   - Frame 0 keeps the teal rim and the teal italic, so it still reads as the reference. Teal then means only "the agent" (STYLE §4.1). The draft's teal hub sitting "idle" on the unanswered clock blurs that.
6. **Redraw the hand in our own proportions.** Keep the hollow-lozenge hand, which is a common watch-hand type. Change its proportions (waist, needle length, collar position) by about 10-15 %, so that frame 0 is not a trace when shown side by side. The draft's alternate, the Breguet "pomme" tip, is also fine.
7. **Optional:** borrow the phone's T4 (the needle stretching into an underline) for the exit from b6 into the end card. It is the one style-native transition the clock doesn't use yet.

**Craft risks**
- **Density:** up to about 380 marks at 120 fps. Draw only what the camera sees (already planned).
- **Mix:** the ticks sound under her voice in `check-mix`.
- **The seam:** it has to match the dial step and the node pop at f0, in velocity as well as position.
- **The time-lapse:** the node pops sit on 8ths only if the sweep is phased exactly.
- None of these is a risk to the look once fixes 3 and 4 are in.
- **Safety 6.5.**

### 3.2 free (fidelity 7)

**What it does best:**
- **The most consistent look across the whole reel:** flat paper, a black diagonal tool with a diamond-shaped point, a dotted line across the top, and the lockup in the white.
- **Frame 0 echoes the reference's composition without tracing it.**
- **"The accent grows" is literal:** teal ink is the only thing that writes.
- **The sound comes from the object:** paper and nib sounds are its percussion.
- **It is the most minimal:** the lowest ink of the four (1.5 %).

**Where it loses:**
- **No arc or round geometry (T4)**, and the arc is the reference's signature shape.
- **The slip labels add type.**
- **Two moves look hand-made:** the scribbles and the tear.

This is why it tops out at about 7.5.

**Must change:**
1. **Redraw the nib.**
   - **The problem:** a hollow lozenge that is open at the tip reads as tweezers. In the pickup panel of the mock it looks like tweezers holding a teal square.
   - **What reads as a fountain-pen nib:** a solid pointed shield with a centre slit and a breather hole.
   - **Fix:** keep the rhyme with the reference hand by cutting the breather hole as a lozenge. Test the muted read at the frame-0 size (about 150 px).
2. **Replace the cursive scribbles with geometric ink.**
   - **The problem:** the mock's sine-wave scribbles read as fake handwriting and break the precise-vector look.
   - **Fix:** monoline teal dashes of word-like lengths (4.5 px, round caps, 2-4 dashes per field, short gaps), drawn left to right by the nib. They read as "written", with no legible letters, so the truth guarantee is the same.
3. **Sell the tear with flat paper, not 3D.** Add a flat `#F2F2F2` fold polygon at the tear front for the 8 f of the rip (a flat fill, no gradient), on top of the planned scalloped edge. Without it, the tear reads as a slide.

**Craft risks**
- **High, until fixes 1 and 2:** the ink and the nib's legibility.
- **Medium:**
  - the 2D tear;
  - the pen's swing of about 98° (its shadow must change from contact to long without popping);
  - the T2 push into the bead (fixed as in §4.3).
- **Low:** the new `fx-tear` synthesis.
- **Nib tracking** needs no new dependency (§4.4).
- **Safety 5.**

### 3.3 sign (fidelity 6.5)

**What it does best:**
- **The clearest colour story of the four:**
  - night 1 has a grey rim, a graphite hub and hollow dots;
  - night 2 has a teal rim, a teal hub and filled teal dots.
- **The night clock is the reference picture** (C1 = M1), for about 9 s.
- **The two-plane dolly** past the sign to the clock is the most convincing 2.5D move in any draft.
- **The *open* face** in teal Cormorant makes the object itself carry the type contrast, which is a style-native idea.
- **It is the cheapest to build.**

**Where it loses:**
- **The sign half reads as a poster:** a centred rectangle with a heavy all-caps headline, shot as a medium shot rather than a macro.
- **Frame 0 has two type systems.**
- **The reel has two hero objects.**

**Must change:**
1. **Shoot the sign in macro.**
   - Crop the card by at least two edges, and really lose some of it: at least 15 % of its width off the left, with the cords running off the top.
   - Set the lockup in the white that is left, right of centre (x ≈ 630, as in the reference), not centred under the card.
   - A centred, nearly whole card reads as signage, not as one object bigger than the frame.
2. **Make CLOSED read as lettering on the object, not a headline.**
   - **The problem:** at weight 680, all caps and 150 px, it is the biggest, heaviest type on frame 0, so it becomes the headline above the lockup.
   - **Fix:** set it at the lead's weight (580), 120 px or less, tracking +0.04em. The lockup's sans/italic contrast then stays the only typographic event.
3. **Flip the sign with CSS 3D, not scaleX.**
   - **The precedent:** this pipeline already renders a perspective `rotateY` door with hidden backfaces (`src/scenes/twist/Door.tsx`) and `rotateX` paper flaps (`src/kb/kit/paper.tsx`, `src/kb/scenes/turn/Flap.tsx`).
   - **The problem with scaleX:** the squash reads as a 2D card trick.
   - **Fix:** run the draft's lettering-sharpness probe using `Door.tsx` as the template, and keep the scaleX flip as the fallback.
4. **Cap the sway at 1° while a face is being read.** The keystone is fine, because it belongs to the object.
5. **Fix the T2 push into the nail dome (×36)** as in §4.3.

**Craft risks**
All of these are already planned in the draft:
- the shadow of the turning card (drawn on the ground layer, not rotating);
- the cords, attached to the eyelets after they are transformed;
- the white-on-white card after the 60 fps encode (probe);
- culling the sign plane during the dolly.

**Safety 7: the lowest-risk build here.**

### 3.4 phone (fidelity 5)

**What it does best:**
- **The P5 dial-arc crop** genuinely recasts the reference composition: the finger holes are the white-centred dots, and the finger stop is the hand.
- **T4, the cord straightening into an underline,** is the most style-native transition in any draft.
- **Teal arrives on the object at the pickup.**

**Where it loses: weight and visual language.**
- **Too much black:** frame 0's ink is 10.0 %, against the reference's 2.6 %.
- **It reads as a stock icon** (STYLE §6, Don't): the solid black handset and the front view of the whole ☎ (M5).
- **Comic conventions:** the ring motion lines and a hop rattle every 4 f.
- **Two drawings of one object:** P7 draws the handset a second time, from another view.
- **The reveal shows the whole object.**
- **Words:** 54, the densest script of the four.

**Must change:**
1. **Open on P5,** the dial arc. It is the reference composition with our object. Let the handset enter cropped at the top edge. Keep the black at about 4 % of the frame or less, with a slimmer handset and a tighter crop.
2. **Drop the ring arcs.** Show the ring with a small rattle, the plungers chattering, and the trill.
3. **Drop P7.** Play "It's an AI" on the dial's centre card instead.
4. **Keep the reveal cropped by at least two edges:** the handset is off the hook and leaves the top or right edge. Never show the full front view of the ☎.
5. **Prototype the coiled cord first.** Make a still at P2 ×3.2 before committing, because it risks reading as a spring. The fallback is a smooth sine cord.
6. **Fix the b2 T3 whip about the earpiece cup.**
   - **The problem:** the handset's far end is about 1,170 px from the pivot. That is about 110 px per 60 fps frame on average and about 250 px at the peak on `EASE.peel`, so a solid black shape doubles up with no blur.
   - **Fix:** put the pivot near the black shape, or cut on frame 3 as STYLE §2.5 says.

**Craft risks**
- **High:**
  - the cord;
  - the quality of the handset drawing (the mock's polygon handset is exactly the clip-art failure).
- **Medium:**
  - the faked lift;
  - the match-cut anchors;
  - the montage's sound density.
- **Safety 4.**

---

## 4. Build rules for whichever concept wins

### 4.1 End card

Use **`End6`** (the white end card) for any winner. `IgEnd`'s teal bloom is a glow on white, so it fails T1 and T7.

### 4.2 Speed budget at 60 fps (house rule: no motion blur)

**Formula:** speed at the edge, per 60 fps frame = R on screen × Δθ in radians ÷ (2 × the move's timeline frames).

**Budget:**
- Keep moving detail at about 120 px per frame on average or less, and about 250 px at the peak of a `peel` or `expo` ease.
- A clock tick is exempt: it is meant to read as a jump.

| Move | Draft | Average px per 60 fps frame (computed) | Verdict |
|---|---|---|---|
| clock b5, a full-turn spin at M4′ ×2.6 (R ≈ 4,220) | 10 f; the draft says "≈ 150" | **≈ 1,325** (the peak is 2-3 times that); at 14 f still ≈ 950 | **fails.** Move it to M5′ (R 410, ≈ 130), or use a 75° T3 whip or a ±20° orbit. |
| clock T3 whip, 75° at M5′ (R 410) | 7 f | ≈ 38 | ok |
| clock shot E sweep, 144°/s at M5′ | linear | ≈ 17 | ok |
| phone b2 T3 whip, 75° about the earpiece cup (far end ≈ 1,170 px) | 7 f | ≈ 110, peak ≈ 250+, on a solid black shape | risky |
| sign C2, the hand's full turn (tip R ≈ 380) | 45 f | ≈ 27 | ok |
| sign flip, 90° (half the card's width, 540 px) | 7-10 f | ≈ 27-39 | ok |
| free b7 fly-off (`EASE.in4`, about 1,200 px) | 14 f | ≈ 43; ≈ 170 as it leaves the frame | ok (it leaves the frame) |

### 4.3 Zoom-through pushes (T2)

**The problem:**
- A centred disc covers the frame only at Ø 2,202 px or more.
- At STYLE's ×16, a Ø 58 dome reaches only Ø 928 px. A Ø 24 node needs about ×92, and a Ø 30 bead or nail dome about ×73.
- The drafts use ×200 (clock), ×36 (sign) and ×16 (free and phone).

**The rule, for every concept:**
1. Scale the world up to about ×6-12.
2. Past ×6, cull every layer except the target.
3. Then swap to a circle drawn in screen space, its radius computed each frame (r = r0 × zoom), until it covers the frame.

That is one drawing: no huge scaled SVG layer, and no stroke blowing up into a 1,000 px ring.

### 4.4 Paths without the undeclared dependency

`@remotion/paths` is importable but not listed in `package.json`. No concept needs it:
- **Stroke draws:** set `pathLength="1"`, `strokeDasharray="1"` and `strokeDashoffset={1 − p}` on the SVG path. There is no length math.
- **Pen-tip or nib tracking:** the render browser's own `SVGPathElement.getPointAtLength`, computed once per path in a memo. It is deterministic. A lookup table built ahead of time by a script also works.

### 4.5 Acceptance checklist for the look (every draft already plans these)

- **The shadow** sits on a non-rotating wrapper.
- **Banding:** probe the 7 % shadow ramps in the 60 fps upload copy for banding.
- **Grain:** the `IgFinish` grain is 0.
- **The lockup** sits in the object's empty space, off-centre like the reference, except on the end card.
- **The sentence tier is 32 px,** not the reference's 24 px: a small cost in fidelity for a real gain in legibility.
- **Cormorant** loads only from `src/ig/ig6/fonts.ts`.
- **Originality:**
  - the reference's words never appear in the accent tier;
  - no watermark;
  - the hand is in our own proportions.
- **Overlap:** a still-frame check of the lockup box against the object layers, because the zone guard doesn't test this.

---

## 5. Recommendation

**Build clock.**
- **Must:** fixes 1-4 in §3.1 (the reference's words, the band weight, the full-turn spin, the ×200 push).
- **Should:** fixes 5-6 (teal for the agent only, the hand's own proportions).

**If the panel picks another concept for its story,** the fidelity order is:
1. free, with the nib and ink fixes;
2. sign, with the macro and lettering fixes.

Both land at about 7.5, still well below the clock.

**Ideas worth folding into the clock:**
- sign's grey and graphite → teal colour story, and its hollow → filled teal dots (fix 5);
- phone's T4, the needle stretching into an underline (fix 7).
