# ig5 script, draft B: "You're paying $300?" (direct address)

Label `draft:B`. Written 2026-10-07 on `claude/remotion-trailer`. Planning only: no code, no voice, no existing file touched, nothing committed.

**Angle.** Mirror the reference reel's opening ("You're paying $39 a month for a robot that…") with a sourced price anchor, an agency's AI receptionist at $300 a month, then "Or $49 a month" and what it does for that, ending on the series' keyword CTA. This is the most hook-driven of the drafts, and it puts the TikTok search phrase "AI receptionist" in the hook.

**Reads first:** `ig5/RESEARCH-prices.md` (figures), `ig5/RESEARCH-product.md` (SAFE S1-S23 / UNSAFE U1-U21), `ig5/RESEARCH-format.md` (shape, hooks, honesty rules), `ig5/PIPELINE.md` (build), `docs/ig/SCRIPT.md` §0.3 (series rules, `IgEnd`), `.claude/instagram/voice.md`.

**Owner decisions applied:**
- "$49" goes on screen (the owner asked for it).
- Calendar booking at $49 may be shown. The owner is changing the product and the pricing page ("O fac eu modificarea, tu fa reelul"). **Launch gate:** see §9.

---

## 0. At a glance

| | |
|---|---|
| Length | **28.0 s**, 14 bars, 840 timeline frames (3360 at 120 fps). Impact f780 (bar 14 line, 26.0 s). END f840 |
| Hook (frame 0 + first words) | Desk trill at f0. Card at f0: **"You're paying $300 a month"**, then **"for an AI receptionist?"** |
| Hook score | **77.8 STRONG** raw `hookscore.py`; **81.4** with the scorer's "yo" bug patched (§6) |
| Price heard | "$300" at ≈ 0.7-1.1 s · "**$49**" at ≈ 8.2-8.7 s (**≈ 30 %** of runtime, inside the "by 45 %" rule) |
| Proof | the stepped-back agency quote ($300 a month, setup often $1,500) stays visible next to the teal $49 strip; then the real app's Answered → Booked record |
| CTA | "Comment AGENT for the link." at f675 (80 %), shared `IgEnd`, NEUROVOICE + neurotechvoice.com |
| Spoken words | 64 (ig1 had 66 in its plan). ≈ 23.0 s of speech at Tessa's measured pace |
| Searchable words spoken | "AI receptionist" ×2 (hook + loop echo at 18 s); the caption adds "answering service" |
| Plan gate | **Booking at $49 = launch-gated** (§9). A no-booking fallback take exists (`ig5-06b`) |

**Why this should travel on TikTok as well as Instagram:**
- It belongs to the "receptionist" hook family. ig1 "Don't fire your receptionist." got 563 TikTok views, about 2x the rest.
- It is a price question, and the figure is visible at frame 0.
- It answers itself in 8 s.

**Series coherence with ig1:**
- The reel compares one AI receptionist to another (an agency-built one vs one you set up yourself).
- No human receptionist and no wage appear anywhere.
- Nothing says "replace", and nothing says "fire".

---

## 1. Safe zone for ig5 (TikTok + Instagram combined)

The house bands (`src/ig/common/zones.ts`: text y 240-1520, rail x > 906 at y 900-1650) only cover Instagram. TikTok's overlay is larger on the right and at the bottom:
- The like / comment / save / share / profile rail sits about 120-140 px from the right edge, over roughly the lower two thirds.
- The username / caption / sound block covers about the bottom 350-480 px.

TikTok's ad guides are stricter (right 242 px, bottom 440-707 px), because an ad adds a button and a longer caption. Those figures only matter if ig5 is ever promoted as a TikTok ad. Sources are in §11.

**ig5 rule (tighter than both apps, as ig5-local constants):** `src/ig/common/` is inside `igHash`, so these constants must not go into `common/zones.ts`.

| Band | ig5 value |
|---|---|
| Top (both apps' header, tabs, search) | mesh only above **y 240** |
| Headline zone (b1-b2 cards) | y 300-620, left at x 86, max width 814 (to **x 900**) |
| Stage (sheet, strip, records) | y 280-1130, objects x 140-880 |
| Caption band (b4-b6 captions) | **y 1180-1400**, left at x 86, to x 900 |
| Bottom (TikTok caption block, IG caption) | mesh only below **y 1400** |
| Right rail | text never right of **x 900**; objects never right of **x 880 below y 640** |
| Cover | words in x 86-900, y 300-1380: inside IG's 3:4 crop (y 240-1680) and TikTok's 3:4 grid tile, clear of the tile's bottom-left view count |

**One known exception:** the shared `IgEnd` comment field runs to x 906 at y 940-1060 (built once, shared with ig1-ig4). That is still ≈ 40 px clear of TikTok's icons, so leave it.

---

## 2. Beat table

These are 30 fps timeline targets. `src/ig/ig5/timing.ts` re-anchors every line on the measured takes, as ig1-ig4 did. If a take runs long, the time comes out of the gaps before the CTA, never out of the hook.

**Acts (`SCENES`):** `hook` 0-120 · `quote` 120-240 · `ours` 240-450 · `number` 450-540 · `does` 540-668 · `end` 668-840.

| Beat | Frames · s | Picture (house kit, zones §1) | On-screen text (≤ 6 words, every word spoken) | Spoken line (id @ frame) | Sound |
|---|---|---|---|---|---|
| **b1 Hook** | 0-120 · 0.0-4.0 | **Ground:** pearl `MeshGround` on `MUTED_MESH`, with a faint rose pool top right, already drifting at f0. **f0, the card:** S1 is set at 72 % ink, left at x 86: "You're paying" (headline 92, y 300-392) over "**$300** a month" ("$300" display 150 px, rose, tabular; y 410-560). Each word lifts to 100 % on her onset; "$300" takes a 1-frame rose glint on "three". **f0, the sheet:** a white **quote sheet** (ig4 `DocPage` idiom, `meshElevation` 3, x 140-880, y 660-1120) is already rising (started f −6, `SPRING.site`). It carries the chrome tag `QUOTE` (28 px Geist Mono) and two hairline rules drawing (`EASE.draw`). **≈ f66:** S1 exits up through its masks (4 f) and S2 rises in its place. **On "receptionist" (≈ f95):** line 1 prints on the sheet, "AI receptionist ········ $300 a month" (44 px objects, rose figure), so the price stays on screen after S1 leaves. **Camera:** push 1.00 → 1.02 | S1 [0-5] "You're paying $300 a month" (set at f0) · S2 [6-9] "for an AI receptionist?" | `ig5-01` @6: "You're paying three hundred a month for an AI receptionist?" | `fx-trill` f0 + f30 (the series' "a call" attack); `fx-paper-lift` under the sheet; bed from f0 at −6 dB (shaker 8ths, muted felt-piano E ostinato); `fx-tock` on "three hundred"; `fx-felttip-short` on the line print |
| **b2 Quote** | 120-240 · 4.0-8.0 | S2 exits up and S3 rises (headline 80, y 300-480). **On "agencies" (≈ f128):** a rose-outlined chrome stamp `AGENCY` (label 28) clips onto the sheet's top right (x ≤ 860, y ≈ 690). **On "low end":** "$300" settles 2 px (`SPRING.land`); that is the only move. **On "Setup?":** S4 replaces S3, and line 2 prints, "Setup, often ········ $1,500". **On "fifteen hundred":** the figure rolls 0 → 1,500 (rose, `Roll` helper, ≈ 0.6 s, settles on `SPRING.land`). A total rule draws under both lines, with **no total figure** (nobody can add up two "often"s). **Camera:** eases back 1.02 → .98 on the roll | S3 [0-5] "At agencies, that's the low end." · S4 [6-9] "Setup? Often $1,500." | `ig5-02` @120: "At agencies, that's the low end. Setup? Often fifteen hundred." | `fx-tag` on the stamp; `fx-tick` 32nds under the roll; `thump` on its landing; soft `swish` on the camera |
| **b3 Ours (payoff)** | 240-345 · 8.0-11.5 | **On "Or" (≈ f242):** S4 exits. The sheet **steps back** (× .86, ink 45 %) and glides up to y 280-620. It stays readable beside ours, so both are judged together; it is never struck through. A white strip with a teal edge (`Panel` + `ContactShadow`, x 140-880, y 700-1080) rises below. **On "forty-nine":** "Or" (headline 56) sits above "**$49**" (display 200 px, teal, **no roll, rises still**) and "a month" (headline 72, graphite). The teal orb (Ø 44, breathing) is the full stop. This strip text is the caption. **On "No setup fee" (≈ f300):** a teal chip "No setup fee" (title 52) lands in the strip's lower row (y 980-1050), level with the sheet's setup line above. **Ground:** a sunday pool rises behind (`MOMENT_LIGHTS.sunday.ground`, mix 0 → .3 over 1 s) | S5 [0-4] "Or $49 a month." · S6 [5-7] "No setup fee." | `ig5-03` @240: "Or forty-nine dollars a month. No setup fee." | `ping` + `chime-sunday-soft` on "forty-nine"; `fx-mallet-e5` ("true"); the pad opens an octave; `fx-tag` on the chip |
| **b4 Ours (how)** | 345-450 · 11.5-15.0 | **On "set it up":** the chip swaps (`Swap`, one move) into the site's four setup steps as chrome chips (28 px; `lib/pages/home/start.ts:12`): `Company · Tone · Voice · Go live`. **From "yourself":** they fill teal, one per 16th. **On "minutes":** "Go live" takes a drawn `CheckMark`. The sheet above and the $49 row stay put. Captions sit in the caption band (y 1180-1400) | S7 [0-4] "You set it up yourself," · S8 [5-8] "in under ten minutes." | `ig5-04` @345: "You set it up yourself, in under ten minutes." | `fx-pluck` E5 → F#5 → G#5 → B5, one per step; `fx-ting` on the check |
| **b5 Number (honesty)** | 450-540 · 15.0-18.0 | The step chips fold back. As she says it, a teal line writes into the strip's lower row (title 48, felt-tip reveal): "**Plus your number: $1.15 a month.**" That line is the caption. It volunteers the extra before the comments ask, the brand's "If it isn't written down, I say so". The sheet above stays | S9 [0-7] "Plus your number: $1.15 a month." | `ig5-05` @450: "Plus your number, a dollar fifteen a month." | `fx-felttip-0` on the write; `tap-0` on "$1.15"; the bed thins to piano |
| **b6 Does** | 540-668 · 18.0-22.3 | **On "Your AI receptionist":** the stepped-back sheet leaves up through its mask (one move; the comparison has done its job). The strip turns into the real app's call record (kit `RecordRow`, x 140-880, y 640-900). **On "picks up":** the `OutcomePill` **Answered** (blue) lands. **On "day and night":** the mesh key light sweeps from warm pearl to the `MOMENT_LIGHTS.night` tint and back over ≈ 0.8 s. It is light only; nothing else moves. **On "books":** the dashboard tool row "Booked an appointment" (28 px) ticks, and the pill swaps Answered → **Booked** (emerald). **On "appointments":** a small `EventCard` lands (x 140-880, y 930-1110). It is a neutral day column with one event block as an ink bar: no words, no Google logo. Add a `BETA` chip only if the app still badges booking as beta at launch | S10 [0-4] "Your AI receptionist picks up" · S11 [5-10] "day and night, and books appointments." | `ig5-06` @540: "Your AI receptionist picks up day and night, and books appointments." | Light kick on 1 and 3 from f540; `fx-tag` on Answered; `whoosh-soft` on the light sweep; `fx-mallet-e5` + `pop` on "books"; `fx-paper-square` on the EventCard |
| **b7 CTA** | 668-780 · 22.3-26.0 | Shared **`IgEnd`**. The record and event step back (× .92, shade .08). The CTA caption is centred at y 700-860. The white comment field rises at **f667**, before she says "Comment", so muted viewers get the instruction (x 174-906, y 940-1060). **AGENT** types one letter per 16th from `vWord(ig5-07,1)`. The send disc presses (.97) as "link" ends (≈ f726) | S12 [0-4] "Comment AGENT for the link." | `ig5-07` @675: "Comment AGENT for the link." | `fx-keys`; half-bar snare roll from f750 |
| **b8 Brand** | 780-826 · 26.0-27.5 | **Impact on the bar line (END − 60):** the field leaves up (4 f); `LightGL` blooms with one teal emitter; the **NEUROVOICE** wordmark surfaces at y 760-900; `neurotechvoice.com` (Geist Mono 44, y ≈ 1000) types on "Neuro \| Tech \| Voice" | wordmark + URL | `ig1-07` @784 (borrowed take): "Neuro Tech Voice." | impact + `sub` + E chord at f780 |
| **b9 Seam** | 826-840 · 27.5-28.0 | The wordmark leaves up. The quote sheet rises back to its frame-0 place with its rules drawing, S1 "You're paying $300 a month" sets at 72 %, and the rose pool returns. The replay's first sound is the f0 trill | (S1, as at f0) | (none) | `MIX.fadeOut` [826, 840] to < −60 dBFS |

**Timing estimate** (`beats.py --wpm 167`, Tessa's measured 2.78 w/s): 64 words, ≈ 23.0 s of speech. With the gaps, the CTA ends ≈ f726 and the impact lands on f780, leaving ≈ 1.8 s of slack before the impact.

**Muted read:** the frame-0 card and the two figures carry the story without sound:
- "$300 a month" (rose) on the stamped AGENCY sheet;
- "$49 a month" (teal) below it;
- "No setup fee" against "Setup, often $1,500".

**Figure sizes:** anchors ≥ 120 px (the sheet's figures are 44 px objects, but the hook card shows $300 at 150 px); $49 at 200 px; unit words ("a month") always sit on the same row as their figure.

---

## 3. Voice lines

All lines are Tessa (Emotive) `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`, role `ava`, speed 1.05, at the same `level` block as `scripts/voice-lines-ig.json`. The `say` text is spoken form; the `display` map puts numerals on screen.

| id | text (say) | on screen (display) | notes |
|---|---|---|---|
| `ig5-01` | You're paying three hundred a month for an AI receptionist? | You're paying $300 a month / for an AI receptionist? | question intonation; "three hundred" → `$300` |
| `ig5-02` | At agencies, that's the low end. Setup? Often fifteen hundred. | At agencies, that's the low end. / Setup? Often $1,500. | "fifteen hundred." → `$1,500.` |
| `ig5-03` | Or forty-nine dollars a month. No setup fee. | Or $49 a month. / No setup fee. | "forty-nine dollars" → `$49`. Calm and level, no sell |
| `ig5-04` | You set it up yourself, in under ten minutes. | You set it up yourself, / in under ten minutes. | "ten" stays a word (the site says "under ten minutes") |
| `ig5-05` | Plus your number, a dollar fifteen a month. | Plus your number: $1.15 a month. | "a dollar fifteen" → `$1.15` |
| `ig5-06` | Your AI receptionist picks up day and night, and books appointments. | Your AI receptionist picks up / day and night, and books appointments. | **launch-gated** (§9); echoes the hook for the loop |
| `ig5-07` | Comment AGENT for the link. | Comment AGENT for the link. | Same words as `ig2-07`, but a **fresh ig5 take**: `ig5/PIPELINE.md` §4.1 allows exactly one borrow (`ig1-07`) |
| `ig1-07` | Neuro Tech Voice. | wordmark + URL | `{"id": "ig1-07", "borrow": "ig1"}`, byte for byte |

**Alternates** (synthesise in the same batch; each costs one Cartesia call):

| id | text | use |
|---|---|---|
| `ig5-01b` | Your AI receptionist costs three hundred a month? | **A/B hook** (81.4 raw / 87.0 patched; ≈ 2.9 s; the keyword is heard by ≈ 1.3 s). Cards: "Your AI receptionist costs" / "$300 a month?" The rest of the reel is unchanged. Use it for the re-cut if 3-s holds are weak, or as a Trial Reel once eligible (≈ 200 followers) |
| `ig5-06b` | Your AI receptionist picks up day and night, and takes messages. | **No-booking fallback** (S8 + S12, true today on Starter). If the owner's change is not live by posting day, swap it in. The b6 picture then ends on **Message taken** (indigo) with no EventCard |
| `ig5-07-bio` | The link's in our bio. | Only if neither app's keyword-to-DM path is live on posting day (POSTING §0.1 precedent) |

**Display map (new entries):** `ig5-01` [2-3] → `$300` · `ig5-02` [8-9] → `$1,500.` · `ig5-03` [1-2] → `$49` · `ig5-05` [3-5] → `$1.15`.

**Screens as word spans:** S1 `ig5-01` [0-5] · S2 [6-9] · S3 `ig5-02` [0-5] · S4 [6-9] · S5 `ig5-03` [0-4] · S6 [5-7] · S7 `ig5-04` [0-4] · S8 [5-8] · S9 `ig5-05` [0-7] · S10 `ig5-06` [0-4] · S11 [5-10] · S12 `ig5-07` [0-4].

The display map counts "forty-nine" as one word. Max display words per screen: S1 5, S3 6, S9 6, S11 6. Every other screen has ≤ 5.

**Chrome that is not a line** (≤ 32 px, no claim, each appears on or after the word it belongs to):
- `QUOTE` (f0, the object's kind tag, like ig4's `PDF`)
- `AGENCY` (on "agencies")
- `Company · Tone · Voice · Go live` (on "set it up"; the site's own words)
- "Booked an appointment" (on "books"; the dashboard's own string)
- `BETA` (only if the app shows it)

---

## 4. How "$49" is qualified, honestly

- **Spoken and shown:** "Or $49 a month" (always "a month"), then "No setup fee", then the honesty beat: "**Plus your number: $1.15 a month.**" This volunteers the main extra, and the beat doubles as a pattern break.
- **Not on screen:**
  - **The plan name.** "Starter" would be unspoken text, and the series names no plan except Pro. It is named in the caption fine print, so a viewer can find it on the pricing page.
  - **Minutes, overage rate and VAT.** These are covered by the caption fine print (§7) and the pinned comment (§8).
- **Never:** "only $49", "all-in", "flat", "unlimited", "that's it", "no hidden fees", "cheapest", "save X", or "X times cheaper".
- **The comparison's basis is spoken:** "**At agencies**" (whose price), and "**You set it up yourself**" (what you give up for $49: nobody builds it for you).

---

## 5. Cover

- **Cover frame:** a custom PNG, `IG5-Cover-9x16`, built from the b3 composition (≈ f320). The stepped-back sheet sits above, showing `AGENCY`, "AI receptionist ··· $300 a month" and "Setup, often ··· $1,500". The teal strip "$49 a month●" with "No setup fee" sits below it.
- **Layout** (all inside x 86-900, y 300-1380):
  - kicker `AI RECEPTIONIST · 05` (label role, x 86, y 300);
  - title on two lines at 128 px:
    - "**Agency: $300 a month.**" ("$300" in rose), y 360-500;
    - "**Or $49.**" ("$49" in teal, with the orb as its full stop), y 520-660;
  - the sheet + strip thumbnail at × .8, y 720-1360.
- **Cover line:** **"Agency: $300 a month. Or $49."** (6 words). It names whose $300 it is, so the grid tile can't be read as "AI receptionists cost $300".
- **Instagram:** Edit cover → Add from camera roll.
- **TikTok:**
  - Upload the PNG if the app offers "upload from photos".
  - Otherwise pick frame ≈ f320 with **no** TikTok text sticker; the frame already shows both figures.
- **Fallback:** frame 0 (it already reads "You're paying $300 a month").

---

## 6. Hook and script scores (run 2026-10-07, `python3 -I`, scratch copies only)

```
python3 -I .claude/skills/ig-reel/hookscore.py hooks.txt
```

| Hook | Raw | Patched* | Spoken | Price heard | Keyword heard | Verdict |
|---|---|---|---|---|---|---|
| **"You're paying $300 a month for an AI receptionist?"** (`ig5-01`, primary) | **77.8 STRONG** | 81.4 | ≈ 3.6 s | ≈ 0.7-1.1 s | on screen ≈ 2.2 s, voiced ≈ 2.7-3.6 s | the brief's mirror of the reference. Price on frame 0 |
| "Your AI receptionist costs $300 a month?" (`ig5-01b`) | 81.4 STRONG | 87.0 | ≈ 2.9 s | ≈ 1.6-2.2 s | ≈ 0.2-1.3 s | A/B alternate. Shorter, keyword first, no number on frame 0 |
| "You're still paying $300 a month for an AI receptionist?" | 81.4 STRONG | 87.0 | ≈ 3.9 s | ≈ 1.0 s | ≈ 3.0 s | rejected: "still" passes judgement on the viewer and adds 0.3 s |
| "You're paying $99 for 50 minutes of answering?" | 80.8 STRONG | 84.4 | ≈ 2.9 s | ≈ 0.7 s | none | answering-service variant; lacks "AI receptionist" |
| "Paying $300 a month for an AI receptionist?" | 59.6 OK | 59.6 | ≈ 3.2 s | | | loses the direct address |
| Reference: "You're paying $39 a month for a robot that types check your DMs." | 75.0 STRONG | 78.6 | ≈ 4.7 s | | | for comparison |

\* **The patched score** fixes `hookscore.py`, which treats any opener starting with the letters "yo" (so every "You…" / "Your…") as the weak opener "yo", costing 30 on FRONTLOAD. The patch makes the match whole-word, in a scratch copy only; the skill is untouched. RESEARCH-format §6 found the same bug.

**The hook-length flag.** `beats.py` flags the primary hook at 3.6 s, past 3 s. It is accepted because:
- the card reads at frame 0;
- "$300 a month" is heard by ≈ 1.8 s;
- the hook question is complete on screen by 2.2 s.

If 3-s hold comes in under 60 % on TikTok, re-cut with `ig5-01b`, which runs 2.9 s.

**Other checks:**
- **`beats.py vo.txt --wpm 167 --target 28`:** 64 words, ≈ 23.0 s of speech, 8 beats. Only the hook-length flag remains, and it is addressed above.
  - The "nothing concrete" flags on the spelled-out lines are artefacts: the screen shows $300 / $1,500 / $49 / $1.15.
  - The loop flag only compares the brand line; the loop is `ig5-06`'s "AI receptionist" plus the visual seam.
- **`detect.py`, on-screen text (display form): PASS 76.8.** Burstiness 56.3, slop 100, fingerprint 100, voice 100.
  - The spoken form scores REVIEW 65.1, only because spelled-out numbers lower SPECIFICITY.
  - `humanize.py --report`: "Nothing to strip".
- **Banned words absent:**
  - voice.md never-say list;
  - RESEARCH-format §3 price/overreach list ("only", cheapest, unlimited, all-in, flat, save, replace, fire, every call, never misses, every language, 5-minute setup, no contract).

---

## 7. Captions

### 7.1 TikTok (keyword-first line for TikTok search; one ask; 4 hashtags; no link)

```
AI receptionist cost: an agency quote vs $49 a month.

If an agency builds your AI receptionist, you'll often pay around $300 a month, and setup's often $1,500 on top. A live answering service, with people, starts at $99 for 50 minutes. Ours is $49 a month and there's no setup fee: you set it up yourself in under ten minutes, from answers you write down once. It picks up day and night and books appointments into your calendar.

Comment AGENT and we'll send you the link.

The fine print, so you don't have to ask: $49 a month is our Starter plan fee (USD, excl. VAT). Your number's $1.15 a month on top, and minutes past the allowance are billed per minute. Booking needs Google Calendar connected (in beta). The free trial is 5 minutes over 14 days with no card; it answers your own test calls and doesn't book.

Where we got the numbers (read 7 Oct 2026): agency price pages and pricing guides, where 7 of 8 put the lowest monthly fee at about $300 or more and setup ran from about $300 to $2,500 (some agencies waive it), and ten US answering services' own price pages, where the cheapest 50 minutes cost $99. The quote in the video is illustrative, not a real agency's.

#AIReceptionist #AnsweringService #SmallBusinessOwner #SmallBusinessTips
```

- **Checks:**
  - `caption.py --keywords "AI receptionist,answering service"`: **READY** (1,251 chars, < TikTok's 2,200 / 4,000; first line 53 chars, lands whole; 1 ask; 4 tags).
  - `detect.py`: **PASS 95.9**; `humanize.py`: nothing to strip. No em dashes.
  - Four tags, not five: with four, the humanizer no longer flags a "hashtag wall".
- **Search:** "AI receptionist" is in the first line and spoken twice; "answering service" is in the body and a hashtag.
- **Sources go in the caption:** a TikTok comment is capped at 150 characters (§11), so the source summary lives here, not in a comment.
- **Upload:** the **60 fps** copy (`…-1080p60-…mp4`).
- **Original sound:** name it "AI receptionist · Neuro Tech Voice".

### 7.2 Instagram (Job A: the reel carries the hook; one ask; 5 hashtags; no link)

```
An agency's AI receptionist often starts around $300 a month. Ours is $49.

Comment AGENT and we'll DM you the link.

The agency route usually means a monthly fee of several hundred dollars or more, plus a setup fee that's often $1,500. A live answering service, with people on the phones, starts at $99 for 50 minutes.

Ours is $49 a month with no setup fee. You set up your AI receptionist yourself in under ten minutes: write your answers down once, and it picks up day and night and books appointments into your calendar. It tells every caller it's an AI.

The fine print: $49 a month is our Starter plan fee in US dollars, excluding VAT. Your phone number is $1.15 a month on top, and minutes past the plan's allowance are billed per minute. Cancel anytime. Booking needs Google Calendar connected (in beta; Google Calendar is a trademark of Google LLC). You can try it first with 5 free minutes over 14 days, no card; the trial answers your own test calls and doesn't book. Where the numbers come from is in the pinned comment.

#AIReceptionist #AnsweringService #SmallBusinessOwner #VoiceAI #SmallBusinessTips
```

- **Checks:**
  - `caption.py`: **READY** (1,117 chars; first line 74 chars with 3 figures in the visible window; 1 ask; 5 tags below the fold; both search terms present).
  - `detect.py`: **PASS 83.4**.
- **DM** (series §5a base): `utm_campaign=reel_ig5`; TikTok replies use `utm_source=tiktok&utm_campaign=tt_ig5`. Add this line before "Want a hand?":
  > "Booking into your calendar is on the $49 plan (Google Calendar, in beta). On the free trial you can build it and hear it answer first."
- **Alt text:**
  > "Motion-design reel on a pale gradient. Text: You're paying $300 a month for an AI receptionist? A quote sheet stamped Agency lists AI receptionist, $300 a month, and Setup, often $1,500. At agencies, that's the low end. Below it a teal card reads: Or $49 a month. No setup fee. You set it up yourself, in under ten minutes. Plus your number: $1.15 a month. A call record turns from Answered to Booked as the text says: Your AI receptionist picks up day and night, and books appointments. Ends: Comment AGENT for the link. Neuro Tech Voice."

---

## 8. Pinned comments (sources and fine print; no provider named)

**Why no provider is named.** Every agency source is itself an agency or a platform (voice.md: no competitors by name). So the public comment cites sources by category and date. The named list with URLs is in §11 of this file, and it goes by DM to anyone who asks.

**Instagram** (764 chars, `detect.py` PASS 83.0):
```
Where the numbers come from (public price pages, read 7 Oct 2026). Agencies: of the 8 agency price pages and pricing guides we read, 7 put the lowest monthly fee at about $300 or more (one started at $150). Setup fees started anywhere from about $300 to $2,500, with $1,500 in the middle, and some agencies waive them. The quote in the video is illustrative, not a real agency's. Live answering by people: across ten US services, the cheapest way to buy 50 minutes was $99. Ours: $49 a month is the Starter plan fee (USD, excl. VAT), plus $1.15 a month for your number and per-minute billing past the allowance. No setup fee, cancel anytime. We didn't compare self-serve AI receptionist apps; their prices vary. Want the full source list? Reply and we'll send it.
```

**TikTok** (136 of 150 chars; the sources are in the caption):
```
$49/mo is the Starter plan fee (USD, excl. VAT). Your number is $1.15/mo extra; minutes past the allowance are billed. Sources: caption.
```

---

## 9. Launch gate and owner checks (POSTING must carry these)

1. **Booking on the $49 plan works in the product.**
   - Today `lib/billing/entitlements.ts:43` (`starter.googleIntegrations: false`) makes `bookingGate` refuse (`lib/voice/tools/calendar.ts:22-29`).
   - The test: a Starter account with Google Calendar connected books a real test call.
   - **Until then, render with `ig5-06b`** (takes messages) and drop "books appointments" from both captions and the DM line.
2. **The pricing page says so.** Today it says otherwise in two places:
   - the Pro card's "Google Workspace, in beta: Gmail, Sheets, Calendar and Docs" (`lib/pages/home/pricing.ts:91`);
   - "booking into Google Calendar on ${CALENDAR_PLAN} and above" (`lib/pages/ai-agents.ts:40`).
3. **"(in beta)":** keep it in the captions only while the app still badges booking as beta.
4. **The trial still doesn't book after the change.** Trial `googleIntegrations: false` (`entitlements.ts:27-29`), and the captions say "doesn't book". If the owner turns booking on for the trial too, delete that clause.
5. **The live Stripe Starter price is $49.00 USD** (`STRIPE_STARTER_PRICE_ID`; the repo can't show it).
6. **Re-open by eye the pages behind the figures used** (the research fetcher summarised them):
   - Ciela and Trillet's agency guide ($300 / $1,500);
   - Agentpro ($1,500 setup);
   - Constant Concepts ($2,500 / $997);
   - PATLive ($99 / 50 min).
7. **TikTok delivery path:**
   - Confirm how an AGENT comment gets its link: a DM automation, or a DM by hand, which is allowed only if the commenter's settings permit messages.
   - Confirm whether @neuro.tech.voice can show a bio link.
   - If neither works, use `ig5-07-bio` on TikTok only if a bio link exists. Otherwise answer each comment by hand.

---

## 10. Self-check against the hard truth rules

| Rule | Status | How |
|---|---|---|
| No invented number, statistic, testimonial or result | **PASS** | Every figure traces to §11: $300, $1,500, $99 and the 7-of-8 count to RESEARCH-prices; $49, $1.15, "no setup fee" and "under ten minutes" to repo lines. No saving, percentage, customer or outcome appears |
| No competitor named | **PASS** | Categories only ("agencies", "a live answering service"). No names, logos or UI in the picture, captions or comments; the named list stays internal (§8) |
| Compare categories, each figure sourced | **PASS** | Agency monthly is B grade, hedged by "**that's the low end**". Agency setup is B grade, hedged by "**often**". Answering service $99 / 50 min is A grade (caption only). The pinned comment and TikTok caption give the source basis |
| No implied feature the $49 plan lacks | **PASS (gated)** | Shown: picks up day and night (S8), books (owner's change; launch gate §9.1, fallback `ig5-06b`). Not shown: recordings, Google Workspace beyond Calendar, voice cloning, language switching, transfers, texts |
| No minutes, overage rate or other tiers | **PASS** | No minute count or rate on screen or in the VO. Captions say only "minutes past the allowance are billed per minute" (S7 wording) |
| "$49" qualified honestly | **PASS** | Always "a month"; "Plus your number: $1.15 a month" is spoken and shown; USD / excl. VAT / metered minutes / Starter are in the caption and pinned comment; no all-in wording |
| Series coherence with ig1 | **PASS** | No wage, no "replace", no "fire". The comparison is agency-built AI receptionist vs self-set-up AI receptionist |
| No former-price device | **PASS** | No strike-through; the sheet steps back instead (FTC 16 CFR 233.1); $49 never rolls down from a higher figure |
| Fair basis (ASA comparisons, FTC 233.2) | **PASS** | The anchors are conservative ($300 is the low end; $99 is the cheapest of ten). The basis ("you set it up yourself") is spoken. The pinned comment says self-serve AI apps were not compared |
| Trial truth | **PASS** | "5 free minutes over 14 days, no card" appears only in the captions and the DM, never next to booking on screen. Captions say the trial answers test calls only and doesn't book. The on-screen CTA has no "free" (ig2 precedent) |
| Every on-screen line is spoken; ≤ 6 words per card | **PASS** | 12 screens, max 6 display words; chrome ≤ 32 px only (§3) |
| Hook in 0-2 s | **PASS, with a note** | The frame-0 card is readable at 0 s and "$300" is heard by ≈ 1.1 s. The full question runs to ≈ 3.6 s (alternate `ig5-01b` runs 2.9 s) |
| TikTok + IG safe zone | **PASS (by layout)** | Text x 86-900, y 240-1400; objects ≤ x 880 below y 640; `check-zones --film=ig5` must use the ig5 constants (§1) |
| End card = series end | **PASS** | Shared `IgEnd`: comment field types AGENT, NEUROVOICE wordmark, neurotechvoice.com, borrowed `ig1-07` |
| Secrets | **PASS** | No key printed; no code run against Cartesia |

---

## 11. Sources for every number and claim in this draft

**Outside prices** (from `ig5/RESEARCH-prices.md`, all read 2026-10-07):

| Figure | Exact source line | URL |
|---|---|---|
| "$300 a month … at agencies, that's the low end" | Ciela (Jan 8 2026): "Starter receptionist: $1,500 to $2,500 setup, $300 to $450 monthly". Trillet guide: "a common benchmark is a $300/month retainer per client, plus a setup fee and per-minute markup". Across 8 sources the monthly floors are $150, $297, $300, $500, $500, $997, $1,000, $1,500, so **7 of 8 are ≥ $297** (RESEARCH-prices §2) | https://ciela.ai/blogs/how-much-to-charge-for-ai-voice-agent · https://trillet.ai/blogs/voice-agent-pricing-strategy-guide |
| "Setup? Often $1,500" | Ciela, as above. Agentpro: "$1,500 for setup and $1,500/month for ongoing service". Setup floors across 7 sources: $297, $500, $1,000, $1,500, $1,500, $2,500, $2,500 (median **$1,500**). Trillet: "many agencies waive these" | https://agentpro.ai/resources/ai-voice-agent-vs-answering-service-vs-new-hire-a-cost-comparison-for-small-businesses · https://constantconcepts.ai/pricing/ ("Setup: $2,500 … Monthly: $997") |
| "$99 for 50 minutes" (captions only) | PATLive: "50 minutes About 20 calls", $99/mo. The cheapest way to buy 50 minutes is ≥ $99 at all 10 US services surveyed (RESEARCH-prices §1) | https://www.patlive.com/pricing/ (and the nine others listed in RESEARCH-prices §8) |
| "We didn't compare self-serve AI receptionist apps" | RESEARCH-prices §4: several cost $0-$49, so no claim is made about them | (none) |

**Our side** (repo at `claude/remotion-trailer`):

| Claim | Line |
|---|---|
| $49 a month | `lib/site.ts:1685` `{ id: "starter", name: "Starter", monthly: 49, … }`; `types/index.ts:594` `price_monthly: 49`; menu `lib/site.ts:2290` "Plans from $… a month" |
| No setup fee | `lib/pages/home/pricing.ts:243` `{ title: "No setup fee", body: "On any plan. A custom build is quoted on its own." }` |
| Number $1.15 a month | `lib/phone/pricing.ts:6` `PHONE_NUMBER_MONTHLY_PRICE_USD = 1.15`; FAQ `lib/site.ts:1932` "on its own monthly subscription at $1.15" |
| USD, excl. VAT; overage per minute | `lib/site.ts:1829` "Prices are in US dollars and exclude VAT … minutes are rounded up on each call"; RESEARCH-product §3 |
| Under ten minutes | `lib/pages/ai-agents.ts:40` "Ready in under ten minutes" |
| Four setup screens (chrome) | `lib/pages/home/start.ts:12` "Company, tone, voice, go live: four screens, then a test call" |
| Picks up day and night | `lib/voice/router.ts:196-221` (answers unless the owner chose "play a message" outside hours); RESEARCH-product S8 |
| Books appointments at $49 | **owner decision, 2026-10-07** ("si la 49$ au calendar…", "O fac eu modificarea, tu fa reelul"). Gated today by `lib/billing/entitlements.ts:43` and `lib/voice/tools/calendar.ts:22-29` → §9 |
| Dashboard strings | `components/calls/call-display.tsx:13` Booked, `:16` Answered, `:33` "Booked an appointment" |
| Tells every caller it's an AI (caption) | `lib/site.ts:2527` "It tells every caller it is an AI" |
| Cancel anytime (caption) | `lib/pages/home/pricing.ts:240-241` |
| Trial: 5 minutes, 14 days, no card; test calls only until a number is bought | `lib/site.ts:1812-1813` |

**Platform** (web search, 2026-10-07; secondary sources, directional):
- **TikTok overlay:**
  - organic: right action column ≈ 120 px+ from the right edge; bottom ≈ 350-400 px for caption, hashtags and the sound disc;
  - ads: right 242 px, bottom 440-707 px.
  - Sources: https://reap.video/blog/short-form-video-safe-zones · https://adkit.so/tools/safe-zones/tiktok · https://www.houseofmarketers.com/guide-to-safe-zones-tiktok-facebook-instagram-stories · https://affroom.com/blog/tiktok-safe-zone/
- **TikTok text limits:** comments 150 characters; captions 2,200 (4,000 in-app).
  - Sources: https://howmanywords.app/blog/tiktok-character-limits · https://www.socialync.io/blog/social-media-platform-limits-guide-2026
