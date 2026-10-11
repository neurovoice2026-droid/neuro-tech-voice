# ig6 · judge: viewer panel (the first 3 seconds)

Label `judge:viewers`. Written 2026-10-11 on `claude/remotion-trailer` (HEAD `9cb3bc8`). Planning only: this is the only file written. No code, no voice, no Cartesia call, nothing committed.

**What this judges:** only frames 0-90 (0.0-3.0 s) of each concept, as a TikTok viewer meets them in the For You feed. The panel scores four things, each 0-10, harshly (5 is a coin flip, 10 is certain):
- **Stop:** the thumb pauses in the first second.
- **Stay:** still watching at 3.0 s and about to keep going.
- **Trust:** at 3.0 s it feels honest and worth the time, not a pitch, a scam or AI slop.
- **Act:** at 3.0 s, any intent to like, comment, send, save, follow or remember the name.

**Read:** the four drafts (`concept-clock.md`, `concept-phone.md`, `concept-sign.md`, `concept-free.md`), §1-§2 of each in detail. I also viewed the frame-0 layout mocks (`scratchpad/ref6an/mock.png`, `ig6phone/mocks_v2.png`, `ig6sign/f0.png`, `ig6free/mocks_concept_free.png`), plus `.claude/instagram/profile.md` (TikTok table), `judge-growth.md` and `judge-style.md`. The mocks are geometry checks, not the final art.

**Limits:** one model plays four people. These are informed guesses, not audience data, and they cover 3 s of a 26-28 s reel. The clock's main strength (ring 2 landing exactly six seconds after ring 1) happens at 6.0 s, after this window. The retention graph overrides everything here.

---

## 1. Scores

Each cell reads **Stop / Stay / Trust / Act = total** (out of 40 per viewer).

| Viewer (sound) | Clock "Every second" | Phone "Off the hook" | Sign "The other side" | Free "While you were out" | Best | Worst |
|---|---|---|---|---|---|---|
| **Mara**, salon owner, 22:30 in bed (sound on half the time) | 5 / 4 / 6 / 1 = **16** | 7 / 5 / 6 / 2 = **20** | 7 / 6 / 5 / 3 = **21** | 4 / 4 / 6 / 1 = **15** | **Sign** | **Free** |
| **Dana**, dental practice manager, lunch break (sound OFF) | 4 / 3 / 6 / 1 = **14** | 6 / 6 / 6 / 3 = **21** | 7 / 5 / 5 / 1 = **18** | 5 / 5 / 5 / 2 = **17** | **Phone** | **Clock** |
| **Gaz**, sole-trader plumber in his van (sound on, no patience) | 5 / 3 / 5 / 0 = **13** | 7 / 2 / 5 / 0 = **14** | 5 / 3 / 4 / 0 = **12** | 4 / 4 / 5 / 1 = **14** | **Free** (tie-break) | **Sign** |
| **The 0.8-s scroller**, generic, no business (sound either way) | 5 / 4 / 6 / 2 = **17** | 6 / 3 / 5 / 1 = **15** | 5 / 3 / 5 / 1 = **14** | 4 / 3 / 6 / 1 = **14** | **Clock** | **Free** (tie-break) |
| **Panel total** (/160) | **60** | **70** | **65** | **60** | | |
| **Rank** | **4** | **1** | **2** | **3** | | |

**Tie-break rule** (used for Gaz, the scroller, and clock against free): Stay, then Stop, then Trust, then Act. A thumb that stops and then leaves at 1.5 s still counts as a skip, so holding to 3 s matters more than the stop.

**By metric** (sum of the four viewers, out of 40):

| Metric | Clock | Phone | Sign | Free |
|---|---|---|---|---|
| Stop | 19 | **26** | 24 | 17 |
| Stay | 14 | 16 | **17** | 16 |
| Trust | **23** | 22 | 19 | 22 |
| Act | 4 | **6** | 5 | 5 |

**What the panel says in four lines:**
1. **Phone stops best.** A ringing handset that rattles on a ring sound is the one picture that matches the sound at f0.
2. **Sign holds best and wins the muted read.** CLOSED plus "Your phone's *still open.*" is a complete thought in under a second, with or without sound.
3. **Clock has the most trust and the weakest hold.** It reads as a design piece, not an ad, but with the sound off, "ring" doesn't mean a phone until the 32 px line, and the payoff comes at 6.0 s.
4. **Nobody acts at 3 s** (4-6 out of 40 everywhere). Act is decided by the CTA, so it doesn't separate the concepts here.

---

## 2. The panel

| | Mara | Dana | Gaz | The 0.8-s scroller |
|---|---|---|---|---|
| **Who** | 38, owns a four-chair salon. A part-time front-desk hire on Saturdays; on other days she answers the phone herself, often with gloves on. | 45, runs the front office of a three-dentist practice with two receptionists. She chooses and buys the software. | 47, sole trader, sometimes with a mate. No office; his phone is the business line. | Anyone. No business, no reason to care about phones. |
| **Where, when** | In bed at 22:30, tired, scrolling to switch off. Sound on half the time. | Lunch at her desk. Sound OFF (the waiting room is next door). She reads the big type first and the small grey line only once she has stopped. | In the van between jobs, phone on the dash mount, sound on. Swipes within a second if it isn't about him. | Thumb already moving. Decides in about 0.8 s from the picture, the biggest word and maybe the first sound. Hears at most one or two words. |
| **Stops for** | Things that feel like her day; anything that sounds like her own phone ringing. | Front-desk pain she lives with; a clean, sound-off-readable card. | A phone ringing; his own problem said plainly. | Motion, a striking shape, a familiar symbol, white in a dark feed. |
| **Swipes on** | Tech jargon, "AI", anything that sounds like a sales call. | Anything that blames her staff or would worry patients. | Polished ads, a calm ad voice, "receptionist" (he has none), anything that feels like an office. | Text walls, business talk, a still frame. |

**Shared by all four concepts, so it doesn't separate them:**
- **The same ring at f0** (`fx-trill`).
- **The same look:** white ground, black object, teal italic.
- **No face.**
- **The calm female VO.**

For Gaz the last three together read as "ad". That costs every concept about one point of Stay with him.

---

## 3. Concept by concept (as each one plays from f0 to f90)

### 3.1 Clock "Every second"

**What plays:**
- **Picture:** a giant cropped clock face with a teal rim arc and a black hand with a hollow-diamond tip. A white-centred node arrives under the needle as the dial steps (f0), then the dial steps again on f30, f60 and f90.
- **Sound:** the trill at f0, then ticks.
- **Type:** big **One ring,** / ***six seconds.*** with the small tier "One ring, six seconds. / You can't answer.".
- **Voice:** Tessa from f10: "One ring, six seconds. You can't answer." ("six seconds" heard by ≈ 1.7 s; the line ends ≈ 2.9 s).

| Viewer | In character, 0-3 s | S / St / T / A |
|---|---|---|
| **Mara** | Sound on: "Is that my phone? No... a clock. Pretty." "You can't answer": "no, I'm doing a balayage." "Six seconds, so what?" Sound off: a lovely clock and "One ring, six seconds", "Is this a watch ad?" | 5 / 4 / 6 / 1 |
| **Dana** | Muted, she sees a clock and "One ring, *six seconds.*". With no sound, "ring" could mean anything; only the grey "You can't answer." makes it a phone. The dial ticks, but no new words come until ≈ 3.5 s. "Productivity content." Scrolls on around 2.5 s. | 4 / 3 / 6 / 1 |
| **Gaz** | The ring makes him glance at his own phone. Then a clock: "watch ad". "One ring, six seconds" is trivia, not his problem. "You can't answer" is true (he's under a sink), but he's already moving his thumb as the ticking starts. | 5 / 3 / 5 / 0 |
| **Scroller** | The best-looking frame of the four: a huge black hand sweeping a white dial, the trending look. The step at f0 is a real move, but the frame is almost still from f8 to f24. If they stop, "six seconds" promises some trivia; designers stay, most people don't. Reads as content, not an ad. | 5 / 4 / 6 / 2 |

**The panel's note:** the hero object says "time", and only the sound says "phone". Muted viewers (Dana, Mara half the time) have no phone in the picture. **Ask:** give the ring node an on-object ring cue: two or three hairline arcs pulse off the node on each ring, the same convention as the phone draft's ring arcs, in `#222222` → `#D6D6D6` and stroke-drawn, never a glow. That keeps one object and lets a muted viewer read "ringing" at f0. A second option is to put "You can't answer." in the big tier, but that spends the six-seconds card.

### 3.2 Phone "Off the hook"

**What plays:**
- **Picture:** a macro of a black handset rattling in its cradle on the ring's "on" phase (f0-60), with hairline ring arcs drawing out twice.
- **Type:** big **Can't be** / ***in two places.*** with the small tier "Your receptionist can't be / in two places.".
- **Voice:** Tessa from f10: "Your receptionist can't be in two places." ("receptionist" heard at ≈ 0.4-0.9 s; the line ends ≈ 2.7 s).
- **2.6-2.8 s:** a whip to a ×3.2 macro of the coiled cord.
- **3.0 s:** "Neither can you." starts.

| Viewer | In character, 0-3 s | S / St / T / A |
|---|---|---|
| **Mara** | Sound on: a phone ringing *and* a phone shaking, the strongest "pick up!" moment of the four. "Your receptionist": "I am the receptionist, five days out of seven." She half-stays. "Neither can you" arrives right as the window closes. Sound off: the shaking phone and "Can't be *in two places.*", "story of my life". | 7 / 5 / 6 / 2 |
| **Dana** | Muted, she reads a ringing phone at once (the arcs and the rattle are the universal sign) and "Can't be *in two places.*". Then the grey line: "Your receptionist...". That's her front desk at 8:15. It sides with her staff, which she likes. The whip into black coils at 2.6 s loses her for a moment ("what's that, a spring?"). She might send it to her lead receptionist. | 6 / 6 / 6 / 3 |
| **Gaz** | A ringing old phone: he stops. "Your receptionist..." "I haven't got one, mate." Gone at about 1.5 s. "Neither can you." (3.0 s) would have caught him, but it comes too late. | 7 / 2 / 5 / 0 |
| **Scroller** | The handset with ring arcs is the most instantly legible symbol here, and it is the only frame 0 that moves continuously. But at 0.8 s they hear "Your receptionist", which says business content. Swipe. | 6 / 3 / 5 / 1 |

**The panel's notes:**
1. **The f0 picture is the panel's best stop. Keep it.** One fix from the mock (`ig6phone/mocks_v2.png`, panel 1): the mouthpiece cup re-enters at the lower left as a **separate black shape** under the lockup box. At a glance that's two blobs, not one handset. Rotate or zoom P1 so the handset leaves frame once, cleanly, or so the mouthpiece is fully off-frame.
2. **The panel agrees with growth's G2** (`judge-growth.md` §4). Dana, muted, loses the object in the coil macro at 2.6 s. Stay on the handset through the 3-second window.
3. **"receptionist" at 0.4 s wins Dana and loses Gaz.** The account's data favours the keyword (ig1: 563 views against ≤ 283, `profile.md`), and the phone draft itself says owners who are their own front desk are a large share of its audience (§7.1). **Test for owner-operators** (a TikTok B a week later, or swap it with growth's planned B): **"You can't be in two places. Neither can your receptionist."**
   - hookscore **80.8 raw / 84.4 patched** (STRONG), run 2026-10-11 from `scratchpad/judge6v/`.
   - It is 10 words (≈ 3.6 s). "You" lands at 0.3 s for Gaz and Mara, but "receptionist" moves from ≈ 0.4 s to ≈ 3.5 s. That is why it's the B and not the A.
   - The big tier "Can't be / *in two places.*" stays the same (its words are still spoken). b2's "Neither can you." then goes, since the hook already says it.
   - It makes no claim and stays pro-staff: both of them can't, and nobody is replaced.

### 3.3 Sign "The other side"

**What plays:**
- **Picture:** a white hanging sign lands mid-flip on **CLOSED** (150 px black caps), swinging on its cords.
- **Sound:** the trill at f0, the card's tap at f5, a soft creak.
- **Type:** big **Your phone's** / ***still open.*** with the tier "Closed at 6. Your phone's still open.".
- **Voice:** Tessa from f10: "Closed at six. Your phone's still open." ("Closed at six" heard by ≈ 1.0 s; the line ends ≈ 2.9 s).
- **f29:** a punch-in on "six".
- **After the window:** the dolly to the clock starts at f96.

| Viewer | In character, 0-3 s | S / St / T / A |
|---|---|---|
| **Mara** | It's 22:30, she closed hours ago, and the video is about right now. Muted, CLOSED plus "Your phone's *still open.*" lands in under a second, the best silent read of the four. Sound on, the ring under a CLOSED sign is "that's my evening". Two frictions: she closes at seven, not six, and she has heard this pitch from an answering-service salesman. Most likely of the four to get a "this is me rn" comment. | 7 / 6 / 5 / 3 |
| **Dana** | Muted: CLOSED, "Your phone's still open." Clear in one look. But the practice already has an after-hours voicemail and an on-call line, so she reads it as "solved". And the CLOSED sign plus ringing phone is the stock image of every answering-service ad she has binned. Clear, but she's not curious. | 7 / 5 / 5 / 1 |
| **Gaz** | A shop sign: not his world, he has no door. "Closed at six": he works till the job's done. "Your phone's still open": is that a problem or the point? His late calls are the emergency jobs he wants. And it's the answering-service ad he gets cold-called about. | 5 / 3 / 4 / 0 |
| **Scroller** | CLOSED is the biggest, most readable word in any frame 0, and the flip and swing move. But it's a shop sign, and reading the second tier takes more than 0.8 s. "Phone's still open" is business talk. | 5 / 3 / 5 / 1 |

**The panel's notes:**
1. **The best muted logic of the four:** the object's own word, contradicted by the accent phrase. If another concept wins, borrow the principle: the big tier plus the picture must finish the thought with the sound off.
2. **The trust cost is the trope.** A CLOSED sign with a ringing phone is the stock answering-service ad. Mara and Dana both spotted the pitch, and Gaz assumed it. "The other side says open" (8.4 s) is the fresh idea, but it is outside this window.
3. **"Six" is a mild mismatch for salons.** It is harmless, but it puts Mara slightly outside the scene. It is not worth changing: the number is what gives the hook its 84.4.

### 3.4 Free "While you were out"

**What plays:**
- **Picture:** the corner of a message pad, cropped top and right, with a resting black fountain pen at the lower left. Slip A is 40 % torn at f0 and slides off by f24; slips B and C tear at f30 and f60.
- **Sound:** the trill and `fx-tear` at f0.
- **Type:** big **Three calls.** / ***No names.*** with the tier "Three calls while you were out. / No names.". The header WHILE YOU WERE OUT is 32 px; the field labels are 12 px.
- **Voice:** Tessa from f10: "Three calls while you were out. No names." ("while you were out" by ≈ 2.2 s; "No names" ≈ 2.7 s).

| Viewer | In character, 0-3 s | S / St / T / A |
|---|---|---|
| **Mara** | Sound on, the rip is a nice ASMR sound. The picture is mostly white with a pad in the corner: "stationery ad?" "While you were out": she's never out, she's *in*, hands full. "No names": the salon phone shows numbers. Gentle and honest, but not her. | 4 / 4 / 6 / 1 |
| **Dana** | She knows these pads; her desk still has one. "Three calls. *No names.*" is her nightmare slip. But at a glance it reads as a dig at her receptionists, and she bristles slightly. The field labels are too small to read, so she needs a beat to recognise the pad. The slips tearing every second keep her eye. | 5 / 5 / 5 / 2 |
| **Gaz** | Stationery: an office thing, and the rip under the ring muddies the ring. But "Three calls while you were out" at 2.2 s is his day exactly; he's always out. That line holds him longer than any other concept's. "No names": his phone shows the numbers, so the pain is half his. | 4 / 4 / 5 / 1 |
| **Scroller** | The sparsest frame of the four: a small pad in the top-right corner, unreadable labels, a pen, lots of white. The slip flying off is the only event in 0.8 s. Reads as gentle content, not an ad, but there's little to stop for. | 4 / 3 / 6 / 1 |

**The panel's notes:**
1. **Frame 0 is too far away for a feed.** The only readable printed word is the 32 px header. Push P0 in (about ×1.6) so WHILE YOU WERE OUT reads at about 45 px (it's spoken in the hook, so it's allowed above 32 px) and the tear is a big event, not a corner event. Check the lockup box stays clear.
2. **"No names" splits the panel:** Dana hears blame on her desk, and Gaz says his phone shows numbers. "Three calls while you were out" carries the concept; "No names" is its weakest half.

---

## 4. Each viewer's best and worst

| Viewer | Best | Why | Worst | Why | What would lift the worst |
|---|---|---|---|---|---|
| **Mara** (salon, 22:30) | **Sign** (21) | It's about her exact moment. Muted or not, CLOSED plus "*still open.*" lands in under a second, and she is most likely to comment. | **Free** (15) | A far, sparse frame, and "while you were out" isn't her: she's in, gloves on. | A tighter P0 crop. Her pain is "hands full", not "out", so the scene can't fully fix it. |
| **Dana** (practice manager, muted) | **Phone** (21) | A ringing phone reads silently, "Can't be in two places" is her front desk, and it defends her staff. The only concept she might send on. | **Clock** (14) | With no sound, "One ring" isn't a phone; it reads as productivity content. | Ring arcs pulsing off the node (§3.1), so "ringing" reads in the picture. |
| **Gaz** (plumber, sound on) | **Free** (14, ties phone; wins on Stay) | "Three calls while you were out" is the only first line that describes his day. | **Sign** (12) | A shop door isn't his world, "phone's still open" is ambiguous for someone whose late calls are his best jobs, and it's the ad he already ignores. | Nothing small. His real fix is in the phone: lead with "You" (the §3.2 B hook), which would take the phone from 14 to about 18 for him. |
| **0.8-s scroller** | **Clock** (17) | The most striking graphic, and it reads as a design piece, not an ad, because no business word arrives in 0.8 s. | **Free** (14, ties sign; loses on Stop) | A small object in a corner of white, with almost nothing to read. | The ×1.6 push-in (§3.4). |

---

## 5. What the panel tells the synthesis (first 3 s only)

1. **The picture must match the f0 ring.** All four ring at f0, so sound-on stops are shared, and the picture decides:
   - phone: a ringing handset;
   - sign: a ring under CLOSED;
   - free: a ring plus a tear;
   - clock: a ring plus a clock.
   That order is the Stop order for the sound-on viewers.
2. **Muted, only the big tier and the picture count.** The 32 px sentence tier is read only by someone who has already stopped (Dana yes, the scroller never). Read on big type plus picture alone:
   - Sign: completes the thought.
   - Phone: completes it with the picture's help ("Can't be in two places" next to a ringing phone).
   - Free: half-completes it ("Three calls. No names.").
   - Clock: doesn't ("One ring, six seconds." with no phone in sight).
3. **"receptionist" at 0.4 s is a trade, not a free win.** It gains the account's proven keyword and the manager with staff, and loses the owner-operator in the first second. Keep it in the A cut if the phone wins (the account data is the only data we have). Run the "You..." version as a B so the account learns which audience it actually reaches.
4. **No concept says "AI" in the first 3 s.** That is good for trust; nobody hit the AI-slop reflex. Keep it that way.
5. **Polish plus a calm narrator reads as "ad" to the impatient trade viewer** in all four. It is a cost of the requested style, not of any one concept. The only lever inside the style is the first spoken words: they must be his problem, in his words, inside 1.5 s.
6. **Act is flat at 3 s (4-6 out of 40).** Don't use it to choose. Judge the CTA on the full reel.

**Overall:** on the first 3 s alone, **Phone** leads (70), then **Sign** (65), then **Free** and **Clock** (60 each; free ahead on Stay). This panel can't see the clock's six-second payoff or any concept's loop. Weigh it as the opening-seconds input alongside the style and growth judges, not as the verdict.
