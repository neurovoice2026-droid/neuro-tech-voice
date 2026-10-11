# ig6 · RESEARCH-viral: the "minimal faceless" reel

Label `research:viral`. Written 2026-10-11 on `claude/remotion-trailer`. Planning only: this is the only file written. Nothing committed, no Cartesia call, no skill edited.

**The owner's ask (Romanian, translated):** "I want a clip EXACTLY in this style (instagram.com/reel/Da0DayIpsie). Find a scenario that blows up on social media, for the neurotechvoice platform."

**What this file answers:**
1. What makes this format travel in 2025-2026.
2. Which facts can honestly power an "every second" message.
3. Six scenarios in the style, each with one hero object, a 2-second hook, a loop, a reason to share and a risk. The hooks are scored.

**What I read:** the reference thumbnail; `docs/ig/RESEARCH-reels.md`; `ig5/RESEARCH-format.md`; `ig5/HOOKS.md`; `.claude/instagram/profile.md` and `voice.md`; `lib/site.ts` (`LEAD_DECAY`, `CALL_FATE`, `WHY_SOURCES`, `SHELF_CLAIM`); `lib/agent-languages.ts`; `lib/voice/languages.ts`; `lib/billing/entitlements.ts`; `lib/voice/tools/definitions.ts`; `src/lib/fonts.ts`; `trailer/package.json`.

**What I ran:** `hookscore.py` with `python3 -I` from `scratchpad/ig6r/hs`. There are two columns:
- **raw:** the skill as shipped.
- **patched:** a scratch copy where weak openers match whole words only. This is the "yo" quirk from ig5: raw marks every "You…/Your…" opener down 30 on FRONTLOAD.

Evidence tags (as in RESEARCH-reels.md and ig5):

| Tag | Meaning |
|---|---|
| **[P]** | primary: a platform, a regulator, a standards body, or the study itself |
| **[A]** | peer-reviewed |
| **[S]** | reputable secondary |
| **[V]** | vendor or creator blog; directional only |
| **[K]** | my inference or practitioner consensus; a hypothesis |
| **[R]** | measured or verified in this repo |

---

## 0. TL;DR

1. **What the format is.** One hero object in extreme close-up on pure white, cropped off the frame edge. Black ink plus one accent colour. Two-tier type:
   - a large keyword pair (heavy grotesk + accent italic serif);
   - under it, the full spoken sentence as a small grey caption.

   The motion is a constant slow sweep, punctuated by snappy eased moves and match cuts, all narrated by a voice-over.
2. **Why it travels** (it is not magic, and the reference's reach is inside the motion-design niche):
   - It reads as design, not as an ad, in a feed of faces.
   - It is readable muted.
   - The constant motion holds the eye.
   - A sentence that spans cuts ("Because… every second…") is an open loop the viewer waits to close.
   - It loops cleanly. Instagram counts replays as views, and TikTok gives completion strong weight [P, S].
3. **Keep Tessa on every on-screen line.** The reference is itself voice-led: its small grey line is the narration ("Because every second your audience spends trying to understand your message"). Two-tier type therefore satisfies the owner's rule better than ig1-ig5 did:
   - the big words are a subset of the spoken line;
   - the small caption is the whole spoken line.
   - The only change: allow 1-2 **wordless** motion beats (≤ 1.5 s, SFX only, no text), such as the match cut.

   I found **no reason to cut VO** (§2.3).
4. **Facts.** There is no reputable, primary statistic about how long callers wait or how many hang up. Every "X% hang up / won't call back" figure in circulation traces to a vendor blog or to nothing (§5.3, all **UNUSABLE**). What **is** usable:
   - **The North American ring cadence**, a standard and not a statistic: a 2 s tone, then 4 s of silence, so **one ring = 6 s** (ANSI T1.401-1988 §5.4.2). This lets the clock carry "every second" with **no claim at all**.
   - **Clio Legal Trends Report 2024**, a secret shopper of 500 US law firms: **40 % answered** the phone (56 % in 2019). Law-firm variant only.
   - **NHS GP Patient Survey 2025** (702,837 responses): **52.9 %** found it easy to reach their GP practice by phone. Clinic context only; England.
   - **HBR 2011**, an audit of 2,241 US companies: **23 % never responded** to a web lead. These are web leads, not calls.
5. **Recommendation:**
   - **Lead: S1 "Every second".** The clock is the reference transposed literally. Its hook carries a number and no claim: **"One ring, six seconds. You can't answer."** (84.4 STRONG raw and patched). The keyword "AI receptionist" lands in the caption tier by ~3 s.
   - **TikTok A/B: S2 "Line two"**, "Two calls. Your receptionist can't take both." (84.4). This is the receptionist family, the only hook family that has ever doubled our TikTok views.
   - **Most shareable twist: S4 "Fourteen"**, "Fourteen languages. You only need one." (81.4). It is also exactly true to the code: one language per agent.

---

## 1. The reference, decoded

**What is retrievable.**
- The account is @divyansh.fx_, a motion designer: about 19K followers and 228 comments on this reel (per the orchestrator; the page is login-walled, and a WebFetch of the reel URL returned only "Instagram").
- Caption: "Faceless video edit. Minimal visuals. Maximum impact." Hashtags: #aftereffects #motiondesign #animation #videoediting #explorepage.
- One thumbnail; the video itself is not retrievable.
- With no view count and no account median, this is **not outlier evidence** in the `ig-viral` sense. We copy the **look** because the owner asked for it.

**The thumbnail, element by element** (360×640, scaled ×3 to our 1080×1920):

| Element | What it is | Our translation |
|---|---|---|
| Ground | Pure white, flat. No texture, no gradient. | `#FFFFFF` (or a 1 % warm white), and **no mesh**. This is the biggest departure from ig1-ig5's pearl gradient mesh, and it is the point. |
| Hero object | A giant analogue clock in extreme close-up. Only an arc of the dial shows; the centre is off-frame lower left and the rim leaves the frame upper right. | One object per scene, **cropped**. A partial view reads as scale and invites the eye to complete it [K; Loewenstein's information gap, A4]. |
| Detail | Fine grey minute ticks, longer black 5-minute ticks, and a thin **green arc** with small white-centred dots on it (like progress nodes). | The arc plus the nodes are our **ring dots**: one node per 6 s ring (S1). |
| Hand | One black hand with an ornate diamond tip, a green hub cap with a black ring, and a soft drop shadow down and to the right. It reads as paper cut-out 2.5D. | Hairline geometry, one soft contact shadow (no blur on type), and a teal hub cap that **match-cuts into the orb**. |
| Type, large | "Because" in a heavy black grotesk, then "every second" in a **large green italic serif**, centred near the bottom. | Instrument Sans at weight 700-800 (installed), plus **Cormorant Garamond Italic** (already in `package.json` and `node_modules/@fontsource/cormorant-garamond`, 300-700 italic). `src/lib/fonts.ts` stopped loading Cormorant for film 1, so an ig6-local font loader keeps ig1-ig5 byte-identical. |
| Type, small | A 3-line grey paragraph: "Because every second your audience spends trying to understand your message". | The **caption tier**: Tessa's full line, at about 34-40 px, graphite at 60 %. |
| Accent | One colour (green), used on the arc, the hub and the serif words only. | **Brand teal** (the orb's colour, "ours" in ig5) as the only accent. No rose. |
| Watermark | Faint "@divyansh.fx" stamps. | **Never.** Instagram makes watermarked reels "less visible" (RESEARCH-reels §1.2, P2). |

**Layout warning.** The reference sets its type at y ≈ 1410-1635 (in 1920 terms). That sits **under TikTok's caption block and Instagram's bottom UI** (bottom band 1520-1920). Copying it "exactly" would hide the words.
- Our type block lifts to **y ≈ 1080-1420** inside x 60-940 (profile.md's TikTok zone).
- The hero object takes the upper 55 %, cropped off the top and right edges. The right-edge crop sits above y 900, clear of the action rail.

**Motion grammar** [K, from the style family; the video itself was not seen]:
- **Continuous motion:** the hero object always moves (a sweep or a slow rotation at constant angular speed). That is the "satisfying" layer.
- **Punctuation:** fast exponential in-out moves (8-12 f at 30 fps) on the beat. Words rise through masks, one word per onset, and the accent word comes last.
- **Match cuts:** shape to shape (hub → orb, ring dot → button lamp, dial notch → tick). No wipes, no whip-blur.
- **Camera:** macro push-ins and a rack of scale (1.0 → 0.4 eases back, like ig1's "168" move) to reveal the whole object once, late.
- **Sound:** ticks, clicks, soft swishes and one real-world sound. For us that sound is the phone ring at f0.

---

## 2. Why this format travels (2025-2026)

### 2.1 Platform mechanics it exploits

| Mechanic | Evidence | What the format does with it |
|---|---|---|
| **Completion and watch time** decide non-follower reach. | TikTok: "a strong indicator of interest, such as whether a user finishes watching a longer video from beginning to end, would receive greater weight" [P1]. Instagram: Mosseri names watch time and sends per reach as top signals [S2, via RESEARCH-reels §1.1]. | One idea per beat and constant motion: there is no dead frame to scroll on. |
| **Replays count** | Instagram "Views" folds in repeats since 2025-04-21 [S5]. | A seamless loop (the hand sweeps past 12, the sign flips back) earns a second view at no cost. |
| **Key message early** | TikTok's own ad research: "over 63% of all videos with the highest click-through rate (CTR) highlight their key message or product within the first 3 seconds" [P2]. These are ads, the document is undated, and it is a platform claim. | The keyword pair is on screen at f0 and the full line is spoken by ~2.5 s. |
| **Text overlays** | TikTok: "40% of auction ads with the highest VTR have adopted" concise text overlays [P2]. | The two-tier type *is* the overlay. |
| **Fast tracks** | TikTok: "fast-paced tracks above 120 BPM … often drive higher view-through rate" [P2]. | Our series grid is 120 BPM, so keep it, or nudge the ig6 bed to 124-128. That is a SOUND-stage decision. |
| **Sound-on vs muted** | Meta reports about 80 % of Reels watched with sound [S10, via RESEARCH-reels]. A 2026 vendor round-up claims about 70 % of short-form is watched muted [V1]. The sources conflict. | Design for both: the ring at f0 plus Tessa for sound-on, keyword type for muted. |
| **Originality** | Recommendations favour original content. Watermarks and reposts are demoted [P, S3 via RESEARCH-reels §1.2]. | We render it ourselves, with our own dial design and our own sentence: the **style**, not the reference's frames. |

### 2.2 Style mechanics (why minimal plus one object works)

1. **Pattern break.** A white frame with one object stands out in a feed of faces and dark screens. Practitioner guides call abstract and minimal reels good for complex topics "because they allow viewers to focus purely on the concept" [V2]. Unmeasured, but it fits our case: "an AI answers your phone" is abstract until it is one object.
2. **One accent colour = one thing to remember.** The isolation (von Restorff) effect: the item that differs is remembered better [A5]. Here the teal words are the message, and everything else is black or grey.
3. **Sans/serif-italic contrast** gives each line a built-in emphasis without shouting, which suits voice.md ("calm, precise, warm … never loud or hype") [K].
4. **"Satisfying" continuous motion.** There is no controlled study of looping "oddly satisfying" video. Live Science notes there "aren't any studies" on the genre, and the proposed reasons are order, pattern and repetition, plus mood management [S11]. Treat it as a hypothesis that our retention graph tests.
5. **Sentence-spanning narration** ("Because… every second… your audience spends…"). The clause is incomplete at every cut, so the viewer stays to hear it close. That is the information-gap mechanism [A4] applied to syntax [K].
6. **Comments from the craft community.** 228 comments on a 19K account fits a motion-design audience asking "how / tutorial / which plugin?" [K].
   - **This does not transfer to small-business owners.** The reference spread among designers.
   - For us, the scenario has to carry the relevance (a ringing phone, a closed sign). The comment driver is the AGENT keyword, plus a relatable question (S6).

### 2.3 Voice-over: keep it, change its typography

- **Reasons to cut VO: none found.**
  - The reference's own text is a narration transcript (the small line).
  - The "faceless video" genre that its caption names is narration-led: voice-over plus motion graphics plus kinetic type [V2, V3].
  - TikTok is sound-on by default ("The second you open TikTok, it's a sound-on experience" [P2]).
- **What changes is the layout.** Two tiers, both spoken:
  - **Large:** 1-3 keywords, grotesk + teal italic serif, ≥ 120 px.
  - **Small:** the whole line, 34-40 px, graphite 60 %. It rises word by word on her onsets (the house kinetic caption, shrunk).
- **Wordless beats** (≤ 1.5 s): the match cut and the reveal, with picture and SFX only and no text on screen. This keeps the rule "voice whenever there is text".
- **Pace.** The style wants air.
  - Aim for **45-55 spoken words in 24-26 s**, against ig1's 66 in 26 s.
  - Tessa's measured mean is 2.78 words/s (ig5 [R]), so 50 words ≈ 18 s of speech, leaving ~6-8 s for wordless beats and the end card.
- **Option, if the owner wants the reference's sparseness:** VO on the hook, the "every second" line, the product line and the CTA only. The mid-reel count ("Two. Three.") stays on screen as ring dots, not words.
  - This is a fallback, not the recommendation.
  - It drops roughly 10 words. It also loses the spoken keyword "AI receptionist", which TikTok search reads from speech and captions [K].

### 2.4 B2B and SaaS use of the style

- **[V4] Contra case study (Jul 2026).** A B2B SaaS promo "built almost entirely on kinetic typography", made for the LinkedIn feed and Reels ads and used for lead generation. Self-reported, one project, no numbers.
- **[V3] Freelance market.** Gigs on Upwork and Fiverr sell "Apple-style kinetic typography" SaaS promos in 9:16. This shows that **buyers recognise the style as premium**. It is not proof of reach.
- **[K] The canonical lineage:**
  - Apple product films: macro on a single object, white space, type that carries the claim.
  - Fintech and dev-tool launch films: minimal type plus UI.
  - None was verified in this session. Use them as mood references, not as evidence.
- **No search result showed a white-ground SaaS reel that went viral with public numbers.** I am not claiming one exists.

---

## 3. What we already learned (and what it means here)

| Lesson | Source | For ig6 |
|---|---|---|
| **The "receptionist" hook family wins on TikTok.** ig1, "Don't fire your receptionist.", got 563 views, about 2× everything else (trailer 283, ig2 250, ig4 245, ig3 174). | profile.md | Put **"AI receptionist" in the caption tier by ~3 s** in every concept. S2 tests the family directly. |
| **Scene hooks without a stance have no record.** ig3 ("Twelve minutes on the colour…", 174) and ig2 ("Nine forty-seven. You're closed.", 250) are the floor. | ig5 HOOKS §1.10 | S3 (door sign) is ig2's sibling, so it ranks lower. S1's hook has a number on screen (the drawn ring count) and an early keyword, the two things ig3 lacked. |
| **ig5's hook tournament** picked "Three rings. Gloves on. You can't." (panel 34.92). | ig5 HOOKS §0 | S1's "One ring, six seconds. You can't answer." reuses "You can't". That makes it a series motif (ig5 → ig6), but it risks reading as a repeat. A/B it against the S2 hook. |
| **The scorer can't separate good hooks** (AUC 0.56 between good hooks). | hookscore.py header | Every hook above 80 below is a tie as far as the script can tell. The panel, the truth pass and the retention graph decide. |
| **TikTok-first** layout: text x 60-940, y 220-1440, a searchable keyword in the hook, a TikTok caption, and the 60 fps upload copy. | profile.md | §1 layout warning: the reference's bottom type must move up. |
| **Never "replace / fire your receptionist".** | ig1, brief | S2 keeps the receptionist on line one. The AI is line two, not a replacement. |

---

## 4. Product claims the scenarios lean on (verified 2026-10-11)

| Line | Status | Where |
|---|---|---|
| 14 languages (en ro es fr de it pt pl nl ja ko zh ar hi) | **A**, but **one language per agent**: a setting, with no evidence of mid-call switching | `lib/agent-languages.ts`; `lib/voice/languages.ts` (per-language STT model choice) |
| Takes a message | **A** | `lib/voice/tools/definitions.ts` `take_message`; `session-loader.ts:240` |
| Answers from what you wrote down (knowledge base) | **A** | film 2; `lib/pages/knowledge-base.ts` |
| "Picks up on the first ring" / "Answers on the first ring, day or night" | **B**: site copy, and no latency was ever measured (`lib/site.ts` SHELF_CLAIM comment) | `lib/site.ts:713, 944`; `lib/pages/ai-agents.ts:40` |
| Its own number, next to your line ("line two") | **A**: no porting; the number is a separate purchase | profile.md; `lib/phone/pricing.ts` (no price on screen) |
| Call forwarding or overflow from the business's existing line | **NOT a product feature**: nothing in the code or the site copy | grep of `lib/`, `app/` |
| Calendar booking | **Pro and up only, beta**. Starter `googleIntegrations: false` today | `lib/billing/entitlements.ts` |
| Free trial: 14 days, 5 minutes, no card. Setup "under ten minutes". | **A** | profile.md, voice.md |

---

## 5. Facts for an "every second" message

Rule (binding): any number must come from a reputable cited source with a stated method. Every source below was checked on 2026-10-11. Quotes are verbatim from the fetched page unless marked "via".

### 5.1 USABLE

| # | Fact (exact) | Source and method | Grade | How it may be used |
|---|---|---|---|---|
| F1 | North American ringing: **"2 sec on, 4 sec off, repeating"** ("Ringing (Code 1)"), "defined in ANSI T1.401-1988 section 5.4.2". The ringback the caller hears uses the same 2/4 cadence (440 + 480 Hz). | Zytrax telephony reference quoting ANSI T1.401 [P3]; Wikipedia "Ringing tone" [S12]; IETF draft-roach-voip-ringtone-00 [P4] | **A** (a standard, not a survey) | "One ring, six seconds." "Three rings: eighteen seconds." **US and Canada only.** The European harmonised cadence is "1 sec on, 4 sec off" per the same page (ETSI). The UK differs. Caption: "North American ring cadence (ANSI T1.401): 2 s tone, 4 s pause." Use **rings** as the unit and seconds as the measure. **Never** say when voicemail picks up (see F-U8). |
| F2 | **"Only 40% of firms answered the phone calls,"** down from 56 % in 2019. 48 % neither answered nor called back. | Clio, *Legal Trends Report 2024*. A secret shopper: "a third-party research firm" posed as a potential client; 500 US firms. Quoted via 2civility.org (Illinois Supreme Court Commission on Professionalism) [S13], consistent with Above the Law [S14] and the ABA *Law Practice* magazine (Mar-Apr 2025) [S15]. The Clio page itself returned 403. | **B**: a vendor report, but the method is stated and a third party ran it | **Law-firm variant only**: "In a 2024 secret-shopper test of 500 US law firms, 40 % answered the phone." **Verify against the Clio PDF before it goes on screen.** Never generalise to "businesses". |
| F3 | **"More than half (52.9%) said it was easy to contact their GP practice on the phone, compared with 49.7% in 2024."** | Ipsos for NHS England, *GP Patient Survey 2025*: 702,837 responses, fieldwork 30 Dec 2024 - 1 Apr 2025, response rate 25.8 % [P5] | **A** (official statistics) | Clinic context only, and England only. Say "patients", "GP practice", "England". A weak fit for our private-clinic and dental customers; hold in reserve. |
| F4 | **"23% of the companies never responded at all"** (to a web-generated test lead). "37% responded … within an hour." "The average response time, among companies that responded within 30 days, was 42 hours." | Oldroyd, McElheran & Elkington, "The Short Life of Online Sales Leads", *HBR*, Mar 2011: an audit of 2,241 US companies. Quoted via SmartCompany [S16]; the HBR page itself shows only the intro. | **B** (reputable, old, **web leads**) | Only for "enquiries" or "leads". **Never** for "callers" or "rings". The site already cites it (`WHY_SOURCES`). |
| F5 | The odds of qualifying a lead are **4× lower at 10 min** and **21× lower at 30 min** than within 5 min. | MIT / InsideSales.com Lead Response Management study (Oldroyd): 3 years, 6 companies, 15,000+ leads, 100,000+ call attempts. The study was co-run by a lead-response software vendor; the site discloses this. | **B−** (vendor co-run; these were web leads being called *back*) | The site uses it as "odds of qualifying a caller", which is a stretch, because the leads were web leads. If used at all: "a lead", with the vendor link in the caption. It **cannot** measure seconds: its baseline is a 5-minute window (`lib/site.ts:716` comment). |
| F6 | **"60% of customers prefer to call small businesses on the phone"** | BrightLocal, 500 US consumers, reported 2019-05-24 by Small Business Trends [S17] | **B−** (small sample, 2019) | "People still call", with the year in the caption. Not needed by any concept below. |

### 5.2 WEAK (caption only, with full credit, or better not at all)

| # | Claim | Why weak |
|---|---|---|
| F-W1 | 411 Locals: **"37.8% of calls are answered by a person"**, 37.8 % by an answering machine, 24.3 % unanswered (85 businesses) | The original page (`411locals.com/blog/how-well-do-small-businesses-handle-phone-calls`) is **unreachable**: an SSL mismatch, then a 503, and no Wayback snapshot. The only first-party trace is the company's Moz Q&A post ("we did a small study with 85 businesses"), which states **no year, period or method**. The site dates it **2016**; secondaries say **2024**. It is a small vendor study. The site already cites it, so don't add it to a reel. |
| F-W2 | Moneypenny: **"69% of the callers who were answered by voicemail declined to leave a message, and instead hung up."** | A vendor (call answering), published 2016-11-21. The survey was "commissioned by Moneypenny" from an unnamed firm: 300 micro businesses plus "10,000 businesses' call data". **The country is inconsistent** on the page ("US businesses" vs "Britain's smallest businesses"). Not screen-grade. |
| F-W3 | Hiya: "only 52 percent of all calls Americans receive … are answered"; 76 % of unidentified calls unanswered (2019) | A caller-ID vendor, 2019 data, about callees answering unknown numbers. Off-topic for inbound business calls. |
| F-W4 | BIA/Kelsey: calls "convert at 10-15x the rate of web form leads" | A 2015 analyst blog post, method not shown; cited via a vendor (Aira). |

### 5.3 UNUSABLE (recycled or untraceable; never on screen, never in captions)

| # | Claim as circulated | Trace |
|---|---|---|
| F-U1 | "85 % of people whose calls go unanswered will not call back" | Attributed to PATLive by Aira. The PATLive page **no longer contains it**: it now says "86% … hang up without leaving a message" sourced to "industry data", plus "60% … call a competitor within minutes", no study named. |
| F-U2 | "About 80 % of callers who reach voicemail hang up" | Aira credits "Forbes / Industry data". The Forbes Tech Council URL returns 404. No primary study found. |
| F-U3 | "62 % of callers who don't reach a business contact a competitor" | Dialzara, a vendor blog. |
| F-U4 | "$126,000 lost per year to missed calls" | An AMBS Call Center / Aira estimate, not a study. |
| F-U5 | "78 % of customers buy from the first responder" | Lead Connect, a vendor; no method found. |
| F-U6 | "71 % call another business right after voicemail" (attributed to BrightLocal) | No BrightLocal report contains it; the search found only an unattributed "82 % would contact a competitor". |
| F-U7 | "62 % of business calls go unanswered" | Derived from F-W1 (100 − 37.8). It inherits F-W1's problems. |
| F-U8 | "Phones ring 20-30 s before voicemail" | Only forums and blogs; **no carrier documentation found**. Never state a voicemail time. |
| F-U9 | "Callers hang up after 4-6 rings / 5-10 % abandon after 20-40 s" | An unsourced vendor blog (getnextphone) and forum polls. The only experiment found (a phonebank "three rings" test by SiX/SDAN) is about **outbound** political calls. |
| F-U10 | "Kinetic text raises engagement 41 %", "faceless TikToks get 52 % more shares" | vidBoard, a tool vendor, no method. |

**Bottom line for the script.** The clock cannot say how many seconds a caller will wait, because nobody has measured it credibly. It *can* say what a ring is (F1) and let the viewer feel the seconds. That is more honest and, I'd argue, stronger: the viewer counts the rings themselves.

---

## 6. Six scenarios in the style

All six share:
- the white ground;
- the black plus teal palette;
- the two-tier type, lifted to y 1080-1420;
- the hero object cropped off the top or right edge above y 900;
- Tessa on every text line;
- the series CTA beat: "Five free minutes, no card. Comment AGENT." The trial facts are A; never put them next to booking.
- the NEUROVOICE end card adapted to white;
- a 14 f seam.

**Hook columns:**
- "on screen" is the large tier at f0 (the small tier carries the whole spoken line).
- HS is the hookscore of the spoken line, raw / patched.
- Spoken time is at Tessa's 2.78 words/s.

### S1 · "Every second" (the clock) · **RECOMMENDED LEAD**

**Hero object.** A white clock face in extreme close-up, cropped like the reference: the arc enters upper left and leaves right.
- **Marks:**
  - Black 5-minute ticks.
  - A **teal arc** whose white-centred nodes sit **every 6 seconds**: one node per North American ring (F1).
- **Hand:** one black second hand with a diamond tip, sweeping at a constant 6°/s.
- **Hub:** a teal hub cap.

**Frame 0** (sound-on hook):
- **Sound:** a US ringback at 0.0 s (440 + 480 Hz, 2 s on).
- **Picture:** the hand is already past the first node, and the node lights teal as the tone sounds.
- **Large tier, set at 72 %:** "One ring," (grotesk) / "*six seconds.*" (teal italic serif).

**Hook.**

| On screen (large) | Spoken (Tessa) | Words / time | HS raw / patched |
|---|---|---|---|
| One ring, / *six seconds.* | "One ring, six seconds. You can't answer." | 7 / ≈ 2.5 s; payload "One ring" at 0 s | **84.4 / 84.4 STRONG** |
| alt B (no regional fact): Every / *second* | "Every second it rings, you're not there." | 7 / 2.5 s | 48.6 / 48.6 WEAK (no number). Keep it as the body line, not the hook. |

**Beat outline** (24-26 s, 120 BPM grid; the script stage finalises it):
- **b1, 0-2.6 s.** The hook (above).
- **b2, 2.6-6 s.** The hand passes nodes 2 and 3; each one lights on a ring tone.
  - Large: "*Two.* / *Three.*"
  - Small: the full line, which **carries the keyword**: "Two. Three. That's why people get an AI receptionist." Or more neutral: "Two. Three. Nobody's free to pick up." The keyword can move to b4.
- **b3, 6-10 s. The reference moment.** The camera eases back (1.0 → 0.55) to show more of the dial.
  - Large: "Because / *every second*"
  - Small: "Because every second it rings, someone's still waiting on the line."
  - This is true by definition and needs no figure.
- **b4, 10-14 s. The match cut (wordless, ≤ 1.2 s).**
  - The hand stops on node 1. The teal hub cap scales up into **the orb** (the brand's mark).
  - Then: "Our AI receptionist picks up on the first ring." This is a site claim, B; no latency number.
- **b5, 14-19 s.** The orb's light becomes the caption. "It answers from what you wrote down. In fourteen languages."
  - It is safe to say "fourteen languages" here as long as no switching is shown.
- **b6, 19-24 s.** The CTA, then the end card.

**Loop.** The end card's last 14 f re-form the dial. The hand resumes its sweep and crosses node 1 exactly on frame 0's ring tone. The last spoken word ("…AGENT." / "Neuro Tech Voice.") hands to "One ring".

**Why it would be shared:**
1. It turns a feeling every owner has (the phone ringing while their hands are full) into a measurable thing: rings into seconds.
2. The macro sweep is the "satisfying" layer, and the reel is the reference's exact aesthetic, which the owner chose.
3. The send is "count the rings at our front desk".

**Risk:**
1. It is the composition **closest to the reference**. It has to be our own dial (ring nodes, not minute dots), our own type and our own sentence, or it reads as a copy.
2. "Six seconds" is NANP-only, so the caption must name the standard. Owners in the EU or UK may correct it in the comments. **Reply:** "North American standard; yours rings a little faster."
3. "First ring" has no measured latency (B).
4. "You can't" repeats ig5's hook word.

### S2 · "Line two" (the desk phone)

**Hero object.** A classic multi-line office phone in macro, cropped to its row of line buttons.
- **Line 1:** a steady black lamp (in use).
- **Line 2:** a lamp blinking **teal** on the US 2 s / 4 s cadence.
- The 2.5D receiver shadow is the only depth.

**Hook.**

| On screen (large) | Spoken | Words / time | HS raw / patched |
|---|---|---|---|
| Two calls. / *Can't take both.* | "Two calls. Your receptionist can't take both." | 7 / 2.5 s; "receptionist" heard at ≈ 1.1 s | **84.4 / 84.4 STRONG** |
| alt: Line two rings. | "Line two rings. Your receptionist can't." | 6 / 2.2 s | 84.4 / 84.4 STRONG |

**Beat outline:**
1. The line-2 lamp blinks.
2. "Your receptionist keeps line one." The ig1 stance: nobody is replaced.
3. Match cut: the lamp's teal dot becomes the orb. "Line two is an AI receptionist, on its own number."
   - This is the true architecture: the number sits next to the business line, with no porting.
4. "It answers from the answers you wrote once."
5. CTA.

**Loop.** Line 2 starts blinking again at the seam.

**Why it would be shared:**
- It is the **receptionist family**, the only proven TikTok hook family on the account (563 vs ≤ 283).
- Front-desk staff tag each other, which makes it pro-staff.
- The buttons and lamps are a tactile, satisfying object.

**Risk:**
1. It implies that **calls overflow from the business's line to the AI**. There is **no forwarding feature in the product**, so the reel says "its own number" and never shows a transfer from line 1.
2. "Can't take both" could read as a knock on staff, so the delivery must stay warm.
3. Use no pronoun for the receptionist.

### S3 · "The sign" (Open / Closed)

**Hero object.** A hanging shop sign on a string, in macro.
- It swings at f0, already mid-flip from OPEN to CLOSED, with a paper drop shadow on the white "door".
- On its back face, in teal italic: "*still answering*".

**Hook.**

| On screen (large) | Spoken | Words / time | HS raw / patched |
|---|---|---|---|
| The sign says *closed.* | "The sign says closed. Your phone doesn't." | 7 / 2.5 s | **77.8 / 77.8 STRONG** |
| alt: You flipped the sign. | "You flipped the sign. Not the phone." | 7 / 2.5 s | 62.2 / 77.8 |

**Beat outline:**
1. The sign settles on CLOSED. A ring sounds.
2. The sign spins once and its back reads "*still answering*".
3. "Your AI receptionist takes the call, and a message."
4. "Closed is for the door, not the phone." The house line, as the payoff, not the hook.
5. CTA.

**Loop.** The morning: the sign flips back to OPEN, then to CLOSED at frame 0.

**Why it would be shared:**
- It is the most universal small-business object, and the flip is satisfying.
- The after-hours pain is the #1 angle in RESEARCH-reels §8.

**Risk:**
- It is **ig2's sibling** (a closing hour, 250 views).
- The house line already fronted the first post (52 views on IG, a cinematic cut), so it risks déjà vu.
- "Day or night" is fine. Never "24/7" or "every call" next to the trial.

### S4 · "Fourteen" (the language dial)

**Hero object.** A large selector dial (a radio or combination-lock dial) cropped off the right edge.
- 14 language names run around its rim in grey small caps.
- A teal index notch sits at 12 o'clock.
- Each detent **clicks** (ASMR layer).

**Hook.**

| On screen (large) | Spoken | Words / time | HS raw / patched |
|---|---|---|---|
| Fourteen languages. / *You only need one.* | "Fourteen languages. You only need one." | 6 / 2.2 s | **81.4 / 81.4 STRONG** |

**Beat outline:**
1. The dial spins past the names, clicking.
2. **Four greetings**, each spoken and shown, one per detent: "Hola." "Bonjour." "Ciao." "Bună."
3. "The one your callers speak." The dial lands on one language and the notch lights teal.
4. "Pick it once. Your AI receptionist answers in it." This is **exactly the code**: one language per agent.
5. CTA.

**Loop.** The dial completes its turn back to the frame-0 position.

**Why it would be shared:**
- Immigrant-run and tourist-area businesses, and multilingual staff, will send it ("send this to Maria").
- The line is a twist (fourteen → one) that rewards a second read.
- The clicks are satisfying.

**Risk:**
1. Greetings must be spoken by Tessa in other languages (via Cartesia), and native speakers will judge the accent in public. Limit it to 4 short words and test them before committing.
2. Never show one agent switching languages mid-call. The product sets one language per agent.
3. Use no flags (`agent-languages.ts`: "flags represent countries, not languages").

### S5 · "While you were out" (the message pad)

**Hero object.** The classic pink "While You Were Out" phone-message slip in macro, as a stack.
- The printed fields are "Caller ___ / Phone ___ / Message ___" with checkboxes ("Please call", "Will call again").
- In the white-ground style the slip is white with **teal** rules (one accent), not pink.

**Hook.**

| On screen (large) | Spoken | Words / time | HS raw / patched |
|---|---|---|---|
| Three calls. / *No names.* | "Three calls while you were out. No names." | 8 / 2.9 s | **81.4 / 81.4 STRONG** |
| alt: While you were out: three calls. | "While you were out: three calls. No messages." | 8 / 2.9 s | 77.8 / 77.8 STRONG |

**Beat outline:**
1. Three blank slips tear off and pile up (satisfying tear and flutter).
2. "Now each one comes with a name and a reason."
3. A slip writes itself in teal ink, as if by hand: "Caller: Ana. Question: do you open Sunday?" Then "Answered from your hours."
4. "Your AI receptionist takes the message, and writes it down." `take_message` (A) plus the call log transcript (site copy).
5. CTA.

**Loop.** A fresh blank slip tears off the pad, which is frame 0.

**Why it would be shared:**
- The office-culture nostalgia object, plus the universal annoyance of "someone called, no idea who".
- The tear-off and the handwriting are classic satisfying motion.

**Risk:**
- The slip is a Gen-X icon, so younger owners may not read it.
- "No names" must stay a scene, never a statistic.
- The written answer must come from the knowledge base (hours) and **never be a booking** (Pro).

### S6 · "The beep" (the sound line)

**Hero object.** A single black hairline across the white frame: the line itself.
- It pulses in **teal** bumps on the 2 s / 4 s ring cadence, then flattens into a long voicemail "beep" tone.
- Then it **blooms** into a living voice waveform (teal) when the agent answers.

**Hook.**

| On screen (large) | Spoken | Words / time | HS raw / patched |
|---|---|---|---|
| You never leave *voicemails.* | "You never leave voicemails. Neither do they." | 7 / 2.5 s | **77.8 / 81.4 STRONG** |
| alt: Beep. *Would you leave a message?* | "Beep. Would you leave a message? Be honest." | 8 / 2.9 s | 47.0 / 47.0 WEAK |

**Beat outline:**
1. The ring pulses, then the beep flatline.
2. "So don't send them to the beep." (wordless hold of 0.8 s on the flat line)
3. The line blooms: "Let your AI receptionist answer, in the words you chose."
4. "Give it your answers once." (the voice.md line)
5. CTA.

**Loop.** The waveform settles back into the flat line, which starts pulsing on the ring.

**Why it would be shared:**
- A relatable confession invites comments ("true, I hang up").
- It is the most minimal of the six (one line), and the most sound-led, which suits TikTok.

**Risk:**
1. The hook asserts something about the viewer (opinion, not data). Every figure people expect here ("80 % hang up") is **UNUSABLE** (§5.3), so the reel must not imply one.
2. The waveform invites "is that the agent's voice?". Tessa is **not** the product voice (SCRIPT §0.4), so the waveform stays abstract and nothing says "this is our agent speaking".

### Parked: the calendar page

A tear-off day calendar ("Sunday", "9 pm") reads as **booking** to any viewer.
- Booking is Pro-only (`starter.googleIntegrations = false`), and the $49 plan doesn't have it today.
- The best hook found was "Sunday, 9 p.m. Someone wants to book." (50.6 OK), with a booking claim built in.

It is only viable as two cuts (a "Pro plan" tag cut, and a "takes the message" cut), like ig5.

**Better use:** a **14-page tear-off as the CTA device** in any concept. "Fourteen days. Five minutes. No card." Each page tears on a word, and all of it is A.

---

## 7. Ranking

The ranking weighs:
- style fit to the owner's reference (×2);
- TikTok evidence (the receptionist keyword);
- truth risk;
- shareability;
- build cost on the ig5 route (`src/ig/ig6`, separate registry).

| Rank | Scenario | Hook (spoken) | HS raw / patched | Style fit | TikTok fit | Truth risk | Build |
|---|---|---|---|---|---|---|---|
| **1** | **S1 Every second** (clock) | One ring, six seconds. You can't answer. | 84.4 / 84.4 | **literal** | keyword in the caption tier ~3 s | low (F1 is a standard; "first ring" is B) | medium: dial, hand, ring nodes, orb match cut |
| 2 | S2 Line two (desk phone) | Two calls. Your receptionist can't take both. | 84.4 / 84.4 | high | **best** (receptionist family) | medium (overflow implication) | medium |
| 3 | S4 Fourteen (dial) | Fourteen languages. You only need one. | 81.4 / 81.4 | high | medium | medium (foreign-language takes) | medium, plus 4 extra takes |
| 4 | S5 While you were out | Three calls while you were out. No names. | 81.4 / 81.4 | high | low-medium | low | medium-high (handwriting) |
| 5 | S6 The beep | You never leave voicemails. Neither do they. | 77.8 / 81.4 | medium (abstract) | medium (sound) | medium (implied stat) | low |
| 6 | S3 The sign | The sign says closed. Your phone doesn't. | 77.8 / 77.8 | high | low (the ig2 family) | low | low-medium |

**Plan:**
- **Build S1.**
- Keep the hook as a swappable module, as in ig5, so that **S2's hook over S1's body** can be posted as the TikTok B a week later: "Two calls. Your receptionist can't take both." as line 1, with the clock running on.
- Trial Reels are still out of reach (≈ 14 followers, the gate is ≈ 200).
- **The receptionist keyword in S1:**
  - spoken in b2 or b4 ("…AI receptionist…");
  - in the TikTok caption's first line;
  - in a cover kicker `AI RECEPTIONIST · 06`.

**Recipe handed to the script stage:**
- **Ground:** white, no mesh.
- **Ink:** black / graphite 60 % (small tier) / **teal** as the only accent.
- **Type:** Instrument Sans 700-800 (large, grotesk), plus Cormorant Garamond Italic 500-600 (large, accent word), plus Instrument Sans 400-460 at 34-40 px (small tier).
- **Motion:** constant hero motion, exponential punctuation on beats, shape match cuts, and one late ease-back reveal.
- **Sound:** a real ring at f0, ticks or clicks as the satisfying layer, the 120-128 BPM bed entering after the hook, and Tessa throughout.
- **Text zone:** x 60-940, y 1080-1420 (large plus small tiers). Objects may bleed off the top and right edges above y 900.

---

## 8. Hookscore runs (2026-10-11, `python3 -I`, scratch copy; columns raw / patched)

```
-- S1 clock --
 84.4  84.4  STRONG  One ring, six seconds. You can't answer.
 84.4  84.4  STRONG  Six seconds a ring. You can't pick up.
 81.4  81.4  STRONG  Every 6 seconds, a ring you can't answer.
 66.2  66.2  OK      Six seconds a ring. Still no answer.          (ADDRESS 35)
 62.6  62.6  OK      Every 6 seconds it rings. Nobody's free.      (ADDRESS 35)
 50.6  50.6  OK      Every second counts. Six per ring.
 48.6  48.6  WEAK    Every second it rings, you're not there.      (SPECIFICITY 15)
 47.6  47.6  WEAK    One ring is six seconds.                      (STAKES 20)
 30.0  30.0  WEAK    Because every second it rings, they wait.
-- S2 desk phone --
 84.4  84.4  STRONG  Two calls. Your receptionist can't take both.
 84.4  84.4  STRONG  Line two rings. Your receptionist can't.
 77.8  81.4  STRONG  Your receptionist can't answer two calls.
 58.4  58.4  OK      Six seconds a ring. Your receptionist's on line one.
 48.2  48.2  WEAK    Two calls. One receptionist.                  (STAKES 20)
 28.2  28.2  WEAK    Your receptionist is on another call.         (FRONTLOAD 0)
-- S3 sign --
 77.8  77.8  STRONG  The sign says closed. Your phone doesn't.
 62.2  77.8  OK/STR  You flipped the sign. Not the phone.
 58.4  58.4  OK      Closed at 6. Your phone isn't.
 56.0  56.0  OK      Closed sign up. Phone still ringing.
 40.8  40.8  WEAK    Closed is for the door, not the phone.        (house line; SPECIFICITY 15)
-- S4 dial --
 81.4  81.4  STRONG  Fourteen languages. You only need one.
 58.4  58.4  OK      14 languages. Pick the one your callers speak.
 48.6  52.2  WEAK/OK Your callers don't speak your language?
 47.0  47.0  WEAK    Fourteen languages. Your agent needs one: theirs.
 39.2  39.2  WEAK    One AI receptionist. Fourteen languages.
-- S5 message pad --
 81.4  81.4  STRONG  Three calls while you were out. No names.
 77.8  77.8  STRONG  While you were out: three calls. No messages.
 54.8  54.8  OK      While you were out, 3 calls. 0 messages.
 37.8  37.8  WEAK    While you were out, someone called.
-- S6 beep --
 77.8  81.4  STRONG  You never leave voicemails. Neither do they.
 52.2  52.2  OK      Nobody leaves voicemails. Do you?
 47.0  47.0  WEAK    Beep. Would you leave a message? Be honest.
 44.4  44.4  WEAK    Nobody likes leaving a voicemail.
-- parked / reference --
 50.6  50.6  OK      Sunday, 9 p.m. Someone wants to book.         (booking = Pro)
 36.4  36.4  WEAK    Because every second your audience spends trying to understand your message  (the reference's own line)
```

**Scorer caveats:**
- The reference's own line scores 36.4 WEAK. Its power is the picture, not the sentence, which is a reminder that the script reads text only.
- Every hook above 80 is a tie (AUC 0.56 between good hooks).

---

## 9. Sources

**Primary (platform, standards, studies)**
- [P1] TikTok Newsroom, "How TikTok recommends videos #ForYou" (2020-06-18; restated 2023): completion of a longer video is a strong, heavily weighted signal; follower count is not a direct factor. https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you/
- [P2] TikTok for Business, "Auction Ads Creative Tips" (PDF, undated; text extracted 2026-10-11): ">63% … key message … within the first 3 seconds"; "40% of auction ads with the highest VTR" use text overlays; tracks "above 120 BPM … often drive higher view-through rate"; vertical "25% higher 6-second watch-through rate". https://ads.tiktok.com/business/library/Auction_Ads_Creative_Tips.pdf
- [P3] ANSI T1.401-1988 §5.4.2 ring cadence "2 sec on, 4 sec off", as tabulated by Zytrax; the European harmonised "1 sec on, 4 sec off" (ETSI). https://www.zytrax.com/tech/telephony/ring_patterns.htm
- [P4] IETF draft-roach-voip-ringtone-00 (2000), North American ringback vs the ITU-T E.180 generic tone. https://datatracker.ietf.org/doc/html/draft-roach-voip-ringtone-00
- [P5] Ipsos, "2025 GP Patient Survey results released": 52.9 % easy by phone (49.7 % in 2024); 702,837 responses; 30 Dec 2024 - 1 Apr 2025; response rate 25.8 %. https://www.ipsos.com/en-uk/2025-gp-patient-survey-results-released

**Peer-reviewed** (bibliographic; not re-read in full)
- [A4] Loewenstein, G. (1994), "The psychology of curiosity: A review and reinterpretation", *Psychological Bulletin* 116(1), 75-98 (information-gap theory). [K: not re-fetched]
- [A5] von Restorff, H. (1933), the isolation effect; summary and later work: https://en.wikipedia.org/wiki/Von_Restorff_effect

**Secondary**
- [S2] (via RESEARCH-reels) Search Engine Journal, Mosseri on sends per reach. https://www.searchenginejournal.com/instagram-algorithm-shift-why-sends-matter-more-than-ever/521389/
- [S5] (via RESEARCH-reels) SocialPilot, Instagram Views include replays (2025-04-21). https://www.socialpilot.co/instagram-marketing/instagram-views-metrics-changes
- [S10] (via RESEARCH-reels) Website Builder Expert on Meta's Reels guidance (≈ 80 % sound-on). https://www.websitebuilderexpert.com/news/meta-updates-reels-ads-guide/
- [S11] Live Science, why #oddlysatisfying videos satisfy (no dedicated studies). https://www.livescience.com/62091-oddlysatisfying-videos-satisfying.html ; Discover Magazine: https://www.discovermagazine.com/mind/why-are-oddly-satisfying-videos-sosatisfying
- [S12] Wikipedia, "Ringing tone" (NANP 440 + 480 Hz, 2 s on / 4 s off). https://en.wikipedia.org/wiki/Ringing_tone
- [S13] 2Civility (Illinois Supreme Court Commission on Professionalism), "2024 Clio Legal Trends Report: fixing the first impression problem". https://www.2civility.org/2024-clio-legal-trends-report-fixing-the-first-impression-problem-for-law-firms/
- [S14] Above the Law, "Law firms failing at the single most basic lawyering task" (Oct 2024). https://abovethelaw.com/2024/10/law-firms-failing-at-the-single-most-basic-lawyering-task/
- [S15] ABA *Law Practice* magazine, Mar-Apr 2025, "Law's new first impression". https://americanbar.org/groups/law_practice/resources/law-practice-magazine/2025/march-april-2025/laws-new-first-impression-transforming-client-intake (403 to the fetcher; the figures are via the search summary)
- [S16] SmartCompany (2011-07-04), quoting the HBR audit verbatim. https://www.smartcompany.com.au/marketing/20110704-are-you-letting-online-leads-go-cold/ ; HBR original: https://hbr.org/2011/03/the-short-life-of-online-sales-leads
- [S17] Small Business Trends (2019-05-24) on BrightLocal's 500-consumer survey. https://smallbiztrends.com/2019/05/customer-contact-statistics.html

**Vendor / creator (directional only)**
- [V1] ClipSpeed, "Short-form video statistics 2026" (≈ 70 % muted claim). https://www.clipspeed.ai/blog/short-form-video-statistics-2026.html
- [V2] Zebracat, "How to make faceless reels" (abstract or minimal reels "allow viewers to focus purely on the concept"). https://www.zebracat.ai/post/faceless-reels ; Piktochart, graphic design trends 2025 (kinetic captions). https://piktochart.com/blog/graphic-design-trends-2025/
- [V3] Upwork, "Apple-style kinetic typography demo video for your SaaS". https://www.upwork.com/services/product/video-audio-an-apple-style-typography-promo-video-1727647414003879936 ; vidBoard (unverified 41 % / 52 % claims, UNUSABLE). https://www.vidboard.ai/engage-faceless-videos-tiktok-instagram-2025/
- [V4] Contra, "Kinetic typography and motion design video for SaaS / fintech" (Jul 2026, self-reported). https://contra.com/p/YNsvkveP-kinetic-typography-and-motion-design-video-for-saa-s-fintech

**Checked and rejected (§5.2-5.3)**
- Moneypenny small business call report (2016): https://www.moneypenny.com/us/resources/news/small-business-call-report/
- 411 Locals: the Moz Q&A post by the company: https://mozdev.nodebb.com/community/q/post/287414 ; the original page is unreachable: https://www.411locals.com/blog/how-well-do-small-businesses-handle-phone-calls
- Aira's compilation (the trail for F-U1 to F-U5): https://getaira.io/blog/missed-business-calls-statistics
- PATLive (now "86 %", no source): https://www.patlive.com/blog/missed-calls-mean-missed-revenue/
- Hiya 2019 via Telecompetitor: https://www.telecompetitor.com/mobile-phone-call-research-48-of-calls-unanswered-thanks-to-robocalling/
- The SiX phonebank "three rings" test (outbound, political): https://stateswin.org/research/rings-of-three-leave-it-be-testing-the-three-rings-approach-to-phonebanking/

**Repo [R]**
- `lib/agent-languages.ts`, `lib/voice/languages.ts`: 14 languages, one per agent.
- `lib/voice/tools/definitions.ts`, `lib/voice/session-loader.ts:240`: `take_message`.
- `lib/site.ts:678-812`: `SHELF_CLAIM`, `LEAD_DECAY`, `CALL_FATE`, `WHY_SOURCES`.
- `lib/billing/entitlements.ts`: booking Pro+; trial has no SMS or booking.
- `trailer/package.json:53` and `node_modules/@fontsource/cormorant-garamond`: italic 300-700 available. `src/lib/fonts.ts`: Instrument Sans plus its italic.
- `.claude/skills/ig-reel/hookscore.py`: run with `python3 -I` from `scratchpad/ig6r/hs`; the patched copy is `hs_patched.py` there.
