# ig5 · "Don't pay $300" (SCRIPT)

Label `synth`. Written 2026-10-07 on `claude/remotion-trailer` (HEAD `1c286f4`). Planning only: no code, no voice, nothing outside `docs/ig/ig5/` touched, nothing committed, no Cartesia call.

| | |
|---|---|
| **Title** | Don't pay $300 |
| **Slug** | `dont-pay-300` → `outName` `neurotechvoice-ig5-dont-pay-300` (PIPELINE §2.1) |
| **Length** | **28.0 s = 840 timeline frames at 30 fps** (14 bars at 120 BPM; 3360 render frames at 120 fps). Impact **f780** (bar 14 line, 26.0 s). END **f840**. |
| **Platforms** | TikTok first, then Instagram. One render, one combined safe zone (§1). Upload the 60 fps copy to both (POSTING §1). |
| **Companions** | `voice-lines-draft.json` (every line, same shape as `scripts/voice-lines-ig.json`), `POSTING.md` (captions, comments, DM, launch gate, slot), `PIPELINE.md` (build), `RESEARCH-{prices,product,format}.md`, `drafts/` (three drafts, two judges). |

**The reel in one breath.** A blank quote slip lies on a desk while the desk phone rings. "Don't pay $300 a month for an AI receptionist." The price drops into the slip: a common agency retainer, with a setup fee, often $1,500, stapled on. A second quote: a live answering service, from $99 a month, for 50 minutes. On "Ours?" the ringing light is picked up and becomes the teal orb, and a third slip rises: from $49 a month, no setup fee, with every price still on screen and drawn to scale. You set it up yourself. It picks up when you can't and books the appointment. Comment AGENT.

---

## 0. Decisions

### 0.1 What was chosen, and from where

| Part | Source | Why |
|---|---|---|
| **Base: draft A "Don't pay $300"** | both judges (growth 7.8 vs 6.8 / 6.2; truth+production 15.5 vs 15 / 12) | The comparison the owner asked for (two categories that charge several hundred, against $49), the hook that rhymes with ig1 (the TikTok winner, 563 views), every figure hedged in the spoken line, and the best muted/screenshot frame. |
| **G1 (from B): "You set it up yourself, in under ten minutes."** replaces A's spoken "Plus the number: $1.15 a month." | growth judge | It is the reference reel's "so I built my own", told truthfully (S19, `lib/pages/ai-agents.ts:40`). It states the basis of the comparison out loud (an agency builds and runs it; ours is self-serve), which ASA asks for, and it answers "is it hard?" right before the booking demo and the CTA. It also replaces A's one static beat. |
| **"From $49 a month"** on screen and spoken (new in this synthesis) | RESEARCH-prices line #1, RESEARCH-product S1, the site's own menu (`lib/site.ts:2290` "Plans from $${monthly} a month") | With the spoken $1.15 moved to the captions and pinned comments, "from" keeps the $49 qualified on screen: the agent's number ($1.15/mo), VAT and minutes past the allowance sit on top of the plan fee. The truth judge passed draft C on exactly "from + caption". Costs one word (budgeted in §5). |
| **G2 (from C): the ringing phone is picked up on "Ours?"** | growth judge | A 12-second open loop (a phone nobody answers), closed on the word that lands the price. The orb is born once, here, and never again. |
| **G3 (from B and C): a blank quote slip on the desk at frame 0** | growth judge | An object with an empty price slot reads before a word does; the hook's "$300 a month" then drops into the slot. |
| **Truth fixes** (all applied) | truth+production judge §5 | Caption basis line, selection disclosure ("we didn't compare self-serve AI receptionist apps"), "(in beta)", trial "doesn't book", cover attribution line, setup numeral ≥ 120 px at the payoff, valid sound names, `MUSIC.stop` from the measured onset, trims that never cut a hedge, and the ZoneGuard per-reel zones (§1.3, a BLOCKER for QA). |
| **Captions, comments, DM** | both judges (G4-G6 + truth §5.3) | POSTING.md. |

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
- **Series coherence with ig1** ("Don't fire your receptionist for an AI. Not even ours."): the hook repeats its "Don't …" shape and its desk hairline with the rose phone light; the comparison is between ways of paying for phone cover, never against a person's wage; nothing says "replace" or "fire"; the IG caption carries ig1's line "Keep your front desk for the work only people can do."

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

**Acts (`SCENES`):** `hook` 0-122 · `agency` 122-231 · `answering` 231-350 · `ours` 350-462 · `setup` 462-571 · `does` 571-690 · `end` 690-840.

| Beat · frames · s | Picture | On-screen text (≤ 6 words per card) | Line (id @ frame) | Sound |
|---|---|---|---|---|
| **b1 Hook** · 0-122 · 0.0-4.1 | **Ground:** pearl `MeshGround` on `MUTED_MESH`, warm key low-left, already drifting at f0.<br>**Desk (ig1 callback):** a 1.5 px graphite hairline at y 1130 drawing x 86 → 880 (`EASE.draw`, started f −6, so it is moving at f0). At its right end (x 862) the **rose line light** (`MeshOrb` 18 px, `MOMENT_LIGHTS.rush`) with a `RingPulse` already in flight at f0, and again at f30.<br>**Blank slip 1 (G3)** at x 120-880, y 360-640, −1°: white `DocPage` paper, perforated top edge, `meshElevation` 2, rising from f −6 (`SPRING.site`). On it: one graphite ink bar (35 % ink) where the tag will write (y 385-420) and an **empty amount slot**, a 1.5 px hairline rounded rectangle (30 % graphite) at x 160-760, y 440-600. No words, no `QUOTE` tag (the perforation says it).<br>**S1 at f0** (72 % ink, left at x 86): "Don't pay" (headline 92, graphite, y 670-762) over "**$300**" (display 168, tabular, rose) + "a month" (68, graphite) on one row, y 780-960, ≤ 814 px wide. Words lift to 100 % on her onsets; "$300" takes a 1-frame rose glint on "three".<br>**≈ f72** (`vWord(ig5-01,6) − 2`): "Don't pay" exits up through its mask (4 f); **S2** rises in the caption band (y 1170-1270).<br>**f90-104:** "$300 a month" glides up into slip 1's slot (sub-pixel glide layer, `SPRING.land`, 168 → 140 px). It is the one moving element. | S1 [0-5] **"Don't pay $300 a month"** (set at f0)<br>S2 [6-9] **"for an AI receptionist."** | `ig5-01` @6 | `fx-trill` at f0 and f30 (the series' "a call" attack) with the `RingPulse`s. Bed from f0 at −6 dB under the voice: the stub arrangement in E (felt-piano 8ths + shaker). A soft `thump` on "three hundred". `fx-slip` as the figure lands in its slot. |
| **b2 Agency** · 122-231 · 4.1-7.7 | **Slip 1 becomes the agency quote.** On "agency" the ink bar sweeps into the tag **COMMON AGENCY RETAINER** (label 30, graphite 70 %, `InkSweep`). Under the figure the **to-scale hairline** draws from $0 at x 160 to x 760 (2 px per dollar, `EASE.draw`, y 615).<br>**On "Setup":** a smaller **stub** (white paper, x 360-880, y 600-770, +3°) drops with weight onto slip 1's lower right edge and is stapled there, overlapping only slip 1's bottom margin. It reads **SETUP, OFTEN** (label 30) over "**$1,500**" (140 px, rose, tabular), which rolls 0 → 1,500 on "fifteen hundred" (`Roll`, 32nd ticks, ≈ 0.6 s, settles on `SPRING.land`). The stub gets **no** hairline: a one-time fee never sits on the monthly scale.<br>**f150:** the rose light rings once more (`RingPulse`), still unanswered (G2). | S3 [0-4] **"That's a common agency retainer."**<br>S4 [5-8] **"Setup, often $1,500."** | `ig5-02` @124 | `fx-felttip-short` on the tag; `fx-trill` at f150, ducked −8 dB under the voice; `thump` + `fx-tag` (the staple click) as the stub lands; `fx-tick` 32nds under the roll, `fx-tock` as it settles. |
| **b3 Answering** · 231-350 · 7.7-11.7 | **Slip 2 rises** out of its mask at x 120-880, y 800-1110, +0.8°, overlapping no figure. A 6 px graphite edge stripe on its left marks **people**.<br>Its tag **LIVE ANSWERING SERVICE** (label 30) writes on words 0-2. Then the figure row: "from" (44) + "**$99**" (140, rose, rolls 0 → 99 on "ninety-nine") + "a month," (44). The second row "for **50** minutes" (44, tabular "50") writes on its words. Its hairline draws to 198 px (x 160-358).<br>**Camera:** eases back 1.00 → .97 about (540, 740) over 1 s, so the pile reads as one object.<br>**f285:** the rose light rings once more, unanswered. | S5 [0-2] **"Live answering service:"**<br>S6 [3-6] **"from $99 a month,"**<br>S7 [7-9] **"for 50 minutes."** | `ig5-03` @233 | `fx-paper-square` as slip 2 lands; `fx-tick` roll under "$99"; `fx-tock` on "fifty"; a soft `swish` on the camera; `fx-trill` at f285, ducked −8 dB. |
| **b4 Ours: the payoff** · 350-462 · 11.7-15.4 | **The pickup (G2).** The bed stops on the sample just before "Ours?" (stop-time). In the silence `fx-pickup` cuts the ring and the rose light **springs open into the teal orb** (film 2's birth: 3-frame seed, `SPRING.pop` 0 → 1.06 → 1, `mixPalette` rush → sunday over 6 f); the desk hairline undraws right to left behind it (0.4 s).<br>**The square-up, on "Ours?":** slip 1, its stub and slip 2 slide up and together into a neat pile at y 340-900 (× .88 about x 160 so every $0 point stays at x 160; rotation → 0; ink 55 %; the SlipStack collapse idiom). Every figure and hedge stays legible: $300, $1,500 and $99 at 140 × .88 ≈ **123 px**; "COMMON AGENCY RETAINER", "SETUP, OFTEN", "from … a month, for 50 minutes" all visible. Nothing is struck and no total is drawn.<br>**Ours** rises out of its mask at x 120-880, y 930-1250: white paper, a 2 px teal edge, lifted 8 px on `meshElevation` (or film 1's `ContactShadow`, untested in the reels: test it first). The card rises as a unit on "Ours?" at 72 %: "Ours?" (title 52, graphite) + "From" (44), then "**$49**" (display 200, **teal, still: it never rolls**) + "a month" (56). Words lift on her onsets, so "$49" is **seen** at ≈ 11.8 s (42 %) and **heard** at ≈ 12.9 s.<br>**f356-370:** the orb glides (0.45 s, `EASE.inOut`) from (862, 1130) to its place as the **full stop** after "a month" (Ø 44, breathing), as in ig1's "Not even ours●".<br>**Hairlines on one scale:** ours' hairline draws at the pile's scale (1.76 px per dollar): **$49 = 86 px** under $99 = 174 px and $300 = 528 px, all from x 160.<br>**On "No setup fee":** a teal row "No setup fee." (44) prints at ours' upper right (right-aligned to x 860), in the same column as the setup stub above, so "Setup, often $1,500" and "No setup fee." read as a pair.<br>**Ground:** a sunday pool rises behind ours (`MOMENT_LIGHTS.sunday`, mix 0 → .3 over 1 s).<br>**This is the screenshot frame and the cover source (≈ f455).** | S8 [0-5] **"Ours? From $49 a month."** (prints on ours)<br>S9 [6-8] **"No setup fee."** (prints on ours)<br>(caption band empty) | `ig5-04` @352 | **Stop-time:** `MUSIC.stop = [vWord('ig5-04', 0) − 4, vWord('ig5-04', 2))`, from the **measured** onsets (word 2 = "forty-nine"), never from plan frames; `fx-roomtone-desk` holds the floor. `fx-pickup` at `vWord('ig5-04', 0) − 2`; `fx-seed` + `fx-ting` for the birth. On "forty-nine": the bed returns with the pad an octave up, `ping` + `chime-sunday-soft` + `fx-mallet-e5` ("true"). `land` on ours' lift; `fx-tag` on "No setup fee". |
| **b5 Setup** · 462-571 · 15.4-19.0 | **On "You":** the pile exits up through its mask (6 f; the comparison has done its job) and ours glides up into the cleared stage, y 420-740 (`SPRING.site`, ≈ 0.5 s); ours' hairline undraws with the pile (nothing left to compare it to). Ours keeps "Ours? From $49 a month●" and "No setup fee."<br>**On "set it up":** a 2 px graphite track draws under ours (x 200-680, y 820) with **four empty dots** (Ø 24, no labels: the site's four setup screens, shown, not named).<br>**From "yourself":** the dots fill teal one per 16th.<br>**On "minutes":** the fourth dot turns into a drawn teal `CheckMark`. Four visual events in 3 s; nothing static for more than a beat. | S10 [0-4] **"You set it up yourself,"**<br>S11 [5-8] **"in under ten minutes."** | `ig5-05` @465 | `whoosh-soft` on the pile's exit; `fx-pluck-e5` → `fx-pluck-fs5` → `fx-pluck-gs5` → `fx-pluck-b5`, one per dot; `fx-ting` on the check. |
| **b6 Does** · 571-690 · 19.0-23.0 | **On "It":** ours shrinks into the **parked price chip** in the label band (white pill, x 530-900, y 250-330: "From $49 a month", 40 px teal); it stays there until the impact. The track folds away. The orb leaves ours' full stop and hangs at stage left (x 160, y 560), breathing.<br>**f575:** the **call record** (kit `RecordRow`, white, x 120-880, y 520-880) rises with its header chrome **`SAMPLE CALL`** (label 28) and, at the header's left, a small rose dot ringing (an incoming call).<br>**On "picks up":** the orb glides onto the rose dot and absorbs it (the pickup, one move); it stays docked at the record's top-left as the agent, leaning into its listen palette. The `OutcomePill` **Answered** (blue) lands at the header's right.<br>**Then:** the ToolRow "Checked your availability" (30 px) spins and resolves to a drawn `CheckMark`.<br>**On "books":** the ToolRow "Booked an appointment" ticks, and the pill swaps Answered → **Booked** (emerald, `OUTCOME_META.booked`) with `Swap`. No calendar brand, no logo, no PRO chip. A 24 px `BETA` chip beside the pill only if the dashboard still badges booking as beta at launch.<br>**No-booking cut (`ig5-06-msg`):** the ToolRow is "Took a message", the pill turns **Message taken** (indigo), and there is no availability row. | S12 [0-5] **"It picks up when you can't,"**<br>S13 [6-9] **"and books the appointment."** | `ig5-06` @574 | `tap` as the chip parks; `fx-paper-lift` under the record; `fx-trill-1` (ducked) on the rose dot; `fx-pickup` + `fx-ting` on the pickup; a quiet `fx-tick` roll under the spinner and `fx-ting` on its check; `fx-mallet-e5` + `pop` on "books". A light kick enters on beats 1 and 3 from f571. |
| **b7 CTA** · 690-780 · 23.0-26.0 (82 %) | The shared **`IgEnd`**: the record steps back (× .92, shade .08); the price chip stays in the label band. The CTA caption is centred at y 700-860 (≤ 720 px wide). The white comment field (x 174-906, y 940-1060) rises at **f688**, before she says "Comment", so muted viewers get the instruction. **AGENT** types one letter per 16th from `vWord('ig5-07', 1)`. The send disc presses (.97) as "link" ends (≈ f744). | S14 [0-4] **"Comment AGENT for the link."** | `ig5-07` @694 | The series end stack: `fx-menu-open` on the field, `fx-keys` per letter, the half-bar snare roll from f750, the riser crest. |
| **b8 Brand** · 780-826 · 26.0-27.5 | **Impact on the bar line (END − 60):** the field and the chip leave up through their masks (4 f); `LightGL` blooms with one teal emitter; the **NEUROVOICE** wordmark surfaces centre-out at y 760-900; `neurotechvoice.com` (Geist Mono 44, y ≈ 1000) types on "Neuro \| Tech \| Voice". | wordmark + URL | `ig1-07` @784 (borrow) | Impact (`fx-impact-end` via `impactHits`) + `sub` + E `chord` at f780; the name into its ring. |
| **b9 Seam** · 826-840 · 27.5-28.0 | The wordmark leaves up and the record drains away. Frame 0 re-forms mid-motion: the desk hairline redraws at y 1130; if the orb is on screen it shrinks into the rose light at (862, 1130) (`mixPalette` sunday → rush), otherwise the light simply re-forms; blank slip 1 rises into its place; S1 "Don't pay $300 a month" sets at 72 % by f839. A `RingPulse` launches at f836, so the replay starts mid-ring. | (S1 at 72 %) | none | `MIX.fadeOut` [826, 840] to < −60 dBFS on the last frame. The replay's first sound is f0's trill. |

**Muted read (sound off, frame by frame):** a blank quote on a desk with a ringing light → "Don't pay $300 a month / for an AI receptionist." → "COMMON AGENCY RETAINER $300 a month" with "SETUP, OFTEN $1,500" stapled on → "LIVE ANSWERING SERVICE from $99 a month, for 50 minutes" → the light turns teal and "Ours? From $49 a month● No setup fee." rises under the three, bars to scale → four dots fill → a sample call turns Answered → Booked → the comment field types AGENT.

**Retention:** a visual event every 0.7-1.5 s before the CTA (word lifts, rings at f0 / f30 / f150 / f285, the glide, the tag, the hairline draws, the staple, two rolls, the camera, the pickup, the square-up, the orb glide, the four dots, the chip, the pickup on the record, the spinner, the pill swap). No beat holds still longer than 1.5 s.

---

## 3. Layout and object specs (for `src/ig/ig5/`)

| Object | Geometry (1080×1920) | Type and colour | Notes |
|---|---|---|---|
| Desk hairline + rose light | y 1130, x 86 → 880; light Ø 18 at x 862 | graphite 1.5 px; light `MOMENT_LIGHTS.rush` | ig1's `DESK` grammar (ig1 used y 760; ig5 sits it under the papers). Rings: f −2/2 and f28/32 pairs, then single bursts f150, f285 (ducked) until the pickup. |
| Slip 1 (agency) | x 120-880, y 360-640, −1° until the square-up | tag label 30, graphite 70 %; "$300" 140 tabular rose; "a month" 44 graphite; hairline 2 px per dollar from x 160 | Perforated top edge, `DocPage` paper, `meshElevation` 2. Frame 0: ink bar + empty slot only. |
| Setup stub | x 360-880, y 600-770, +3° | "SETUP, OFTEN" label 30; "$1,500" 140 tabular rose (≈ 470 px wide) | Stapled over slip 1's bottom margin only; never on the monthly scale. |
| Slip 2 (answering) | x 120-880, y 800-1110, +0.8° | tag label 30; "from" 44; "$99" 140 rose; "a month," 44; "for 50 minutes" 44 | 6 px graphite edge stripe (people). Hairline 198 px. |
| The pile at the payoff | y 340-900, × .88 about x 160, ink 55 %, rotation 0 | anchors ≈ 123 px | Overlaps only blank paper; every hedge legible. |
| Ours | x 120-880, y 930-1250 (b4); y 420-740 (b5) | "Ours?" title 52 graphite; "From" 44; "$49" display 200 teal; "a month" 56; orb Ø 44 full stop; "No setup fee." 44 teal | 2 px teal edge; never rolls; hairline 86 px at the pile's scale in b4. |
| Step track | x 200-680, y 820; four dots Ø 24 | graphite track; teal fill; teal `CheckMark` | No labels. |
| Price chip | x 530-900, y 250-330 | "From $49 a month" 40 teal on white pill | b6 → impact. |
| Call record | x 120-880, y 520-880 | `SAMPLE CALL` label 28; ToolRows 30; `OutcomePill` | Dashboard strings only (`components/calls/call-display.tsx`). |
| Narration cards | caption band y 1170-1400, x 86-900 | caption role (series), graphite; figures in display numerals | b1 S1 is the exception: a headline card in the stage at y 670-960. |

**To-scale rule.** Every monthly figure gets a hairline at one shared scale from one $0 point (x 160): 2 px per dollar at 1.0, 1.76 px per dollar in the payoff frame. The one-time setup fee never gets a hairline.

**New parts:** `BillPile` (slips, stub, staple, square-up), `Roll` (anchor numerals; precedent `src/ig/ig2/Clock.tsx`), `PriceChip`, `StepDots`. Everything else by import: `MeshGround`, `MeshOrb`, `RingPulse`, `DocPage`, `InkSweep`, `SlipStack` idiom, `Panel`, `RecordRow`, `ToolRow`, `CheckMark`, `OutcomePill`, `Swap`, `LightGL`, the Captions fork with `display`, `IgEnd`.

**Bed:** the stub arrangement of `scripts/ig/bed.mjs` (no `ARRANGEMENTS.ig5`), driven by `MUSIC` (`bedFrom` 0, `stop` per b4, `roll` from 750, `impact` 780, `brand` 784). Write `scripts/ig5/bed.mjs` only if the critic rounds ask for a distinct arrangement (PIPELINE §5.3).

---

## 4. Voice lines

### 4.1 The placed lines (full entries in `voice-lines-draft.json`)

| id | `say` (spoken form) | Cards (display form) | Tokens |
|---|---|---|---|
| `ig5-01` | Don't pay three hundred a month for an AI receptionist. | "Don't pay $300 a month" / "for an AI receptionist." | 10 |
| `ig5-02` | That's a common agency retainer. Setup, often fifteen hundred. | "That's a common agency retainer." / "Setup, often $1,500." | 9 |
| `ig5-03` | Live answering service: from ninety-nine a month, for fifty minutes. | "Live answering service:" / "from $99 a month," / "for 50 minutes." | 10 |
| `ig5-04` | Ours? From forty-nine dollars a month. No setup fee. | "Ours? From $49 a month." / "No setup fee." | 9 |
| `ig5-05` | You set it up yourself, in under ten minutes. | "You set it up yourself," / "in under ten minutes." | 9 |
| `ig5-06` | It picks up when you can't, and books the appointment. | "It picks up when you can't," / "and books the appointment." | 10 |
| `ig5-07` | Comment AGENT for the link. | "Comment AGENT for the link." | 5 |
| `ig1-07` | Neuro Tech Voice. (borrow, byte for byte) | wordmark + URL | 3 |

62 tokens before the sign-off ("forty-nine" counts as one).

### 4.2 Display map and word spans (for `timing.ts`)

- **Display:** `ig5-01` [2-3] "three hundred" → `$300` · `ig5-02` [7-8] "fifteen hundred." → `$1,500.` · `ig5-03` [4] "ninety-nine" → `$99`, [8] "fifty" → `50` · `ig5-04` [2-3] "forty-nine dollars" → `$49`. "ten" stays a word (the site's "under ten minutes").
- **Screens:** S1 `ig5-01` [0-5] · S2 [6-9] · S3 `ig5-02` [0-4] · S4 [5-8] · S5 `ig5-03` [0-2] · S6 [3-6] · S7 [7-9] · S8 `ig5-04` [0-5] · S9 [6-8] · S10 `ig5-05` [0-4] · S11 [5-8] · S12 `ig5-06` [0-5] · S13 [6-9] · S14 `ig5-07` [0-4]. Most display words on one card: 6 (S12).
- **Object text** (subsets of spoken words, each appearing on or after its word): COMMON AGENCY RETAINER (`ig5-02` [2-4]), SETUP, OFTEN ([5-6]), LIVE ANSWERING SERVICE (`ig5-03` [0-2]), the chip "From $49 a month" (`ig5-04` [1-5]).
- **Chrome** (≤ 32 px, the dashboard's own strings, after their word): `SAMPLE CALL`, "Checked your availability", "Booked an appointment" / "Took a message", Answered / Booked / Message taken, `BETA` (only if the app shows it).

### 4.3 Alternates (synthesise in the same batch; swap by changing the VOICES id only)

| id | Text | Use |
|---|---|---|
| `ig5-02t` | A common agency retainer. Setup, often fifteen hundred. | **Trim T1** (−1 token). Same cards minus "That's". |
| `ig5-05t` | You set it up yourself. | **Trim T2** (−4 tokens, ≈ 1.4 s). One card; the four dots fill faster; "in under ten minutes" stays in both captions. |
| `ig5-06-msg` | It picks up when you can't, and takes a message. | **The no-booking cut** (launch gate fallback): true on Starter today (`take_message`, `lib/voice/session-loader.ts:241`). Same length. |
| `ig5-01b` | Before you pay three hundred a month for an AI receptionist. | **A/B hook** (hookscore 87.0). Cards "Before you pay $300 a month" / "for an AI receptionist." For a second TikTok post a week later, or a Trial Reel once @neurotechvoice reaches ~200 followers. |
| `ig5-07-bio` | The link's in our bio. | Only if no one can answer AGENT comments (and the IG automation is not live) on posting day. |
| `ig5-05-num` | Plus the number: a dollar fifteen a month. | **Spare, not built by default.** If the owner wants the $1.15 spoken instead of the setup line, swap it for `ig5-05` (b5 then writes "Plus the number: $1.15 a month." as a teal row on ours, with no dots). |

**Trim ladder** (only on measured takes; `timing.ts` picks): T1 → T1 + T2. **Never cut** "often", "from" (either), "for fifty minutes", "a month", "Live", "No setup fee" or "yourself": they are the hedges and the basis. If T1 + T2 still overrun (a pace slower than any delivered IG take set), re-take the long lines before touching anything else.

---

## 5. Word-rate check

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
| `beats.py --wpm 157 --target 28` | spoken VO + sign-off | 65 words, ≈ 24.8 s of speech. Flags: hook 3.8 s (accepted: the card is readable at f0 and "$300" is heard by ≈ 1.2 s, as ig1); "nothing concrete" in beats 5-7 (artefact: the screen shows $49 and the dots); "no loop" (answered visually: the seam re-forms the ringing desk and the blank slip). |
| `detect.py` | on-screen VO (display form) | 72.6 REVIEW: burstiness 0.47 (short, even spoken lines), every other check 77-100. With T1 + T2 applied: **75.1 PASS**. The spoken form scores lower only because spelled-out numbers do not count as concrete. |
| `humanize.py --report` | VO, both forms | nothing to strip, 0 structural tells |
| Captions, comments, DM | POSTING.md | all READY / PASS (POSTING §9) |

---

## 6. Price evidence (every figure on screen, with its source)

All outside pages read 2026-10-07 through the research fetcher (RESEARCH-prices.md). **Before posting, re-open by eye** the pages marked ●. Provider names are internal only: never on screen, in the VO, the captions or the comments.

| On screen / VO | Exact source line | URL | Grade · hedge |
|---|---|---|---|
| **"$300 a month"** + "That's a common agency retainer" | ● Trillet agency guide (updated 30 Sep 2026): "a common benchmark is a $300/month retainer per client, plus a setup fee and per-minute markup". ● Ciela (8 Jan 2026): "Starter receptionist: $1,500 to $2,500 setup, $300 to $450 monthly". Monthly floors across 8 sources (2 agencies' own pages + 6 guides): $150, $297, $300, $500, $500, $997, $1,000, $1,500, so **7 of 8 are ≥ $297**. | https://trillet.ai/blogs/voice-agent-pricing-strategy-guide · https://ciela.ai/blogs/how-much-to-charge-for-ai-voice-agent | B · "common" (the source's own word), spoken and printed on the tag. Never "every agency"; never "AI receptionists cost $300" (several AI apps cost $0-$49: the captions disclose it). Note: Trillet itself sells a $49 AI receptionist; it is never named or sent. |
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

- **Cover line:** **"Don't pay $300 a month."** (the hook, as ig1's cover was "Don't fire your receptionist.") with the attribution **"Agency retainer. / Ours: from $49 a month."** underneath, so the grid tile can't be read as "AI receptionists cost $300". Every word is spoken in the reel.
- **Custom PNG `IG5-Cover-9x16`** (all words inside x 86-900, y 260-1380):
  - **Ground:** pearl, with b4's sunday pool.
  - **Kicker:** `AI RECEPTIONIST · 05` (label role, x 86, y 270-300). It carries the search keyword and the series number.
  - **Title:** two lines, "Don't pay" / "$300 a month." ("$300" rose), x 86, y 330-620, at the largest size ≤ 128 px at which "$300 a month." fits 814 px (≈ 116 px).
  - **Attribution:** two lines at 44 px, graphite, y 640-760: "Agency retainer." / "Ours: from $49 a month." ("$49" teal, the orb as its full stop).
  - **Thumbnail:** the b4 payoff frame (the pile with all three anchors and their hedges, ours with "$49" and "No setup fee", the bars to scale) at × .6, y 790-1340. Its "$49" sits above y 1300, clear of TikTok's grid view count.
- **Instagram:** upload it in the composer (Edit cover → Add from camera roll). Fallback: frame 0.
- **TikTok:** upload the same PNG if the app offers "upload from photos"; otherwise pick the frame at ≈ f455 (15.2 s, the payoff) with no TikTok text sticker.

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
| Series coherence with ig1 | **PASS** | Same "Don't …" shape and desk; no wage, no "replace", no "fire"; the IG caption keeps "Keep your front desk for the work only people can do." |
| ≤ 6 words per card; every on-screen line spoken; hook in 0-2 s | **PASS** | 14 cards, the longest 6 words; chrome ≤ 32 px. The hook card is set at f0 with "$300 a month"; "three hundred" is heard by ≈ 1.2 s; "AI receptionist" is on screen by ≈ 2.4 s. |
| Combined safe zone | **PASS by layout** | §1.2; to be proved by `check-zones --film=ig5` once §1.3 lands. |
| Trial truth | **PASS** | "Free" never appears in the reel (booking is on screen, ig2's rule). The captions say the trial answers only test calls and doesn't book. |
| Secrets | **PASS** | No key read or printed; no Cartesia call in this run. |

---

## 10. Build notes carried from the judges

- `MUSIC.stop` and every stop-time cue come from the measured `vWord('ig5-04', 0)` / `vWord('ig5-04', 2)`, not plan frames (the line can move by +20 f).
- `ContactShadow` exists only in film 1 (`src/components/Atmosphere.tsx:338`); test it or use `meshElevation`.
- Sound names above are all in the series tables (`src/ig/common/series.ts` and film 1's `SFX`): there is no `fx-paper`, `keys`, `tap-0` or `fx-felttip-0`.
- The setup figure is 140 px so it stays ≥ 120 px after the × .88 step-back.
- Do not draw the ig2 `EventCard` (it carries a PRO chip); the booking proof is the record's ToolRow and pill.

---

## 11. Open owner confirmations

1. **Booking on Starter** works in the product and the pricing page says so (LAUNCH GATE, POSTING §0). Until then, build with `ig5-06-msg`.
2. **The live Stripe `STRIPE_STARTER_PRICE_ID` is $49.00 USD a month** (the repo can't show it).
3. **"(in beta)"** stays in the captions while the app badges booking as beta; say if the badge goes.
4. **Starter's minutes and overage** (site 400 min / $0.20 vs app 150 min / $0.25): settle them in the same pricing edit. The reel never shows them, but it sends viewers to that page.
5. **"Starter" in the caption fine print:** profile.md bans plan names except Pro; it is kept as the honest pointer to which plan "$49" means. Confirm.
6. **End-card URL:** keep the series' `neurotechvoice.com`, or change the shared end card to `www.` (that re-renders ig1-ig4's picture).
7. **The $1.15 spoken or not:** this script speaks the setup line; the spare `ig5-05-num` speaks the $1.15 instead.
8. **AGENT replies on TikTok** are by hand (no automation): someone answers within the hour on posting day.
