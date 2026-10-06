# Judge: production, brand, honesty (`judge:production`)

Label `judge:production`. Written 2026-10-06 at HEAD `0cc910b` (`claude/remotion-trailer`). Planning only: this file is the only one I wrote.
Inputs: `docs/ig/RESEARCH-product.md`, `docs/ig/RESEARCH-reels.md`, `docs/ig/drafts/concepts-A.md`, `-B.md`, `-C.md`. I re-checked the facts that decide a score in the site and trailer source (paths below; `lib/`, `components/` are at the repo root, `src/`, `scripts/` are under `trailer/`).

**My lens.** Can the reel be built to the house standard in a few hours on top of film 2's kit (Remotion, 1080×1920 at 120 fps, 20–30 s, Tessa word-synced)? Does it look like films 1–2 and the site rather than a template? Is every claim true? Is all on-screen text spoken and inside the Reels safe zones? I do not judge hook strength except where it depends on production (frame 0, legibility, density).

---

## 0. Verdict

### 0.1 Scores (1–10 on this lens)

| # | Concept | Build on the kit | Brand fit (films 1–2, site) | Honesty | **Score** |
|---|---|---|---|---|---|
| A1 | 9:47 PM | medium (2 new parts + a cheap rewind) | very high: film 1 clock + rose line light, film 2 orb birth | high, one fix | **8** |
| A2 | Twelve minutes | medium (TimerCard, a 3-move "tug") | good | implies call routing the product doesn't own | **6** |
| A3 | Ninth time today | cheapest | too close: a re-cut of film 2 | high; male `● YOU` line bends the voice rule | **6** |
| A4 | 2:13 AM | medium-heavy, darkest ground | high | accurate, but hook and payoff disagree | **6** |
| B1 | Watch it book | medium-heavy (4 new UI parts) | high | **misrepresents the booking flow as written**; 2 plan gates | **4** |
| B2 | Four screens | heavy (~10 facsimiles, ~11 presses in 10 s) | medium (speedrun template) | high | **4** |
| B3 | One setting, 14 languages | medium (borrowed takes; no flags available) | high: film 1's language montage | high, with care | **7** |
| B4 | Can you trip it up? | simple-medium, mostly kit | high | high (honesty is the payoff) | **8** |
| C1 | The beep | medium, pearl ground | good (film 1 Split diptych) | sourced and caveated | **7** |
| C2 | Not even ours | medium, **one** new part | very high: the site's and film 2's own thesis | arithmetic, no claim | **9** |
| C3 | Three myths | medium-heavy (4 mini-scenes) | low: listicle template | myth 2's bust overclaims | **5** |
| C4 | Five minutes | medium, dark + ticking | medium | stretches a web-lead vendor study to calls | **4** |

### 0.2 The set I recommend (posting order)

| Order | Reel | Post | Hook family | Proof | Cover ground | Length | Voices |
|---|---|---|---|---|---|---|---|
| **01** | **A1 "9:47 PM"** | week 1 Tue | ring + clock (pattern interrupt) | after-hours call → the morning Inbox message | night | 26 s | Tessa + 1 caller |
| **02** | **C2 "Not even ours"** | week 1 Thu | contradiction from an AI brand | 45 of 168 hours, the week grid → outcome pills | pearl | 28 s (cut from 30) | Tessa only |
| **03** | **B4 "Can you trip it up?"** | week 2 Tue | challenge to the viewer | three phrasings → one line; the fallback | pearl (KB) | 26 s | Tessa + 2 callers |
| **04** | **B3 "One setting, 14 languages"** | week 2 Thu | English line, then a Japanese greeting | the setting changes; English price list → Spanish answer | pearl → sunday teal | ≈ 23 s (cut) | Tessa (en/ja/de/es) + 1 caller |

**Reserves, in order:** C1 (cheap, pearl, sourced number), A2 (template for a per-trade series), A4 (once the account has reach), B1 rebuilt as a Pro reel (§4).

### 0.3 Top fixes (details in §3 and §5)
1. **No plan-gated feature in the first four** (no booking, calendar or SMS). That keeps "free" honest in every CTA and removes the Google trademark from the launch set.
2. **A1:** the caller says her name on the call ("Hi, it's Maya…"). `take_message` collects name and number, so a card titled "Maya" after a nameless call shows a step we never showed. No call timer anywhere.
3. **C2:** cut `ig-c2-person` (30 → 28 s). Caption how after-hours calls reach the agent ("it answers the calls that reach its number").
4. **B4:** two caller voices, not four. Head the document "Northside Studio · Price list" so "$85" can't be read as our price. Drop the 1 px "nudge" (at 1080p it reads as render jitter).
5. **B3:** open on an English line ("One setting. Fourteen languages. Listen."), then the Japanese greeting at ≈ 1.8 s. Cut the Spanish greeting, because Spanish arrives as the call. **No flags:** the app's flag package isn't installed and can't be.
6. **Series-wide:** at most one dark ground (A1). Lighter or static grain plus dither. Nothing right of x 906 in y 900–1650. Build the Captions `display` map once (A1 and C2 need numerals). One keyword (AGENT), with a recorded "link in bio" alternate.

---

## 1. What I checked in the source (facts behind the scores)

| Fact | Where | Affects |
|---|---|---|
| `book_appointment` is called "only after check_availability returned the time AND the caller clearly said yes … AND you have their name"; `send_sms_confirmation` is "true only if the caller agreed to receive a text confirmation" | `lib/voice/tools/definitions.ts:83, 89` | B1 (its call has no name and no opt-in, yet claims "no jump cuts") |
| `take_message`: "First collect the caller's name, callback number and message, and read them back"; `caller_name` may be null | `definitions.ts:146-153` | A1 (the Inbox card shows a name) |
| `transfer_call`: only when the caller asks for a person or a rule matches, "only after telling the caller who you are connecting them to"; the agent leaves once connected | `definitions.ts:170-176` | A4, C2, C3: their transfer staging is right |
| Film 1's language takes match the product's greeting templates word for word: es `Soy {agent}, el asistente virtual con inteligencia artificial.`, de `Sie sprechen mit {agent}, dem KI-Assistenten.`, ja `AIアシスタントの{agent}と申します。` | `lib/voice/greetings.ts:283, 321, 416` vs `scripts/voice-lines.json` `lang-*` | B3 can borrow them honestly |
| Borrowable durations: `lang-ja` 2.733 s, `lang-de` 3.031, `lang-es` 3.981, `lang-en` 2.267, `call-1` 5.269, `kb2-brand` 1.51, `kb2-call-1` 1.62; `borrow` is implemented | `src/voice.generated.ts`, `src/kb/voice.generated.ts`, `scripts/generate-voice.mjs:700-710` | B3, C3, all end cards |
| The app's language flags come from the npm package `country-flag-icons`, which is **not installed** anywhere in this checkout. The app's own comment: flags are countries, not languages | `components/shared/FlagIcon.tsx:1-5`, `lib/agent-languages.ts:4-5` | B3 (no faithful flags without `npm install`, which is forbidden) |
| Film 2 already staged "the same question, phrased differently" with four caller voices and a desk voice (`kb2-c1…c4`, `kb2-desk-1`) and "If it isn't written down, I say so" (`kb2-vo-6`) | `scripts/voice-lines-kb.json` | A3 (a near re-cut), B4 (partial overlap) |
| Film 2's callers were Kyle, Dana, Marian and Daniel, plus Leo at the desk, all captioned | `scripts/voice-lines-kb.json` `voices` | the voice rule ("like in the others") allows short caller lines |
| Dashboard strings used by the concepts exist verbatim: outcome labels (Missed, Answered, Message taken, Transferred, Booked), tool labels ("Looked it up in your documents", "Checked your availability", "Transferred the call"), "Call back" / "Mark as read", the language hint and save toast, "Put live calls through to this person", "On call: …", "When should your agent involve them?", "Live transfers", "Team and transfers", "Lead questions", "Live transcript" | `components/calls/call-display.tsx:12-44`, `inbox/MessagesPanel.tsx:247-253`, `agent/tabs/TabGeneral.tsx:143, 216`, `skills/ContactDialog.tsx:164-190`, `skills/TeamSkill.tsx:110-111`, `agent/tabs/TabSkills.tsx:15`, `skills/LeadQuestionsSkill.tsx:139`, `voice/TestCallPanel.tsx:858` | A1, A4, B1, B3, C2, C3: no invented UI |
| B4's strings are the site's own: "Do you do home visits?", `landsOn: "Lands on"`, `threshold: "Close enough to answer"`, "What would a full session set me back?" | `lib/pages/knowledge-base.ts:155, 215, 239, 364-365` | B4 |
| "the people on payroll do the work only people can do" (site); "That's the work only people can do." (film 2 `kb2-vo-8`) | `lib/pages/ai-agents.ts:150` | C2 is on-thesis |
| 411 Locals is labelled "small-business call answering study, 2016" on the site; `CALL_FATE` 37.8 / 37.8 / 24.3 | `lib/site.ts:777-789, 808` | C1's "85 small businesses" is the site's wording |
| The stats shelf (`STATS_INTRO`, `LEAD_DECAY`, `CALL_FATE`) is in code but no route renders it | `lib/site.ts:690-790`, RESEARCH-product §1.14 | C1, C4: allowed with a source, but the live site chose not to lead with them |
| Film 2 parts the set needs are bound to its timeline and must be forked: `repeat/InPersonCard` (REPEAT_LOCAL), `repeat/Clock`, `repeat/CallerTurn`, `call/Strip`, `call/Meaning` (CALL_LOCAL). Film 1's `hook/Clock` (`ClockLockup`, `flickDisp`, `chainPos`), `hook/Rings` (`RingPulse`), `result/Split` (`DisplayWord`, `Seam`) and `cta/EndCard` (`Wordmark`, `Url`) export cleanly | `src/kb/scenes/*`, `src/scenes/*` imports | build estimates |

---

## 2. Each concept on this lens

**A1 · 9:47 PM: 8.** It is the most "house" concept of the twelve. Film 1's clock lockup with the rose line light as its colon, a ring at frame 0, film 2's orb birth (rose dot → teal orb) and film 2's sample opening-hours page make it read as the third film in the family, not a template. The rewind is cheap and original: every part is a pure function of `t`, so b2 played backwards at ×3 is a time remap, not new animation. New work is two small parts (`InboxCard` on kit `Panel` + `Button`; `OutcomePill`) and the night → pearl crossfade, which `MeshGround`'s `paletteB` / `mix` already does. Honesty is clean: ungated tools only, and "answered on the first ring" is said about one call. One fix: `take_message` collects the name and reads it back, so the morning card's "Maya" must be given on the call. The production risks are the `INK_MESH` night ground at ≈ 8 Mb/s (banding, so test it first) and 8 beats in 26 s. Cut the rose dot's slide-out and the ringback burrs to give the call room to breathe.

**A2 · Twelve minutes: 6.** The timer ending on the same frame as the call is a satisfying payoff, and the real-seconds tick is a good sound idea. But the "tug" puts three simultaneous moves on one card (translate with rotate, an arc overshoot, a rose "+05:00" flash), and that is the hardest thing in set A to make look designed rather than "UI-animation template". "+05:00" is text Tessa never says. The premise has the agent picking up a salon line that is ringing across the room during opening hours. That only happens if the owner's carrier forwards that line to the agent's separate, non-ported number. The product has no ring-delay setting (A's own risk 1), so the picture implies a mechanism we don't own. The audience is salons only. It is the right template for a later per-trade series, not one of the launch four.

**A3 · Ninth time today: 6.** This is the cheapest build of the twelve, and the score is about novelty, not craft. It is film 2's argument staged with film 2's props: the repeated question, the slip stack, a weary desk reply (film 2 had "Yes, Saturdays, nine till two."), Add knowledge, the Ready pills and the "matched on meaning" hairline. Its one non-Tessa, non-caller line is Leo as `● YOU`, a male voice speaking text that addresses the viewer, which bends the client's "the woman's voice" rule more than any caller does. "Ninth time today" doesn't stop a stranger until the reel has explained it. Its parking example and the "no new slip" gag are worth moving into B4.

**A4 · 2:13 AM: 6.** It is ambitious, and it is accurate about transfers: the agent names the person before it dials, the orb steps out because the transfer is blind, and the `ContactDialog` labels are verbatim (checked). But it stacks the hardest production conditions in the set:
- the darkest ground of the twelve at the tightest bit budget;
- a caller whose urgency needs an emotion Sonic doesn't offer;
- a `TeamContactCard` with two 7–10-word checkbox labels and a field, the most unspoken text in any concept.

The hook says "the only call worth waking **you** for", and then the call goes to Dan. Either the owner is the on-call contact, or the hook becomes "Which call should wake someone?". It also needs a bought number and live transfers, so it is the furthest of the twelve from the free trial. Make it once the account has reach.

**B1 · Watch it book: 4.** Calendar booking on Pro has the highest paid intent of anything here, but as written the reel shows the product doing something it won't do. `book_appointment` runs only once the agent has the caller's name, and the SMS only with the caller's agreement. B1's call books and texts with neither, while its own rule says "no jump cuts" under a live call timer. That continuity claim turns a compression into a misrepresentation. On top of that:
- two gates: Pro plus Calendar in beta, and SMS on Starter;
- the Google trademark;
- four new UI parts (a word-synced `LiveTranscript` with a masked scroll, `SlotStrip`, three cascade cards, chips);
- a night ground;
- a slot strip that reaches x 930 inside the right-rail band.

Saying the Pro gate aloud is honest, but it spends 1.5 s of a growth reel on a disclaimer. Keep it as a later Pro reel, rebuilt as in §4.

**B2 · Four screens: 4.** It is honest: only the Free Trial card is in frame, it says "Real time? Under ten minutes.", and the test-call note is verbatim. It is also the trial path itself. As a build it is the heaviest of the twelve: about ten new facsimiles of today's onboarding screens, which age with every UI change, and ≈ 11 presses in ≈ 10 s. The kit cursor needs `6 + 6·log2(1 + d/100)` frames per move plus a 6 f press lead (≈ 27 f for 500 px). A 45 f screen therefore holds two presses with no dwell, which reads frantic, and a move without time to travel throws. The "setup speedrun" is also the most common SaaS reel template. It isn't a few-hours job. Its best lines ("Real time? Under ten minutes.", "ring it from your browser") belong in the captions and the DM.

**B3 · One setting, 14 languages: 7.** This is the true version of the most sendable claim, and it is cheap on voices. The three greetings are delivered film 1 takes, and I checked that they match the product's own greeting templates word for word. The new parts are a `LanguageSelect` (a popover with a scrolling list), a hint line and a toast. Its problems are all fixable:
- The app's flags come from `country-flag-icons`, which isn't installed and can't be (no `npm install`). The Saudi, Korean, Chinese and Indian flags can't be hand-drawn cheaply, and the app itself says flags are countries, not languages. So: names only.
- Japanese type and speech at frame 0 in an English feed risks an instant skip, and may get the reel classified as Japanese content.
- Three greetings back to back can still read as mid-call switching.
- Tessa is not a native speaker of de, es or ja (film 1 already shipped those takes).

With the cuts in §3.4 it is about 23 s and the build is mid-sized.

**B4 · Can you trip it up?: 8.** This is the most kit-heavy concept in B: `DocPage`, `InkSweep`, `MeaningLink`, `DocRow`, `FieldCard`. The new pieces are small:
- the single caller slot;
- a `MeaningLink` variant that stops short of a threshold rule;
- a saturation dip, which is already a `MeshGround` prop.

Every string is the site's own (checked), and honesty is the payoff: where the documents stop, it says so. The caption keeps the site's "can occasionally get something wrong". The costs: 72 words and four caller voices in 26 s is the densest audio in the set, and the phrasings beat repeats film 2's (four callers asking about Saturday). The price-list subject, the threshold rule and the fallback twist are new against film 2. The 1 px "nudge" pun won't survive 1080p on a phone: it is invisible, or it reads as render jitter.

**C1 · The beep: 7.** It is cheap and on a pearl ground, which suits the bit budget best. The new parts are small: `VmLine`, `StudyBar`, `MessageCard`, and one B5 sine. It reuses film 1's `Split` diptych, so "Voicemail records. / An agent answers." lands in the house type. The number is sourced and voiced, and the caveats are in the caption. Against it:
- it shares A1's pain;
- the stacked stat bar is the one stock-infographic beat in my top six;
- `say` "411" against spoken "Four-eleven" breaks 1:1 word indexing, so it needs the `display` map;
- "You don't leave voicemails" generalises about the viewer.

It is the best reserve.

**C2 · Not even ours: 9.** It has the best ratio of originality to build cost. One new part, `WeekGrid` (168 SVG cells, two fill cascades, pure functions of `t`), carries the whole idea. A grid the viewer counts along with, filling in two colours, is motion people rewatch, not a template. It needs:
- Tessa only, so no caller voices;
- a pearl ground;
- no plan gate and no third-party number (9 to 6 × 5 = 45 of 168 is arithmetic).

It is the site's own thesis ("the work only people can do", `ai-agents.ts:150`) and film 2's closing idea (`kb2-vo-8`), and it brings back film 2's in-person card. That card has to be forked because it reads `REPEAT_LOCAL`. Fixes: 30 s and 69 words is the densest script in C, so cut `ig-c2-person` to reach 28 s. The concession survives in "Not even ours" and the desk beat. The caption should also say how after-hours calls reach the agent, since numbers aren't ported.

**C3 · Three myths: 5.** "N myths" with struck-through cards is the most template-looking format of the twelve. It needs four mini-scenes in 30 s: a transcript card, slips with a lock, a `DocPage` with a camera move, and a `TabBar` with cursor and a Skills stub. That isn't a few hours. Two honesty problems:
- Calling "it makes things up" a myth claims more than the site does. The site's FAQ asks "What if it gets something wrong?", and terms §10 disclaims accuracy.
- Myth 3's spoken bust leaves out "someone you listed".

Myth 1 (disclosure in the first line, "no setting that turns it off", `lib/site.ts:2527-2529`) is the strongest single beat. It could become a short standalone reel later.

**C4 · Five minutes: 4.** The study measured follow-up on web leads. "You have five minutes. Not ten." turns a vendor-linked baseline bucket into our own instruction, and "Miss the call, and it's already running" stretches it to phone calls. The live site keeps these numbers in unrendered code. Production-wise it has the darkest ground under constant ticking (hard for the encoder), a new `DecayChart` plus a live clock mode, and data reels skip more. It isn't for the launch four.

---

## 3. The four, with the work each needs

**Why this set.**
- **Four different hooks:** a sound plus a time, a contradiction, a challenge, and a language.
- **Four different proofs:** the after-hours message, the week's arithmetic, the knowledge base under test, and the language setting.
- **The four objections a stranger has, in order:** *what is it?* → *will it replace my people?* → *will it know my business, or make things up?* → *can it speak to my callers?*
- **No plan gate in any of them,** so every CTA can say "free" honestly.
- **Only one dark ground.**
- **They share most of their parts:** end card, captions, orb, call strip, pills and bed.

### 3.1 Shared foundation (once, before any reel; ≈ 1 working day)
"A few hours per reel" is true only on top of this:
1. The IG registry in `scripts/ig/films.mjs`, merged by the shared tools, so `scripts/films.mjs` stays byte-identical. Add `public/ig/` to `bundle-digest`'s film filter. Add `scripts/ig/verify-film2.mjs` (RESEARCH-product §3.2, §3.5, §3.8).
2. A Captions fork with a **`display` map**: numerals over spoken word spans ("9:47 pm.", "45", "168", "123").
3. **One end card:**
   - the CTA caption;
   - a white comment field typing AGENT on her word;
   - `LightGL` with the teal emitter only;
   - the NEUROVOICE wordmark;
   - `neurotechvoice.com` typed on her words;
   - `kb2-brand` borrowed.

   Wordmark at y 760–900, URL at y ≈ 1000. No unspoken "Start free" button.
4. **Shared parts:** the orb-birth wrapper (rose → teal), the call strip with `TurnLabel` (`● CALLER` slate, `● AVA` / `● AI AGENT` teal), and `OutcomePill`.
5. **Sound:** one `scripts/ig/bed.mjs` (film 2's instruments copied) with four arrangements, plus the IG sound driver.
6. **Finish:** the 120 fps master as H.264 High at Level 5.1, ≤ 28 MB, plus a 60 fps upload copy (RESEARCH-reels §2.4).
7. **Grain:** lighter or static film grain on the IG finish, with dither kept. Test the encode on a 2 s strip of A1's night ground before building anything else.

### 3.2 01 · A1 "9:47 PM" (26 s; est. ≈ 5 h on the foundation)
- **Hook:** keep "Nine forty-seven. You're closed. Your phone's still ringing." Show "9:47 pm." through the `display` map. Frame 0 is the cover: the 21:47 lockup at y 300–620, mid-ring.
- **Honesty:**
  - Caller line: **"Hi, it's Maya. Do you do Saturday mornings?"** (8 w). The card's name is then something she said.
  - No call timer anywhere, so the two-turn call claims no continuity.
  - Keep the Ofcom drama-range number.
  - "So she rings someone else" stays about *her*.
- **Cut:**
  - the rose dot sliding out of frame;
  - the `fx-ringback` burrs and the "Mark as read" button;
  - the press on `Call back` stays the payoff.
- **Keep:** the 0.75 s rewind (the retention device, and free) and the night → pearl crossfade.
- **CTA:** the shared one ("Five free minutes, no card. Comment AGENT for the link.").
- **Simpler build:** `InboxCard` = `Panel` + one name/time row + one body line + one `Button`. Use film 1's `ClockLockup` / `flickDisp` directly; don't fork film 2's `repeat/Clock`.
- **Zones:** captions y 1180–1440, left at x 86, ≤ 820 wide. The card at x 86–906.

### 3.3 02 · C2 "Not even ours" (28 s; est. ≈ 3–4 h)
- **Hook:** keep "Don't fire your receptionist for an AI. Not even ours." It is set at frame 0 at 72 % ink, and words lift on her onsets.
- **Cut:** `ig-c2-person`, bringing it to 14 bars with the impact at 24.0 s. Keep "puts calls through to people you listed" (true, and on every plan).
- **Build:** `WeekGrid` is the only new part. Fork `InPersonCard` (it reads `REPEAT_LOCAL`). The outcome cards are `Panel` + `OutcomePill`. The "09" / "18" / "MON–FRI" ticks stay ≤ 28 px chrome.
- **Honesty (caption):** add "It answers the calls that reach its number; which calls those are is your phone setup." Numbers aren't ported, so after-hours cover depends on how the owner points their line.
- **CTA:** shared. **Zones:** the grid at x 130–890. The orb parks at (840, 400), above the right rail.

### 3.4 03 · B4 "Can you trip it up?" (26 s; est. ≈ 3–4 h)
- **Hook:** keep "Can you trip up this AI receptionist?" Set it left-aligned at x 86, or centred at ≤ 780 px. A centred 820 px block at y 1080–1340 reaches x 950, inside the rail band.
- **Voices:** two callers, not four: Kyle and Dana, both pinned and EQ'd in film 2. Phrasings 1 and 3 go to Kyle, phrasing 2 and the curveball to Dana.
- **Honesty:**
  - Head the page **"Northside Studio · Price list"**, so "$85" reads as the sample studio's price, not ours.
  - Keep the caption's "can occasionally get something wrong".
  - Run the three phrasings on a real agent with the sample list before posting.
- **Cut:** the 1 px page and button "nudge". Keep the threshold rule, the five short-falling hairlines and the stop-time; that is what's new against film 2.
- **CTA:** "Start free, then try to trip it up. Comment AGENT." (the shared field).
- **Spacing:** post it at least a week from any film 2 9:16 cut.

### 3.5 04 · B3 "One setting, 14 languages" (≈ 23 s; est. ≈ 4–5 h)
- **Hook rewrite:** frame 0 is the General card with the select open on Japanese, and the English line "One setting. Fourteen languages. Listen." (5 w, said by 0.3 s). The borrowed `lang-ja` greeting comes in at ≈ 1.8 s. Keep the Japanese-first open as a later Trial-reel hook B.
- **Cut:** the Spanish greeting (b4, 3.98 s). The arc becomes:
  1. ja greeting;
  2. "Same agent. Pick one of fourteen languages." with the scroll;
  3. German picked and saved, then the `lang-de` greeting;
  4. Spanish picked under "Your price list can stay in English.";
  5. the Spanish caller, then Ava's Spanish answer from the English page.
- **Build:**
  - **No flags.** Use language names in UI type, with a small Geist Mono code if the row needs a mark.
  - Keep the app's hint line ("…pick a voice that speaks German naturally", true and modest) and drop the toast.
  - `waitForFonts()` must have Noto Sans JP before frame 0.
- **Honesty:** a visible setting change before every greeting, "Pick **one** of fourteen", and the caption's "one language at a time". Tessa is Ava in Spanish (generated with `language: es`); judge the accent by ear. Using Marta is the synthesis's call.
- **CTA:** "Hear it in your language. Comment AGENT."

### 3.6 Grid, series and pins
- **Covers:** frame 0 of each reel is the cover, designed inside x 86–930, y 260–1500 (the 3:4 crop). The grounds alternate: night (01), pearl (02), pearl with the document (03), teal-keyed pearl (04).
- **Series mark:** label role, x 86, y 280: `01 · AFTER HOURS`, `02 · THE OTHER 123`, `03 · TRIP IT UP`, `04 · 14 LANGUAGES`.
- **One colour rule for the series:** rose (ringing, missed, the myth) turns into sunday teal (answered) once per reel. It is A's and C's rule, and B4 and B3 already end in teal.
- **Reels linking and pins:**
  - Link the reels 01 → 02 → 03 → 04.
  - Pin 01, 03 and 02 at first; swap 04 in if its sends lead after week 2.
  - Leave the old film 1 cut unpinned.

---

## 4. Not in the four, and what would bring each back
- **C1:** the first reserve as written. Fix the "411" `display` span. If it posts within two weeks of A1, open on the question form ("When did you last leave a voicemail?").
- **A2:** the per-trade series after launch. Replace "+05:00" with a spoken beat or cut it. Simplify the tug to one move. Caption the routing ("forward your line to it when you're busy" is the owner's phone setup, not a product setting).
- **A4:** make the owner the on-call contact, or change the hook to "Which call should wake someone?". Light the night ground or lift its floor, since banding is the main risk.
- **B1 as a Pro reel:**
  - the caller gives her name in her first line;
  - drop the text message (a second gate, and it needs opt-in);
  - no call timer;
  - booking shown with `Pro` and `BETA` chips and the trademark line in the caption;
  - the CTA points to the trial without putting "free" next to booking.
- **B2, C3, C4:** not at this stage (§2).

---

## 5. Rules for the build (all four)
1. **Every on-screen line is spoken and word-synced.** Tessa is the narrator and the agent. Callers are ≤ 2 short lines per reel, captioned `● CALLER` in slate (film 2's precedent). No male `● YOU`. App chrome stays ≤ 32–44 px and appears on the word that names it.
2. **Safe zones:**
   - top ≥ 240;
   - captions in y 1180–1480;
   - nothing right of x 906 in y 900–1650;
   - centred blocks ≤ 780–820 px wide;
   - nothing below y 1520.
3. **House motion only:** pure functions of `t`, mask reveals, no blur or glow, one moving text at a time, sub-pixel glide on moving type, typographic apostrophes. No CSS animation.
4. **One CTA per reel**, at 75–90 % of the runtime, before the loop seam. Keyword AGENT with a UTM per reel. Record a "The link's in our bio." take per reel in case the DM automation isn't live.
5. **Claims:**
   - "14 languages", never "every language";
   - "under ten minutes" or "four screens", never "5 minutes";
   - "Five free minutes, no card";
   - every caption says a phone number for real callers is bought separately;
   - no prices of ours, no statistics in the four.
6. **Before delivery,** check each reel:
   - typecheck;
   - `check-mix` and `check-render --film=<reel>`;
   - a cover still inside the 3:4 crop;
   - a 2 s 120 fps strip of the fastest move;
   - encode size < 28 MB;
   - `verify-film1` and the film 2 proof steps (RESEARCH-product §3.8).
