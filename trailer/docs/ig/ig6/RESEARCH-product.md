# ig6 ("every second" style reel): product truth

Read from the code at HEAD `9cb3bc8` (`claude/remotion-trailer`) on 2026-10-11. This file is the only one written; nothing committed.
Paths are relative to the repo root; `file:line` is the line at that HEAD.

`git diff 5127eef HEAD -- lib types app components` is **empty**: no product code changed since ig5's research. Every ig5 citation was still re-opened and checked (§1), and the ig6-specific questions ig5 never asked (pickup speed, forwarding, simultaneous calls, "every" absolutes, test calls) were read fresh (§2).

---

## 0. Verdict

1. **ig5's product truth holds line for line today** (§1). Booking is still Pro only: `starter.googleIntegrations: false` (`lib/billing/entitlements.ts:43`).
2. **The "every second" theme works with no number on our side.** The seconds belong to the caller waiting at an unanswered phone (a truism, or the ring-cadence standard in RESEARCH-viral F1). The product's only time claim is the site's **"on the first ring"**. That rates **B**: nothing in the code delays the answer, but the speed was never measured. Never attach a figure to our pickup ("1 second", "<1 s", "instantly", "before the second ring").
3. **Absolutes.** "Never miss a call" is **UNSAFE**. Real refusal paths exist in the code, and the Terms say the service is not guaranteed to be uninterrupted (§2.4). Don't use **"Every call answered"** bare either: the home page dropped it on purpose. Use "every" only where it is literally true: **"Every caller hears it's an AI"**, **"Every call written down"**, **"Answered on the first ring, at 3 a.m., on a Sunday."**
4. **One cut: no booking, no price.** The message doesn't need either, so ig6 doesn't wait on the Starter-booking ship. If the owner insists on a price, the only option is "From $49 a month" with ig5's caption fine print, and then no calendar or booking anywhere.
5. **Show the agent answering its own number.** Don't show the owner's existing line ringing out and then being "taken over". No forwarding or overflow feature exists in the code (§2.2).
6. **End card:** the shared `IgEnd`, unchanged in choreography. The CTA stays **"Comment AGENT for the link."** Its text can be set in the reference's two tiers (heavy grotesk "Comment" + accent italic serif "*AGENT*"). On TikTok, the caption points to the link in bio (§7).

---

## 1. ig5 `RESEARCH-product.md` re-checked against today's code

| ig5 claim | Today | Evidence at `9cb3bc8` |
|---|---|---|
| Starter is $49/mo in both lists | **holds** | `lib/site.ts:1685` (TIERS starter `monthly: 49`); `types/index.ts:594` |
| The menu prints "Plans from $49 a month" | **holds** | `lib/site.ts:2290` |
| $490 a year | **holds** | `types/index.ts:595` |
| Minutes and overage disagree: 400 vs 150, $0.20 vs $0.25 | **still disagree** | `lib/site.ts:1685` vs `types/index.ts:596-597` |
| OWNER note: "Checkout must match this list before launch" | **still open** | `lib/site.ts:1678-1682` |
| Starter: no recordings, no Google, no cloning. SMS, outbound calls and overage are on; 10 test calls a day | **holds** | `lib/billing/entitlements.ts:42-53` |
| Trial: 5 min, 14 days, no overage, no SMS, 5 test calls a day | **holds** | `types/index.ts:578-591`; `entitlements.ts:27-40` |
| Block rule: trial expired, minutes gone, not onboarded | **holds** | `entitlements.ts:115-127` |
| Starter perks: answers from your documents, transcripts, texts, outbound calls, keeps answering past the minutes | **holds** | `lib/pages/home/pricing.ts:63-76` |
| No setup fee, cancel whenever, number at carrier cost | **holds** | `pricing.ts:240-247` |
| "24/7 priority support" is an owner promise with no backing; no support email | **holds** | `pricing.ts:54-61, 102`; `lib/site.ts:70-79` (`email: ""`) |
| Number $1.15/mo, its own subscription | **holds** | `lib/phone/pricing.ts:6`; `site.ts:1932`; `pricing.ts:189` |
| 21 countries; not RO, DE, FR, ES, IT, NL or PL | **holds** | `lib/twilio/countries.ts:14-36` |
| 14 languages | **holds** | `lib/agent-languages.ts:6-21` |
| One language per agent; it does not switch | **holds** | `lib/voice/prompt.ts:255` ("Always speak {language}, even when the caller … use[s] another language") |
| Tells callers it is an AI, with no off switch | **holds** | `prompt.ts:265`; `lib/voice/greetings.ts:13-15` (custom greetings get it added); `site.ts:2527` |
| "Never invent prices…" is a prompt instruction, not a guarantee | **holds** | `prompt.ts:266`; Terms §10 `app/(legal)/terms/page.tsx:122-126` |
| Takes messages on every plan; transfer only with conditions | **holds** | `lib/voice/session-loader.ts:239-240`; FAQ `site.ts:1895-1896` |
| Caller SMS: Starter and up, conditions, at most 2 per call, links to the business's own site only | **holds** | `session-loader.ts:238`; `lib/voice/tools/sms.ts:13, 19-31` |
| Booking and waitlist are gated on `googleIntegrations` | **holds** | `lib/voice/tools/calendar.ts:22-29`; `lib/voice/tools/waitlist.ts:11-12` |
| Always answers unless the owner chose "play a message" outside hours | **holds** | `lib/voice/router.ts:198-224` (ig5 cited `:221`; same logic, the function now ends at 224) |
| "Five free minutes, fourteen days, and no card." | **holds** | `site.ts:1812` |
| The trial answers only you until a number is bought | **holds** | `site.ts:1813` |
| HERO.note "5 free minutes every month" is false | **still live** | `site.ts:123` vs `site.ts:1781-1798` |
| "Ready in under ten minutes" | **holds** | `lib/pages/ai-agents.ts:40`; `components/site/register.tsx:193, 1376-1381` |
| "5 free minutes for 14 days · No card needed" | **holds** | `ai-agents.ts:44` |
| "Four screens, then a test call" | **holds** | `lib/pages/home/start.ts:12` |
| Knowledge base on every plan, trial included | **holds** | `lib/pages/knowledge-base.ts:496-497` |
| "Where your documents stop, it says so" | **holds** | `knowledge-base.ts:362` |
| VAT excluded; minutes rounded up per call | **holds** | `site.ts:1829` |
| No porting; the number sits alongside your line | **holds** | `site.ts:1932` |

Nothing in ig5's SAFE list (S1-S23) or UNSAFE list (U1-U21) has changed status.

---

## 2. New for ig6

### 2.1 "On the first ring" (the only time claim we have)
- **Where the site says it:** `ai-agents.ts:40` ("picks up on the first ring"); `site.ts:713` (`SHELF_CLAIM`); `site.ts:944` ("Answers on the first ring, day or night"); `lib/pages/home/call.ts:17` ("Answered on the first ring — at 3 a.m., on a Sunday, just after closing, in the middle of a rush.").
- **What the code shows:**
  - The router answers the call itself, with TwiML (`router.ts:1-10`; `connectStream` at `lib/twilio/twiml.ts:88-105`).
  - No setting exists anywhere to answer after N rings (grep: `ring_count`, `answer_after`, `rings_before` find nothing).
  - While Twilio waits, the only provider call is `register-call`, with a 3 s timeout (`router.ts:10`).
- **What the site refuses to do:** put a number on it. "The moment this line carries a number it becomes a latency claim the product has never measured" (`site.ts:706-712`).
- **Rule:** "on the first ring" may be said. No seconds may be attached to our pickup or greeting.
  - If the hook uses "One ring, six seconds", that figure describes the **caller's wait at a phone nobody answers**, not our speed.
  - Don't write "it answers within six seconds" or "before the second ring", and don't build a picture that implies either: for example, a timer stopping at a figure when the agent picks up.

### 2.2 Forwarding and overflow: not a feature
- A grep for `forward` / `call forwarding` across `app`, `components` and `lib` finds **zero** product hits.
- The agent answers calls to **its own number**, bought separately, which "sits alongside your current line rather than replacing it" (`site.ts:1932`).
- **Fine to show:** a phone rings, the agent picks up (one call, answered by the agent).
- **Not fine to show or say:**
  - the owner's existing phone ringing out, then the AI taking the same call over
  - "after the fourth ring it takes over"
  - "when your line is busy"
  - "forwards your missed calls"
  - "on your existing number" / "keep your number"
- Flag: `lib/pages/industries/restaurants.ts:267` says "It picks up on the fourth ring, or when the line is engaged". That is not backed by the product. Do not reuse it.

### 2.3 Simultaneous calls: unverified
- `router.ts` has no per-business cap on concurrent calls. But the voice providers' capacity cannot be read from the repo, and it has never been tested in public copy.
- `lib/pages/industries/financial-services.ts:68, 224` ("answers every line at once") is **unverified**.
- **Unsafe:** "answers ten calls at once", "never a busy tone", "never on hold".

### 2.4 Why the absolutes fail (refusal paths in the code)
- **Trial expired, or its 5 minutes used up:** `entitlements.ts:121-125`. Callers "hear that the call can't be taken" (FAQ `site.ts:1946`).
- **Not onboarded:** `entitlements.ts:119`.
- **Agent paused or number inactive:** `router.ts:213-214`.
- **Owner chose "play a message" outside hours:** `router.ts:216-222`.
- **Voice providers failing:** a circuit breaker plus a fallback route. "The worst case is a spoken apology", or the caller is handed to the on-call contact (`router.ts:9`; `app/api/telephony/fallback/route.ts:6-8`; `lib/voice/breaker.ts:5-25`). The code even has a `call_missed` workflow for refused calls (`fallback/route.ts:12`).
- **The paperwork:** no SLA document exists (`site.ts:1709-1710`). Terms §10: "We do not guarantee that the Service will be uninterrupted" (`terms/page.tsx:122-126`).

So "never misses a call", "100 % of calls answered", "zero missed calls" and "every call, guaranteed" are **false as guarantees**.

### 2.5 "24/7"
- **True by default** on a paid plan with a number (`router.ts:198-224`).
- **But the site avoids it:**
  - It removed its own "24/7, <1s, 100%, 10min" badge band as unsourced numbers (`site.ts:660-662`).
  - It says "day or night" instead (`site.ts:944`).
  - There is no uptime SLA.
- **Verdict:**
  - On screen, use **"Day or night"** or **"At 3 a.m., on a Sunday"**.
  - "24/7" is allowed only in the caption, about answering hours.
  - Never use it next to the trial.
  - Never write "24/7 support", "365", "always on" or "100 % uptime".

### 2.6 Messages reach the team on every plan
- `take_message` is on for every plan (`session-loader.ts:240`).
- The team gets the message by text or email, per each contact's settings, with a fallback to the owner's email. It also lands in the Inbox (`lib/voice/tools/messages.ts:48-80`; `lib/notifications/index.ts:13-15, 81-138`).
- Team alerts have **no plan gate**: they are not the caller-facing SMS. So "Your team gets the message" is safe even for the trial.

### 2.7 Texts to the caller are paid only
- Starter and up (`entitlements.ts:48`; the trial is `false` at `:34`).
- **Conditions:** the SMS switch is on, the number is SMS-capable, the caller's number is known, at most 2 texts per call (`sms.ts:13, 19-31`).
- Never on or next to a trial line. Never call it a booking confirmation.

### 2.8 Test calls are free, so "Ring it yourself" is a true CTA
- The trial allows 5 test calls a day (`entitlements.ts:39`).
- Test calls are not billed: `is_test` is excluded from usage (`lib/billing/usage.ts:623`), and workflows skip them (`lib/voice/post-call.ts:916`).
- The site's own sentence: "test calls run on the real agent and never touch the five minutes" (`site.ts:1813`).

### 2.9 Buying a number is not plan-gated, but it needs a card
- The phone checkout has no plan check. It starts a separate Stripe subscription (`app/api/phone/checkout/route.ts:13-18, 35-40`).
- So say "answering real callers needs a number ($1.15/mo, card)". Do **not** say "needs a paid plan".

### 2.10 Languages
- **Exact labels** (`agent-languages.ts:6-21`): English, Romanian, Spanish, French, German, Italian, Portuguese, Polish, Dutch, Japanese, Korean, Chinese (Mandarin), Arabic, Hindi.
- **One per agent.** Never show the agent switching mid-call.
- **Greetings shown on screen must disclose.** Every real greeting carries the AI disclosure. If a reel shows a greeting in another language, include that language's disclosure, word for word from `AI_DISCLOSURE` (`greetings.ts:22-`). A greeting shown without it misrepresents the product.
- **No local-number hints.** Numbers are not sold in RO, ES, FR, DE, IT, NL or PL, so a language card must not imply a local number there (no "a Madrid number").
- **Site inconsistency to flag:** the register demo says "nine languages" (`register.tsx:186`). That is the demo's own greeting set. The product number is **14**.

### 2.11 `voice.md` says "every call answered"; the site does not
- `.claude/instagram/voice.md` lists "every call answered" among the words we use.
- `lib/pages/home/call.ts:14-17` dropped that absolute deliberately, because trial minutes run out.
- The product page still has "AI voice agents that answer every call" (`ai-agents.ts:39`).
- Verdict in §5 (U2) and §4 (C5).

### 2.12 Statistics
- Product truth adds **no figure on our side**: no answer rate, no speed, no "X % more bookings", no "calls saved".
- **The only numbers the product supports:**
  - 14 languages
  - under ten minutes
  - 5 free minutes
  - 14 days
  - $49 (only if a price is used)
  - $1.15 (fine print)
- The site's cited third-party figures (`site.ts:716-811`, `WHY_SOURCES`) are graded in RESEARCH-viral §5. The MIT and HBR studies measured how fast companies respond to **web leads**, not inbound calls. 411 Locals is weak.

---

## 3. SAFE lines (on screen + Tessa VO)

Set in the reference's two tiers: **Big** (heavy grotesk) / *accent italic serif*. Tessa can say each one as written; numbers are spoken as words.

| # | On screen (big / *serif*) | VO | Source | Condition |
|---|---|---|---|---|
| S1 | Answered / *on the first ring.* | "Answered on the first ring." | `ai-agents.ts:40`; `site.ts:713, 944`; `call.ts:17` | B. No number on our side (§2.1). Real callers need a bought number |
| S2 | At 3 a.m. / *on a Sunday.* | "At 3 a.m. On a Sunday." | `call.ts:17, 24-29` | Default always-answer (`router.ts:198-224`) |
| S3 | Closed is for the door, / *not the phone.* | as written | `voice.md`; `call.ts:40` | Same as S2 |
| S4 | Day / *or night.* | "It picks up, day or night." | `site.ts:944`; `router.ts:198-224` | Same as S2 |
| S5 | Write your answers / *once.* | as written | knowledge base on every plan (`knowledge-base.ts:496-497`) | none |
| S6 | It answers / *from your words.* | "It answers from your own documents." | `pricing.ts:67`; `session-loader.ts:236` | none |
| S7 | If it isn't written, / *it says so.* | as written | `knowledge-base.ts:362`; `prompt.ts:266` | An instruction, not a guarantee. Never "never wrong" |
| S8 | It takes / *the message.* | "It takes a message." | `session-loader.ts:240` | none |
| S9 | Your team / *gets the message.* | as written | `messages.ts:48-80`; `notifications/index.ts:81-138` | Text or email plus the Inbox. Not "instantly" |
| S10 | Puts callers through / *to your people.* | as written | FAQ `site.ts:1896` | People you listed; a live phone line; a blind transfer |
| S11 | Every caller hears / *it's an AI.* | as written | `prompt.ts:265`; `greetings.ts:13-15`; `site.ts:2527` | none |
| S12 | Every call / *written down.* | as written | `ai-agents.ts:40`; `pricing.ts:68-71` | Transcripts, not recordings |
| S13 | Fourteen / *languages.* | "Pick from fourteen languages." or "Fluent in fourteen languages." | `agent-languages.ts:6-21`; `ai-agents.ts:40` | One per agent; no switching shown |
| S14 | Ready in / *under ten minutes.* | as written | `ai-agents.ts:40`; `register.tsx:193` | Never "five minutes" |
| S15 | Five free minutes. / *Fourteen days.* | as written | `site.ts:1812`; `ai-agents.ts:44` | Trial only |
| S16 | No card / *needed.* | as written | `ai-agents.ts:44`; `app/(auth)/register/page.tsx:21` | Trial only |
| S17 | Ring it / *yourself.* | "Ring it yourself." | `site.ts:1813`; `entitlements.ts:39`; `usage.ts:623` | Trial test calls, 5 a day |
| S18 | Start / *free.* | as written | `site.ts:1814` (the site's CTA) | none |
| S19 | Because / *every second* | the reference's own fragment | none (not a product claim) | Safe as a sentence that spans cuts |
| S20 | Every second it rings, / *someone's waiting.* | as written | true by definition | Says nothing about us |
| S21 | A missed call is / *someone else's customer.* | as written | `voice.md` position 1 | An opinion. Never add a % |
| S22 | Your AI / *receptionist.* | as a noun | series wording (ig4, ig5); `voice.md` "The ask" | Never with "replace", "fire" or "instead of" (ig1) |

---

## 4. CONDITIONAL lines (only as worded, and only when the condition holds)

| # | Line | Condition |
|---|---|---|
| C1 | "From $49 a month." | Only if the owner asks for a price. Paste ig5 §5.3's fine print into the caption, and then show **no booking or calendar anywhere**. Never "all-in". **Not recommended for ig6.** |
| C2 | "Texts your caller the details." | Paid plans only (§2.7). Never on or next to a trial line. Never "booking confirmation". |
| C3 | "24/7" | Caption only, about answering hours on a paid plan with a number. On screen, use S4 (§2.5). |
| C4 | "Set up in minutes." | A looser true line (`ai-agents.ts:35`). S14 is stronger. |
| C5 | "Answers every call" | The product page's wording (`ai-agents.ts:39`), but the home page dropped it (`call.ts:14-17`). Allowed only scoped, so that it is not a guarantee: "Every call it takes, written down." Don't use it bare. |
| C6 | Booking (any calendar picture, "Booked", a booking text) | Pro (beta) with Google Calendar only. If shown at all: a visible "Pro" tag, and no price in the reel or the caption. **Recommended: leave it out.** If the owner ships booking on Starter before posting, re-verify that `entitlements.ts:43` is `true` and that `pricing.ts:91` and `lib/pages/home/gates.ts:15` moved too, then re-cut. |
| C7 | A greeting shown in another language | It must include that language's AI disclosure (`greetings.ts:22-`) (§2.10). |
| C8 | A third-party statistic | Only from RESEARCH-viral §5.1, with the source on screen or in the caption. Never relabel web leads as callers. |

---

## 5. UNSAFE lines (never in the reel, the VO or the caption)

| # | Line / idea | Why |
|---|---|---|
| U1 | "Never miss a call", "never miss another call", "you'll never miss a call again" | An absolute. The code has refusal paths, and the Terms disclaim uninterrupted service (§2.4) |
| U2 | "Every call answered." as a bare headline; "100 % of calls"; "zero missed calls"; "every call, guaranteed" | Same as U1. The home page dropped it (`call.ts:14-17`) |
| U3 | Any figure for our speed: "answers in 1 second", "<1 s", "0.5 s", "before the second ring", "instantly", "zero wait", "no hold time" | Never measured (`site.ts:706-712`) |
| U4 | "Answers 10 / 100 calls at once", "never a busy tone", "never on hold", "every line at once" | Unverified (§2.3) |
| U5 | A takeover picture or line: the owner's phone rings N times, then the AI takes it; "when your line is busy"; "forwards missed calls"; "on your existing number"; "keep your number" | No forwarding, no overflow, no porting (§2.2) |
| U6 | "24/7 support", "a real person around the clock", "email support" | Unbacked (`pricing.ts:54-61`; `site.ts:70-79`) |
| U7 | "Every language", "any language", "speaks your caller's language", "switches language mid-call", "all 14 at once" | One language per agent (`prompt.ts:255`) |
| U8 | "Set up in 5 minutes", "deployed in 5 minutes", "in seconds", "instant setup" | The site says under ten minutes |
| U9 | "5 free minutes every month" | False (`site.ts:123` vs `:1781-1798`) |
| U10 | "Start free and it answers your customers today" | The trial has no number until a card buys one (`site.ts:1813`) |
| U11 | "Books appointments", "Booked ✓", a calendar UI, reminders, waitlist, booking texts | Pro (beta) only. Never next to $49 (see C6) |
| U12 | "Records every call" | Recordings are Pro (`entitlements.ts:42`) |
| U13 | "Never wrong", "always accurate", "knows everything about your business" | A prompt instruction, not a guarantee; Terms §10 |
| U14 | "Learns from every call", "gets smarter every call", "remembers your callers" | "It does not learn from calls on its own" (FAQ `site.ts:1905`) |
| U15 | "Sounds human", "callers won't know it's AI", "indistinguishable from a person" | It discloses that it is an AI on every call (`prompt.ts:265`; `greetings.ts:13-15`) |
| U16 | "Replace / fire your receptionist", "instead of staff", "no more receptionist" | Series coherence (ig1) and truth |
| U17 | Invented outcomes: "X % more bookings", "saves you $X", "calls saved", "trusted by N businesses", testimonials | `voice.md` off limits; no customer results exist |
| U18 | Minute counts, the overage rate, other tiers' prices, "unlimited", "$49 all-in" | The two price lists disagree (ig5 U1-U4) |
| U19 | "Clone your voice", "answers in your voice" | Pro (`entitlements.ts:47`) |
| U20 | Numbers in RO, DE, FR, ES, IT, NL or PL; "a local number anywhere" | `countries.ts:14-36` |
| U21 | Any competitor name or logo | `voice.md` |

---

## 6. Ruling on "every second" and "every call"

- **"Every second" describes the caller's side.** S19 and S20 are true by definition. With a cited standard (RESEARCH-viral F1), "one ring, six seconds" is also fine, scoped to North America in the caption.
- **Our side gets S1, "on the first ring", and no number.** Don't juxtapose S1 with a measured figure as if it were our latency (§2.1).
- **"Every" only where it is literally true:**
  - every caller hears it's an AI (S11)
  - every call it takes is written down (S12)
  - the knowledge base comes with every plan (S5)
- **Never** "every call answered" bare, "every language", or "never miss".
- **Safe structure for the reference's big line:** "Because / *every second*" (S19), then the payoff "Answered / *on the first ring.*" (S1).

---

## 7. End card and CTA

- **Keep the shared `IgEnd`** (`src/ig/components/End.tsx`, the ig1-ig5 choreography):
  - the CTA caption
  - the comment field typing AGENT
  - the impact
  - the **NEUROVOICE** wordmark
  - `neurotechvoice.com` typed on "Neuro | Tech | Voice"
  - Tessa's "Neuro Tech Voice."
  - No price, no "Start free" button (series rule), no booking.
- **CTA words:** **"Comment AGENT for the link."** (Tessa, ig5-07 style).
  - Style-native option, a type change only: big "Comment" in the heavy grotesk + "*AGENT*" in the accent italic serif, with Tessa's full line as the small grey caption tier, as in the reference.
- **What AGENT must deliver** (that is what makes the CTA true):
  - the free-trial link (5 minutes, 14 days, no card)
  - the offer to help set up the knowledge base (`voice.md` "The ask")
  - If nobody can answer the DMs on posting day, use the bio variant "The link's in our bio." (ig5-07-bio).
- **TikTok:**
  - TikTok has no keyword auto-DM, and its profile link is `linktr.ee/neurotechvoice` (`profile.md:35-36`).
  - Keep one master. Let the TikTok caption carry "Link in bio. Start free: 5 minutes, 14 days, no card."
- **Optional last product line before the CTA:** S17 "Ring it yourself." or S15 + S16 "Five free minutes. Fourteen days. No card needed."
  - S17 fits the "first ring" theme and is literally what the trial offers.
- **URL:** keep the series' `neurotechvoice.com`. `voice.md` says `www.neurotechvoice.com`; changing the shared card would re-render ig1-ig5.

---

## 8. Caption fine print (paste-ready, no em dashes)

Standard (no price, no booking):
> Free trial: 5 minutes over 14 days, no card needed. On the trial it answers your own test calls; to answer customers, the agent needs its own phone number ($1.15/month, card required). One agent per business, set to one of 14 languages. It tells every caller it's an AI.

Add only if the reel shows texts to callers:
> Texts to callers start on paid plans.

If the owner forces a price, use ig5 `RESEARCH-product.md` §5.3 word for word, and show no booking.

If the hook uses the ring cadence (RESEARCH-viral F1):
> One ring = 2 s of tone + 4 s of silence, the North American standard (ANSI T1.401).

---

## 9. Open items for the owner (none block ig6 if §3-§5 are followed)

1. **Booking on Starter is not shipped:** `entitlements.ts:43` is `false`; `pricing.ts:91` lists Google Workspace under Pro; `gates.ts:15`. ig6 avoids booking, so it does not wait on this.
2. **`restaurants.ts:267`** implies forwarding "on the fourth ring, or when the line is engaged". The product has no such feature.
3. **`financial-services.ts:68, 224`** "answers every line at once" is an unverified concurrency claim.
4. **The home hero:**
   - `site.ts:123` still says "5 free minutes every month".
   - `site.ts:120` says it "books your customers automatically … live on your business number in minutes". Booking is Pro, and "your business number" conflicts with no porting.
5. **`register.tsx:186`** says "nine languages"; the agent has 14.
6. **`voice.md`** lists "every call answered" as house wording; the site dropped that absolute. Suggest replacing it with "answered on the first ring" or "every call written down".
7. **Stripe:** confirm the live Starter price is $49.00 (carried over from ig5; only relevant if C1 is used).
