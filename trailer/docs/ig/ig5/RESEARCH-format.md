# ig5 format research: the price-comparison reel

Label `research:format`. Written 2026-10-07 on `claude/remotion-trailer`. Planning only: no code, no voice, no existing file touched.

**What this file answers:** what shape a "$49 vs what you'd otherwise pay" reel should take in our house style. It covers the hook, the pacing, where $49 lands, the visual device and the CTA. It also gives 8 scored hooks and 3 visual concepts with beat timings for the script stage.

**What it builds on** (read first, not repeated here):
- `ig5/RESEARCH-prices.md`: every category figure and its source, plus the defensible and the banned lines.
- `ig5/RESEARCH-product.md`: what the $49 plan is and does, and the SAFE (S1-S23) and UNSAFE (U1-U21) lines.
- `docs/ig/SCRIPT.md` §0.3: series rules, end card, grid, bands, colour and sound.
- `docs/ig/RESEARCH-reels.md`: platform research from 2026-10-06.
- `docs/ig/POSTING.md`: captions, DM and measurement.

Evidence tags, as in RESEARCH-reels.md:
- **[P]** primary: Instagram/Meta, a regulator, or the law itself.
- **[A]** peer-reviewed research.
- **[S]** reputable secondary.
- **[V]** vendor or creator blog. Directional only.
- **[K]** practitioner consensus or my own inference. A hypothesis.
- **[R]** measured in this repo.

Sources are in §9.

---

## 0. TL;DR for the script stage

1. **Anchor first, then $49.** A stranger has no reference price for "an AI that answers my phone", so $49 alone means nothing. The reference reel opens on the price people already pay, and so should we. We show the higher, **sourced** category price, then $49 [A1, K].
   - We never pull a figure we can't trace to a page in RESEARCH-prices.md.
   - We never name a provider.
2. **Recommended format: "Three quotes"** (Concept A, §7.1). Three quote rows appear one per beat:
   - live answering, staffed by people;
   - an agency-run AI receptionist, plus its setup fee;
   - ours.

   **Timing:**
   - $49 lands as the **mid-reel payoff, by 45 % of the runtime**, while the two anchors are still on screen. Seeing all three side by side is what makes the gap easy to judge [A2].
   - The CTA runs as in ig1-ig4.
   - Length: **28 s** (14 bars), or **26 s** if the fine-print beat moves to the caption.
3. **Top hooks** (hookscore, run with `python3 -I`; §6):

   | # | Hook | Score | Verdict | Pairs with |
   |---|---|---|---|---|
   | 1 | **"Three quotes for your phone. One's $49."** | **84.4** | STRONG | Concept A |
   | 2 | **"Before you sign a $300 retainer."** | **87.0** | STRONG | Concept B |
   | 3 | **"You're paying $99 for 50 minutes?"** | **80.8** | STRONG | Concept C |

   The third is closest to the reference ("You're paying $39 a month for…"), and its figure is A-grade.
4. **Translate the reference, don't copy it** (§3):
   - Keep: price-anchor hook → the pain of that price → the cheaper path → what it does → keyword CTA.
   - Drop: the mockery of the alternative ("a robot that types…"), the usage-cap pain (**we cap minutes too**), the founder story, and the "not out yet" scarcity.
   - Their "so I built my own" becomes our true line: **"You set it up yourself, in under ten minutes."** (S19)
5. **Honesty is part of the format, not a disclaimer.**
   - Write "a month" next to every monthly price.
   - Write "by people" on the answering-service row and "often" on the agency setup fee.
   - Never use a strike-through that could read as **our** former price. A struck or rolling number must carry its category label (FTC 16 CFR 233.1-233.2 [P5]; ASA comparisons guidance [P6]).
   - Fine print ($1.15 number, VAT, metered minutes) goes in the caption. Better still, spend one spoken beat on "Plus $1.15 for the number."
6. **The CTA stays AGENT.** Same automation and DM as the series, with UTM `reel_ig5`.
   - Instagram's own clarification (Jun 2024): keyword-to-DM through ManyChat-type tools is fine when it's real lead generation. What gets demoted is comment bait meant to game reach [S3].
   - Never add "comment YES if you agree".
7. **Trial Reels are not available yet.** They need about 200 followers on a professional account; we have ~14 [S4, P2].
   - Build Act 1 (the hook) as a swappable module, so hooks 1-3 can be A/B tested on the same body once Trial Reels unlock.

---

## 1. What carries over from ig1-ig4, and what is new

| Kept exactly (SCRIPT.md §0.3) | New for ig5 |
|---|---|
| Tessa (Emotive) speaks every on-screen line, word-synced (`ava`, speed 1.05) | **Prices as display numerals** (tabular lining figures), each one spoken. The display map turns "forty-nine dollars" into `$49` |
| 1080×1920; master at 120 fps (30 fps timeline × SUB 4) plus a 60 fps upload copy | **Three outside categories on screen.** None of them is ours, so every label and figure needs a source line in the caption |
| Bands: label 240-340, stage 340-1180, captions 1200-1480 (x 86-906), right rail clear at x > 906 / y 900-1650 | A **comparison layout**: rows or a scale. Its right edge stays ≤ 880 below y 900 |
| ≤ 6 words per card (the client's rule for this reel; SCRIPT.md allowed 7) | "One accent per part" now maps to price: **rose = the expensive anchor, teal = $49.** Graphite stays "people" |
| 120 BPM grid, E major, `fx-trill` at f0, mallet pentatonic = "true/done", shared `IgEnd`: comment field types AGENT → impact one bar before the end → NEUROVOICE wordmark + `neurotechvoice.com` → 14 f seam | **Number motion:** anchor figures roll up on their spoken word. $49 never rolls (see §2.4) |
| Frame 0 designed and moving, first card set at 72 % ink | Cover shows a price, so the thumbnail itself makes the comparison |

**Measured pace for the timing estimates [R]:** Tessa's 34 delivered ig takes (`src/ig/voice.generated.ts`) average **2.78 spoken words/s**, with a range of 1.85-4.23. A spelled-out number counts by its spoken words: "forty-nine dollars" is two, "a hundred and sixty-eight" is four. So a hook is heard in 0-2 s only if it has ≤ 5-6 spoken words, or if its **payload word lands by ~1.5 s** while the card is already readable at frame 0. §6 reports both.

---

## 2. What makes price-comparison reels work (2025-2026)

### 2.1 Platform mechanics that decide this reel

- **Watch time and early skips decide reach for non-followers.** Instagram added Skip Rate (leaves within 3 s) to Reels Insights in 2025. Trackers call 30-40 % healthy and > 50 % a broken hook [S1, V].
  - So a price reel cannot spend its first second on context. The number, or the promise of one, is on screen at frame 0.
- **Sends per reach** is the strongest non-follower signal Mosseri has named [S2]. Price comparisons get sent as "this is what I told you about the answering service". That only happens if the numbers are **believable and not mocking**: an owner won't forward a reel that sneers at a service they use.
- **Replays count as views**, and Instagram's "Views" metric has folded in repeats since 2025. A number-dense reel invites a second look to read the figures. That earns its rewatch only if the figures sit still long enough to read the second time (≥ 1 beat after the word).
- **Keyword CTAs.** In early June 2024 an Instagram post said content that asks people "to comment with a specific word, number, or emoji" won't be recommended [S3a]. Days later Instagram clarified [S3b]:
  > "creators can still use 3rd party services such as ManyChat … What may impact your content's ability to be recommended is if you post content that attempts to game the system by eliciting specific interactions"
  - **For us:** "Comment AGENT for the link" is a real lead-gen ask, so it's fine.
  - Keep it one ask, at the end, tied to a deliverable. No "comment 49 if…" tricks.
- **Trial Reels** go to non-followers first. Metrics arrive after about 24 h. Auto-share to followers is "based on the views it receives within the first 72 hours" [P2].
  - Eligibility per the help page, as quoted by secondary sources: a public professional account with ≥ 200 followers [S4]. The help-centre page did not render for the fetcher.
  - At ~14 followers, @neurotechvoice will not see the toggle. Check the composer anyway.
- **Hashtags** are capped at 5 and act as labels, not reach. Search reads the caption [RESEARCH-reels §3.8].
  - Price reels have a natural search phrase: "answering service cost" / "AI receptionist price". Put it in the caption's first two lines.

### 2.2 Price psychology that survives a 9:16 frame

| Effect | What it says | What it means for ig5 | Tag |
|---|---|---|---|
| **Anchoring** | The first number seen pulls later judgements towards it. | Show the category price **before** $49. Starting with $49 throws away the anchor. | [A1] |
| **Joint vs separate evaluation** (evaluability) | Attributes that are hard to evaluate on their own (an unfamiliar price) carry far more weight when options are seen side by side. | $49 is hard to judge alone. It becomes easy to judge **next to** "$99 a month, 50 minutes" and "$300 a month". Keep the anchors visible when $49 lands. | [A2] |
| **Temporal reframing** ("pennies a day") | Restating a price per day makes people compare it with small daily expenses. | **Rejected for ig5.** "$1.63 a day" is a derived figure that isn't on the site. It invites the "less than a coffee" cliché and dilutes the owner's "$49". | [A3] |
| **Reference price / strike-through** | Showing a higher reference price raises perceived value. Vendors claim +20-30 % purchase intent. | Allowed only as a **comparison with others**, clearly labelled. It must never look like our own former price. | [V2], [P5] |
| **Left-digit effect** | $49 reads as "forty-something". | Say "$49", never "$50.15". The $1.15 number goes in its own line or the caption. | [K] (Thomas & Morwitz 2005, not re-fetched) |

### 2.3 Hook shapes that fit a price reel

These are sorted by how well they fit our voice. The numbers refer to formulas in `ig-reel/hooks.json`.

1. **The bill question ("You're paying X for Y?")**
   - This is the reference reel's shape, and **it is not in `hooks.json`**: the classifier returns "unclassified" for both the reference hook and our mirror of it (§6).
   - It is closest to #4 The Replacement. Its trap is the same: overstating.
   - Use it as a **question** about a sourced figure. A statement presumes the viewer pays it.
2. **Numbered with a favourite (#11): "Three quotes… one's $49."**
   - The count promises a payoff and holds attention through the middle.
   - It also sets up the comparison table.
3. **Before you (#19, deadline-shaped): "Before you sign a $300 retainer."**
   - It qualifies the people about to spend, which is the audience most likely to convert.
4. **Permission (#20): "You don't need a $300 retainer."**
   - It relieves a worry rather than adding a task. The trap: the second half must give something in its place, and $49 does.
5. **Cold open demo (#18): "Watch what $49 a month answers."**
   - Honest and product-led, but it gives up the anchor.
6. **Head to head (#17): "Agency, answering service, or $49?"**
   - Instantly readable on screen. The trap is refusing to pick, and we pick.

**Not usable:**
- **Negative command:** "Stop paying per minute…". We bill per minute past the allowance too.
- **Statistic hooks:** we have no comparative statistic of our own.
- **"Verbatim objection":** we have no real comment to quote yet, and an invented one breaks the no-fabrication rule.

### 2.4 Visual devices that read in the feed

| Device | Why it works | Our rule |
|---|---|---|
| **A comparison table / quote rows** | The format people screenshot and send. Every row reads alone, and the whole reads at the payoff. | One row per beat, then all three together (joint evaluation), then ours lifts. |
| **Rolling numerals (odometer)** | Constant small motion is a visual event every ~0.1 s. The number "arrives" on the spoken word. | **Anchors roll up** from $0 to their figure over the spoken word (≈ 0.5-0.7 s, settling on `SPRING.land`). **$49 does not roll.** It rises still, in teal: the calm is the contrast. The kit has precedent in the film-1 / ig2 clock rolls (`src/ig/ig2/Clock.tsx`). |
| **Receipt / invoice** | The "receipt" format is a recognised short-form idiom (e.g. TikTok's "receipt OOTD") [V3]. A bill is the reference reel's whole subject. | Use ig4's DocPage paper idiom (white paper, mesh elevation, hairline rule, tabular figures as 44 px objects). Every line item that carries a figure is spoken. |
| **To-scale bars or a ruler** | Lengths make the gap visible before it is read, and they work muted. | **Strictly to scale, $0 baseline, no broken axis.** $49 : $99 : $300 = 16 : 33 : 100 % of the bar. A one-time setup fee never shares a scale with monthly fees. |
| **Strike-through** | Tells the eye "not this one". | **Avoid striking a price.** A struck price next to $49 reads as "was $300, now $49", a former-price claim we cannot make [P5]. Instead the row **steps back** (× .94, ink to 45 %), the way SCRIPT.md's end card steps back. If the script insists on a line, strike the **row label** after it is spoken, never the figure. |

### 2.5 Where $49 lands, and the pacing around it

- **Land it by 45 % of the runtime.** `hooks.json` rule 6 says to deliver the hook's promise before halfway. The series' mid-reel payoffs landed at 38-70 % (POSTING §6 lists 10 / 17.5 / 16.5 / 16.5 s).
  - In a price reel the payoff **is** the number, so it has to come earlier than a demo payoff would.
- **Where on screen:** the optical centre of the stage (y ≈ 640-900), above the caption band and above the rail band. Use the largest numeral in the reel, teal ink, with the orb as its full stop. This reuses ig1's "Not even ours●" grammar: the brand's mark punctuates the claim.
- **How long it stays:** $49 stays on screen, parked smaller, from the payoff until the CTA. That's about 35 % of the runtime, and it's also the cover.
- **Rhythm:**
  - one row (category + figure) per 2-bar phrase;
  - a visual event every 0.7-1.5 s (roll, chip, bar draw, camera nudge);
  - nothing static longer than 1.5 s before the CTA [RESEARCH-reels §1.6].
- **Muted viewers:** the numerals carry the story without sound, so every figure is big enough to read at arm's length:
  - anchors ≥ 120 px;
  - $49 at ≥ 160 px;
  - unit words ("a month", "50 minutes") ≥ 44 px, always on the same row as their figure.

### 2.6 Retention tricks that fit the house style (no hype)

1. **An open slot at frame 0.** The third row is an empty outline with the teal orb breathing in its price slot. The viewer stays to see it filled.
2. **An honesty beat in the middle:** "Plus $1.15 for the number."
   - It's a pattern break, because ads don't volunteer their extras.
   - It answers "what's the catch" before the comments ask.
   - It is on-brand: "If it isn't written down, I say so."
3. **The scale reveal** (Concept C). The camera eases back so a $1,500 setup fee towers over the monthly figures. This is ig1's "168" move, which already worked in the series grammar.
4. **Echo for the loop.** One hook word comes back before the CTA (e.g. "phone": "It answers your phone from your documents"), and the seam re-forms the frame-0 rows. `beats.py` flags "no loop" without it.

### 2.7 Fair-comparison rules for this format

Rules, not law advice. The reel names no competitor, but these rules still apply to comparisons with categories.

- **ASA (UK), comparisons with unidentifiable competitors:**
  > "must not mislead the consumer, and the elements of the comparison must not be selected to give the marketer an unrepresentative advantage"

  Also: "make the basis of the comparison clear" when products differ in quality, and do not omit what people need to judge [P6, updated 10 Nov 2025].
- **FTC (US), comparisons with others' prices:**
  - Compare only with merchandise "of essentially similar quality".
  - The quoted price must not exceed what "representative" sellers charge [P5, 16 CFR 233.2].
  - A former-price claim is deceptive if the former price was not really charged [16 CFR 233.1].

**What this means on screen:**
- Label the human service as **people** and ours as an **AI agent**. Different products, so the basis is shown.
- Use **conservative anchors**:
  - $99 is the *cheapest* 50-minute buy among ten services;
  - $300 is the *low end* of agency retainers;
  - $1,500 is the *median* setup floor.
- Every figure gets a source line in the caption.
- No "was / now" device.

---

## 3. Decoding the reference reel (@damianodesu, `instagram.com/reel/DeKxU-tzPAV`)

**What we can see.**
- The video is not retrievable.
- The page metadata, fetched 2026-10-07, shows:
  - posted on 6 Oct 2026 (about 13 h before the fetch);
  - credit "Video by Dami | AI for Amazon Sellers";
  - original audio;
  - 46 comments at fetch time.
- The account has ~7K followers (per the orchestrator).

**What that means.** One day of data and no account median: this is **not outlier evidence** in the `ig-viral` sense. We copy its **formula** because the owner likes it. We are not copying it because it is proven to work.

**Beats inferred from the caption** [K]. The picture is unknown; the caption is assumed to mirror the voice-over, as it usually does for this creator type.

| # | Reference beat (their words) | Job | Our translation (calm, Tessa, faceless) |
|---|---|---|---|
| 1 | "You're paying $39 a month for a robot that types 'check your DMs'" | price-anchor hook + belittling | Keep the **anchor**, drop the **belittling**: "You're paying $99 for 50 minutes?" / "Three quotes for your phone." Never mock the people at an answering service. |
| 2 | "ManyChat cut me off at 2,500 and wanted $100 to keep going" | pain: a cap + an upsell from a named competitor | **Can't transpose the cap**: our plan has an allowance and bills overage too. Use the pains that are true and that we don't share: **the entry price** and **the agency setup fee** ("Setup, often $1,500"; ours: "No setup fee", `pricing.ts:243`). Name no one. |
| 3 | "So I built my own with Claude Code" | the cheaper path, DIY | **"You set it up yourself, in under ten minutes."** (S19, `ai-agents.ts:40`). DIY versus paying an agency to set it up is the honest parallel. |
| 4 | "Someone comments, it replies…, asks in the DM…, sends the link after they say yes. Random timing, mixes up its words." | what it does, in plain verbs | "It answers from your documents. Takes a message. Puts callers through." (S9, S12, S13). **Never booking** (Pro). |
| 5 | "Works on Trial Reels too. Claude Code built all of it. Even this video." | meta-proof | **Drop.** Our honest meta-claim would be "this voice is the product's voice", and that is banned ("Tessa is the voice you get", SCRIPT.md §0.4). |
| 6 | "Not out yet, I'm testing it first." | scarcity | **Drop.** Not true for us, and against the voice. |
| 7 | "Comment DM BOT and the bot will DM you how to get it for free" | keyword CTA + free | **"Five free minutes, no card. Comment AGENT for the link."** (series CTA). One word (`ig-caption` rule: no two-word keywords). |
| 8 | #claudecode #instagramtips #automation #manychat #ai | tool + category + competitor tags | Category only, no brand tags. Suggested: #AIReceptionist #AnsweringService #SmallBusinessOwner #VoiceAI #SmallBusinessTips (the caption stage decides). |

**Tone translation.**
- The reference is a creator talking fast and mocking the incumbent.
- Ours is **calm arithmetic**: the numbers do the arguing, Tessa states them, and the visual makes the gap obvious.
- No "you're overpaying", no "rip-off", no "fraction of the cost".

**Words banned in this reel**, on top of voice.md and `ig-human/slop.json`:
- **Price claims:** cheapest, unlimited, all-in, flat, total, "that's it", "no hidden fees", "save X %", "X times cheaper", "a fraction of the cost", "only $49" (it sounds like an ad and implies all-in).
- **Overreach:** overpaying (as a statement about the viewer), "replace your receptionist", "fire", "no contract" (say "cancel anytime"), "books appointments", "every call", "never misses", "every language", "5-minute setup", "24/7 support".
- **Names:** any provider or plan name, including "Starter", per profile.md.

---

## 4. Structure template (any concept)

```
0 - 3.5 s     HOOK       anchor or count, card set at frame 0, trill at f0
3.5 - ~11 s   ANCHORS    one category per 2-bar phrase: label (spoken) + figure (rolls up) + unit
~11 - 13 s    PAYOFF     $49 a month lands still, teal, all rows visible (by 45 %)
~13 - 17 s    HONEST     "No setup fee." + one of: "Plus $1.15 for the number." / "You set it up yourself, in under ten minutes."
~17 - 19.5 s  DOES       one plain-verb line on the real app UI (pill + tool row), never booking
75 - 92 %     CTA        IgEnd: "Five free minutes, no card. Comment AGENT for the link."
END - 60 f    IMPACT     wordmark + "Neuro Tech Voice." + URL
last 14 f     SEAM       frame-0 composition re-forms
```

---

## 5. Claim sheet for the format

Every figure a hook or a concept below uses, with its grade from the sibling research:
- **A** = true of every source;
- **B** = true of the typical or median case, with a hedge doing the work.

| Figure / line | Grade | Source (detail in RESEARCH-prices / -product) | Hedge that must be spoken or shown |
|---|---|---|---|
| "$49 a month" | A | `lib/site.ts:1685`, `types/index.ts:594`; menu "Plans from $49 a month" | Caption fine print: USD, excl. VAT, $1.15 number, metered minutes |
| "No setup fee" | A | `lib/pages/home/pricing.ts:243` "No setup fee. On any plan." | none |
| "Live answering, by people: $99 a month, 50 minutes" | A | cheapest way to buy 50 min at all 10 US services ≥ $99 | "by people"; caption: "cheapest of ten US services' 50-minute plans, read 7 Oct 2026" |
| "An agency's AI receptionist: $300 a month and up" | B | 7 of 8 sources put the monthly floor ≥ $297; "$300/month retainer" benchmark (Trillet); "$300 to $450" starter (Ciela) | "and up"; caption cites the range |
| "Setup, often $1,500" | B | median setup floor across 7 sources = $1,500; some waive | "often" (spoken and shown) |
| "Plus $1.15 for the number" | A | `lib/phone/pricing.ts:6` | none |
| "You set it up yourself, in under ten minutes" | A | `lib/pages/ai-agents.ts:40`, `register.tsx:193` | never "5 minutes" |
| "It answers from your documents" / "takes a message" / "puts callers through" | A | `pricing.ts:67`; `session-loader.ts:240-241` | "to people you listed" if transfer is named |
| "Five free minutes, no card" | A | `site.ts:1812`; `ai-agents.ts:44` | never next to booking |

**Not used in any concept:**
- a receptionist's wage. Comparing $49 to a person's pay contradicts ig1 ("Don't fire your receptionist… Not even ours") and voice.md position 5;
- AI-SaaS prices, because several are ≤ $49 (RESEARCH-prices §4);
- our minutes, overage rate or tiers.

---

## 6. Eight hooks, scored

**How they were scored.** `ig-reel/hookscore.py`, run with `python3 -I` on the line as written with numerals (the skill's own convention, e.g. "$18,000 is what…"). For spoken time, every number is spelled out and timed at Tessa's measured 2.78 words/s [R].

```bash
python3 -I .claude/skills/ig-reel/hookscore.py final8.txt
```

| # | Formula (hooks.json) | On screen, as said (≤ 6 words per card) | Spoken words / est. time | Payload heard at | **Score** | Truth | Notes |
|---|---|---|---|---|---|---|---|
| H1 | #11 Numbered with a favourite (classifier: unclassified) | "Three quotes for your phone." / "One's $49." (5 + 2) | 8 / 2.9 s | "Three" at 0 s; "$49" ≈ 2.2 s | **84.4 STRONG** | A (the figures come later, each sourced) | Opens the table, puts the owner's $49 on screen by ~2.5 s, and is an open loop. **Pick #1 for Concept A.** |
| H2 | #19 Before you (unclassified) | "Before you sign a $300 retainer." (6) | 8 / 2.9 s | "$300" ≈ 1.4 s | **87.0 STRONG** | B ($300 = low end of retainers) | Highest score. Qualifies agency shoppers (narrower but warmer). **Pick #2 for Concept B.** |
| H3 | the reference's "bill question" (unclassified; nearest #4 The Replacement) | "You're paying $99 for 50 minutes?" (6) | 7 / 2.5 s | "$99" ≈ 0.7 s | **80.8 STRONG** | A ($99 is the floor of all ten) | Closest mirror of the reference. A question, not an accusation. Needs "live answering, by people" in the next line. **Pick #3 for Concept C.** |
| H4 | #20 Permission | "You don't need a $300 retainer." (6) | 8 / 2.9 s | "$300" ≈ 1.4 s | **81.4 STRONG** | B | Calm relief and very on-voice. Same anchor as H2, so use one or the other. |
| H5 | #13 Before/After (unclassified) | "Your setup fee: $0. Not $1,500." (6) | 7 / 2.5 s | "$0" ≈ 1.1 s | **84.4 STRONG** | $0 A; "$1,500" B (unhedged here) | Great strike visual, but it **implies every alternative charges $1,500** without "often". Use only as a Trial-Reel variant, with "Agency setup, often $1,500" as line 2. |
| H6 | #18 Cold Open Demo | "Watch what $49 a month answers." (6) | 7 / 2.5 s | "$49" ≈ 0.7 s | **80.2 STRONG** | A (number via caption) | Leads with our price and throws away the anchor (§2.2). A fallback if the owner wants $49 at frame 0. |
| H7 | #17 Head To Head (unclassified) | "Agency, answering service, or $49?" (5) | 6 / 2.2 s | "$49" ≈ 1.8 s | **56.0 OK** | A | Reads instantly. The script marks it down for no viewer address. Better as the **cover title** than as the spoken hook. |
| H8 | #22 Contrarian / house voice (unclassified) | "Your phone shouldn't cost a retainer." (6) | 6 / 2.2 s | none | **52.2 OK** | position, no figure | Most "us" (it echoes "Closed is for the door, not the phone"), but there is no number in it. A caption line rather than a hook. |

**Raw ranking output:**

```
->  87.0 STRONG  Before you sign a $300 retainer.
    84.4 STRONG  Three quotes for your phone. One's $49.
    84.4 STRONG  Your setup fee: $0. Not $1,500.
    81.4 STRONG  You don't need a $300 retainer.
    80.8 STRONG  You're paying $99 for 50 minutes?
    80.2 STRONG  Watch what $49 a month answers.
    56.0 OK      Agency, answering service, or $49?
    52.2 OK      Your phone shouldn't cost a retainer.
```

**For comparison: the reference hook.** "You're paying $39 a month for a robot that types check your DMs." scores **75.0 STRONG**. It is 13 words, ~4.7 s spoken, and the classifier calls it unclassified.

**A quirk in the scorer, worth knowing.**
- `hookscore.py` flags any opener that *starts with* "yo" as the weak opener "yo". That catches every "You…/Your…" hook and costs it 30 points on FRONTLOAD.
- A scratch copy patched to match whole words only (not committed; the skill was left untouched) scores:

  | Hook | Patched score |
  |---|---|
  | H5 | 100 |
  | H4 | 87.0 |
  | H3 | 84.4 |
  | H8 | 55.8 |
  | the others | unchanged |

- The ranking of the top three does not change, so the raw scores above stand.
- The skill's own caveat applies: the script separates real hooks from bad ones (AUC 0.83) but barely separates good hooks from each other (AUC 0.56). The retention graph decides.

**Recommended top three:**
1. **H1** (84.4): best fit with the comparison format.
2. **H2** (87.0): highest score.
3. **H3** (80.8): the reference's own shape, with an A-grade figure.

A/B them on the same body once Trial Reels unlock (§8).

---

## 7. Visual concepts (22-28 s, in our motion language)

All three use:
- the pearl `MeshGround` on `MUTED_MESH`, warming to a sunday pool at the payoff;
- the teal orb as the "ours" marker;
- the shared `IgEnd`;
- the 120 BPM grid (bar = 60 f = 2.0 s);
- the same bands.

Frames are 30 fps timeline targets. `timing.ts` re-anchors them on the measured takes.

**Every figure on screen is a spoken word.** Unspoken text is allowed only as ≤ 32 px chrome with no claim in it: axis ticks, "PDF" kind tags.

### 7.1 Concept A: "Three quotes" (recommended)

**28.0 s · 14 bars · 840 f (3360 at 120 fps). Impact f780. END f840.**

There is a 26 s cut (13 bars, the ig1 geometry with impact f720) if b5 moves to the caption.

**Layout:**
- Three white quote rows (`Panel` with `meshElevation`), x 140-880:
  - row 1 at y 400-600;
  - row 2 at y 640-840;
  - row 3 at y 880-1080. Its right edge sits ≤ 880, clear of the rail.
- Each row holds:
  - the category label (label role, spoken);
  - the price (tabular display numerals, ≥ 120 px; ours ≥ 160 px);
  - a unit chip;
  - a hairline **to-scale bar** under the price ($300 = 700 px, $99 = 231 px, $49 = 114 px).

| Beat | Frames | Seconds | VO draft (script stage finalises) | Cards (≤ 6 words, spoken) | Picture and sound |
|---|---|---|---|---|---|
| b1 Hook | 0-105 | 0.0-3.5 | "Three quotes for your phone. One's $49." | "Three quotes for your phone." (set at f0, 72 %) · "One's $49." | f0: three empty row outlines already drawing (`EASE.draw`, started f −6); the orb breathes in row 3's price slot. `fx-trill` at f0 (a call). On "forty-nine", a small teal "$49" (60 px) rises in row 3. That is the promise, not the payoff. |
| b2 Quote 1 | 105-210 | 3.5-7.0 | "Live answering, by people: $99 a month, 50 minutes." | "Live answering, by people:" · "$99 a month, 50 minutes." | Row 1 fills in **graphite** (people). "$99" rolls 0→99 on "ninety-nine" (rose ink) with `fx-tick` on 32nds. Then the "50 MIN" chip and the bar draws to 231 px. |
| b3 Quote 2 | 210-375 | 7.0-12.5 | "An agency's AI receptionist: $300 a month and up. Setup, often $1,500." | "An agency's AI receptionist:" · "$300 a month and up." · "Setup, often $1,500." | Row 2 fills; "$300" rolls; the bar draws to 700 px (to scale: 3× row 1). On "Setup", a separate **one-time chip** drops onto row 2 with weight (`thump`), off the bar scale and labelled "SETUP". The camera nudges back 1.0 → .97. |
| b4 Ours: the payoff | 375-465 | 12.5-15.5 (≈ 45 %) | "Ours? $49 a month. No setup fee." | "Ours? $49 a month." · "No setup fee." | Rows 1-2 step back (× .94, ink 45 %) but **stay visible** (joint evaluation). Row 3 lifts 8 px with a `ContactShadow` and turns teal-edged. "$49" rises **still** (no roll), with the orb flattening into its full stop. The bar draws to 114 px. A teal "No setup fee" chip sits where row 2 has its setup chip. Sound: `ping` + `chime-sunday-soft`, mallet E-pentatonic "true". The pad opens; a sunday pool rises behind. |
| b5 Honest beat | 465-540 | 15.5-18.0 | **Either** "Plus $1.15 for the number." **or** "You set it up yourself, in under ten minutes." | one card | (i) A small teal line "+ $1.15 number" writes under $49, and its bar grows by an invisible hair (to scale, the joke without words). Or (ii) a four-step setup chip strip (the site's "Four screens, then a test call", `start.ts:12`), with a soft `fx-tag` per step. |
| b6 Does | 540-645 | 18.0-21.5 | "It answers your phone from your documents." ("phone" echoes the hook for the loop) | "It answers your phone" · "from your documents." | Rows 1-2 leave up through their masks. Row 3 becomes the real app call row: `OutcomePill` **Answered** plus the dashboard's own tool row "Looked it up in your documents" (`call-display.tsx`). No booking. |
| b7 CTA | 645-780 | 21.5-26.0 (77 %) | "Five free minutes, no card. Comment AGENT for the link." | as ig1-06 (reuse the take) | `IgEnd`: the field rises at f653; AGENT types one letter per 16th; the send press lands on "link". |
| b8 Impact / brand | 780-826 | 26.0-27.5 | "Neuro Tech Voice." (`ig1-07` reused) | wordmark + URL | Snare roll from f750; impact + E chord at f780. |
| b9 Seam | 826-840 | 27.5-28.0 | (none) | (none) | The rows re-form as empty outlines, the orb returns to row 3's slot, and the hook card is set at 72 %. |

**Budget:** ≈ 66-70 spoken words, about ig1's density (66 words in 26 s).

**Checked in `/tmp/claude-0/-home-user-neuro-tech-voice/6b4a4ce5-d0c8-5ad4-a3ac-60df35c2aa83/scratchpad/ig5`** against a 65-word draft of these lines:
- `beats.py --wpm 167` ([R] Tessa pace) puts the speech at **23.4 s**.
- `detect.py` **REVIEW 63.2**, with **burstiness** the weakest check. The ≤ 6-word card rule makes every sentence short and alike.
- A variant with one long spoken sentence split across three cards ("It answers your phone from your own documents, takes a message, and puts callers through to your people.") scored **PASS 92.5**.
- So the script stage should keep one or two long lines, split visually, not spoken short.

**Why it's the pick:**
- It is the literal "comparison including price" the owner asked for.
- It reads muted and it is screenshot- and send-friendly.
- It is honest by construction: to-scale bars, labelled rows, no former-price device.
- It reuses the most kit: `Panel`, `OutcomePill`, the clock-roll digits, `IgEnd`, the ig1 step-back.

**Build:** one new component (`QuoteRows`, roughly the size of ig1's `WeekGrid`) and a `Roll` numeral helper.

**Cover:**
- kicker `AI RECEPTIONIST · 05`;
- title **"Three quotes. One's $49."** with "$49" in teal;
- a thumbnail of the three rows at the b4 frame, inside x 86-930, y 260-1500.

### 7.2 Concept B: "The bill" (closest to the reference)

**24.0 s · 12 bars · 720 f. Impact f660. END f720.** Hook: H2.

A paper quote in ig4's DocPage idiom prints its lines on her words. Then it **folds up like an accordion** (each line folding into the next, the `SlipStack` collapse idiom) into a single teal line.

| Beat | Frames | Seconds | VO draft | Picture and sound |
|---|---|---|---|---|
| b1 Hook | 0-90 | 0.0-3.0 | "Before you sign a $300 retainer." | f0: the white sheet is already sliding up, with a 28 px chrome tag "QUOTE" (no claim). On "three hundred", the first line prints: "Monthly retainer ··· $300" (44 px object, rose figure). `fx-trill` at f0, a printer `fx-tick` per character group. |
| b2 The lines | 90-210 | 3.0-7.0 | "Setup, often $1,500. Usage, often on top." | Two more lines print: "Setup (often) ··· $1,500" and "Usage ··· often extra". A total rule draws, but **no total figure** (we can't sum "often"s). |
| b3 The fold | 210-300 | 7.0-10.0 | "Or set it up yourself, in under ten minutes." | On "Or", the sheet folds line by line (a 4 f stagger), shrinking to one strip. A camera micro-push follows. This is the reference's "so I built my own", made true for us. |
| b4 Payoff | 300-390 | 10.0-13.0 (42 %) | "$49 a month. No setup fee." | The strip turns teal-edged: "$49 / month" (display, still) and "Setup ··· $0". The orb is the full stop. `ping` + sunday chime. |
| b5 Fine print | 390-450 | 13.0-15.0 | "Our fine print: $1.15 for the number." | A small teal line prints under it. It's the reel's honesty joke, and it is true. |
| b6 Does | 450-540 | 15.0-18.0 | "It answers from your documents, and takes messages." | The strip flips (one move, no blur) into two app rows: **Answered** · **Message taken**. |
| b7 CTA | 540-660 | 18.0-22.0 (75 %) | "Five free minutes, no card. Comment AGENT for the link." | `IgEnd`. |
| b8/b9 | 660-720 | 22.0-24.0 | "Neuro Tech Voice." / seam | The sheet re-forms and slides up into frame 0. |

**Budget:** ≈ 60 spoken words.

**Strengths:**
- Closest to the reference's "bill" subject and its DIY turn.
- The paper idiom already exists (ig4).

**Weaknesses:**
- Only one category (agencies), so it's narrower.
- "Usage, often extra" is soft.
- The fold must stay readable: one move, a 4 f stagger, never a smear.

### 7.3 Concept C: "The ruler" (most distinctive, honest by scale)

**24.0 s · 12 bars · 720 f. Impact f660. END f720.** Hook: H3.

**Layout:**
- A vertical hairline ruler at x 170, $0 at y 1140 up to $300 at y 380.
- Ticks every $100 (28 px Geist Mono chrome).
- Tags hang at their **true heights**.
- The orb is ours.

| Beat | Frames | Seconds | VO draft | Picture and sound |
|---|---|---|---|---|
| b1 Hook | 0-90 | 0.0-3.0 | "You're paying $99 for 50 minutes?" | f0: the ruler is drawing upward. A graphite tag slides to the $99 height (y ≈ 890) and lands on "ninety-nine". The hook card is in the caption band. |
| b2 Name it | 90-180 | 3.0-6.0 | "That's live answering, by people." | The tag's label writes: "LIVE ANSWERING · PEOPLE · 50 MIN" (spoken words). |
| b3 Agency | 180-270 | 6.0-9.0 | "An agency's AI receptionist: $300 a month and up." | A rose tag rises to the $300 tick at the top of frame. |
| b4 Scale reveal | 270-360 | 9.0-12.0 (first payoff ≈ 40 %) | "Setup, often $1,500." | **The camera eases back** (1.0 → .24, `EASE.inOut`, 1.2 s, the ig1 "168" move). The ruler extends to $1,500, and a rose setup tag lands five times higher than $300. The monthly tags shrink into the bottom fifth. A `swish` plays; the pad drops out for one beat. |
| b5 Ours | 360-450 | 12.0-15.0 | "Ours? $49 a month. No setup fee." | The camera dives back to the floor. The teal orb settles **exactly** at $49 (to scale, just under half of $99), with its shadow on the $0 line ("no setup"). Sunday chime. |
| b6 Does | 450-540 | 15.0-18.0 | "It answers from your documents, and takes messages." | The ruler recedes; the orb opens into the two app rows. |
| b7 CTA | 540-660 | 18.0-22.0 (75 %) | series CTA | `IgEnd`. |
| b8/b9 | 660-720 | 22.0-24.0 | brand / seam | The camera re-frames the frame-0 ruler. |

**Budget:** ≈ 54 spoken words, the most breathing room of the three.

**Strengths:**
- The most premium and rewatchable of the three: the scale reveal.
- Honest by geometry.
- Reads muted.

**Weaknesses:**
- A ruler is more abstract than a table.
- The $1,500 move needs a careful 9:16 framing pass, since tags must stay inside x 86-906 at every camera scale.
- New build: a `Ruler` with a camera-scaled tick density.

### 7.4 Device rejected: "the price tag that counts down"

A single tag that rolls $1,500 → $300 → $99 → $49 is great motion. But it reads as **one product getting cheaper**, which is a former-price markdown we cannot claim [P5].

It survives only if each stop carries its category label and the roll goes **up** for anchors, never down to us. That is Concept A's roll rule.

---

## 8. Measurement and the Trial-Reel plan

These are on top of POSTING §6.

- **At 24 h:**
  - Skip rate. ≤ 40 % means the anchor-first hook works. > 50 % means re-cut the first 3.5 s as a new post.
  - Retention at the payoff frame (~12.5 s in A). A drop *before* it means the anchors run too long.
- **At 72 h:**
  - Sends per reach. The main hypothesis: price tables get sent.
  - AGENT comments per 1,000 reach.
  - Comments that ask "how many minutes?". Count them: they are the cost of not showing minutes, and the owner's push to settle 150 vs 400.
- **When Trial Reels unlock** (≥ 200 followers, professional, public): test H1 vs H2 vs H3 on the **same body**. This is why Act 1 should be a swappable module (hook card + first VO line + frame-0 rows).
- **Comment replies:**
  - Never argue with answering-service staff.
  - Never quote minutes.
  - Point to the site and the free trial (POSTING §5a table).

---

## 9. Sources

**Primary (platform, regulators)**
- [P2] Instagram for Creators, "Trial reels: Try content with non-followers first" (2024-12-10): non-followers first, metrics ~24 h, auto-share on views within 72 h. https://creators.instagram.com/blog/instagram-trial-reels
- [P5] US FTC, Guides Against Deceptive Pricing, 16 CFR 233.1 (former price comparisons) and 233.2 (comparisons with prices of others; "essentially similar quality"; "representative retail outlets"). https://www.law.cornell.edu/cfr/text/16/233.1 ; https://www.law.cornell.edu/cfr/text/16/233.2
- [P6] ASA / CAP (UK), "Comparisons: general" (updated 10 Nov 2025): unidentifiable competitors must not mislead and the comparison must not be selected for unrepresentative advantage; make the basis clear. https://www.asa.org.uk/advice-online/comparisons-general.html

**Peer-reviewed** (abstracts and bibliographic records consulted; the full texts were not re-read)
- [A1] Tversky, A. & Kahneman, D. (1974), "Judgment under Uncertainty: Heuristics and Biases", *Science* 185 (anchoring). [K: not re-fetched]
- [A2] Hsee, C. K. (1996), "The Evaluability Hypothesis…", *OBHDP* 67; review of joint vs separate evaluation: https://www.cmu.edu/dietrich/sds/docs/loewenstein/PrefRevJoint.pdf
- [A3] Gourville, J. T. (1998), "Pennies-a-Day: The Effect of Temporal Reframing on Transaction Evaluation", *Journal of Consumer Research* 24(4), 395-408. https://ideas.repec.org/a/oup/jconrs/v24y1998i4p395-408.html

**Secondary**
- [S1] Instagram Skip Rate in Reels Insights (2025): Metricool https://metricool.com/instagram-reel-analytics/ ; Inro (2026) https://www.inro.social/blog/instagram-reels-insights
- [S2] Search Engine Journal, Mosseri on sends per reach: https://www.searchenginejournal.com/instagram-algorithm-shift-why-sends-matter-more-than-ever/521389/
- [S3a] Social Media Today (Jun 2024), "Instagram says using certain CTAs can impact post reach": https://www.socialmediatoday.com/news/instagram-says-using-certain-ctas-can-impact-post-reach/717732/
- [S3b] Social Media Today (2024-06-05), "Instagram clarifies advice on single-word CTAs": https://www.socialmediatoday.com/news/instagram-clarifies-advice-on-single-word-ctas-and-longer-reels/718151/
- [S4] Trial Reels eligibility (help page quoted: ≥ 200 followers, professional, public): PostEverywhere https://posteverywhere.ai/blog/what-are-instagram-trial-reels ; Publer https://publer.com/blog/en/instagram-trial-reels-guide/

**Vendor (directional only)**
- [V1] Comment-to-DM conversion claims (e.g. 1-minute replies 11.2 % vs 1.9 % after an hour; treat as unverified): https://instantdm.com/blog/measure-instagram-dm-automation-effectiveness ; https://inro.social/blog/instagram-comment-to-dm-automation
- [V2] Strike-through / compare-at pricing, "+20-30 % purchase intent" (vendor summary of reference-price research): https://www.growthsuite.net/resources/shopify-discount/strike-through-pricing-compare-at-psychology-guide
- [V3] "Receipt OOTD" itemised-receipt format on TikTok: https://www.weshop.ai/blog/page/11/?page=2

**Reference reel**
- @damianodesu, https://www.instagram.com/reel/DeKxU-tzPAV/ : page metadata fetched 2026-10-07 (caption, "Video by Dami | AI for Amazon Sellers", original audio, 46 comments, posted 6 Oct 2026). The video itself was not retrievable.

**Repo [R]**
- `src/ig/voice.generated.ts`: 34 Tessa takes, 2.78 words/s mean.
- `.claude/skills/ig-reel/{hookscore.py,beats.py,hooks.json}`, `.claude/skills/ig-human/{detect.py,humanize.py}`: run with `python3 -I` from a scratch directory.
- `src/ig/ig4/PriceList.tsx` (DocPage idiom), `src/ig/ig1/WeekGrid.tsx` (camera ease-back), `src/ig/ig2/Clock.tsx` (digit rolls), `src/ig/components/{End,OutcomePill,Captions}.tsx`, `src/ig/common/{series,zones}.ts`.
