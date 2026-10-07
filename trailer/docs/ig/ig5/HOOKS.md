# ig5 · HOOKS (hook director)

Label `hook-director`. Written 2026-10-07 on `claude/remotion-trailer`. Planning only: this is the only file written. Nothing was committed, no Cartesia call was made, and no skill was edited.

**The owner's demand:** "trebuie un hook foarte foarte bun sa prinda utilizatorii de pe tiktok" ("it needs a very, very good hook that catches TikTok users").

**What I read:** the 16-hook shortlist with the 6-persona panel and its truth verdicts, `SCRIPT.md`, `RESEARCH-prices.md` §1, §2, §6 and §7, `RESEARCH-format.md` §0-§2 and §6, `drafts/judge-growth.md` §0-§2, `POSTING.md` §3, `voice.md` and `profile.md`. I also read the measured Tessa takes in `src/ig/ig5/voice.generated.ts` and `src/ig/voice.generated.ts`, and the ring rules in `src/ig/common/series.ts`.

**What I ran:** `hookscore.py` with `python3 -I`, in three forms, from a scratch folder:
- **raw:** the skill as shipped;
- **patched:** weak openers matched as whole words (the "yo" quirk);
- **strict:** patched, plus a capital after "." "?" or "!" no longer counts as a proper noun.

All three reproduce the shortlist's numbers. The raw output is in §7.

---

## 0. Verdict

**WINNER: callout-2, with a grafted handoff.**

| | |
|---|---|
| **On screen at frame 0** (3 lines, 6 words) | **Three rings.** / **Gloves on.** / **You can't.** |
| **Spoken by Tessa** (`ig5-01g`) | "Three rings. Gloves on. You can't." |
| **Handoff, beat 2** (`ig5-02g`, replaces `ig5-02`) | "Agency AI receptionist: three hundred a month, a common retainer. Setup, often fifteen hundred." |
| **Hookscore** | On screen 84.4 raw / 84.4 patched / 81.4 strict. Spoken 84.4. |
| **Panel** | **34.92**, first of 16 and 3.8 ahead of the next. Stop 7.5 (best), stay 6.17, trust 7.0 (joint best), act 3.67 (joint third, behind contrarian-3 and curiosity-6). |
| **Personas who picked it best** | 4 of 6: salon, dental, trades, scroller. None of the six picked it worst. |
| **Truth** | The hook has no figure. It is a count in the scene, not a claim. The panel's line 2 was refuted, so it is replaced by an agency-scoped line built on §6 #6 and #7 (B, "common" and "often"). |

**Runners-up** (for a later A/B re-cut):

1. **callout-3**, with the same handoff: "Closed at 9? / Your phone's not."
   - Panel 30.67. Stop 6.5, the second best in the set.
   - Same body as the winner, so the A/B changes only `ig5-01`.
2. **curiosity-3, fixed:** "Live answering: / 50 minutes costs you…", landing on "from $99 a month".
   - Panel 30.92. Stay 6.5, the best in the set.
   - It tests a different mechanism: a loop with a number in it.

**What the swap costs:**
- Two new takes: `ig5-01g` and `ig5-02g`, plus an alternate reading and a trim.
- A new b1 picture.
- The phone light moves from x 862 to x 740.
- The bed starts on the agency line instead of at f0.
- New cover words.

Beats 3-9 are unchanged.

---

## 1. WINNER: "Three rings. Gloves on. You can't."

### 1.1 Lines

| id | `say` | Cards (display form) | Tokens | Use |
|---|---|---|---|---|
| `ig5-01g` | Three rings. Gloves on. You can't. | S1 [0-5]: "Three rings." / "Gloves on." / "You can't." (one card, three lines, `set0`) | 6 | **Hook.** |
| `ig5-01g2` | Three rings, gloves on. You can't. | The same card. The display map shows "rings," as "rings." and "gloves" as "Gloves". | 6 | **Alternate reading**, about 0.3 s quicker: two breaths instead of three. |
| `ig5-02g` | Agency AI receptionist: three hundred a month, a common retainer. Setup, often fifteen hundred. | S2 [0-2] "Agency AI receptionist:" · S3 [3-9] "$300 a month, a common retainer." · S4 [10-13] "Setup, often $1,500." | 14 | **Beat 2**, replaces `ig5-02`. |
| `ig5-02gt` | Agency AI receptionist: commonly three hundred a month. Setup, often fifteen hundred. | S2 [0-2] · S3 [3-7] "commonly $300 a month." · S4 [8-11] | 12 | **Trim T1.** "commonly" keeps the hedge. |

**Display map:**
- `ig5-02g`: [3-4] "three hundred" shows as `$300`; [12-13] "fifteen hundred." shows as `$1,500.`
- `ig5-02gt`: [4-5] and [10-11], the same way.
- "Three" stays a word on screen.

**Direction for `ig5-01g`:**
- An owner naming a moment, not an ad: calm, close and dry.
- Three short falling sentences, with gaps of 0.25 s or less.
- No drama on "can't", but its **t must be released**. "You can" would invert the line, so re-take any read where it sounds like "can".

**Direction for `ig5-02g`:**
- Read it like the price list it is, the same shape as `ig5-03` ("Live answering service: …").
- Light stress on "three hundred" and on "often".

**Cast rule** (for `timing.ts` CASTS):
- Use `ig5-01g` if S2 rises by **f78 (2.6 s)**.
- Otherwise use `ig5-01g2`.
- If both make it, prefer `ig5-01g`.

**Trim ladder:** full → T1 (`ig5-02gt`) → T1 + T2 (`ig5-02gt` plus `ig5-05t`).
- Never cut "common" or "commonly", "often" or "a month".
- The incumbent cast (`ig5-01`, `ig5-01b`, `ig5-02`, `ig5-02t`, already installed) stays in the voice file as the A/B reserve.

### 1.2 Frame 0 (1080×1920; it must read as a scene before a word is spoken)

| Element | Geometry | Spec |
|---|---|---|
| Ground | full frame | `PearlGround` (MUTED_MESH, light), already drifting, warm key low-left. This is SCRIPT's ground, so the seam and b2-b4 stay the same. |
| Desk hairline | y 1130, x 86 → **758** | Graphite, 1.5 px. It draws with `EASE.draw` from f −6, so it is still moving at f0, and finishes at about f8. |
| The phone: rose line light | **(740, 1130)**, Ø 18 | `MeshOrb`, `MOMENT_LIGHTS.rush`. **Moved from x 862 to x 740** (one constant, `PHONE`), so the three rings sit clear of TikTok's right rail. At x 862 the outer ring would reach x 994, under the avatar and heart icons. |
| **Ring trio** (the frame-0 image) | Ø 72 / 156 / 240 around the light: x 620-860, y 1010-1250 | Three concentric rose hairlines, already in flight at f0. **Strokes** 3 / 2.25 / 1.5 px, inner to outer. **Ink** 85 / 60 / 35 %: the newest ring is the brightest. **New part:** a 3-ring variant of `Rings` (`src/ig/components/Orb.tsx`) with a linear fade and a 60 f life. The kit's quadratic fade leaves an older ring at about 6 % ink, which is unreadable. It is a pure function of t, with virtual launches at f −40 / −20 / 0. |
| **Card S1** | x 86 (flush left), y 400-760, at most about 650 px wide | Set at f0 at **72 % ink**. Headline role at **104 px**. "Three" in **rose** (the ringing phone's colour); the rest graphite. Typographic apostrophe in "can't". Lines: "Three rings." y 400-504 · "Gloves on." y 528-632 · "You can't." y 656-760. |
| Nothing else | | No slip, no orb, no chrome, no price. |

**The read at frame 0, with the sound off:** a light on a desk with three rings coming off it, and "Three rings. Gloves on. You can't."
- It reads in under a second as a phone you can't reach.
- No product, no price.
- The scroller persona: "the least ad-like in the set".

**Zones:**
- All text sits inside x 86-900, y 240-1400, which is tighter than the brief's x 60-940, y 220-1440.
- Every object sits at x 880 or less below y 840 (SCRIPT §1.2).
- Everything is inside the 3:4 grid crop (y 240-1680).

### 1.3 Frames 0-90 (30 fps timeline; onsets estimated, `timing.ts` re-anchors them to the take)

| Frame | Picture | Text | Sound |
|---|---|---|---|
| −6 | The hairline starts drawing. The mesh is drifting. | | |
| **0** | Ring trio as in §1.2. The light is lit. | S1 set at 72 % | **`fx-trill`** (the third ring) over `fx-roomtone-desk`. **No bed.** |
| 0-15 | **First 0.5 s:** the inner ring travels out (Ø 72 → about 130), the middle and outer rings travel on and thin, and the outer ring is gone by f20. The hairline reaches the light at f8. | | The trill rings out by f10 (`RING_OUT`). |
| ≈ 10 | | "Three" lifts 72 → 100 % (4 f, `EASE.out3`) | First word at f10 or later (`afterRing(0)`) |
| ≈ 17 | | "rings." lifts | |
| R1 | A new `RingPulse` leaves the light (the desk law, Ø 18 → 240). | | `fx-trill` at −8 dB. **R1 = `ringBefore(vWord(hook, 2))`**, only if no onset falls in (R1 − 6, R1 + 10). Otherwise R1 goes in the "on." → "You" gap, under the same test. Otherwise there is no ring. **Never** on or right after "can't": it would mask the t. **Exception (critic round 1, S2):** the onset-only test put R1 at f30 on the nasal tail of "rings." (≈ 0 dB over it, whole-word SII 0.33). R1 is now the one chirp `fx-trill-1` on the first 16th of the "rings." → "Gloves" gap where her placed envelope is under `CUT.onset` for the whole chirp and no onset falls in (R1 − 6, R1 + 5): **f37.5** (`timing.ts` `ringFits`). The later rings follow the same burst-aware law (f153.75 chirp, f408.75 full trill). |
| ≈ 32-45 | The middle ring is gone by f40. | "Gloves", "on." lift | |
| ≈ 52-64 | The inner ring is gone by f60. | "You", "can't." lift | The t is audible. |
| ≈ 70-80 | **Exit:** S1 leaves up through its masks, line by line, 2 f apart and 4 f each (`EASE.in`), starting no earlier than `vWord(hook, 5) + 6`. | | |
| `LINE.agency` − 6 | **Slip 1 rises** (SCRIPT's blank slip G3, moved here from f0): white `DocPage`, perforated top, −1°, x 120-880, y 360-640, an ink bar and an empty amount slot, `SPRING.site`. | | `fx-paper-square` |
| `LINE.agency` + `vWord(0)` − 2 (≈ f78-90) | | **S2 "Agency AI receptionist:"** rises in the caption band (y 1170-1270) at 72 %. **It rises only after S1 has left** (one moving text at a time). *Built since critic round 1 (P4): the words rise on slip 1's tag instead (AGENCY AI RECEPTIONIST as a unit at 72 %, 2 f before "Agency", each word lifting on its onset), the band empty in b2-b3, so every word is on screen once.* | **The bed enters** on the first beat at or after `ig5-02g` word 0 (the stub arrangement in E, −6 dB): the reel's first music. **Exception (critic round 1, S5):** that beat (f105) fell mid-"Agency" on no picture event; the bed now enters on the first beat at or after slip 1 rises (`upBeat(M.slip1)`, **f90**: the "can't." → "Agency" gap, with the paper's lift). The hook (0-86) stays bed-free. |
| words 0-2 | The slip's ink bar sweeps into the tag **AGENCY AI RECEPTIONIST** (label 30, graphite 70 %, `InkSweep`). | | `fx-felttip-short` |

From here, SCRIPT b2 runs as written (§1.6).

### 1.4 Sound, in one line

The first sound is a phone ring in a quiet room. Tessa's three short sentences sit in room tone. At most one more ring falls in a gap. The music arrives only with the first quote, so the hook is the silence a busy owner hears.

The SCRIPT's later rings (f150 and f285, re-anchored off every onset) keep the phone ringing, unanswered, until `fx-pickup` on "Ours?".

### 1.5 Keyword timing

| Keyword | On screen | Heard |
|---|---|---|
| "AI receptionist" (S2 and the slip's tag) | **≈ 2.5-2.9 s** with `ig5-01g`, **≈ 2.3-2.6 s** with `ig5-01g2`. The cast rule above keeps it at 2.6 s or earlier whenever a take allows. | ≈ 3.0-3.6 s |
| A price ("$300 a month") | ≈ 4.3-5.0 s (S3, and the roll in the slot), after the label is read | ≈ 4.3-5.0 s |

**Honest note:** the incumbent puts "AI receptionist" on screen about 0.4 s earlier (its S2 rises at about f65 = 2.2 s with the installed take), and its "$300" is on the f0 card and heard at 1.1 s. The winner trades both for a frame 0 that is complete on its own: its frame-0 number is the drawn ring count, and the first price comes at about 4.5 s (§5).

The TikTok caption already opens "AI receptionist cost, side by side…" (POSTING §3), and the cover kicker carries the keyword.

### 1.6 Handoff into beat 2 (how b2 picks it up)

**Slip 1 is the agency quote, as in SCRIPT.** Only the words that arrive and the text layout on the slip change:

- **Tag** (y 385-420): AGENCY AI RECEPTIONIST, on words 0-2.
- **Figure row** (slot y 440-600):
  - "$300" (140 px, rose, tabular) rolls 0 → 300 on "three hundred": `Roll`, 32nd ticks, about 0.6 s, `SPRING.land`, with a `thump`.
  - To its right, a column at x 510-860:
    - "a month," (44, y 500-544);
    - "a common retainer" (36, graphite 70 %, y 552-590), on words 7-9.
- **To-scale hairline:** 600 px from $0 at x 160 (y 615), unchanged.
- **On "Setup":** the stub drops onto the slip's lower right edge and is stapled there (`thump` + `fx-tag`). It reads "SETUP, OFTEN $1,500", and the figure rolls. Unchanged from SCRIPT b2.

**Then:**
- **b3** (live answering, $99 a month for 50 minutes) is unchanged.
- **b4** "Ours? From $49 a month. No setup fee." is unchanged. The light that has rung since frame 0 is picked up on "Ours?" (G2), so **the hook's "You can't" is answered by the product**.
- **b6** "It picks up when you can't" is unchanged. It is a deliberate callback to the hook, not a repeated line.

**The checks:**

| Check | Result |
|---|---|
| Same numbers | **Yes.** The hook has no figure. $300 a month and $1,500 setup arrive once, in b2, then $99 for 50 minutes (b3), then from $49 and no setup fee (b4). These are SCRIPT §6's figures, unchanged. |
| No repeated line | **Yes.** The incumbent's "Don't pay $300 a month" and "That's a common agency retainer." are gone. "common" now lives in `ig5-02g`. |
| The contrast still pays off | **Yes.** It runs $300 → $1,500 → $99 → $49, with every monthly figure on one scale from $0. "No setup fee." sits in the same column as the setup stub. |

**The b4 pile:** its legible hedges are now "AGENCY AI RECEPTIONIST", "a common retainer", "SETUP, OFTEN", "Live … from … a month, for 50 minutes". The list in SCRIPT b4 needs this update.

**Rejected handoffs:**

| Handoff | Why not |
|---|---|
| **H-a, the panel's own line with its truth fix:** "Live answering services: over a dollar a minute." / card "Live answering: $1+ a minute." (§6 #4, A; 78.7 as one line with the hook) | (1) Three of the six personas named this turn as the weak seam ("a second video", "lets me down", "I wanted to hear what answers instead"). (2) Muted, "$1+" next to "$49 a month" reads backwards, as if the answering service were cheaper, and a per-minute figure can't sit on the monthly scale (SCRIPT §9). (3) It would show the answering service twice (hook and b3), or force a reorder. Kept only as the fallback if the owner wants the panel-tested words. |
| **"An AI receptionist can." before the agency line** (the can't → can turn) | About 1.3 s more speech, and the budget below has no room for it. |

### 1.7 Timing budget

The installed full cast ends the CTA at f753, with 12 f to spare before the f765 limit.

**Estimate:**

| | Speech | Line ends |
|---|---|---|
| Incumbent pair (`ig5-01` + `ig5-02`) | 3.46 + 4.05 s | f246 |
| New pair (`ig5-01g` at about 2.1-2.4 s, a gap of at least 10 f, `ig5-02g` at about 6.2-6.9 s) | | ≈ f271-292, i.e. **+25 to +46 f** |

So expect rung T1, or T1 + T2. T2 drops "in under ten minutes" from the voice-over only; it stays in both captions. The impact stays on **f780** and the reel stays **28.0 s**.

**Settings for `timing.ts`:**
- `PLAN.lines.agency` must follow the hook (`place` from its voiced end, about f85), **not the old f124**.
- `MUSIC.bedFrom` moves from 0 to the agency line's first beat.
- `TITLE` becomes "Three rings". The slug can stay `dont-pay-300`, to spare the pipeline renames.

### 1.8 Cover

SCRIPT §7's cover line "Don't pay $300 a month." is no longer spoken, so it can't be the cover.

**New custom PNG `IG5-Cover-9x16`** (all words inside x 86-900, y 260-1380; every word is spoken in the reel):

- **Ground:** pearl.
- **Kicker:** `AI RECEPTIONIST · 05` (label role, y 270-300). It carries the search keyword.
- **Title** (x 86, y 330-700, about 112 px, "Three" in rose):
  - "Three rings." / "Gloves on." / "You can't."
  - The ring trio sits to the right of line 1.
- **Attribution** (two lines at 44 px, y 720-830):
  - "Agency AI receptionist: $300 a month." ("$300" in rose)
  - "Ours: from $49 a month." ("$49" in teal, with the orb as its full stop)
- **Thumbnail:** the b4 payoff frame at × .6, y 850-1380. Its "$49" sits above y 1300.

> **Superseded by SCRIPT §7 and the built cover (critic round 1, T8 / P6 / T4).** The attribution is THREE hedged rows: "Agency AI receptionist:" / "commonly $300 a month." / "Ours: from $49 a month." — RESEARCH-prices §6 #6 is a B claim that needs "commonly" wherever $300 shows, so the unhedged "Agency AI receptionist: $300 a month." above must never be built. There is **no thumbnail** (at grid size its labels were ≈ 4-11 px and its "$99" lost "for 50 minutes", the §7 row 3 shape): the cover is a title plus one graphic, as ig1-ig4. **Since critic round 2 (P1) the graphic is frame 0's picture in the lower half** (the desk hairline y 1130, the rose light at (740, 1130), the full-size ring trio Ø 72 / 156 / 240, frame 0's ground), not a small trio right of line 1: the 3:4 tile had shown ≈ 52 % bare pearl. Any A/B cover "as §1.8" (§2's runner-up) inherits this.

**TikTok's feed autoplays from frame 0, which is the hook picture itself.** So for TikTok the cover matters only on the profile grid and in search:
- upload the PNG;
- otherwise use the payoff frame between 17.45 and 17.55 s (f524–526), as POSTING §3 says (critic round 3, TRUTH-R3-7: at f521 "fee." is still rising, and from f528 the pile fades out; critic round 2, TRUTH-R2-4 / SYNC-B, had moved the window 3 f);
- the IG composer's fallback, frame 0, is now a usable cover.

### 1.9 Truth and voice checks

| Check | Result |
|---|---|
| Figures (RESEARCH-prices §6) | The hook has none. `ig5-02g`: "$300 a month, a common retainer" is §6 #6 (B: 7 of 8 monthly floors are $297 or more; Trillet calls $300 "a common benchmark"; Ciela gives "$300 to $450 monthly"). "Setup, often $1,500" is §6 #7 (B: the median setup floor is $1,500). |
| §7 (not defensible) | **Row 2** ("other platforms charge hundreds"): avoided, because the label scopes the price to *agency* builds from its first word. The incumbent's "for an AI receptionist" attached $300 to the whole category until about 4 s (truth note). **Not used:** "cheapest", a saving or percentage, "replace" or "fire", minutes, "all-in", "$5,000", competitor names. The caption's selection disclosure ("we didn't compare self-serve AI receptionist apps") stays. |
| Own price list | "Your Business plan is $499" can't contradict a line that describes agency builds and gives no advice. The incumbent's "Don't pay $300 a month" could be contradicted that way (truth note b). |
| ig1 | **Consistent.** Nobody is replaced and there is no wage. "Gloves on" is the work only people can do (voice.md position 5), and b6 answers it with "picks up when you can't". |
| Stories and testimonials | None. It is a second-person moment, not "a client told me". |
| Voice | Calm and specific. No hype words, no "stop scrolling", no shouting. |

### 1.10 Risks, and what QA checks

1. **This hook family has no TikTok record on this account.**
   - The account's TikTok views: **ig1 563**, trailer 283, **ig2 250**, ig4 245, **ig3 174**.
   - **ig3**'s hook, "Twelve minutes on the colour. You can't touch the phone.", is this hook's sibling, and it is the lowest.
   - ig2's "Nine forty-seven. You're closed." is a scene hook too.
   - My read: only ig1 stands out from the noise. What it alone had was a stance (an AI company saying "Don't fire your receptionist… Not even ours"). Keyword-first ig4 did no better than the scene hooks.
   - **How this hook differs from ig3:**
     - 6 words and about 2.2 s, against 10 words and 3.2 s;
     - it names the moment for dental, salon, tattoo, vet and trades owners, not only colourists;
     - the number at frame 0 is drawn on screen (three rings);
     - it reaches "AI receptionist" by about 3 s and a price by about 4.5-5 s, where ig3 named neither the product nor a price in its first 8 s.
   - The incumbent stays installed as the reserve (§6).
2. **"can't" heard as "can".** Listen on a phone speaker. The card is the backstop.
3. **The keyword is at the edge of the brief** (§1.5). Hold it with the cast rule.
4. **Restaurants:** "Gloves on" fits a kitchen less well than a clinic (restaurant persona). A later trade variant can read "Three rings. Hands full. You can't." (84.4, same scores).
5. **QA:**
   - The frame-0 still is legible at 30 % scale (the three rings are countable).
   - `check-mix` shows no ring on an onset.
   - S1 is fully gone before S2 rises.
   - `check-zones --film=ig5` passes once SCRIPT §1.3 lands.

---

## 2. Runner-up 1: callout-3 "Closed at 9? Your phone's not."

**Same body as the winner (`ig5-02g`), so the A/B changes only the hook take and the frame-0 picture.**

- **Lines:**
  - `ig5-01n`: "Closed at nine? Your phone's not." (6 tokens). Card S1 [0-5] at f0: "Closed at 9?" / "Your phone's not." Display: [2] "nine?" shows as "9?".
  - Alternate reading `ig5-01n2`: the same text read flat, as a statement (no rise on "nine"), for a drier take. Cast whichever take lands "not" clearly. A different wording would need a new card: "…phone isn't." drops the stake word (STAKES 20), and "…phone is not." makes a 7-word card.
  - Direction: a small rise on "nine?", then a dry, falling "not."
- **Fix applied:** the panel line's "Answering services: from ninety-nine, for fifty minutes." has no "Live". That is refuted on the same grounds as callout-2 and curiosity-3, because AI answering services sell 60 minutes for $29. It is replaced by `ig5-02g`. If the panel line is ever used, it must be SCRIPT `ig5-03` verbatim ("Live answering service: from ninety-nine a month, for fifty minutes.").
- **Frame 0:**
  - `NightGround` (INK_MESH, deep: ig2's ground).
  - **A white sign card** (`Panel`, x 200-760, y 380-600) hangs from two hairline strings from y 240. It is already swinging ±2° (started f −10; θ = 2°·e^(−t/0.6 s)·cos(2πt/1.1 s)).
  - On it, "Closed at 9?" (title 88, graphite, "9" tabular) at 72 %. Under it, "Your phone's not." (headline 80, pearl ink, y 680-780).
  - The desk hairline (pearl, 35 %) at y 1130, and the rose light at (740, 1130), the only warm colour, with a `RingPulse` in flight.
- **First 0.5 s:** the sign's swing settles, the ring expands, and "Closed" lifts at about f10.
- **Sound:** `fx-trill` at f0 with a short room tail (a phone ringing in a closed shop). No bed until `ig5-02g`.
- **Keyword:** the hook is about 1.9 s, so S2 "Agency AI receptionist:" rises at about **2.4-2.6 s**. That is inside the brief, and earlier than the winner.
- **Handoff:** on `ig5-02g` word 0, the sign lifts out up through its mask, and the ground crosses night → pearl over 12 f on the bed's first downbeat ("the lights come on for the quotes"). Slip 1 rises. From there it is §1.6.
  - The seam re-forms the night ground and re-hangs the sign in the last 14 f.
  - A cheaper fallback is a pearl frame 0, which loses the contrast every persona mentioned.
- **Cover:** as §1.8, with the title "Closed at 9? / Your phone's not." on night.
- **Scores:**
  - Hookscore: on screen 84.4 / 84.4 / 81.4; spoken (hook) 84.4.
  - Panel: stop 6.5, stay 5.33, trust 6.67, act 3.0, total 30.67.
  - Salon: "the calmest, most true-to-me line". Agency: "the best-written line here".
- **Truth:** no figure ("9" is a closing time in the scene). No "24/7" or "never misses" claim. b6 "It picks up when you can't" is S8.
- **Risks:**
  - It reads as ig2's sibling (night ground, a closing hour; 250 TikTok views).
  - "9" is wrong for a clinic that closes at 6 and a restaurant in full service. Trade variants can change the hour.
  - The night ground adds build cost.

---

## 3. Runner-up 2: curiosity-3, fixed: "Live answering: 50 minutes costs you…"

**A different mechanism from the winner** (a loop with a number in it), so it is the informative A/B if the scene family underperforms.

- **Lines:**
  - `ig5-01a`: "Live answering: fifty minutes costs you…" (6). Card S1 [0-5] at f0: "Live answering:" / "50 minutes costs you…" Display: [2] "fifty" shows as "50".
  - `ig5-01a-pay`: "From ninety-nine a month." (4). It is placed on the 16th at or after `voiceEnd(ig5-01a)` + 9 f (a 0.3 s hold) and printed on the slip. Display: [1] "ninety-nine" shows as "$99".
  - Two takes, so the hold is ours and not Sonic's. Alternate reading: one take, "…costs you… from ninety-nine a month." (80.0), if the measured pause is 0.25-0.4 s.
- **Fix applied** (the truth verdict):
  - "Answering service" becomes **"Live answering"**.
  - The landing value is "from $99 a month", never a bare "$99". That makes it §6 #2 (A: at least $99 for 50 minutes at all 10 US live services).
  - "50 minutes" is in the hook, so §7 row 3 is met.
- **Frame 0:**
  - Slip 1 is the **live-answering** quote: white paper with the 6 px graphite people stripe, x 120-880, y 360-640.
  - Its tag is an ink bar. Its amount slot shows a two-digit odometer spinning in 32nds: no "$", never resting on a value.
  - The desk hairline with the ringing rose light.
  - S1 at 72 % (x 86, y 670-900): "Live answering:" (headline 92) over "50 minutes costs you…" (80, "50" tabular).
- **First 0.5 s:** the odometer spins, the ring expands, and "Live" lifts at about f10.
- **Sound:** `fx-trill` at f0 and the bed from f0 at −6 dB, with `fx-tick` 32nds under the spin. **Stop-time on the ellipsis** (`MUSIC.stop` for 0.3 s, `fx-roomtone-desk`). Then `thump` + `fx-tock` as "$99" lands on "ninety-nine", and the bed returns.
- **Slip text:**
  - The tag LIVE ANSWERING writes on words 0-1.
  - "50 minutes" (44) on words 2-3.
  - "from" + "$99" (140, rose) + "a month" on the payoff.
  - Then its hairline draws 198 px.
- **Keyword:** "Live answering" is on the f0 card and heard at about 0.3-1.0 s. "AI receptionist" comes with `ig5-02g` at about 4.5 s.
- **Handoff:**
  - b2 is `ig5-02g`. The agency quote becomes **slip 2**, at y 700-980, with the stub at x 360-880, y 940-1110.
  - **b3 is dropped** (the answering service was the hook).
  - b4's pile becomes two slips and the stub. The payoff is unchanged.
  - The reel shortens by about 4 s (about 24-26 s, inside 22-28), so no trims are needed.
- **Scores:**
  - Hookscore: on screen 81.4 / 81.4 / 81.4; spoken 81.4 (80.0 with the payoff).
  - Panel: stop 5.67, **stay 6.5 (best)**, trust 7.0, act 2.83, total 30.92.
  - Scroller: "the best stay in the set". Dental: "my exact experience".
- **Risks:**
  - The lowest act score of the three.
  - Salon and restaurant owners: "not my pain".
  - Commenters will ask "how many minutes do you get?". Answer from POSTING (from $49 a month; minutes past the allowance billed per minute), never with a number.

---

## 4. Full ranked table

The weighted panel total is stop ×2, stay ×1.5, trust ×1, act ×1, over 6 personas. Hookscores are from §7; the spoken score is for the form the panel heard. "Refuted" means the truth pass found a false claim, and its minimal fix must be applied.

| # | id | On screen (as tested) | HS screen raw / patched / strict | HS spoken | Stop | Stay | Trust | Act | **Panel** | Truth | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **1** | **callout-2** | Three rings. Gloves on. You can't. | 84.4 / 84.4 / 81.4 | 81.6 | **7.5** | 6.17 | **7.0** | 3.67 | **34.92** | Refuted (line 2 only: no "Live") | **WINNER.** Hook unchanged. Line 2 replaced by `ig5-02g` (§1.6). |
| 2 | callout-3 | Closed at 9? Your phone's not. | 84.4 / 84.4 / 81.4 | 81.6 | 6.5 | 5.33 | 6.67 | 3.0 | 30.67 | Not run; same "Live" defect in its line 2 | **Runner-up 1.** Handed to `ig5-02g`. |
| 3 | curiosity-3 | Answering service: 50 minutes costs you… | 81.4 / 81.4 / 81.4 | 81.4 | 5.67 | **6.5** | **7.0** | 2.83 | 30.92 | Refuted (no "Live"; bare $99) | **Runner-up 2**, fixed: "Live answering", landing on "from $99 a month". |
| 4 | contrarian-2 | $300 AI receptionist? Only if you… | 100 / 100 / 87.0 | 84.4 | 5.83 | 6.17 | 6.67 | 3.5 | 31.08 | Refuted ("Only" is false: our own $499 and $990 plans; "$300" reads as one-time) | Out. The fix "$300/mo AI receptionist? Fair, if you…" scores 84.4 on screen, but the spoken fix is 11 words and **58.4 OK** (STAKES 20). Dental and trades say the condition argues *for* the $300. |
| 5 | price-1 | $1,500 before your AI receptionist answers? | 87.0 / 87.0 / 87.0 | 84.4 | 6.17 | 5.5 | 5.33 | 3.67 | 29.58 | Refuted (a loaded "your") | Out. The scoped fix scores 63.2 / 61.2 OK. |
| 6 | contrarian-1 | AI receptionist? You don't need $1,500. | 100 / 100 / 87.0 | 84.4 | 6.17 | 5.17 | 5.5 | 3.33 | 28.92 | Not refuted ("upfront" advised) | Reserve. "…$1,500 upfront." is a **7-word card**, over this reel's limit. Scroller and salon leave on "AI receptionist?". |
| 7 | callout-1 | No receptionist? You don't need $300/mo. | 100 / 100 / 87.0 | 88.0 | 6.0 | 4.67 | 5.33 | 3.17 | 27.5 | Not refuted | Reserve. "$300/mo" has no object until about 3.5 s, and the line is about 5 s. Dental: "I have a front desk". |
| 8 | curiosity-6 | Our AI receptionist: $49/month. The catch? | 80.8 / 80.8 / 77.8 | 43.4 WEAK | 4.83 | 5.5 | 5.33 | 4.0 | 27.25 | Not refuted ("from" needed) | Out. It opens on "Our" (reads as an ad) and gives up the anchor. Restaurant's best. |
| 9 | incumbent-A | Don't pay $300 a month | 85.8 / 85.8 / 85.8 | 83.2 | 5.83 | 4.83 | 4.83 | 3.17 | 26.92 | Not refuted (needs `ig5-02` uncut and the caption disclosure) | **Baseline, kept installed.** See §5. |
| 10 | curiosity-4 | What $300 vs $49 gets you | 100 / 100 / 100 | 84.4 | 5.67 | 5.0 | 4.83 | 3.17 | 26.83 | Refuted (no units; bare $49) | Out. The keyword arrives at about 2.9 s. |
| 11 | contrarian-3 | Should your AI receptionist cost $300? | 87.0 / 87.0 / 87.0 | 100 | 4.83 | 4.33 | 6.17 | **4.17** | 26.5 | Refuted (no unit) | Out. With the unit it is 9 spoken words. Personas: "I don't have one". |
| 12 | price-5 | Don't pay $99 for 50 minutes | 94.8 / 94.8 / 94.8 | 78.8 | 5.5 | 4.5 | 6.17 | 2.5 | 26.42 | Refuted ("Don't pay" a people-staffed service; no "Live") | Out. The fix is the "Before you pay…" advice frame (100 / 80.0). |
| 13 | callout-5 | Six chairs full? You can't answer. | 84.4 / 84.4 / 81.4 | 73.0 | 5.5 | 4.33 | 5.0 | 2.83 | 25.33 | Not refuted | Out. Payoff-first, a 5.8 s line, salon-only ("I fix boilers"). |
| 14 | price-3 | Keep your receptionist. Don't pay $1,500. | 100 / 100 / 87.0 | 84.4 | 5.0 | 4.0 | 5.67 | 2.67 | 24.33 | Refuted (reads as the receptionist's pay) | Out. "…No $1,500 setup." would fix it (87.0). Worst for restaurant. |
| 15 | contrarian-4 | AI receptionist quote? Before you sign… | 81.4 / 81.4 / 52.2 | 81.4 | 4.0 | 4.33 | 6.5 | 2.5 | 23.5 | Not refuted (drop "…read line two") | Out. No number at f0, and only for owners already holding a quote. |
| 16 | contrarian-6 | Don't trust AI receptionist price videos. | 51.0 / 51.0 / 51.0 | 85.8 / 85.8 / 54.6 | 3.67 | 3.83 | 5.5 | 2.17 | 20.75 | Refuted (cynical; a sources promise we can't keep) | Out. |

**Why runner-ups 1 and 2 are ordered this way:** the brief prefers stop power with the scroller, trades and salon personas, as long as agency trust holds.
- callout-3 stops harder than curiosity-3 (6.5 against 5.67) with those three personas.
- The agency persona has nothing to fight in either.
- The panel totals are a tie (30.67 against 30.92).

---

## 5. Why the winner beats the incumbent "Don't pay $300 a month for an AI receptionist."

1. **It stops more people, and the right ones.**
   - Panel 34.92 against 26.92 (+30 %).
   - Stop power, the ×2 criterion, is 7.5 against 5.83: the widest gap in the set.
   - Four personas name it their best, including all three the brief weights (scroller, trades, salon). None name the incumbent best.
   - The incumbent's failure is the one all six personas describe in some form: **"for what?"**
     - "Don't pay $300 a month" carries no object until S2 at 2.2 s, and the installed take says "AI receptionist" at 2.55-2.8 s.
     - In those two seconds it reads as "every insurance or software ad", "truck insurance?", "a phone plan or an accountant".
     - The winner's frame 0 is complete on its own: a ringing phone you can't reach.
2. **It is shorter.**
   - 6 words, about 2.2 s, against 10 words: the measured take is 3.46 s, past the brief's 3 s.
   - It sits inside the ≤ 7 words, ≤ 3 s limit.
3. **It is truer in the first 4 seconds.**
   - The incumbent's "for an AI receptionist" attaches $300 to the whole category until `ig5-02` says "agency". Our own $499 plan also contradicts its advice.
   - The winner's hook makes no claim, and its first figure is scoped ("Agency AI receptionist") from its first word.
4. **It drives the whole reel.**
   - "You can't" sets up the phone that rings through every quote.
   - The pickup on "Ours?" and b6's "It picks up when you can't" answer it.
   - The incumbent's "Don't pay" is answered only by a price.
5. **What the incumbent keeps:**
   - ig1's "Don't …" shape, the only clear TikTok outlier on the account.
   - A price on the frame-0 card, heard at 1.1 s. The winner's first price comes at about 4.5 s. RESEARCH-format §2.1 wants a number, or the promise of one, at frame 0; the winner's is the drawn count of three rings, not a price.
   - A keyword about 0.4 s earlier.
   - Zero swap cost.
   - The scorer can't separate the two (85.8 against 84.4 on screen, 83.2 against 84.4 spoken; its AUC between good hooks is 0.56).
   - So it stays recorded (`ig5-01`, `ig5-01b`, `ig5-02`, `ig5-02t`) as the reserve. If the winner's 3-second hold on TikTok comes in under ig1's, the cheapest next test is `ig5-01b` on the incumbent body.

---

## 6. A/B order (TikTok first)

| Post | Hook | Body | What it tells us |
|---|---|---|---|
| **A, launch** | callout-2 | `ig5-02g` body | Does a scene hook hold when the keyword comes at about 3 s and the price at about 5 s? |
| B, a week later | curiosity-3 if A's average watch time is below ig1's, otherwise callout-3 | `ig5-02g` body (curiosity-3 drops b3) | A different mechanism, or the same mechanism with a different scene. |
| Reserve | incumbent `ig5-01` or `ig5-01b` | SCRIPT body as written | ig1's stance shape, already built. |

Measure against ig1 on the same TikTok numbers: 2-second and 3-second hold, average watch time, and AGENT comments per 1,000 views. Keep the comment-reply plan in POSTING §3.

---

## 7. Hookscore runs (2026-10-07, `python3 -I`; columns raw / patched / strict)

```
-- the winner, its readings and its handoff --
 84.4  84.4  81.4  STRONG weakest STAKES 70   Three rings. Gloves on. You can't.
 84.4  84.4  81.4  STRONG weakest STAKES 70   Three rings, gloves on. You can't.
 84.4  84.4  81.4  STRONG weakest STAKES 70   Three rings. Hands full. You can't.
 76.6  76.6  76.6  STRONG weakest LENGTH 55   Three rings. Gloves on. You can't. Agency AI receptionist: $300 a month, a common retainer.
 67.3  67.3  67.3  OK     weakest LENGTH 44   (the same, spoken form; LENGTH only: two lines scored as one hook)
 46.5  46.5  46.5  WEAK   weakest STAKES 20   Agency AI receptionist: three hundred a month, a common retainer. Setup, often fifteen hundred.  (body line, not a hook)
 78.7  78.7  78.7  STRONG weakest LENGTH 66   Three rings. Gloves on. You can't. Live answering services: over a dollar a minute.  (H-a, rejected)
-- runners-up --
 84.4  84.4  81.4  STRONG weakest STAKES 70   Closed at 9? Your phone's not.
 84.4  84.4  81.4  STRONG weakest STAKES 70   Closed at nine? Your phone's not.
 81.4  81.4  81.4  STRONG weakest STAKES 70   Live answering: 50 minutes costs you…
 81.4  81.4  81.4  STRONG weakest STAKES 70   Live answering: fifty minutes costs you…
 80.0  80.0  80.0  STRONG weakest STAKES 70   Live answering: fifty minutes costs you… from ninety-nine a month.
-- truth fixes of the others --
 84.4  84.4  81.4  STRONG weakest STAKES 70   $300/mo AI receptionist? Fair, if you…
 58.4  58.4  58.4  OK     weakest STAKES 20   Three hundred a month for an AI receptionist? Fair, if you…
 63.2  63.2  63.2  OK     weakest ADDRESS 35  $1,500 before an agency AI receptionist answers?
100.0 100.0  87.0  STRONG weakest LENGTH 100  AI receptionist? You don't need $1,500 upfront.   (7 words on the card)
 87.0  87.0  87.0  STRONG weakest SPECIFICITY 75  Keep your receptionist. No $1,500 setup.
-- baselines --
 85.8  85.8  85.8  STRONG weakest SPECIFICITY 75  Don't pay $300 a month
 83.2  83.2  83.2  STRONG weakest STAKES 70   Don't pay three hundred a month for an AI receptionist.
 84.4  84.4  84.4  STRONG weakest STAKES 70   Before you pay three hundred a month for an AI receptionist.
 87.0  87.0  55.8  STRONG weakest SPECIFICITY 75  Don't fire your receptionist for an AI. Not even ours.  (ig1)
```

Scorer caveat (the skill's own): the AUC between good hooks is 0.56. Every hook above 80 is a tie as far as the script can tell, so the panel, the truth pass and the retention graph decide.
