# ig5 · growth judge (TikTok first, Instagram second)

Written 2026-10-07 on `claude/remotion-trailer`. Planning only: this is the only file written. Nothing was committed, and no Cartesia call was made.

**Goal I judged against:** TikTok views first, Instagram second, and paying users among small-business owners.

**What I read:** drafts A, B and C; `RESEARCH-format.md` §0-§2; `voice.md`; the owner's TikTok numbers (ig1 563 views, trailer end card 283, ig2 250, ig4 245, ig3 174); and the measured Tessa takes in `src/ig/voice.generated.ts`.

**Tools run:** `hookscore.py`, `beats.py`, `detect.py`, `humanize.py` and `caption.py`, all with `python3 -I` from a scratch folder. The skills themselves were not edited.

---

## 0. Verdict

**Winner: Draft A, "Don't pay $300".** Weighted score **7.8 / 10**, against B at **6.8** and C at **6.2** (§2).

Build A with the six grafts in §4. They are, in order of value:

1. **G1, from B:** "You set it up yourself, in under ten minutes." It replaces A's spoken "$1.15" beat.
2. **G2, from C:** the phone that has been ringing since frame 0 is picked up on "Ours?".
3. **G3, from B and C:** a blank quote slip is already on the desk at frame 0.
4. **G4, from B:** the AGENT DM line and a separate TikTok UTM.
5. **G5, from B and C:** the captions say the trial "doesn't book".
6. **G6, from B and C:** two comment-defence lines go in the captions and the pinned comment.

**Why A wins:**
- It is the only draft whose hook is STRONG in every form that matters:
  - the frame-0 card scores 85.8;
  - the full card scores 85.8;
  - the spoken line scores 83.2.
- It repeats the shape of the series' only clear TikTok winner: "Don't fire your receptionist for an AI." becomes "Don't pay $300 a month for an AI receptionist."
- It covers both comparisons the owner asked for, answering services and agencies, in like-for-like monthly units.
- It has the best screenshot frame: three quotes and $49, with hairlines drawn to scale.

---

## 1. Hookscore (run 2026-10-07)

`python3 -I .claude/skills/ig-reel/hookscore.py hooks.txt`. "Patched" is a scratch copy with the known "yo" bug fixed (a whole-word match for weak openers); it only changes hooks that start with "You…" or "Your…".

| Draft | What is scored | Raw | Patched | Weakest check |
|---|---|---|---|---|
| **A** | Full card: "Don't pay $300 a month for an AI receptionist." | **85.8 STRONG** | 85.8 | SPECIFICITY 75 |
| **A** | Frame-0 card S1 only: "Don't pay $300 a month" | **85.8 STRONG** | 85.8 | SPECIFICITY 75 |
| **A** | Spoken: "Don't pay three hundred a month for an AI receptionist." | **83.2 STRONG** | 83.2 | STAKES 70 |
| A alt | "Before you pay $300 a month for an AI receptionist." (`ig5-01b`) | **87.0 STRONG** | 87.0 | SPECIFICITY 75 |
| **B** | Full card: "You're paying $300 a month for an AI receptionist?" | 77.8 STRONG | 81.4 | STAKES 70 |
| **B** | Frame-0 card S1 only: "You're paying $300 a month" | 77.8 STRONG | 81.4 | STAKES 70 |
| **B** | Spoken: "You're paying three hundred a month for an AI receptionist?" | **54.8 OK** | 58.4 OK | **STAKES 20** |
| B alt | "Your AI receptionist costs $300 a month?" (`ig5-01b`) | 81.4 STRONG | 87.0 | FRONTLOAD 70 raw |
| **C** | Full line: "Three quotes for your after-hours receptionist, and the phone's still ringing." | 80.0 STRONG | 80.0 | STAKES 70 |
| **C** | Frame-0 card S1 only: "Three quotes for your after-hours receptionist," | **55.4 OK** | 55.4 OK | **STAKES 20** |
| C alt | "What would your after-hours receptionist cost? Three quotes." (`ig5-01b`) | 80.8 STRONG | 80.8 | STAKES 70 |
| C alt | "Your after-hours receptionist: three quotes. The phone's still ringing." (`ig5-01c`) | 79.4 STRONG | 83.0 | STAKES 70 |
| ig1 | "Don't fire your receptionist for an AI. Not even ours." | 87.0 STRONG | 87.0 | SPECIFICITY 75 |
| Reference | "You're paying $39 a month for a robot that types "check your DMs"." | 75.0 STRONG | 78.6 | STAKES 70 |

**What the numbers say that the drafts did not report:**
- **B's tension lives only in the "$" glyph.**
  - B's own self-check reports only the on-screen form, 77.8. Spoken, the line has no stake word and no "$", so it scores **54.8 OK**.
  - On TikTok, where most people watch with the sound on, the ear hears a neutral question.
  - The hook also presumes the viewer already pays $300 for an AI receptionist, and most small-business owners don't. A presumption that is false for most viewers gets a "no, I'm not" and a swipe.
  - The reference got away with it because nearly every creator watching really was paying ManyChat.
- **C's frame-0 card has nothing at stake (55.4 OK).**
  - The stake ("the phone's still ringing") only reaches the screen on the second card, at about 2.4 s.
  - No figure appears until "$300" at about 5.5 s. In a price reel, that throws away the anchor during the 0-2 s window.
- **A's hook holds up whether you read it at frame 0 (85.8), see the full card (85.8) or hear it (83.2).**
  - "Don't" carries the stake in sound, and "$300" carries it on screen.
  - It is 1.2 points below ig1's 87.0. The scorer's own AUC between good hooks is 0.56, so that gap means nothing.

---

## 2. Scores (1-10)

**Weights:** hook ×2 and retention ×1.5, because TikTok distributes on the early hold and on watch time. Every other criterion counts ×1. The weights sum to 9.5.

| Criterion | A "Don't pay $300" | B "You're paying $300?" | C "Quotes on the desk" |
|---|---|---|---|
| **Hook: first 2 s + searchable keyword** (×2) | **8.** $300 on the f0 card. An imperative that applies to anyone shopping. "AI receptionist" on screen by 2.4 s. A rhyme with ig1 | 6. $300 on the f0 card, but the spoken line is flat (54.8) and it presumes the viewer pays. Keyword by 2.2 s | 5. Keyword on the f0 card, but no number and no stake there (55.4). The spoken hook runs 4.0 s |
| **Retention curve** (×1.5) | 7. An event every 1-2 s through three anchors. Stop-time at the 44 % payoff. **Dip:** b5 "$1.15" holds 3.1 s with nothing visible moving (the 2.3 px hairline growth won't register on a phone) | 6. The payoff comes at 30 %, so the question is answered at 8 s with 20 s left. Only one anchor, so there is little to hold on to after it | 7. The open loop (the phone still ringing) runs to 13 s and the pickup is strong. **Sag:** an 8 s one-take list of three prices |
| **Rewatch / share / save** | **8.** The b4 frame (three quotes, $49, to-scale lines from $0) is the screenshot. It is easy to send: "this is what the agency quoted us". The seam loops to the ringing desk | 6. One sheet against one strip: clear, but little to reread | 7. Dense and the Booked call is satisfying, but the mixed units are hard to screenshot as a comparison |
| **Price-contrast clarity** | 8. All three figures are per month, with the one-time setup fee kept off the scale | **9.** One anchor against $49, and setup against no setup. The simplest read | 5. $/month, $/50 min and $/hour on one desk. Figures at 96 px, below the research's 120 px floor |
| **CTA pull** | 7. Booking lands just before the CTA, which is the desire peak. Nothing answers "is it hard to set up?" | **8.** "You set it up yourself, in under ten minutes" plus booking just before the CTA | 6. The beat before the CTA is wage arithmetic, not a reason to act |
| **Fit with the reference reel's pattern** | 8. Price-anchor hook → the pain (retainer + setup) → cheaper path → what it does → AGENT. Missing: "so I built my own" | **9.** The closest mirror, including "you set it up yourself" | 5. Story first; the anchor arrives at 5.5 s |
| **Calm premium voice** | 8. Dry advice from one owner to another, and a candid "$1.15" line | 6. "You're paying…?" and "At agencies, that's the low end" lean confrontational | **9.** The calmest of the three: the reel shows the product working |
| **Series fit (ig1)** | **9.** The same "Don't …" shape, the desk hairline with its rose light, and "when you can't" (the hours ig1 gave the agent). No wage | 6. Neutral: no echo, no conflict | 6. After-hours framing fits, but it ends its argument on "$49 = under three hours of that shift", the comparison ig1 refuses to make. TikTok comments will read it as "so cut the receptionist" |
| **Weighted total** | **7.8** | 6.8 | 6.2 |
| **A with the §4 grafts (projected)** | **8.4** (hook 8.5, retention 8, CTA 8, reference 9; other criteria unchanged) | | |

---

## 3. The growth read, draft by draft

### A: "Don't pay $300"

**Keep:**
- The hook, its frame-0 card, and the "$300 a month" glide into the slip.
- "That's a common agency retainer" (the source's own word). "Live" and "for 50 minutes" as the hedges.
- Hairlines drawn to scale at 2 px per dollar. This is the muted read and the best muted device in the three drafts.
- The stop-time at f354 → "Forty-nine".
- The ig1 desk callback, and the seam back to the ringing desk.
- The cover "Don't pay $300 a month." with the kicker `AI RECEPTIONIST · 05`. On the grid it sits next to ig1's "Don't fire your receptionist."

**Fix:**
- **b5 is the one dead spot.** It holds 3.1 s with nothing visible moving, which breaks RESEARCH-format §2.5 ("nothing static longer than 1.5 s before the CTA").
- **Nothing answers the effort objection,** so the comparison has no stated basis. The agency builds it for you; ours you set up yourself. ASA wants that basis clear (RESEARCH-format §2.7), and A's own self-check does not cover it.
- **The orb is born twice:** once implied at b4, then again in b6. That wastes the strongest moment the series owns.

**TikTok risk:** the hook will draw AI-automation-agency builders into the comments to defend their pricing. That is engagement, and G1 plus the reply line in §6 turn it into proof.

### B: "You're paying $300?"

**Best parts:**
- The setup line and its four setup chips.
- The simplest price read in the three drafts.
- The comment-defence lines in its captions.
- The separate TikTok UTM.

**Weak for growth:**
- **The presumptive hook** (§1).
- **The early payoff at 30 %.** With only one anchor, the reel has spent its question by 8 s.
- **"At agencies, that's the low end."** One of the eight sources starts at $150, and an agency commenter can say "I charge $150", which is true. A's "common agency retainer" can't be disputed that way.
- **The total rule** drawn under a monthly fee and a one-time fee invites the viewer to add them, then shows no total.

### C: "Quotes on the desk"

**Best parts:**
- The ringing phone as an open loop.
- The pickup that lands exactly on "Ours".
- The seam that turns the orb back into the rose light.
- Frame 0 full of objects: three blank slips.

**Weak for growth:**
- **No price for 5.5 s,** in a price reel.
- **An 8 s single take** reading a list of prices.
- **The three anchors are in different units,** so the contrast takes thinking.
- **It ends its argument on a wage.** That is the one comparison the series' best performer told viewers not to make. It is permitted as evening cover, but it is what TikTok commenters will screenshot.

---

## 4. Grafts into A (exact lines)

| # | From | Exact line / device | Where it goes in A | Cost | Why |
|---|---|---|---|---|---|
| **G1** | B `ig5-04` + B b4 picture | **"You set it up yourself, in under ten minutes."** Cards: "You set it up yourself," / "in under ten minutes."<br>Picture: inside our slip's lower row, four chrome chips (28 px), **`Company · Tone · Voice · Go live`** (`lib/pages/home/start.ts:12`). From "yourself" they fill teal one per 16th; on "minutes", "Go live" takes a drawn `CheckMark`. Sound: `fx-pluck` E5 → F#5 → G#5 → B5, then `fx-ting` (B's cue). | **Replaces A's b5** (`ig5-05` "Plus the number: a dollar fifteen a month."). The new id is `ig5-05`. | +1 word over A (64 against 63). At ig1's measured narrator pace of 2.6 words/s, b5 runs about 3.5 s, roughly 0.4 s longer. Every later line shifts by about 12 f, and `timing.ts` re-anchors them anyway. | It is the reference's "so I built my own", translated truthfully (RESEARCH-format §0.4). It answers "is it hard?" right before the booking demo and the CTA. It states the basis of the comparison (the agency builds it, you set it up), which makes "No setup fee" make sense. It turns the reel's one static beat into four visual events. Sources: `lib/pages/ai-agents.ts:40` "Ready in under ten minutes"; `lib/pages/home/pricing.ts:243` "No setup fee". |
| **G2** | C b2-b5 + b10 | **The pickup on "Ours?".**<br>The rose desk light that rings at f0 and f30 keeps ringing, ducked −8 dB under the voice: one burst at about f150 between `ig5-01` and `ig5-02`, and one at about f285 between `ig5-02` and `ig5-03`.<br>On "Ours?" (f357, inside A's stop-time silence) `fx-pickup` cuts the ring, and the light springs open into the teal orb. That is film 2's birth: `SPRING.pop` 0 → 1.06 → 1, then `mixPalette` rush → sunday over 6 f, followed by C's 0.45 s `EASE.inOut` glide to the "$49" full stop.<br>b6 then **drops its own birth**: the orb is already there and leans into the call record.<br>Seam, from C b10: "the orb shrinks into the rose desk light" by f839, with A's `RingPulse` at f836. | b1-b4 sound; b4 picture; b6 and b9 adjusted | 0 words. One new cue (`fx-pickup`); the ring cues already exist. | It creates a 12-second open loop, a phone nobody answers. The price payoff and the product payoff land on the same word. In sound, the click comes out of stop-time silence: ring … ring … silence … *click*, "Ours?". That is the most rewatchable second in the reel. |
| **G3** | B b1 ("the sheet is already rising at f0") and C b1 (blank slips) | **A blank slip 1 on the desk at frame 0.** White, perforated top edge, two graphite ink bars, an **empty amount slot**, −1°, rising from f −6. It sits under the S1 card and above the desk hairline. Keep A's rule: no `QUOTE` tag.<br>At f90, A's existing glide drops "$300 a month" into the slot the viewer has been looking at for 3 s. The drop should be ≤ 200 px; rebalance S1 upward if needed. | b1 | 0 words. Layout only. | TikTok judges the first frame in under a second. An object reads before a word does, and an empty price slot is an open question (RESEARCH-format §2.6, "an open slot at frame 0"). Two of the three drafts did this; A alone opens on type. |
| **G4** | B §7.2 | **DM line** before "Want a hand?": "Booking into your calendar is on the $49 plan (Google Calendar, in beta). On the free trial you can build it and hear it answer first."<br>**TikTok replies:** `utm_source=tiktok&utm_campaign=tt_ig5`. Instagram stays on `reel_ig5`.<br>From B §9.7, before posting: confirm whether @neuro.tech.voice can show a bio link, and that the owner can DM commenters by hand. | POSTING (DM + links) | none | "Paying users" can only be measured per platform if the links are split. The DM line sets the trial expectation before the trial runs into the booking gate. |
| **G5** | B §7.1 and C §8.1 | **Trial truth in the captions:** "The free trial answers only your own test calls and doesn't book." This replaces A's "Until you buy a number, the agent answers only your own test calls." | Both captions' fine print | none | A's captions put "free trial link" and "books the appointment" in the same caption without saying the trial doesn't book. True today: trial `googleIntegrations: false` (`lib/billing/entitlements.ts:27-29`). If the owner turns booking on for the trial too, delete the clause. |
| **G6** | B §8 and C §9 | **"We didn't compare self-serve AI receptionist apps; their prices vary."** (B)<br>**"The quote slips in the video are illustrative, not real businesses'."** (C's line, adapted to A's slips) | TikTok caption sources paragraph; IG pinned comment | none | On TikTok the first sceptical comment will be "X does it for $29". RESEARCH-prices §4 says it's true, so we say first that we didn't compare those apps. The slips look like documents, so we say they're illustrative. |

### What G1 moves, and why the "$1.15" stays public

- **What happens to "$1.15":** it leaves the voice-over but stays in three places:
  - A's TikTok pinned comment, unchanged: "…Ours is $49 a month, plus $1.15 a month for the number." That is the first thing people read in the comments.
  - The IG pinned comment.
  - Both captions' fine print.
- **The payoff stays "Ours? $49 a month."** That is RESEARCH-product S2 (SAFE), and the owner asked for "$49". It is plan fee against plan fee: the agency's $300 also leaves out its setup fee and per-minute usage.
- **Both lines can't fit.** Keeping "$1.15" *and* adding G1 makes 72 spoken words. At 2.6 words/s plus gaps, the CTA would end at about 28.5 s, past even a 30 s reel (which needs it to end by about 26.2 s). G1 was chosen over "$1.15" because it moves the viewer towards the CTA, makes the comparison fair, and replaces a static beat with four events.

---

## 5. A′, the grafted spoken script

| id | say | Cards (≤ 6 words, display form) |
|---|---|---|
| `ig5-01` | Don't pay three hundred a month for an AI receptionist. | "Don't pay $300 a month" / "for an AI receptionist." |
| `ig5-02` | That's a common agency retainer. Setup, often fifteen hundred. | "That's a common agency retainer." / "Setup, often $1,500." |
| `ig5-03` | Live answering service: from ninety-nine a month, for fifty minutes. | "Live answering service:" / "from $99 a month," / "for 50 minutes." |
| `ig5-04` | Ours? Forty-nine dollars a month. No setup fee. | "Ours? $49 a month." / "No setup fee." |
| `ig5-05` **(new, G1)** | You set it up yourself, in under ten minutes. | "You set it up yourself," / "in under ten minutes." |
| `ig5-06` | It picks up when you can't, and books the appointment. | "It picks up when you can't," / "and books the appointment." |
| `ig5-07` | Comment AGENT for the link. | "Comment AGENT for the link." |
| `ig1-07` | Neuro Tech Voice. (borrow) | wordmark + URL |

**Alternates:**
- Keep A's `ig5-01b` ("Before you pay three hundred a month for an AI receptionist.", 87.0) and `ig5-07-bio`.
- `ig5-06-msg` ("…and takes a message.") stays the no-booking fallback under the **launch gate**: post only after Starter booking works in the product and the pricing page says so.
- Drop A's old `ig5-05` from the voice batch. If the orchestrator wants a spare, generate it as `ig5-05-num`.

**Checks:**
- **Timing.** `beats.py --wpm 156` (ig1's measured narrator pace, 2.6 words/s) gives **64 words, about 24.6 s** including the sign-off. A as written is 63 words and 24.2 s.
  - With A's roughly 1.8 s of gaps, the CTA ends at about **25.3 s**. That is inside A's 25.5 s limit for the **28.0 s** cut (impact f780), with 0.2 s to spare.
  - At the series average of 2.78 words/s it ends at about 24.3 s.
  - If the takes run long, use A's trim order: drop "That's" first. Never cut "yourself" or "under": they carry the fairness basis and the site's exact claim.
- **`beats.py` flags.** The tool repeats A's known flags:
  - hook 3.9 s (the card is readable at f0; "$300" is heard at about 1.2 s);
  - nothing concrete in beats 5-7 (the screen shows the figures and "ten" is spelled as the site spells it);
  - no loop (the seam handles it visually, now through G2's orb-to-light return).
- **`detect.py`:**
  - on-screen text **75.1 PASS** (burstiness 57.2, slop 100, fingerprint 100);
  - spoken form 62.9 REVIEW, the same spelled-number artefact A reported (62.4).
- **`humanize.py`:** nothing to strip.

---

## 6. Caption and comment changes (paste-ready, checked)

**TikTok caption: A's, with G1, G5 and G6 applied.**
- `caption.py --keywords "AI receptionist,answering service"`: **READY**. 1,365 characters; the 103-character first line lands whole; 2 of 2 search terms are in the visible window; one ask; 4 tags.
- `detect.py`: **80.7 PASS**. `humanize.py`: nothing to strip.

```
AI receptionist cost, side by side: an agency build, a live answering service, and ours at $49 a month.

Comment AGENT and we'll send you the free trial link. 5 free minutes for 14 days, no card.

Where the numbers come from (checked 7 Oct 2026): $300 a month is a common agency retainer for an AI receptionist, and agency setup fees often run around $1,500. $99 a month for 50 minutes is the cheapest 50-minute plan we found among ten US live answering services, which are staffed by people. We read each service's own pricing page, and we don't name them here. We didn't compare self-serve AI receptionist apps; their prices vary. The quote slips in the video are illustrative, not real businesses'.

An agency builds it for you. Ours you set up yourself, in under ten minutes, from answers you write down once. It picks up when you can't, tells callers it's an AI, and books the appointment into your calendar. It answers its own number, and you point your calls at it.

Fine print: $49 a month is the Starter plan fee in US dollars, excluding VAT. The phone number is $1.15 a month on top, and minutes past the plan's allowance are billed per minute. No setup fee, cancel anytime. Booking needs Google Calendar connected. The free trial answers only your own test calls and doesn't book.

#AIReceptionist #AnsweringService #SmallBusinessOwner #SmallBusinessTips
```

**TikTok pinned comment:** A's, unchanged (135 of 150 characters). It is now the main place viewers see "$1.15", so keep it word for word.

**Instagram caption:**
- Apply the same three edits to A §8:
  - add "Ours you set up yourself, in under ten minutes";
  - change the fine-print last line to "The free trial answers only your own test calls and doesn't book.";
  - G6 goes in the pinned comment below.
- Re-run `caption.py` and `detect.py` after editing.

**Instagram pinned comment: A's, with G6.** 735 characters; `detect.py` **77.6 PASS**.

```
Sources, read 7 Oct 2026. Agencies: two agencies' own price pages and six published pricing guides. Seven of the eight put the lowest monthly retainer at about $300 or more, and the typical lowest setup fee is $1,500 (some agencies waive it). Agency retainers often add per-minute usage on top, as our plan does past its allowance. Answering services: the pricing pages of ten US providers, all staffed by people. Buying 50 minutes costs $99 or more at every one of them. We didn't compare self-serve AI receptionist apps; their prices vary. The quote slips in the video are illustrative, not real businesses'. We don't name providers in our posts. Ours: $49 a month plan fee (USD, excl. VAT), plus $1.15 a month for the phone number.
```

**Ready reply for agency builders defending their price.** 144 characters, so it fits TikTok's 150-character comment cap; `humanize.py`: nothing to strip.

```
Fair point. An agency builds and runs it for you, and that's worth paying for if you want it. Ours you set up yourself, so there's no setup fee.
```

**Alt text:** in A §8, replace "Plus the number: $1.15 a month." with "You set it up yourself, in under ten minutes."

---

## 7. Considered and not grafted

| Idea | From | Why not |
|---|---|---|
| "You're paying $300 a month for an AI receptionist?" as the hook | B | It presumes something most viewers don't do. The spoken form scores 54.8 OK (§1) |
| "Your AI receptionist costs $300 a month?" as the TikTok A/B | B | It has the same presumption. A's own `ig5-01b` "Before you pay…" (87.0) speaks to the people actually shopping, so it is the better second post |
| "At agencies, that's the low end." | B | One source starts at $150, so it can be disputed. A's "common agency retainer" is the source's own wording |
| The total rule under the quote | B | It invites the viewer to add a monthly fee to a one-time fee, then shows no total |
| "Evening shift: $18 an hour" / "Under three hours of that shift." | C | It ends the argument on wages, against ig1. That is the TikTok winner, so we don't contradict it |
| The one-take list of three prices | C | 8 s of one cadence. A's one-row-per-line rhythm holds better |
| The "after-hours receptionist" hook keyword | C | It is weaker as a search term than "AI receptionist", and it is the phrase most likely to be read as a job |
| A's 2.3 px hairline-growth "joke" | A | It can't be seen at phone size; G1 removes the beat it lived in |
| A spoken keyword echo, "Your AI receptionist picks up when you can't…" | B b6 | +2 words (about 0.8 s) pushes the CTA past 25.5 s and the reel to 30 s. The visual seam already gives the loop |
| "free" in the on-screen CTA | none | The reel shows booking and the trial doesn't book (the ig2 rule). "Free" stays in the captions and the DM |

---

## 8. TikTok measurement plan

**Post A′ first on TikTok** (the 60 fps copy, custom cover, A's TikTok caption with §6 edits). Then post it on Instagram.

**After about 48 h, read in TikTok analytics:**
- average watch time;
- the percentage who watched the full video;
- the retention graph at 2-3 s and at the b4 payoff (about 12-14 s).

**Hold at 3 s.** RESEARCH-format §2.1 quotes trackers that call a 30-40 % skip rate healthy and over 50 % a broken hook. That benchmark is for Instagram's Skip Rate; use it only as a rough guide on TikTok.
- **If the early drop is steep:** about a week later, post the same body with `ig5-01b` "Before you pay $300 a month for an AI receptionist." as a separate TikTok post.
- **On Instagram:** use Trial Reels for that A/B once the account passes about 200 followers.

**Paying users:** count AGENT comments per platform, trials from `tt_ig5` against `reel_ig5` (G4), and Starter purchases within 14 days. Those outcomes decide whether ig6 stays on price or goes back to the "receptionist" demo family. The sample of five reels is too small to call that from views alone.

**Launch gate:** this is unchanged from all three drafts.
- Post only after Starter booking works in the product and the pricing page says so.
- Confirm that the live Stripe Starter price is $49.00.
- Re-check by eye the pages behind $300, $1,500 and $99: PATLive, Trillet, Ciela and Agentpro.
