# Instagram reels: posting copy and plan (POSTING)

Label `synth`. Written on 2026-10-06 for @neurotechvoice (14 followers, 1 post).

The reels are described in `docs/ig/SCRIPT.md`; this file is everything that goes around them on Instagram.

All the copy is in English, has no em dashes, and stays true to `docs/ig/RESEARCH-product.md`:
- no price of ours, no statistic, no testimonial;
- "free" only next to things the trial really does;
- booking is named as Pro.

All four captions pass the account's caption linter (`.claude/skills/ig-caption/caption.py`: READY, 5 hashtags, one ask, the first line lands whole) and its humanizer check (`ig-human/detect.py`: PASS, 74–86).

---

## 0. Before reel 01 goes up (blocking)

1. **The comment-to-DM automation is live.** Instagram's own auto-replies cannot do comment-to-DM, so it needs a Meta-approved tool (ManyChat or similar).
   - **Keyword AGENT** on all four reels, with one automation per reel so that each DM link carries its own UTM.
   - Meta allows **one private reply per comment, within 7 days**. The conversation continues only if the person replies, inside 24 h.
   - If the automation is not live on posting day, build the reel with that reel's `*-bio` voice take ("…link in bio"), and reply to every AGENT comment by hand within the hour.
2. **The profile is fixed** (§7). Every reel sends people to the bio, and the bio currently says "every language" and "deployed in 5 minutes". The site says 14 languages and under ten minutes.
3. **For ig4:** ring a real agent loaded with the sample price list using the three phrasings and "Do you do home visits?", with the fallback line "I won't guess. The team will call you back." A reel that invites people to break it must survive the attempt.
4. **Upload settings on the phone:**
   - Settings → Data usage and media quality → **Upload at highest quality** on;
   - Data Saver off; Wi-Fi;
   - move the files to the phone by AirDrop, or as a *file* or document (WhatsApp and Messenger recompress anything else).
5. **Which file to post:** `…-1080p60-ig.mp4` (60 fps, Instagram's published maximum). The `…-1080p120.mp4` file is the 120 fps master you asked for. Posting it also works, but Instagram then picks which frames to keep. Upload the custom cover `…-cover.png` in the composer (Edit cover → Add from camera roll).
6. **Original audio:** if Instagram lets you rename it, use "AI receptionist · Neuro Tech Voice". Never use an absolute such as "Every call answered".
7. **Professional dashboard → Account status:** check "Can your content be recommended?" before the first post.

---

## 1. Schedule, series and pins

| # | Reel | Post (2026) | Time | Cover title | Reels-link button to the next |
|---|---|---|---|---|---|
| 01 | ig1 "Not even ours" | **Tue 13 Oct** | 12:30 New York · 17:30 London · 19:30 Bucharest | "Don't fire your receptionist." | → 02 "Watch it book a call" |
| 02 | ig2 "Booked after hours" | **Thu 15 Oct** | same | "Booked at 9:47 pm." | → 03 "The salon version" |
| 03 | ig3 "Twelve minutes" | **Tue 20 Oct** | same | "Twelve minutes on the colour." | → 04 "Try to trip it up" |
| 04 | ig4 "Can you trip it up?" | **Thu 22 Oct** | same | "Can you trip it up?" | → 01 "Why it won't replace your desk" |

**Days and times:**
- Tuesday and Thursday each week. Buffer's data puts 3–5 posts a week ahead of 1–2, and Friday–Saturday are the weakest days.
- 12:30 US Eastern reaches the US lunch break and the UK and Romanian early evening.
- Clocks change in the UK and Romania on 25 Oct and in the US on 1 Nov. All four dates fall before both changes, so the three local times above hold.
- If the build slips, keep the order and the Tuesday/Thursday rhythm. Never post two of these on the same day.

**Series:**
- Every cover carries the kicker `AI RECEPTIONIST · 0n` (03 adds `· SALONS`), uses the same type, and has the teal orb as its mark.
- The grounds run pearl / night / pearl / pearl, so the grid reads as one designed set.
- The film 1 cut (52 views) stays where it is, unpinned.

**Reels linking:** when the next reel is live, edit the previous one and link it to the new reel with the button text above. After 04, link 04 back to 01. Every reel still closes on its own CTA; there is never a "follow for part 2".

**Pins** (three at most):
- After 02 is live: pin 02 and 01.
- After 04 is live: pin **02 (what it does) · 01 (why) · 04 (try it)**.
- Check the order on the profile and re-pin to fix it.
- Re-pin after week 2, by AGENT comments per 1,000 reach.

**Day 0 for every reel:**
- Share it to Stories with a link sticker "Start free" (`…/register?utm_source=instagram&utm_medium=story&utm_campaign=story_igN`) and add it to the "Start free" Highlight.
- Reply to every comment in the first hour.
- Send the reel by DM to people who would genuinely want it.
- Cross-post 01 and 03 to Facebook Reels (Accounts Center).

**In between** (optional, cheap): one carousel a week made from the reels' stills. Week 1: the week grid (01). Week 2: "four screens to start" (the benched B2, as stills).
- Post film 2's 100 s knowledge-base explainer in **week 3**, not earlier: it competes with 04 on the same feature.

---

## 2. Reel 01 · ig1 "Not even ours"

- **Cover** (custom PNG): kicker `AI RECEPTIONIST · 01` · title **Don't fire your receptionist.** ("fire" in rose) · a thumbnail of the two-colour week grid.
- **Caption:**
```
An AI receptionist shouldn't replace your front desk. It should cover the other 123 hours of the week.

Comment AGENT and we'll DM you the link. 5 free minutes for 14 days, no card.

The arithmetic: a desk open 9 to 6, Monday to Friday, covers 45 of the week's 168 hours. That's an example schedule, so put in your own. For the other 123, an AI voice agent answers on the first ring, takes messages and puts calls through to the people you list. If nobody picks up, the caller is told and your team gets the message.

It tells every caller it's an AI in its first line. Test calls don't use your free minutes. For real callers it answers its own number, bought separately in the dashboard: you point your calls at it when nobody's at the desk.

#AIReceptionist #FrontDesk #SmallBusinessOwner #VoiceAI #MissedCalls
```
- **Hashtags (5):** #AIReceptionist #FrontDesk #SmallBusinessOwner #VoiceAI #MissedCalls
- **Keyword:** AGENT → DM (§5a), `utm_campaign=reel_ig1`.
- **Pinned comment:** "Example schedule: 9 to 6 on weekdays is 45 of the week's 168 hours. How many hours is your phone actually staffed?"
- **Alt text** (if the composer offers Accessibility → Alt text): "Motion-design reel on a pale gradient. Text: Don't fire your receptionist for an AI. Not even ours. A grid of the week's 168 hours fills in: 45 staffed hours in grey, the other 123 in teal, the agent's shift. Cards read Answered, Message taken, Transferred. Ends: Five free minutes, no card. Comment AGENT for the link. Neuro Tech Voice."

---

## 3. Reel 02 · ig2 "Booked after hours"

- **Cover** (custom PNG, night ground): kicker `AI RECEPTIONIST · 02` · the "9:47 pm" lockup with the teal orb as its colon · title **Booked at 9:47 pm.** · a small emerald "Booked" pill with the PRO chip.
- **Caption:**
```
Watch an AI receptionist answer a 9:47 pm call and book it, start to finish.

Comment AGENT and we'll DM you the link.

It says it's an AI in its first line, checks the free times, offers two, takes the caller's name and books the one she picks. The call is filed with a transcript and a summary.

Calendar booking is on the Pro plan and up, with Google Calendar connected (in beta). On the free trial (5 free minutes for 14 days, no card) you can build the agent, hear it answer and have it take messages.

Recreated sample call: you hear the agent's side. Northside Studio, Ava and Maya are made-up names. The voice is our narrator's; your agent's voice is yours to pick from the library. Google Calendar™ is a trademark of Google LLC. Neuro Tech Voice works with it and is not endorsed by Google.

#AIReceptionist #VoiceAI #AppointmentBooking #SmallBusinessTips #AIAgents
```
- **Hashtags (5):** #AIReceptionist #VoiceAI #AppointmentBooking #SmallBusinessTips #AIAgents
- **Keyword:** AGENT → DM (§5a) **plus the Pro line**, `utm_campaign=reel_ig2`.
- **Pinned comment:** "Booking is on Pro and up, with Google Calendar connected (in beta). On the free trial you can build the agent, hear it answer and take messages first. Comment AGENT for the link."
- **Alt text:** "Motion-design reel on a dark night gradient. A clock reads 9:47 pm, its colon a pulsing rose light. Text: Nine forty-seven. You're closed. Watch it book this call. A teal orb answers: Northside Studio, this is Ava, an AI assistant. Saturday morning? I have ten, or eleven-thirty. Ten it is. And your name? Thanks, Maya. You're booked, Saturday at ten. Cards show the booking, marked Pro and Beta. Text: Calendar booking comes with Pro. Comment AGENT for the link. Neuro Tech Voice."

---

## 4. Reel 03 · ig3 "Twelve minutes" (salons)

- **Cover** (custom PNG): kicker `AI RECEPTIONIST · 03 · SALONS` · a colour timer at 12:00 · title **Twelve minutes on the colour.** · the rose phone light top-left.
- **Caption:**
```
An AI receptionist for salons: it takes the call you can't, with 12 minutes on the colour.

Comment AGENT and we'll DM you the link. 5 free minutes for 14 days, no card.

POV: gloves covered in tint, the timer at 11:52, the phone across the room. Someone wants a walk-in trim. Your AI phone agent answers from your own service list (walk-ins Tuesday to Saturday, patch test before colour, opening hours) and every call is written down with a transcript and a summary. Read it when the timer hits zero.

Test calls don't use your free minutes, so try it on your own price list before your next client. For real callers it answers its own number, bought in the dashboard. Point your calls at it when your hands are full. Take them back when they're not.

Sample salon, sample call.

#SalonOwner #AIReceptionist #HairSalon #SalonBusiness #SmallBusinessOwner
```
- **Hashtags (5):** #SalonOwner #AIReceptionist #HairSalon #SalonBusiness #SmallBusinessOwner
- **Keyword:** AGENT → DM (§5a) **plus the routing line**, `utm_campaign=reel_ig3`.
- **Pinned comment:** "How does the call reach it? It answers its own number, bought in the dashboard. You point your calls at it when you can't pick up (for example with your phone provider's call forwarding) and take them back when you can. Porting your current number in isn't supported yet."
- **Alt text:** "Motion-design reel on a pale gradient. A colour timer counts down from 12:00 while a rose light rings in the corner. Text: Twelve minutes on the colour. You can't touch the phone. Pick it up, the colour over-processes. Leave it, she books elsewhere. A teal orb answers: Thanks for calling. This is Ava, an AI assistant. A walk-in trim? You can, Tuesday to Saturday. The timer hits 00:00 as the call ends, marked Answered. Text: Timer's done. Caller's sorted. You never looked up. Try it free on your price list. Comment AGENT. Neuro Tech Voice."

---

## 5. Reel 04 · ig4 "Can you trip it up?"

- **Cover** (custom PNG): kicker `AI RECEPTIONIST · 04` · the price list with three hairlines converging on $85 · title **Can you trip it up?**
- **Caption:**
```
Can you trip up an AI receptionist? Three ways to ask the price, and one question it can't answer.

Comment AGENT and we'll DM you the link, then try it on your own price list. 5 free minutes for 14 days, no card.

Whether a caller says "how much is an hour", "what would a session set me back" or "is the long massage pricey", all three land on the same line of the price list: 60 minutes of sports massage, $85. It matches on meaning, not on words.

Then the curveball. "Do you do home visits?" isn't written down anywhere, so instead of guessing it says the fallback line you wrote for exactly this moment.

Like any AI it can occasionally get something wrong. Test it. Test calls don't use your minutes.

Northside Studio and its price list (sports massage $50 and $85, physio assessment $95) are made up for this reel.

#AIReceptionist #VoiceAI #CustomerService #SmallBusinessTips #AIAgents
```
- **Hashtags (5):** #AIReceptionist #VoiceAI #CustomerService #SmallBusinessTips #AIAgents
- **Keyword:** AGENT → DM (§5a) **plus the challenge line**, `utm_campaign=reel_ig4`.
- **Pinned comment:** "What would you ask it? Reply with your question and we'll put the best ones to it in a reel." Answer the best ones with reply-with-a-reel on the same kit.
- **Alt text:** "Motion-design reel on a pale gradient with a sample price list: sports massage 30 minutes $50, 60 minutes $85, physio assessment $95. Text: Can you trip up this AI receptionist? Three phrasings appear under Asked as: How much is an hour? What would a session set me back? Is the long massage pricey? Each draws a line to the $85 row. A teal orb answers: An hour of sports massage is eighty-five dollars. Then: Do you do home visits? Lines stop short of the documents. The agent answers from its fallback field: I won't guess. The team will call you back. Text: Where your documents stop, it says so. Test it free. Comment AGENT, then try to trip it up. Neuro Tech Voice."

---

## 5a. The DM (one private reply per AGENT comment)

**Base, all four reels.** Change the UTM per reel: `reel_ig1` … `reel_ig4`.
```
Here's your link: https://www.neurotechvoice.com/register?utm_source=instagram&utm_medium=social&utm_campaign=reel_ig1

5 free minutes for 14 days, no card. Four screens to set up your agent. Add your price list, then call it from your browser. Test calls don't use your 5 minutes.

Want a hand? Reply here and I'll help you load your price list and make the first test call.
```

**Added line per reel** (before "Want a hand?"):
- **ig2:** "Calendar booking is on Pro (Google Calendar, in beta). On the trial you can hear it answer and take messages first."
- **ig3:** "For real callers it gets its own number from the dashboard, and you point your calls at it when you're busy."
- **ig4:** "Try your trickiest question on it, then tell me what it said."

**Then a person answers.** The owner answers every reply the same day. For a B2B product with no social proof yet, that hand-held first setup is the cheapest conversion lever there is.

**Honest answers for the comments** (all from the site's own copy):

| Question | Answer |
|---|---|
| Does it say it's AI? | Yes, in its opening line, in the language it's set to speak. No setting turns that off. |
| Can it keep my number? | Not yet. It gets its own local number alongside your current line, in 21 countries (not Romania). |
| How many languages? | 14, one per agent, chosen in a setting. |
| What if it doesn't know? | It says the fallback line you wrote, and the call is transcribed so you can add the answer. |
| What does it cost? | Answer with the free trial and the link. Prices are on the site; don't quote them in comments until the owner confirms the price list. |

---

## 6. What to measure

| When | Metric (Reels Insights / site) | Read it as | Action |
|---|---|---|---|
| 24 h | **Skip rate (3 s)** | < 40 % healthy; > 50 % means the first 2 s are broken | Re-cut the hook as a *new* post later; never repost the same file |
| 24 h | Views and reach vs the account's baseline (52 views), plus the share of non-followers | the reel is leaving the follower bubble | — |
| 72 h | **Average watch time and the retention curve** | a drop *before* the mid-reel payoff (01 ≈ 10 s, 02 ≈ 14 s, 03 ≈ 14.5 s, 04 ≈ 14.6 s) means the pacing is slow; a drop at the CTA is expected | Tighten the beats before the payoff in the next variant |
| 72 h | **Sends per reach**, saves, comments, follows | the signals that drive non-follower reach | The best sends-per-reach format gets the next variant |
| 72 h | **AGENT comments per 1,000 reach**, DM replies, profile visits, bio-link taps | conversion intent | Re-pin by this number after week 2 |
| 7 d / 14 d | **UTM funnel on the site:** sign-ups → agent created → test call → number bought → paid plan | **the real KPI**: one paying account outweighs any view count | — |

**After the first four,** make two more of the format with the best (AGENT comments + sends) per reach:
- if it's 03: the trade variants (dental, trades, restaurant), already drafted;
- if it's 04: reply-with-a-reel to the best comments;
- if it's 01: a second contrarian line from the site's own positions;
- if it's 02: a Pro "reschedule" sequel.

Once Trial Reels unlock (≥ 200 followers by most sources), A/B the first 2 s only on the winning reel.

---

## 7. Profile tweaks (the client decides; each one is true to the site)

| Field | Now | Proposed | Why |
|---|---|---|---|
| **Name** | Neuro Tech Voice | **Neuro Tech Voice \| AI Receptionist** | the name field is searchable; "AI receptionist" is what buyers type |
| **Bio**, option A (118 chars) | "The voice layer for global business. / Every call answered, in every language. / AI agents deployed in 5 minutes - worldwide." | **AI voice agents that answer your business calls. / 14 languages. Ready in under ten minutes. / 5 free minutes, no card ↓** | fixes the three overclaims (every language → 14; 5 minutes → under ten minutes; "every call answered" removed) and adds the offer line |
| **Bio**, option B (143 chars, keeps the brand line) | — | **The voice layer for global business. / AI agents that answer your calls, in 14 languages. / Ready in under ten minutes. 5 free minutes, no card ↓** | — |
| **Link** | www.neurotechvoice.com | `https://www.neurotechvoice.com/register?utm_source=instagram&utm_medium=social&utm_campaign=bio` | sign-ups from Instagram become measurable |
| **Highlights** | none | four, see below | the profile is the landing page |
| **Pinned** | none | 02 · 01 · 04 (§1) | answers what it does, why, and how to try it |

**Highlights.** Covers are 1080×1920 PNGs in the series style: a pearl mesh disc, the teal orb, and one word in Instrument Sans 600.
1. **Start free:** each reel's Story share with the "Start free" link sticker, plus three frames: "Four screens", "Add your price list", "Call it from your browser". Test calls don't use your 5 minutes.
2. **How it works:** stills from 02 (the call → Booked, marked Pro) and 04 (the fallback field).
3. **Languages:** the 14 language names, plus "one language per agent, chosen in a setting".
4. **FAQ:** the first four answers in §5a (AI disclosure, number alongside your line, booking is Pro + Google Calendar beta, the fallback line).

**Housekeeping for the ig-* skills:** `~/.claude/instagram/voice.md` still says "in the caller's language" and "deployed in 5 minutes". Its plan prices also differ from the site and must not be posted. Correct it to "in any of 14 languages, one per agent" and "ready in under ten minutes", so future captions and DMs don't repeat the overclaims.

---

## 8. Files per reel (in `trailer/out/ig/deliver/`)

| File | What it is | Use |
|---|---|---|
| `neurotechvoice-igN-<slug>-1080p60-ig.mp4` | 1080×1920, 60 fps, H.264 L4.2, ≤ 28 MB, −14 LUFS | **post this one** |
| `neurotechvoice-igN-<slug>-1080p120.mp4` | 1080×1920, 120 fps, H.264 L5.1, ≤ 28 MB, −14 LUFS | the master you asked for (archive, other platforms) |
| `neurotechvoice-igN-<slug>-cover.png` | 1080×1920 cover, words inside the 3:4 grid crop | the custom cover |

The slugs are `ig1-not-even-ours`, `ig2-booked-after-hours`, `ig3-twelve-minutes` and `ig4-trip-it-up`.
