# ig5 · draft A · "Don't pay $300" (the bill stack)

Label `draft-A`. Written 2026-10-07 on `claude/remotion-trailer` (HEAD `f7daf7c`). Planning only: this file is the only one written; nothing committed.

Built on `ig5/RESEARCH-prices.md`, `ig5/RESEARCH-product.md`, `ig5/RESEARCH-format.md`, `ig5/PIPELINE.md`, `docs/ig/SCRIPT.md` §0.3, the owner's calendar decision and the TikTok numbers of 2026-10-07.

---

## 0. The reel in one table

| | |
|---|---|
| **Angle** | The quotes a business gets for covering its phone when nobody can pick up pile up on the desk as paper slips: an agency's AI receptionist (retainer + stapled setup fee) and a live answering service. Then one teal slip lands in front of them: $49 a month. The pile steps back but stays readable. Nothing is struck through or totalled. |
| **Hook (0-2 s)** | Frame 0 already shows **"Don't pay $300 a month"** at 72 % ink over the ringing desk phone, and Tessa says "three hundred" at about 1 s. Spoken: "Don't pay three hundred a month for an AI receptionist." Hookscore **85.8 STRONG** (§5). The keyword "AI receptionist" is on screen by ~2.3 s. |
| **Series echo** | ig1, the TikTok winner, opened "Don't fire your receptionist for an AI." ig5 opens "Don't pay $300 a month for an AI receptionist." It uses the same "Don't …" shape and the same desk hairline with its rose phone light. The two reels agree: keep your people, and don't overpay for the hours they're gone. No wage figure appears anywhere. |
| **Length** | **28.0 s** (840 f at 30 fps, 3360 at 120 fps). Impact f780, END f840. If the takes come in short, it drops to **26.0 s** (impact f720). Both are inside 22-28 s. |
| **Words** | 60 spoken before the sign-off (ig1 had 63 and delivered at 28.0 s). |
| **$49 lands** | "Forty-nine dollars" at ≈ 12.4 s = **44 %** of 28 s. It sits still and teal while the anchors stay visible. |
| **CTA** | "Comment AGENT for the link." at 79 %, on the shared `IgEnd`. The reel never says "free", because booking is on screen (ig2's precedent). The trial goes in the captions and the DM. |
| **Launch gate** | The reel shows booking at $49. **Post only after Starter booking works in the product and the pricing page says so.** A no-booking line (`ig5-06-msg`) lets it go out earlier (§4, §9). |
| **Platforms** | TikTok first (60 fps copy), then Instagram. One combined safe zone (§1). |

---

## 1. Safe zone (TikTok + Instagram, tightened)

What I checked (WebSearch, 2026-10-07):
- **TikTok's in-feed guide.** The labelled 720×1280 file gives top 160, bottom 440, sides 80, plus a 120 px action column from y 560. Scaled to 1080×1920 that is top 240, bottom 660 (text above y 1260), sides 120, and a 180 px column from y 840 (AdKit, scaled from ads.tiktok.com).
- **Organic TikTok guides.** The right rail is about 120-242 px. The bottom 320-400 px holds the caption, handle and sound (Reap, Sept 2026; TryMyPost, Feb 2026).
- **Instagram.** The series `ZONES` are top 240, bottom 1520, and a rail at x > 906 for y 900-1650.

**The rule for ig5:**
- **All text:** inside x 86-906 and y 240-1400.
- **The right edge:** nothing past x 906 anywhere below y 840. TikTok's rail starts higher than Instagram's.
- **Hook card and every price numeral:** inside y 300-1260, which clears even the ad guide's bottom block.
- **Caption band:** moves up to y 1150-1400. The series used 1200-1480, and 1480 sits under TikTok's caption block.
- **Bands:**
  - top UI 0-239: mesh only
  - label band 240-330: orb and parked price chip
  - stage 340-1120
  - caption band 1150-1400
  - below 1400: mesh only
- **`IgEnd` already fits:** CTA caption y 700-860; field x 174-906, y 940-1060; wordmark y 760-900; URL y ≈ 1000.
- **Code:** `src/ig/common/zones.ts` is hashed, so ig5 passes its own zone constants (bottom 1400, rail y0 840) to check-zones from `src/ig/ig5/`.

---

## 2. Beat table

**Timing.** Frames are 30 fps timeline targets on the 120 BPM grid (bar = 60 f). `src/ig/ig5/timing.ts` re-anchors them to the measured takes with `place` / `upBeat`, as ig1-ig4 did.

**Cards.** Each card is ≤ 6 visible words. A card is word-synced to the line's `say` through the Captions fork. Its `display` map shows numerals over the spoken words:

| Spoken | Shown |
|---|---|
| three hundred | $300 |
| fifteen hundred | $1,500 |
| ninety-nine | $99 |
| fifty | 50 |
| Forty-nine dollars | $49 |
| a dollar fifteen | $1.15 |

**Colour.**
- rose = the expensive anchors
- graphite = people
- teal = ours

**Motion.**
- Anchor figures roll up from 0 on their word. **$49 never rolls.**
- Hairlines under the monthly figures are drawn to scale from $0 at 2 px per dollar: $300 = 600 px, $99 = 198 px, $49 = 98 px.
- The one-time setup fee never sits on that scale.

| Beat · time · frames | Picture | On-screen text (cards) | Spoken line | Sound |
|---|---|---|---|---|
| **b1 Hook** · 0.0-4.0 s · f0-120 | **Ground:** pearl `MeshGround` (`MUTED_MESH`, warm key low-left), drifting at f0.<br>**Desk (ig1 callback):** a 1.5 px graphite hairline at y 1120 draws x 86 → 906. It starts at f -6, so it is already moving at f0. A rose line light (`MeshOrb` 18 px, `MOMENT_LIGHTS.rush`) sits at its right end (880, 1120), with `RingPulse` at f0 and f30.<br>**S1 at f0 (72 % ink, left at x 86):** "Don't pay" (headline 92, graphite, y 380-470) over "$300" (display 168 px, tabular, rose) + "a month" (68 px), y 500-680, ≤ 820 px wide. Words lift to 100 % on her onsets.<br>**S2 (≈ f72):** "Don't pay" exits up through its mask and S2 rises in the caption band.<br>**f90-120:** the first quote slip rises out of its mask at x 120-880, y 380-640: a white `Panel` with a perforated top edge, `meshElevation`, rotated -1°. "$300 a month" glides down into its amount slot (sub-pixel glide, `SPRING.land`); it is the one moving element. The label "AI receptionist" (44 px graphite) writes on as she says it. | S1 [0-5] **"Don't pay $300 a month"** (set at f0)<br>S2 [6-9] **"for an AI receptionist."** | `ig5-01` @9: "Don't pay three hundred a month for an AI receptionist." | `fx-trill` at f0 (the frame-0 attack, "a call") and again at f30. The bed starts at f0 at -6 dB under the voice: the stub arrangement in E (felt-piano 8ths + shaker). A soft `thump` on "three hundred". `fx-paper` (E4) as the slip lands. |
| **b2 Agency** · 4.0-8.0 s · f120-240 | **Slip 1 becomes the agency quote.** On "agency retainer" a label-role tag "AGENCY RETAINER" (32 px) writes above the figure. Under it, the to-scale hairline draws to 600 px (x 160-760, $0 at x 160).<br>**On "Setup":** a smaller stub slip (x 540-880, y 600-720, +3°) staples onto blank paper at slip 1's lower right, with weight. It reads "SETUP, OFTEN" (32 px label) over "$1,500" (104 px, rose). The figure rolls 0 → 1,500 on "fifteen hundred" (32nd ticks, settles on `SPRING.land`). The stub gets no hairline. | S3 [0-4] **"That's a common agency retainer."**<br>S4 [5-8] **"Setup, often $1,500."** | `ig5-02` @126: "That's a common agency retainer. Setup, often fifteen hundred." | `fx-paper` G#4 on the tag. `fx-tick` 32nds under the roll. `thump` plus a staple click (`fx-tag`) as the stub lands. |
| **b3 Answering** · 8.0-11.9 s · f240-357 | **Slip 2 rises** at x 120-880, y 760-1040, +0.8°, overlapping only blank paper. It has a 6 px graphite edge stripe (people).<br>"Live answering service" (44 px graphite) writes on words 0-2. Then "from" (44 px) + "$99" (140 px, rose, rolls 0 → 99 on "ninety-nine") + "a month," (44 px). Row 2, "for 50 minutes" (44 px, tabular "50"), writes on its words. Its hairline draws to 198 px.<br>**Camera:** eases back 1.00 → .97 so the pile reads as one object. | S5 [0-2] **"Live answering service:"**<br>S6 [3-6] **"from $99 a month,"**<br>S7 [7-9] **"for 50 minutes."** | `ig5-03` @240: "Live answering service: from ninety-nine a month, for fifty minutes." | `fx-paper` E4 on the landing. `fx-tick` roll under "$99". `fx-tock` on "fifty". |
| **b4 Ours: the payoff** · 11.9-15.4 s · f357-462 (≈ 44 %) | **On "Ours?"** the pile squares up in one move (the `SlipStack` collapse idiom). Slip 1, the stub and slip 2 slide together into a neat fan at y 340-760 (× .84, rotation → 0, ink 55 %). Every figure stays legible (≥ 110 px). Nothing is struck and no total is drawn.<br>**Ours** rises out of its mask at x 120-880, y 820-1120: a white slip with a 2 px teal edge, lifted 8 px on a `ContactShadow`. It reads "$49" (display 200 px, teal, **still**) + "a month" (56 px). The teal orb (Ø 44, breathing) is its full stop, as in ig1's "Not even ours●". Its hairline draws 98 px, under the 600 and 198 above.<br>**On "No setup fee":** a teal row (44 px) prints level with the agency stub.<br>**Ground:** a sunday pool rises behind (`MOMENT_LIGHTS.sunday`, mix 0 → .3).<br>This frame is the rewatch and screenshot frame and the cover thumbnail. | S8 [0-4] **"Ours? $49 a month."**<br>S9 [5-7] **"No setup fee."** | `ig5-04` @357: "Ours? Forty-nine dollars a month. No setup fee." | **Stop-time:** the bed cuts on the sample at f354, leaving room tone at a -60 dBFS floor. It returns on "Forty-nine" (≈ f372) with the pad an octave up. `ping` + `chime-sunday-soft` + `fx-mallet-e5` ("true") on "Forty-nine". `land` on the lift. |
| **b5 The number** · 15.4-18.5 s · f462-555 | A third row writes under ours, 44 px in teal ink at 80 %: "Plus the number: $1.15 a month". "$1.15" rises (no roll). The $49 hairline grows to scale by 2.3 px (98 → 100.3 px): the honest joke, without words. Nothing else moves. | S10 [0-7] **"Plus the number: $1.15 a month."** | `ig5-05` @462: "Plus the number: a dollar fifteen a month." | `fx-tag` on "fifteen". The bed stays light. |
| **b6 Does** · 18.5-22.2 s · f555-666 | **Price chip:** the pile leaves up through its mask. Our slip shrinks into a parked chip in the label band (x 560-906, y 250-330): "$49 a month" (40 px teal) + orb Ø 28. It stays there until the CTA.<br>**Stage:** the frame-0 desk hairline returns at y 1060. On "picks up" the rose desk light rings once (`fx-trill-1`), then springs open into the teal orb: the ig2/ig3 birth (`SPRING.pop`, rush → sunday over 6 f). On "when you can't" the graphite (people) part of the desk dims to 35 %.<br>**Record:** a white call record (kit `RecordRow`, x 120-880, y 560-900) lands with the header chrome `● SAMPLE CALL` (28 px) and the ToolRow "Checked your availability" (spinner → `CheckMark`).<br>**On "books the appointment":** the ToolRow "Booked an appointment" ticks, and the header swaps to the `OutcomePill` **Booked** (emerald, `call-display.tsx`). No calendar brand, no logo, no PRO chip. | S11 [0-5] **"It picks up when you can't,"**<br>S12 [6-9] **"and books the appointment."** | `ig5-06` @555: "It picks up when you can't, and books the appointment." | `fx-pickup` + `fx-ting` for the birth. A quiet `fx-tick` roll under the spinner. `fx-mallet-e5` + a small `pop` on "books". A light kick enters on 1 and 3. |
| **b7 CTA** · 22.2-26.0 s · f666-780 (79 %) | The shared `IgEnd`:<br>- The record steps back (× .92, shade .08); the price chip stays.<br>- The CTA caption is centred at y 700-860.<br>- The white comment field (x 174-906, y 940-1060) rises at f666, **before** she says "Comment AGENT".<br>- AGENT types one letter per 16th from her word "AGENT".<br>- The send disc presses as "link" ends. | S13 [0-4] **"Comment AGENT for the link."** | `ig5-07` @675: "Comment AGENT for the link." | The series end stack: `fx-menu-open` on the field, `keys` per letter, the snare roll from f750, and the riser crest. |
| **b8 Brand** · 26.0-27.5 s · f780-826 | **Impact on the bar line** (bar 14):<br>- The field leaves up through its mask.<br>- `LightGL` blooms with one teal emitter.<br>- The NEUROVOICE wordmark surfaces centre-out at y 760-900.<br>- `neurotechvoice.com` types on her syllables, exactly as delivered in ig1-ig4. | wordmark + URL | `ig1-07` @784 (borrow): "Neuro Tech Voice." | Impact + `sub` + E chord, then the name into its ring. |
| **b9 Seam** · 27.5-28.0 s · f826-840 | The chip and the record drain away. The desk hairline redraws with the rose light ringing, and S1 "Don't pay $300 a month" rises into place at 72 % by f839. The loop lands back on the hook. | (S1 at 72 %) | none | `MIX.fadeOut` [826, 840]. A `RingPulse` at f836, so the replay starts mid-ring. |

**Acts (`SCENES`):**

| Act | Frames |
|---|---|
| hook | 0-120 |
| agency | 120-240 |
| answering | 240-357 |
| ours | 357-462 |
| number | 462-555 |
| does | 555-666 |
| end | 666-840 |

**Budget.** 60 spoken words before the sign-off.
- **Measured pace (ig1-ig4 takes, 2.65 w/s):** speech runs ≈ 22.6 s. With the ~0.3 s gaps the CTA ends ≈ 24.6 s, so the impact lands at f780 and the reel runs 28.0 s.
- **If the takes are short:** if the CTA ends by 23.5 s, the impact moves to f720 and the reel runs 26.0 s.

**If the takes run long** (the CTA past 25.5 s would push the reel to 30 s), trim in this order:
1. `ig5-02` drops "That's".
2. `ig5-03` drops "Live". The caption keeps "staffed by people".
3. Last resort: `ig5-05` becomes 28 px fine print on our slip. This breaks the voice rule, so ask first.

Never cut "often", "from", "for fifty minutes" or "a month": they are the hedges.

---

## 3. Layout notes the builders need

- **Slips:**
  - white `Panel` / ig4 `DocPage` paper with a perforated top edge
  - labels 44 px (spoken words), label-role tags 32 px (spoken words), figures in tabular display numerals
  - no unspoken claim text anywhere
  - **no "QUOTE" tag**: the perforation says it
- **Readability at the payoff (b4):** the stepped-back anchors hold ≥ 110 px numerals at 55 % ink. That is joint evaluation, which is the point (RESEARCH-format §2.2).
- **Pile and amounts:** the pile is three separate quotes, never one bill. There is no total rule, no sum, no "was / now", and no strike-through (FTC 16 CFR 233.1-233.2; ASA comparisons).
- **Booking UI:** dashboard strings only (`components/calls/call-display.tsx`). No Google UI or logo.
- **New parts:**
  - `BillPile` (slips, stub, square-up)
  - `Roll` (anchor numerals)
  - `PriceChip`

  Everything else is kit or ig1-ig4 parts by import: `MeshGround`, `MeshOrb`, `RingPulse`, `Panel`, `ContactShadow`, `OutcomePill`, `ToolRow`, `RecordRow`, the Captions fork with `display`, and `IgEnd`.
- **Bed:** the stub arrangement from `scripts/ig/bed.mjs`, with `MUSIC.stop = [354, 372)` for the b4 stop-time (PIPELINE §5.3).

---

## 4. Voice lines (Tessa only, `ava`, speed 1.05)

| id | text (`say`) | emotion | direction |
|---|---|---|---|
| `ig5-01` | Don't pay three hundred a month for an AI receptionist. | confident | **Hook**, narrator, from frame 0 over the desk phone's ring.<br>- Calm and dry: one owner warning another, not an ad.<br>- Light stress on "three hundred", heard by about 1.2 s.<br>- No pause after "month"; "AI receptionist" said plainly.<br>- Target ≤ 3.6 s. |
| `ig5-02` | That's a common agency retainer. Setup, often fifteen hundred. | calm | Matter-of-fact, reading a quote back.<br>- A small beat at the full stop.<br>- "often" gets honest weight: it is the hedge.<br>- "fifteen hundred" a touch slower. |
| `ig5-03` | Live answering service: from ninety-nine a month, for fifty minutes. | calm | Even and factual, with no judgement of the people who answer.<br>- "from" audible.<br>- "for fifty minutes" clear: it is the qualifier that makes $99 true. |
| `ig5-04` | Ours? Forty-nine dollars a month. No setup fee. | content | **The payoff.**<br>- A small, real lift on "Ours?".<br>- Then warm and settled, unhurried on "Forty-nine dollars a month".<br>- "No setup fee" plain.<br>- Word SII on "forty-nine dollars" ≥ 0.7.<br>- No `<break/>`: Sonic already pauses at the full stops. |
| `ig5-05` | Plus the number: a dollar fifteen a month. | content | Light and candid: the small print said out loud, with a half-smile and no apology. "a dollar fifteen" clear. |
| `ig5-06` | It picks up when you can't, and books the appointment. | confident | Warm and assured.<br>- "when you can't" gentle: it's the viewer's problem.<br>- "books the appointment" is the satisfying close. |
| `ig5-07` | Comment AGENT for the link. | confident | As `ig2-07`: slightly lower and warm. `speak` has "agent" in lowercase so Sonic doesn't spell it out. |
| `ig1-07` | Neuro Tech Voice. | (borrow) | `{"id": "ig1-07", "borrow": "ig1"}`, the series sign-off, byte for byte (PIPELINE §4.2). |

**Alternates.** Generate them now and swap by changing the VOICES id only:

| id | text | when |
|---|---|---|
| `ig5-01b` | Before you pay three hundred a month for an AI receptionist. | The A/B hook (hookscore 87.0). Same body; it flows into "That's a common agency retainer." Use it on TikTok as a second post later, or as a Trial Reel once @neurotechvoice reaches ~200 followers. |
| `ig5-06-msg` | It picks up when you can't, and takes a message. | **The no-booking cut.** It is true on Starter today (`session-loader.ts:241`), and it is the same length. b6 then shows the **Message taken** pill (indigo) instead of Booked. Use it if the owner's booking change has not shipped. |
| `ig5-07-bio` | The link's in our bio. | Use it if no one can answer AGENT comments on posting day. |

**For `scripts/ig5/voice-lines-ig5.json`** (the same `level` / `voices.ava` block as `scripts/voice-lines-ig.json`):

```json
[
  {"id":"ig5-01","voice":"ava","say":"Don't pay three hundred a month for an AI receptionist.","speak":"Don't pay three hundred a month for an AI receptionist.","emotion":"confident"},
  {"id":"ig5-02","voice":"ava","say":"That's a common agency retainer. Setup, often fifteen hundred.","speak":"That's a common agency retainer. Setup, often fifteen hundred.","emotion":"calm"},
  {"id":"ig5-03","voice":"ava","say":"Live answering service: from ninety-nine a month, for fifty minutes.","speak":"Live answering service: from ninety-nine a month, for fifty minutes.","emotion":"calm"},
  {"id":"ig5-04","voice":"ava","say":"Ours? Forty-nine dollars a month. No setup fee.","speak":"Ours? Forty-nine dollars a month. No setup fee.","emotion":"content"},
  {"id":"ig5-05","voice":"ava","say":"Plus the number: a dollar fifteen a month.","speak":"Plus the number: a dollar fifteen a month.","emotion":"content"},
  {"id":"ig5-06","voice":"ava","say":"It picks up when you can't, and books the appointment.","speak":"It picks up when you can't, and books the appointment.","emotion":"confident"},
  {"id":"ig5-07","voice":"ava","say":"Comment AGENT for the link.","speak":"Comment agent for the link.","emotion":"confident"},
  {"id":"ig1-07","borrow":"ig1"},
  {"id":"ig5-01b","voice":"ava","say":"Before you pay three hundred a month for an AI receptionist.","speak":"Before you pay three hundred a month for an AI receptionist.","emotion":"confident"},
  {"id":"ig5-06-msg","voice":"ava","say":"It picks up when you can't, and takes a message.","speak":"It picks up when you can't, and takes a message.","emotion":"confident"},
  {"id":"ig5-07-bio","voice":"ava","say":"The link's in our bio.","speak":"The link's in our bio.","emotion":"confident"}
]
```

---

## 5. Scores (run with `python3 -I` from a scratch folder)

**Hook** (`.claude/skills/ig-reel/hookscore.py`):

```
->  87.0 STRONG  Before you pay $300 a month for an AI receptionist.      (ig5-01b, the A/B alternate)
    87.0 STRONG  Don't fire your receptionist for an AI. Not even ours.  (ig1, for reference)
    85.8 STRONG  Don't pay $300 a month for an AI receptionist.          (ig5-01, chosen)
```

`--hook` on the spoken form, "Don't pay three hundred a month for an AI receptionist.", gives **83.2 STRONG**:
- LENGTH 100
- SPECIFICITY 75
- STAKES 100 ("don't" + a price)
- FRONTLOAD 100 (payload at word 1)
- ADDRESS 90 (an imperative opener)

**Why ig5-01 over the 87.0 alternate:**
- It is a complete sentence, so the frame-0 card stands on its own.
- It repeats the shape of the series' best performer.

The scorer can't tell 85.8 from 87.0 (its own AUC is 0.56 between good hooks). The A/B decides.

**Rejected hooks** (all scored on 2026-10-07):

| Score | Hook | Why not |
|---|---|---|
| 84.4 | "After six, your phone gets three quotes. One's $49." | Gives away the anchor; no keyword. |
| 62.6 | "Answering service: $99 for 50 minutes?" | No viewer address. |
| 59.6 | "Quoted $300 a month for an AI receptionist?" | No viewer address. |
| 51.2 | "Your receptionist leaves at six. Here's the bill." | Nothing at stake; risks reading as wages. |

**Timing** (`beats.py --wpm 159`, spoken form): 63 words with the sign-off, ~23.8 s of speech before the gaps.
- The flag "hook runs 3.8 s" is expected: as in ig1, the hook is the card at frame 0 plus "three hundred" at ~1.2 s, and the full sentence runs on to ~3.6 s.
- The flag "no loop" is answered visually: the seam re-forms S1 and the ringing desk. "a month" also recurs in b4.

**Humanizer** (`ig-human/detect.py`):

| Text | Score | Detail |
|---|---|---|
| VO as shown on screen (numerals) | **78.0 PASS** | burstiness 0.53, 0 slop, 0 fingerprint |
| VO in spoken form | 62.4 REVIEW | An artefact: the panel counts digits as concrete and spelled-out numbers as not. |
| Instagram caption | **84.5 PASS** | `caption.py`: READY |
| TikTok caption | **85.1 PASS** | `caption.py`: READY |
| Instagram pinned comment | **74.7 PASS** | |
| TikTok pinned comment | 62.0 | Under 25 words, too short for the panel to judge. |

`humanize.py` found 0 artefacts and 0 structural tells on all of them.

---

## 6. Cover

- **Cover line:** **"Don't pay $300 a month."** It is the hook, as ig1's cover was ("Don't fire your receptionist.").
- **Custom PNG `IG5-Cover-9x16`:**
  - **Ground:** pearl, with the sunday pool from b4.
  - **Kicker:** `AI RECEPTIONIST · 05` (label role, x 86, y 270). It carries the search keyword on the grid.
  - **Title:** at 128 px on two lines, "Don't pay" / "$300 a month." with "$300" in rose. Placed at x 86, y 330-620, each line ≤ 844 px.
  - **Thumbnail:** the b4 payoff frame at y 680-1300: the three anchors at 55 % (agency $300 a month, setup often $1,500, live answering from $99 a month for 50 minutes) and the teal "$49 a month" slip with the orb.
  - **The "$49":** kept above y 1300, clear of TikTok's view-count overlay on the profile grid.
  - **The whole cover:** inside x 86-930, y 260-1500 (3:4 crop y 240-1680).
- **Instagram:** upload it in the composer (Edit cover → Add from camera roll). The fallback cover is frame 0.
- **TikTok:** upload the same PNG if the app offers "upload". Otherwise choose the frame at ≈ f420 (14.0 s, the payoff) as the cover, with no added text.

---

## 7. TikTok (post first, the `…-1080p60-ig.mp4` copy)

**Caption** (1,162 characters, under the 2,200 API limit; `caption.py` READY; `detect.py` 85.1 PASS):

```
AI receptionist cost, side by side: an agency build, a live answering service, and ours at $49 a month.

Comment AGENT and we'll send you the free trial link. 5 free minutes for 14 days, no card.

Where the numbers come from (checked 7 Oct 2026): $300 a month is a common agency retainer for an AI receptionist, and agency setup fees often run around $1,500. $99 a month for 50 minutes is the cheapest 50-minute plan we found among ten US live answering services, which are staffed by people. We read each service's own pricing page, and we don't name them here.

Ours picks up when you can't. It tells callers it's an AI, answers from the documents you give it, and books the appointment into your calendar. It answers its own number, and you point your calls at it.

Fine print: $49 a month is the Starter plan fee in US dollars, excluding VAT. The phone number is $1.15 a month on top, and minutes past the plan's allowance are billed per minute. No setup fee, cancel anytime. Booking needs Google Calendar connected. Until you buy a number, the agent answers only your own test calls.

#AIReceptionist #AnsweringService #SmallBusinessOwner #SmallBusinessTips
```

**Pinned comment.** TikTok comments are capped at 150 characters; this one is 135:

```
We checked 10 US answering services and 8 agency pricing sources on 7 Oct 2026. Ours is $49 a month, plus $1.15 a month for the number.
```

**TikTok notes:**
- **The search phrase** "AI receptionist cost" leads the caption. It is also on screen ("AI receptionist", S2) and spoken by ~2.3 s.
- **AGENT comments:** TikTok has no comment-to-DM automation for us, so the owner replies to every comment by hand within the hour. Links in TikTok comments aren't clickable, so send the link by DM. If the commenter's DM settings block it, reply asking them to follow back or to use the site name on screen.
- **Original sound:** name it "AI receptionist · Neuro Tech Voice".

---

## 8. Instagram (same day or next; the `…-1080p60-ig.mp4` copy, custom cover)

**Caption** (1,212 characters; `caption.py` READY; 109-character first line lands whole; `detect.py` 84.5 PASS):

```
AI receptionist pricing, side by side: an agency retainer, a live answering service, and ours at $49 a month.

Comment AGENT and we'll DM you the link. 5 free minutes for 14 days, no card.

The numbers, checked on 7 Oct 2026: $300 a month is a common agency retainer for an AI receptionist, and agency setup fees often run around $1,500. The cheapest 50-minute plan we found among ten US live answering services was $99 a month. Those are staffed by people, so it's a different product. Sources are in the pinned comment.

Keep your front desk for the work only people can do. Ours picks up when you can't: it tells callers it's an AI, answers from the documents you give it, takes messages and books the appointment into your calendar. It answers its own number, and you point your calls at it when nobody can pick up.

Fine print: $49 a month is the Starter plan fee in US dollars, excluding VAT. The agent's phone number is $1.15 a month on top, and minutes past the plan's allowance are billed per minute. No setup fee, cancel anytime. Booking needs Google Calendar connected. Until you buy a number, the agent answers only your own test calls.

#AIReceptionist #AnsweringService #SmallBusinessOwner #VoiceAI
```

**Hashtags:** four, because `humanize.py` flags five as a hashtag wall.

**Keyword:** AGENT → the series DM (POSTING §5a), with `utm_campaign=reel_ig5`.

**Pinned comment** (detect 74.7 PASS):

```
Sources, read 7 Oct 2026. Agencies: two agencies' own price pages and six published pricing guides. Seven of the eight put the lowest monthly retainer at about $300 or more, and the typical lowest setup fee is $1,500 (some agencies waive it). Agency retainers often add per-minute usage on top, as our plan does past its allowance. Answering services: the pricing pages of ten US providers, all staffed by people. Buying 50 minutes costs $99 or more at every one of them. We don't name providers in our posts. Ours: $49 a month plan fee (USD, excl. VAT), plus $1.15 a month for the phone number.
```

**Alt text:**

```
Motion-design reel on a pale gradient. Text: Don't pay $300 a month for an AI receptionist. Paper quotes pile up on a desk: That's a common agency retainer, $300 a month. Setup, often $1,500. Live answering service: from $99 a month, for 50 minutes. Then a teal slip: Ours? $49 a month. No setup fee. Plus the number: $1.15 a month. A teal orb answers a call, marked Booked. Text: It picks up when you can't, and books the appointment. Comment AGENT for the link. Neuro Tech Voice.
```

---

## 9. Self-check against the hard truth rules

**Every figure and claim, with its exact source.** The grades are RESEARCH-prices' own:
- **A** = true of every source.
- **B** = typical, with the hedge spoken.

| On screen / VO | Exact source line | Grade · hedge |
|---|---|---|
| "$300 a month" + "That's a common agency retainer" | Trillet guide (updated 30 Sep 2026): "a common benchmark is a $300/month retainer per client, plus a setup fee and per-minute markup", https://trillet.ai/blogs/voice-agent-pricing-strategy-guide. Ciela (8 Jan 2026): "Starter receptionist: $1,500 to $2,500 setup, $300 to $450 monthly", https://ciela.ai/blogs/how-much-to-charge-for-ai-voice-agent. 7 of 8 sources put the monthly floor ≥ $297 (RESEARCH-prices §2). | B · "common". Never "every agency" and never "AI receptionists cost $300" (several AI platforms cost ≤ $49, RESEARCH-prices §4). The hook is advice, not a market claim. |
| "Setup, often $1,500" | Ciela, as above. Agentpro AI (26 Jun 2026): "$1,500 for setup and $1,500/month". The median setup floor across 7 sources is $1,500. Trillet: "many agencies waive these". | B · "often", spoken and shown. One-time, so it is kept off the monthly scale. |
| "Live answering service: from $99 a month, for 50 minutes" | The cheapest way to buy 50 minutes is ≥ $99 at all 10 US providers surveyed (RESEARCH-prices §1). The floor: PATLive "50 minutes About 20 calls" at $99/mo, https://www.patlive.com/pricing/. | A · "live", "from" and "for 50 minutes" all spoken. Fair because our allowance is ≥ 150 min on either price list (never shown). |
| "Ours? $49 a month." | `lib/site.ts:1685` `{ id: "starter", …, monthly: 49 …}`; `types/index.ts:594` `price_monthly: 49`. Menu: `lib/site.ts:2290` "Plans from $${monthly} a month". | A. Qualified out loud by the next line, and in both captions (Starter plan fee, USD, excl. VAT, metered minutes). Never "all-in", "flat", "unlimited" or "total". |
| "No setup fee." | `lib/pages/home/pricing.ts:243` `{ title: "No setup fee", body: "On any plan. A custom build is quoted on its own." }` (re-read in this run). | A. RESEARCH-prices called it "implied"; the product page states it, so it is safe. |
| "Plus the number: $1.15 a month." | `lib/phone/pricing.ts:6` `PHONE_NUMBER_MONTHLY_PRICE_USD = 1.15`; FAQ `lib/site.ts:1932` "on its own monthly subscription at $1.15". | A. |
| "It picks up when you can't" | `lib/voice/router.ts:196-221` answers at any hour by default; `lib/pages/ai-agents.ts:40` "Point your calls at an agent that picks up on the first ring". Real callers need a bought number (`lib/site.ts:1813`), which the captions say. | A, with the routing explained in the captions. |
| "and books the appointment" | **Owner decision, 2026-10-07:** "si la 49$ au calendar … O fac eu modificarea". **Today it is false at $49:** `lib/billing/entitlements.ts:43` (starter `googleIntegrations: false`) and `lib/voice/tools/calendar.ts:22-29` (`bookingGate`). | **LAUNCH GATE.** Post only when Starter booking works in the product **and** the pricing page lists it. Otherwise swap in `ig5-06-msg` (b6 shows **Message taken**) and delete "books the appointment" / "Booking needs Google Calendar connected" from both captions. If booking stays beta, add "(in beta)" to that caption line. |
| Captions: "5 free minutes for 14 days, no card" | `lib/site.ts:1812` "Five free minutes, fourteen days, and no card."; `lib/pages/ai-agents.ts:44`. | A. Never next to booking in the reel: the reel never says "free". |
| Captions: tells callers it's an AI · answers from your documents · takes messages | `lib/site.ts:2527`, `lib/voice/prompt.ts:265` · `lib/pages/home/pricing.ts:67` · `lib/voice/session-loader.ts:241` | A |
| Captions: USD, excl. VAT · minutes past the allowance billed · cancel anytime | `lib/site.ts:1829` · `lib/pages/home/pricing.ts:74`, `lib/billing/entitlements.ts:50` · `lib/pages/home/pricing.ts:240-241` | A |

**The rules:**

| Rule | Status |
|---|---|
| No invented number, statistic, testimonial or result | **Pass.** Every figure is above, with its page; "common" and "often" are the sources' own words. |
| No competitor named | **Pass.** Categories only ("agency", "live answering service"). Captions and comments say "we don't name them". No logos and no provider UI. |
| No minutes, overage rates or other tiers of ours | **Pass.** "50 minutes" is the competitor's plan. Our allowance is "the plan's allowance" in the fine print, with no number. |
| No "replace / fire your receptionist", no wage figure, no saving claim | **Pass.** The hook is about the AI's price. The IG caption says "Keep your front desk for the work only people can do", which is ig1's position. BLS pay ($18.27/hr) was left out on purpose: it is a unit mismatch, it would cost a beat, and it carries ig1 risk. If the owner wants it, the benched line is "Or keep someone on till nine: about $18 an hour" (BLS OOH median, May 2025), framed only as evening cover. |
| Fair comparison | **Pass.** Plan fee against plan fee, per month against per month. The people-staffed service is labelled "live" and "staffed by people". Anchors are conservative: the $99 floor, the $300 low end, the $1,500 median floor. To-scale bars from $0. No strike-through, no total, no former-price device. "Cheapest", "save", "X times" and "all-in" appear nowhere. |
| Never imply a feature the $49 plan lacks | **Pass with the launch gate** (booking). No recordings, no voice cloning, no Google logo, no language claim. |
| ≤ 6 words per card · every on-screen line spoken · hook in 0-2 s | **Pass.** 13 cards, the longest has 6 words (S10, S11). Chrome is the dashboard's own strings at ≤ 32 px. The hook card is set at f0. |
| Inside the combined safe zone | **Pass by design** (§1): text x 86-906, y 240-1400; figures y 300-1260. To verify in check-zones with ig5's own constants. |
| Series end card | **Pass.** The shared `IgEnd` is reused unchanged (AGENT typed, NEUROVOICE, URL). Note: the delivered `IgEnd` types `neurotechvoice.com` (`src/ig/components/End.tsx:247`), not `www.`. Changing it would move ig1-ig4's picture, so keep it unless the owner insists. |

**Before posting (owner / orchestrator):**
1. **The booking launch gate** (above).
2. **The live price:** confirm the live Stripe `STRIPE_STARTER_PRICE_ID` is $49.00 USD.
3. **Re-open by eye** PATLive, Trillet, Ciela and Agentpro. The research fetcher summarised them, and prices change.
4. **AGENT replies:** someone answers AGENT comments on TikTok by hand. If no one can, build with `ig5-07-bio`.
