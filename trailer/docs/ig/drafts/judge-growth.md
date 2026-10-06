# Judge: growth + conversion (12 IG reel concepts)

Label `judge:growth`. Written 2026-10-06 at HEAD `4ea0aa8` (`claude/remotion-trailer`). Planning only: this file is the only one I wrote.
Read: `docs/ig/RESEARCH-product.md`, `docs/ig/RESEARCH-reels.md`, `docs/ig/drafts/concepts-A.md` (A1–A4), `-B.md` (B1–B4), `-C.md` (C1–C4), plus `~/.claude/instagram/{profile,voice,log}.md`. I re-checked the facts the scores depend on: `lib/billing/entitlements.ts` (trial: `googleIntegrations` false, `smsConfirmations` false), `lib/twilio/countries.ts` (the 21 number countries), `lib/pages/custom-ai-agents.ts:590` (the agent's number sits alongside the current line; no porting), `lib/site.ts:1812-1813` (`PRICING_TRIAL`).

**The lens.** Will a stranger stop in 1.5 s, stay to the end, and rewatch, send, save or comment? Will that viewer then comment AGENT, build an agent, ring it, buy a number and pay? The account has 14 followers, so almost all reach is non-follower reach. There it is decided by **skip rate (3 s), watch time and sends per reach** (RESEARCH-reels §1.1, §1.4). Followers don't matter yet. The KPI is paid conversions per reel (§3.10).

**How I scored.** Four sub-scores, 1–10:
- **Stop**: frame 0 plus the first 1.5 s, with sound and muted.
- **Hold**: retention device, mid-reel payoff, loop.
- **Spread**: sends, saves and comments in 2025–26 Reels.
- **Convert**: does the CTA lead to something the free trial can reproduce, and does it point at a paid plan?

The overall score is weighted 25 / 25 / 20 / 30 and rounded. Build cost is a tie-breaker only, and is the production judge's lens.

**Hook scores** below come from `.claude/skills/ig-reel/hookscore.py`. It is a text-only heuristic (its own docs say it barely separates decent hooks: AUC 0.56). I quote it to catch weak lines, not to rank strong ones; the sound and the picture carry half of every hook here.

---

## 0. Summary

### 0.1 Scores

| # | Concept | Stop | Hold | Spread | Convert | **Overall** | With fixes | Verdict |
|---|---|---|---|---|---|---|---|---|
| A1 | 9:47 PM | 6 | 8 | 8 | 7 | **7** | 8 | bench (merge with C1's beep) |
| A2 | Twelve minutes (salon) | 7 | 9 | 7 | 8 | **8** | 8.5 | **MAKE (#3)** |
| A3 | Ninth time today | 4 | 6 | 5 | 6 | **5** | 6 | drop (B4 does it better) |
| A4 | 2:13 AM | 6 | 7 | 7 | 6 | **6** | 7 | bench (FB cross-post later) |
| B1 | Watch it book | 8 | 9 | 7 | 8 | **8** | 9 | **MAKE (#2)** |
| B2 | Four screens | 3 | 6 | 5 | 7 | **5** | 6 | carousel / Highlight, not a reel |
| B3 | One setting, 14 languages | 9 | 6 | 7 | 3 | **6** | 6 | bench (conversion leak) |
| B4 | Can you trip it up? | 7 | 7 | 8 | 9 | **8** | 9 | **MAKE (#4)** |
| C1 | The beep | 8 | 6 | 7 | 6 | **7** | 7 | donate hook to A1 |
| C2 | Not even ours | 8 | 7 | 9 | 7 | **8** | 9 | **MAKE (#1)** |
| C3 | Three myths | 6 | 6 | 6 | 7 | **6** | 7 | carousel; steal its CTA line |
| C4 | Five minutes | 5 | 4 | 5 | 4 | **4** | 5 | carousel / later test |

### 0.2 The recommended four (posting order)

| Order | Reel | Length after fixes | Hook type | Proof | Platform job | Conversion job |
|---|---|---|---|---|---|---|
| **01** (wk 1 Tue) | **C2 "Not even ours"** | 26 s | contrarian statement | arithmetic: the 168-cell week grid | sends, debate comments | reframes the buy as "cover the 123 empty hours", which needs a number and a plan |
| **02** (wk 1 Thu) | **B1 "Watch it book"** | 22 s | demo promise + ring | a live call, unbroken, booked, three cards | watch time, "look at this" sends | pre-sells Pro (booking), says so aloud |
| **03** (wk 2 Tue) | **A2 "Twelve minutes"** | 24 s | trade POV + countdown | in-hours answer from the service list, timer hits 00:00 | rewatch, sends inside the salon niche | the most Instagram-native buyer, ungated, trial-reproducible |
| **04** (wk 2 Thu) | **B4 "Can you trip it up?"** | 24 s | viewer challenge | meaning-matched answers + the honest "I won't guess" | comments, saves, reply-with-reel fuel | the CTA *is* the trial: upload a price list, ring it free |

**Pin:** B1 (what it does), C2 (why us), B4 (how to try).

**Covers:** one numbered series, kicker `AI RECEPTIONIST · 01–04`.

**Reels linking:** C2 → B1 → A2 → B4, then close the loop with B4 → C2.

### 0.3 Top fixes (details in §4 and §5)

1. **Use one keyword, AGENT, on all four, and have the DM automation live before reel 01.**
   - Record a "link in bio" CTA take for every reel as the fallback.
   - The DM offers help with the first setup, and **the owner answers every reply the same day**. That human step is the cheapest conversion lever a 14-follower B2B account has.
2. **Open every reel on the desk trill at 0.0 s** (B's sonic logo).
   - C2 and B4 lack a real-world sound at frame 0.
   - The premise must read muted on frame 0.
3. **Cut the tails.** Put the logo impact **one bar (2 s) before the end**, not two as B and C have it. The CTA starts at 72–78%.
   - This saves about 2 s per reel in the lowest-retention part.
   - Lengths become 26 / 22 / 24 / 24 s.
4. **C2:** cut `ig-c2-person`; the concession already lives in the desk line. The grid must be filling by about 4 s.
5. **B1:**
   - Keep the spoken Pro gate; it qualifies paying buyers.
   - Show the weekday only, not "8 October".
   - The DM and the pinned comment must say the free trial can't book (trial `googleIntegrations: false`), or trial users churn on day one.
6. **A2:**
   - Pin an honest answer to "how does the call reach it?" The agent answers its own number, alongside the current line, with no porting.
   - CTA: "Test it free on your own price list. Comment AGENT."
7. **B4:**
   - Cut "Three ways to ask."
   - Use 2–3 caller voices, not 4.
   - Ava answers the hardest phrasing.
   - CTA: "Test it free. Comment AGENT, then try to trip it up." It loops into the hook.
8. **Posting copy:**
   - Line 1 is keyword + hook, never the CTA first (A's drafts lead with "Comment AGENT…").
   - Line 2 is the CTA + the offer, then value, then the honesty notes.
   - At most 5 hashtags, always including #AIReceptionist.
   - One pinned comment per reel.
9. **Profile (the client's call):**
   - The bio's "every language" and "deployed in 5 minutes" contradict the site (14 languages; under ten minutes). Fix them before reel 01, because every reel sends traffic to the bio.
   - Add "5 free minutes, no card ↓", a UTM link, and the name field "Neuro Tech Voice | AI Receptionist".

---

## 1. What decides growth for this account (the yardstick I applied)

1. **Strangers, not followers.** At 14 followers the reel must work for someone who has never heard of the brand.
   - **Frame 0 must state a conflict in ≤ 7 words, readable muted**, with a real-world sound (ring, beep) at 0.0 s for the roughly 80% watching with sound on (RESEARCH-reels §1.5).
   - A time stamp ("Nine forty-seven.") or a bare noun phrase ("Ninth time today.") is not a conflict.
2. **A payoff in the middle, not only at the end.** Completion is a ratio, and the last 20% (CTA + brand) is where people leave.
   - Each pick has a visible payoff at 40–65% of the runtime: the grid turns teal, "Booked", the timer hits 00:00, "I won't guess".
   - The CTA should land as a continuation of that payoff, not a new scene.
3. **Sends beat likes for non-follower reach** (Mosseri, RESEARCH-reels §1.1). A send needs a recipient in mind:
   - "show my receptionist" (C2)
   - "look what AI can do" (B1)
   - "literally us on Saturdays" (A2, stylists)
   - "try to break this" (B4)
4. **The Instagram ICP is not the site's whole ICP.** All 16 trades are on the site, but the ones that *live on Instagram* are:
   - salons, spas, beauty and barbers;
   - fitness and studios;
   - wellness, clinics and dental front desks;
   - restaurants.

   Trades and property managers are thinner there and thicker on Facebook (practitioner consensus [K], not measured). That favours A2 and the Northside Studio (massage/physio) samples in B1 and B4. It argues for cross-posting A4-type reels to Facebook Reels later.
5. **No social proof exists (no customers, logos or testimonials), so "test it yourself" is the conversion engine.**
   - The trial is real: "Five free minutes, fourteen days, and no card", and test calls "never touch the five minutes" (`lib/site.ts:1812-1813`).
   - CTAs that send the viewer to **ring their own agent** convert better than claims.
   - C3's line "Don't believe a reel. Test one yourself." is the best CTA copy in all twelve; B4 is the reel built around it.
6. **Conversion leaks to avoid.** A reel that excites a viewer about something the free trial **cannot** do creates day-one churn unless the DM sets expectations:
   - booking (Pro, beta);
   - SMS (Starter+);
   - transfers (need a bought number);
   - a local number in a country outside the 21.
7. **Paying, not just trialling.** The step from trial to paid is buying a number and picking a plan. The reels that make that step feel natural are:
   - **C2**: covering the 123 empty hours *is* a live line;
   - **B1**: names Pro;
   - **A4**: a transfer needs a line.
8. **Series coherence is a grid asset.** A stranger who taps the name sees the grid. Four reels with:
   - the same type system,
   - a numbered kicker,
   - one end card,
   - the recurring sample business (Northside Studio / Ava),

   read as a company that knows what it is doing. That matters more for a B2B purchase than for a creator.

---

## 2. Concept by concept

**A1 · "9:47 PM" — 7 (fixes → 8).**
- *Strengths:*
  - The most universal small-business pain and the best story device in the set. The ×3 rewind ("same call, two endings") is a proven before/after shape.
  - The payoff (message taken → Inbox → the cursor presses *Call back*) is ungated and reproducible on a free test call.
- *Weaknesses:*
  - **It loses the first 1.5 s.** Frame 0 says "Nine forty-seven." and the conflict ("still ringing") arrives at about 2.5 s. Muted, it is a clock with nothing at stake.
  - It repeats the theme of the account's only post ("Closed is for the door, not the phone.", 52 views).
  - In a set that already has C2 (the empty hours) and B1 (an after-hours booking), it would be the third after-hours reel.
- *Verdict:* bench.
  - When it is made, give it C1's voicemail beep at 0.0 s and the frame-0 line "You're closed. Your phone isn't." with 21:47 as clock chrome.
  - Fold C1's "Voicemail records. An agent answers." into the rewind.

**A2 · "Twelve minutes" (salon) — 8 (→ 8.5).**
- *Strengths:*
  - The best-targeted reel for Instagram specifically. Salon owners are phone-bound with full hands, are heavy Instagram users, and have a dedicated page and kicker on the site ("Gloves on, tint on, timer running — and the phone is across the room", `salons-spas.ts:51`).
  - The countdown is a built-in retention device. "The call ends on the frame the timer hits 00:00" is satisfying and rewatchable.
  - Everything shown is on every plan, so a salon owner can reproduce it on the trial with her own service list.
- *Weaknesses:*
  - The vocabulary ("on the colour", "over-processes") caps reach outside the trade. That is acceptable, because those are the people who pay.
  - Comments will ask how the agent gets the call while the salon line rings across the room. The agent answers **its own number, alongside the current line** (`custom-ai-agents.ts:590`), so routing is the owner's phone setup. That must be answered honestly in a pinned comment, never shown as a product feature.
- *Verdict:* make. It also seeds a per-trade series (dental, trades, restaurant variants are already drafted).

**A3 · "Ninth time today" — 5 (→ 6).**
- *Strengths:* relatable, saveable, cheap.
- *Weaknesses:*
  - The weakest scroll-stop of the twelve. "Ninth time today." has no subject and no stakes (hookscore 25).
  - A parking question costs the owner nothing, so there is nothing to lose.
  - The meaning-match payoff (a hairline from *leave the car* to *Parking*) is subtle at phone size.
  - It duplicates both film 2's mechanism (the 100 s KB explainer is in the posting pipeline, `profile.md`) and B4, which tests the same feature with a sharper hook and a better twist.
  - It adds a male "you" voice to a series whose rule is the woman's voice.
- *Verdict:* drop.

**A4 · "2:13 AM" — 6 (→ 7).**
- *Strengths:*
  - The strongest objection-handler ("what about emergencies?").
  - An emotional "sleep through the rest" angle that builds trust.
  - A natural path to paying, because a transfer needs a line.
- *Weaknesses:*
  - The real hook, the caller's "Water's coming through my ceiling!", sits at 3.6 s behind a time-stamp line.
  - The payoff (a live transfer) can't be reproduced on the free trial.
  - Its audience (trades, property) is thinner on Instagram.
  - It is the heaviest A build: `TeamContactCard`, ringback, and the darkest ground, which is the most prone to banding at about 8 Mb/s.
- *Verdict:* bench for a Facebook Reels push. When made, open on the caller's line at 0.0 s.

**B1 · "Watch it book" — 8 (→ 9).**
- *Strengths:*
  - "Listen to this call" is *the* proven format for voice AI (Duplex, Sesame; RESEARCH-reels §4).
  - The promise is clear in 6 words at frame 0, over a ring.
  - The call plays **unbroken in real time** with a live transcript, a call timer, a spinning tool row and two slot chips. Then booked → a three-card cascade on the beat: something changes every 0.6–1.2 s, and the payoff lands at about 60%.
  - It is the only concept that sells the **paid tier on purpose**. "Calendar booking comes with Pro." is an honesty line *and* a qualifier, which matches the brief's "paying users".
- *Weaknesses and risks:*
  - In 2026 "AI books a call" is less novel than in 2024. The craft (no cuts, a real timer, the real outcome labels) and the honest Pro tag are what differentiate it.
  - **Conversion risk: the trial cannot book or text** (trial `googleIntegrations: false`, `smsConfirmations: false`). The DM and the pinned comment must say what the trial *can* do: build the agent, hear it answer, take messages.
  - The date "Thursday 8 October" will be wrong by posting day.
- *Verdict:* make.

**B2 · "Four screens" — 5 (→ 6).**
- *Strengths:* the best bottom-of-funnel asset; it *is* the trial path.
- *Weaknesses:*
  - A weak cold hook. Strangers don't care how to set something up until they want it ("Let's build an AI receptionist. Four screens." scores 43).
  - The borrowed 5.3 s greeting sags.
  - It is the heaviest build in all twelve (about ten UI facsimiles, about 11 cursor presses).
  - It ages with every onboarding change.
- *Verdict:* not a reel for this stage.
  - Make it a carousel or a Story Highlight ("How to start"), linked from the DM.
  - If it is ever a reel, open on the payoff (the agent answering with the business's name) and rewind to screen 1.

**B3 · "One setting, 14 languages" — 6 (→ 6).**
- *Strengths:* the strongest pure scroll-stop of the twelve (a Japanese voice and Japanese type at frame 0 in an English feed), and very sendable.
- *Weaknesses:* the product truth takes the wow away, and the conversion leaks.
  1. One agent speaks **one** language, chosen in a setting (`lib/voice/prompt.ts:255`). The most shareable reading, "it answers in the caller's language", is the false one, so the reel has to fight its own hook.
  2. Numbers are sold in **21 countries that exclude Germany, Spain, France, Italy, the Netherlands, Poland and Romania** (`lib/twilio/countries.ts`). The German and Spanish viewers it attracts can't get a local line.
  3. Native speakers will comment on Tessa's non-native de/es/ja accent, which is negative social proof on a 14-follower account.
- *Verdict:* bench. If it is made later, aim it at markets the number list serves (Japan, Portugal/Brazil, India), use native voices for the greetings, and caption "one language per agent".

**B4 · "Can you trip it up?" — 8 (→ 9).**
- *Strengths:*
  - A challenge hook that makes viewers participants. They comment ("ask it about parking!"), they send ("try to break this"), and the CTA is **literally the trial action**: upload a price list and ring it free.
  - The curveball beat ("Do you do home visits?" → stop-time → "I won't guess. The team will call you back.") is the most trust-building moment in all twelve. It answers "will it make things up?" by showing.
  - The cheapest build in B: film 2's paper kit.
- *Weaknesses:*
  - "Three ways to ask." is a slow narration beat.
  - Four caller voices in 5 s is busy.
  - A pearl frame 0 with a white page risks reading as a slide.
- *Upside:* the pinned "what would you ask it?" comment turns comments into reply-with-a-reel follow-ups on the same kit, which is a free content pipeline.
- *Verdict:* make.

**C1 · "The beep" — 7 (→ 7).**
- *Strengths:*
  - The voicemail beep is the best frame-0 *sound* in the set.
  - "You don't leave voicemails. Why would your callers?" makes every viewer check themselves.
  - "Voicemail records. An agent answers." is quotable.
- *Weaknesses:*
  - Its proof is a vendor study with a disputed year, and its own caption says "read it as a direction".
  - The message-card payoff is less visual than a live call.
  - It sits on the same missed-call pain as A1 and C2.
- *Verdict:* donate its beep, hook and diptych to A1 on the bench rather than make both.

**C2 · "Not even ours" — 8 (→ 9).**
- *Strengths:*
  - The most distinctive positioning in the set and the most debate and sends: an AI company telling owners **not** to fire their receptionist, resolved in under 3 s by "Not even ours" (hookscore 87, the top of all twelve).
  - The week grid (45 of 168 hours staffed, the other 123 cascading teal) is arithmetic, not a claim. It is satisfying to watch and easy to save.
  - It **reframes the purchase** from "replace a salary" (scary) to "cover the hours nobody's there" (easy), which is exactly the paid use (a live number + a plan).
  - Its stance pre-empts the anti-AI comments the demo reels could attract, which is one reason it goes first.
- *Weaknesses:*
  - 30 s and 69 words is the densest script.
  - The concession line ("In person, they beat any software.") delays the grid by 2.5 s.
  - There is no real-world sound at frame 0.
  - Solo owners must read "receptionist" as "you"; the arithmetic still holds for them.
- *Verdict:* make, and post first.

**C3 · "Three myths" — 6 (→ 7).**
- *Strengths:* a good pinned objection-handler, and it carries the best CTA line of the twelve.
- *Weaknesses:*
  - The listicle hook is formulaic.
  - Three vignettes in 18 s, at 30 s and 72 words, is dense.
  - Myth 2 overlaps B4, and myth 3 overlaps A4. Myth 3's transfer payoff can't be reproduced on the trial.
- *Verdict:* make it a **carousel** (myths are list-shaped, and carousels earn saves) from the reels' stills. Give its CTA line to the series.

**C4 · "Five minutes" — 4 (→ 5).**
- *Strengths:* pure education with a credited number, and the best sound edit in the set (the stop-time).
- *Weaknesses:*
  - Data reels skip the most.
  - "You have five minutes. Not ten." doesn't say *for what* until about 2.6 s.
  - Its ICP (lead-driven sales) is narrow on Instagram.
  - The honest caption has to admit the study measured **web leads, not calls**, and was run with a vendor, which undercuts the reel's own argument.
- *Verdict:* carousel, or a later Trial-Reel hook test once the account qualifies.

---

## 3. The set: why these four, in this order

### 3.1 Diversity check

| | C2 Not even ours | B1 Watch it book | A2 Twelve minutes | B4 Trip it up |
|---|---|---|---|---|
| First 1.5 s | contrarian statement + trill | demo promise + ring | trade POV + countdown + ring | challenge + trill + the price list |
| Pain | nobody on the phone 123 h a week | an after-hours booking lost | can't touch the phone mid-service | "will it say something wrong?" |
| Proof | arithmetic (week grid) | a live call, end to end | an in-hours answer from the service list | answers matched on meaning + an honest fallback |
| Mid-reel payoff | 123 cells cascade teal (≈ 9 s) | "You're booked" → three cards (≈ 10–14 s) | timer 00:00 on call end (≈ 15 s) | "I won't guess" after a stop-time (≈ 13 s) |
| Main signal | sends, comments (debate) | watch time, sends | rewatch, niche sends | comments, saves |
| Plan gate | none on screen | **Pro, spoken** | none | none |
| Trial-reproducible | answering, messages (yes); transfers need a number | no (DM says so) | yes | yes |
| Ground | pearl | deep night | pearl, rose key | pearl (cover on deep) |

Four different hooks, four different proofs, and only one gated feature, named aloud. Every reel turns rose into teal, ends on the same end card, and loops.

### 3.2 The arc (a stranger who sees two or three of them gets a story)
1. **C2: "Why."** Keep your people. The agent's shift is the 123 hours nobody covers.
2. **B1: "What it looks like."** One of those hours: a 21:14 call, answered, booked, filed.
3. **A2: "And when you're there but busy."** Hands in tint; it answers from your own list.
4. **B4: "Don't take our word for it."** Try to trip it up; the trial is free. This sets up reply-with-a-reel follow-ups.

### 3.3 Calendar, pins, linking, grid
- **Tue / Thu over two weeks** (Buffer's 3–5 posts a week; Fri–Sat are the weakest days, RESEARCH-reels §3.6).
  - Post at the target market's local time. For a mainly US + UK English audience, about 12:00–13:00 US Eastern (17:00–18:00 UK, 19:00–20:00 Romania) is a reasonable start [K]. Adjust once Insights shows when the audience is active.
- **In between**, 1–2 cheap posts a week: a carousel (C3's myths, B2's four screens, or stills from the week's reel) and Story shares of each reel with a link sticker.
  - Do **not** post film 2's 100 s KB explainer inside these two weeks. It competes with B4 on the same feature and will under-complete at 100 s.
  - Post it in week 3, as "the full version", for viewers who engaged with B4.
- **Pins:**
  - B1 answers *what is it*.
  - C2 answers *is it for me*.
  - B4 answers *how do I try it*.
  - Re-pin after week 2 by AGENT comments per reach.
  - The old 52-view reel stays, unpinned.
- **Reels linking** in posting order (C2 → B1 → A2 → B4, then close the loop with B4 → C2), with button text that sells the next reel, for example "Watch it book a call", "The salon version", "Try to trip it up".
  - Every reel still closes on its own CTA. Never "follow for part 2".
- **Covers** are custom 1080×1920 PNGs; a cover is an image, so its words need no voice:
  - kicker `AI RECEPTIONIST · 0n` (label role, x 86, y 280);
  - a 3–5-word title at ≥ 120 px cap height inside x 86–930, y 260–1500;
  - the teal orb as the series mark;
  - grounds alternating pearl / deep in posting order.

  | Reel | Cover title |
  |---|---|
  | 01 C2 | "Don't fire your receptionist." |
  | 02 B1 | "AI booked this call." |
  | 03 A2 | "Twelve minutes on the colour." |
  | 04 B4 | "Can you trip it up?" |

- **Cross-post** C2 and A2 to Facebook Reels through Accounts Center (small-business owners, free reach) [K].

---

## 4. Per-reel briefs (what each needs before it is built)

Bars are 2.0 s (120 BPM). Times are targets; the real grid comes from the measured takes, as in both films.

### 01 · C2 "Not even ours" → 26 s (13 bars), impact bar 13 (24.0 s)
- **Hook.**
  - Keep the line and the hook score of 87: "Don't fire your receptionist for an AI. Not even ours."
  - **Add the desk trill at 0.0 s** under the hook: the receptionist's phone, and the series' sonic logo.
  - Tessa by 0.2 s; "Not even ours." lands by ≤ 2.6 s, with the teal orb as its full stop.
  - Frame 0 already carries the full first sentence at 72% ink, so it reads muted.
- **Cut** `ig-c2-person` ("In person, they beat any software."; −2.5 s). The concession stays in "Your receptionist keeps the work only people can do." The grid's first column must be filling by about 4 s.
- **Keep:** hours → 168 → **123 teal cascade** (the mid-reel payoff; the `display` numerals map is required) → three outcome cards → the desk line.
- **Tail:** CTA "Five free minutes, no card. Comment AGENT." at about 19.5–22.3 s (≈ 75%); impact at 24.0; brand 24.1–25.6; seam to 26.0.
- **Pinned comment:** "Example schedule: 9 to 6 on weekdays is 45 of the week's 168 hours. How many hours is your phone actually staffed?"
- **Caption:**
  ```
  An AI receptionist shouldn't replace your front desk. It should cover the hours nobody is there.

  Comment AGENT and we'll DM you the link. 5 free minutes for 14 days, no card.

  The arithmetic: a desk open 9 to 6, Monday to Friday, covers 45 of the week's 168 hours. That's an example, so put in your own. For the other 123, an AI voice agent answers on the first ring, takes messages and puts calls through to the people you list.

  It tells every caller it's an AI in its first line. Test calls don't use your free minutes. A phone number for real callers is bought separately.

  #AIReceptionist #FrontDesk #SmallBusinessOwner #VoiceAI #MissedCalls
  ```

### 02 · B1 "Watch it book" → 22 s (11 bars), impact bar 11 (20.0 s)
- **Hook:** keep it. Frame 0: ring + "Watch an AI / book this call." + the `TUE 21:14 · CLOSED` chrome. Write the weekday only, never a date, because the date will be stale.
- **Keep the call unbroken** (2.0 → 13.75 s, real timer). This is the credibility of the whole reel.
- **Keep the spoken gate** "Calendar booking comes with Pro." on the event card, with the `PRO` and `BETA` chips. It qualifies paying buyers and costs only 1.5 s.
- **CTA:** "Comment AGENT for the link." (the series keyword, not BOOK). The DM carries the Pro detail. Record the alternate take "Start with the link in our bio."
- **Tail:** end at 22.0 (impact 20.0, brand 20.25–21.76, seam). Drop B's two-bar tail.
- **Truth:** the dim greeting row "…This is Ava, an AI assistant." stays visible. Before building, check that Tessa is in the voice picker (B §0.2) so the caption line about her is true.
- **Pinned comment:** "Booking is on Pro and up, with Google Calendar connected (in beta). On the free trial you can build the agent and hear it answer and take messages first. Comment AGENT for the link."
- **Caption:**
  ```
  Watch an AI receptionist take an after-hours call and book it, start to finish.

  Comment AGENT and we'll DM you the link.

  It says it's an AI in its first sentence, checks the free times, offers two, books the one the caller picks, texts a confirmation and files the transcript with a summary.

  Calendar booking is on Pro and up with Google Calendar connected (in beta). Text confirmations are on Starter and up. On the free trial (5 free minutes for 14 days, no card) you can build the agent and hear it answer and take messages.

  Sample call, recreated. Northside Studio and Ava are made-up names; the voice is Tessa from the voice library. Google Calendar™ is a trademark of Google LLC. Neuro Tech Voice works with it and is not endorsed by Google.

  #AIReceptionist #VoiceAI #AppointmentBooking #SmallBusinessTips #AIAgents
  ```

### 03 · A2 "Twelve minutes" (salon) → 24 s (12 bars), impact bar 12 (22.0 s)
- **Hook:** keep "Twelve minutes on the colour. You can't touch the phone." (hookscore 84).
  - Frame 0 must already show the timer rolling, the rose dot pulsing top-left and the first ring.
  - Spelling: the site writes "colour" (38 uses), so keep it.
  - Later A/B cut-down: "Gloves on. Tint on. And it's ringing." (the site's kicker).
- **Tighten b2:** "Pick it up, the colour over-processes. Leave it, she books elsewhere." Keep exactly one moving text at a time.
- **Payoff:** the call ends on the frame the chip reads `00:00`, on a beat, with the strongest hit before the impact (`mallet-e5` + glass). This is the rewatch moment; spend the polish here.
- **CTA:** "Test it free on your own price list. Comment AGENT." (9 words). It is specific to the reel's proof and true: the knowledge base is on every plan, the trial included.
- **Truth/comments:** the agent has its own number alongside the current line; the reel shows the answer, never a mechanism.
  - **Pinned comment:** "How does the call reach it? The agent answers its own number. You point your calls at it, for example with your phone provider's call forwarding when you can't pick up."
  - Never imply a ring-delay setting.
- **Cover kicker** may read `AI RECEPTIONIST · 03 · SALONS`. The cover is an image, so the trade callout costs no voice.
- **Caption:**
  ```
  An AI receptionist for salons: it takes the call you can't, with twelve minutes on the colour.

  Comment AGENT and we'll DM you the link. 5 free minutes for 14 days, no card.

  POV: gloves covered in tint, the timer running, the phone across the room. Your AI phone agent picks up and answers from your own service list: walk-ins, opening hours, policies. Every call is written down with a transcript and a summary.

  Test calls don't use your free minutes, so try it on your own price list before your next client. To answer real callers, you connect a phone number in the dashboard.

  Sample salon and sample call.

  #SalonOwner #AIReceptionist #HairSalon #SalonBusiness #SmallBusinessOwner
  ```

### 04 · B4 "Can you trip it up?" → 24 s (12 bars), impact bar 12 (22.0 s)
- **Hook:** keep "Can you trip up this AI receptionist?". The heuristic scores it 38, but the challenge and the visible price list carry it.
  - **Add the trill at 0.0 s**: the first caller is already ringing.
  - Give frame 0 strong contrast: graphite display type, and the page's figures legible at phone size.
- **Cut** "Three ways to ask." (−1.7 s). The first ring falls on bar 2 (2.0 s).
- **Callers:** three phrasings on **2–3 voices** (Kyle / Dana, alternating), each answered by its hairline. **Ava answers the third and hardest phrasing** ("Is the long massage pricey?" → "An hour of sports massage is $85."), so one answer for three questions reads as natural, not compressed.
- **Keep** the curveball, the stop-time, "I won't guess. The team will call you back." and "Where your documents stop, it says so."
- **CTA:** "Test it free. Comment AGENT, then try to trip it up." It lands at about 18.5 s (77%); the verbal loop flows into the hook on replay.
- **Pinned comment:** "What would you ask it? Reply with your question and we'll put the best ones to it in a reel." Answer the best ones with reply-with-a-reel, built on the same kit.
- **Caption:**
  ```
  Can you trip up an AI receptionist? Three ways to ask the price, and one question it can't answer.

  Comment AGENT and we'll DM you the link, then try it on your own price list. 5 free minutes for 14 days, no card.

  It answers from your own documents, matched on meaning, so "set me back" and "pricey" still land on your price list. Where your documents stop, it says so in the words you wrote instead of guessing.

  Like any AI it can occasionally get something wrong, so test it yourself. Test calls don't use your minutes.

  Sample calls with a made-up studio's price list.

  #AIReceptionist #VoiceAI #CustomerService #SmallBusinessTips #AIAgents
  ```
- **Before posting:** run the three phrasings and the curveball against a real agent loaded with the sample price list. A reel that invites people to break it must survive the attempt.

---

## 5. Series-wide fixes (apply to all four)

1. **One end card.**
   - Use A/C's comment field typing AGENT on her word, then the NEUROVOICE wordmark + `neurotechvoice.com` typed on "Neuro Tech Voice."
   - Drop B's StartFree button: it is unspoken text, and it splits the CTA in two.
   - **Impact one bar before the end:** brand ≤ 1.6 s, seam ≤ 0.5 s, CTA-to-end ≤ 5.5 s.
   - Show the comment field *before* she says "Comment AGENT", so muted viewers get the instruction.
2. **Frame 0 = cover-grade, premise-complete, sound at 0.0 s** (trill or ring), Tessa by 0.3 s.
   - Keep the frame-0 composition inside the 3:4 crop so the default cover still works if the custom cover fails to upload.
3. **One keyword: AGENT.**
   - It is already the account's keyword (`voice.md`), it is one automation template, and repetition builds recall across reels.
   - Each reel's automation gets its own UTM (`utm_campaign=reel_c2|b1|a2|b4`).
   - Meta allows **one** private reply per comment, within 7 days; the conversation continues only if the user replies, inside 24 h (RESEARCH-reels §3.2).
4. **DM template** (honest, built to get a reply so the 24 h window opens):
   ```
   Here's your link: https://www.neurotechvoice.com/register?utm_source=instagram&utm_medium=social&utm_campaign=reel_xx
   5 free minutes for 14 days, no card. Set up your agent in four screens, add your price list, and call it from your browser. Test calls don't use your minutes.
   Want a hand with the first setup? Reply here and I'll help.
   ```
   - For B1, add: "Calendar booking is on Pro (Google Calendar, in beta). On the trial you can hear it answer and take messages first."
   - **The owner answers every reply the same day.** For a B2B product with no social proof, that hand-held first setup is the step most likely to become a paid account [K].
5. **The automation must be live before reel 01.** If it is not, use the recorded "link in bio" CTA takes, and reply to every AGENT comment by hand within the hour.
6. **Captions:**
   - **Line 1** is the search phrase plus the hook (≤ 125 characters). A's drafts open with "Comment AGENT for the link.", which wastes the only line most people read.
   - **Line 2** is the CTA plus the offer.
   - Then 1–2 lines of value, then the honesty notes (sample names, plan gates, "a number is bought separately"), then ≤ 5 hashtags.
   - No em dashes in posting copy (ig-human).
   - Add alt text where Instagram offers it.
   - Rename the original audio, if allowed, to something without an absolute claim (e.g. "AI receptionist · Neuro Tech Voice"). **Not** "Every call answered".
7. **Day 0, every reel:**
   - Share to Stories with a "Start free" link sticker.
   - Keep a "Start free" Highlight.
   - Reply to every comment in the first hour.
   - Send the reel to people who would genuinely want it (a real send is a real signal).
8. **Profile as landing page (the client's call, before reel 01):**
   - **Name field:** "Neuro Tech Voice | AI Receptionist".
   - **Bio:** replace "Every call answered, in every language. / AI agents deployed in 5 minutes - worldwide." with the site's truth. For example:
     ```
     AI voice agents that answer your business calls.
     14 languages. Ready in under ten minutes.
     5 free minutes, no card ↓
     ```
   - **Link:** a UTM'd `/register` link.
   - Also correct `~/.claude/instagram/voice.md`. It still says "in the caller's language" and "deployed in 5 minutes"; the caption and DM skills read that file.
9. **Length discipline:** 22–26 s. Shorter wins on completion, and the 2025 Views metric counts replays (RESEARCH-reels §1.3). None of the four needs 30 s.

---

## 6. Bench: what to make after the first four (cheapest first)

| Next | What | Why |
|---|---|---|
| B4 replies | Reply-with-a-reel to the best "trip it up" comments (same kit, new phrasings) | Free topics, rewards commenters, compounds comments |
| A2 trade variants | Dental ("Patient in the chair"), trades ("Under a sink"), restaurant ("Walking a six to table twelve"), all already drafted | Same body, one new document and four new lines each; the best-converting niche gets more |
| A1 + C1 merged | "Same call, two endings": voicemail beep at 0.0, "You're closed. Your phone isn't.", rewind, morning Inbox | Universal pain, strongest story; post once the grid has variety |
| C3, B2, C4 as carousels | Myths, four screens, the decay chart (with its caveats) | List- and step-shaped ideas save better as carousels; cheap from stills |
| A4 for Facebook | Open on the caller ("Water's coming through my ceiling!") | Trades and property audience; the emergency objection |
| B3 (only targeted) | Japanese / Portuguese / Hindi markets, native voices, "one language per agent" captioned | Only where numbers are sold; avoids the DE/ES/FR/IT/NL/PL/RO leak |

Once Trial Reels unlock (≥ 200 followers by most sources, RESEARCH-reels §3.9), A/B the **first 2 s only** on the winning bodies.

---

## 7. What to measure, and when to change course

| Metric (Reels Insights / site) | When | Read it as |
|---|---|---|
| Skip rate (3 s) | 24 h | Under ~40% is healthy; over 50% means the hook is broken (RESEARCH-reels §1.4, [S6, V]). Re-cut the first 2 s as a *new* post later, never a repost of the same file |
| Average watch time and retention curve | 72 h | Where the curve drops: before the mid-reel payoff means the pacing is too slow; at the CTA is expected |
| Sends per reach, saves, comments | 72 h / 7 d | The reel with the best sends per reach gets the next variant |
| AGENT comments per 1,000 reach, DM replies | 7 d | The conversion intent signal the reels can control |
| UTM sign-ups → agent created → test call → number bought → paid | 14 d | The real KPI; one paid account outweighs any view count |

**Decision after the first four:** make two more of the format with the best (AGENT comments + sends) per reach.
- If it is A2, run the trade variants.
- If it is B4, run reply-with-a-reel.
- If it is C2, make a second contrarian line from the site's positions ("Answering the same question all day is not a job for a person").

---

## 8. Notes for the synthesis (outside or at the edge of my lens)

- **Conversion leaks to keep closed:**
  - B1's booking and SMS (trial can't);
  - transfers in C2's "puts calls through" (need a bought number, caption says so);
  - A2's routing (its own number, no porting);
  - B3's country list.
- **120 fps:** Instagram's published spec is 23–60 fps (RESEARCH-reels §2.4), so the platform plays at most 60. Deliver the 120 fps masters the client asked for, and post the 60 fps IG-upload derivative. Higher frame rates have no growth upside on Instagram.
- **Voices:**
  - B1 and B4 need caller voices (film 2 precedent). The client's rule holds: every on-screen line is voiced.
  - C2 is Tessa-only.
  - A2 needs one caller (Marian).
  - Drop A3's male "● YOU" voice entirely; it is not in the set.
- **Recurring sample:** keep Northside Studio and Ava as the series' sample business (B1, B4) and label it as a sample in every caption. A recurring "character" helps recognition across reels.
- **Build overlap with the set:** these pieces are shared by B1, B4 and A2, so the set costs less than four separate builds:
  - the call strip / TurnLabel, DocPage + InkSweep + MeaningLink;
  - RecordRow and the outcome pills;
  - the orb birth;
  - the end card.
  - C2 adds only `WeekGrid`; A2 only `TimerCard`; B1 its LiveTranscript, SlotStrip and cascade cards. B1 is the heaviest; if time runs short, its SMS card is the first cut, and the spoken Pro gate still covers it.
