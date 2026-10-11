# ig6 · "One ring" — picture build (BUILD)

Label `picture`. Built 2026-10-11 on `claude/remotion-trailer` from HEAD `cbbc115`. The orchestrator's WIP commit `8c14085` (22:51 UTC) already holds every source change described here; nothing else was committed by this step. No `npm install`, no shared file edited, `CARTESIA_API_KEY` never read.

**Inputs:** `SCRIPT.md` (beats, frames, screens), `STYLE.md` §9 (build spec), `PIPELINE.md` (route, gates, NEVER list), the reference thumbnail (`scratchpad/ref6/thumb.jpg`) and `mock-one-ring.png`. The voices are the Cartesia picks installed by the voice step (`voice-candidates/ig6/PICKS.md`); `timing.ts` re-anchors on them.

**Result:** the whole reel is built in `src/ig/ig6/` as one continuous 2.5D stage, for both casts (A = `ig6-01`, B = `ig6-01b`), on Tessa's measured onsets. `tsc` passes. `check:zones:ig -- --film=ig6` passes. The loop seam differs from frame 0 by 0.24 % of pixels. ig1–ig5 are untouched (guard gates 1–6 PASS, 30/30 stills byte-identical), and their sound stamps skip. Two kinds of transition frames are full-frame camera moves by design and are listed in §6.

---

## 1. Files

The four top-level `.ts` files that `ig6Hash` reads (`timing.ts`, `zones.ts`, `voice.generated.ts`) were **not touched**. The mix stamp is still `9f1d62e934e98263`, and `npm run sfx:ig6` skips. Every picture module sits in a subfolder.

| File | Status | Role |
|---|---|---|
| `Reel6.tsx` | edited | provides `Ig6Qa` (zone mode) to the stage |
| `Cover.tsx` | rewritten | `IG6-Cover-9x16`: frame 0's composition, drawn bolder, with SCRIPT §9's type |
| `acts/Acts.tsx` | rewritten | all eight acts mount `Stage6` at their absolute frame, so an act boundary is invisible |
| `stage/style.ts` | extended | adds `MARKS`, `PHI0`, `FULL` (M5′), `CROPS`, `END6`; tunes the lockup baselines (§5) |
| `stage/geom.ts` | new | camera planes, project/unproject, the dial's polar coordinates, the visible-window solver, pchip |
| `stage/handPath.ts` | new | our hand, built from the STYLE §9.5 width profile; one evenodd path plus its outline points |
| `stage/clock.ts` | new | the object's state as a function of t: steps, recoil, rings, pings, the time-lapse, the agent's glide, the day, the domes |
| `stage/Camera.ts` | new | the shot list A–L and the camera of each shot |
| `stage/Dial.tsx` | new | world dial (M1/M3′/T2) and full dial (M5′), drawn in screen space; domes |
| `stage/Hand.tsx` | new | hand + hub on the hand plane; long shadow on a non-rotating wrapper; stamp, wipe, collar, hub ping |
| `stage/Lockup.tsx` | new | the three tiers, word-synced; the T4 underline; zone rects |
| `stage/End6.tsx` | rewritten | the white end card (field, wordmark + full stop, URL); the travelling dome |
| `stage/Stage.tsx` | new | composes everything per frame; zone rects for objects; the lockup-box overlap check |
| `stage/qa.ts` | new | the zone-mode context |
| `acts/Placeholder.tsx` | unchanged, now unused | not imported, so not bundled. Left in place (the run may not delete files it did not create). |

The QA tools are in `out/ig/qa/ig6/picture/scripts/`: `bundle.mjs`, `stills.mjs`, `frames.mjs`, `zonesweep.mjs`, `sheet.py`, `strip.py`.

---

## 2. The reel, shot by shot (cast A, frames from the installed takes)

Frames are 30 fps timeline frames, rendered at 120 fps (every value is a pure function of fractional t). "Spec" means SCRIPT/STYLE.

| Shot | Frames | What is on screen | How it is built |
|---|---|---|---|
| A (M1, your phone) | 0–90 | The reference composition raised 300 px: giant cropped dial, centre (−9, 1814), R 1623. Teal rim 9 px; ticks fine/seconds/majors; hollow node 1 six degrees right of the needle, its 2 s stretch pending grey. Our hand at 30°: lozenge, deep-teal collar, graphite hub. Long shadow (24, 48, 10 px, 7 %). | **Steps:** −6° every 30 f (3 f expo to a 0.8° overshoot, then `SPRING.land`), with the hand recoiling +0.8°. **Ring 1 at f0:** node pulse ×1.15, ±2 px shiver at 12 Hz, one 2 px hairline ping (r 12 → 110, fading over 14 f). **Ink:** the stretch inks as the needle passes (f3–63). **Drift:** +1.5 %/s about the reading point. |
| B (M3′ ×1.8) | 90–210 | Tip macro. Node 2 slides in on the f150 step and lands under the needle on **f180 (ring 2)**. | T1 tick cut on the f90 step: the reading point (601, 310) keeps its screen spot. Punch-in ×1.0 → ×1.3 over 8 f on ring 2. |
| C (M1) | 210–222 | The reference frame again. | T1 cut on the f210 step. |
| D (T2) | 222–232 | Fall through node 2: an exponential push ×1 → ×12 (f228) → ×240 (f232), with node 2 panned to (540, 800). The rim and ticks thin away between ×3 and ×6; then only node 2's ring grows, until its white centre covers the frame. f232–234 pure white. | Every primitive is projected into screen space, so a ×240 push never builds a giant SVG. The dial is frozen at the push's first frame. |
| E (M5′, your phone) | 234–333 | The whole dial, centre (520, 600), R 410. It opens ×3 → ×1 out of the white (12 f expo) while the ticks sweep in clockwise. **The minute of rings:** the hand jumps node to node on 8ths (f255, then every 7.5 f to φ 324, then φ 336 at f315), each landing node pulsing. Ten black stretches fill the rim. | A separate upright drawing; the hand is redrawn at the true centre ×0.393. |
| F (T3 whip) | 330–333 | The M5′ plane spins +75° (`EASE.peel`). | Cut on f333, the fastest frame. |
| G (M2′) | 333–364 | A fresh clock seen only at its hub (×2.2; no dial: nothing to read a time from). Its rotation continues −35° → 0. **f345** the hub rings: dome shiver plus one ping, Ø 119 → 420 on screen. **f360 the pickup** on the bar 7 line: the dome stamps ×1.15; a radial wipe turns it graphite → teal over 4 f; the collar flashes teal. | |
| H (pull-back → M1, the agent) | 364–438 | Pull-back over 20 f inOut, the hub travelling (260, 900) → (97, 1183). The agent's clock rebuilds: ticks sweep out from the needle, the clean teal rim trims on both ways, and the first answered call pops as a teal dome at the reading point. It **glides** −6°/s, linear, from f384. | |
| I (M5′, the agent) | 438–525 | T1 cut on "day". The agent's day: one linear turn in 75 f. Five teal domes pop as the needle passes φ 36, 108, 144, 252, 324. It lands at 12 on f513 with a 0.8° bump ("from" is at f515), then glides. | |
| J (M3′) | 525–570 | The hand-tip close-up. A dome pops under the needle on the cut; the dial plane orbits −8° (40 f inOut). | |
| K (M1, calm) | 570–640 | The reference frame, gliding. A dome pops at the reading point on "yourself" (f599). | |
| K exit | 640–654 | The hand lifts away first, the dial 2 f later (8 f in3). The teal dome leaves the hub, rising first and then gliding right above the lockup box, to the send disc's place. It grows Ø 54 → 72 and flattens to plain teal. | §5 deviation 2 |
| L End6 | 654–826 | A white arrow draws into the disc. The comment field opens out of the disc, leftward. "Comment / *AGENT*" plus the tier. AGENT types one letter per 16th from her word (f695…). The disc presses on "link." (f731). **Impact f780:** the CTA and field leave; the dome flies (f774–780) and **stamps as NEUROVOICE's full stop on the bar line**; the wordmark (Inter Tight 500, −0.07em, ink, 720 px) surfaces centre-out from f780; `neurotechvoice.com` types in three chunks on Neuro \| Tech \| Voice. | |
| Seam | 826–840 | The brand leaves up. The dome goes home: left along a lane between the leaving wordmark and URL, then down onto the hub, draining teal → graphite. From f830 the hub disc grows under it, the hand extends out of the hub, and the dial draws on from the reading point: rim both ways, ticks sweeping out, node 1 popping in with its pending stretch. Lockup 1a rises to 72 % by f839. | f839 vs f0: 0.236 % of pixels differ by more than 8 levels (0.033 % by more than 32). |

**Teal carries the plot.** Your phone is black, grey and graphite: hollow nodes, ink stretches, graphite hub. The agent is teal: the hub after the pickup, the clean rim, the answered-call domes, the underline, the send disc, the full stop. The teal rim stays from frame 0, as SCRIPT G4 asks. The agent's calls are a handful at irregular times (three on the world dial, five in the day), never a full ring.

---

## 3. Type (Lockup.tsx)

The type is screen-locked and word-synced to the placed takes. All of it derives from `timing.ts` (`LOCKUPS`, `SCREENS`, `DISPLAY`, `vWord`), so cast B and any re-anchor follow by themselves.

| Tier | Motion |
|---|---|
| Lead (Instrument Sans 580, −0.03em, ink) | Per word: a mask rise from +105 % of the line box, 7 f expo, starting 2 f before her onset. Out: 4 f up through the mask. |
| Accent (Cormorant Garamond Italic 600, teal) | A slide (x −40 → 0) under a left-to-right wipe, 8 f expo, starting 3 f before her onset (deviation 3). Out: 5 f, scale → 0.94 with the opacity. |
| Tier (Instrument Sans 450, 32 px, grey) | The whole screen is set at 72 % (a 6 f rise of 16 px, house ease) 2 f before her first word. Each word lifts to full ink on its onset. Out: 4 f up through the mask. |
| 1a (frame 0) | Set at 72 % from f0. Each word lifts on its onset; the accent lifts as a unit with a ≤ 3 % pop. In the seam it rises back into the set state by f839. |
| T4 underline (S4a) | 3 px teal from the hub disc's lower edge (97, 1232) to "receptionist"'s right end. It draws from her onset (10 f expo), skips ink round the *p*, and wipes off left to right with 4a. |

**Screens, cast A:**

| Screen | Big lockup | Tier | Out at |
|---|---|---|---|
| 1a | One ring, / *six seconds.* | One ring, six seconds. | f66–72 |
| 1b | Your receptionist / *can't answer.* | Your receptionist can't answer. | f126–132 |
| 2a, 2b | While it / *rings,* → Someone's / *still waiting.* | one tier screen: "While it rings," / "someone's still waiting." | 2a held through ring 2; 2b out f224–230 |
| 3 | Someone else's / *customer.* | A missed call is / someone else's customer. | from f326 |
| 4a | Our AI / *receptionist* + underline | Our AI receptionist | — |
| 4b | Picks up, / *day or night.* | picks up, day or night. | — |
| 5 | It answers / *from your words.* | It answers from your words. | f566 |
| 6 | Ring it / *yourself.* | Ring it yourself. | f640 |
| 7 (End6) | Comment / *AGENT* | Comment AGENT for the link. | f774 |

Every word on screen is a word she says. Apostrophes are typographic. No numerals appear anywhere. Text never rotates, blurs or casts a shadow.

**Cast B** (`CAST = 'B'`, rendered from a temporary bundle; `timing.ts` restored byte-identical, sha256 `e415fe94…`):
- S1b is "You / *can't answer.*". "You" is at f79, "can't" at f82.
- `ig6-02a` is at f120; every other frame equals cast A's.
- Stills: `final-B/`, `final-B-sheet.png`.

---

## 4. End6, the seam and the cover

- **End6:** a white pill x 200–880, y 940–1060, r 60, with a 1.5 px `#E6E6E6` border and the long shadow (deviation 1). Lucide message-circle in ink. A caret blinking on the beat while idle. AGENT in Instrument Sans 600, 50 px, typed per 16th (kit `typedOpacity`). The send disc is the dome itself: flat `#0A8AA8`, white arrow, a .97 press. No GL bloom and no second accent. The wordmark comes from film 1's `Wordmark` component (import only). The full stop is Ø = the x-height × 0.55, 12 px after the R, and the group is centred on x 540. The URL is Instrument Sans 450, 34 px, grey.
- **Cover** (`final-A/cover-0000.png`): frame 0 drawn bolder (rim 12 px, ticks ×1.33, shadow 9 %), graphite hub, ring 1 one second in. The kicker AI RECEPTIONIST · 06, "One ring," / *six seconds.*, and the stakes line sit at SCRIPT §9's sizes and baselines, every word inside x 86–900, y 260–1380.

---

## 5. Deviations from SCRIPT / STYLE, and why

1. **The comment field is x 200–880, not 174–906.** TikTok's rail is x > 880 below y 840, and the field reports as an object (the infra check flagged this). The send disc sits at (820, 1000).
2. **The exit lifts straight up, not "up-left ×1 → ×0.6".** The dial is a circle of R 1623 seen through a corner. A scratch check (`scratchpad/ig6pic/exit*.py`) shows that any zoom-out or sideways move brings its unseen rim into the frame: the first draft showed the whole circle shrinking. A pure lift reveals nothing new: the dial goes up 920 px and the nearer hand 1450 px, 2 f ahead.
3. **The accent is 8 f expo from her onset − 3, not 10 f landing on the onset.** The 10 f expo showed each accent about 9 f before she said it. Now it reads on, or ≤ 2 f before, her onset (the series' sync rule), and the expo still puts the hit on the word.
4. **T2 changes.** Node 2 pans to (540, 800), not the frame centre, so the growing ring stays off the leaving 2b lockup. The zoom ends at ×240, so the white centre covers the farthest corner. The rim and ticks thin away between ×3 and ×6 instead of popping off at ×6. The hand leaves the frame by itself. The dial is frozen during the push: the f210 step's settle drifted node 2 by hundreds of px at ×100.
5. **The punch-in on ring 2 also lifts the frame 90 px.** At ×2.34 the ticks at the right edge dipped below y 840 under the rail.
6. **Lockup baselines.** At STYLE's values the Cormorant ascenders cut into the lead (the infra note: the *ll* of *still* under "Someone's"). Lead baselines: hook1b 1150 → 1140, default 1160 → 1150, underline 1150 → 1140, wide 1160 → 1156. The default tier moved 1290/1328 → 1296/1334, so the *y* of *day* clears "picks".
7. **The hub is on the hand's plane (k 1.12), not 1.15.** With two factors the hub slid off the hand's pivot whenever the focus was not the hub.
8. **The macro drift is scale only.** STYLE §2.2's +0.6°/s dial rotation would fight your phone's stepped reading. §9.5 lists scale only.
9. **The stamp lands on the impact frame.** The dome flies f774–780, and the letters surface from f780, centre-out over about 2 f. The spec flies the dome after the bar.
10. **The seam build starts at f830, not f828.** It waits for the brand to clear (f826–830), so the hand never extends through the wordmark. The dome's home path avoids every word.
11. **The pings fade over the whole 14 f** (radius still on expo). An expo fade was gone in 2 f, too faint for the muted read.
12. **Node 10's stretch is not drawn on the world dial.** It would sit behind the needle at frame 0, where SCRIPT §1.1 wants clean teal. M5′ draws all ten.
13. **The cover shows ring 1 one second in** (node 1 just behind the needle, its stretch inked to the needle). "Under the needle and half inked" is the f30–60 state; inking ahead of the needle would contradict the reel.
14. **No change to `zones.ts`.** Its rule (text x 86–900, y 240–1400, objects x ≤ 880 below y 840, wordmark x 60–1020) lies inside the orchestrator's x 60–940, y 220–1440. Editing it would also re-stamp the mix.

---

## 6. Gates and checks (logs in `out/ig/qa/ig6/picture/gates/`)

| Gate | Result |
|---|---|
| `npx tsc --noEmit -p .` | **PASS** (`01-tsc.log`) |
| `check:zones:ig -- --film=ig6 --selftest` (fresh bundle) | **PASS**: 15 zone stills plus the cover, no violation; the selftest probe is caught (`02-check-zones.log`, stills in `out/ig/qa/ig6/zones/`) |
| Dense zone + overlap sweep (`zonesweep.mjs`): A every 2nd frame (420 frames), B f0–240, T2 every frame | Objects that break TikTok's rail and object strokes inside the lockup box (x 296–900, y 1080–1400) while a lockup is up are logged as `[ig-zones] VIOLATION`, so `check-zones` fails on them too. The only hits are inside two designed camera moves (logs `zonesweep-A.log`, `zonesweep-B.log`, `zonesweep-A-T2.log`); nothing else, in either cast. |
| `guard:ig6 -- --check` | **PASS, gates 1–6** (final run, `10-guard-check-final.log`): 1747/1747 shas, 19 delivered prefixes, all five stamps (ig5 `19ca5ef2038155ea`), compositions +12 IG6 rows, **gate P 30/30 byte-identical**, git clean. Before the orchestrator's `8c14085`, gate 6 failed on ig6's own files (see the note below); gates 1–5 passed then too (`03-guard-check.log`). |
| `npm run sfx:ig` / `sfx:ig5` / `sfx:ig6` | skipped ×4 / skipped (`19ca5ef2038155ea`) / skipped (`9f1d62e934e98263`) (`05`–`07`) |
| `git status` on the film 1/2 frozen sets and the IG shared sources | empty (`08-git.log`); the hashed ig6 files (`timing.ts`, `zones.ts`, `voice.generated.ts`) are unchanged |
| Loop seam | f839 vs f0: 0.236 % (> 8 levels), cast A and B |
| `verify-film1 --fast` (extra) | **PASS** 6/6 (`11-verify-film1-fast.log`) |

The two designed camera moves behind the sweep's hits:
- **f224–226, the T2 push:** the dial and the hand sweep through the frame, under the rail and through the box, while 2b leaves (SCRIPT b2 has 2b exit "f224–229" during D).
- **f234–239, the ×3 → ×1 open of E:** the rim contracts through the rail area.

Both are full-frame camera moves of under 7 f, with no text inside the object.

**Note on gate 6.** The guard was written while `src/ig/ig6/` was untracked. Its gate 6 allows modifications only to the four shared files and `docs/ig/ig6/`. Once `cbbc115` committed ig6's own sources, any build edit to them reads as a failure: it flagged `Cover.tsx`, `Reel6.tsx`, `acts/Acts.tsx`, `stage/End6.tsx` and `stage/style.ts`, all ig6-owned. No path outside the ig6 prefixes changed. Widening gate 6 to "modified ⊆ the shared four + ig6's own prefixes" was attempted and denied by the permission system, so the guard is unchanged. Recommendation: the orchestrator widens gate 6 before the next edit to a committed ig6 file. After `8c14085` the gate passes again.

---

## 7. Stills, sheets, strips (`out/ig/qa/ig6/picture/`)

All of these were looked at and compared against the reference thumbnail and `mock-one-ring.png`.

| What | Where |
|---|---|
| Screen onsets and their +8 frames, every key moment, the cover (cast A) | `final-A/A-f*.png` (68 stills), `final-A/cover-0000.png`; sheets `final-A-sheet-1.png`, `final-A-sheet-2.png` |
| Cast B (hook, 2a/2b, seam) | `final-B/B-f*.png` (24 stills), `final-B-sheet.png` |
| Every 6th frame | `contact-every6-1.png`, `contact-every6-2.png` |
| 120 fps strips | `strip-120fps-fall.png` (T2), `-whip.png` (T3), `-stamp.png` (hub ring + pickup), `-sweep.png` (the day), `-lapse.png` (time-lapse jumps), `-punch.png`, `-step0.png` (first step + ping), `-rebuild.png`, `-exit.png`, `-fly.png` (dome to the full stop), `-seam.png` |

**Against the reference:**
- **Matches:** pure white; the giant cropped dial with the arc across the top and fine ticks inside it; the black hand on the diagonal with its hollow lozenge tip and dark hub; the soft paper shadow; one accent; heavy grotesk over an italic serif over a small grey sentence; the lockup in the hand's negative space.
- **Ours:** teal, our dial markings (ring nodes and stretches), our hand proportions, our sentences, no watermark.
- **Against the mock:** every panel lines up (f0, f100, f318, f392, f470, the end card, the cover).

Render cost: 120 frames at 1080×1920 / 120 fps in 7 s with 2 workers, so the 3360-frame master should take about 3–4 min plus the encode.

---

## 8. Not done here (next steps)

- **Sound.** Done by the sound step: §9.
- **Not run:** the banding probe (PIPELINE §6.3), critic rounds, the master render and finish.

---

## 9. Sound (the sound step)

Label `sound`. Built 2026-10-11 on `claude/remotion-trailer` at HEAD `8c14085`. Nothing committed; no `npm install`; `CARTESIA_API_KEY` never read. Every sound is in the shared library `public/ig/sfx/lib/` (read-only, sha-checked against `lib.json` on every build) or the shared `fx-impact-end.wav`. No ig6-own library was made: `public/ig/sfx/ig6/` holds only `bed.wav`, `bed.json`, `mix.wav` and `mix.json`.

### 9.1 Files

| File | Status | What |
|---|---|---|
| `src/ig/ig6/timing.ts` | edited (sound section only) | the cue sheet `HITS`, `VOICE_RIDES`, `MUSIC.ig6` (the bed's moments), `BED.ride`, `MIX.impact` (ig5's hold/release). Header note updated. `STOP` moved above `HITS`; its value is unchanged. Every export the picture reads (`M`, `LINE`, `SCENES`, `END_CARD`, `LOCKUPS`, `SCREENS`, `DISPLAY`, `HOOK`, `TAKES`, `VOICES`, `SPEECH`, …) is unchanged: the sha256 of their JSON dump is `ec89fb39…` before and after. |
| `scripts/ig6/bed.mjs` | new | ig6's own bed (PIPELINE §3.1 allows it). The instruments are copied token for token from `scripts/ig5/bed.mjs` lines 38–294 (`partial`, `pianoNote`, `subNote`, `stringSection`, `kitAt`, `segAt`). The build, the inhale, E on the logo and the chain are ig5's `bed()`. New: `ig6Harmony`, `ig6Parts` and a second cut gate for the fall-through. Nothing is imported from `scripts/ig/` or `scripts/ig5/`, and neither was edited. `scripts/ig6/generate-sfx.mjs` picks it up because the file exists (no driver edit). |

The stamp reads every `scripts/ig6/*.mjs` except the guard, so `bed.mjs` is part of `ig6Hash`.

### 9.2 What it sounds like (cast A frames; cast B follows from `M` and the onsets)

The genre is minimal and crisp, and each sound belongs to the object on screen. Your phone ticks and rings. The agent is glass and a click, and it glides, so nothing ticks after the pickup.

| Beat | Sound |
|---|---|
| b1 hook (no bed) | **Ring 1 at f0** (`fx-trill`, HEAD −4 dB), then **its two seconds of ringing**: the trill again every 12 f (0.4 s, its own length) at f12/24/36/48. This is the NA ring's "2 s on", heard while the ring's stretch inks. The ringing recedes under "six seconds." (−17/−19/−33/−29 dB) because the sibilant onset of "six" sits in the trill's band. **The clock:** a step every second, tock on the even seconds and tick on the odd (f0, 30, 60, 90 = the T1 tick cut, 120, 150, 180, 210 = the T1 tick cut), plus shot E's step at f240. On "can't answer." a `sub` and the reel's one `pop` (the library has only `pop-0`). Room tone throughout. |
| b2 wait | The bed enters on the bar 3 line (f120). `tap` on "rings,". **Ring 2 on f180, exactly 6.0 s after ring 1** (`fx-trill` −3 dB + the step's tock + a `thump` for the punch-in). Then its two seconds of ringing: soft under "someone's" (f192 −27 dB), −21 dB under "still waiting." and **swelling into the push** (f228 −13 dB). `tap` on "still". **T2:** `whoosh-rev` peaks on the white frame (f232). The bed is cut from the beat before the white (f225) to the bar 5 line (f240). |
| b3 missed | **The low hit out of the white:** a `thump` key hit at f234 as the dial opens. Then a 32nd ratchet of six ticks as the ticks sweep in (even level, slowing −1 dB a click), the f240 step, and **the time-lapse jumps on 8ths** (tick/tock alternating, f255 … f315) under her line. `tap` on "customer." on the bar 6 line. `land` as the last jump lands (f318). |
| b4 pickup | The riser crests on the bed's cut (f322, the stop-time). **The whip:** `swish` peaks on the cut (f333). In the room tone alone, **the hub rings** (`fx-trill` f345) and starts again (`fx-trill-1` at f355.5) but is **cut short by the pickup**. On f360 (the bar 7 line): `fx-pickup` + **a low hit** (`thump`) + the dome's knock (`fx-tock`) + a `sub`, and the teal wipe's `fx-ting` 2 f later. `whoosh-soft` under the pull-back. The first answered call is a `fx-glass-tick` at f366. The bed returns on f375. `tap` + `fx-scratch` (the underline) on "receptionist". |
| b5 day | The T1 cut on "day": `sub` + `tap`. **Five answered calls, five glass ticks** panned where the domes pop round the full dial (f445.5, 460.5, 468, 490.5, 505.5). The sweep lands on f513 ("from"): `thump` + `sub`. |
| b6–b7 | The words cut's dome and the "yourself." dome are key `fx-glass-tick`s, so the tonal duck takes 5 dB instead of 10. `tap` on "yourself.". The exit: `swish` on its fastest frame (f646). |
| b8–b10 | The arrow draws into the send disc (`fx-felttip-short`, f654). Then the series end stack: menu-open +2 (ig5 used +6, but its bed was louder), keys −1, click-down 0. The colophon's `draw` is dropped because End6 has no hairline. Then the riser crest, the roll, and **the brand impact on f780** (`impactHits` with `slam` −6, ig5's AAC true-peak fix). `MIX.fadeOut` [826, 840]. The seam carries no sound, so the replay's first sound is ring 1. |

**The bed** (`scripts/ig6/bed.mjs`, E major, 120 BPM):

| Section | What plays |
|---|---|
| Hook | nothing |
| From f120 | a muted felt-piano **quarter** figure in a graphite middle register, with the sub on bar ones and a low string pad (E · C#m7 · Amaj7); no shaker, because the clock is the hat. It rests from ring 2 until "someone's" has started. |
| Fall-through | cut f225–240 |
| Bar 6 | Bsus4 from "customer.", with the low strings swelling into the stop |
| Stop | silent f322–375 |
| Return (f375) | a rolled E over a low E, the pad an octave up (Emaj9), an **open 8ths** figure an octave up, shaker 8ths |
| The day | brushed 16ths and a light felt kick on 1 and 3 (the music-forward window, `MIX.arc`); B → E on the sweep's landing |
| Ring | C#m7 · Amaj7 |
| CTA | E · Amaj7, then B for the roll and E on the logo |

**Balance** (stems; voice − ducked bed). Cast B is the same body; its "your phone" section is 11.4 LU.

| Section | voice − bed | Section | voice − bed |
|---|---|---|---|
| your phone | 12.4 LU | agent | 13.1 LU |
| fall | 17.0 LU | day | 9.4 LU |
| lapse | 14.3 LU | ring | 11.7 LU |
| CTA | 9.5 LU | brand | 19.6 LU |

ig5 sat at 10.4–12.3 LU and ig1–ig4 at 10.5–15.3 LU. The day was 5.3 LU in the first pass; `RIDE.day` 7 → 4 and the felt kick 0.4/0.32 → 0.3/0.24 brought it to 9.4. "words" (5.2 LU) is the wordless b6 beat, where the bed carries the shot by design.

**The voice post** (`VOICE_RIDES`, ig5's method). The reel's loudest 400 ms windows were all the dry hook (no bed until f120). master() re-trims every ridden line to −20, so the heard reduction is about half the nominal one.

| Take | Rides (line frames, nominal dB) |
|---|---|
| `ig6-01` | "One ring," [0, 24] −4 · "six" [25, 40] −5 · "seconds." [41, 60] −3 |
| `ig6-01b` | [0, 25] −5 · [26, 36] −8 · [37, 58] −5.5 · "can't" [72, 80] −2.5 |
| `ig6-03` | "A missed call" [3, 33] −1.5 · "is someone" [34, 50] −2.5 |

The dialogue limiter's largest reduction is 6.4 dB on `ig6-01` (3.6 dB unridden) and 5.6 dB on `ig6-01b`, the same as unridden. ig2 delivered at 6.0 dB and ig5 at 5.3 dB. A ride on "Your" did not lower it and cost 0.1 LU of climax, so it was not kept.

**Measured, not guessed.** The cues were placed and levelled from the picture's moments in `M` and `stage/clock.ts` (steps, `LAPSE`, `AGENT_DOMES`, `DAY_DOMES`, `DOME_T`, `EXIT`), then checked on the built stems: per-cue peak against the bed and voice at the hit, per-section balance, momentary-loudness profiles, and timeline plots of all four stems with every cue, word and picture moment marked (`timeline-A.png`, `timeline-B.png`). SCRIPT §6's drop rule ("a clock sound check-mix flags inside a word's first 200 ms is dropped") was applied by measurement. No clock sound or dome was flagged in either cast, so `DROP` is empty and all 9 steps, 9 jumps and 8 domes sound. Cast B's f120 tock lands on "While" (f120.1) and still scores SII 1.00.

### 9.3 check-mix (`npm run check:audio:ig6`): **OK, both cuts**

Cast A is the committed state (`CAST = 'A'`, stamp `ede25bf0cd174fff`). Cast B was built and checked with `CAST = 'B'` on the same final code (stamp `8933bd4a5498c13c`). `timing.ts` was then restored byte-identical (`cmp`) and the A mix rebuilt.

| Test | Target | Cut A (receptionist) | Cut B (owner-operator) |
|---|---|---|---|
| Stamp current | `ig6Hash` = mix.json | `ede25bf0cd174fff` | `8933bd4a5498c13c` |
| Integrated loudness | −14 ± 1 LUFS | −14.0 | −14.0 |
| True peak | ≤ −1.0 dBTP | −1.65 | −1.65 |
| Master gain / limiter | (info) | +6.7 dB / 3.9 dB | +6.8 dB / 4.0 dB |
| Effects files | ≤ −12 dBFS | −12.0 | −12.0 |
| Bed | ≤ −20 dBFS | −20.0 | −20.0 |
| Dialogue files | −23 ± 0.5 LUFS | ± 0.00 | ± 0.00 |
| Dialogue stem, per line | −20 ± 0.5 LUFS | −20.5 … −19.7 (spread 0.7) | −20.5 … −19.7 (spread 0.7) |
| **Climax** | impact ≥ loudest dialogue + 1 LU | **+1.5 LU** (−8.8 vs −10.2, `ig6-01` @13) | **+1.3 LU** (−8.7 vs −10.1, `ig6-01b` @14) |
| Build → impact | ≥ 3 LU | −14.4 → −8.8 (5.6) | −14.3 → −8.7 (5.6) |
| End tail | last 100 ms ≤ −55, last frame ≤ −60 dBFS | −74.7 / −84.2 | −74.6 / −84.1 |
| Chord rings 10–5 f from the end | ≥ −55 dBFS | −51.5 | −51.4 |
| Arc | converge ≥ day sweep + 0.5 LU | −11.0 vs −13.1: **+2.1** | −10.9 vs −13.0: **+2.1** |
| **Word masking** | every word SII ≥ 0.7 | 45 words, mean 0.97, lowest "six" **0.79**, "is" 0.84, "someone's" 0.84 | 44 words, mean 0.97, lowest "is" **0.84**, "someone's" 0.84 |
| The name | ≥ 0.9 | 0.95 / 1.00 / 0.99 | 0.95 / 1.00 / 0.99 |
| Key-hit allowances used | (0.55 floor) | none | none |

PIPELINE §5.3 says "dialogue −18.5". The series' `IG_LOUD` (`common/series.ts`) keeps the films' −20 in the dialogue stem and reaches −14 LUFS with the master gain. check-mix tests `MIX.dialogueLufs` = −20, as it did for ig1–ig5.

### 9.4 Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit -p .` | PASS |
| `npm run sfx:ig6`, then `check:audio:ig6` | OK, cut A and cut B (§9.3) |
| `npm run sfx:ig` | skipped ×4 (`49b90ae4…`, `757d177d…`, `47ae5cf3…`, `f4500c7a…`), 0 built |
| `npm run sfx:ig5` | skipped (`19ca5ef2038155ea`) |
| `npm run sfx:ig6` (re-run) | skipped (`ede25bf0cd174fff`) |
| `guard:ig6 -- --check` (full) | **gates 1–5 PASS**: 1747/1747 shas, 19 delivered prefixes, the five stamps (ig5 `19ca5ef2038155ea`), compositions +12 IG6 rows, **gate P 30/30 byte-identical**. **Gate 6 FAILS on `src/ig/ig6/timing.ts` alone**: the known gate 6 issue (§6 note); the file is ig6's own and was committed in `8c14085`. The new `scripts/ig6/bed.mjs` and `docs/ig/ig6/BUILD.md` pass gate 6 as new ig6 paths. After the last ride edit, `--check --fast` was re-run with the same result (1–3 PASS, 6 the same single line). |
| `git status` on the film 1/2 frozen sets, `scripts/ig`, `scripts/ig5`, `src/ig/ig1…ig5`, `src/ig/common`, `src/ig/components` | empty |
| Picture | `timing.ts`'s picture exports unchanged (dump sha256 `ec89fb39…` before and after); no picture module touched |

To clear gate 6, the orchestrator either commits `timing.ts` or widens gate 6 to ig6's own prefixes (§6 note). Widening the guard is outside this step's file list and was not attempted.

### 9.5 For the master passes (PIPELINE §6.4)

- **A pass:** as committed (`CAST = 'A'`). `sfx:ig6` skips; the mix is current.
- **B pass:** set `CAST = 'B'`. `sfx:ig6` rebuilds the B mix measured in §9.3 (`8933bd4a5498c13c`), and `check:audio:ig6` should print the B column. The `ig6-01b` rides already sit in `VOICE_RIDES`, and nothing else changes.
- **Not done here:** the delivery-side check (`check:delivery`, ≤ −1 dBTP decoded from the AAC). It needs the encode. The frame-0 trill is HEAD −4 dB and the `slam` is −6 dB, ig5's two AAC lessons.
- **For a listening critic:**
  - whether the 2 s ringing under "One ring, six seconds." reads as one continuous ring (in the stems its f12 and f24 trills peak 9–13 dB below her RMS, and it all but disappears under "six");
  - the level of the time-lapse ticks under her line (−15 dB cues; in the stems they peak around −30 dBFS against her −22 to −27 dBFS RMS);
  - the hook's sub on "can't answer." (a 2.2 s 34 Hz tail into the bed's entry).

### 9.6 QA output (`out/ig/qa/ig6/sound/`)

| What | Where |
|---|---|
| check-mix | `check-audio-A.txt`, `check-audio-B.txt` (with per-word SII of the hook); first round `check-audio-*-r1.txt` |
| Builds | `sfx-ig6-A.txt`, `sfx-ig6-B.txt` |
| Cue timelines | `cue-timeline-A.txt`, `cue-timeline-B.txt` (every cue and word, in order) |
| Plots | `timeline-A.png`, `timeline-B.png` (the four stems, cues, words, picture moments; `-r1` = the first round) |
| Climax windows | `climax-A.txt`, `climax-B.txt` (the loudest dialogue windows against the impact) |
| Balance | `balance-A.txt`, `balance-B.txt` (per-section stems) |
| Gates | `guard-check-final.txt` (full), `guard-check-fast-final.txt`, `sfx-skips.txt`, `git-frozen.txt`, `tsc.txt`, `stamp-A.txt`, `stamp-B.txt` |
| Scripts | `scripts/` (`env.mjs` + `plot.py`, `loud.mjs`, `stems.mjs`, `prof.mjs`, `bedprof.mjs`, `picdump.mjs`) |
