# Instagram Reels: growth and conversion research (2025–2026)

Label: `research:reels`. Planning input for the NeuroTechVoice Instagram reels job (3–4 reels, 9:16, 20–30 s, Tessa narrating every on-screen line).
Written 2026-10-06. Web search and fetch **worked** in this session. Every claim carries an evidence tag:

- **[P]** primary source: Instagram, Meta or developer docs, or Adam Mosseri quoted directly.
- **[S]** reputable secondary source (trade press, large-sample industry study).
- **[V]** vendor or creator-blog claim. Directional only, never quote it as fact.
- **[K]** my own knowledge or practitioner consensus. Not verified in this session; treat as a hypothesis to test.

Sources are numbered and listed in §9.

---

## 0. TL;DR for the people building the reels

1. **Design for strangers.** A 14-follower account gets almost all Reels reach from non-followers. For non-followers, the signals that count are **watch time** (whether people get past 3 s, and how much they finish) and **sends per reach** (DM shares) [P1, S2].
2. **Frame 0 must already be working.** Text on screen, motion already moving, sound under way. No fade from black and no logo sting. Instagram now reports **Skip Rate**, the share of viewers who leave within 3 s [S6].
3. **Every reel is 100% original.** That means our own motion design, our own voice and our own sound bed, with no watermark, no letterbox borders and no muted audio. Instagram says it makes watermarked, bordered and muted reels "less visible" [P2]. Since April 2026 it has also cut recommendations for accounts that mostly post other people's work [S3].
4. **Our own audio is a strength.** Business accounts are limited to the Commercial Music Library, and trending songs are mostly off-limits to them [S9]. Reels count as "sound-on" (Meta reports about 80% watched with sound [S10]), so Tessa plus our bed is a good fit. Text is still burned in for the muted minority.
5. **No clickable link exists inside an organic Reel** for a normal business account [S12]. The conversion path has to be: comment keyword → automated DM with the link [P4], plus link in bio, Story link stickers and pinned reels. Every reel ends with **one** honest CTA.
6. **Specs:** 1080×1920, H.264, AAC 48 kHz. Instagram's published Reels spec accepts **23–60 fps** [P3]. A 120 fps file will be re-timed by Instagram, so post a 60 fps derivative alongside the 120 fps master (§2.4). This is the main spec risk to flag to the client.
7. **Grid:** the profile shows a **3:4 centre crop** (1080×1440, y 240–1680) [S7]. Cover text has to fit in **x 60–950, y 240–1520** so it works on both the grid and the feed.
8. **Hashtags:** a hard limit of **5** since Dec 2025 [S13]. Mosseri says hashtags do not drive reach [S14]. Put keywords in the first caption line and in the on-screen text. Professional accounts' public posts have been Google-indexable since 2025-07-10 [S15].

---

## 1. What drives Reels distribution now

### 1.1 Ranking signals

| Signal | What it is | Evidence |
|---|---|---|
| **Watch time** | Total and average time watched, especially past the first ~3 s. Mosseri named it one of the top three signals (Jan 2025). | [S1, S2] |
| **Sends per reach** | Of everyone who saw the post, how many sent it to someone in a DM. Mosseri: *"One of the most important signals we use in ranking is sends per reach"* (Reel of 2024-07-03). Weighted more for **non-follower** reach. | [S2 quoting Mosseri; S1] |
| **Likes per reach** | Weighted more for reach among **existing followers**. | [S1] |
| Saves, comments | Count as engagement, but Instagram's own ranking explainer lists the viewer's activity (liked, saved, reshared, commented) as the first input. | [P2] |
| Reel information | Audio track, visuals, popularity. | [P2] |
| Creator information | Follower count and engagement levels. Instagram says it uses these "to surface content from diverse creators", which leaves small accounts a way in. | [P2] |

**What this means for us:** a reel succeeds if a salon owner **sends it to another business owner** ("this is what I was telling you about"). Write each reel around a moment people want to send on: a pain everyone recognises, a demo that surprises, or a payoff that satisfies.

### 1.2 Things that limit reach

- **Watermarks, borders and muted audio** make a reel "less visible" [P2]. Never export through an app that stamps a watermark. Never post a 16:9 film with black bars; the old film-1 cut-down is a warning here.
- **Originality.** Recommendations go to original content. Low-effort edits, such as a speed change, an added watermark or a screenshot of someone else's post, do not count as original [S3]. Our reels are wholly original, so they are eligible.
- **Recommendation Guidelines.** Reels follow the same rules as Explore (no violence, regulated goods and so on) [P2]. We are fine here.
- Check **Settings → Account Status → "Can your content be recommended?"** before posting. The check exists; whether it shows anything on this account is unverified [K].

### 1.3 Length

- Reels can be up to 3 min (Jan 2025), and long reels can be recommended [S4]. Shorter reels still win on **completion**: practitioner data puts 15–30 s as the sweet spot for engagement and completion [S4, V].
- **For us:** aim for **20–25 s**. Use 30 s only when the demo needs it. Every extra second has to earn its place, because completion is a ratio.
- Since 2025-04-21 the **"Views"** metric counts repeated views by the same person (replays are folded in) [S5]. A clean loop therefore lifts both views and watch time.

### 1.4 The first 1–2 seconds (hook)

- Instagram added **Skip Rate** to Reels Insights in Aug 2025: the share of viewers who scroll away within 3 s. Industry trackers treat under ~30–40% as healthy and over 50% as a broken hook [S6, V].
- **Hook patterns that work for B2B, SaaS and AI tools** [V, K]:
  1. **Pattern interrupt (sound + picture):** a universal sound at 0.0 s, such as a phone ringing or a voicemail beep, over a picture that contradicts it (an empty, dark shop at 23:47). With sound on for about 80% of viewers, the sound is half the hook [S10].
  2. **"You're losing X":** loss framing. Use only a **sourced** number or a framed scenario; never an invented one (see §7).
  3. **Question to the viewer:** "Who answers your phone when you're with a customer?" Name a specific situation, not a generic "Want more leads?"
  4. **POV:** "POV: you're mid-haircut and the phone rings." Identification gets the viewer to stay.
  5. **Before/after:** the same call twice, voicemail versus agent. The contrast is the story.
  6. **Visual payoff tease (open loop):** show the result first ("Booked · Thu 09:30"), then "here's how it got there". Viewers stay to close the loop.
  7. **Demo audio ("listen to this"):** a natural-sounding agent voice is the novelty. The 2018 Google Duplex salon-booking demo set this pattern [K].
- **Hook rules for the house style:**
  - Frame 0 carries the first line of text, already readable. The voice starts within 0.3 s.
  - First line is 7 words or fewer, high contrast, placed in the upper-middle band (y ≈ 300–800).
  - No logo before second 20 or so. The brand appears through the product (orb, panel) and in the CTA.

### 1.5 On-screen text, captions and sound

- **Sound on:** Meta reports about 80% of Reels are watched with sound on, and that ads with music plus voice-over score higher [S10; Meta-reported, cited secondhand]. Design for sound first, but make sure every reel still reads when muted [S10].
- The client's rule, "the woman's voice speaks whenever there is text on screen", lines up with this: **on-screen text = Tessa's words, word-synced**. This is the house kinetic caption from film 2.
- Norms [K]:
  - 1–2 lines on screen at once, at most about 6–8 words.
  - Large type: at least ~64 px cap height at 1080 wide for body captions, and at least ~110 px for hooks.
  - Keep captions out of the bottom UI band.
  - Instagram's optional auto-captions are a viewer setting. They duplicate our burned-in text and cannot be controlled, so ignore them.
- **On-screen keywords:** Instagram is pushing keyword search [S14]. Saying and showing "AI receptionist", "missed calls" and "voice agent" in the reel probably helps topic classification. That is unverified [K], but it costs nothing.

### 1.6 Pacing [K, V]

- For premium motion design in 20–25 s: a **new visual event every ~0.7–1.5 s** (word reveal, card arrival, camera move, colour change) and a **scene or idea change every ~3–5 s**. That gives **5–7 beats** per reel.
- Do not hold a static frame longer than ~1.5 s, except the final CTA. Keep that to ~1.5–2.5 s; long end cards hurt completion.
- Narration density: Tessa at roughly 2.4–2.7 words/s means **45–65 spoken words** for 20–25 s, leaving room for sound beats. This is an estimate; measure it on the real lines.
- Arc for 20–25 s:
  - 0–2 s: hook
  - 2–6 s: stakes or setup
  - 6–18 s: demo or proof (the product doing the thing)
  - 18–23 s: payoff plus CTA, spoken and shown
  - last ~0.5 s: loop seam

### 1.7 Loop endings [K]

- Make the last frame flow back into frame 0. Examples: the phone starts ringing again, the orb returns to its opening position, or the last sentence finishes into the first ("…and that's why — / it's 11:47 pm. Your phone is ringing.").
- Autoplay replays then feel continuous, which pushes average watch time over 100% and counts extra views under the 2025 Views metric [S5].
- The CTA must therefore land **before** the seam, never as a fade to black at the end.

### 1.8 Trending audio vs. original audio for a brand

- Business accounts can only use the **Commercial Music Library**. Trending songs and many trending sounds are not cleared for commercial use, and licensed music gets muted or rejected when a reel is boosted [S9].
- **Use our own bed and Tessa, posted as "Original audio".** It is safe, it survives boosting, and it is unique. If Instagram allows renaming original audio, rename it to something like "Every call answered · NeuroTechVoice". Whether renaming is available is unverified [K].
- Do not chase trends for this account. Original, branded motion design is the differentiator.

---

## 2. Safe zones, specs and encoding

### 2.1 Canvas
1080×1920, 9:16, progressive, constant frame rate [P3, S8].

### 2.2 UI overlays (organic Reels, 1080×1920)

Sources disagree by tens of pixels because the UI changes by device and app version. Use the conservative numbers.

| Zone | Pixels | What sits there | Evidence |
|---|---|---|---|
| Top | **0–220** (some say 250) | status bar, "Reels" header, camera icon | [S8; V] |
| Bottom | **1520–1920** (~400 px; some say 420–450) | username, caption (expands), audio label, nav bar | [S8; V] |
| Right | **x 950–1080 at y ≈ 900–1650** (~100–130 px) | like, comment, share, remix, audio disc | [S8; V] |
| Left | ~60 px margin | edge | [S8] |
| Ads (if ever boosted) | Meta ads guide: keep **14% top (269 px), 35% bottom (672 px), 6% sides (65 px)** free | ad CTA bar | [P5] |

**Text-safe box for all on-screen lines: x 60–950, y 220–1520.**

Keep the main caption block at y ≈ 900–1450 and left-weighted or centred, so it never runs into the right-hand action column.

### 2.3 Profile grid and cover

- Since Jan 2025 the grid shows **3:4 thumbnails** and reels are centre-cropped to **1080×1440**, which is **y 240–1680** of the 9:16 frame [S7].
- The cover can be a frame from the video or a custom uploaded image [S16].
- **Cover text-safe box: x 60–950, y 240–1520.** This is the overlap of the grid crop and the feed UI.
- A grid thumbnail is about a third of the screen width, so cover text needs to be **3–5 words at ≥ 120 px cap height**.
- Design the 4 covers as a **set**: same type system, same grounds, and a numbered series mark. The grid then reads as a landing page (§3.4).
- **Frame 0 is also the default cover and the first impression**, so make frame 0 a designed frame.

### 2.4 Frame rate, the 120 fps question (decision needed)

- Instagram's published Reels spec (Graph API content publishing) says **"Frame rate: 23–60 FPS"**, **H.264 or HEVC**, progressive, closed GOP, 4:2:0, **VBR, 25 Mbps max**, **AAC, 48 kHz max, mono or stereo, 128 kbps**, **MOV/MP4, no edit lists, moov atom at the front**, 3 s to 15 min, 300 MB max [P3].
- The ads guide also says "fixed frame rate" [P5].
- A **120 fps upload is outside the documented range.** In-app uploads are probably still accepted but re-timed to ≤60 fps or 30 fps. What a 120 fps file actually plays at on Instagram is **unverified** [K]; secondary sources agree only on "23–60 fps; 30 is the default" [S8, V].
- **Recommendation:**
  - (a) Keep the **120 fps master** the client asked for (the timeline is 30 fps × 4 sub-frames).
  - (b) Deliver a **60 fps "IG-upload" encode** made by exact 2:1 frame decimation from the same render, so Instagram's re-encoder does not choose the frames.
  - (c) Optionally test both: post one privately or as a trial, then screen-record playback.
  - Explain this to the client in one line: "120 fps is the master; Instagram plays at most 60."
- **H.264 level:** 1080×1920 at 120 fps needs **Level 5.1** (8,160 macroblocks × 120 = 979,200 MB/s, against a 983,040 limit). Level 4.2 tops out at about 64 fps. Some older Android phones may stutter on Level 5.1 playback or sharing [K]. The 60 fps copy fits Level 4.2.

### 2.5 Size, bitrate and upload settings

- **28 MB budget** (decimal; 224 Mbit), with audio at 192 kbps and ~3% container overhead. These are video bitrate targets:

| Length | Video bitrate |
|---|---|
| 20 s | ≈ 10.6 Mbps |
| 25 s | ≈ 8.5 Mbps |
| 30 s | ≈ 7.0 Mbps |

- Use 2-pass VBR, or capped CRF with `maxrate ≈ 1.5×` the target, and check the final byte count.
- Instagram re-encodes anyway, and anything above ~12 Mbps gains nothing visible after its transcode [V]. Sitting at 7–10 Mbps is fine.
- **Gradient-mesh grounds band** at low bitrates. Keep the house **fine grain or dither**, but subtle: heavy grain at 120 fps eats bitrate and Instagram's encoder smears it.
- **Audio:**
  - AAC-LC, 48 kHz, stereo. 128–192 kbps in the file is fine; Instagram's spec says 128 [P3].
  - Loudness: deliver near **−14 LUFS integrated, ≤ −1 dBTP**. This is the common streaming/social target; Instagram does not publish a figure [K].
- **Container:**
  - Use `+faststart` (moov at the front).
  - Avoid MP4 **edit lists**, which the API spec forbids. ffmpeg writes one for AAC priming unless `-use_editlist 0` is set. The pipeline already removed the 2048-sample priming delay; verify there is no `elst` atom.
  - Tag BT.709 colour (already the house standard).
- **Phone upload:**
  - Turn on Instagram **Settings → Data usage and media quality → "Upload at highest quality"**.
  - Turn Data Saver off and use Wi-Fi [S17, V].
  - AirDrop or "send as file" keeps the bytes intact. WhatsApp and Messenger recompress unless the file is sent as a document.

---

## 3. Turning viewers into paying users from 14 followers

### 3.1 The funnel and where links can live
- **There is no clickable link in an organic Reel caption** for a standard business account. Meta is testing caption links only for Meta Verified subscribers, and business accounts were excluded from that test [S12].
- Where links do live:
  1. **Link in bio**: up to 5 links [K]. Use a UTM such as `?utm_source=instagram&utm_medium=social&utm_campaign=reel_<id>` so sign-ups can be attributed.
  2. **Story link sticker**, available to all accounts [K]. Share every reel to Stories with a "Start free" link sticker, and keep a **"Start free" Highlight**.
  3. **DM**, via comment-keyword automation (§3.2).
  4. **Paid boost**: a boosted reel can carry a "Learn more" button to the site. This is the only native clickable path from a Reel without Meta Verified [S12, K]. It is optional, for later, on the best organic performer only.
- **What we can honestly offer**, verified in the repo:
  - **"Five free minutes, fourteen days, and no card."** (`lib/site.ts` `PRICING_TRIAL`)
  - **Test calls run on the real agent and never touch the five minutes.**
  - **A phone number is bought separately**, at $1.15/month (`lib/phone/pricing.ts`).
  - Paying is the goal, so the CTA should get people to **build an agent and call it themselves**. That is the "aha" moment, and the trial makes it free.

### 3.2 Comment-keyword → DM automation
- How it works: viewer comments a keyword ("AGENT") → an automated private reply sends the link plus one line of setup help.
- Meta's API rules [P4]:
  - **One** private reply per comment.
  - It must be sent **within 7 days** of the comment.
  - The conversation can continue only if the user replies, inside the **24-hour messaging window**.
- Instagram's native auto-replies (FAQ, instant reply, away message) **cannot** do comment-keyword to DM. A Meta-approved tool is needed, such as ManyChat or similar [S18, V].
- Why bother: the comment itself is engagement, the DM opens a channel for follow-up, and the link arrives where it can be tapped. Vendors claim 60–80% opt-in or 15–25% lead conversion [V]. Ignore those numbers and measure our own.
- **Spoken and on-screen CTA template:** "Comment **AGENT** and I'll send you the link." Tessa says it while the word is shown. Add the caption line: "Comment AGENT for the link · 5 free minutes, no card."

### 3.3 CTA phrasing rules
- **One** CTA per reel, spoken and shown, landing at about 75–90% of the runtime and before the loop seam.
- Specific, low-friction and true. Rotate between these:
  - "Comment AGENT — I'll DM you the link."
  - "Build yours free — five minutes, no card. Link in bio."
  - "Make one tonight and call it yourself."
- **Do not put feature-gated benefits next to "free":**
  - **Google Calendar booking is Pro-and-above and in beta.**
  - **SMS confirmations are Starter-and-above.**
  - The trial has neither (`lib/billing/entitlements.ts`; `lib/pages/ai-agents.ts` "Books into Google Calendar on {Pro} and above, in beta").
  - A reel that shows "Booked · Thu 09:30" must not say or imply that booking comes with the free trial.
- Avoid an absolute **"every call answered"** next to the trial CTA. The site notes the trial's minutes run out (`lib/pages/home/*`). On paid plans the agent "keeps answering past your minutes" (overage).

### 3.4 Profile as landing page (first 3–9 posts)
- With the existing reel plus 4 new reels, the grid is the first thing a curious viewer sees after tapping the name. Make it answer three questions:
  1. What is it?
  2. Does it sound real?
  3. How do I try it?
- **Pin 3** (Instagram allows up to 3 pinned posts [K]):
  1. The strongest pain + demo reel.
  2. The language or "listen to it" reel.
  3. The "how to try it" or setup reel.
- Re-pin after the first week, according to Insights.
- **Covers as a series:** numbered marks (01–04), the same type system and alternating grounds, so the three-column grid reads as a designed set. Leave the old 52-view reel in place but unpinned. It is probably low-reach because it is a cut from a 77 s cinematic film, with a slow open built for a different medium [K].
- **Bio:** keep the current lines. Add one CTA line ("5 free minutes, no card ↓") and a UTM'd link. Make sure the name field contains a search keyword, for example "Neuro Tech Voice | AI receptionist" [K].
- **Discrepancy to resolve before publishing:** the bio says "AI agents deployed in 5 minutes"; the site FAQ says "under 10 minutes"; `lib/site.ts` says "live on your business number in minutes". In reels, say "in minutes" with no number, or fix the bio.

### 3.5 Series format and Reels linking
- Since 2025-08-21 a creator can **link one reel to the next**. A "Watch part 2"-style button with custom text appears bottom-left of the reel [S11].
- Build the 3–4 reels as one **series** (for example "Your phone, after hours: 01–04"):
  - Link each to the next.
  - Number them on the covers.
  - Close each with the CTA rather than a "Part 2" tease, so each reel still works on its own.
- **Do not make the CTA "follow for part 2".** For this account, paying users matter more than followers.

### 3.6 Cadence and timing
- **Buffer, 2.1 M posts from 102 k accounts (Aug 2025), all formats:**

| Posts per week | Follower growth per week | Reach per post vs 1–2/week |
|---|---|---|
| 1–2 | +0.12% | baseline |
| 3–5 | +0.26% | ~+12% |
| 6–9 | +0.44% | ~+18% |
| 10+ | +0.66% | ~+24% |

  Buffer recommends 3–5 posts a week [S19].
- **Buffer, 9.6 M posts, Jan 2024 to Dec 2025, best slots in local time:**
  - Thursday 09:00, Wednesday 12:00, Wednesday 18:00.
  - Weekday evenings 18:00–23:00 are strong.
  - Fri–Sat are the weakest days [S20].
  - There is no Reels-only cut of the data.
- **Plan:**
  - **Week 1:** Tue (reel 1) → Thu (reel 2).
  - **Week 2:** Tue (reel 3) → Thu (reel 4).
  - In between, 1–2 cheap posts a week: a carousel of stills from a reel, Story shares with a link sticker, and a 7–10 s cut-down with a **different first line**.
  - Post at the **target market's** local time.
  - Reply to every comment in the first hour, and share each reel to Stories and DMs on day 0 [K].
- **Cross-post to Facebook Reels** through Accounts Center. It reaches small-business owners for free [K].

### 3.7 Collab posts
- Up to **5 collaborators** per post. The reel appears on every collaborator's grid, and engagement is shared [S21]. Collaborators can be invited after posting on Reels.
- Honest uses:
  - A real customer business co-posting "our phone after hours".
  - A small-business or AI-tools creator who has actually tried the product.
- **No fake testimonials**, and no presenting a creator as a customer when they are not.

### 3.8 Hashtags and caption SEO
- **Hard limit of 5 hashtags** per post or reel since 2025-12-18; more than 5 will not post [S13].
- Mosseri: hashtags help Instagram understand the topic but are not "a way to get more distribution" [S14].
- Use 3–5 **specific** tags, for example:
  - #AIReceptionist
  - #VoiceAI
  - #MissedCalls
  - #SmallBusinessTips
  - #AIAgents
- Swap one per reel for the vertical, for example #SalonOwner or #DentalPractice.
- **Caption SEO:**
  - The first line, the ~125 visible characters before "more" (approximate [K]), states the keyword and the hook. Example: "AI receptionist that answers after hours — in 14 languages."
  - Then 1–2 lines of value, the CTA line, and the hashtags.
- Public posts from professional accounts (18+) have been **indexable by Google and Bing since 2025-07-10**, captions included. Write captions as small landing pages [S15].

### 3.9 Trial Reels (testing on non-followers)
- What they do: shown **only to non-followers** and not on the grid. Metrics arrive after about 24 h. You can share to followers manually, or auto-share if the reel performs within 72 h [S22].
- **Eligibility is inconsistent across sources:**
  - Help-centre wording, as quoted by secondary sources: professional accounts with **≥ 200 followers**.
  - A June 2025 Meta newsroom post: "available to everyone".
  - Industry blogs: ≥ 1,000 [S22, V].
- At 14 followers it is **probably not available**. Check for the "Trial" toggle in the composer. Once it appears, use Trial reels to A/B **hooks**: same body, different first 2 s.

### 3.10 What to measure (Reels Insights plus site)
- On Instagram:
  - Skip rate (3 s) [S6].
  - Average watch time and the retention curve.
  - Shares (sends) per reach, saves, follows from the reel.
  - Profile visits, bio link taps, keyword comments and DM link clicks.
- On the site: UTM sign-ups → agent created → test call made → number bought → paid plan.
- The real KPI is **paid conversions per reel**, not views.

---

## 4. Examples and formats that performed, and why

| Example | Format | Why it worked | Lesson for us | Evidence |
|---|---|---|---|---|
| **Google Duplex** (Google I/O, May 2018): an AI phones a hair salon and books an appointment, played as raw call audio | "Listen to this call" demo | The human-sounding voice was the surprise; the stakes were a mundane task everyone knows; the payoff was a booking | Hearing the agent handle a real-feeling call, with a concrete outcome, is inherently shareable. Show the transcript as word-synced text | [K] (widely reported; not re-fetched) |
| **Bland AI "Still hiring humans?"** billboard (2024) with a phone number answered by its AI | "Try it yourself" plus provocation | Every call became a live demo, and callers shared their own recordings | Our version is the trial's free test calls: "build one and call it tonight". Do not copy the anti-human provocation; it is a brand risk for an SMB audience | [S23] |
| **Artisan "Stop Hiring Humans"** (2024–25) | Deliberately divisive line | Debate drives comments and shares. Company says >$2 M new ARR and ~1 B impressions; it also says it spent ~$2 M | Tension drives sends, but use **benign** tension ("Closed is for the door, not the phone") rather than outrage | [S23, V] (company-reported) |
| **Sesame voice demo** (early 2025) | People sharing clips of talking to a strikingly natural voice | The novelty of the voice itself | The language-switch reel: the hook is *hearing* it | [K] |
| **AI-receptionist creators and affiliates** ("fire your receptionist for AI" how-tos; SMB pain-point TikToks) | Pain point → tutorial | Targets a specific owner pain (missed calls, scheduling) and gets saved because it teaches | One reel should be a mini how-to ("teach it your price list") | [V] |
| **SaaS motion reels** (UI-animated product reveals, kinetic type) | Clean UI choreography, satisfying cascades | Satisfying motion gets rewatched, and a UI shown doing the job proves it | Our film-2 app panel, cursor and cards are exactly this. Use the after-call cascade (transcript → summary → booking) as a satisfying payoff | [K] |

---

## 5. Product claims safe to use (checked in repo, 2026-10-06)

| Claim | Where |
|---|---|
| **14 languages**: en, ro, es, fr, de, it, pt, pl, nl, ja, ko, zh, ar, hi | `lib/agent-languages.ts` |
| **Knowledge base**: answers from your documents | film 2, `lib/pages/knowledge-base.ts` |
| **Transcript of every call** ("Transcript and sentiment on every call") | `lib/pages/ai-agents.ts` |
| Hands over to a human: transfer, qualify and hand over, take messages | `lib/pages/ai-agents.ts` use cases |
| **Google Calendar booking**: Pro and above, beta | `lib/billing/entitlements.ts` |
| **SMS confirmations**: Starter and above | `lib/billing/entitlements.ts` |
| **Trial**: 5 free minutes, 14 days, no card; test calls are free; number bought separately ($1.15/mo) | `lib/site.ts`, `lib/phone/pricing.ts` |
| **The greeting says it's an AI** ("the sentence saying it's an AI is in every version") | `lib/pages/home/voice.ts` |
| "It answers here, on the first ring." (the site's own claim; no latency number attached) | `lib/site.ts` `SHELF_CLAIM` |

The site's **sourced statistics** (`lib/site.ts` `WHY_SOURCES`, `LEAD_DECAY`) can be used with the source credited in the caption:
- **MIT/InsideSales Lead Response Management study (Oldroyd):** compared with a response inside 5 minutes, the odds of qualifying a lead are **4× lower at 10 minutes** and **21× lower at 30 minutes**. The site itself notes the study was run with a company that sells lead-response software.
- **HBR, "The Short Life of Online Sales Leads" (Mar 2011):** of 2,241 US companies audited, **23% never responded** to web leads.
- **411 Locals small-business call study (85 businesses, 58 industries, 30 days):** only **37.8% of calls were answered by a live person**.
  - The site dates it **2016**; web secondaries say **2024**. Credit it without a year, or verify the year first.
  - It is a vendor study.

**Do not use:**
- Prices on screen (the price lists in `types/index.ts` and `lib/pages/home/pricing.ts` differ; the owner must confirm).
- "$126k lost per year" or any other unsourced revenue figure.
- Customer logos or testimonials.
- "5 minutes" setup as a number (see §3.4).

---

## 6. Production checklist (applies to every reel)

1. Frame 0 is designed: text readable, motion already moving, sound (ring or beep) at 0.0 s, Tessa speaking by 0.3 s.
2. Every on-screen line is spoken by Tessa and word-synced. Any call dialogue shown as text is voiced too (agent or caller voice), so text never appears without speech.
3. All text inside x 60–950, y 220–1520. Cover frame inside x 60–950, y 240–1520.
4. 5–7 beats; nothing static longer than 1.5 s except a CTA hold of 2.5 s or less.
5. One CTA (comment keyword or link in bio), spoken and shown, landing before the loop seam. No free-trial claim next to a gated feature.
6. Loop seam: the last frame flows back into frame 0.
7. Original audio only. No watermark, borders or letterbox.
8. Delivery:
   - 120 fps master: H.264 High, Level 5.1, ≤ 28 MB.
   - 60 fps IG-upload copy: Level 4.2, ≤ 28 MB.
   - Both with AAC 48 kHz, faststart, no `elst`, BT.709, about −14 LUFS and ≤ −1 dBTP.
   - Plus a 1080×1920 cover PNG designed for the 3:4 crop.
9. Posting copy for each reel: first caption line with keyword + hook, CTA line, 3–5 hashtags, the keyword for DM automation, the UTM'd link, and alt text if Instagram offers it.

---

## 7. Hook bank (first line, ≤ 7 words, all true or framed)

- "It's 11:47 pm. Your phone is ringing." (scenario)
- "Who answers when you're with a customer?" (question)
- "POV: your hands are full. It rings." (POV)
- "Same call. Two endings." (before/after)
- "Hola — Bonjour — こんにちは — Hello." (sound pattern interrupt)
- "Booked. At 2 a.m. Nobody was there." (payoff tease; only with a "Pro plan" caption note, since booking is gated)
- "Ten minutes late can cost you 4×." (sourced: MIT/InsideSales; credit it in the caption)
- "It tells every caller it's an AI." (curiosity and debate)

---

## 8. Ranked content angles for NeuroTechVoice reels

The ranking weighs: (a) a hook that stops strangers, (b) the send-ability that drives non-follower reach, (c) how directly it leads to a free agent and then a paid plan, and (d) how well the existing film-2 assets fit (orb, app panel, cards, captions, Tessa).

1. **"After hours" (the 11:47 pm call)**
   - **Hook:** pattern interrupt. A ringing sound at frame 0 over a dark, closed shop with a "23:47" timestamp. Loss aversion: "Your phone is ringing. Nobody's there."
   - **Body:** voicemail beep (what usually happens), rewind, then Ava's orb picks up, answers from the knowledge base and takes a message or hands over. End on the owner's morning summary (transcript).
   - **CTA:** "Comment AGENT."
   - **Why first:** the most universal SMB pain; every owner knows someone to send it to; it uses only ungated features.
   - **Loop:** the phone rings again.

2. **"Same agent, 14 languages"**
   - **Hook:** sound pattern interrupt. The first frame is a caller greeting in a non-English language; the agent answers in kind, and the language flips about every 1.5 s, with each line shown and spoken.
   - **Why:** the most distinctive true claim (14 languages); rewatchable; very sendable ("show this to Maria"); fits the global English audience.
   - **CTA:** "Build yours free — five minutes, no card."

3. **"POV: your hands are full" (trade series)**
   - **Hook:** POV identification, one trade per variant (salon, dental, plumber, restaurant, from the 16 `lib/pages/industries` slugs). The phone rings mid-task, the agent answers the real question (hours, price-list item from the knowledge base) and the owner never looks up.
   - **Why:** ICP-specific, so the right people self-select and convert. Can become a long-running series via Reels linking.
   - **CTA:** link in bio.

4. **"Teach it once" (knowledge base)**
   - **Hook:** visual payoff tease. Open on the agent's correct answer to a tricky question ("Do you take walk-ins on Sunday?"), then rewind to the PDF or price list dropped into the Knowledge tab.
   - **Why:** educational, so people save it. Shows the real app panel from film 2. Answers the buyer's main doubt: "Will it know my business?"
   - **CTA:** "Make one tonight and call it yourself."

5. **"Same call, two endings" (voicemail vs. agent)**
   - **Hook:** before/after split. The same caller twice: left side gets the beep and a hang-up; right side gets the answer, the question solved, and a message or transfer.
   - **Why:** the contrast is instant and works muted; the loop seam is natural.
   - **Optional sourced line:** "In one study of 85 small businesses, only 37.8% of calls reached a person" (credit 411 Locals in the caption).

6. **"After you hang up" (the call receipt)**
   - **Hook:** satisfying UI cascade / ASMR motion. A call ends, then transcript → sentiment → summary → message or hand-over card → (on Pro) calendar event, each card landing on a sound cue.
   - **Why:** rewatchable craft; proves outcomes, not just talk; good as a pinned "what you get" reel.
   - **Honesty:** gate the calendar and SMS cards with a small "Starter / Pro" tag.

7. **"Ten minutes late costs 4×" (speed-to-lead, sourced)**
   - **Hook:** data / "you're losing X" with a real number. The MIT/InsideSales decay curve animates: flat for the first 5 minutes, then 4× worse at 10 minutes and 21× worse at 30. The orb answers on the left edge, at the first ring.
   - **Why:** authoritative and save-worthy for sales-led businesses.
   - **Risk:** data reels skip more often, and the study has a vendor link, so credit it in the caption. Ranked lower for those reasons.

8. **"It tells every caller it's an AI" (trust)**
   - **Hook:** question and curiosity ("Should an AI admit it's an AI? Ours does, every call.").
   - **Body:** the greeting's disclosure line, natural voice, GDPR/EU trust chips from `lib/pages/ai-agents.ts` TRUST.
   - **Why:** sparks comments (debate) and pre-empts the main objection. Best as the 3rd or 4th reel, once the account has some reach.

**Suggested first four (one series, posted Tue/Thu over two weeks):** 1, 2, 3 (salon variant) and 4.

Keep 5, 6 and 7 as follow-ups and Trial-reel hook tests. Each new hook can be A/B-tested on the same body once Trial Reels unlock.

---

## 9. Sources

- [P1] Mosseri's Jan 2025 statements on the top three signals. The primary video was not fetched; the claim is reported secondhand in [S1]. His sends-per-reach quote is in [S2].
- [P2] Instagram, "Instagram Ranking Explained" — https://about.instagram.com/blog/announcements/instagram-ranking-explained
- [P3] Meta for Developers, IG User Media (Reels video specs: 23–60 FPS, H.264/HEVC, AAC 48 kHz, 25 Mbps VBR max, no edit lists, 300 MB) — https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
- [P4] Meta for Developers, Instagram Private Replies (1 reply per comment, 7 days, 24 h window) — https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies/
- [P5] Meta Ads Guide, Instagram Reels ads (safe zones 14% / 35% / 6%; H.264, fixed frame rate, AAC 128 kbps+) — https://www.facebook.com/business/ads-guide/update/video/instagram-reels
- [S1] Dataslayer, Instagram algorithm 2025 (watch time, likes per reach, sends per reach) — https://www.dataslayer.ai/blog/instagram-algorithm-2025-complete-guide-for-marketers ; Fanpage Karma — https://www.fanpagekarma.com/insights/?p=9293
- [S2] Search Engine Journal, "Instagram algorithm shift: why sends matter more than ever" (Mosseri quote, 2024-07-03) — https://www.searchenginejournal.com/instagram-algorithm-shift-why-sends-matter-more-than-ever/521389/
- [S3] TechCrunch, "Instagram restricts reach of content aggregators" (2026-04-30) — https://techcrunch.com/2026/04/30/instagram-restricts-reach-of-content-aggregators-in-new-crackdown/ ; MediaPost — https://mediapost.com/publications/article/414773/instagram-algorithm-update-discourages-reposted-co.html
- [S4] Buffer, Instagram Reels length — https://buffer.com/resources/instagram-reels-length ; Social Media Today (3-minute Reels) — https://www.socialmediatoday.com/news/instagram-reels-tips-3-minutes-unfiltered-nyc/741722/
- [S5] SocialPilot, Instagram Views metric replaces plays/impressions (2025-04-21) — https://www.socialpilot.co/instagram-marketing/instagram-views-metrics-changes
- [S6] Metricool, Reel analytics: retention and skip rate — https://metricool.com/instagram-reel-analytics/ ; Babbleboxx — https://www.babbleboxx.com/post/instagram-adds-reels-retention-skip-rate-what-influencer-marketers-should-do-next
- [S7] Social Samosa, vertical profile grid — https://www.socialsamosa.com/news-2/instagram-updates-profile-grid-vertical-thumbnail-display-8636556 ; Kapwing grid sizes — https://www.kapwing.com/resources/instagrams-new-grid-layout-size-and-dimensions-2025/
- [S8] Hopper HQ, Reel size and safe zones 2026 — https://www.hopperhq.com/blog/instagram-reel-size/ ; TryMyPost safe zones 2026 — https://www.trymypost.com/blog/instagram-reels-safe-zones-2026 ; Argil spec sheet — https://argil.ai/blog/instagram-reel-size-e350f
- [S9] Planoly, commercially licensed vs trending sounds — https://planoly.com/blog/commercially-licensed-vs-trending-sounds-what-can-brands-use
- [S10] Website Builder Expert on Meta's Reels guidance (80% sound-on; audio +15%) — https://www.websitebuilderexpert.com/news/meta-updates-reels-ads-guide/ ; House of Marketers — https://houseofmarketers.com/meta-shares-reels-ad-tips-holiday-season/
- [S11] Influencer Marketing Hub, Reels linking rolls out globally (2025-08-21) — https://influencermarketinghub.com/instagram-reels-linking/ ; iPhone in Canada — https://www.iphoneincanada.ca/2025/08/22/instagram-link-multiple-reels/
- [S12] PPC Land, clickable caption links test (Meta Verified) — https://ppc.land/instagram-tests-clickable-links-in-post-captions-for-meta-verified-users/ ; Inro (Reels links via Meta Verified / boost / DM) — https://www.inro.social/blog/meta-verified-clickable-links
- [S13] Social Samosa, Instagram limits hashtags to five — https://www.socialsamosa.com/news-2/instagram-hashtags-five-per-post-10923075 ; Betanews (2025-12-19) — https://betanews.com/2025/12/19/instagram-puts-a-limit-on-hashtag-usage/
- [S14] Storyboard18 / MeetEdgar, Mosseri on hashtags — https://storyboard18.com/digital/explained-are-hashtags-really-irrelevant-83474.htm ; https://meetedgar.com/blog/are-hashtags-still-relevant
- [S15] PPC Land, Instagram content searchable on Google from 2025-07-10 — https://ppc.land/instagram-content-becomes-searchable-on-google-starting-july-10/
- [S16] Sked Social, Reels cover selection — https://help.skedsocial.com/instagram-reels-cover-selection-now-live.-sked-social-help-center
- [S17] CapCut / RFG Creative, "Upload at highest quality" — https://www.capcut.com/resource/how-to-post-high-quality-reels-on-instagram
- [S18] Inro, Instagram auto-reply native vs automation — https://www.inro.social/blog/how-to-set-instagram-auto-replies
- [S19] Buffer, how often to post (2.1 M posts, Aug 2025) — https://buffer.com/resources/how-often-to-post-on-instagram/
- [S20] Buffer, best time to post (9.6 M posts) — https://buffer.com/resources/when-is-the-best-time-to-post-on-instagram
- [S21] Sked Social, collab posts guide — https://skedsocial.com/blog/instagram-collaboration-feature ; Adobe Express — https://www.adobe.com/express/learn/blog/instagram-collab-posts
- [S22] Inro, Trial Reels — https://inro.social/blog/what-is-a-reel-trial-and-how-does-it-work ; PostEverywhere — https://posteverywhere.ai/blog/what-are-instagram-trial-reels
- [S23] MarketingMonk on Artisan and Bland AI out-of-home — https://www.marketingmonk.so/p/artisan-and-bland-ai-bold-ooh-marketing ; Artisan blog — https://artisan.co/blog/stop-hiring-humans
- Missed-call statistic secondaries (411 Locals; vendor-compiled) — https://getaira.io/blog/missed-business-calls-statistics
