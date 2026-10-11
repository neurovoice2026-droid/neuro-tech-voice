# ig6 · judge: truth + production

Label `judge:truth`. Written 2026-10-11 on `claude/remotion-trailer`. Product code is unchanged since `9cb3bc8`: `git diff 9cb3bc8 HEAD -- lib types app components` is empty, and HEAD `7b67638` only adds the ig6 docs. Planning only: this is the only file written in the repo. No code, no Cartesia call, nothing committed. The timing model is in `scratchpad/judge6t/fit.py`.

---

## 1. Scores (1-10)

| Concept | **Truth** (claims, numbers, picture) | Booking / $49 | Series coherence (no replace/fire) | **Production** (fit at 2.5 w/s, cards, zones, build) | Truth after the §4 fixes | Production after the §4 fixes |
|---|---|---|---|---|---|---|
| **sign** "The other side" | **9** | PASS | PASS (déjà-vu flag: ig2 angle + house line) | **7.5** | 9.5 | 8.5 |
| **free** "While you were out" | **8.5** | PASS | PASS ("Three calls" echoes ig5) | **7** | 9.5 | 8 |
| **clock** "Every second" | **7** | PASS | PASS ("You can't" echoes ig5) | **6** | 9 | 7.5 |
| **phone** "Off the hook" | **6.5** | PASS | PASS (the best pro-staff stance) | **4.5** | 8.5 | 6.5 |

**What the columns mean:**
- **Truth:** every spoken, on-screen, caption and reply line checked against RESEARCH-product (SAFE S1-S22, UNSAFE U1-U21) and RESEARCH-viral §5 (cited facts only). It also covers what the **picture** implies: a speed, a takeover, a count.
- **Booking / $49:** none of the four shows booking, a calendar, a price, a plan name or minutes. Nothing waits on the unshipped Starter booking (`entitlements.ts`: starter `googleIntegrations: false`, re-read today). PASS ×4.
- **Production:** whether the voice-over fits the timeline at **2.5 words/s**. That rate is from the brief and from `voice.md` ("2.5 words per second, the films' measured pace"); ig5 measured Tessa at 2.78, and both rates are reported. It also covers big cards of 6 words or fewer, text inside x 60-940 / y 220-1440, the series object rule (x ≤ 880 below y 840), the lockup box kept clear of object strokes, and build risk in Remotion with no 3D library.

**Verdict:**
1. **No concept is blocked.** Each one can ship truthfully once its fixes are in.
2. **Safest to make true, and cheapest to build: sign, then free.** Neither says "first ring", neither uses a number, and neither shows a phone being answered.
3. **clock:** its one number is verified (I re-fetched the source today). But "One ring, six seconds", followed by "picks up on the **first ring**", lets any viewer work out our pickup time (6 s or less). That is the latency claim the site refuses to make (`site.ts:706-712`). **Fix:** make `ig6-04d` "It picks up, day or night." the default line. Bring "first ring" back only after a logged launch check passes (R2). Plan the reel at 28.0 s.
4. **phone** (the growth judge's winner) needs the most fixes:
   - 54 words don't fit 28 s at 2.5 w/s, or even at 2.78 w/s.
   - The growth judge's G3 graft fails at both rates. I veto its **26.0 s length**, not its cut of the line.
   - A front-desk phone answering itself in a "lunch rush" is the closest any concept comes to U5.
   - "First ring" followed by "Ring it yourself." needs the launch check.
   - The cover title runs past x 940.

   It can still ship at 28.0 s if it has: 43 words or fewer, the "its own number" caption and pinned comment, "On a Sunday." in place of "Lunch rush.", and the launch check.

---

## 2. What I checked, and how

**Code, re-opened at HEAD:**

| Citation | What it says today |
|---|---|
| `lib/billing/entitlements.ts:25-53` | trial and starter both have `googleIntegrations: false`; trial `testCallsPerDay: 5` |
| `lib/voice/router.ts:1-11` | answers within a few seconds; the only provider call while Twilio waits is register-call, 3 s timeout |
| `lib/voice/router.ts:198-224` | `inboundBlock` returns null (answers) unless the org, agent or number blocks the call, or the owner chose "play a message" outside hours |
| `lib/site.ts:706-713` | `SHELF_CLAIM` "It answers here, on the first ring.", plus the comment that a number would make it "a latency claim the product has never measured" |
| `lib/site.ts:944, 1812-1813, 1932, 2527` | day or night; trial test calls; "porting your existing number in is not supported yet … sits alongside your current line"; tells every caller it is an AI |
| `lib/site.ts:1622-1625` | "one agent" is a limit, so the fine print "One agent per business" holds |
| `lib/pages/home/call.ts:17` | "Answered on the first ring — at 3 a.m., on a Sunday, just after closing, in the middle of a rush." |
| `lib/pages/ai-agents.ts:39-40` | "AI voice agents that answer every call"; "Point your calls at an agent that picks up on the first ring" |
| `lib/voice/tools/definitions.ts:145-158` | `take_message`: "Call it when nobody can help right now, the caller asks for a callback, or you cannot answer their question"; `caller_name` may be null |
| `lib/voice/tools/messages.ts:29-35` | the callback number falls back to the caller's own number |
| `lib/voice/tools/messages.ts:48-80` | text or email per contact, plus "This message is also in the Inbox of your dashboard." |

**The one number (F1).** I re-fetched https://www.zytrax.com/tech/telephony/ring_patterns.htm today:
- North America (ANSI T1.401-1988 §5.4.2): "Ringing (Code 1) · 2 sec on, 4 sec off, repeating".
- Europe (ETSI): "Normal Ringing · 1 sec on, 4 sec off, repeating". The page adds that "many countries may have local variants".
- Verdict: F1 is accurate as RESEARCH-viral states it.

**Timing model.** For each concept I took its own voice lines and plan frames and assumed:
- each take lasts words ÷ rate, plus a 4 f tail;
- at least a 6 f gap between takes;
- the air that each concept's picture events need between lines (pickups, whips, zooms), taken from its own beat sheet;
- a plan frame is the earliest a line can start, so slip carries forward;
- the CTA deadline is impact − 15 f.

Results are in §6. Per-beat word counts are in §5.

**Zones.** I measured from each concept's own numbers and checked against the mocks (`ig6sign/mocks.png`, `ig6phone/mocks_v2.png`, `ig6free/mocks_concept_free.png`, `ref6an/mock.png`).

**Card rule, read as:** the big lockup holds 6 words or fewer, and the grey sentence tier is a caption held to the series' 7-word cap. A stricter reading ("6 words in all on screen") would fail every lockup of every concept, because the tier repeats the big words; the reference style could not exist under it. **The owner or judges must confirm this reading.**

---

## 3. Rulings for whichever concept wins

**R1. The ring cadence (F1).**
- It may be said only as the North American ring.
- The caption carries RESEARCH-product §8's line, word for word: "One ring = 2 s of tone + 4 s of silence, the North American standard (ANSI T1.401)."
- A pinned reply must quote the source, not guess. Write "Europe's standard is 1 s on, 4 s off, and some countries use their own", not "yours may ring a little faster" (the UK cycle is about 3 s, which is not "a little").
- It must never be used about voicemail, waiting or hang-ups (F-U8, F-U9).

**R2. "On the first ring" (grade B) needs a logged launch check whenever the reel also says "Ring it yourself." or gives a ring a duration.** "Ring it yourself." turns every viewer into a tester. The check:
- **Calls:** at least 5 calls to a **live agent number**, from a phone in the **same country as that number**. At least one call comes after the agent has been idle for 30 minutes or more, to catch a cold start (`router.ts` allows register-call up to 3 s).
- **Pass:** each call is answered before the second ring begins.
- **Log:** date, the number's country, and the five results, in `docs/ig/ig6/` before posting.
- **On a fail, or if the check isn't run:** use the concept's fallback line.
- **Clock only:** the reel itself defines a ring as six seconds, so the fallback is the **default**, and the check must use a US or Canada number.

**R3. Its own number (U5).**
- Every concept gets the series precedent (`trailer/docs/ig/SCRIPT.md:160`: "its own number alongside your line, no porting · caption + pinned comment (ig1, ig3)"). The caption fine print already carries it; the pinned comment repeats it: "It answers its own number, next to your line. No porting."
- No frame shows line buttons, hold, "busy", forwarding, or the agent catching a call that rang out first.
- All four concepts already keep the agent on a **fresh** first ring.

**R4. The AGENT CTA on two apps.**
- **Instagram:** someone (or the existing automation) must deliver the trial link and setup help to AGENT comments on posting day. Otherwise use the `-07b` take "The link's in our bio."
- **TikTok:** it has no keyword auto-DM, but the one master's VO still says "Comment AGENT". So either someone answers AGENT comments on TikTok with the link in bio, or the TikTok upload uses the `-07b` take. Pick one before posting; don't leave TikTok AGENT comments unanswered.

**R5. Captions.**
- The fine print goes in word for word from RESEARCH-product §8.
- "24/7" may appear only in the caption, about answering hours.
- "Start free" never sits in the same sentence as "answers your customers" (U10).
- Never "every call answered" (U2).
- Nothing in any caption or reply says "a minute of rings", a hang-up rate or a voicemail time.

**R6. Booking / $49.** All four leave it out. If the owner later wants a price, use only C1 ("From $49 a month") with ig5's fine print, and no calendar anywhere.

**R7. Series coherence.**
- All four keep the receptionist: never "replace", "fire" or "instead of".
- `End6` against `IgEnd` makes no difference to truth, provided `End6` adds no claim, price, "Start free" button or booking, and keeps `neurotechvoice.com`.
- The echoes ("You can't", "Three calls") are a style and growth question, not a truth question.

**R8. The voice rule.** The owner's rule, read literally: the woman's voice is heard whenever there is text on screen.
- **Accepted (series precedent):** lockup 1 set at 72 % ink 10 f before her first word, and set again during the silent seam.
- **Object lettering counts as text.** That means the sign's faces and the slip's printed labels. Exceptions are listed per concept.

**R9. Sentence tiers over 7 words** must be split at the comma or the sentence break; each concept already offers the split.
- clock: S2 (8), S4 (9), S5 (8)
- free: L1 (8), L5 (9)
- phone: the `ig6-03` tier (9)
- sign: none

**R10. Tessa is not the product voice.** No waveform synced to her, and no "this is our agent". All four comply.

---

## 4. Concept by concept

### 4.1 sign "The other side" · Truth 9 · Production 7.5

**Claims:**

| Line / picture | Verdict | Source |
|---|---|---|
| "Closed at six. Your phone's still open." | scene, not a claim | none needed |
| "At eight. At ten. At midnight." + three hollow dots | scene; no count; dial with no numerals | none needed |
| "The other side says open." | physical fact about the sign | the object |
| "Closed is for the door, not the phone." | house line (S3) | `voice.md:23, 43` |
| "Your AI receptionist picks up, day or night." | **A**: default always-answer; "day or night" used on screen instead of "24/7" | `router.ts:198-224`; `site.ts:944` (S4, S22) |
| "It answers from your words." | **A** | S6 |
| Night 2: a fresh ring on a clean dial; the night-1 dots never turn teal | correct: no callback claim, no takeover | U5 |
| The pickup 15 f after the ring | choreography on an hour-scale dial with no reading | U3 safe |

**Required fixes:**
- **P-S1 · zones.** The card runs under TikTok's rail.
  - **Where:** S1's card spans x −50…1030, y 380-980. S2's spans x −30…1110, y 443-1077. Both break the series object rule (x ≤ 880 below y 840).
  - **Into the lockup box:** in S2 the card's bottom edge (1077), plus about 15 px from the φ 1.5° swing at a corner and the 48 px long shadow, reaches the lockup box. The lead's cap top is at about y 1100. The mock's b3 and b4 panels show it.
  - **Fix:** in S2, card width ≤ 1000 and bottom ≤ 1030 (shadow ≤ 1075). In S1, either a 900 × 500 card centred at about (450, 640), so CLOSED is about 125 px and sits at x 175-726, or a written exception in the ig6 `zones.ts` for the card's blank right edge.
  - **In every flip, swing and punch-in state:** the CLOSED and *open* lettering stays inside x 60-940. It does at the planned sizes.
- **P-S2 · fit.**
  - **At 2.5 w/s:** the 28.0 s plan misses the CTA deadline by about 28 f. Trim T1 (drop `ig6-06` "It answers from your words.") becomes the default unless the takes measure ≥ 2.7 w/s. With T1 there are 56 f spare.
  - **At 2.78 w/s:** it fits with all lines (10 f spare).
- **P-S3 · b5 is the tight beat.** It holds a 1.3 s wordless beat plus 8 words (3.2 s) in 4.2 s. Anchor the f572 whip to her last word + 6 f, not to the plan frame.

**Accepted:**
- CLOSED stays on screen without voice for about 20 f (f250-268) and about 8 f in the tilt. It is the word she said, and she says it again at f330. Object lettering between two lines is fine.
- The sign's lettering sways up to 2°. That is a style call, not truth.

**Recommended:** the B hook "Your receptionist left at six. The phone's still open." is true and pro-staff. Its caption carries R3's "own number" line.

### 4.2 free "While you were out" · Truth 8.5 · Production 7

**Claims:**

| Line / picture | Verdict | Source |
|---|---|---|
| "Three calls while you were out. No names." / "Somebody needed something. Nobody wrote it down." | scene | none |
| "Your AI receptionist picks up." | **A** (no speed, no "first ring") | `router.ts:198-224` |
| "Answered, from your words." + the teal tick | **A** | S6 |
| "The rest, it writes down." | **B**, an instruction; worded as behaviour, never "always" | `definitions.ts:147` |
| "A name. A number. A message." | **A**. The name appears only if given (`caller_name` can be null); the number falls back to the caller's own | `definitions.ts:149-153`; `messages.ts:29-35` |
| "Your team gets the message." | **A** on every plan; never "instantly" on screen (the tool text says "right away") | `messages.ts:48-80` |
| Handwriting with no legible letters or digits | correct: no invented caller | U17 |
| A filled slip that ticks ANSWERED **and** takes a message | a plausible mixed call (an answer plus a callback request) | keep "The rest", never "everything" |

**Required fixes:**
- **P-F1 · the lockup sits on the slip's edge in P2/P3.**
  - **The problem:** take the concept's own numbers. The P2 crop puts box (53, 241) at (360, 400), at ×2.6, with the pad at −6°; that same rotation gives P0's stated slip corner at (530, 1005). The slip's left edge then runs from about (296, 1110) to (323, 1370), down the left end of the lockup box. Mock panel 2 shows it touching "Your" and crossing the tier.
  - **Worst case:** L2a's *needed something.* starts at x 190 (692 px) and would cross the edge hairline and the paper/desk boundary.
  - **Fix:** move the P2/P3 anchor so the edge sits at x ≤ 200 across y 1080-1400. For example, box centre to (260, 400) with the accent starting at x ≥ 220; it ends by x 912, inside 940. Or set the accent at 96 px (about 604 px).
- **T-F1 · the voice rule in the wordless beat (f212-248).**
  - **The problem:** P0 shows the printed header "WHILE YOU WERE OUT" (about 32 px caps) and the labels with no voice for 1.2 s.
  - **In b2:** the P2 labels NAME, NUMBER, ANSWERED and MESSAGE are 31 px and unspoken. They are said 3-11 s later. The concept's "over 32 px only in its spoken beat" threshold equals the transcript tier's own size, so it doesn't make the labels unreadable.
  - **Fix:** in b3, frame the header out (or hold P0 with the header off the top edge). For b2, **owner decision:** either printed object labels count as "text" (then zoom P2 so the labels are ≤ 20 px while the box stays ≥ 50 px), or they don't (record the ruling).
- **T-F2 · the TikTok B hook** "Three calls on your receptionist's lunch break. Not one name." covers a receptionist's line while she is away, which is the forwarding reading (U5-adjacent).
  - Only with R3's caption and pinned comment.
  - Prefer the A hook on both apps.
- **P-F2 · a timing contradiction.**
  - **The conflict:** the beat table says `ig6-02` "must end by f204", but §4.3's pickup rule only moves the ring if it ends after f219.
  - **At 2.5 w/s:** the take ends at about f208, the ring stays at f225, and the CTA ends at about f734 (31 f spare).
  - **Fix:** use f219 in `timing.ts`.

**Recommended:**
- Split the L1 and L5 tiers (R9).
- Word the reply "Does it text me?" as "Your team gets it by text or email, depending on how you set each contact, and it's in your Inbox."

### 4.3 clock "Every second" · Truth 7 · Production 6

**Claims:**

| Line / picture | Verdict | Source |
|---|---|---|
| "One ring, six seconds." + 2 s bands, 4 s gaps | **A**, a standard; **US and Canada only** | zytrax (re-fetched), ANSI T1.401-1988 §5.4.2; ETSI 1 on / 4 off |
| "You can't answer." | scene | none |
| "And every second it rings, someone's still waiting." | true by definition (S20) | RESEARCH-product §6 |
| "A missed call is someone else's customer." | opinion; `voice.md` position 1 reworded ("A missed call is a customer who called someone else"); never a % | S21 |
| "Your AI receptionist picks up on the first ring." | **B, and here it is quantified by the reel itself** (T-C1) | `site.ts:713`; `ai-agents.ts:40` |
| "It answers from your words, day or night." | **A** | S6, S4 |
| "Ring it yourself." | **A** (5 trial test calls a day, unbilled) | `site.ts:1813`; `entitlements.ts`; `usage.ts:623` |
| A ten-ring time-lapse ("a full minute of rings", in the concept's own words) | picture only (T-C4) | F-U8 |

**Required fixes:**
- **T-C1 · the speed number by construction.**
  - **The problem:** the hook teaches "one ring = six seconds"; twelve seconds later the payoff says "picks up on the first ring". The viewer's arithmetic gives "answers within six seconds", a number on our speed (U3). RESEARCH-product §2.1 says don't "build a picture that implies either"; §6 says don't "juxtapose S1 with a measured figure as if it were our latency". The hub macro with no dial and the stopped ticks hide the picture but not the words.
  - **Fix:** `ig6-04d` "It picks up, day or night." plus `ig6-05w` "It answers from your words." become the **default** takes. The "first ring" take ships only after R2's check passes on a **US or Canada** agent number and is logged. If the owner's live number is not in the US or Canada, `04d` is mandatory.
- **T-C2 · the TikTok caption** "One ring is six seconds. An AI receptionist that picks up on the first ring." puts the same chain in two adjacent sentences of text.
  - **Fix:** "One ring is six seconds (the North American ring). An AI receptionist that answers from your words, day or night."
- **T-C3 · the pinned reply.** Replace "Yours may ring a little faster." with "That's the North American ring: 2 s on, 4 s off (ANSI T1.401). Europe's standard is 1 s on, 4 s off, and some countries use their own."
- **T-C4 · the ten-ring sweep.** It passes only because nothing is said, numbered or captioned. How long a line rings before voicemail is unsourced (F-U8). Keep "a minute" out of the VO, the caption and the replies, and keep numerals off the dial.
- **P-C1 · fit.**
  - **26.0 s at 2.5 w/s:** misses the CTA deadline by about 35 f (`ig6-07` ends about f740 against f705).
  - **26.0 s with T1 or with `04d` + `05w`:** misses by 1-5 f.
  - **Fix:** plan at **28.0 s** (impact f780) from the start. It then fits at both rates with "Ring it yourself." kept. (The concept lists 28.0 s only as a fallback.)
  - **Beat crunches at 2.5:**
    - b1 has no spare frame before "And" (f100).
    - `ig6-03` ends about f328, into the f322 near-silence and the f330 whip. Anchor the whip to her last word + 8 f.
    - `ig6-04` (about f382-494) runs into `ig6-05`'s plan start (f478).
- **P-C2 · zones.**
  - **Shot J:** the ticks hang to y ≈ 1030 across the full width, so they run under the rail (x > 880, y 840-1030). Clip them there.
  - **Shot E:** the rim's bottom is at y 1070, 10 px above the lockup box, and its 48 px long shadow falls into the box. Drop the shadow on the full-dial rim, or raise the dial 40 px.
- **P-C3 · split the S2, S4 and S5 tiers** (R9).

**Approved:** the style judge's rewrite `ig6-02` "And while it rings, someone's still waiting." is true by definition and keeps the open loop.

**Build:**
- Feasible on the ig5 route.
- This is the second-heaviest build: a 380-mark dial window, the ×200 push through node 2, a numerically solved reading point, a sweep phase-locked at 144°/s, and a seam that matches velocity.
- Probe the push-through first (STYLE fallback: a T3 whip).

### 4.4 phone "Off the hook" · Truth 6.5 · Production 4.5

**Claims:**

| Line / picture | Verdict | Source |
|---|---|---|
| "Your receptionist can't be in two places." / "Neither can you." / "You're both off the hook." | opinion and idiom | none |
| "Our AI receptionist picks up on the first ring." | **B**, plus a "Ring it yourself." dare (T-P3) | `ai-agents.ts:40`; `site.ts:713` |
| "Lunch rush. After closing. At 3 a.m." | **A** as times (`call.ts:17` "in the middle of a rush") | but see T-P2 |
| "It answers from your words. It takes the message." | **A** | S6, S8 |
| "Every caller hears it's an AI." | **A** | `site.ts:2527`; S11 |
| "Ring it yourself." | **A** | S17 |
| The front-desk phone answers itself on its first ring | **U5-adjacent** (T-P1) | `site.ts:1932` (no porting); RESEARCH-product §2.2 |

**Required fixes:**
- **T-P1 · takeover reading.**
  - **The problem:** the hero is a desk phone at the front desk, and the hook makes it the receptionist's line. No product feature routes the business's own line to the agent: no forwarding, no porting. The only true reading is the agent's **own** number used as the front line, putting callers through to people when needed (S10).
  - **Fix:** R3 in full: caption, pinned comment, reply bank "It has its own number, next to your line. No porting." No line buttons, hold or busy states, ever.
- **T-P2 · "Lunch rush."**
  - **The problem:** right after "can't be in two places", it reads as overflow from a busy receptionist's line. That is RESEARCH-viral's S2 risk ("It implies that calls overflow from the business's line to the AI").
  - **Fix:** replace it with "On a Sunday." (site copy, `call.ts:17`, same two words) so the montage is about times, not overload.
- **T-P3 · the launch check is mandatory** (growth judge's G5, with R2's specification). The fallback is `ig6-03d` "Our AI receptionist picks up."
- **P-P1 · fit (blocking as drafted).**
  - **The draft:** 54 words. The 28.0 s plan misses the CTA deadline by about 90 f at 2.5 w/s, and by about 26 f even at 2.78 under the beat sheet's own gaps. (The concept's "CTA ends around f720-740" ignores the slip that builds from b1.)
  - **Beats shorter than their lines at 2.5 w/s:** b1 (2.7 s for a 2.8 s line that starts at 0.33 s), b3, b5 and b5c.
  - **G3's 26.0 s cut:** fails at both rates (+69 f at 2.5, +11 f at 2.78). **Veto the length.** **Accept** cutting `ig6-06` at 28.0 s: the disclosure stays in the fine print, the pinned comment and the replies. It is product behaviour, not a required on-screen line.
  - **G3 at 28.0 s:** still misses by about 9 f at 2.5 w/s. **Also drop `ig6-08` "Ring it yourself."** (the concept's own trim 2). That leaves 43 words and 30 f spare, and it removes the dare that makes T-P3 risky.
- **P-P2 · cover.**
  - **The problem:** the title *in two places.* at 140 px measures about 714 px in the concept's own mock (x ≈ 234-948). That is past the cover box (x 900) and the safe line (x 940). The concept's figure of 657 px doesn't match its mock.
  - **Fix:** set it at 126 px or less, or reflow it.
- **P-P3 · the M5 reveal.** In the mock the base reaches x ≈ 936 at y 840-1056; the concept claims x ≤ 880. That is inside 940 but breaks the series object rule. Shrink the phone 5 % or shift it 50 px left.
- **P-P4 · split the `ig6-03` tier** (R9).

**Recommended:**
- **A reply for the "off the hook" pun:** an older viewer may know "off the hook" as "busy signal". Suggested: "Off the hook as in: you don't have to grab it. The agent's mid-call."
- **Growth reply bank:** "it takes the phone" becomes "it answers the calls to its own number".
- **Build risk is the highest of the four:**
  - a procedural coiled cord with a colour wipe;
  - the cord straightening into an underline, which hands it from one depth plane to another;
  - two drawings of one handset;
  - nine sound events in 3.6 s around three short takes;
  - the concept's own 14-item risk list.

---

## 5. Words per beat at 2.5 words/s

Speech time = words ÷ 2.5. "Lead-in" = the frames before her first word in that beat.

**clock** (47 words, 18.8 s of speech; drafted at 26.0 s)

| Beat | Window | Words | Speech | Fit |
|---|---|---|---|---|
| b1 hook | 0-94 (3.1 s) | 7 | 2.8 s + 0.33 lead-in | full, 0 spare |
| b2 every second | 94-232 (4.6 s) | 8 | 3.2 s + about 1 s ring hold | ok |
| b3 missed | 232-330 (3.3 s) | 7 | 2.8 s from f240 | over by about 0.2 s into the near-silence |
| b4 pickup | 330-470 (4.7 s) | 9 | 3.6 s after the 1.3 s wordless beat | over by 0.3-0.8 s |
| b5 words | 470-570 (3.3 s) | 8 | 3.2 s | full |
| b6 ring it | 570-618 (1.6 s) | 3 | 1.2 s | only if nothing slips |
| b7 CTA | 618-720 (3.4 s) | 5 | 2.0 s | ok |

**phone** (54 words, 21.6 s of speech; drafted at 28.0 s)

| Beat | Window | Words | Speech | Fit |
|---|---|---|---|---|
| b1 hook | 0-81 (2.7 s) | 7 | 2.8 s + 0.33 | **over about 0.4 s** (into the whip) |
| b2 kicker | 81-135 (1.8 s) | 3 | 1.2 s | ok if b1 is on time |
| b3 pickup | 135-240 (3.5 s) | 9 | 3.6 s from f142 | **over about 0.3 s** |
| b4 montage | 240-348 (3.6 s) | 7 (3 takes) | 2.8 s + 3 lead-ins | tight |
| b5 words | 348-456 (3.6 s) | 9 | 3.6 s from f360 | **over about 0.4 s** |
| b5c it's an AI | 456-526 (2.3 s) | 6 | 2.4 s from f462 | **over about 0.3 s** |
| b6 reveal | 526-645 (4.0 s) | 5 | 2.0 s | ok |
| b7 CTA | 645-780 (4.5 s) | 8 | 3.2 s + dial + zoom + field | tight |

**sign** (44 words, 17.6 s of speech; drafted at 28.0 s)

| Beat | Window | Words | Speech | Fit |
|---|---|---|---|---|
| b1 hook | 0-96 (3.2 s) | 7 | 2.8 s + 0.33 | ok, about 0 spare |
| b2 night | 96-252 (5.2 s) | 6 (3 pieces) | 3 × 0.8 s; each piece ends 28 f after its start, against the 29 f limit | ok, borderline |
| b3 turn | 252-330 (2.6 s) | 5 | 2.0 s from f270 | full |
| b4 door | 330-451 (4.0 s) | 8 | 3.2 s + lockup hold + exit before the tilt | tight |
| b5 pickup | 451-576 (4.2 s) | 8 | 3.2 s after the 1.3 s wordless beat | over about 0.3 s |
| b6 morning | 576-656 (2.7 s) | 5 | 2.0 s from f592 | ok |
| b7 CTA | 656-780 (4.1 s) | 5 | 2.0 s | ok |

**free** (45 words, 18.0 s of speech; drafted at 28.0 s)

| Beat | Window | Words | Speech | Fit |
|---|---|---|---|---|
| b1 hook | 0-112 (3.7 s) | 8 | 3.2 s + 0.33 | ok |
| b2 blank | 112-212 (3.3 s) | 7 | 2.8 s from f120 (ends about f208) | ok under the f219 rule |
| b3 pickup | 212-250 (1.3 s) | 0 | wordless | ok (≤ 1.5 s) |
| b4 picks up | 240-315 (2.5 s) | 5 | 2.0 s from f250 | ok |
| b5 answered | 315-450 (4.5 s) | 9 (2 takes) | 3.6 s + the pull-back | ok |
| b6 fields | 450-555 (3.5 s) | 6 | 2.4 s | ok |
| b7 sent | 555-645 (3.0 s) | 5 | 2.0 s | ok |
| b8 CTA | 645-780 (4.5 s) | 5 | 2.0 s | ok |

**Hook inside 0-2 s, with a frame-0 card readable muted:**
- **All four:** yes. Each lockup is set at 72 % at f0.
- **Keyword "AI receptionist" heard at:** phone ≈ 5 s ("receptionist" ≈ 0.4 s), free ≈ 8.3 s, clock ≈ 12.5 s, sign ≈ 16.5 s. This is a growth issue, not a truth issue.

---

## 6. Voice-over fit (`fit.py`; CTA deadline = impact − 15 f)

| Variant | Words | At 2.5 w/s | At 2.78 w/s |
|---|---|---|---|
| clock 26.0 s as drafted | 47 | **+35 f over** | ok, 4 f spare |
| clock 26.0 s, T1 (no "Ring it yourself.") | 44 | about 1 f spare (no margin) | ok |
| clock 26.0 s with `04d` + `05w` | 41 | +5 f over | ok, 5 f spare |
| **clock 28.0 s** (recommended) | 41-47 | ok (1-25 f spare with the CTA take starting f676-700; spend the extra bar on holds before b7) | ok (7-30 f spare) |
| phone 28.0 s as drafted | 54 | **+91 f over** | **+26 f over** |
| phone 26.0 s, G3 (no `ig6-06`) | 48 | **+69 f over** | +11 f over |
| phone 28.0 s, G3 | 48 | +9 f over | ok, 49 f spare |
| **phone 28.0 s, G3 + no `ig6-08`** (recommended) | 43 | ok, 30 f spare | ok, 83 f spare |
| sign 28.0 s as drafted | 44 | +28 f over | ok, 10 f spare |
| **sign 28.0 s, T1 (no `ig6-06`)** (recommended at 2.5) | 39 | ok, 56 f spare | ok, 83 f spare |
| **free 28.0 s as drafted** | 45 | ok, 31 f spare | ok, 43 f spare |

**Rule for the build:** `timing.ts` must assert the CTA deadline on the **measured** takes, and apply the trims in the order given above. Never squeeze a pickup, a ring gap or the seam to make a line fit.

---

## 7. Zones (text x 60-940, y 220-1440; objects x ≤ 880 below y 840; lockup box clear of object strokes)

| | Text zone | Objects vs the rail | Lockup box clear |
|---|---|---|---|
| clock | ✓ (accent ≤ 900; end card y 700-1060; field x 174-906) | ✗ minor: shot J ticks reach y 1030 across the full width | ✗ minor: shot E rim at 1070 + shadow |
| phone | ✓ in the reel; **✗ cover title at x ≈ 948** | ✗ minor: M5 base at x ≈ 936 (mock) | ✓ (P1 handset 70-130 px clear) |
| sign | ✓ (lettering x 160-889) | **✗ S1/S2 card to x 1030 / 1110 below y 840** | **✗ S2 card bottom at 1077 + swing + shadow** |
| free | ✓ (lockups x 190-900) | ✓ | **✗ P2/P3 slip edge at x ≈ 296-323 under the lockup** |

Each concept also needs an ig6 copy of ig5's `zones.ts` guard, plus a still-frame overlap check of the lockup box against the object layers. The series guard tests text against the frame only.

---

## 8. Other judges' fixes, ruled on truth

| Fix | From | Ruling |
|---|---|---|
| `ig6-02` "And while it rings, someone's still waiting." | style judge, clock | **approved**: true by definition |
| G1: "Our AI / *receptionist*" big lockup | growth, phone | **approved**: no new claim |
| G2: a punch-in instead of the whip in b2 | growth, phone | no truth effect |
| G3: cut `ig6-06` | growth, phone | **approved at 28.0 s**; **26.0 s vetoed** on fit (§6) |
| G4: caption question + reply bank | growth, phone | **approved**, with the edits in T-P1 and the "Recommended" list. The caption's first line ("…picks up on the first ring.") ships only after R2 passes; otherwise "…picks up, from answers you write once." |
| G5: the launch check | growth, phone | **required**, using R2's spec (same-country number, a cold call, logged) |

---

## 9. Owner items outside ig6 that the reel depends on

1. **The bio overclaims on both apps** (`profile.md:12-15`; TikTok's is "identical"):
   - "Every call answered, in every language." breaks U2 and U7.
   - "AI agents deployed in 5 minutes - worldwide." breaks U8, and numbers are sold in 21 countries (U20).

   Every TikTok reel that says "link in bio" sends viewers straight to it. Suggested bio, from SAFE lines only: "AI receptionist for small businesses. Answers from your words, day or night. 14 languages. Ready in under ten minutes." This is not blocking, but strongly recommended before ig6 posts.
2. **The launch check needs a live agent number.** Confirm which country it is in. For the clock's "first ring" take it must be in the US or Canada (R2).
3. **AGENT delivery on posting day, on each app** (R4).
4. **Site copy already flagged in RESEARCH-product §9** still stands. The same "point your calls at it" framing also sits in `ai-agents.ts:40` ("Point your calls at an agent…").
