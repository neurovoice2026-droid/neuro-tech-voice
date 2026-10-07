# ig5 · "Three rings" (SCRIPT)

Label `synth`. Written 2026-10-07 on `claude/remotion-trailer` (HEAD `1c286f4`). Planning only: no code, no voice, nothing outside `docs/ig/ig5/` touched, nothing committed, no Cartesia call.

**Hook swap (label `hook-swap`, 2026-10-07, HEAD `8f62e3d`).** The TikTok hook tournament (`HOOKS.md`) picked "Three rings. / Gloves on. / You can't." (panel 34.9 against the incumbent's 26.9). This file now carries it: b1 is HOOKS §1.2–1.3, b2 is `ig5-02g` (HOOKS §1.6), the cover is HOOKS §1.8. Beats 3–9 are unchanged except where they named the old hook (the b4 pile's hedges, the light's x, the b9 seam). The incumbent "Don't pay $300 a month for an AI receptionist." is kept, installed and documented, as the A/B reserve (§4.5). The measured timeline with the installed takes is §5.4.

| | |
|---|---|
| **Title** | Three rings (`TITLE` in `timing.ts`; until the hook swap: "Don't pay $300", now the reserve, §4.5) |
| **Slug** | `dont-pay-300` → `outName` `neurotechvoice-ig5-dont-pay-300` (PIPELINE §2.1); kept through the hook swap to spare the pipeline renames (HOOKS §1.7) |
| **Length** | **28.0 s = 840 timeline frames at 30 fps** (14 bars at 120 BPM; 3360 render frames at 120 fps). Impact **f780** (bar 14 line, 26.0 s). END **f840**. |
| **Platforms** | TikTok first, then Instagram. One render, one combined safe zone (§1). Upload the 60 fps copy to both (POSTING §1). |
| **Companions** | `voice-lines-draft.json` (every line before the hook swap, same shape as `scripts/voice-lines-ig.json`; the live list, with the hook-swap lines, is `scripts/ig5/voice-lines-ig5.json`), `POSTING.md` (captions, comments, DM, launch gate, slot), `PIPELINE.md` (build), `RESEARCH-{prices,product,format}.md`, `drafts/` (three drafts, two judges). |

**The reel in one breath.** A rose light on a desk is ringing, three rings already spreading from it. "Three rings. Gloves on. You can't." The music comes in with the first quote: a slip rises, "Agency AI receptionist: $300 a month, a common retainer", and a setup fee, often $1,500, is stapled on. A second quote: a live answering service, from $99 a month, for 50 minutes. On "Ours?" the light that has rung since frame 0 is picked up and becomes the teal orb, and a third slip rises: from $49 a month, no setup fee, with every price still on screen and drawn to scale. You set it up yourself. It picks up when you can't (the hook, answered) and books the appointment. Comment AGENT.

---

## 0. Decisions

### 0.1 What was chosen, and from where

| Part | Source | Why |
|---|---|---|
| **Base: draft A "Don't pay $300"** | both judges (growth 7.8 vs 6.8 / 6.2; truth+production 15.5 vs 15 / 12) | The comparison the owner asked for (two categories that charge several hundred, against $49), the hook that rhymes with ig1 (the TikTok winner, 563 views), every figure hedged in the spoken line, and the best muted/screenshot frame. |
| **G1 (from B): "You set it up yourself, in under ten minutes."** replaces A's spoken "Plus the number: $1.15 a month." | growth judge | It is the reference reel's "so I built my own", told truthfully (S19, `lib/pages/ai-agents.ts:40`). It states the basis of the comparison out loud (an agency builds and runs it; ours is self-serve), which ASA asks for, and it answers "is it hard?" right before the booking demo and the CTA. It also replaces A's one static beat. |
| **"From $49 a month"** on screen and spoken (new in this synthesis) | RESEARCH-prices line #1, RESEARCH-product S1, the site's own menu (`lib/site.ts:2290` "Plans from $${monthly} a month") | With the spoken $1.15 moved to the captions and pinned comments, "from" keeps the $49 qualified on screen: the agent's number ($1.15/mo), VAT and minutes past the allowance sit on top of the plan fee. The truth judge passed draft C on exactly "from + caption". Costs one word (budgeted in §5). |
| **G2 (from C): the ringing phone is picked up on "Ours?"** | growth judge | A 12-second open loop (a phone nobody answers), closed on the word that lands the price. The orb is born once, here, and never again. |
| **G3 (from B and C): a blank quote slip on the desk** | growth judge | An object with an empty price slot reads before a word does. **Since the hook swap** it rises at `LINE.agency − 6` (b1), and beat 2's "$300" rolls into its slot; frame 0 is the ringing light alone. |
| **Truth fixes** (all applied) | truth+production judge §5 | Caption basis line, selection disclosure ("we didn't compare self-serve AI receptionist apps"), "(in beta)", trial "doesn't book", cover attribution line, setup numeral ≥ 120 px at the payoff, valid sound names, `MUSIC.stop` from the measured onset, trims that never cut a hedge, and the ZoneGuard per-reel zones (§1.3, a BLOCKER for QA). |
| **Captions, comments, DM** | both judges (G4-G6 + truth §5.3) | POSTING.md. |
| **Hook swap: "Three rings. Gloves on. You can't." + beat 2 `ig5-02g`** (2026-10-07) | the TikTok hook tournament, `HOOKS.md` §0-§1 (16 hooks, 6 personas, truth pass) | Panel 34.92 against the incumbent's 26.92; stop power 7.5 against 5.83; 4 of 6 personas' best, none's worst. Frame 0 reads on its own (a phone you can't reach) with no claim in it, and beat 2 scopes the first price to *agency* builds from its first word. It costs the keyword and the first price: "AI receptionist" on screen at 3.07 s, "$300" heard at 5.9 s (§5.4). G3's blank slip now rises with the agency line (b1), not at frame 0. The incumbent stays installed as the reserve (§4.5). |

### 0.2 Rejected, with the reason

| Idea | From | Why not |
|---|---|---|
| Spoken "Plus the number: $1.15 a month." | A | It cannot fit with G1 inside 28 s (72 words). The $1.15 stays in both captions, both pinned comments (the TikTok one is read first) and the DM; "from" carries the hedge on screen. Kept as a spare take `ig5-05-num` if the owner prefers it. |
| B's step chips "Company · Tone · Voice · Go live" | B / growth G1 | Four unspoken words that make a product claim (truth judge). The picture keeps the four events as **unlabelled** dots that fill teal. |
| A strike-through on any price | brief for C | Reads as "was $300, now $49", a former-price claim we cannot make (FTC 16 CFR 233.1). Quotes step back and stay legible. |
| A total rule under the agency quote | B | Invites adding a monthly fee to a one-time fee, then shows no total. |
| "Evening shift: $18 an hour" / "Under three hours of that shift" | C | Puts a person's pay against $49: the one comparison ig1 refuses to make. No wage anywhere in ig5. |
| "You're paying $300 …?" hook | B | Presumes the viewer pays it; spoken form scores 54.8 OK. |
| "At agencies, that's the low end." | B | One source starts at $150, so it can be disputed; "a common agency retainer" is the source's own wording. |
| Trims that drop "Live", or make the fine print unspoken | A | "Live" is the only people label on the answering quote; every on-screen line must be spoken. |

### 0.3 Series rules kept (docs/ig/SCRIPT.md §0.3)

- **Tessa only** (`ava` = Tessa (Emotive) `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`, speed 1.05). She speaks every on-screen line; captions are word-synced through the IG Captions fork; each card rises as a unit 2 f ahead of its first word at 72 % ink and each word lifts to 100 % on its onset.
- **≤ 6 words per card** (this reel's rule). Every card is listed as a word span in §4.
- **Chrome is not a line:** ≤ 32 px, no claim, the dashboard's own strings, each on or after the spoken word it belongs to.
- **Colour:** rose = the expensive anchors and the ringing phone; graphite = people; teal = ours; the app's own pill colours (Answered blue, Booked emerald, Message taken indigo).
- **Motion:** pure functions of `t`; reveals rise out of masks; no blur, glow or bokeh; one moving text at a time; springs and eases from `lib/motion`; typographic apostrophes. No people, no handset: the phone is the rose line light and its trill.
- **Grid:** 120 BPM, bar = 60 f, beat = 15 f, 16th = 3.75 f. The impact lands on the bar line one bar before the end. `src/ig/ig5/timing.ts` re-anchors every line on the measured takes (`place` / `upBeat`, 6 f gap, snap to the next 16th), as ig1-ig4 did. Act boundaries, IMPACT and END stay on their bars.
- **The shared end card** `IgEnd`, unchanged (§8).
- **Series coherence with ig1** ("Don't fire your receptionist for an AI. Not even ours."): the hook keeps its desk hairline with the rose phone light (the incumbent reserve also kept its "Don't …" shape); "Gloves on" is the work only people can do (voice.md position 5) and b6's "It picks up when you can't" answers it; the comparison is between ways of paying for phone cover, never against a person's wage; nothing says "replace" or "fire"; the IG caption carries ig1's line "Keep your front desk for the work only people can do."

---

## 1. Safe zone: TikTok + Instagram combined

### 1.1 What it is built against

| Platform | Overlay | Source (read in the draft stage, 2026-10-07) |
|---|---|---|
| TikTok, organic | right action rail ≈ 120-242 px from the right edge over the lower two thirds; caption / username / sound block ≈ bottom 320-480 px; header ≈ top 108-240 px | Reap (Sept 2026) https://reap.video/blog/short-form-video-safe-zones · TryMyPost (Feb 2026) https://www.trymypost.com/blog/tiktok-ad-specs-2026-safe-zones |
| TikTok, in-feed ads (stricter) | 720×1280 template scaled to 1080×1920: top 240, bottom 660 (text above y 1260), sides 120, a 180 px action column from y 840 | AdKit https://adkit.so/tools/safe-zones/tiktok, scaled from https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads |
| Instagram (series `ZONES`) | top 240; bottom 1520; rail x > 906 at y 900-1650; 3:4 grid crop y 240-1680 | `src/ig/common/zones.ts` |

### 1.2 The ig5 rule (tighter than the brief's x 60-940, y 220-1440)

| Rule | Value |
|---|---|
| **All text** | x 86-900, y 240-1400 |
| **Every price numeral** | y 300-1260 (clears even the TikTok ad guide's bottom block) |
| **Objects (slips, record, orb, desk hairline)** | x ≤ 880 anywhere below y 840 (TikTok's rail starts higher than Instagram's) |
| **Top UI, 0-239** | mesh only |
| **Label band, 240-330** | the parked price chip (b6-b8) |
| **Stage, 340-1130** | slips, desk hairline at y 1130, ours, call record |
| **Caption band, 1170-1400** | narration cards, left at x 86, max width 814 (to x 900) |
| **Below 1400** | mesh only |
| **The one exception** | the shared `IgEnd` comment field (x 174-906, y 940-1060), built once for ig1-ig4; still ≈ 40 px clear of TikTok's icons. Leave it. |
| **End-card CTA caption** | must measure ≤ 720 px wide so it ends by x 900 (centred at x 540; `END.cta.maxWidth` is 780). If wider, pass a narrower `ctaPlace`. |
| **Cover** | words in x 86-900, y 260-1380 (inside both apps' 3:4 grid tile; the "$49" above y 1300, clear of TikTok's grid view count) |
| **If ever run as a TikTok ad** | move the text's left edge to x ≥ 120 and scale the stage × .95 about x 120 |

### 1.3 Build requirement: the zone guard (BLOCKER for QA, truth judge §3.4)

`ZoneRect` in `src/ig/components/ZoneGuard.tsx:15-29` checks every rect against `zoneFaults()` from `src/ig/common/zones.ts`, which are Instagram's bands (bottom 1520, rail from y 900, x 906). `common/` is an `igHash` input, so it cannot change, and there is no way today to pass ig5's constants: `check-zones --film=ig5` would PASS a caption at y 1480 that TikTok's caption block covers.

**Fix (before any ig5 scene work is zone-checked):**
1. Add an optional `faults` (or `zones`) field to `ZoneState`, set by ig5's Reel and Cover through the existing `ZoneProvider`; `ZoneOverlay` draws the matching bands.
2. ig5's rule lives in `src/ig/ig5/zones.ts` (the §1.2 values), never in `common/`.
3. Add `src/ig/components/ZoneGuard.tsx` to PIPELINE §7.1's allowed `git diff` list. `components/` is not an `igHash` input, so ig1-ig4 stay CURRENT; gate P (stills byte-identical) proves the picture.

---

## 2. Beat table

Frames are 30 fps timeline **targets** at a planned 2.7 tokens/s; `timing.ts` re-anchors them to the measured takes (§5). Card text shows the `display` form (numerals over spoken words, §4.2). "Card" = a narration caption in the caption band unless the row says the words print on an object.

**Acts (`SCENES`), as placed with the installed takes (hook swap, §5.4):** `hook` 0-86 · `agency` 86-283 · `answering` 283-422 · `ours` 422-530 · `setup` 530-578 · `does` 578-686 · `end` 686-840. (The plan before the swap: `hook` 0-122 · `agency` 122-231 · `answering` 231-350 · `ours` 350-462 · `setup` 462-571 · `does` 571-690 · `end` 690-840. b3-b9 below keep their plan frames; the placed ones are in §5.4.)

| Beat · frames · s | Picture | On-screen text (≤ 6 words per card) | Line (id @ frame) | Sound |
|---|---|---|---|---|
| **b1 Hook** · 0-86 · 0.0-2.9 (placed; HOOKS §1.2-1.3) | **Frame 0 must read as a scene before a word is spoken.**<br>**Ground:** pearl `PearlGround` (`MUTED_MESH`, light), warm key low-left, already drifting at f0 (the seam and b2-b4 stay on it).<br>**Desk (ig1 callback):** a 1.5 px graphite hairline at y 1130 drawing x 86 → **758** (`EASE.draw`, from f −6: still moving at f0, done ≈ f8).<br>**The phone:** the rose line light (`MeshOrb` Ø 18, `MOMENT_LIGHTS.rush`) at **(740, 1130)** (one constant, `PHONE`; moved from x 862 so the rings clear TikTok's rail: at 862 the outer ring would reach x 994).<br>**The ring trio (the frame-0 image):** three concentric rose hairlines already in flight at f0, Ø 72 / 156 / 240 about the light (x 620-860, y 1010-1250); strokes 3 / 2.25 / 1.5 px and ink 85 / 60 / 35 %, inner to outer (the newest is the brightest). New part: a 3-ring variant of `Rings` (`src/ig/components/Orb.tsx`) with a **linear** fade and a 60 f life (the kit's quadratic fade leaves an older ring at ≈ 6 % ink), virtual launches at f −40 / −20 / 0, a pure function of t. They travel out and thin: the outer is gone by f20, the middle by f40, the inner by f60.<br>**S1 at f0** (72 % ink, flush left at x 86, ≤ ≈ 650 px wide, headline role at **104 px**): "**Three** rings." (y 400-504; "Three" in rose, the ringing phone's colour) / "Gloves on." (y 528-632) / "You can't." (y 656-760, typographic apostrophe); graphite. Words lift 72 → 100 % on her onsets (4 f, `EASE.out3`). Nothing else on screen: no slip, no orb, no chrome, no price.<br>**R1:** one more `RingPulse` (the desk law, Ø 18 → 240) at `ringBefore(vWord(hook, 2))` only if no onset falls in (R1 − 6, R1 + 10); otherwise in the "on." → "You" gap under the same test; otherwise none. Never on or right after "can't" (it would mask the t). With the installed take R1 = **f30** passes the test.<br>**Exit:** S1 leaves up through its masks line by line, 2 f apart, 4 f each (`EASE.in`), from `vWord(hook, 5) + 6` (f80; gone by f88).<br>**Slip 1 rises at `LINE.agency − 6`** (f88; G3, moved here from f0): white `DocPage`, perforated top, −1°, x 120-880, y 360-640, `meshElevation` 2, `SPRING.site`; one graphite ink bar (35 % ink) where the tag will write (y 385-420) and an empty amount slot (1.5 px hairline rounded rectangle, 30 % graphite, x 160-760, y 440-600). | S1 [0-5] **"Three rings." / "Gloves on." / "You can't."** (one card, three lines, set at f0) | `ig5-01g` @9 (cast rule: `ig5-01g2` only if it put S2 up earlier; it never does, §5.4) | **`fx-trill` at f0** (the third ring) over `fx-roomtone-desk`; it rings out by f10 (`RING_OUT`) and her first word starts on f10 (`afterRing`). **No bed** under the hook: a phone ringing in a quiet room. R1: `fx-trill` at −8 dB. "can't" keeps its released t audible (no ring on or after it). `fx-paper-square` as slip 1 rises. |
| **b2 Agency** · 86-283 · 2.9-9.4 (placed; HOOKS §1.6) | **S2 "Agency AI receptionist:" rises at f92** (`LINE.agency + vWord(0) − 2`) in the caption band (y 1170-1270), only after S1 has left (one moving text at a time).<br>**Slip 1 is the agency quote.** On words 0-2 its ink bar sweeps into the tag **AGENCY AI RECEPTIONIST** (label 30, graphite 70 %, `InkSweep`, y 385-420).<br>**Figure row** (slot y 440-600): "**$300**" (140 px, rose, tabular) rolls 0 → 300 on "three hundred" (`Roll`, 32nd ticks, ≈ 0.6 s, settles on `SPRING.land`, a `thump`). To its right a column at x 510-860: "a month," (44, y 500-544) and "a common retainer" (36, graphite 70 %, y 552-590) on its words. **With trim T1 placed** (`ig5-02gt`, the installed cast): the column reads "a month" (44) over "commonly" (36, graphite 70 %, y 552-590), "commonly" printing on its own word (before the roll): object text is only ever words she says.<br>**To-scale hairline:** from $0 at x 160 to x 760 (2 px per dollar, `EASE.draw`, y 615).<br>**On "Setup":** a smaller **stub** (white paper, x 360-880, y 600-770, +3°) drops with weight onto slip 1's lower right edge and is stapled there, overlapping only slip 1's bottom margin. It reads **SETUP, OFTEN** (label 30) over "**$1,500**" (140 px, rose, tabular), which rolls 0 → 1,500 on "fifteen hundred" (`Roll`, ≈ 0.6 s, `SPRING.land`). The stub gets **no** hairline: a one-time fee never sits on the monthly scale.<br>**One more ring** of the still-unanswered light (G2) in a gap of the line, re-anchored off her onsets (series rule: never on an onset; the plan's f150). | S2 [0-2] **"Agency AI receptionist:"**<br>S3 [3-9] **"$300 a month, a common retainer."** (T1: [3-7] **"commonly $300 a month."**)<br>S4 [10-13] **"Setup, often $1,500."** (T1: [8-11]) | `ig5-02gt` @94 (T1, placed by the trim ladder); full `ig5-02g` | **The bed enters** on the first beat at or after her word 0 (`MUSIC.bedFrom`, f105; the stub arrangement in E at −6 dB under her): the reel's first music. `fx-felttip-short` on the tag; `thump` on "three hundred" with `fx-tick` 32nds under the roll and `fx-tock` as it settles; `fx-trill` ducked −8 dB in a gap; `thump` + `fx-tag` (the staple click) as the stub lands; `fx-tick` / `fx-tock` under the setup roll. |
| **b3 Answering** · 231-350 · 7.7-11.7 | **Slip 2 rises** out of its mask at x 120-880, y 800-1110, +0.8°, overlapping no figure. A 6 px graphite edge stripe on its left marks **people**.<br>Its tag **LIVE ANSWERING SERVICE** (label 30) writes on words 0-2. Then the figure row: "from" (44) + "**$99**" (140, rose, rolls 0 → 99 on "ninety-nine") + "a month," (44). The second row "for **50** minutes" (44, tabular "50") writes on its words. Its hairline draws to 198 px (x 160-358).<br>**Camera:** eases back 1.00 → .97 about (540, 740) over 1 s, so the pile reads as one object.<br>**f285:** the rose light rings once more, unanswered. | S5 [0-2] **"Live answering service:"**<br>S6 [3-6] **"from $99 a month,"**<br>S7 [7-9] **"for 50 minutes."** | `ig5-03` @233 | `fx-paper-square` as slip 2 lands; `fx-tick` roll under "$99"; `fx-tock` on "fifty"; a soft `swish` on the camera; `fx-trill` at f285, ducked −8 dB. |
| **b4 Ours: the payoff** · 350-462 · 11.7-15.4 | **The pickup (G2).** The bed stops on the sample just before "Ours?" (stop-time). In the silence `fx-pickup` cuts the ring and the rose light **springs open into the teal orb** (film 2's birth: 3-frame seed, `SPRING.pop` 0 → 1.06 → 1, `mixPalette` rush → sunday over 6 f); the desk hairline undraws right to left behind it (0.4 s).<br>**The square-up, on "Ours?":** slip 1, its stub and slip 2 slide up and together into a neat pile at y 340-900 (× .88 about x 160 so every $0 point stays at x 160; rotation → 0; ink 55 %; the SlipStack collapse idiom). Every figure and hedge stays legible: $300, $1,500 and $99 at 140 × .88 ≈ **123 px**; "AGENCY AI RECEPTIONIST", "a common retainer" (T1: "commonly"), "SETUP, OFTEN", "LIVE ANSWERING SERVICE", "from … a month, for 50 minutes" all visible (HOOKS §1.6). Nothing is struck and no total is drawn.<br>**Ours** rises out of its mask at x 120-880, y 930-1250: white paper, a 2 px teal edge, lifted 8 px on `meshElevation` (or film 1's `ContactShadow`, untested in the reels: test it first). The card rises as a unit on "Ours?" at 72 %: "Ours?" (title 52, graphite) + "From" (44), then "**$49**" (display 200, **teal, still: it never rolls**) + "a month" (56). Words lift on her onsets, so "$49" is **seen** at ≈ 11.8 s (42 %) and **heard** at ≈ 12.9 s.<br>**f356-370:** the orb glides (0.45 s, `EASE.inOut`) from (740, 1130) to its place as the **full stop** after "a month" (Ø 44, breathing), as in ig1's "Not even ours●".<br>**Hairlines on one scale:** ours' hairline draws at the pile's scale (1.76 px per dollar): **$49 = 86 px** under $99 = 174 px and $300 = 528 px, all from x 160.<br>**On "No setup fee":** a teal row "No setup fee." (44) prints at ours' upper right (right-aligned to x 860), in the same column as the setup stub above, so "Setup, often $1,500" and "No setup fee." read as a pair.<br>**Ground:** a sunday pool rises behind ours (`MOMENT_LIGHTS.sunday`, mix 0 → .3 over 1 s).<br>**This is the screenshot frame and the cover source (≈ f455).** | S8 [0-5] **"Ours? From $49 a month."** (prints on ours)<br>S9 [6-8] **"No setup fee."** (prints on ours)<br>(caption band empty) | `ig5-04` @352 | **Stop-time:** `MUSIC.stop = [vWord('ig5-04', 0) − 4, vWord('ig5-04', 2))`, from the **measured** onsets (word 2 = "forty-nine"), never from plan frames; `fx-roomtone-desk` holds the floor. `fx-pickup` at `vWord('ig5-04', 0) − 2`; `fx-seed` + `fx-ting` for the birth. On "forty-nine": the bed returns with the pad an octave up, `ping` + `chime-sunday-soft` + `fx-mallet-e5` ("true"). `land` on ours' lift; `fx-tag` on "No setup fee". |
| **b5 Setup** · 462-571 · 15.4-19.0 | **On "You":** the pile exits up through its mask (6 f; the comparison has done its job) and ours glides up into the cleared stage, y 420-740 (`SPRING.site`, ≈ 0.5 s); ours' hairline undraws with the pile (nothing left to compare it to). Ours keeps "Ours? From $49 a month●" and "No setup fee."<br>**On "set it up":** a 2 px graphite track draws under ours (x 200-680, y 820) with **four empty dots** (Ø 24, no labels: the site's four setup screens, shown, not named).<br>**From "yourself":** the dots fill teal one per 16th.<br>**On "minutes":** the fourth dot turns into a drawn teal `CheckMark`. Four visual events in 3 s; nothing static for more than a beat. | S10 [0-4] **"You set it up yourself,"**<br>S11 [5-8] **"in under ten minutes."** | `ig5-05` @465 | `whoosh-soft` on the pile's exit; `fx-pluck-e5` → `fx-pluck-fs5` → `fx-pluck-gs5` → `fx-pluck-b5`, one per dot; `fx-ting` on the check. |
| **b6 Does** · 571-690 · 19.0-23.0 | **On "It":** ours shrinks into the **parked price chip** in the label band (white pill, x 530-900, y 250-330: "From $49 a month", 40 px teal); it stays there until the impact. The track folds away. The orb leaves ours' full stop and hangs at stage left (x 160, y 560), breathing.<br>**f575:** the **call record** (kit `RecordRow`, white, x 120-880, y 520-880) rises with its header chrome **`SAMPLE CALL`** (label 28) and, at the header's left, a small rose dot ringing (an incoming call).<br>**On "picks up":** the orb glides onto the rose dot and absorbs it (the pickup, one move); it stays docked at the record's top-left as the agent, leaning into its listen palette. The `OutcomePill` **Answered** (blue) lands at the header's right.<br>**Then:** the ToolRow "Checked your availability" (30 px) spins and resolves to a drawn `CheckMark`.<br>**On "books":** the ToolRow "Booked an appointment" ticks, and the pill swaps Answered → **Booked** (emerald, `OUTCOME_META.booked`) with `Swap`. No calendar brand, no logo, no PRO chip. A 24 px `BETA` chip beside the pill only if the dashboard still badges booking as beta at launch.<br>**No-booking cut (`ig5-06-msg`):** the ToolRow is "Took a message", the pill turns **Message taken** (indigo), and there is no availability row. | S12 [0-5] **"It picks up when you can't,"**<br>S13 [6-9] **"and books the appointment."** | `ig5-06` @574 | `tap` as the chip parks; `fx-paper-lift` under the record; `fx-trill-1` (ducked) on the rose dot; `fx-pickup` + `fx-ting` on the pickup; a quiet `fx-tick` roll under the spinner and `fx-ting` on its check; `fx-mallet-e5` + `pop` on "books". A light kick enters on beats 1 and 3 from f571. |
| **b7 CTA** · 690-780 · 23.0-26.0 (82 %) | The shared **`IgEnd`**: the record steps back (× .92, shade .08); the price chip stays in the label band. The CTA caption is centred at y 700-860 (≤ 720 px wide). The white comment field (x 174-906, y 940-1060) rises at **f688**, before she says "Comment", so muted viewers get the instruction. **AGENT** types one letter per 16th from `vWord('ig5-07', 1)`. The send disc presses (.97) as "link" ends (≈ f744). | S14 [0-4] **"Comment AGENT for the link."** | `ig5-07` @694 | The series end stack: `fx-menu-open` on the field, `fx-keys` per letter, the half-bar snare roll from f750, the riser crest. |
| **b8 Brand** · 780-826 · 26.0-27.5 | **Impact on the bar line (END − 60):** the field and the chip leave up through their masks (4 f); `LightGL` blooms with one teal emitter; the **NEUROVOICE** wordmark surfaces centre-out at y 760-900; `neurotechvoice.com` (Geist Mono 44, y ≈ 1000) types on "Neuro \| Tech \| Voice". | wordmark + URL | `ig1-07` @784 (borrow) | Impact (`fx-impact-end` via `impactHits`) + `sub` + E `chord` at f780; the name into its ring. |
| **b9 Seam** · 826-840 · 27.5-28.0 | The wordmark leaves up and the record drains away. Frame 0 re-forms mid-motion: the desk hairline redraws at y 1130 (x 86 → 758); if the orb is on screen it shrinks into the rose light at (740, 1130) (`mixPalette` sunday → rush), otherwise the light simply re-forms; the ring trio's virtual launches (f −40 / −20 / 0 of the next pass) are already travelling, so the replay starts mid-ring; S1 "Three rings. / Gloves on. / You can't." sets at 72 % by f839. No slip (it rises with the agency line). | (S1 at 72 %) | none | `MIX.fadeOut` [826, 840] to < −60 dBFS on the last frame. The replay's first sound is f0's trill. |

**Muted read (sound off, frame by frame):** a light on a desk with three rings coming off it and "Three rings. / Gloves on. / You can't." (a phone you can't reach, read in under a second) → a quote slip rises: "AGENCY AI RECEPTIONIST $300 a month, a common retainer" (T1: "commonly") with "SETUP, OFTEN $1,500" stapled on → "LIVE ANSWERING SERVICE from $99 a month, for 50 minutes" → the light turns teal and "Ours? From $49 a month● No setup fee." rises under the three, bars to scale → four dots fill → a sample call turns Answered → Booked → the comment field types AGENT.

**Retention:** a visual event every 0.7-1.5 s before the CTA (word lifts, the ring trio at f0, R1 in a hook gap, a ring in each quote line, S1's exit, slip 1 rising, the tag, the hairline draws, the staple, two rolls, the camera, the pickup, the square-up, the orb glide, the four dots, the chip, the pickup on the record, the spinner, the pill swap). No beat holds still longer than 1.5 s.

---

## 3. Layout and object specs (for `src/ig/ig5/`)

| Object | Geometry (1080×1920) | Type and colour | Notes |
|---|---|---|---|
| Desk hairline + rose light | y 1130, x 86 → 758; light Ø 18 at **x 740** (`PHONE`, HOOKS §1.2) | graphite 1.5 px; light `MOMENT_LIGHTS.rush` | ig1's `DESK` grammar (ig1 used y 760; ig5 sits it under the papers). Rings: the frame-0 trio, R1 in a hook gap, then one ducked burst in each quote line (re-anchored off the onsets) until the pickup. |
| Ring trio (frame 0) | Ø 72 / 156 / 240 about (740, 1130): x 620-860, y 1010-1250 | rose hairlines 3 / 2.25 / 1.5 px, ink 85 / 60 / 35 % | 3-ring `Rings` variant, linear fade, 60 f life, launches f −40 / −20 / 0 (HOOKS §1.2). |
| Slip 1 (agency) | x 120-880, y 360-640, −1° until the square-up | tag AGENCY AI RECEPTIONIST label 30, graphite 70 %; "$300" 140 tabular rose; column x 510-860: "a month," 44 graphite, "a common retainer" (T1 "commonly") 36 graphite 70 %; hairline 2 px per dollar from x 160 | Perforated top edge, `DocPage` paper, `meshElevation` 2. Rises at `LINE.agency − 6` with ink bar + empty slot only. |
| Setup stub | x 360-880, y 600-770, +3° | "SETUP, OFTEN" label 30; "$1,500" 140 tabular rose (≈ 470 px wide) | Stapled over slip 1's bottom margin only; never on the monthly scale. |
| Slip 2 (answering) | x 120-880, y 800-1110, +0.8° | tag label 30; "from" 44; "$99" 140 rose; "a month," 44; "for 50 minutes" 44 | 6 px graphite edge stripe (people). Hairline 198 px. |
| The pile at the payoff | y 340-900, × .88 about x 160, ink 55 %, rotation 0 | anchors ≈ 123 px | Overlaps only blank paper; every hedge legible. |
| Ours | x 120-880, y 930-1250 (b4); y 420-740 (b5) | "Ours?" title 52 graphite; "From" 44; "$49" display 200 teal; "a month" 56; orb Ø 44 full stop; "No setup fee." 44 teal | 2 px teal edge; never rolls; hairline 86 px at the pile's scale in b4. |
| Step track | x 200-680, y 820; four dots Ø 24 | graphite track; teal fill; teal `CheckMark` | No labels. |
| Price chip | x 530-900, y 250-330 | "From $49 a month" 40 teal on white pill | b6 → impact. |
| Call record | x 120-880, y 520-880 | `SAMPLE CALL` label 28; ToolRows 30; `OutcomePill` | Dashboard strings only (`components/calls/call-display.tsx`). |
| Narration cards | caption band y 1170-1400, x 86-900 | caption role (series), graphite; figures in display numerals | b1 S1 is the exception: a headline card (104 px, three lines) in the stage at x 86, y 400-760. |

**To-scale rule.** Every monthly figure gets a hairline at one shared scale from one $0 point (x 160): 2 px per dollar at 1.0, 1.76 px per dollar in the payoff frame. The one-time setup fee never gets a hairline.

**New parts:** `BillPile` (slips, stub, staple, square-up), `Roll` (anchor numerals; precedent `src/ig/ig2/Clock.tsx`), `PriceChip`, `StepDots`, the 3-ring `Rings` variant (b1). Everything else by import: `MeshGround`, `MeshOrb`, `RingPulse`, `DocPage`, `InkSweep`, `SlipStack` idiom, `Panel`, `RecordRow`, `ToolRow`, `CheckMark`, `OutcomePill`, `Swap`, `LightGL`, the Captions fork with `display`, `IgEnd`.

**Bed:** the stub arrangement of `scripts/ig/bed.mjs` (no `ARRANGEMENTS.ig5`), driven by `MUSIC` (`bedFrom` = the first beat at or after the agency line's word 0, f105 with the installed takes: no music under the hook; `stop` per b4, `roll` from 750, `impact` 780, `brand` 784). Write `scripts/ig5/bed.mjs` only if the critic rounds ask for a distinct arrangement (PIPELINE §5.3).

---

## 4. Voice lines

### 4.1 The placed lines (full entries in `scripts/ig5/voice-lines-ig5.json`; `voice-lines-draft.json` is the pre-swap draft and has no `ig5-01g` / `ig5-02g` lines)

| id | `say` (spoken form) | Cards (display form) | Tokens |
|---|---|---|---|
| `ig5-01g` | Three rings. Gloves on. You can't. | "Three rings." / "Gloves on." / "You can't." (one card) | 6 |
| `ig5-02g` | Agency AI receptionist: three hundred a month, a common retainer. Setup, often fifteen hundred. | "Agency AI receptionist:" / "$300 a month, a common retainer." / "Setup, often $1,500." | 14 |
| `ig5-03` | Live answering service: from ninety-nine a month, for fifty minutes. | "Live answering service:" / "from $99 a month," / "for 50 minutes." | 10 |
| `ig5-04` | Ours? From forty-nine dollars a month. No setup fee. | "Ours? From $49 a month." / "No setup fee." | 9 |
| `ig5-05` | You set it up yourself, in under ten minutes. | "You set it up yourself," / "in under ten minutes." | 9 |
| `ig5-06` | It picks up when you can't, and books the appointment. | "It picks up when you can't," / "and books the appointment." | 10 |
| `ig5-07` | Comment AGENT for the link. | "Comment AGENT for the link." | 5 |
| `ig1-07` | Neuro Tech Voice. (borrow, byte for byte) | wordmark + URL | 3 |

63 tokens before the sign-off ("forty-nine" counts as one); 57 as placed with trims T1 + T2 (§5.4). The incumbent pair (`ig5-01` + `ig5-02`, 62 tokens with the rest) is the reserve, §4.5.

### 4.2 Display map and word spans (for `timing.ts`)

- **Display:** `ig5-02g` [3-4] "three hundred" → `$300`, [12-13] "fifteen hundred." → `$1,500.` · `ig5-02gt` [4-5] → `$300`, [10-11] → `$1,500.` · `ig5-01g2` [1] "rings," → `rings.`, [2] "gloves" → `Gloves` · `ig5-01c` [2] "nine?" → `9?` · reserve `ig5-01` [2-3] → `$300`, `ig5-02` [7-8] → `$1,500.` · `ig5-03` [4] "ninety-nine" → `$99`, [8] "fifty" → `50` · `ig5-04` [2-3] "forty-nine dollars" → `$49`. "ten" stays a word (the site's "under ten minutes"); "Three" stays a word.
- **Screens:** S1 `ig5-01g` [0-5] (set at f0; `ig5-01g2` the same) · S2 `ig5-02g` [0-2] · S3 [3-9] · S4 [10-13] (T1 `ig5-02gt`: [0-2] · [3-7] · [8-11]) · S5 `ig5-03` [0-2] · S6 [3-6] · S7 [7-9] · S8 `ig5-04` [0-5] · S9 [6-8] · S10 `ig5-05` [0-4] · S11 [5-8] · S12 `ig5-06` [0-5] · S13 [6-9] · S14 `ig5-07` [0-4]. Most display words on one card: 6 (S3 "$300 a month, a common retainer.", S12).
- **Object text** (subsets of spoken words, each appearing on or after its word): AGENCY AI RECEPTIONIST (`ig5-02g` [0-2]), "a month," / "a common retainer" ([5-9]; T1: "a month" / "commonly"), SETUP, OFTEN ([10-11]; T1 [8-9]), LIVE ANSWERING SERVICE (`ig5-03` [0-2]), the chip "From $49 a month" (`ig5-04` [1-5]).
- **Chrome** (≤ 32 px, the dashboard's own strings, after their word): `SAMPLE CALL`, "Checked your availability", "Booked an appointment" / "Took a message", Answered / Booked / Message taken, `BETA` (only if the app shows it).

### 4.3 Alternates (synthesise in the same batch; swap by changing the VOICES id only)

| id | Text | Use |
|---|---|---|
| `ig5-02gt` | Agency AI receptionist: commonly three hundred a month. Setup, often fifteen hundred. | **Trim T1 of `ig5-02g`** (HOOKS §1.1, −2 tokens): S3 [3-7] "commonly $300 a month."; "commonly" keeps the hedge. **Placed** (§5.4). |
| `ig5-01g2` | Three rings, gloves on. You can't. | **The hook's alternate reading** (two breaths; the cast rule's fallback when `ig5-01g` puts S2 up after f78). Same card. Installed, not placed: Sonic reads it longer, not shorter, in all four sets (§5.4). |
| `ig5-01c` | Closed at nine? Your phone's not. | **Runner-up hook** (HOOKS §2, callout-3; HOOKS names it `ig5-01n`, and its flat second reading `ig5-01n2` was not synthesised) for a later A/B on the same body; card "Closed at 9?" / "Your phone's not." on the night ground (HOOKS §2). Installed. |
| `ig5-02t` | A common agency retainer. Setup, often fifteen hundred. | Reserve: trim T1 of the incumbent `ig5-02` (§4.5). |
| `ig5-05t` | You set it up yourself. | **Trim T2** (−4 tokens, ≈ 1.4 s). One card; the four dots fill faster; "in under ten minutes" stays in both captions. |
| `ig5-06-msg` | It picks up when you can't, and takes a message. | **The no-booking cut** (launch gate fallback): true on Starter today (`take_message`, `lib/voice/session-loader.ts:241`). Same length. |
| `ig5-01b` | Before you pay three hundred a month for an AI receptionist. | Reserve **A/B hook** of the incumbent (hookscore 87.0, §4.5). Cards "Before you pay $300 a month" / "for an AI receptionist." HOOKS §5: the cheapest next test if the winner's 3-second hold on TikTok comes in under ig1's. |
| `ig5-07-bio` | The link's in our bio. | Only if no one can answer AGENT comments (and the IG automation is not live) on posting day. |
| `ig5-05-num` | Plus the number: a dollar fifteen a month. | **Spare, not built by default.** If the owner wants the $1.15 spoken instead of the setup line, swap it for `ig5-05` (b5 then writes "Plus the number: $1.15 a month." as a teal row on ours, with no dots). |

**Trim ladder** (only on measured takes; `timing.ts` picks): full → T1 (`ig5-02gt`) → T1 + T2 (`ig5-02gt` + `ig5-05t`). **Never cut** "common" / "commonly", "often", "from" (either), "for fifty minutes", "a month", "Live", "No setup fee" or "yourself": they are the hedges and the basis. If T1 + T2 still overrun (a pace slower than any delivered IG take set), re-take the long lines before touching anything else.

### 4.4 The hook's cast rule (HOOKS §1.1, `timing.ts` `HOOK`)

1. **The reading:** `ig5-01g` if S2 "Agency AI receptionist:" rises by **f78** (2.6 s, `PLAN.keyword`); otherwise `ig5-01g2`; when neither makes it, the reading that puts S2 up first (ties keep `ig5-01g`). S2 rises `PLAN.cardLead` (2 f) before the agency line's word 0, the line following the hook's end by the series gap (`place`) and S1's exit (`PLAN.s1Gone`, 14 f after "can't").
2. **The trim ladder** on that reading: full → T1 → T1 + T2 (§4.3), the first rung whose CTA ends by f765.
3. **A/B re-cuts change one object** (`HOOK` in `timing.ts`): the runner-up `{ hooks: ['ig5-01c'], agency: 'ig5-02g', agencyT1: 'ig5-02gt' }`; the reserve below with its own `PLAN.lines.agency` (124) and `MUSIC.bedFrom` (0).

### 4.5 The reserve: the incumbent hook "Don't pay $300" (installed, not placed)

`ig5-01` "Don't pay three hundred a month for an AI receptionist." (10 tokens; cards "Don't pay $300 a month" / "for an AI receptionist.", display [2-3] → `$300`) with `ig5-02` "That's a common agency retainer. Setup, often fifteen hundred." (9; cards "That's a common agency retainer." / "Setup, often $1,500.", display [7-8] → `$1,500.`), trim T1 `ig5-02t`, and the A/B hook `ig5-01b`. All four stay installed (takes a / b / c / c, `voice-candidates/ig5/PICKS.md`). With them the full script fitted at rung 0 (CTA ends f753), "three" was heard at 1.10 s, "AI receptionist" was on screen at ≈ 2.2 s, and "Ours?" landed at f394 (46.9 %). HOOKS §5-§6: the cheapest next test if the winner's TikTok 3-second hold comes in under ig1's is `ig5-01b` on this body. Its b1 and b2, as written before the swap:

| Beat · frames · s | Picture | On-screen text (≤ 6 words per card) | Line (id @ frame) | Sound |
|---|---|---|---|---|
| **b1 Hook** · 0-122 · 0.0-4.1 | **Ground:** pearl `MeshGround` on `MUTED_MESH`, warm key low-left, already drifting at f0.<br>**Desk (ig1 callback):** a 1.5 px graphite hairline at y 1130 drawing x 86 → 880 (`EASE.draw`, started f −6, so it is moving at f0). At its right end (x 862) the **rose line light** (`MeshOrb` 18 px, `MOMENT_LIGHTS.rush`) with a `RingPulse` already in flight at f0, and again at f30.<br>**Blank slip 1 (G3)** at x 120-880, y 360-640, −1°: white `DocPage` paper, perforated top edge, `meshElevation` 2, rising from f −6 (`SPRING.site`). On it: one graphite ink bar (35 % ink) where the tag will write (y 385-420) and an **empty amount slot**, a 1.5 px hairline rounded rectangle (30 % graphite) at x 160-760, y 440-600. No words, no `QUOTE` tag (the perforation says it).<br>**S1 at f0** (72 % ink, left at x 86): "Don't pay" (headline 92, graphite, y 670-762) over "**$300**" (display 168, tabular, rose) + "a month" (68, graphite) on one row, y 780-960, ≤ 814 px wide. Words lift to 100 % on her onsets; "$300" takes a 1-frame rose glint on "three".<br>**≈ f72** (`vWord(ig5-01,6) − 2`): "Don't pay" exits up through its mask (4 f); **S2** rises in the caption band (y 1170-1270).<br>**f90-104:** "$300 a month" glides up into slip 1's slot (sub-pixel glide layer, `SPRING.land`, 168 → 140 px). It is the one moving element. | S1 [0-5] **"Don't pay $300 a month"** (set at f0)<br>S2 [6-9] **"for an AI receptionist."** | `ig5-01` @6 | `fx-trill` at f0 and f30 (the series' "a call" attack) with the `RingPulse`s. Bed from f0 at −6 dB under the voice: the stub arrangement in E (felt-piano 8ths + shaker). A soft `thump` on "three hundred". `fx-slip` as the figure lands in its slot. |
| **b2 Agency** · 122-231 · 4.1-7.7 | **Slip 1 becomes the agency quote.** On "agency" the ink bar sweeps into the tag **COMMON AGENCY RETAINER** (label 30, graphite 70 %, `InkSweep`). Under the figure the **to-scale hairline** draws from $0 at x 160 to x 760 (2 px per dollar, `EASE.draw`, y 615).<br>**On "Setup":** a smaller **stub** (white paper, x 360-880, y 600-770, +3°) drops with weight onto slip 1's lower right edge and is stapled there, overlapping only slip 1's bottom margin. It reads **SETUP, OFTEN** (label 30) over "**$1,500**" (140 px, rose, tabular), which rolls 0 → 1,500 on "fifteen hundred" (`Roll`, 32nd ticks, ≈ 0.6 s, settles on `SPRING.land`). The stub gets **no** hairline: a one-time fee never sits on the monthly scale.<br>**f150:** the rose light rings once more (`RingPulse`), still unanswered (G2). | S3 [0-4] **"That's a common agency retainer."**<br>S4 [5-8] **"Setup, often $1,500."** | `ig5-02` @124 | `fx-felttip-short` on the tag; `fx-trill` at f150, ducked −8 dB under the voice; `thump` + `fx-tag` (the staple click) as the stub lands; `fx-tick` 32nds under the roll, `fx-tock` as it settles. |

Its cover was "Don't pay / $300 a month." with the attribution "Agency retainer. / Ours: from $49 a month." (the incumbent §7).

---

## 5. Word-rate check

**§5.1-5.3 are the plan made for the incumbent hook** (kept as written: the reserve's numbers). **§5.4 is the measured timeline with the winning hook and the installed takes.**

**Tessa's measured pace** (`src/ig/voice.generated.ts`, 34 takes): 2.78 tokens/s mean; ig1 2.62, ig2 2.34, ig3 2.72, ig4 3.05; number-heavy lines 2.45-2.50 (ig1-02, ig4-05).

### 5.1 Per beat (plan targets)

| Beat | Line window (frames) | s | Tokens | Needs (tok/s) | Read |
|---|---|---|---|---|---|
| b1 Hook | f6-122 | 3.87 | 10 | 2.59 | at ig1's pace; the card reads at f0 and "$300" is heard by ≈ 1.2 s |
| b2 Agency | f124-231 | 3.57 | 9 | 2.52 | number line; T1 gives 2.24 |
| b3 Answering | f233-350 | 3.90 | 10 | 2.56 | number line |
| b4 Ours | f352-462 | 3.67 | 9 | 2.45 | includes Sonic's ≈ 0.5 s pause after "Ours?" |
| b5 Setup | f465-571 | 3.53 | 9 | 2.55 | T2 gives 1.42 |
| b6 Does | f574-690 | 3.87 | 10 | 2.59 | |
| b7 CTA | f694-765 | 2.37 | 5 | 2.11 | `ig2-07`, same words, measured 1.68 s |
| **Whole VO** | f6-765 | 25.3 | 62 | **≈ 2.62** | the CTA must end by **f765** so the impact lands on f780 |

### 5.2 Placement simulation (series `place()` rule: 6 f gap, 12 f before `ig5-04` for the stop-time, snap to the next 16th; CTA 50 f; spare = f765 − CTA end)

| Pace (tok/s) | Full (62 tokens) | T1 (61) | T1 + T2 (57) |
|---|---|---|---|
| 2.40 | −54 f | −43 f | **+6 f** |
| 2.50 | −32 f | −20 f | **+28 f** |
| 2.62 | −2 f | **+10 f** | **+58 f** |
| 2.78 | **+43 f** | **+55 f** | **+100 f** |

At the series mean the full script fits with 1.4 s to spare; at ig1's pace it needs T1; at the number-heavy pace it needs T1 + T2. Every column stays **28.0 s** (impact f780) once the right trim is applied. (Approximate: the truth judge's `place()` simulation of draft A agrees with this model within ≈ 7 f.)

**When $49 lands:** the card with "$49" rises on "Ours?" at ≈ 11.7-12.5 s (42-45 %); "forty-nine" is heard at ≈ 12.9-13.3 s (46-47 %), a hair past RESEARCH-format's 45 % guideline because of the stop-time and "From". The CTA starts at 82 % (series window 75-83 %).

### 5.3 Script tools (run 2026-10-07, `python3 -I` from a scratch folder; skills untouched)

| Tool | Input | Result |
|---|---|---|
| `hookscore.py` | "Don't pay $300 a month for an AI receptionist." | **85.8 STRONG** (weakest SPECIFICITY 75) |
| | spoken "Don't pay three hundred a month …" | **83.2 STRONG** (weakest STAKES 70) |
| | `ig5-01b` "Before you pay $300 a month …" | **87.0 STRONG** |
| `hookscore.py` (HOOKS §7, raw / patched / strict) | the winner "Three rings. Gloves on. You can't." (card and spoken) | **84.4 / 84.4 / 81.4 STRONG** (weakest STAKES 70) |
| | `ig5-01g2` "Three rings, gloves on. You can't." | 84.4 / 84.4 / 81.4 STRONG |
| | beat 2 `ig5-02g` alone | 46.5 WEAK: a body line, not a hook (HOOKS §7) |
| | runner-up `ig5-01c` "Closed at 9? Your phone's not." | 84.4 / 84.4 / 81.4 STRONG |
| `beats.py --wpm 157 --target 28` | spoken VO + sign-off | 65 words, ≈ 24.8 s of speech. Flags: hook 3.8 s (accepted: the card is readable at f0 and "$300" is heard by ≈ 1.2 s, as ig1); "nothing concrete" in beats 5-7 (artefact: the screen shows $49 and the dots); "no loop" (answered visually: the seam re-forms the ringing desk and the blank slip). |
| `detect.py` | on-screen VO (display form) | 72.6 REVIEW: burstiness 0.47 (short, even spoken lines), every other check 77-100. With T1 + T2 applied: **75.1 PASS**. The spoken form scores lower only because spelled-out numbers do not count as concrete. |
| `humanize.py --report` | VO, both forms | nothing to strip, 0 structural tells |
| Captions, comments, DM | POSTING.md | all READY / PASS (POSTING §9) |

### 5.4 The placed timeline with the winning hook (`timing.ts` on the installed takes, 2026-10-07)

**The takes** (four new Cartesia sets `take-e` … `take-h`, picks in `voice-candidates/ig5/PICKS.md` "Hook swap"): `ig5-01g` 2.56 s (the four sets: 2.56-2.74 s; HOOKS estimated 2.1-2.4 s), `ig5-01g2` 2.90 s (2.84-3.01 s: longer than `ig5-01g` in every set), `ig5-02g` 6.51 s (6.51-6.91 s), `ig5-02gt` 6.12 s (6.12-6.30 s). Lines 03-07 are the installed picks, unchanged.

| Rung (with `ig5-01g`) | CTA ends | Impact |
|---|---|---|
| full (`ig5-02g`) | f795 | f840: the 30 s reel, refused |
| T1 (`ig5-02gt`) | f783 | f840, refused |
| **T1 + T2 (`ig5-02gt` + `ig5-05t`): placed** | **f746 (19 f to spare)** | **f780 · END f840 · 28.0 s** |

`ig5-01g2` gives the same rungs 7 f later (S2 f99, "Ours?" f432). Over all 256 combinations of the new takes (01g × 01g2 × 02g × 02gt), every one lands on rung 2 at 28.0 s; the picks give the earliest S2 (f92) and the earliest "Ours?" (f424) of them all.

| Moment | Frame | Time | % of 28 s |
|---|---|---|---|
| S1 "Three rings. / Gloves on. / You can't." set | f0 | 0.00 s | 0 % |
| her first word "Three" (after the frame-0 ring rings out) | f10 | 0.33 s | 1.2 % |
| "can't." / S1 gone | f74 / f88 | 2.47 / 2.93 s | 8.8 / 10.5 % |
| **S2 "Agency AI receptionist:" on screen** (the keyword) | **f92** | **3.07 s** | **11.0 %** |
| "Agency" / "AI receptionist" heard | f94 / f116 | 3.13 / 3.87 s | 11.2 / 13.8 % |
| the bed enters (`MUSIC.bedFrom`) | f105 | 3.50 s | 12.5 % |
| **S3 "commonly $300 a month." (the "$300" card) / "three hundred" heard** | **f157 / f176** | **5.23 / 5.87 s** | **18.7 / 21.0 %** |
| "fifteen hundred" heard | f250 | 8.33 s | 29.8 % |
| answering line | f285 | 9.50 s | 33.9 % |
| **"Ours?" (the $49 card rises f422) / "forty-nine" heard** | **f424 / f458** | **14.13 / 15.27 s** | **50.5 / 54.5 %** |
| setup (`ig5-05t`) / does | f533 / f581 | 17.77 / 19.37 s | 63.5 / 69.2 % |
| comment field / **CTA "Comment AGENT"** / AGENT types / send | f688 / **f694** / f709 / f746 | 23.13 s | **82.6 %** |
| impact / sign-off / END | f780 / f784 / f840 | 26.0 / 26.13 / 28.0 s | |

Stop-time f420-458. Acts: hook 0-86 · agency 86-283 · answering 283-422 · ours 422-530 · setup 530-578 · does 578-686 · end 686-840.

**What the swap costs, measured** (against the incumbent's installed timeline, §4.5):
- **The keyword misses the cast rule's f78 by 14 f.** No take of the four sets gets S2 up by f78: the hook needs ≤ ≈ 2.1 s and Sonic reads it in 2.56-2.74 s (two pauses of 0.13-0.29 s after "rings." and "on."). The two-breath reading is no help (2.84-3.01 s). The keyword is still on screen at 3.07 s, inside HOOKS §1.10's "about 3 s", and the TikTok caption opens on "AI receptionist cost".
- **The first price comes later:** "$300" on screen at 5.23 s and heard at 5.87 s (HOOKS estimated 4.3-5.0 s; the incumbent 1.10 s). Beat 2 reads 6.1-6.9 s, against the 3.6 s window of the line it replaced.
- **$49 comes later:** the $49 card at 50.2 % and "forty-nine" at 54.5 % (the incumbent: 46.9 % / 51.0 %; RESEARCH-format's guideline 45 %).
- **Two trims:** T1 ("commonly") and T2 ("in under ten minutes" leaves the voice-over; it stays in both captions).

---

## 6. Price evidence (every figure on screen, with its source)

All outside pages read 2026-10-07 through the research fetcher (RESEARCH-prices.md). **Before posting, re-open by eye** the pages marked ●. Provider names are internal only: never on screen, in the VO, the captions or the comments.

| On screen / VO | Exact source line | URL | Grade · hedge |
|---|---|---|---|
| **"Agency AI receptionist: $300 a month, a common retainer"** (T1, placed: "commonly $300 a month"; the reserve: "That's a common agency retainer") | ● Trillet agency guide (updated 30 Sep 2026): "a common benchmark is a $300/month retainer per client, plus a setup fee and per-minute markup". ● Ciela (8 Jan 2026): "Starter receptionist: $1,500 to $2,500 setup, $300 to $450 monthly". Monthly floors across 8 sources (2 agencies' own pages + 6 guides): $150, $297, $300, $500, $500, $997, $1,000, $1,500, so **7 of 8 are ≥ $297**. | https://trillet.ai/blogs/voice-agent-pricing-strategy-guide · https://ciela.ai/blogs/how-much-to-charge-for-ai-voice-agent | B · "common" / "commonly" (the source's own word), spoken and printed on the slip; "Agency" scopes the figure from the line's first word (HOOKS §1.9: §7 row 2 avoided). Never "every agency"; never "AI receptionists cost $300" (several AI apps cost $0-$49: the captions disclose it). Note: Trillet itself sells a $49 AI receptionist; it is never named or sent. |
| **"Setup, often $1,500"** | Ciela, as above. ● Agentpro AI (26 Jun 2026): "$1,500 for setup and $1,500/month for ongoing service". ● Constant Concepts: "Setup: $2,500 … Monthly: $997". Setup floors across 7 sources: $297, $500, $1,000, $1,500, $1,500, $2,500, $2,500 (median **$1,500**). Trillet: "many agencies waive these". | https://agentpro.ai/resources/ai-voice-agent-vs-answering-service-vs-new-hire-a-cost-comparison-for-small-businesses · https://constantconcepts.ai/pricing/ | B · "often", spoken and printed. One-time: never on the monthly scale. |
| **"Live answering service: from $99 a month, for 50 minutes"** | ● PATLive: "50 minutes About 20 calls", $99/mo. The cheapest way to buy 50 minutes is **≥ $99 at all 10** US live answering services surveyed: PATLive $99, MAP $117.50, SAS $121, Davinci $129, Posh $130, Moneypenny $165, Abby $165, Ruby $250, Smith.ai $300, AnswerConnect $350 (RESEARCH-prices §1). | https://www.patlive.com/pricing/ (the other nine: RESEARCH-prices §8) | A · "live", "from", "a month" and "for 50 minutes" all spoken and printed. Fair to them: our allowance is ≥ 150 minutes on either price list (never shown). |
| **"Ours? From $49 a month."** | `lib/site.ts:1685` `{ id: "starter", name: "Starter", monthly: 49, … }`; `types/index.ts:594` `price_monthly: 49`; `lib/site.ts:2290` "Plans from $${monthly} a month". | repo | A · "from": the $1.15 number, VAT and minutes past the allowance sit on top (captions, pinned comments, DM). Never "all-in", "flat", "unlimited", "total". Live Stripe price to confirm (POSTING §0). |
| **"No setup fee."** | `lib/pages/home/pricing.ts:243` `{ title: "No setup fee", body: "On any plan. A custom build is quoted on its own." }` | repo | A |
| **"You set it up yourself, in under ten minutes."** | `lib/pages/ai-agents.ts:40` "Ready in under ten minutes"; four setup screens `lib/pages/home/start.ts:12` (shown as unlabelled dots). | repo | A · never "5 minutes". |
| **"It picks up when you can't"** | `lib/voice/router.ts:196-221` (answers at any hour by default); `lib/pages/ai-agents.ts:40` "Point your calls at an agent that picks up on the first ring". Real callers need a bought number (`lib/site.ts:1813`): said in the captions. | repo | A |
| **"and books the appointment"** + Booked pill | **Owner decision, 2026-10-07:** "si la 49$ au calendar, trebe sa modific eu pe platforma la price detail" / "O fac eu modificarea, tu fa reelul". **False today:** `lib/billing/entitlements.ts:43` (starter `googleIntegrations: false`) → `bookingGate` returns NOT_IN_PLAN (`lib/voice/tools/calendar.ts:22-29`); `lib/pages/home/pricing.ts:91` lists Calendar under Pro, "in beta". | repo + owner | **LAUNCH GATE** (POSTING §0). Fallback take `ig5-06-msg`. |
| Hairline lengths | arithmetic: 2 px per dollar ($300 = 600, $99 = 198, $49 = 98), × .88 at the payoff | | to scale from $0; no broken axis |
| Dashboard strings | `components/calls/call-display.tsx:13` Booked, `:16` Answered, `:17` Message taken, `:32` "Checked your availability", `:33` "Booked an appointment", `:39` "Took a message" | repo | chrome |

**Claims that live only in the captions / comments / DM** (sources in POSTING): $1.15 a month for the number (`lib/phone/pricing.ts:6`, FAQ `lib/site.ts:1932`); USD, excl. VAT, minutes past the allowance billed per minute (`lib/site.ts:1829`); cancel anytime (`lib/pages/home/pricing.ts:240-241`); 5 free minutes, 14 days, no card, test calls only until a number is bought (`lib/site.ts:1812-1813`); trial does not book (`entitlements.ts:27-29`); tells every caller it's an AI (`lib/site.ts:2527`); answers from your documents (`lib/pages/home/pricing.ts:67`); takes messages (`session-loader.ts:241`); custom builds quoted on their own (`pricing.ts:243`).

---

## 7. Cover

**Since the hook swap** (HOOKS §1.8): the incumbent's "Don't pay $300 a month." is no longer spoken, so it can't be the cover (it is kept with the reserve, §4.5).

- **Cover line:** the hook, **"Three rings. / Gloves on. / You can't."**, with the attribution **"Agency AI receptionist:" / "commonly $300 a month." / "Ours: from $49 a month."** underneath, so the grid tile can't be read as "AI receptionists cost $300". Every word is spoken in the reel (with T1 placed, §5.4). **Hook-fold check (2026-10-07):** HOOKS §1.8's "Agency AI receptionist: $300 a month." drops the hedge; RESEARCH-prices §6 #6 is a B claim that needs "common" / "commonly" wherever $300 is shown, so the cover carries T1's own word. If the full `ig5-02g` is ever placed, the middle row becomes "$300 a month, a common retainer." (its spoken words).
- **Custom PNG `IG5-Cover-9x16`** (all words inside x 86-900, y 260-1380):
  - **Ground:** pearl.
  - **Kicker:** `AI RECEPTIONIST · 05` (label role, x 86, y 270-300). It carries the search keyword and the series number.
  - **Title** (x 86, y 330-700, about 112 px, "Three" in rose): "Three rings." / "Gloves on." / "You can't." on three rows, with the ring trio to the right of row 1.
  - **Attribution** (three rows at 44 px, graphite, y 720-876, each ≤ 525 px wide): "Agency AI receptionist:" / "commonly $300 a month." ("$300" in rose) / "Ours: from $49 a month." ("$49" in teal, the orb as its full stop). One row "Agency AI receptionist: commonly $300 a month." would measure ≈ 1,000 px at 44 px, past x 900.
  - **Thumbnail:** the b4 payoff frame (the pile with all three anchors and their hedges, ours with "$49" and "No setup fee", the bars to scale), y 890-1380 (moved down from HOOKS' 850 for the third attribution row). Its "$49" sits above y 1300, clear of TikTok's grid view count.
  - `src/ig/ig5/Cover.tsx` carries the kicker and the three-row title now (112 px fits, checked by eye on a still); the ring trio, the attribution and the thumbnail come with the art.
- **TikTok:** the feed autoplays from frame 0, which is the hook picture itself, so the cover matters only on the profile grid and in search. Upload the PNG if the app offers "upload from photos"; otherwise pick the payoff frame (≈ f455 on the plan; on the placed timeline **between 17.25 and 17.5 s, f518-525, never later**: "No setup fee." printed, the pile at rest; POSTING §3) with no TikTok text sticker.
- **Instagram:** upload it in the composer (Edit cover → Add from camera roll). Fallback: frame 0, now a usable cover on its own.

---

## 8. End card (series, unchanged)

The shared `IgEnd`, exactly as ig1-ig4 (docs/ig/SCRIPT.md §0.3):
1. **CTA** at 82 % of the runtime: the last shot steps back (× .92, shade .08); the CTA caption centred at y 700-860; the white comment field rises at x 174-906, y 940-1060 **before** "Comment AGENT"; **AGENT** types one letter per 16th from her word; the send disc presses as "link" ends. Nothing imitates either app's UI.
2. **Impact** on the bar line at f780: the field leaves up, `LightGL` blooms with one teal emitter, the **NEUROVOICE** wordmark surfaces at y 760-900, `ig1-07` "Neuro Tech Voice." starts 4 f after the impact, and the URL types on her syllables.
3. **Seam** (last 14 f): frame 0 re-forms mid-ring; the mix fades to < −60 dBFS.

**URL:** the delivered `IgEnd` types `neurotechvoice.com` (`src/ig/components/End.tsx:247`), not `www.neurotechvoice.com`. Changing it would change ig1-ig4's picture, so ig5 keeps the series URL unless the owner insists (§11).

---

## 9. Self-check against the hard rules

| Rule | Status | How |
|---|---|---|
| No invented number, statistic, testimonial or result | **PASS** | Every figure is in §6 with its page. "common" and "often" are the sources' own words. No saving, percentage, "X times", customer or outcome anywhere. The call is labelled `SAMPLE CALL`; the captions say the quote slips are illustrative. |
| No competitor named | **PASS** | Categories only. No names, logos or provider UI in the picture, captions or comments; the named source list stays internal (and would name a $49 competitor). |
| No minutes, overage rate or other tiers of ours | **PASS** | "50 minutes" is the answering service's plan. Captions say only "minutes past the plan's allowance are billed per minute". |
| "$49" qualified honestly | **PASS** | "From $49 a month" spoken and shown; Starter, USD, excl. VAT, the $1.15 number and per-minute usage in both captions, both pinned comments and the DM. |
| Never imply a feature the $49 plan lacks | **PASS with the launch gate** | Booking at $49 only after the owner's change ships (POSTING §0), with `ig5-06-msg` as the fallback. No recordings, voice cloning, Google logo, language or "every call" claim. |
| Fair comparison (FTC 16 CFR 233.1-233.2; ASA comparisons) | **PASS** | Plan fee against plan fee, per month against per month. Conservative anchors (the $99 floor of ten; the $300 common retainer; the $1,500 median setup floor). The people-staffed service is labelled "live" with a people stripe. The basis ("you set it up yourself" vs an agency that builds and runs it) is spoken and in the captions. Selection disclosed (self-serve AI apps not compared). Bars to scale from $0; no strike-through, no total, no "was / now". |
| Series coherence with ig1 | **PASS** | The same desk and rose phone light; "Gloves on" is the work only people can do and b6 answers "You can't"; no wage, no "replace", no "fire"; the IG caption keeps "Keep your front desk for the work only people can do." (The "Don't …" shape now lives in the reserve, §4.5.) |
| ≤ 6 words per card; every on-screen line spoken; hook in 0-2 s | **PASS, with a flag** | 14 cards in the full cast (13 as placed with T1 + T2), the longest 6 display words; chrome ≤ 32 px. The hook card (6 words, one card) is set at f0 over the drawn ring trio, and her hook ends at 2.5 s. **Flag (§5.4):** "AI receptionist" is on screen at 3.07 s (HOOKS' cast rule wanted 2.6 s) and the first price is heard at 5.87 s. |
| Combined safe zone | **PASS by layout** | §1.2; to be proved by `check-zones --film=ig5` once §1.3 lands. |
| Trial truth | **PASS** | "Free" never appears in the reel (booking is on screen, ig2's rule). The captions say the trial answers only test calls and doesn't book. |
| Secrets | **PASS** | No key read or printed; no Cartesia call in this run. |

---

## 10. Build notes carried from the judges

- `MUSIC.stop` and every stop-time cue come from the measured `vWord('ig5-04', 0)` / `vWord('ig5-04', 2)`, not plan frames (the line can move by +20 f; with the hook swap it moved +30 f).
- **Hook swap (HOOKS §1.7), in `timing.ts`:** `TITLE` "Three rings"; `HOOK` + the cast rule (§4.4); `PLAN.lines.agency` 80 (a floor: the line follows the hook's end, never the old f124) and `PLAN.acts.agency` 72 (slip 1 rises at `LINE.agency − 6`); S2 only after S1 has left (`PLAN.s1Gone`); `MUSIC.bedFrom` = the first beat at or after the agency line's word 0 (f105). R1 and the later rings are the scene step's, from the onsets.
- `ContactShadow` exists only in film 1 (`src/components/Atmosphere.tsx:338`); test it or use `meshElevation`.
- Sound names above are all in the series tables (`src/ig/common/series.ts` and film 1's `SFX`): there is no `fx-paper`, `keys`, `tap-0` or `fx-felttip-0`.
- The setup figure is 140 px so it stays ≥ 120 px after the × .88 step-back.
- Do not draw the ig2 `EventCard` (it carries a PRO chip); the booking proof is the record's ToolRow and pill.

---

## 11. Open owner confirmations

1. **Booking on Starter** works in the product and the pricing page says so (LAUNCH GATE, POSTING §0). *Aligned with BUILD.md (critic round 1, T1):* the reel is built with `ig5-06` (Booked + the app's `BETA` chip) and the render step renders BOTH masters (`…-booking-…` with `ig5-06`, `…-message-…` with `ig5-06-msg`); only the message master may be posted until POSTING §0 items 1-2 are ticked.
2. **The live Stripe `STRIPE_STARTER_PRICE_ID` is $49.00 USD a month** (the repo can't show it).
3. **"(in beta)"** stays in the captions while the app badges booking as beta; say if the badge goes.
4. **Starter's minutes and overage** (site 400 min / $0.20 vs app 150 min / $0.25): settle them in the same pricing edit. The reel never shows them, but it sends viewers to that page.
5. **"Starter" in the caption fine print:** profile.md bans plan names except Pro; it is kept as the honest pointer to which plan "$49" means. Confirm.
6. **End-card URL:** keep the series' `neurotechvoice.com`, or change the shared end card to `www.` (that re-renders ig1-ig4's picture).
7. **The $1.15 spoken or not:** this script speaks the setup line; the spare `ig5-05-num` speaks the $1.15 instead.
8. **AGENT replies on TikTok** are by hand (no automation): someone answers within the hour on posting day.
