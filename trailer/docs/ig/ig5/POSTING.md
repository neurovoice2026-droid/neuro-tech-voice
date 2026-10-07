# ig5 · "Three rings" (POSTING)

Label `synth`. Written 2026-10-07 for TikTok @neuro.tech.voice (posted first) and Instagram @neurotechvoice. The reel is described in `SCRIPT.md`; this file is everything that goes around it.

**Hook swap (label `hook-swap`, 2026-10-07):** the reel now opens on "Three rings. Gloves on. You can't." (`HOOKS.md` §1; the incumbent "Don't pay $300 a month" is the reserve, SCRIPT §4.5). Only the lines that named the hook or its timing changed here: the covers (§3, §4), the search note (§3), the alt text (§4), the payoff time (§8) and the next A/B (§8). The captions, pinned comments, DM and replies carry no hook words and are unchanged. The file names keep the slug `dont-pay-300`.

All copy is in English with no em dashes. Every figure traces to `SCRIPT.md` §6. No provider is named anywhere. "$49" always comes with "a month" and the fine print (Starter plan fee, USD, excl. VAT, $1.15 a month for the number, minutes past the allowance billed). The checks run on every text are in §9.

---

## 0. LAUNCH GATE (blocking: do not post until every box is ticked)

The reel says and shows that the $49 plan **books the appointment**. Today that is false (`lib/billing/entitlements.ts:43` starter `googleIntegrations: false` makes `bookingGate` refuse, `lib/voice/tools/calendar.ts:22-29`; `lib/pages/home/pricing.ts:91` lists Calendar under Pro). The owner decided on 2026-10-07 to include calendar booking in the $49 plan ("O fac eu modificarea, tu fa reelul").

- [ ] **1. Booking works on Starter in the product.** Test: a fresh Starter account with Google Calendar connected books a real test call end to end, and the call shows **Booked** in the dashboard.
- [ ] **2. The pricing page says so.** The Starter card lists calendar booking; `lib/pages/home/pricing.ts:91` no longer puts Calendar under Pro only; `lib/pages/ai-agents.ts:40` no longer says "booking into Google Calendar on ${CALENDAR_PLAN} and above" with Pro as the plan.
- [ ] **3. The live Stripe Starter price is $49.00 USD a month** (`STRIPE_STARTER_PRICE_ID`; the repo can't show it).
- [ ] **4. The trial still doesn't book** (trial `googleIntegrations: false`, `entitlements.ts:27-29`). Both captions and the DM say so. If the owner turns booking on for the trial too, delete "and doesn't book" / "The trial doesn't book." everywhere.
- [ ] **5. "(in beta)"** stays in the captions and the DM while the app badges booking as beta. If the badge goes, delete "(in beta)" and the `BETA` chip (built since critic round 1: the app's own badge beside **Booked** on the booking master, `BETA` in `src/ig/ig5/stage/Record.tsx`, one switch, then re-render; the message master has none).
- [ ] **6. Re-open by eye** the pages behind the three outside figures (the research fetcher summarised them, and prices change): PATLive https://www.patlive.com/pricing/ ($99, 50 minutes), the Trillet agency guide https://trillet.ai/blogs/voice-agent-pricing-strategy-guide and Ciela https://ciela.ai/blogs/how-much-to-charge-for-ai-voice-agent ($300), Agentpro https://agentpro.ai/resources/ai-voice-agent-vs-answering-service-vs-new-hire-a-cost-comparison-for-small-businesses and Constant Concepts https://constantconcepts.ai/pricing/ (setup). **After the re-check (critic round 2, TRUTH-R2-6), set the date in both captions (§3, §4) and both pinned comments to the re-check date. If any figure moved outside RESEARCH-prices §6, stop and re-cut the reel.**
- [ ] **7. Someone answers AGENT comments on TikTok by hand within the hour** (TikTok has no comment-to-DM automation for us). On Instagram the series comment-to-DM automation is live with keyword AGENT and its own ig5 rule (`utm_campaign=reel_ig5`). If neither can be covered, the reel is rendered with `ig5-07-bio`.

**Strongly recommended in the same pricing edit:** settle Starter's minutes and overage (the site says 400 minutes and $0.20, the app bills 150 minutes and $0.25). The reel never shows them, but it sends viewers to that page, and "how many minutes?" will be the first question. After the change ships, update `.claude/instagram/voice.md:57` and `profile.md:67` ("Calendar booking needs Pro").

**If the booking change is not live but the owner wants to post anyway:** post the message master (`ig5-06-msg`: "…and takes a message.", the record ends on **Message taken**) and use the no-booking captions in §7. Gates 3, 6 and 7 still apply.

**Two masters, rendered together (critic round 1, T1; the steps since critic round 2, TRUTH-R2-2: PIPELINE §6.2).** The render/deliver step renders BOTH cuts, so posting day never needs a re-render and the booking file cannot go up by mistake: `BODY.does = 'ig5-06-msg'` → `neurotechvoice-ig5-dont-pay-300-message-…` (**Message taken**), rendered FIRST, and `BODY.does = 'ig5-06'` → `neurotechvoice-ig5-dont-pay-300-booking-…` (records **Booked** + `BETA`). Each is one id in `src/ig/ig5/timing.ts`, then `sfx:ig5` and `check:audio:ig5` (both pass, BUILD §5.4 and §7). `finish.mjs` writes one fixed name (`<outName>-1080p60-ig.mp4` …), so PIPELINE §6.2 renames each pass's files before the next pass. The **booking** files are posted only after items 1 and 2 above are ticked; until then only the **message** files may go up.

**Owner overrides recorded here:** "$49" on screen and in the captions (the owner asked; voice.md's "no prices on Instagram" is lifted for this figure only); "Starter" named in the caption fine print (profile.md allows only "Pro"; kept because it is the honest pointer to which plan "$49" means). No other price, tier or minute count of ours appears anywhere.

---

## 1. Files and where they go

Built into `trailer/out/ig/deliver/` (PIPELINE §6.2: two passes, the message master first, each pass's files renamed before the next):

| File | What it is | Where |
|---|---|---|
| `neurotechvoice-ig5-dont-pay-300-message-1080p60-ig.mp4` | the **message master** (`ig5-06-msg`: the record ends on **Message taken**): 1080×1920, 60 fps, H.264 L4.2, ≤ 28 MB, −14 LUFS | **Upload this one to TikTok and to Instagram until §0 items 1–2 are ticked.** Neither app plays more than 60 fps. Use the no-booking captions (§7). |
| `neurotechvoice-ig5-dont-pay-300-booking-1080p60-ig.mp4` | the **booking master** (`ig5-06`: **Booked** + `BETA`), same specs | upload this one instead **only after §0 items 1–2 are ticked** (then the captions of §3 / §4) |
| `neurotechvoice-ig5-dont-pay-300-message-1080p120.mp4` | the message master at 120 fps, H.264 L5.1, ≤ 28 MB | archive; other platforms |
| `neurotechvoice-ig5-dont-pay-300-booking-1080p120.mp4` | the booking master at 120 fps, H.264 L5.1, ≤ 28 MB | archive; other platforms, only after §0 items 1–2 |
| `neurotechvoice-ig5-dont-pay-300-cover.png` | 1080×1920 cover, words inside the 3:4 grid crop (the same for both masters) | custom cover on both apps |

**Post the message files until §0 items 1–2 are ticked.** No file without `-message-` or `-booking-` in its name is ever posted.

**Getting it onto the phone:** AirDrop, or send it as a *file* / document (WhatsApp and Messenger recompress anything else). On Instagram: Settings → Data usage and media quality → Upload at highest quality on; Data Saver off; Wi-Fi. On TikTok: if the post screen offers a high-quality upload option, turn it on.

**Original sound name** (both apps, if they let you rename it): "AI receptionist · Neuro Tech Voice". Never an absolute such as "Every call answered".

---

## 2. Posting slot

| Platform | When | Why |
|---|---|---|
| **TikTok (first)** | **Tue 27 Oct 2026, 12:30 New York** (16:30 London, 18:30 Bucharest: the UK and Romania change clocks on Sun 25 Oct, the US on Sun 1 Nov). If the launch gate clears earlier, the first Tuesday or Thursday after it, same time. If it clears later, the first Tuesday or Thursday after it. | The series' Tue/Thu rhythm and lunch-break slot. TikTok is where the reels do better ("Pe tiktok merg mai bine"; ig1 563 views). |
| **Instagram (second)** | **Thu 29 Oct 2026, 12:30 New York**, 48 h after TikTok. If the Instagram schedule in `docs/ig/POSTING.md` §1 has moved, the next free Tuesday or Thursday after the TikTok post. | Never two series reels on the same day on one platform; ig4 is planned for Thu 22 Oct. The 48 h lets the TikTok comments shape the ready replies (§6). |

**Day 0 on both:** reply to every comment in the first hour; send the reel by DM to people who would genuinely want it. On Instagram also share it to Stories with a "Start free" link sticker (`…/register?utm_source=instagram&utm_medium=story&utm_campaign=story_ig5`).

---

## 3. TikTok (post first)

**Cover:** TikTok's feed autoplays from frame 0, which is the hook picture itself (the ringing light, three rings, "Three rings. / Gloves on. / You can't."), so the cover only shows on the profile grid and in search. Upload `…-cover.png` ("Three rings. / Gloves on. / You can't." over "Agency AI receptionist: / commonly $300 a month. / Ours: from $49 a month.", SCRIPT §7: the $300 keeps its hedge on the cover too) if the app offers "upload from photos"; otherwise pick the payoff frame **between 17.4 and 17.6 s (f521–528), never later** (every hedge and "No setup fee." printed, the pile at rest: three quotes and "$49 a month● / No setup fee.", bars to scale; from 17.6 s the pile fades out. Critic round 2 moved everything after the pickup 3 f later, SYNC-B) and add no TikTok text sticker.

**Caption** (1,541 / 2,200 characters; keyword-first line for TikTok search; one ask; 4 hashtags; no link):

```
AI receptionist cost, side by side: an agency build, a live answering service, and ours from $49 a month.

Comment AGENT and we'll send you the link. It's also in our bio.

Where the numbers come from (checked 7 Oct 2026): $300 a month is a common agency retainer for an AI receptionist, and agency setup fees often run around $1,500. $99 a month for 50 minutes is the cheapest 50-minute plan we found among ten US live answering services, which are staffed by people. We read each service's own pricing page, and we don't name them here. We didn't compare self-serve AI receptionist apps, and some of those cost the same as ours or less. The quote slips in the video are illustrative, not real businesses'.

An agency builds and runs it for you. Ours you set up yourself, in under ten minutes. Keep your front desk for the work only people can do: ours picks up when you can't, tells callers it's an AI, answers from the documents you give it, and books the appointment into your calendar. It answers its own number, and you point your calls at it.

Fine print: $49 a month is the Starter plan fee in US dollars, excluding VAT. The phone number is $1.15 a month on top, and minutes past the plan's allowance are billed per minute. No setup fee, cancel anytime. Booking needs Google Calendar connected (in beta; Google Calendar is a trademark of Google LLC). The free trial is 5 minutes over 14 days with no card; it answers only your own test calls and doesn't book.

#AIReceptionist #AnsweringService #SmallBusinessOwner #SmallBusinessTips
```

- **Search:** "AI receptionist cost" opens the caption; "AI receptionist" is also on screen at ≈ 3.1 s (the agency slip's tag AGENCY AI RECEPTIONIST, rising as a unit 2 f before "Agency") and spoken at ≈ 3.9 s, and the cover kicker carries it; "answering service" is spoken at ≈ 9.9 s, in the body and in a hashtag.
- **"It's also in our bio":** the TikTok bio link is https://linktr.ee/neurotechvoice (profile.md). TikTok links in comments aren't clickable, and TikTok may not let us DM a commenter who doesn't follow us.

**Pinned comment** (137 / 150 characters; TikTok caps comments at 150, so the full sources live in the caption; "live" since critic round 1, T6: AI answering services exist at $0-$69, RESEARCH-prices §4, and every other text says "live" or "staffed by people"):

```
Checked 7 Oct 2026: 10 US live answering services, 8 agency pricing sources. Ours: $49/mo Starter plan fee, plus $1.15/mo for the number.
```

**AGENT comments (by hand, within the hour):**
1. Reply to the comment: "Sent you a DM. If it doesn't arrive, the link's in our bio."
2. Send the DM in §5 with the **TikTok** link (`utm_source=tiktok&utm_medium=social&utm_campaign=tt_ig5`). Set our own DM permission so commenters can message us first (Settings → Privacy → Direct messages); TikTok may still block us from messaging someone who doesn't follow us, in which case the comment reply points to the bio.

**Alt text** (if the app offers it): use the Instagram alt text in §4.

---

## 4. Instagram (second)

**Cover:** Edit cover → Add from camera roll → `…-cover.png`. Fallback: frame 0, now a usable cover on its own (the ringing light with its three rings and "Three rings. / Gloves on. / You can't.").

**Caption** (1,354 / 2,200 characters; `caption.py` READY; the 111-character first line lands whole; one ask; 4 hashtags; no link):

```
AI receptionist pricing, side by side: an agency retainer, a live answering service, and ours from $49 a month.

Comment AGENT and we'll DM you the link. 5 free minutes for 14 days, no card.

The numbers, checked on 7 Oct 2026: $300 a month is a common agency retainer for an AI receptionist, and agency setup fees often run around $1,500. The cheapest 50-minute plan we found among ten US live answering services was $99 a month. Those are staffed by people, so it's a different product. Sources are in the pinned comment.

An agency builds and runs it for you; ours you set up yourself, in under ten minutes. Keep your front desk for the work only people can do. Ours picks up when you can't: it tells callers it's an AI, answers from the documents you give it, takes messages and books the appointment into your calendar. It answers its own number, and you point your calls at it when nobody can pick up.

Fine print: $49 a month is the Starter plan fee in US dollars, excluding VAT. The agent's phone number is $1.15 a month on top, and minutes past the plan's allowance are billed per minute. No setup fee, cancel anytime. Booking needs Google Calendar connected (in beta; Google Calendar is a trademark of Google LLC). The free trial answers only your own test calls and doesn't book.

#AIReceptionist #AnsweringService #SmallBusinessOwner #VoiceAI
```

- **Hashtags:** four (the humanizer flags five as a hashtag wall; Instagram's cap is five).
- **Keyword:** AGENT → the DM in §5 via the series comment-to-DM automation, `utm_campaign=reel_ig5`. Meta allows one private reply per comment within 7 days.
- **Reels link:** once live, link ig5 → ig1 with the button text "Why we won't replace your desk". Optionally re-point ig4's link to ig5 ("What it costs").

**Pinned comment** (771 characters; "own published prices" since critic round 2, TRUTH-R2-6: Agentpro's $1,500 / $1,500 is stated in an article on its own site, not on a price page):

```
Sources, read 7 Oct 2026. Agencies: two agencies' own published prices and six published pricing guides. Seven of the eight put the lowest monthly retainer at about $300 or more, and the typical lowest setup fee is $1,500 (some agencies waive it). Agency retainers often add per-minute usage on top, as our plan does past its allowance. Answering services: the pricing pages of ten US providers, all staffed by people. Buying 50 minutes costs $99 or more at every one of them. We didn't compare self-serve AI receptionist apps; some cost the same as ours or less. The quote slips in the video are illustrative, not real businesses'. We don't name providers in our posts. Ours: $49 a month is the Starter plan fee (USD, excl. VAT), plus $1.15 a month for the phone number.
```

**Alt text** (Accessibility → Alt text; 617 characters):

```
Motion-design reel on a pale gradient. A rose phone light rings on a desk, three rings spreading from it. Text: Three rings. Gloves on. You can't. A quote slip rises: agency AI receptionist, commonly $300 a month. A stub is stapled on: setup, often $1,500. A second slip: live answering service, from $99 a month, for 50 minutes. The phone light turns into a teal orb as a third slip rises: Ours? From $49 a month. No setup fee. Text: You set it up yourself. A sample call record turns from Answered to Booked: It picks up when you can't, and books the appointment. Ends: Comment AGENT for the link. Neuro Tech Voice.
```

This alt text matches the cut as placed with the installed takes (trims T1 + T2, SCRIPT §5.4: "commonly $300 a month", "You set it up yourself."). If the full script is ever placed, edit it to "agency AI receptionist, $300 a month, a common retainer" and "You set it up yourself, in under ten minutes."

---

## 5. The DM (one private reply per AGENT comment)

**Instagram** (automation text):

```
Here's your link: https://www.neurotechvoice.com/register?utm_source=instagram&utm_medium=social&utm_campaign=reel_ig5

5 free minutes for 14 days, no card. Four screens set up your agent, then you add your price list and call it from your browser, and those test calls don't use your 5 minutes.

About the $49: it's our Starter plan fee (USD, excl. VAT). Real callers reach the agent on its own number, which is $1.15 a month, and you point your calls at it when you can't pick up. Booking into your calendar is on Starter too (Google Calendar, in beta). The trial doesn't book.

Want a hand? Reply here and I'll help you load your price list and make the first test call.
```

**TikTok** (sent by hand): the same text with the first line

```
Here's your link: https://www.neurotechvoice.com/register?utm_source=tiktok&utm_medium=social&utm_campaign=tt_ig5
```

**Then a person answers.** The owner answers every DM reply the same day (series §5a): the hand-held first setup is the cheapest conversion lever there is.

**No-booking cut:** delete "Booking into your calendar is on Starter too (Google Calendar, in beta). The trial doesn't book."

---

## 6. Ready replies for the comments

Each is ≤ 150 characters (fits TikTok's comment cap) and humanize-clean. Never argue with answering-service staff, never quote our minutes, never name a provider.

| When someone says | Reply |
|---|---|
| An agency builder defends their price | Fair point. An agency builds and runs it for you, and that's worth paying for if you want it. Ours you set up yourself, so there's no setup fee. |
| "X does it for $29" | True, some self-serve AI receptionist apps cost the same as ours or less. This one compares agencies and live answering services. |
| "Is $49 all-in?" | No. $49 a month is the Starter plan fee. The agent's number is $1.15 a month, and minutes past the allowance are billed per minute. No setup fee. |
| "Does $49 really book?" | Starter is $49 a month plus $1.15 for the number. Booking is included once you connect Google Calendar (in beta). The free trial doesn't book. |
| "Does the free trial book?" | Not on the trial. It answers your own test calls: 5 free minutes, 14 days, no card. Booking starts on the $49 plan. |
| "How many minutes?" | Minutes are included, and extra minutes are billed per minute. Send us a DM and we'll give you the current numbers. (Owner answers the DM with the settled figure.) |
| "Can you build it for me?" | Yes, a custom build is quoted on its own. The $49 plan is the do-it-yourself one: you set it up in under ten minutes. |
| "Does it say it's AI?" | Yes. It tells every caller it's an AI, and no setting turns that off. |
| "Answering services are better, they're people" | They're people, and they handle things ours can't. Ours answers from what you wrote down, and when it isn't written, it says so. |
| "Link your sources" | We don't link providers here. Every figure is from the provider's or agency's own public pricing page or guide, read on 7 Oct 2026. |

The "Can you build it for me?" reply matters: RESEARCH-product §6 warns that "agencies charge hundreds" must not make our own custom work sound cheap. Custom builds are quoted separately (`lib/pages/home/pricing.ts:243`).

---

## 7. No-booking captions (use these captions whenever the message master is posted)

**TikTok** (1,433 characters; READY; detect 89.6 PASS): the §3 caption with two edits:
- "…answers from the documents you give it, and books the appointment into your calendar." → "…answers from the documents you give it, and takes a message for your team."
- delete "Booking needs Google Calendar connected (in beta; Google Calendar is a trademark of Google LLC)."

**Instagram** (1,229 characters; READY; detect 78.0 PASS): the §4 caption with two edits:
- "…answers from the documents you give it, takes messages and books the appointment into your calendar." → "…answers from the documents you give it and takes messages for your team."
- delete "Booking needs Google Calendar connected (in beta; Google Calendar is a trademark of Google LLC)."

**Alt text:** "A sample call record turns from Answered to Message taken: It picks up when you can't, and takes a message."

**Ready replies:** drop the "Does $49 really book?" reply; "Booking starts on the $49 plan." becomes "Booking is on Pro and up." only if that is still what the pricing page says.

---

## 8. What to measure

| When | Where | Metric | Read it as |
|---|---|---|---|
| 48 h | TikTok analytics | average watch time; % who watched the full video; the retention graph at 2-3 s and at the payoff ("Ours?" ≈ 14.2 s, "forty-nine" ≈ 15.4 s) | a steep early drop means the hook; a drop before ≈ 14 s means the two anchors run long |
| 48 h | TikTok | views against the account's baseline (ig1 563; the rest 174-283), AGENT comments, profile views, bio-link taps (Linktree analytics) | the "receptionist" hook family should hold its lead |
| 24 h | Instagram Reels Insights | skip rate (3 s) | < 40 % healthy; > 50 % means the first 2 s are broken |
| 72 h | Instagram | sends per reach, saves, AGENT comments per 1,000 reach | the main bet: price tables get sent |
| 72 h | both | comments asking "how many minutes?" | the cost of not showing minutes; the push to settle 150 vs 400 |
| 7 d / 14 d | site, UTM | `tt_ig5` vs `reel_ig5`: sign-ups → agent created → test call → number bought → paid Starter | **the real KPI**: paying users per platform |

**Next step from the numbers** (HOOKS §6): about a week later, post a **new** TikTok re-cut on the same body (never repost the same file): if this post's average watch time is below ig1's, the curiosity hook (HOOKS §3, "Live answering: 50 minutes costs you…"); otherwise the runner-up scene hook `ig5-01c` ("Closed at 9? Your phone's not.", already installed). The reserve is the incumbent `ig5-01` / `ig5-01b` ("Don't pay $300 a month for an AI receptionist." / "Before you pay $300 a month for an AI receptionist.", hookscore 87.0), the cheapest test if the 3-second hold comes in under ig1's. **The reserve may be posted only after its frame-0 card is re-scoped** (critic round 2, TRUTH-R2-3; HOOKS §1.9: as written it ties $300 to the whole category until "agency" arrives at ≈ 4 s, RESEARCH-prices §7 row 2), e.g. "Don't pay an agency $300 a month / for an AI receptionist." with a new take; otherwise prefer `ig5-01c` or the curiosity hook (HOOKS §2–3), which carry no category-wide figure. Measure against ig1 on the same TikTok numbers: 2-second and 3-second hold, average watch time, AGENT comments per 1,000 views. On Instagram, use Trial Reels for that A/B once the account passes about 200 followers.

---

## 9. Checks run (2026-10-07, `python3 -I` from a scratch folder; skills untouched)

| Text | `caption.py` | `detect.py` | `humanize.py` |
|---|---|---|---|
| TikTok caption | READY (1,541 chars; 105-char first line lands whole; 2/2 search terms in the visible window; 1 ask; 4 tags) | **87.5 PASS** | nothing to strip |
| Instagram caption | READY (1,354 chars; 111-char first line; 2/2 search terms; 1 ask; 4 tags) | **78.0 PASS** | nothing to strip |
| Instagram pinned comment | | **74.3 PASS** | nothing to strip |
| TikTok pinned comment (137 chars since critic round 1: + "live") | | 62.0, "too short to judge" | nothing to strip |
| DM | | **91.1 PASS** | nothing to strip |
| Ready replies (10) | all ≤ 150 chars | | nothing to strip |
| Alt text | | | nothing to strip (re-run on the hook-swap alt text, 617 chars) |
| No-booking captions | READY / READY | 89.6 / 78.0 PASS | |
