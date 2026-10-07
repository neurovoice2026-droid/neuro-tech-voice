# ig5 script, draft C: "Quotes on the desk" (story-driven)

Label `draft:C`. Written 2026-10-07 on `claude/remotion-trailer` (HEAD `f7daf7c`). Planning only: no code, no voice, no existing file touched, nothing committed. No Cartesia call was made.

**Angle.** Three quotes for after-hours cover lie on the desk: an AI agency, a live answering service and a person on the evening shift. The phone is still ringing while you read them. On "Ours", the ringing light becomes the teal orb and picks up, and each quote is set aside by a step of the call: the pickup, the availability check, the booking. The $49 card then settles onto the booked call. The story is the proof: the reel shows the product working, not just a price.

**Reads first:** `ig5/RESEARCH-prices.md` (figures), `ig5/RESEARCH-product.md` (SAFE S1-S23 / UNSAFE U1-U21), `ig5/RESEARCH-format.md` (shape, hooks, fair-comparison rules), `ig5/PIPELINE.md` (build), `docs/ig/SCRIPT.md` §0.3 (series rules, `IgEnd`), `.claude/instagram/voice.md` and `profile.md`.

**Owner decisions applied:**
- "$49" goes on screen. The owner asked for it, and it overrides voice.md's "no prices" note for this one figure.
- Calendar booking at $49 is shown. The owner is changing the product and the pricing page ("O fac eu modificarea, tu fa reelul"). **Launch gate in §10.** A no-booking fallback take exists (`ig5-04b`).
- TikTok first ("Pe tiktok merg mai bine"): the "receptionist" keyword family is in the hook, the safe zone covers both apps, and a TikTok caption sits next to the Instagram one.

---

## 0. At a glance

| | |
|---|---|
| Length | **28.0 s**, 14 bars, 840 timeline frames (3360 at 120 fps). Impact f780 (bar 14 line, 26.0 s). END f840 |
| Hook (frame 0 + first words) | Desk-phone trill at f0, three blank quote slips stamped `QUOTE`, and the card **"Three quotes for your after-hours receptionist,"** set at f0. The line ends "...and the phone's still ringing." |
| Hook score | **80.0 STRONG** (`hookscore.py`, `python3 -I`). The A/B alternate scores 80.8 (§7) |
| Keyword heard | "after-hours receptionist" at ≈ 1.2-2.3 s; it is on screen from frame 0 |
| Anchors | $300 (agency) at ≈ 5.5 s · $99 (answering service) at ≈ 8.3 s · $18 an hour (evening shift) at ≈ 11.2 s |
| **$49 heard** | ≈ **13.8 s (49 %)**, on "Ours", the same word the phone is picked up on |
| Story payoff | "You're booked" ≈ 17.4 s; **the $49 card lands on the booked call at 19.5 s** |
| CTA | "Comment AGENT for the link." at f675 (**80 %**), shared `IgEnd`, NEUROVOICE + neurotechvoice.com |
| Spoken words | 59, all Tessa (Emotive). ≈ 21-23 s of speech |
| Voice roles | the narrator (untagged captions) and the sample agent Ava on the call (`● AVA`, the orb speaks). The caller is never voiced |
| Plan gate | **Booking at $49 is launch-gated** (§10) |

**Why it should travel on TikTok:**
- The hook belongs to the "receptionist" family. ig1 "Don't fire your receptionist." got 563 TikTok views, about 2x the rest.
- "After-hours receptionist" and "answering service" are both spoken and both are search phrases.
- A ringing phone that nobody answers is an open loop from 0.0 s. The loop closes at 13 s, when the orb picks up.

**Series coherence with ig1** ("Don't fire your receptionist for an AI. Not even ours."; the 123 hours the desk is closed):
- The subject is **after-hours** cover: the hours ig1 gave to the agent. Nobody's job is in question.
- A person's pay appears only as **the cost of an evening shift** (`$18 an hour`), never as a salary to cut.
- "Ours" echoes ig1's "Not even ours." The orb is its full stop, as in ig1.
- Nothing says "replace" or "fire".

---

## 1. Safe zone (TikTok + Instagram combined)

**Checked on 2026-10-07 (web search, secondary sources):**
- Organic TikTok: the safe area is about 900 × 1492 px of 1080 × 1920. The margins are about 108 px at the top, 320 px at the bottom, 60 px on the left and 120 px on the right. Other guides put the caption, username and sound block at the bottom 350-480 px.
- TikTok ads are stricter: 242 px on the right and up to 707 px at the bottom. That only matters if ig5 is ever promoted.
- Sources are in §12.4. The brief's x 60-940, y 220-1440 is already inside the organic guidance; draft C tightens it again.

**Draft C rule** (ig5-local constants; `src/ig/common/` is hashed, so nothing goes into `common/zones.ts`):

| Band | Draft C value |
|---|---|
| Top (both apps' header, tabs, search) | mesh only above **y 240** |
| Quote slips R1-R3 | x 120-880, y 262-740 |
| Desk hairline + phone light | y 760, x 86-880 (the light sits at x 880) |
| "Ours" strip | x 120-880, y 780-990 |
| Call card | x 120-880, y 1010-1300 |
| Hook card (b1) | x 86-900, y 800-1060 (it uses the strip and card area before they exist) |
| Caption line (b7) | x 86-900, y 1320-1380 |
| Bottom | mesh only below **y 1400** |
| Right edge | text never right of **x 900**; objects never right of **x 880** |
| Exception | the shared `IgEnd` comment field (x 174-906, y 940-1060), built once for ig1-ig4; it stays ≈ 40 px clear of TikTok's icons |

If the reel is ever run as a TikTok ad, scale the desk to × .95 about x 120 so its right edge sits at x 842.

---

## 2. Beat table

These are 30 fps timeline targets. `src/ig/ig5/timing.ts` re-anchors every line on the measured takes, as ig1-ig4 did. If a take runs long, the time comes out of the gap before the CTA (54 f of slack before the impact), never out of the hook.

**Acts (`SCENES`):** `hook` 0-135 · `quotes` 135-390 · `ours` 390-470 · `call` 470-588 · `shift` 588-668 · `end` 668-840.

**Colour code (series):** rose = the ringing phone and the agency anchor; graphite = people (the answering service, the evening shift); teal = ours; emerald = the app's own Booked pill.

| Beat | Frames · s | Picture (house kit, zones §1) | On-screen text (≤ 6 words per card, every word spoken) | Spoken line (id @ frame) | Sound |
|---|---|---|---|---|---|
| **b1 Hook** | 0-135 · 0.0-4.5 | **Ground:** pearl `MeshGround variant='light'` on `MUTED_MESH`, warm key low-left (.35), already drifting at f0. **The desk at f0:** three white quote slips (ig4 `DocPage` idiom, `meshElevation` 2) lie in rows R1-R3 (x 120-880; y 262-412 / 426-576 / 590-740), each askew ±1.5° and **blank**: two graphite ink bars and the chrome kind tag `QUOTE` (Geist Mono 26, 50 % graphite, top right, ≤ x 860), like ig4's `PDF` tag. A 1.5 px graphite desk hairline at y 760 is drawing at f0 (`EASE.draw`, started f −6). At its right end (x 880) sits the **rose phone light** (`MeshOrb` 18 px, `MOMENT_LIGHTS.rush`) with a `RingPulse` in flight. **S1** is set at f0 at 72 % ink: headline 76, left at x 86, three lines at y 800-1060 ("Three quotes" / "for your after-hours" / "receptionist,"). Each word lifts to 100 % on its onset, and "receptionist" takes a 1-frame glint. **At `vWord(ig5-01,6) − 2` (≈ f72):** S1 exits up through its masks (4 f) and **S2** rises at y 800-980, with "ringing" in rose ink, placed so "ringing" lands on ring 2 (f120). **Camera:** push 1.00 → 1.02 | S1 [0-5] "Three quotes for your after-hours receptionist," (set at f0) · S2 [6-10] "and the phone's still ringing." | `ig5-01` @6: "Three quotes for your after-hours receptionist, and the phone's still ringing." | `fx-trill` at f0 + f30 (ring 1) and f120 + f150 (ring 2), each with a `RingPulse`. The bed starts at f0 at −6 dB: shaker 8ths and the muted felt-piano E ostinato (ig1 arrangement). A soft `thump` on "receptionist" |
| **b2 Quote 1** | 135-215 · 4.5-7.2 | S2 exits up (4 f). **R1 straightens** (−1.5° → 0°, `SPRING.site`, one move) and prints on her words: "AI agency:" (title 40, graphite); **"$300"** (display 96, **rose**, tabular) rolls 0 → 300 on "three hundred" (`Roll` helper, ≈ 0.6 s, settles on `SPRING.land`); "a month" (title 40). On "plus setup" a rose-outline chip **"+ setup"** (title 34) clips onto the row's right end (≤ x 860). **Light:** the key starts to lower and a `MOMENT_LIGHTS.night` tint creeps in (mix 0 → .3 across b2-b4). It is evening on the desk, done with light only; the ground never goes dark | R1 [0-7] "AI agency: $300 a month + setup" | `ig5-02` @135 (one take for b2-b4): "AI agency, three hundred a month plus setup; ..." | `fx-paper` slap tuned E4 on the straighten; `fx-tick` 32nds under the roll and `fx-tock` on its landing; `fx-tag` on the chip. Ring 3 at f240 + f270, ducked −8 dB under the voice |
| **b3 Quote 2** | 215-300 · 7.2-10.0 | **R2 straightens** and prints: "Answering service:" (title 40) beside an IG-local lucide `users` glyph (28 px, graphite: people); **"$99"** (display 96, **graphite**) rolls 0 → 99 on "ninety-nine"; "for 50 minutes" (title 40, with "50" from the display map) | R2 [8-13] "Answering service: $99 for 50 minutes" | `ig5-02` (cont.): "...answering service, ninety-nine for fifty minutes; ..." | `fx-paper` G#4; ticks and tock |
| **b4 Quote 3** | 300-390 · 10.0-13.0 | **R3 straightens** and prints: "Evening shift:" with a lucide `user` glyph (graphite); **"$18"** (display 96, graphite) rolls 0 → 18 on "eighteen dollars"; "an hour." The three rows now read together, and the light is still pulsing. **Camera:** eases back 1.02 → 1.00 | R3 [14-19] "Evening shift: $18 an hour." | `ig5-02` (cont.): "...evening shift, eighteen dollars an hour." | `fx-paper` B4; ring 4 (one burst at f360, ducked) |
| **b5 Ours (price payoff)** | 390-470 · 13.0-15.7 (**$49 at ≈ 49 %**) | **On "Ours" (f390, a beat): the pickup.** The rose light springs open into the **teal orb** (film 2's birth: a 3-frame seed, `SPRING.pop` 0 → 1.06 → 1, one hairline ring, `mixPalette` rush → sunday over 6 f). **f396:** R1 **steps back** (× .94 about its left edge, ink to 55 %, 6 px up, contact shadow thins). That is the agency quote, set aside on the pickup. **f400-414:** the orb glides (`EASE.inOut`, 0.45 s) to its full-stop position. A white strip with a teal edge (`Panel` + `ContactShadow`, x 120-880, y 780-990) rises under the hairline. It holds "Ours:" (title 44, teal), "from" (title 52), **"$49"** (display 150, teal, tabular), which **rises still and never rolls**, and "a month," (title 52). The orb (Ø 40, breathing) is the full stop. **On "no setup fee" (≈ f460):** a teal chip **"No setup fee."** (title 40) lands at the strip's lower right (y 930-975, ≤ x 860), level with R1's "+ setup" chip above. **Ground:** a sunday pool rises behind the strip (mix 0 → .3 over 1 s from f414) | P1 [0-5] "Ours: from $49 a month," · P2 [6-8] chip "No setup fee." | `ig5-03` @390: "Ours: from forty-nine dollars a month, no setup fee." | **f390:** `fx-pickup` click cuts the ring; `fx-seed` + `fx-ting` (the birth); `fx-linehiss` enters at −50 dBFS. **On "forty-nine":** `ping` + `chime-sunday-soft` + `fx-mallet-e5` ("true"); the pad opens an octave. `fx-tag` on the chip |
| **b6 The call** | 470-588 · 15.7-19.6 | **f470:** the **call card** rises below the strip (white `Panel`, `meshElevation`, x 120-880, y 1010-1300, `SPRING.site`). The header (y 1025-1075) shows `● SAMPLE CALL` (label 28; ig2's kicker) and the `OutcomePill` **Answered** (blue) at the right. **f478-505:** a `● CALLER` row with the **CallerMeter** (5 slate bars, no words); the orb leans into its listen palette. **f505:** the ToolRow "Checked your availability" (meta 30) spins and resolves to a drawn `CheckMark`. Three slot chips rise (150 × 56, ink bars, no labels) and one takes a teal outline. **f508:** R2 steps back (set aside on the check). **Ava, @510:** the `● AVA` row (title 46) writes "You're booked, Saturday at ten." That row is the caption. The orb breathes on her envelope at in-call volume. **On "booked" (≈ f522):** the ToolRow "Booked an appointment" ticks, and the pill swaps Answered → **Booked** (emerald, `OUTCOME_META.booked`) with `Swap`. **f530:** R3 steps back (set aside on the booking). **On "Saturday at ten" (≈ f540-565):** the outlined chip fills teal and reads "Sat 10:00". **f585: the $49 strip lowers 20 px and seals onto the call card's top edge** (`SPRING.land`, the contact shadows merge). The price now sits on the booked call. No Google UI and no logo. Add a `BETA` chip only if the app still badges booking as beta at launch | A1 [0-4] `● AVA` "You're booked, Saturday at ten." · chip "Sat 10:00" | `ig5-04` (Ava) @510: "You're booked, Saturday at ten." | `fx-paper-lift` on the card. The caller's turn is line hiss +3 dB only, never voiced. A brushed shaker 16ths from f505; a quiet `fx-tick` roll under the spinner and `fx-ting` on the check. `fx-mallet-e5` + `pop` on "booked"; `fx-tock` on the chip fill. **f585:** `land` + soft `thump`, and the harmony lifts A → B |
| **b7 The shift** | 588-668 · 19.6-22.3 | **f588:** the hang-up (a beat); the line hiss cuts. The caption **S3** rises in the caption line (title 52, graphite, with "three hours" in teal; x 86-900, y 1320-1380). **On "that shift" (≈ f640):** R3 alone **relights** to full ink, and a teal hairline draws **under** its "$18 an hour". It is an underline, never a strike-through. The strip and the booked call stay put | S3 [0-5] "Under three hours of that shift." | `ig5-05` @592: "Under three hours of that shift." | `fx-click-down/up` (hang-up) at f588; the bed thins to piano; `fx-tick` on the relight |
| **b8 CTA** | 668-780 · 22.3-26.0 (**80 %**) | The shared **`IgEnd`**. The desk (slips, strip, call) steps back (× .92, shade .08) and dims to 40 %. The CTA caption is centred at y 700-860. The white comment field rises at **f667** (x 174-906, y 940-1060), **before** she says "Comment", so muted viewers get the instruction. **AGENT** types one letter per 16th from `vWord(ig5-06,1)`. The send disc presses (.97) as "link" ends (≈ f726) | S4 [0-4] "Comment AGENT for the link." | `ig5-06` @675: "Comment AGENT for the link." | `fx-keys`; half-bar snare roll from f750 |
| **b9 Brand** | 780-826 · 26.0-27.5 | **The impact on the bar line (END − 60):** the field leaves up (4 f); `LightGL` blooms with one teal emitter; the **NEUROVOICE** wordmark surfaces at y 760-900; `neurotechvoice.com` (Geist Mono 44, y ≈ 1000) types on "Neuro \| Tech \| Voice" | wordmark + URL | `ig1-07` @784 (borrowed take): "Neuro Tech Voice." | impact + `sub` + E chord at f780 |
| **b10 Seam** | 826-840 · 27.5-28.0 | The wordmark leaves up. The slips' prints wipe back to blank ink bars (a reverse print, 6 f) and drift back askew. The strip and the call card fold into the orb, and the orb shrinks into the rose desk light. S1 sets at 72 % by f839. A `RingPulse` launches at f836, so the replay starts mid-ring, exactly as frame 0 shows it | (S1, as at f0) | (none) | `MIX.fadeOut` [826, 840] to < −60 dBFS. The replay's first sound is the f0 trill |

**Timing estimate.** `beats.py vo.txt --wpm 167 --target 28` (Tessa's measured 2.78 words/s) gives 59 words and ≈ 21.2 s of speech. At the brief's calm 2.5 words/s it is ≈ 23.6 s. The frame plan above uses estimates from the closest measured ig takes: ig1-01 (10 words, 3.98 s) for the hook, ig2-03 for the payoff line, ig2-04 for Ava's line and ig2-07 for the CTA. The CTA ends at ≈ f726, which leaves 54 f before the impact.

**Muted read** (frame 0 → payoff, no sound):
1. three blank `QUOTE` slips;
2. "Three quotes for your after-hours receptionist," and "...still ringing" beside a pulsing rose light;
3. the rows print $300 (rose), $99 and $18 (graphite);
4. the rose light turns teal and "Ours: from $49 a month," rises beside "No setup fee.";
5. a call card goes from Answered to **Booked**, and the $49 strip seals onto it.

**Figure sizes.** The anchors are 96 px, and $49 is 150 px.
- RESEARCH-format asks for anchors of at least 120 px. Draft C has four stacked objects on one frame (three slips, the strip and the call card), so 96 px is the largest that fits y 262-1300.
- Each anchor is alone on its row and rolls on its word, which helps legibility.
- If the build's legibility pass says 96 px is too small, the fix is to drop the slips' label line to 34 px and lift the figures to 108 px. Do not make the rows taller.

---

## 3. Voice lines

Every line is Tessa (Emotive) `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`, role `ava`, speed 1.05, at the same `level` block as `scripts/voice-lines-ig.json`. Each line is full-band, with no phone EQ, as in the series. `say` is the spoken form; the `display` map puts numerals on screen.

| id | Voice / tag | text (say) | On screen (display) | Est. length | Notes |
|---|---|---|---|---|---|
| `ig5-01` | narrator | Three quotes for your after-hours receptionist, and the phone's still ringing. | S1 "Three quotes for your after-hours receptionist," / S2 "and the phone's still ringing." | ≈ 4.0 s | One breath, with a light comma pause. "ringing" lands on ring 2 |
| `ig5-02` | narrator | AI agency, three hundred a month plus setup; answering service, ninety-nine for fifty minutes; evening shift, eighteen dollars an hour. | R1 "AI agency: $300 a month + setup" · R2 "Answering service: $99 for 50 minutes" · R3 "Evening shift: $18 an hour." | ≈ 7.6-8.0 s | **One take**, read as a list with a short beat at each semicolon. A single long sentence is what gets the script past the humanizer (§7) |
| `ig5-03` | narrator | Ours: from forty-nine dollars a month, no setup fee. | P1 "Ours: from $49 a month," · P2 "No setup fee." | ≈ 3.3 s | Calm and level, no sell. The pickup lands on "Ours" |
| `ig5-04` | **Ava** (`● AVA`, the orb speaks) | You're booked, Saturday at ten. | A1 "You're booked, Saturday at ten." + chip "Sat 10:00" | ≈ 2.0 s | Warm and on the call. **Launch-gated** (§10) |
| `ig5-05` | narrator | Under three hours of that shift. | S3 "Under three hours of that shift." | ≈ 2.1 s | Plain arithmetic: $49 ÷ $18.27 = 2.68 h |
| `ig5-06` | narrator | Comment AGENT for the link. | S4 "Comment AGENT for the link." | ≈ 1.7 s | Same words as `ig2-07`, but a **fresh ig5 take**: `ig5/PIPELINE.md` §0 (decision 4) allows exactly one borrow, `ig1-07` |
| `ig1-07` | narrator | Neuro Tech Voice. | wordmark + URL | 1.355 s (measured) | `{"id": "ig1-07", "borrow": "ig1"}`, byte for byte |

**Alternates** (synthesise in the same batch; each costs one Cartesia call):

| id | text | Use |
|---|---|---|
| `ig5-01b` | What would your after-hours receptionist cost? Three quotes. | **A/B hook** (80.8 STRONG, ≈ 3.0 s, keyword heard by ≈ 1.2 s). Cards: "What would your after-hours receptionist cost?" (6) / "Three quotes." Price-led rather than story-led. Use it for the re-cut if the 3-s hold is weak, or as a Trial Reel once eligible (≈ 200 followers) |
| `ig5-01c` | Your after-hours receptionist: three quotes. The phone's still ringing. | **Keyword-first A/B** for TikTok search (79.4 raw / 83.0 patched; "after-hours receptionist" heard by ≈ 1.0 s). Cards: "Your after-hours receptionist:" / "three quotes." / "The phone's still ringing." |
| `ig5-02a` · `ig5-02b` · `ig5-02c` | AI agency: three hundred a month, plus setup. · Answering service: ninety-nine for fifty minutes. · Evening shift: eighteen dollars an hour. | **Safety split** if the one-take list sounds rushed or flat. Same screens. It costs ≈ 0.5 s and the humanizer's burstiness pass (§7) |
| `ig5-02m` | AI agency, three hundred a month plus setup; answering service, over a dollar a minute; evening shift, eighteen dollars an hour. | **Only if "no minutes" is read as "no minute counts at all"**, the answering service's included 50 minutes among them (see §11). R2 becomes "Answering service: over $1 a minute" (6). It is A-grade: every published rate at every tier of the nine per-minute providers is above $1.00 |
| `ig5-04b` | I'll have the team call you back. | **No-booking fallback** if the owner's change is not live on posting day. It is true today on every plan (S12, `take_message`; ig4-07 precedent). The ToolRow becomes "Took a message", the pill turns **Message taken** (indigo), and there are no slot chips. Captions drop "books" (§10) |
| `ig5-06-bio` | The link's in our bio. | Only if neither app's keyword-to-DM path is live on posting day (POSTING §0.1 precedent) |

**Display map (new entries):**
- `ig5-02`: [2-3] "three hundred" → `$300` · [6] "plus" → `+` · [10] "ninety-nine" → `$99` · [12] "fifty" → `50` · [16-17] "eighteen dollars" → `$18`
- `ig5-02` punctuation: the spoken commas and semicolons display as each row's colon ("AI agency:" and so on)
- `ig5-03`: [2-3] "forty-nine dollars" → `$49`
- `ig5-04`: the chip "Sat 10:00" sits over [2-4]. The row itself keeps her words, as ig2 did with "Maya · Sat 10:00"

**Screens as word spans:**
- `ig5-01`: S1 [0-5] · S2 [6-10]
- `ig5-02`: R1 [0-7] · R2 [8-13] · R3 [14-19]
- `ig5-03`: P1 [0-5] · P2 [6-8]
- `ig5-04`: A1 [0-4]
- `ig5-05`: S3 [0-5]
- `ig5-06`: S4 [0-4]

**Display words per card:** S1 6 · S2 5 · R1 6 (+ a symbol) · R2 6 · R3 5 · P1 5 · P2 3 · A1 5 · S3 6 · S4 5. All are ≤ 6. A card here is one object. The three slips, the strip and the call card stay on screen together on purpose, because the comparison needs them side by side.

**Chrome that is not a line.** Each is ≤ 32 px, carries no claim, and appears on or after the word it belongs to:
- `QUOTE` (from f0; the object's kind tag, like ig4's `PDF`)
- the lucide `users` / `user` glyphs (icons, no text)
- `● SAMPLE CALL`, `● CALLER`, `● AVA` (ig2's tags)
- the dashboard's own strings: Answered / Booked (`components/calls/call-display.tsx:16, :13`) and "Checked your availability" / "Booked an appointment" (`:32, :33`)
- `BETA`, only if the app shows it at launch

---

## 4. How "$49" is qualified, honestly

- **On screen and spoken:** "Ours: **from** $49 **a month**," and then "No setup fee."
  - "From" is the site's own word: the header menu prints "Plans from $49 a month" (`lib/site.ts:2290`).
  - It covers what sits on top of the plan fee: the $1.15 number, VAT and per-minute usage past the allowance.
  - "A month" stands next to every monthly figure in the reel.
- **Not on screen, but in both captions and the pinned comments:**
  - the plan name (Starter);
  - USD, excl. VAT;
  - the $1.15 a month number;
  - "minutes past the plan's allowance are billed per minute" (S7 wording, with no count and no rate).

  "Starter" stays off the picture because the series names no plan on screen except Pro. That keeps the screen to spoken words only.
- **Why there is no spoken "$1.15" beat** (draft B has one): this concept's call needs that time. Timing is in §2: the "$1.15" line would push the CTA's end to ≈ f766, 14 f before the impact.
- **The comparison's basis is visible:**
  - "AI agency" says whose $300 it is.
  - The `users` / `user` glyphs mark the two people-staffed quotes.
  - "Under three hours of that shift" turns $18 **an hour** against $49 **a month** into one unit, so the hourly figure never looks cheaper than $49.
- **Never used:** "only $49", all-in, flat, unlimited, "that's it", "no hidden fees", cheapest, "save X", "X times cheaper", "replace", "fire".

---

## 5. Why the quotes are set aside, not struck through

The brief for this angle says each quote is "struck through" as the call progresses. Draft C keeps the beat and changes the device:
- **A strike-through on a price, next to $49, reads as "was $300, now $49".** That is a former-price claim we cannot make: we never charged $300 (FTC 16 CFR 233.1; RESEARCH-format §2.4 and §2.7).
- **A struck row also stops being readable.** The joint view of all four prices is what makes $49 easy to judge (RESEARCH-format §2.2).

**What happens instead.** Each quote **steps back**: × .94, ink to 55 %, 6 px up, with a thinner shadow. The figure stays legible. Each step-back is triggered by a moment of the call:

| Call moment | Frame | Quote set aside |
|---|---|---|
| the pickup, on "Ours" | f396 | R1, the AI agency |
| the availability check | f508 | R2, the answering service |
| "booked" | f530 | R3, the evening shift |

The one mark ever drawn on a quote is the teal **underline** under R3's "$18 an hour" in b7. It points at the figure the line compares with. It never cancels it.

---

## 6. Cover

- **Cover frame:** a custom PNG, `IG5-Cover-9x16`, built from the b7 composition (≈ f600). The three stepped-back slips show their figures, and the teal "Ours: from $49 a month●" strip is sealed onto the **Booked** call card.
- **Layout** (all inside x 86-900, y 280-1380: inside IG's 3:4 grid crop (y 240-1680) and TikTok's 3:4 grid tile, clear of the tile's bottom-left view count):
  - the kicker `AI RECEPTIONIST · 05` (label role, x 86, y 290);
  - the title on two lines at 104 px:
    - "**Three quotes.**" (graphite), y 340-450;
    - "**Ours: from $49.**" ("$49" in teal, with the orb as its full stop), y 460-570. The line measures ≤ 814 px;
  - the desk thumbnail at × .62, y 640-1380: three slips, the strip, and the call card with its emerald **Booked** pill.
- **Cover line:** **"Three quotes. Ours: from $49."** (5 words; both halves are spoken in the reel).
- **Instagram:** Edit cover → Add from camera roll.
- **TikTok:**
  - Upload the PNG if the app offers "upload from photos".
  - Otherwise pick frame ≈ f600 with **no** TikTok text sticker; that frame already shows all four prices and the Booked pill.
- **Fallback:** frame 0 (three `QUOTE` slips, the ringing light, and "Three quotes for your after-hours receptionist,").

---

## 7. Hook and script scores (run 2026-10-07 with `python3 -I`, scratch copies only)

```
python3 -I .claude/skills/ig-reel/hookscore.py hooks.txt
```

| Hook | Score | Spoken | Keyword heard | Notes |
|---|---|---|---|---|
| **"Three quotes for your after-hours receptionist, and the phone's still ringing."** (`ig5-01`, primary) | **80.0 STRONG** | ≈ 4.0 s | ≈ 1.2-2.3 s | Story-led. LENGTH 88, SPECIFICITY 75, STAKES 70 ("still"), FRONTLOAD 100, ADDRESS 100 |
| "Three quotes for your after-hours receptionist. The phone's still ringing." | 83.0 STRONG | ≈ 4.0 s | same | Same words, with a full stop instead of a comma. The extra 3 points are a scorer artefact: "The" after the full stop counts as a proper noun. The comma version is the honest score |
| "What would your after-hours receptionist cost? Three quotes." (`ig5-01b`) | 80.8 STRONG | ≈ 3.0 s | ≈ 0.4-1.2 s | The A/B alternate: price-led, shorter |
| "Your after-hours receptionist: three quotes. The phone's still ringing." | 79.4 STRONG raw; 83.0 with the "yo" bug patched (scratch copy) | ≈ 4.0 s | ≈ 0.2-1.0 s | Kept as a second alternate (`ig5-01c`), a keyword-first test for TikTok search. It is not the primary because it reads as a title, not a sentence. The patched 83.0 has the same "The" artefact, so it ties the primary |
| "Three quotes for your after-hours receptionist." | 55.4 OK | ≈ 2.6 s | ≈ 1.2-2.3 s | Rejected: nothing at stake (STAKES 20). The ringing is what earns the hold |
| Reference: "You're paying $39 a month for a robot that types check your DMs." | 75.0 STRONG | ≈ 4.7 s | | For comparison (RESEARCH-format §6) |

The scorer's "yo" bug (RESEARCH-format §6) does not touch the primary, which starts with "Three". The patched copy (whole-word match, scratch only; the skill was not edited) changes only `ig5-01c`.

**Hook in 0-2 s.** The spoken hook runs ≈ 4.0 s, and `beats.py` flags it as past 3 s. It is accepted because the first two seconds already carry the stop:
- the ring at 0.0 s;
- three `QUOTE` slips and the full first card, readable at frame 0;
- "Three quotes" heard by ≈ 0.8 s;
- "after-hours receptionist" heard by ≈ 2.3 s.

"Still ringing" adds the stake. If the 3-s hold comes in under 60 % on TikTok, re-cut with `ig5-01b` (≈ 3.0 s).

**Other checks:**
- **`beats.py vo.txt --wpm 167 --target 28`:** 59 words, ≈ 21.2 s of speech, 7 beats.
  - The hook flag is addressed above.
  - "7.2 s on one beat" is the one-take quote list. The picture changes three times inside it, one slip per ≈ 2.5 s.
  - "Nothing concrete" flags on the spelled-out lines are artefacts, because the screen shows $300 / $99 / $18 / $49.
  - "No loop": the loop is visual. The seam re-forms frame 0, mid-ring.
- **`detect.py`:**
  - spoken script: **PASS 83.4** (burstiness 86.2, from the one-take list);
  - on-screen text: **PASS 78.3**.
  - With three separate quote takes, the spoken script falls to REVIEW 56.2. That is why `ig5-02` is one take.
- **`humanize.py --report`:** "Nothing to strip" on every text in this draft (script, screens, both captions, both pinned comments). No em dashes.
- **Banned words absent:** voice.md's never-say list, and RESEARCH-format §3's price and overreach list (only, cheapest, unlimited, all-in, flat, save, replace, fire, every call, never misses, every language, 5-minute setup, no contract).

---

## 8. Captions

### 8.1 TikTok (keyword-first line for TikTok search; one ask; 4 hashtags; no link)

```
After-hours receptionist cost: three quotes, and ours from $49 a month.

Closed is for the door, not the phone. So we priced three ways to cover the calls after you close. An AI agency that builds you an AI receptionist: about $300 a month, plus setup. A live answering service, with people on the phones: $99 for 50 minutes. Someone on the evening shift: about $18 an hour. Ours is from $49 a month with no setup fee, and $49 is less than three hours of that shift's pay. It picks up day and night, answers from what you wrote down once, and books the appointment into your calendar.

Comment AGENT and we'll send you the link.

Fine print: $49 a month is our Starter plan fee (USD, excl. VAT). Your phone number is $1.15 a month on top, and minutes past the plan's allowance are billed per minute. Booking needs Google Calendar connected (in beta). The free trial is 5 minutes over 14 days with no card; it answers your own test calls and doesn't book. It tells every caller it's an AI.

Where the numbers come from (public pages, read 7 Oct 2026): agency price pages and pricing guides, where 7 of 8 put the lowest monthly fee at about $300 or more and setup is often $1,500 (some waive it); ten US answering services' own price pages, where the cheapest 50 minutes cost $99; the US Bureau of Labor Statistics, median receptionist pay $18.27 an hour (May 2025, wages only). The quotes in the video are illustrative, not real businesses'.

#AIReceptionist #AnsweringService #AfterHoursAnswering #SmallBusinessOwner
```

- **Checks:**
  - `caption.py --keywords "after-hours receptionist,answering service,AI receptionist"`: **READY**. 1,516 characters, under TikTok's 2,200 (4,000 in-app). The first line is 71 characters and lands whole. One ask; 4 tags; 3 of 3 search terms present.
  - `detect.py`: **PASS 85.9**. `humanize.py`: nothing to strip.
- **Search:** "After-hours receptionist" opens the caption and is the hook's keyword. "Answering service" and "AI receptionist" are in the body and the tags. "Closed is for the door, not the phone." is the brand's own line (voice.md).
- **Sources live in the caption,** because a TikTok comment is capped at 150 characters.
- **Upload:** the **60 fps** copy (`…-1080p60-…mp4`).
- **Original sound:** name it "After-hours receptionist · Neuro Tech Voice".

### 8.2 Instagram (Job A: the reel carries the hook; one ask; 4 hashtags; no link)

```
Comment AGENT and we'll DM you the link. Ours is from $49 a month, no setup fee.

Three quotes for an after-hours receptionist. An AI agency: about $300 a month, plus setup that's often $1,500. A live answering service, with people on the phones: $99 for 50 minutes. Someone on the evening shift: about $18 an hour. Our $49 is less than three hours of that shift's pay.

You set it up yourself in under ten minutes, and from then on your AI receptionist picks up day and night from the answers you wrote down once, books the appointment into your calendar and tells every caller it's an AI.

The fine print: $49 a month is our Starter plan fee in US dollars, excluding VAT. Your phone number is $1.15 a month on top, and minutes past the plan's allowance are billed per minute. Cancel anytime. Booking needs Google Calendar connected (in beta; Google Calendar is a trademark of Google LLC). The free trial is 5 minutes over 14 days with no card; it answers your own test calls and doesn't book. Where every number comes from is in the pinned comment.

#AIReceptionist #AnsweringService #AfterHoursAnswering #SmallBusinessOwner
```

- **Checks:**
  - `caption.py`: **READY**. 1,126 characters; the first line is 80 characters and lands whole with the ask and $49 visible. One ask; 4 tags below the fold; 3 of 3 search terms present.
  - `detect.py`: **PASS 93.8**.
  - With 5 tags, the humanizer flagged a "hashtag wall", so the reel uses 4.
- **DM** (series §5a base): `utm_campaign=reel_ig5`. TikTok replies use `utm_source=tiktok&utm_campaign=tt_ig5`. Add this line before "Want a hand?":
  > "Booking into your calendar is on the $49 plan (Google Calendar, in beta). On the free trial you can build it and hear it answer first."
- **Alt text:**
  > "Motion-design reel on a pale desk. Three quote slips lie blank while a phone light rings. Text: Three quotes for your after-hours receptionist, and the phone's still ringing. The slips fill in: AI agency, $300 a month plus setup. Answering service, $99 for 50 minutes. Evening shift, $18 an hour. The phone light turns into a teal orb: Ours, from $49 a month, no setup fee. A sample call card reads: You're booked, Saturday at ten; its label turns from Answered to Booked and the $49 card settles onto it. Under three hours of that shift. Ends: Comment AGENT for the link. Neuro Tech Voice."

---

## 9. Pinned comments (sources and fine print; no provider named)

**Why no provider is named.** voice.md rules out competitors by name, so the public comment cites sources by category and date. The named list with URLs is in §12, and it goes by DM to anyone who asks.

**Instagram** (755 characters; `detect.py` PASS 78.0; nothing to strip):
```
Where the numbers come from (public price pages, read 7 Oct 2026). AI agency: of the 8 agency price pages and pricing guides we read, 7 put the lowest monthly fee at about $300 or more (one started at $150). Setup fees ran from about $300 to $2,500, with $1,500 in the middle, and some agencies waive them. Answering service: across ten US live answering services, the cheapest way to buy 50 minutes was $99. Evening shift: the US median pay for receptionists is $18.27 an hour (Bureau of Labor Statistics, May 2025), wages only, so $49 buys about 2.7 hours of it. The quotes in the video are illustrative, not real businesses'. We didn't compare self-serve AI receptionist apps; their prices vary. Want the full list with links? Reply and we'll send it.
```

**TikTok** (147 of 150 characters; the sources are in the caption):
```
Fine print: $49/mo is the Starter plan fee (USD, excl. VAT). Your number's $1.15/mo extra; minutes past the allowance are billed. Sources: caption.
```
`detect.py` reports REVIEW 62.0 on this one only because it is "too short to judge". `humanize.py` finds nothing to strip.

---

## 10. Launch gate and owner checks (POSTING must carry these)

1. **Booking on the $49 plan works in the product.**
   - Today `lib/billing/entitlements.ts:43` (`starter.googleIntegrations: false`) makes `bookingGate` refuse (`lib/voice/tools/calendar.ts:22-29`, "Booking by phone isn't included in this business's plan").
   - The test: a Starter account with Google Calendar connected books a real test call.
   - **Until then, render with `ig5-04b`** (takes a message), drop "books the appointment into your calendar" and the "Booking needs…" clause from both captions, and drop the DM line.
2. **The pricing page says so.** Today it says otherwise:
   - the Pro card lists "Google Workspace, in beta: Gmail, Sheets, Calendar and Docs" (`lib/pages/home/pricing.ts:91`);
   - the product page says "booking into Google Calendar on ${CALENDAR_PLAN} and above" (`lib/pages/ai-agents.ts:40`).

   `voice.md` and `profile.md` also say "Calendar booking needs Pro" and should be updated once the change ships.
3. **"(in beta)":** keep it in the captions only while the app still badges booking as beta. Show the `BETA` chip on screen on the same condition.
4. **The trial still doesn't book after the change.** Trial `googleIntegrations: false` (`entitlements.ts:29`), and the captions say "doesn't book". If the owner turns booking on for the trial too, delete that clause.
5. **The live Stripe Starter price is $49.00 USD.** That is `STRIPE_STARTER_PRICE_ID`; the repo can't show it.
6. **Re-open by eye the pages behind the figures used.** The research fetcher summarised them:
   - Ciela and Trillet's agency guide ($300, setup);
   - Agentpro ($1,500 setup);
   - Constant Concepts ($2,500 / $997);
   - PATLive ($99 / 50 minutes);
   - the BLS receptionists page ($18.27).
7. **"No minutes" reading.** The reel shows no minutes, overage or tier of **ours**. It does show the answering service's "50 minutes", because that is what its $99 buys, and dropping it would make "$99" unfair to them. If the orchestrator reads "no minutes" as "no minute counts at all", swap in `ig5-02m` ("over a dollar a minute").
8. **TikTok delivery path.**
   - Confirm how an AGENT comment gets its link: a DM automation, or a DM by hand (allowed only if the commenter's settings permit messages).
   - Confirm whether @neuro.tech.voice shows a bio link (linktr.ee per profile.md).
   - If neither works, answer each comment by hand.

---

## 11. Self-check against the hard truth rules

| Rule | Status | How |
|---|---|---|
| No invented number, statistic, testimonial or result | **PASS** | Every figure traces to §12:<br>• $300, "plus setup", $99 / 50 minutes and $18 an hour come from RESEARCH-prices;<br>• "under three hours" is arithmetic ($49 ÷ $18.27 = 2.68 h);<br>• $49 and "no setup fee" are repo lines.<br>No saving, percentage, customer or outcome appears. The call is labelled `SAMPLE CALL` and the captions say the quotes are illustrative |
| No competitor named | **PASS** | Categories only: AI agency, answering service, evening shift. No names, logos or UI in the picture, captions or comments. The named list stays internal (§12) and goes out by DM only on request |
| Compare categories, each figure sourced | **PASS** | • Agency $300 is B grade: 7 of 8 floors are ≥ $297, and "about" sits in the captions.<br>• "+ setup" is typical (median $1,500); "often" and "some waive it" are in the captions.<br>• $99 / 50 min is A grade: the cheapest of ten.<br>• $18 is the BLS median, rounded **down** from $18.27.<br>All four anchors lean in the competitor's favour (FTC 16 CFR 233.2, "representative") |
| No implied feature the $49 plan lacks | **PASS (gated)** | • Shown: picks up after hours (S8); availability check and booking (owner's change, launch gate §10.1, fallback `ig5-04b`); a call record (S15).<br>• Not shown: recordings, Gmail/Sheets/Docs, voice cloning, transfers, texts, language switching |
| No minutes, overage rate or other tiers (ours) | **PASS** | • None on screen or in the VO.<br>• The captions say only "minutes past the plan's allowance are billed per minute" (S7 wording, no count, no rate).<br>• The answering service's own "50 minutes" is its unit, not ours (§10.7 and the `ig5-02m` alternate) |
| "$49" qualified honestly | **PASS** | • "**from** $49 **a month**" on screen and spoken (the site's own "Plans from $49 a month").<br>• "No setup fee" (`pricing.ts:243`).<br>• Starter, USD, excl. VAT, the $1.15 number and per-minute billing past the allowance are in both captions and both pinned comments.<br>• No all-in wording |
| Series coherence with ig1 | **PASS** | • The subject is after-hours cover, the hours ig1 hands to the agent.<br>• A person's cost appears only as "Evening shift: $18 an hour" and "Under three hours of that shift": the cost of covering closed hours, never a salary to cut.<br>• No "replace", no "fire".<br>• "Ours" echoes ig1's "Not even ours" |
| No former-price device | **PASS** | No strike-through. Quotes step back and stay legible (§5); the one mark is an underline. $49 rises still and never rolls down from a higher figure. This deviates from the angle's "struck through", for FTC 16 CFR 233.1 |
| Fair basis (ASA comparisons; FTC 233.2) | **PASS** | • The labels say who charges what ("AI agency"); the people glyphs mark the two human quotes.<br>• "Under three hours of that shift" puts the hourly and monthly figures in one unit.<br>• The captions say "with people on the phones" and that ours "tells every caller it's an AI".<br>• The pinned comment says self-serve AI apps were not compared |
| Trial truth | **PASS** | "5 minutes over 14 days, no card" appears only in the captions and the DM, never on screen next to booking (ig2 rule). The captions say the trial answers test calls only and doesn't book |
| Every on-screen line is spoken; ≤ 6 words per card | **PASS** | 10 cards, max 6 display words (§3). Chrome is ≤ 32 px, carries no claim, and is the dashboard's or ig2's own strings |
| AI disclosure | **PASS** | The call shows only the booking turn, so no greeting is shown and nothing contradicts the always-on disclosure (`lib/site.ts:2527`). Both captions say "tells every caller it's an AI" |
| Hook in 0-2 s | **PASS, with a note** | At 0.0 s: the ring, the `QUOTE` slips and the full first card. "Three quotes" is heard by ≈ 0.8 s and "after-hours receptionist" by ≈ 2.3 s. The full line runs ≈ 4.0 s; the alternate `ig5-01b` runs ≈ 3.0 s |
| $49 by 45 % (RESEARCH-format guideline) | **NEAR** | $49 is heard at ≈ 13.8 s (**49 %**) and lands on the booked call at 19.5 s. That is the cost of a story-led concept that reads three anchors first. It is earlier than ig2's "You're booked" (63 %) |
| TikTok + IG safe zone | **PASS (by layout)** | Text x 86-900, y 262-1380; objects ≤ x 880; nothing above y 240 or below y 1400 except the series `IgEnd`. `check-zones --film=ig5` must use the ig5 constants (§1) |
| End card = series end | **PASS** | Shared `IgEnd`: the comment field types AGENT; the NEUROVOICE wordmark; neurotechvoice.com; the borrowed `ig1-07` |
| Tessa only; callers never voiced | **PASS** | Six new Tessa takes plus one borrow. The caller is a slate level meter plus line hiss |
| Secrets | **PASS** | No key was read or printed. No Cartesia call was made |

---

## 12. Sources for every number and claim in this draft

### 12.1 Outside prices (from `ig5/RESEARCH-prices.md`, all read 2026-10-07)

| On screen | Exact source line | URL |
|---|---|---|
| "AI agency: $300 a month" | Ciela (Jan 8 2026): "Starter receptionist: $1,500 to $2,500 setup, $300 to $450 monthly". Trillet guide: "a common benchmark is a $300/month retainer per client, plus a setup fee and per-minute markup". Across 8 sources the monthly floors are $150, $297, $300, $500, $500, $997, $1,000, $1,500, so **7 of 8 are ≥ $297** (RESEARCH-prices §2) | https://ciela.ai/blogs/how-much-to-charge-for-ai-voice-agent · https://trillet.ai/blogs/voice-agent-pricing-strategy-guide |
| "+ setup" | Ciela, as above. Agentpro: "$1,500 for setup and $1,500/month for ongoing service". Constant Concepts: "Setup: $2,500 … Monthly: $997". Setup floors across 7 sources: $297, $500, $1,000, $1,500, $1,500, $2,500, $2,500 (median **$1,500**). Trillet: "many agencies waive these" (hence "often" in the captions) | https://agentpro.ai/resources/ai-voice-agent-vs-answering-service-vs-new-hire-a-cost-comparison-for-small-businesses · https://constantconcepts.ai/pricing/ |
| "Answering service: $99 for 50 minutes" | PATLive: "50 minutes About 20 calls", $99/mo. The cheapest way to buy 50 minutes is ≥ $99 at **all 10** US live answering services surveyed (RESEARCH-prices §1, the A-grade line #2) | https://www.patlive.com/pricing/ (and the nine others in RESEARCH-prices §8) |
| "Evening shift: $18 an hour" | BLS Occupational Outlook Handbook, Receptionists: "2025 Median Pay: $38,010 per year, $18.27 per hour" (May 2025 data, wages only). It is rounded **down** to $18 on screen | https://www.bls.gov/ooh/office-and-administrative-support/receptionists.htm |
| "Under three hours of that shift" | Arithmetic: $49 ÷ $18.27 = **2.68 h**; $49 ÷ $18 = 2.72 h (RESEARCH-prices §3 and §6 line #9) | (derived) |
| "Answering service: over $1 a minute" (only in `ig5-02m`) | Every published per-minute rate at every tier of the 9 per-minute providers is > $1.00; the lowest is $1.06-$1.09 at 10,000 min (RESEARCH-prices §1, line #4) | RESEARCH-prices §8 |
| Captions: "we didn't compare self-serve AI receptionist apps" | RESEARCH-prices §4: several cost $0-$49, so no claim is made about them | (none) |

### 12.2 Our side (repo at `claude/remotion-trailer`, HEAD `f7daf7c`)

| Claim | Line |
|---|---|
| $49 a month | `lib/site.ts:1685` `{ id: "starter", name: "Starter", monthly: 49, … }`; `types/index.ts:594` `price_monthly: 49` |
| "from $49 a month" | `lib/site.ts:2290` `label: (monthly: number) => \`Plans from $${monthly} a month\`` |
| No setup fee | `lib/pages/home/pricing.ts:243` `{ title: "No setup fee", body: "On any plan. A custom build is quoted on its own." }` |
| Number $1.15 a month (captions) | `lib/phone/pricing.ts:6` `PHONE_NUMBER_MONTHLY_PRICE_USD = 1.15`; FAQ `lib/site.ts:1932` "on its own monthly subscription at $1.15" |
| USD, excl. VAT; per-minute past the allowance (captions) | `lib/site.ts:1829` "Prices are in US dollars and exclude VAT … minutes are rounded up on each call … the plan fee plus that plan's own rate for the minutes past its allowance" |
| Trial: 5 minutes, 14 days, no card; test calls only until a number is bought (captions) | `lib/site.ts:1812-1813` |
| Picks up after hours / day and night | `lib/voice/router.ts:196-221` (it answers unless the owner chose "play a message" outside hours); RESEARCH-product S8 |
| Books appointments at $49 | **Owner decision, 2026-10-07** ("si la 49$ au calendar…", "O fac eu modificarea, tu fa reelul"). Gated today by `lib/billing/entitlements.ts:43` and `lib/voice/tools/calendar.ts:22-29` → §10 |
| Booking needs availability, the caller's yes and a name (the call is compressed, the name is collected off screen) | `lib/voice/tools/definitions.ts:83` (`book_appointment`: "only after check_availability returned the time AND the caller clearly said yes … AND you have their name") |
| Dashboard strings | `components/calls/call-display.tsx:13` Booked, `:16` Answered, `:17` Message taken (fallback), `:32` "Checked your availability", `:33` "Booked an appointment", `:39` "Took a message" (fallback) |
| Tells every caller it's an AI (captions) | `lib/site.ts:2527` "It tells every caller it is an AI" |
| Under ten minutes (IG caption) | `lib/pages/ai-agents.ts:40` "Ready in under ten minutes" |
| Cancel anytime (IG caption) | `lib/pages/home/pricing.ts:240-241` |
| Booking is beta today | `lib/pages/home/pricing.ts:91` "Google Workspace, in beta: Gmail, Sheets, Calendar and Docs" |

### 12.3 Rules

- FTC 16 CFR 233.1 (former-price comparisons) and 233.2 (comparisons with others' prices). ASA "Comparisons: general". Both via RESEARCH-format §2.7 and §9.
- Series rules: `docs/ig/SCRIPT.md` §0.3 (end card, bands, colour, chrome). Build: `ig5/PIPELINE.md` §0, decision 4 (one borrow, `ig1-07`).

### 12.4 Platform (web search, 2026-10-07; secondary sources, directional)

- **TikTok overlay:**
  - organic: safe area about 900 × 1492 (top 108, bottom 320, left 60, right 120). Other guides put the caption, hashtags and sound block at the bottom 350-480 px;
  - ads: right 242 px, bottom up to 707 px.
  - Sources: https://reap.video/blog/short-form-video-safe-zones · https://adkit.so/tools/safe-zones/tiktok · https://postplanify.com/tools/tiktok-safe-zone-checker · https://www.trymypost.com/blog/social-media-safe-zones-templates-2026
- **TikTok text limits** (via draft B §11): comments 150 characters; captions 2,200 (4,000 in-app). https://howmanywords.app/blog/tiktok-character-limits
