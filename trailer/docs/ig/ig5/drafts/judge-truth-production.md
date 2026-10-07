# ig5 judge: truth + production

Label `judge:truth-production`. Written 2026-10-07 on `claude/remotion-trailer` (HEAD `d515a52`). Planning only: this file is the only one written; nothing committed; no Cartesia call; no secret read.

**What I read:** `ig5/RESEARCH-prices.md`, `RESEARCH-product.md`, `RESEARCH-format.md`, `PIPELINE.md`, drafts A, B, C, `.claude/instagram/voice.md` and `profile.md`, the owner's booking decision and the TikTok numbers of 2026-10-07.

**What I checked myself:**
- Product lines re-read in code: `lib/pages/home/pricing.ts:243` ("No setup fee", "On any plan") and `:91` (Calendar listed under Pro, "in beta"); `lib/billing/entitlements.ts:25-55` (trial and starter `googleIntegrations: false`); `lib/voice/tools/calendar.ts:22-29` (`bookingGate`); `components/calls/call-display.tsx:13-39`; `lib/pages/home/start.ts:12`; `lib/pages/ai-agents.ts:38-45`.
- The kit: `trailer/src/ig/**` and `src/kb/kit/**` (every component and sound each draft names), `src/ig/common/{series,zones}.ts`, `components/{ZoneGuard,End}.tsx`, `ig2/Cards.tsx` (EventCard), `scripts/ig/bed.mjs` (`MUSIC.stop`).
- Tessa's pace from `src/ig/voice.generated.ts`: 34 takes, 2.78 tokens/s mean. By reel: ig1 2.62, ig2 2.34, ig3 2.72, ig4 3.05. Lines heavy with numbers run 2.45-2.50 (ig1-02, ig4-05).
- Delivered lengths: ig1, ig2 and ig4 run 28.0 s; ig3 runs 26.0 s. ig1 has 63 tokens before the sign-off and was planned at 26 s.
- `hookscore.py` re-run on the three primary hooks: 85.8 / 77.8 / 80.0. These match the drafts.
- A placement simulation of every draft. It uses the series' `place()` rule (6 f gap, snap to the next 16th) and `IMPACT = upBar(CTA end + 1 beat)`, at 2.40, 2.50, 2.62 and 2.78 tokens/s.
- `caption.py`, `detect.py` and `humanize.py` on the corrected captions in §5.

---

## 0. Verdict

| | A "Don't pay $300" (the bill stack) | B "You're paying $300?" | C "Quotes on the desk" |
|---|---|---|---|
| **Truth** (1-10) | **7.5** as written; 9 after the caption fixes in §5 | **8.5** | **6** |
| **Production** (1-10) | **8** | **6.5** | **6** |
| **Total** | **15.5** | 15 | 12 |
| **Call** | **WINNER**, with the fixes in §5 | Runner-up: graft two of its parts into A | Not recommended |

**Why A wins:**
- **It is the comparison the owner asked for.** Two "several hundred" categories are on screen: an agency retainer with its setup fee, and a live answering service. Then $49 lands at 44 % of the runtime with all three still readable. B shows only the agency on screen.
- **The hook repeats the series' TikTok winner.** ig1 opened "Don't fire your receptionist for an AI."; A opens "Don't pay $300 a month for an AI receptionist." "AI receptionist" is on screen by about 2.3 s. Its hookscore is the highest of the three primaries (85.8, re-run).
- **Every figure carries its hedge in the spoken line itself:** "common", "often", "from ... for 50 minutes". A also says the $1.15 number out loud. All of A's truth gaps are in the caption and cover text (§2.1), so they are text fixes.
- **It has the best muted frame and the best frame to screenshot (b4).** Every anchor except the $1,500 stub is at least 118 px tall; the stub needs the fix in §3.5. $49 sits at 200 px, and the hairlines are drawn to scale from $0.

**Why not B:**
- Its on-screen copy is the cleanest. It says the basis of the comparison out loud: "You set it up yourself, in under ten minutes".
- But it shows only one category on screen; the answering service appears only in the caption.
- Its payoff frame shrinks the $300 anchor to about 38 px, so the comparison fails with the sound off.
- Its voice-over needs 2.53 tokens/s, and it has no trim plan.

**Why not C:**
- **It puts a person's pay against $49.** "Evening shift: $18 an hour" is followed by "Under three hours of that shift." On top of that, the person's quote steps back on the word "booked".
  - That stays inside the letter of the series rule: it is framed as covering the hours the desk is closed.
  - But it is the exact framing that RESEARCH-format §5 and draft A dropped to protect ig1 ("Don't fire your receptionist... Not even ours.").
  - On TikTok it is the line most likely to be clipped and screenshotted against us.
- **It mixes three units on one screen:** a month, a 50-minute bundle and an hour.
- **Its $300 has no hedge on screen.**
- **$49 lands at 49 %.**
- **It is the heaviest build:** five objects on screen, anchors at 96 px.
- Its timing budget is the healthiest of the three (§3.2). Its keyword-at-frame-0 idea is worth keeping as a later hook A/B.

---

## 1. Truth: every figure and claim

Grades are RESEARCH-prices'. **A** = true of every source. **B** = typical, with the hedge doing the work.

| # | Claim | Draft(s) | Source checked | Grade | Status |
|---|---|---|---|---|---|
| 1 | "$49 a month" | A B C | `lib/site.ts:1685`; `types/index.ts:594` | A | **Pass, all three.** A and B qualify it by saying "$1.15 a month" next. C uses "from" plus the caption. The live Stripe price is still to be confirmed (§6). |
| 2 | "No setup fee" | A B C | `lib/pages/home/pricing.ts:243` `{ title: "No setup fee", body: "On any plan..." }`, re-read today | A | **Pass.** RESEARCH-prices called it "implied"; the pricing page states it. |
| 3 | "$1.15 a month" for the number | A, B spoken; C caption only | `lib/phone/pricing.ts:6` | A | **Pass** |
| 4 | Agency AI receptionist "$300 a month" | A: "That's a common agency retainer"<br>B: "At agencies, that's the low end"<br>C: "AI agency: $300 a month + setup", no hedge on screen | Ciela starter $300-$450; Trillet "a common benchmark is a $300/month retainer". Monthly floors $150, $297, $300, $500, $500, $997, $1,000, $1,500, so 7 of 8 are ≥ $297. | B | **A: pass** ("common" is the source's own word, spoken).<br>**B: pass** ("low end" is a little stronger; the pinned comment discloses the $150 floor).<br>**C: weak.** "About" appears only in the caption. |
| 5 | "Setup, often $1,500" | A, B on screen; C shows "+ setup" on screen and $1,500 in the caption | The median of 7 setup floors is $1,500; Ciela $1,500-$2,500; Trillet "many agencies waive these" | B | **Pass with "often".** 3 of the 7 floors are below $1,500, so "often" must never be cut. A's trim list protects it. |
| 6 | Live answering "$99 ... for 50 minutes" | A on screen ("from $99 a month, for 50 minutes")<br>B caption<br>C on screen ("$99 for 50 minutes", no "a month") | ≥ $99 for 50 minutes at all 10 providers; PATLive $99/mo for 50 minutes | A | **A: pass, the best wording.**<br>**C: unit unclear.** Without "a month" it can read as a one-off bundle. |
| 7 | "$18 an hour" / "Under three hours of that shift" | C | BLS OOH median $18.27/h (all receptionists, wages only); 49 ÷ 18.27 = 2.68 h | A (arithmetic) | **Misleading-adjacent:**<br>(a) "Evening shift" labels the all-receptionist median as if it were a quote;<br>(b) hour against month implies a month of after-hours cover for $49, when $49 buys the plan's minute allowance and usage past it is billed;<br>(c) the series tone, §2.3. |
| 8 | Books appointments at $49 | A: "books the appointment"<br>B: "books appointments" + EventCard<br>C: "You're booked" + slot chips | **False today:** `entitlements.ts:43` (starter `googleIntegrations: false`) leads to `bookingGate` returning NOT_IN_PLAN (`calendar.ts:22-29`); `pricing.ts:91` lists Calendar under Pro, "in beta". The owner's decision of 2026-10-07 makes it true once his change ships. | gated | **Pass with the launch gate.** All three carry a gate and a take that drops booking: A `ig5-06-msg`, B `ig5-06b`, C `ig5-04b`. |
| 9 | "Picks up when you can't" / "day and night" | A / B, C | `lib/voice/router.ts:196-221`. It needs a bought number and calls pointed at it. | A | **Pass.** A's captions explain the routing ("It answers its own number, and you point your calls at it"). Keep that sentence. |
| 10 | "You set it up yourself, in under ten minutes" | B | `lib/pages/ai-agents.ts:40` "Ready in under ten minutes" | A | **Pass** |
| 11 | Trial: "5 free minutes for 14 days, no card" | all three, captions only | `lib/site.ts:1812`; trial `googleIntegrations: false` (`entitlements.ts:29`) | A | B and C add "doesn't book": **pass.**<br>**A breaks voice.md** ("never imply the free trial books"): its TikTok caption puts "the free trial link" in the ask and "books the appointment into your calendar" in the body, and never says the trial doesn't book. |
| 12 | Tells callers it's an AI; answers from your documents; takes messages | captions | `lib/site.ts:2527`; `pricing.ts:67`; `session-loader.ts:241` | A | **Pass** |
| 13 | No competitor named | all | screen, voice-over, captions, pinned comments | | **Pass, all three.** B and C offer the named source list by DM on request. One of the $300 sources, Trillet, sells a $49 AI receptionist itself, so that DM would name a direct competitor. Send the category summary plus the BLS / FTC / ASA links, or let the owner decide. |
| 14 | No minutes, overage rate or tiers of ours | all | | | **Pass.** Only "the plan's allowance" appears, with no count and no rate. "50 minutes" is the competitor's unit. |
| 15 | The plan name "Starter" in the caption fine print | all three | profile.md: "no prices, minute allowances or plan names (except Pro)". The owner's override covers "$49" only. | decision | **Keep it, and record the override in POSTING.** It is the name next to $49 on the pricing page, and the only honest pointer to which plan "$49" means. |
| 16 | Choosing which "AI receptionists" to compare | A, B hooks | RESEARCH-prices §4: AI apps at $0, $24.95 and $29, and two at $49 | fairness | The hooks attach $300 to "AI receptionist"; the next line attributes it to agencies. That is fine. ASA's "unrepresentative selection" test still needs the line "we didn't compare self-serve AI receptionist apps". B and C put it in the IG pinned comment. **A has it nowhere.** |
| 17 | Basis of the comparison: built for you vs set up yourself | A | ASA comparisons: "make the basis of the comparison clear" | fairness | B says it in the voice-over. **A says it nowhere**, so it must go in A's captions. |
| 18 | Coherence with ig1 | all | brief | | **A: pass.** Its IG caption keeps ig1's line, "Keep your front desk for the work only people can do".<br>**B: pass** (AI against AI).<br>**C: within the rule, against its spirit** (§2.3). |
| 19 | Former-price devices | all | FTC 16 CFR 233.1 | | **Pass.** No strike-through anywhere; $49 never rolls. B's "total rule with no total" does no harm but serves no purpose: drop it. |
| 20 | URL on the end card | all | `src/ig/components/End.tsx:247` types `neurotechvoice.com` | | The brief says "www.neurotechvoice.com". Every draft keeps the shared `IgEnd` exactly as ig1-ig4 have it. **Keep it** unless the owner insists. |

---

## 2. Findings by draft

**Severity:**
- **BLOCKER** = cannot post or ship like this.
- **MUST** = fix before posting.
- **SHOULD** = recommended.

### 2.1 Draft A

| Sev | Finding | Fix |
|---|---|---|
| MUST | **Captions imply the trial books** (voice.md rule; row 11). | Add "The free trial ... answers only your own test calls and doesn't book." to both captions (§5.3). |
| MUST | **No stated basis** (row 17). An agency retainer buys a build and someone running it; ours is self-serve. | Add "An agency builds and runs it for you. Ours you set up yourself, in under ten minutes." to both captions (S19, `ai-agents.ts:40`). |
| MUST | **No selection disclosure** (row 16). The hook is "for an AI receptionist", and AI apps exist at $0-$49. | Add "We didn't compare self-serve AI receptionist apps" to the TikTok caption and the IG pinned comment. *Recommended full wording:* "...; some cost the same as ours or less." |
| SHOULD | "Booking needs Google Calendar connected" is written without "(in beta)". The app still lists Calendar as beta (`pricing.ts:91`). | Make "(in beta)" the default. Drop it only if the owner's change also removes the badge. |
| SHOULD | **The cover reads as the going rate for any AI receptionist.** On the profile grid, "Don't pay $300 a month." stands alone; the agency label in the thumbnail is a 32 px tag, unreadable at grid scale. | Add a 44 px graphite line under the title: "Agency retainer. Ours: $49 a month." Every word is spoken in the reel. |
| SHOULD | **Trim #2 drops "Live".** "Live" is the only people label on the answering slip. | Delete trim #2 and trim #3. Trim #1 alone is enough (§3.2). |
| NOTE | A's TikTok pinned comment (135 characters) is the only one of the three that summarises the sources inside TikTok's 150-character cap. Keep it. | |

### 2.2 Draft B

| Sev | Finding |
|---|---|
| MUST | **The IG caption's first line ends "Ours is $49."** Every monthly figure needs "a month". |
| MUST | **The payoff frame's anchor is 44 px × .86 ≈ 38 px**, against $49 at 200 px. The side-by-side comparison does not read with the sound off. |
| SHOULD | **The step chips "Company · Tone · Voice · Go live" are never spoken.** They are four words that make a product claim. Turn them into icons or ink bars. |
| SHOULD | **The ig2 `EventCard` draws PRO and Beta chips** (`ig2/Cards.tsx:88`). A PRO chip on a $49 booking contradicts the reel. Fork the card without PRO. |
| NOTE | The answering service, the second category the owner asked for, appears only in the caption. |

### 2.3 Draft C

| Sev | Finding |
|---|---|
| MUST | **"Evening shift: $18 an hour" shows the BLS median for all receptionists as an evening-shift quote.** "Under three hours of that shift" turns a monthly plan fee into hours of a person. |
| MUST | **The visual metaphor is "the AI sets the person aside".** R3 steps back on "booked", then relights with an underline under the wage. ig1's position is the opposite. Against TikTok's audience of receptionists and front-desk staff, this is the riskiest frame of the three drafts. |
| MUST | **The units are mixed:** "$99 for 50 minutes" has no "a month", next to "$300 a month", "$18 an hour" and "$49 a month". |
| SHOULD | **"AI agency: $300 a month + setup" carries no hedge on screen**; it is B-grade. **$49 lands at 49 %**, against the 45 % guideline. |

---

## 3. Production

### 3.1 The kit (grep of `trailer/src`)

**Already exists:**
- **Ground, orb and motion:** `MeshGround`, `MUTED_MESH`, `MeshOrb`, `MOMENT_LIGHTS`, `RingPulse`, `meshElevation`, `SPRING`, `EASE`, `Swap`, `LightGL`.
- **Kit panels:** `Panel`, `RecordRow` (`src/kb/kit/ui.tsx:882`).
- **Call parts:** `ToolRow`, `CheckMark` and `CallerMeter` (`components/Call.tsx`); `OutcomePill`, with `booked`, `answered` and `messageTaken`.
- **Paper:** `DocPage` and `SlipStack` (`src/kb/kit/paper.tsx`).
- **ig2 parts:** `EventCard` and `SlotStrip`.
- **End card, timing and sound:** `IgEnd`; `vWord`, `place`, `upBeat`; `MUSIC.stop` (in `bed.mjs`, with ig4 as the precedent).
- **`ContactShadow`:** this one is film 1's, `src/components/Atmosphere.tsx:338`. No reel has used it yet: test it, or use the reels' own `meshElevation` lift.

**To build:**

| Part | Draft | Note |
|---|---|---|
| `Roll` | all three | nothing exists yet; the precedent is ig2 `Clock.tsx` |
| `BillPile`, `PriceChip`, scale hairlines | A | |
| `QuoteSheet` (adapted from ig4 `PriceList`), step chips | B | |
| three `QuoteSlips`, the strip seal, a reverse seam in 14 f | C | |

**Sound names that are not in the series' 106-key `SFX` table:**
- `fx-paper` (A, C): use `fx-paper-square`, `fx-slip` or `flip`.
- `keys` (A): the end card already plays `fx-keys`.
- `tap-0` and `fx-felttip-0` (B): `tap` and `fx-felttip` exist.

All trivial.

### 3.2 Word budget

The VO tokens per beat window, and the pace Tessa needs to fit them. Over 2.5 tokens/s is tight (✗); about 2.5 is at the edge (~).

| Beat | A tokens / s → tok/s | B tokens / s → tok/s | C tokens / s → tok/s |
|---|---|---|---|
| hook | 10 / 3.7 → **2.70 ✗** | 10 / 3.8 → **2.63 ✗** | 11 / 4.3 → 2.56 ~ |
| 2 | 9 / 3.8 → 2.37 | 10 / 4.0 → 2.50 ~ | 20 / 8.5 → 2.35 (b2-b4, one take) |
| 3 | 10 / 3.9 → 2.56 ~ | 8 / 3.5 → 2.29 | 9 / 4.0 → 2.25 |
| 4 | 8 / 3.5 → 2.29 | 9 / 3.5 → 2.57 ~ | 5 / 2.7 → 1.83 (Ava) |
| 5 | 8 / 3.1 → 2.58 ~ | 8 / 3.0 → **2.67 ✗** | 6 / 2.8 → 2.17 |
| 6 | 10 / 3.7 → **2.70 ✗** | 11 / 4.3 → 2.58 ~ | (none) |
| CTA | 5 tokens, 1.68 s measured (`ig2-07`) | same | same |
| **whole VO** | 60 tokens: **needs 2.50** | 61 tokens: **needs 2.53** | 56 tokens: **needs 2.30** |

**Placement simulation.** Takes run late and are pushed by `place()`; the impact lands on `upBar(CTA end + 15)`.

| Pace (tokens/s) | A | A with "That's" cut | B | C |
|---|---|---|---|---|
| 2.40 | 30.0 s | 30.0 s | 30.0 s | **28.0 s** |
| 2.50 | 30.0 s (the CTA ends at f767, 2 f past f765) | **28.0 s** (0.3 s spare) | 30.0 s | **28.0 s** |
| 2.62 (ig1) | **28.0 s** (0.7 s spare) | **28.0 s** | **28.0 s** (0.45 s spare) | **28.0 s** |
| 2.78 (mean) | **28.0 s** | **28.0 s** | **28.0 s** | **28.0 s** (1.3 s spare) |

**When "$49" is heard:**
- A: 12.3-13.0 s (44-45 %).
- B: 8.4-9.4 s (30-31 %).
- C: 13.7-14.5 s (49-52 %).

**Reading:**
- A and B land at 28.0 s at the series' real pace.
- At the brief's 2.5 tokens/s, both spill to 30 s: still inside the client's 20-30 s, but outside the 22-28 s target.
- A recovers with one word, and B has no plan. ig1 (63 tokens) was planned at 26 s and delivered at 28 s, so plan for the slow case.

### 3.3 Cards and every line voiced

- **A:** 13 cards, at most 6 words each. Every word on screen is spoken. The only unspoken text is chrome ≤ 32 px: `● SAMPLE CALL` and the dashboard's own "Checked your availability" and "Booked an appointment" (ig2 precedent). **Pass.**
- **B:** 12 cards, at most 6 words each. The step chips are unspoken words (§2.2). **Pass, with that fix.**
- **C:** 10 cards, at most 6 words each. But at b7 there are about 35 words on screen at once: 3 slips, the strip, the call card and the caption. **Pass on the rule, fail on reading at a glance.**

### 3.4 The combined TikTok + IG safe zone

**All three are inside the brief's box.** Text sits at x 86-906 (A) or 86-900 (B, C), y 240-1400, inside x 60-940, y 220-1440. Objects stay at x ≤ 880 below the start of TikTok's action column (y ≈ 840).

**One rule for ig5:**
- text x 86-900, y 240-1400;
- every price numeral at y 300-1260;
- objects at x ≤ 880 below y 840;
- the shared `IgEnd` field (x 174-906, y 940-1060) is the one exception.

A's own figure of 906 sits 6 px inside the ad guide's column. Use 900.

**BLOCKER for all three (QA tooling): the guard cannot check ig5's zone today.**
- **Why:**
  - `ZoneRect` in `src/ig/components/ZoneGuard.tsx:15-29` calls `zoneFaults()` from `src/ig/common/zones.ts`. Those are Instagram's bands: bottom 1520, rail from y 900, x 906.
  - `common/` is an `igHash` input, so it cannot change.
  - All three drafts say "ig5 passes its own constants to check-zones", but there is no way to pass them.
  - As planned, `check-zones --film=ig5` would PASS a caption at y 1480 that TikTok's caption block covers.
- **Fix:**
  - Add an optional `faults` (or `zones`) field to `ZoneState`, set through the existing `ZoneProvider` by ig5's Reel and Cover, and draw ig5's bands in `ZoneOverlay`.
  - Add `src/ig/components/ZoneGuard.tsx` to PIPELINE's allowed-diff list. The Git row lists Captions, End, Orb, Call and screens, not ZoneGuard.
  - `components/` is not an `igHash` input, so ig1-ig4 stay CURRENT.
- **Then confirm** that the end-card CTA "Comment AGENT for the link." measures ≤ 720 px wide, so it ends by x 900: it is centred at x 540 with `maxWidth` 780, so it can reach x 930. If it is wider, pass a narrower `ctaPlace`.

### 3.5 Muted read at the payoff

| Draft | Agency anchor | Answering anchor | Setup / other | $49 |
|---|---|---|---|---|
| A (b4) | $300: 168 × .84 ≈ 141 px | $99: 140 × .84 ≈ 118 px | $1,500 stub: 104 × .84 ≈ **87 px** (A claims ≥ 110) | 200 px |
| B (b3) | $300: 44 × .86 ≈ **38 px** | (caption only) | (none) | 200 px |
| C (b5-b7) | 96 px | 96 px | $18: 96 px | 150 px |

RESEARCH-format §2.5 asks for anchors of at least 120 px. Fixes:
- **A:** raise the stub to ≥ 132 px, or fan the pile at × .90.
- **B:** set the sheet's figures at ≥ 120 px.
- **C:** has no room on its frame.

### 3.6 Other build notes

- **A's `MUSIC.stop = [354, 372)` uses frames from the plan.** In the simulation, `ig5-04` moves by up to +22 f. Compute the stop from `vWord('ig5-04', 1)`, the measured "Forty-nine", the way ig4 re-anchors.
- **A's $49 hairline grows by +2.3 px for the number.** That cannot be seen at 1080 wide. It does no harm; keep it or drop it.
- **C's one 20-token take is the riskiest Cartesia line:** pacing at the semicolons is uncertain. Its split alternative costs about 0.5 s.
- **Build cost:** B < A < C. A reuses the most from ig1, ig2 and the kb kit. C needs five animated objects and a 14-frame reverse seam.

---

## 4. Score rationale

| | Truth | Production |
|---|---|---|
| **A** | Spoken copy clean and fully hedged; the $1.15 is volunteered. Three caption-level gaps (trial, basis, selection disclosure) and a cover that needs attribution. **7.5** | Budget at the edge, with a one-word fix. Best payoff frame. Moderate new build. Bands designed for the combined zone. Stop-time supported. **8** |
| **B** | Cleanest: the basis is spoken, the quote is labelled illustrative, the trial is correct, the self-serve apps are disclosed. One missing "a month". **8.5** | Simplest build. But the payoff anchor is 38 px, the budget is the tightest with no trim, there are unspoken chips, and the ig2 EventCard's PRO chip must go. **6.5** |
| **C** | Wage against monthly fee, mixed units, $300 unhedged on screen, a visual at odds with ig1. **6** | Best timing. Heaviest build, densest frame, 96 px anchors, riskiest single take. **6** |

---

## 5. Required fixes for the winner (A), in order

### 5.1 BLOCKER: zone guard
Do the `ZoneGuard` per-reel zone fix and its PIPELINE allowed-diff entry (§3.4). Use the one ig5 rule from §3.4.

### 5.2 Timing
1. Synthesise `ig5-02t` in the same Cartesia batch: "A common agency retainer. Setup, often fifteen hundred." `timing.ts` picks `ig5-02` or `ig5-02t` on the measured takes, so the CTA ends by f765 and the impact lands at f780 (28.0 s).
2. Delete trims #2 (drops "Live") and #3 (makes the fine print unspoken).
3. Never cut "often", "from", "for fifty minutes", "a month" or "Live".
4. If even `ig5-02t` runs long, a 30.0 s cut is acceptable (the client's range is 20-30 s). Cutting a hedge is not.
5. Compute `MUSIC.stop` from the measured onset (§3.6).

### 5.3 Captions
Below are the corrected texts. Changes from draft A:
- the ask line;
- the selection disclosure;
- the basis sentence;
- "(in beta)";
- the trial clause.

Checked:

| Text | Length | `caption.py` | `detect.py` | `humanize.py` |
|---|---|---|---|---|
| TikTok caption | 1,369 characters | READY | 84.8 PASS | 0 artefacts |
| IG caption | 1,307 characters | READY | 81.1 PASS | 0 artefacts |
| IG pinned comment | 683 characters | | 79.0 PASS | 0 artefacts |

**TikTok (post first, the 60 fps copy):**

```
AI receptionist cost, side by side: an agency build, a live answering service, and ours at $49 a month.

Comment AGENT and we'll send you the link. It's also in our bio.

Where the numbers come from (checked 7 Oct 2026): $300 a month is a common agency retainer for an AI receptionist, and agency setup fees often run around $1,500. $99 a month for 50 minutes is the cheapest 50-minute plan we found among ten US live answering services, which are staffed by people. We read each service's own pricing page, and we don't name them here. We didn't compare self-serve AI receptionist apps, and some of those cost the same as ours or less.

An agency builds and runs it for you. Ours you set up yourself, in under ten minutes. It picks up when you can't, tells callers it's an AI, answers from the documents you give it, and books the appointment into your calendar. It answers its own number, and you point your calls at it.

Fine print: $49 a month is the Starter plan fee in US dollars, excluding VAT. The phone number is $1.15 a month on top, and minutes past the plan's allowance are billed per minute. No setup fee, cancel anytime. Booking needs Google Calendar connected (in beta). The free trial is 5 minutes over 14 days with no card; it answers only your own test calls and doesn't book.

#AIReceptionist #AnsweringService #SmallBusinessOwner #SmallBusinessTips
```

"It's also in our bio" is safe: profile.md lists https://linktr.ee/neurotechvoice as @neuro.tech.voice's bio link, and TikTok DMs to non-mutuals may be blocked. This also settles B's and C's open question, so `ig5-07-bio` is not needed on TikTok.

**TikTok pinned comment:** keep A's 135-character text as written.

**Instagram:**

```
AI receptionist pricing, side by side: an agency retainer, a live answering service, and ours at $49 a month.

Comment AGENT and we'll DM you the link. 5 free minutes for 14 days, no card.

The numbers, checked on 7 Oct 2026: $300 a month is a common agency retainer for an AI receptionist, and agency setup fees often run around $1,500. The cheapest 50-minute plan we found among ten US live answering services was $99 a month. Those are staffed by people, so it's a different product. Sources are in the pinned comment.

An agency builds and runs it for you; ours you set up yourself, in under ten minutes. Keep your front desk for the work only people can do. Ours picks up when you can't: it tells callers it's an AI, answers from the documents you give it, takes messages and books the appointment into your calendar. It answers its own number, and you point your calls at it when nobody can pick up.

Fine print: $49 a month is the Starter plan fee in US dollars, excluding VAT. The agent's phone number is $1.15 a month on top, and minutes past the plan's allowance are billed per minute. No setup fee, cancel anytime. Booking needs Google Calendar connected (in beta). The free trial answers only your own test calls and doesn't book.

#AIReceptionist #AnsweringService #SmallBusinessOwner #VoiceAI
```

**IG pinned comment:** A's text, with one sentence inserted before "We don't name providers in our posts.": "We didn't compare self-serve AI receptionist apps; some cost the same as ours or less."

**If the no-booking take ships (`ig5-06-msg`):** delete from both captions "and books the appointment into your calendar" and "Booking needs Google Calendar connected (in beta)." Keep "doesn't book" on the trial.

### 5.4 Picture
1. **Cover:** add the attribution line "Agency retainer. Ours: $49 a month." at 44 px, graphite, under the title (§2.1).
2. **The b4 stub:** its figure goes to ≥ 132 px, or the fan to × .90 (§3.5).
3. **Sound names:** fix them (§3.1).

### 5.5 Worth grafting (optional)
- **From B:** its basis line, "You set it up yourself, in under ten minutes.", as an extra spoken line only if the measured takes leave about 2 s before f765. Never swap it in for "No setup fee": that line answers the $1,500 stub. Otherwise it stays in the captions only (§5.3).
- **From B:** the cover's attribution idea is already taken in §5.4.
- **From C:** a hook with the keyword first, set at frame 0, as the next A/B variant once Trial Reels unlock.

---

## 6. Launch gate (POSTING.md must carry it)

1. **Booking works on Starter.**
   - The test: a Starter account with Google Calendar connected books a real test call.
   - Today `entitlements.ts:43` blocks it.
   - **And the pricing page says so:**
     - `pricing.ts:91` must stop listing Calendar under Pro only;
     - `ai-agents.ts:40` "booking into Google Calendar on ${CALENDAR_PLAN} and above" must change.
   - Until both are true, render with `ig5-06-msg` (**Message taken**) and use the caption edit in §5.3.
2. **The trial still does not book** (trial `googleIntegrations: false`). If the owner turns booking on for the trial too, delete "doesn't book" from both captions.
3. **The live Stripe `STRIPE_STARTER_PRICE_ID` is $49.00 USD.** The repo cannot show it.
4. **SHOULD: settle Starter's minutes (400 vs 150) and overage ($0.20 vs $0.25) in the same edit as the calendar change.**
   - A "$99 for 50 minutes vs $49" reel sends viewers to the pricing page, which shows 400 minutes at $0.20 (`pricing.ts:236-237`), while the app bills 150 minutes at $0.25.
   - The reel never shows our minutes, but it invites the question.
5. **Re-open by eye** PATLive, Ciela, the Trillet guide and Agentpro (plus Constant Concepts, if the pinned comment's "two agencies' own price pages" stays). The research fetcher only summarised them.
6. **"(in beta)"** stays in the captions while the app badges booking as beta.
7. **After the change ships,** update voice.md:57 and profile.md:67 ("Calendar booking needs Pro"). Those files are outside this run's folder.
8. **AGENT replies on TikTok:** answer by hand within the hour; DM where allowed, otherwise reply pointing to the bio link.

---

## 7. Files

- This judgement: `/home/user/neuro-tech-voice/trailer/docs/ig/ig5/drafts/judge-truth-production.md`
- Judged: `/home/user/neuro-tech-voice/trailer/docs/ig/ig5/drafts/draft-A.md`, `draft-B.md`, `draft-C.md`
- Code behind the BLOCKER: `/home/user/neuro-tech-voice/trailer/src/ig/components/ZoneGuard.tsx` (lines 15-29), `/home/user/neuro-tech-voice/trailer/src/ig/common/zones.ts`
