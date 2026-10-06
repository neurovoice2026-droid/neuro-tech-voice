# IG reels · concepts C: CONTRARIAN / EDUCATIONAL ("the straight answer")

Label `concepts:C`. Planning draft for the synthesis, written 2026-10-06 at HEAD `743247a` (`claude/remotion-trailer`). This file is the only one I wrote. No code, scripts, `public/` or `src/` were touched.
Read first: `docs/ig/RESEARCH-product.md` (product truth, kit, pipeline) and `docs/ig/RESEARCH-reels.md` (platform). I skimmed `drafts/concepts-A.md` and `drafts/concepts-B.md` so these four do not duplicate them, and I re-checked every product line in the site source (paths below are relative to the repo root for `lib/`, `components/`, and to `trailer/` for `src/`, `scripts/`).

**The angle.** Each reel opens with a statement a business owner does not expect from an AI company: *you don't leave voicemails either*, *don't fire your receptionist for us*, *here are the myths, checked against ours*, *you have five minutes*. Then it teaches one true thing with clean typographic motion, and closes on one takeaway and one ask. The contrarian edge is aimed at the market's hype ("Stop hiring humans"), never at the viewer. That's what makes it safe to send to a colleague, and sends are the signal that matters for non-follower reach (RESEARCH-reels §1.1).

---

## 0. The four at a glance

| # | Title | Length | The statement (hook) | The lesson | Hook score* |
|---|---|---|---|---|---|
| **C1** | **The beep** | 26.0 s · 13 bars · 780 f | "You don't leave voicemails. Why would your callers?" | A sourced study (411 Locals), then the honest contrast: voicemail **records**, an agent **answers**, and when it can't help it takes the name, the number and the need. | 78 |
| **C2** | **Not even ours** | 30.0 s · 15 bars · 900 f | "Don't fire your receptionist for an AI. Not even ours." | Arithmetic, not a statistic: a desk open 9 to 6 on weekdays covers 45 of the week's 168 hours. The other 123 are the agent's shift. People keep the work only people can do. | 87 |
| **C3** | **Three myths** | 30.0 s · 15 bars · 900 f | "Three myths that stop you trying an AI receptionist." | Each myth is busted against *our* product only: it tells every caller it's an AI; it answers from your documents and says so where they stop; ask for a person and it puts you through. | 81 |
| **C4** | **Five minutes** | 28.0 s · 14 bars · 840 f | "You have five minutes. Not ten." | The Lead Response Management study (MIT Sloan with InsideSales.com), voiced and credited: odds flat for 5 minutes, 4× lower by 10, 21× by 30. A missed call starts that clock; the agent answers "here, on the first ring". | 81 |

\* `.claude/skills/ig-reel/hookscore.py` on Tessa's spoken hook (0–100, ≥ 70 = STRONG). It is a text heuristic; it rewards a number, a stakes word and "you". It does not predict views. I scored 25 candidates and kept the strongest *true* line for each.

**As a set** they answer the four objections a stranger has before trying an AI phone agent: *is my phone really a problem?* (C1), *will it replace my people?* (C2), *will it lie, fake being human, or trap my callers?* (C3), *does speed even matter?* (C4).
**Suggested order inside this set:** C2, C1, C3, C4. C2 has the strongest scroll-stop and the most debate (comments, sends to a receptionist or office manager). C1 is the broadest pain. C3 is the best "save" and the best pinned reel (it handles objections). C4 is the most niche (sales-led businesses) and the riskiest on skip rate.
**Pin:** C3 and C2. **Series mark (covers only):** `STRAIGHT ANSWERS · 01–04`.

---

## 1. Rules all four share

### 1.1 Truth rules for this angle (checked in source; please carry into the synthesis)

1. **Comparisons must be fair, never a tick table.** The site removed its old "us vs voicemail vs receptionist" table on purpose: it "gave itself six ticks out of six" (`lib/site.ts:1266-1283`). So every comparison here concedes something real. C1 grants that voicemail *does* record. C2 grants that a good receptionist beats software in person. That stance is the site's own: "the comparison isn't him or his receptionist, who is better at this than software will ever be. It's what happens at 22:40 on a Sunday" (`lib/pages/industries/clinics-dental.ts:273`; same argument in `hospitality.ts:269`).
2. **Only two third-party numbers are used, both voiced and credited on screen and in the caption, with their caveats:**
   - C1: **411 Locals**, "85 businesses across 58 industries, monitored 30 days": 37.8 % answered by a person, **37.8 % sent to voicemail**, 24.3 % rang out (`lib/site.ts:785-789`, `:808-809`). Tessa says "over a third", which 37.8 % is. **No year** is given: the site says 2016, web secondaries say 2024 (RESEARCH-reels §5); I re-searched on 2026-10-06 and secondaries still say 2024, all of them answering-service vendors. The caption calls it "a vendor's study and not a new one".
   - C4: **Oldroyd, Lead Response Management study, MIT Sloan with InsideSales.com** (`lib/site.ts:736-740`, `:798-818`): odds of qualifying a lead indexed 1.00 inside 5 min, 0.25 at 10, 1/21 at 30. The site's own caveat ("run with a company that sells lead-response software", `:694`) goes in the caption, plus a second one of mine: it measured **follow-up on web leads, not missed calls**. The curve is drawn with the site's own log-log interpolation (`qualifyOddsAt`, `lib/site.ts:759-774`), nothing extrapolated past 30 min.
   - **No vendor "85 % of callers won't call back" figure.** It is all over the secondaries and has no traceable source.
3. **C2's number is arithmetic, not a claim.** 9 to 6 × 5 days = 45 hours; a week is 168; 168 − 45 = 123. It is an example schedule, said as one ("nine to six, weekdays"), and the caption says "put in your own". The idea is the site's: "the line is unattended for roughly seventy percent of the week's clock, which is arithmetic rather than a claim" (`lib/pages/industries/salons-spas.ts:245`).
4. **Myths are busted for our product only, never for the category.** C3 says "ours". Some AI phone products may well pretend to be human; we only vouch for this one.
5. **Every "it does X" is ungated, every plan:** answering from documents (`search_knowledge`), taking a message (`take_message`: name, callback number, what they need, read back, team notified right away; `lib/voice/tools/definitions.ts:145-157`), transfer to listed people (`transfer_call`, `:170`), lead questions (`save_lead_details`, `:181`). `lib/pages/industries/schema.ts:80-104` maps all four to no plan. **No booking, no SMS, no calendar** anywhere in these four, so no plan gate is needed on screen.
6. **Transfers have conditions, and the caption says them:** only to people the owner listed with "Live transfers" on (`components/skills/TeamSkill.tsx:110`), it names them before it dials, it is a straight (cold) transfer, and if nobody picks up in 25 s the caller is told and the team gets the message (`lib/site.ts:1895-1897`, `:2521-2524`). A transfer needs a real phone line, i.e. a bought number.
7. **"On the first ring" is the site's own line**, used without a latency number: "It answers here, on the first ring." (`SHELF_CLAIM`, `lib/site.ts:713`; its comment forbids attaching a figure).
8. **The trial never answers customers.** Every CTA is "build one free / test one yourself" (test calls "run on the real agent and never touch the five minutes", `lib/site.ts:1813`). Every caption says a number for real customers is bought separately.
9. **No absolutes.** No "every call answered", "never misses", "never wrong". C3 says out loud in the caption that it can still get something wrong (`lib/site.ts:1904-1907`).
10. **Sample names:** "Ava" and "Northside Studio" appear only in C3's greeting card, and the caption labels them as samples (`lib/pages/home/credits.ts:15-18`).
11. **One agent speaks one language** (concepts-A §1.1 trap 1, concepts-B §0.1). None of my four shows language switching. C3's caption says the disclosure is in "whichever of its 14 languages it's set to speak".

### 1.2 Format and grid
- 1080×1920, 30 fps timeline × 4 sub-frames = 120 fps master (`RENDER_FPS` 120, `SUB` 4). 120 BPM: bar = 2.0 s = 60 f, beat = 15 f, 16th = 3.75 f. Bar *n* starts at 2(n−1) s.
- Every reel ends on a whole bar. The logo impact lands on a bar line two bars before the end (A and B do the same, so the four end cards are one family).
- Frames below are 30 fps timeline frames (`f`). Multiply by 4 for the 120 fps master.

### 1.3 Voice (the client's rule: the woman's voice whenever there is text on screen)
- **Tessa (Emotive)** `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`, speed 1.05, full-band, film 2's dry narrator path, pinned with an IG-prefixed env name. She is the only voice in C1, C2 and C4. In C3 she also "plays" the sample agent for one borrowed line.
- **Borrowed takes** (byte-copied, id unchanged): `kb2-brand` "Neuro Tech Voice." (`{"id":"kb2-brand","borrow":"kb"}`) on every end card; `lang-en` "This is Ava, an AI assistant." (`{"id":"lang-en","borrow":"main"}`) in C3.
- **New lines:** 28 (C1 6, C2 7, C3 8, C4 7), ids `ig-c<n>-<name>`. Budget 2.6–3.2 words/s; each line's window below is a target, and `src/ig/<reel>/timing.ts` must derive the real times from the measured takes, as both films did.
- **Numbers:** `say` carries numerals where they read faster ("411", "85"); `speak` carries the spoken form ("Four-eleven", "eighty-five"). Word counts must match 1:1 for caption indexing. Risk: Cartesia may timestamp "four-eleven" as two words; the fallback is A's proposed `display` map in the Captions fork (show numerals over a span of spoken words). C2 and C4 need that map anyway (see §1.4).
- **Emphasis:** `**bold**` in the scripts = Sonic stress + the key phrase that takes the accent ink on its onset.

### 1.4 On-screen text
- On-screen text = the line's `say`, word-synced through the forked Captions (`src/ig/components/Captions.tsx`, from `src/kb/components/Captions.tsx`): words lead the voice by 2 f, rise as a unit, hold ≥ 1 beat after the last word, leave in 4 f. **≤ 7 words per screen**; the screen lists below are the chunking.
- **Frame 0 vs word-sync.** The hook line must be readable at frame 0 (it is the default cover and the first impression), so it is set at f0. The sync lives in the ink: each hook word sits at 72 % ink and lifts to 100 % with a one-frame accent glint on Tessa's onset. Every later line rises normally on her words.
- **`display` map (new, small, in the fork):** C2 shows "45", "168" and "123"; C4 shows "4×" and "21×" on the chart markers. Tessa says the words; the caption shows numerals over the same word span.
- **App chrome is not a line** (as in film 2 and concepts-B §0.4): outcome pills ("Message taken", "Transferred"), tab names, "Live transfers", field labels. It stays ≤ 32 px and only appears on the word that names it. Field *values* are drawn as ink bars, not text, so nothing readable appears without her voice.
- **Citations** (C1's "411 Locals · 85 small businesses", C4's "MIT Sloan with InsideSales") are label-role chips, and Tessa says exactly those words. That satisfies both the client's voice rule and the honesty rule (source stated on screen).
- Typographic apostrophes everywhere (`typo()`).

### 1.5 Layout (inside the Reels safe zones)

| Band | y | Content |
|---|---|---|
| Top UI | 0–220 | Mesh only. |
| Label band | 240–340 | citation chips, the C4 mini clock, C3's numeral when it parks |
| Hero / stage | 300–1180 | hook type (display 112 / headline 92, left-aligned at x 86), cards, grid, chart. **Below y 900 everything stays in x 86–906** (the right action column is x 950–1080 at y 900–1650). |
| Caption band | 1200–1480 | caption role 68, ≤ 2 lines, left-aligned at x 86, max width 820 |
| Bottom UI | 1520–1920 | Mesh only. |

Covers: words in x 86–930, y 260–1500 (3:4 grid crop y 240–1680 ∩ feed UI), 3–5 words, measured with `measureText` so no line passes 844 px.

### 1.6 Colour logic (one accent per part, from `src/kb/palettes.ts`)
- **Rose** (`MOMENT_LIGHTS.rush`, ink `#be185d`): the myth, the miss, the beep, the falling curve.
- **Sunday teal** (`MOMENT_LIGHTS.sunday`, ink `#0e7490`): the agent, the answer, the orb.
- **Graphite** (`GRAPHITE`, `KB_INK.desk`): people, the front desk, "only people can do".
- **Pearl** `MUTED_MESH` grounds for the "problem" acts; the ground turns toward the sunday ground when the agent arrives. C4 runs on `INK_MESH` (deep) because a ticking clock reads better on dark.
- Every reel turns rose into teal once, as film 2 did.

### 1.7 The shared end card (one build with A and B)
Identical choreography to concepts-A §1.6 / concepts-B §0.7, so the grid reads as one series:
1. **CTA spoken over the last product shot** (75–90 % of runtime). The shot steps back (× .92, shade). The CTA line rises as a caption. A white comment field rises under it (x 160–920, y 940–1060) with an IG-local lucide `message-circle` icon; **AGENT** types one letter per 16th on her word "AGENT"; the send arrow presses (.97) as the word ends.
2. **Impact on the bar line.** The field leaves up through its mask. `kb/scenes/cta/LightGL` blooms with the teal emitter only; the **NEUROVOICE** wordmark (film 1 `cta/EndCard` `Wordmark`) surfaces at y 760–900, ≤ 800 px wide; `kb2-brand` plays into the impact's ring; `neurotechvoice.com` (EndCard `Url`, Geist Mono 44, y 1000) types on "Neuro | Tech | Voice". No "Start free" button: unspoken, it would break the voice rule.
3. **Seam (last 0.7 s).** The wordmark leaves up; frame 0's composition re-forms (each reel's own, below). The master fades to < −60 dBFS on the last frame (check-mix contract), and frame 0's attack (beep, tick, numeral roll) restarts the sound.

### 1.8 Sound family
- 120 BPM, E major (both films' key). Each reel gets its own arrangement in `scripts/ig/bed.mjs`, copying film 2's instruments (felt piano, strings, pad, kick, shaker, snare roll) as RESEARCH-product §2.5 requires.
- Libraries read-only: film 1 `public/sfx/*`, film 2 `public/kb/sfx/fx-*`. **One new IG extra:** `fx-vm-beep` (C1).
- The desk trill `fx-trill` (G#4/B4) means "a call" in all four, as in concepts-B §0.6. The mallet pentatonic (`fx-mallet-e4/fs4/gs4/b4/e5`) means "true / done".
- Levels: film targets (dialogue −20 LUFS, master −15.5 LUFS / −1.5 dBTP); the IG delivery copy is normalised to about −14 LUFS (RESEARCH-reels §2.5).

### 1.9 Posting, shared
- Comment keyword **AGENT** on all four (same as A and B), one automation per post, each DM link with its own UTM: `?utm_source=instagram&utm_medium=social&utm_campaign=reel_c1` … `c4`. Fallback CTA if the automation is not live on posting day: replace "Comment AGENT" with "Link's in our bio" (re-generate only the CTA line).
- Captions are Job A (the reel carries the hook; line 1 is the ask plus the search phrase). All four passed `.claude/skills/ig-caption/caption.py` (READY: one ask, first line ≤ 125 characters, 4 hashtags, no links, no emoji, search terms present) and `.claude/skills/ig-human/detect.py` (PASS, 81–86; no em dashes).
- Covers are custom 1080×1920 PNGs (a cover is an image, so its words need no voice) with the series mark `STRAIGHT ANSWERS · 0n` in label role at x 86, y 280. Frame 0 of each reel is designed to work as the fallback cover without the mark.

---

## C1 · "The beep"
**26.0 s · 13 bars · 780 f (3,120 f at 120 fps). Impact bar 12 (22.0 s, f660).**

### 1. Premise, views, conversion
- **Premise.** Nobody likes leaving a voicemail, yet most small businesses still send callers to one. A study says how often; then the honest difference between a recording and an answer.
- **Why it gets views.**
  - *Hook:* a universal sound (the voicemail beep) at 0.0 s plus a statement every viewer instantly checks against themselves. That self-check is the stop.
  - *Retention:* an open question ("why would your callers?") answered by a number in the next 3 s, then a two-word diptych that is satisfying to read ("records / answers").
  - *Shareability:* owners send it to the partner who "set up the voicemail". The comment section writes itself ("I haven't left one since 2015").
  - *Loop:* the reel ends silent on the flat line, and the replay starts with the beep.
- **How it converts.** Comment AGENT → DM with the UTM link → `/register` → build the agent (four screens) → test call → buy a number → paid plan. The lesson (a message with name, number and need) is exactly what the viewer can hear in a test call.

### 2. The hook, frames 0–45 (0.0–1.5 s)
- **f0 picture (designed cover).** Pearl `MeshGround` (`MUTED_MESH`, `variant='light'`, slow drift). A 1.5 px graphite hairline runs across x 86–906 at y 340: the "line". A small rose `MeshOrb` dot (18 px, the recording light) sits at its left end. The hook type is already set, headline 92, Instrument Sans 600, left-aligned at x 86: "You don't leave" (y 520) / "voicemails." (y 624), graphite ink at 72 %, "voicemails." in rose ink.
- **f0–f10 sound + motion.** The voicemail beep (`fx-vm-beep`, 0.35 s). The hairline carries it: a sine burst (± 34 px, drawn on the beep's real envelope) runs right from the dot and settles flat by f12. The camera starts a slow push (1.00 → 1.03 over b1).
- **f10 Tessa's first word**, "You". Each word lifts to 100 % ink with a one-frame glint on its onset; "voicemails" gets a rose glint and the dot sends one hairline ring (`hook/Rings` RingPulse, rose).
- **f40** the second chunk, "Why would your callers?", rises as a unit from its mask under the first (y 760–860), 2 f ahead of her "Why" (≈ f42).

### 3. VO script (Tessa) and on-screen text

| Line id | Window | Spoken (`say`) | Emotion | Screens (≤ 7 words) |
|---|---|---|---|---|
| `ig-c1-hook` | 0.33–2.85 (f10–86) | "You don't leave **voicemails**. Why would your **callers**?" | curious, dry | S1 "You don't leave voicemails." · S2 "Why would your callers?" |
| `ig-c1-study` | 3.10–7.70 (f93–231) | "**411 Locals** studied **85** small businesses. Over **a third** of calls hit **voicemail**." (`speak`: "Four-eleven Locals studied eighty-five small businesses. <break time="250ms"/> Over a third of calls hit voicemail.") | confident | S3 "411 Locals studied / 85 small businesses." · S4 "Over a third of calls / hit voicemail." |
| `ig-c1-turn` | 8.00–9.90 (f240–297), "Voicemail" on the bar line | "Voicemail **records**. An agent **answers**." | confident, a small smile on "answers" | S5 "Voicemail records." + S6 "An agent answers." (the diptych) |
| `ig-c1-ring` | 10.10–12.80 (f303–384) | "On the **first ring**, from your **own documents**." | calm | S7 "On the first ring," · S8 "from your own documents." |
| `ig-c1-message` | 13.10–17.20 (f393–516) | "Can't help? It takes their **name**, **number**, and **what they need**." | calm, matter-of-fact | S9 "Can't help? It takes their name," · S10 "number, and what they need." |
| `ig-c1-cta` | 18.00–21.40 (f540–642) | "Build one **free**, and call it yourself. Comment **AGENT**." | content, warm | S11 "Build one free, / and call it yourself." · S12 "Comment AGENT." (the comment field) |
| `kb2-brand` (borrowed) | 22.05–23.56 (f662–707) | "Neuro Tech Voice." | (film 2's take) | wordmark + URL |

57 spoken words (≈ 2.2 w/s overall, 2.6–2.9 w/s inside each line).

### 4. Visuals per beat

| Beat | Time / frames | Picture |
|---|---|---|
| **b1 Hook** | 0.0–3.0 · f0–90 | As §2. At 2.95 the hook type exits up through its masks (4 f). |
| **b2 The study** | 3.0–8.0 · f90–240 | A label chip rises at x 86, y 300 (label 28, uppercase, tracking .14): "411 LOCALS · 85 SMALL BUSINESSES", each word typed on her matching onset. Below it a stacked bar (`StudyBar`, new) at x 86–906, y 560–640, radius 10, draws left to right on `EASE.draw` over 0.6 s: graphite (answered by a person), **rose** (sent to voicemail), pale slate (rang out), widths 37.8 / 37.8 / 24.3 %. No percentages are printed; the widths are the data. On "Over **a third**" the rose segment lifts 12 px (`SPRING.site`) and the other two dim to 40 %. On "**voicemail**" the hairline from b1 (now at y 760, under the bar) flattens to a dead line with the rose dot at its end. |
| **b3 Records / answers** | 8.0–10.0 · f240–300 | The diptych, stacked for 9:16: film 1 `result/Split` `DisplayWord` × 2 + `Seam`. "Voicemail records." (graphite, y 470–590) locks on the bar line; the `Seam` hairline draws across at y 720 on "An"; "An agent answers." (sunday teal ink, y 800–920, x 86–720) locks on beat 3. The ground below the seam crossfades to the sunday ground (`MeshGround` `paletteB` + `mix`, masked to the lower half). On "answers" the teal orb (film 1 `components/Orb`, `MOMENT_LIGHTS.sunday`, 160 px, volume on her envelope) is born at the seam's right end (x 800, y 720). |
| **b4 First ring** | 10.0–13.0 · f300–390 | Camera (`Camera` + `camMotion`) moves down into the teal half; the top half leaves frame. `fx-trill` at 10.0: the orb grows to 280 px at (540, 560) and sends one teal RingPulse on "**first ring**". Under it a white `RecordRow` (x 120–900, y 820–1080) slides up: the speaker tag `● AI AGENT`, a transcript line drawn as ink bars, and the real chip "Answered from your documents" with a document chip ("Price list.pdf", 28 px) appearing on "**own documents**". |
| **b5 The message** | 13.0–18.0 · f390–540 | `Swap` turns the record into a white `Panel` (x 120–900, y 520–1100): header pill "Message taken" (the dashboard's outcome label, `call-display.tsx:17`, 30 px) appears on "takes". Three field rows (`MessageCard`, new, built from `FieldCard` geometry): labels "Name", "Number", "What they need" (28 px) appear on her matching words; each value types in as rounded **ink bars**, one bar per 16th, with `fx-keys`; "What they need" gets a two-line bar block. After the last bar a teal `InkSweep` (12 %) runs down the three rows (the read-back) and a `CheckMark` draws in the header on the next beat. |
| **b6 CTA** | 18.0–22.0 · f540–660 | Shared end card §1.7 step 1 over the message card. |
| **b7 Brand** | 22.0–25.3 · f660–759 | §1.7 step 2. |
| **b8 Seam** | 25.3–26.0 · f759–780 | The wordmark leaves up. The ground drains back to pearl, the teal leaves the orb and it shrinks into the rose dot at x 86, y 340; the hairline redraws flat to x 906; "You don't leave / voicemails." rises into place by f779, which matches f0 minus the beep. |

**Kit reused:** `MeshGround` + `MUTED_MESH` / `MOMENT_LIGHTS.sunday`, `MeshOrb`, `components/Orb`, `hook/Rings`, `result/Split` (`DisplayWord`, `Seam`), `Camera`/`camMotion`, `RecordRow`, `Swap`, `Panel`, `FieldCard` geometry, `InkSweep`, `CheckMark`, `Icon`, shared end card (`EndCard` `Wordmark`/`Url`, `LightGL`), forked Captions.
**New:** `fx-vm-beep` (SFX), `VmLine` (the hairline that carries the beep and later her waveform; SVG, ~80 lines), `StudyBar` (3 segments, ~60 lines), `MessageCard` (label + ink-bar rows, ~120 lines).

### 5. Sound
- **Bed.** Bars 1–4 have no music, on purpose: dry room tone (`fx-roomtone`) with a faint line hiss (`fx-linehiss`, −50 dBFS), and a low E pedal (`sub`, −24 dBFS) swelling in from 3.0. **The bed enters on the bar line at 8.0, on "Voicemail records."**: felt piano on E–B, pad, soft kick on beats 1 and 3, shaker 8ths. It builds lightly through b5, a snare roll into 18.0, and the E chord on the logo impact rings into the fade.
- **Cues.**

| t (s) | Cue | Note |
|---|---|---|
| 0.00 | `fx-vm-beep` | new. A sine at **B5 (987.8 Hz)**, close to the classic 1 kHz and in key, 0.35 s, 300–3400 Hz phone band, −12 dBFS peak |
| 3.10, 3.9 | `tick` ×2 | the label words land |
| 3.4 | `draw` | the bar draws |
| ≈ 6.3 | `pop` (soft) | the rose segment lifts on "a third" |
| ≈ 7.5 | `thump` | the line goes flat on "voicemail" |
| 8.00 | `whoosh-soft` + bed in | "Voicemail records." locks |
| ≈ 9.2 | `ping`, then `chime-sunday-soft` | "answers" + the orb is born |
| 10.00 | `fx-trill` → `fx-pickup` | the call, picked up |
| ≈ 11.6 | `glint` | "own documents" chip |
| 13.0–16.8 | `fx-keys` per bar, `fx-tag` on "Message taken" | the fields fill |
| ≈ 17.4 | `fx-mallet-b4` → `fx-mallet-e5` | the read-back check |
| 18.0–21.4 | `fx-click-down/up` on the send arrow | CTA |
| 22.00 | `impact` + E chord | logo |

### 6. End card / CTA and loop
- **Spoken:** "Build one free, and call it yourself. Comment AGENT." then "Neuro Tech Voice."
- **On screen:** "Build one free, / and call it yourself." + the comment field typing AGENT; then NEUROVOICE + `neurotechvoice.com`.
- **Loop:** the last frame is frame 0 without the beep: pearl ground, flat line, rose dot, "You don't leave / voicemails." The replay's first sound is the beep.

### 7. Posting copy
- **Cover (custom PNG):** "You don't leave / voicemails." at 150 px (x 86, y 640–960), rose on "voicemails."; the flat line and rose dot at y 1120; series mark `STRAIGHT ANSWERS · 01` at x 86, y 280.
- **Caption (READY, human score 86.8 PASS):**

```
Voicemail records. An AI receptionist answers. Comment AGENT and we'll DM you the link to try one free.

411 Locals monitored 85 small businesses in 58 industries for 30 days: 37.8% of calls went to voicemail. It's a vendor's study and not a new one, so read it as a direction, not a forecast for your business.

Instead of missed calls ending at a beep, an AI voice agent picks up on the first ring and answers from your own documents: price lists, policies, FAQs. When it can't help, it takes the caller's name, number and what they need, reads it back, and your team is notified.

5 free minutes for 14 days, no card. Test calls on the real agent don't use them. A phone number for real customers is a separate purchase.

#AIReceptionist #MissedCalls #VoiceAI #SmallBusinessTips
```
- **Comment keyword:** AGENT (UTM `reel_c1`). **Alt hook for a later A/B:** "When did you last leave a voicemail?" (truer as a question, weaker by the heuristic: 38).

### 8. Production estimate and risks
- **Medium.** Three small new parts, one new SFX, six new lines; everything else is kit.
- **Risks.**
  - The rhetorical opener ("you don't leave voicemails") is a generalisation about the viewer, not a statistic. Some will reply "I do". That is engagement, but the synthesis may prefer the question form.
  - 411 Locals is a vendor study with a disputed year. It is credited and caveated; if the client wants zero third-party numbers, b2 becomes "Your callers hang up, and call the next name." (no number), and the reel loses its best proof beat.
  - "Four-eleven" may be tokenised as two words (§1.3).
  - The beep must not be mistaken for a notification sound in the feed. B5 pure sine in a phone band reads as "voicemail", not as an iOS chime.

---

## C2 · "Not even ours"
**30.0 s · 15 bars · 900 f (3,600 f at 120 fps). Impact bar 14 (26.0 s, f780).** Cut-down to 28.0 s: drop `ig-c2-person` and pull everything after it back one bar.

### 1. Premise, views, conversion
- **Premise.** An AI company telling owners *not* to replace their receptionist, then showing with simple arithmetic which hours an agent should cover instead. It is the opposite of the "Stop hiring humans" playbook, and it is the site's own position ("so the people on payroll do the work only people can do", `lib/pages/ai-agents.ts:149-150`).
- **Why it gets views.**
  - *Hook:* a contradiction (an AI brand arguing against AI replacing people) plus a self-deprecating twist, "Not even ours". Heuristic 87, the strongest of the 25 I tested.
  - *Retention:* the week grid. 168 cells fill in two colours; the viewer counts along. A number promised ("forty-five"), then a bigger one ("a hundred and sixty-eight"), then the remainder lights up.
  - *Shareability and comments:* receptionists, office managers and owners send it to each other ("see, it's not coming for your job"). It invites debate in the comments ("my receptionist works Saturdays").
  - *Loop:* the teal drains out of the grid and the hook re-forms.
- **How it converts.** The reel reframes the purchase from "replace a salary" (a scary decision) to "cover the hours nobody's there" (an easy one), which is the paid plan's natural use. CTA: "Five free minutes, no card. Comment AGENT."

### 2. The hook, frames 0–45
- **f0 picture.** Pearl `MeshGround` (`MUTED_MESH`) warmed slightly toward graphite. Hook type set at f0, headline 92, left-aligned x 86: "Don't fire your receptionist" (two lines: "Don't fire your" y 420 / "receptionist" y 524) and "for an AI." (y 628). "fire" in rose ink. Under the text, a graphite hairline (the desk edge) is drawing left to right from f0 (`EASE.draw`, 0.6 s), so the frame is moving from frame 0.
- **f10** "Don't" onset. Words lift to full ink on her onsets (§1.4). **f22** "fire": a one-frame rose glint and a soft `thump`.
- **f45** her "for an AI" is ending. At ≈ f72 the whole first screen exits up as "Not even ours." rises in its place (y 520), in teal ink; the full stop is the teal orb (`MeshOrb`, 40 px, breathing), so the brand's mark punctuates the joke.

### 3. VO script and on-screen text

| Line id | Window | Spoken (`say`) | Emotion | Screens |
|---|---|---|---|---|
| `ig-c2-hook` | 0.33–3.30 (f10–99) | "Don't **fire** your receptionist for an AI. Not even **ours**." | confident, a dry smile on "ours" | S1 "Don't fire your receptionist / for an AI." · S2 "Not even ours." |
| `ig-c2-person` | 3.60–5.70 (f108–171) | "In person, they **beat any software**." | sincere, calm | S3 "In person, / they beat any software." |
| `ig-c2-hours` | 6.00–10.70 (f180–321), "Nine" on the bar line | "Nine to six, weekdays: **forty-five** hours. The week has **a hundred and sixty-eight**." | measured, counting | S4 "Nine to six, weekdays: / 45 hours." · S5 "The week has 168." (display map) |
| `ig-c2-shift` | 11.00–14.20 (f330–426) | "The other **hundred and twenty-three**? That's the **agent's shift**." | curious → confident | S6 "The other 123?" · S7 "That's the agent's shift." |
| `ig-c2-does` | 14.50–19.00 (f435–570) | "It **answers**, takes **messages**, and puts calls through to **people you listed**." | calm | S8 "It answers, takes messages," · S9 "and puts calls through" · S10 "to people you listed." |
| `ig-c2-desk` | 19.30–22.20 (f579–666) | "Your receptionist keeps the work **only people can do**." | warm | S11 "Your receptionist keeps the work" · S12 "only people can do." |
| `ig-c2-cta` | 22.60–25.40 (f678–762) | "**Five free minutes**, no card. Comment **AGENT**." | content | S13 "Five free minutes, no card." · S14 "Comment AGENT." |
| `kb2-brand` | 26.05–27.56 (f782–827) | "Neuro Tech Voice." | — | wordmark + URL |

69 spoken words.

### 4. Visuals per beat

| Beat | Time / frames | Picture |
|---|---|---|
| **b1 Hook** | 0.0–3.5 · f0–105 | As §2. |
| **b2 In person** | 3.5–6.0 · f105–180 | "Not even ours." steps back (× .96) and parks top-left (x 86, y 260, label size). A white `Panel` card (x 120–900, y 460–820) rises with the label `● IN PERSON` (graphite dot, label role) on "In person", the in-person card from film 2's b01, here with no text body: a hairline rule and a soft `ContactShadow`. The orb-full-stop shrinks a step (deference). Caption S3; "beat any software" takes graphite accent ink, not teal: the agent concedes. |
| **b3 The hours** | 6.0–10.8 · f180–324 | The card shrinks into a single graphite block, which becomes the staffed area of the **WeekGrid** (new): 7 columns × 24 rows of rounded 6 px cells (x 130–890, y 360–1140, cells 92 × 26 px, gaps 16 / 6), pale graphite at 10 %. On "**Nine** to **six**" two Geist Mono tick labels "09" and "18" (28 px) appear at the left edge on those words; on "weekdays" the label "MON–FRI" (label role) appears above columns 1–5. The staffed block (rows 9–17 × columns 1–5 = 45 cells) fills graphite column by column, one column per 16th. On "**forty-five**" the caption shows "45 hours" and the block's outline lifts once. On "**a hundred and sixty-eight**" the camera eases back (1.00 → .94) to show the whole grid and every empty cell draws its hairline outline in one diagonal wave. |
| **b4 The shift** | 10.8–14.4 · f324–432 | On "The other **123**?" the 123 empty cells fill **teal** in a diagonal cascade from Friday 18:00 through the nights and the weekend (one row-diagonal per 16th, ≈ 1.2 s). On "**agent's shift**" the teal orb glides from the parked hook into the grid's top-right corner (x 840, y 400, 120 px; clear of the right column, which starts at y 900) and starts breathing on her envelope. |
| **b5 What it does** | 14.4–19.2 · f432–576 | The grid recedes (× .86, shade .1, stays visible). Three white outcome cards stack in (`SlipStack`, x 140–880, y 520–940), each appearing on her verb and each carrying the dashboard's real outcome pill (`components/calls/call-display.tsx:16-18`): **Answered**, **Message taken**, **Transferred** (30 px pills, teal dots). On "**people you listed**" a contact row slides under the third card: an avatar disc, an ink bar for the name, a lucide `phone-forwarded` icon and the real tag "Live transfers" (`TeamSkill.tsx:110`, 28 px). |
| **b6 The desk** | 19.2–22.4 · f576–672 | The cards fan out and leave. The grid returns to full size: the graphite staffed block lifts 8 px and the `● IN PERSON` card from b2 settles back into it. The two colours sit side by side: graphite (people) and teal (the agent). Caption S11/S12, "only people can do" in graphite accent. |
| **b7 CTA** | 22.4–26.0 · f672–780 | Shared end card §1.7 step 1, over the two-colour grid. |
| **b8 Brand** | 26.0–29.3 · f780–879 | §1.7 step 2. |
| **b9 Seam** | 29.3–30.0 · f879–900 | The wordmark leaves. The teal drains from the grid back into the orb, the grid collapses to the desk hairline, the orb shrinks to the full stop's size and slides off as "Don't fire your / receptionist / for an AI." rises into place: frame 0. |

**Kit reused:** `MeshGround`, `MeshOrb`, `components/Orb`, `Panel`, `ContactShadow` (film 1 Atmosphere), `SlipStack`, `Pill`, `Icon`, `Camera`, `Label`/`CornerDot` (film 1 `components/Type`), shared end card, forked Captions with the `display` map.
**New:** `WeekGrid` (SVG cells, fill cascades as pure functions of t, axis labels; ~180 lines), the outcome-card layout (thin, on `Panel` + `Pill`), IG icons `phone-forwarded`, `message-circle`.

### 5. Sound
- **Bed.** From f0, a steady "shift" pulse: shaker 8ths and a muted felt-piano ostinato on E in a graphite register (dry, close). On "That's the agent's shift" (≈ 13.0) the pad and strings open up an octave (the teal cascade). b5 adds a light kick on 1 and 3. b6 thins back to piano (the people beat). A snare roll into 22.4; the E chord on the impact.
- **Cues.**

| t (s) | Cue | Note |
|---|---|---|
| 0.00 | `draw` (soft) | the desk hairline, frame 0's attack |
| ≈ 0.75 | `thump` | "fire" |
| ≈ 2.6 | `ping` + `chime-sunday-soft` | the orb full stop, "ours" |
| ≈ 3.7 | `fx-paper-*` | the in-person card |
| 6.0–7.2 | `fx-tick` ×5 on 16ths | staffed columns fill |
| ≈ 8.0 | `fx-tock` | "forty-five" |
| ≈ 9.6 | `swish` (soft) | camera back, the full grid |
| 11.2–12.4 | `fx-pluck-*` rising arpeggio, E-major pentatonic on 16ths | the teal cascade |
| ≈ 13.4 | `glint` | "agent's shift", the orb lands |
| ≈ 14.6 / 15.8 / 17.0 | `fx-tag` ×3, the last one + `ring-hook` | the three outcome cards |
| ≈ 18.3 | `line` | contact row, "people you listed" |
| ≈ 20.5 | `land` | the desk block lifts |
| 22.6–25.4 | `fx-click-down/up` | CTA |
| 26.00 | `impact` + E chord | logo |

### 6. End card / CTA and loop
- **Spoken:** "Five free minutes, no card. Comment AGENT." / "Neuro Tech Voice."
- **Loop:** the grid's teal drains back into the orb, which becomes the hook's full stop; frame 0's desk hairline restarts its draw.

### 7. Posting copy
- **Cover:** "Don't fire your / receptionist." at 128 px (x 86, y 560–900, "receptionist." measured ≤ 844 px), "fire" in rose; under it a thumbnail of the two-colour week grid (y 1000–1460); series mark `STRAIGHT ANSWERS · 02`.
- **Caption (READY, human score 85.5 PASS):**

```
An AI receptionist shouldn't replace your front desk. It should cover the hours nobody is there. Comment AGENT for the link.

The arithmetic: a desk open 9 to 6, Monday to Friday, covers 45 of the week's 168 hours. That's an example schedule, so put in your own.

For the other 123, an AI voice agent answers on the first ring, takes messages, and puts calls through to the people you list. It says who it's connecting before it dials, and if nobody picks up, the caller is told and the message goes to your team.

Your team keeps the work only people can do. The agent tells every caller it's an AI, in its first line.

5 free minutes for 14 days, no card. Test calls don't use them. A phone number for real customers is bought separately.

#AIReceptionist #FrontDesk #SmallBusinessOwner #VoiceAI
```
- **Comment keyword:** AGENT (UTM `reel_c2`). **Alt hook:** "Don't replace your receptionist with AI. Not even ours." (87).

### 8. Production estimate and risks
- **Medium.** One new infographic part (WeekGrid) with two cascades; the rest is kit and simple cards.
- **Risks.**
  - "Don't fire your receptionist" could read as anti-AI if the payoff is missed. The orb-as-full-stop and "Not even ours" in teal keep it on-brand, and the grid turns the joke into a use case within 8 s.
  - Many owners have no receptionist. The arithmetic still applies to them ("your desk" = you); the caption says so implicitly. Consider a variant line for solo trades: "Your hours are forty-five. The week is a hundred and sixty-eight."
  - Transfers out of hours need someone who is on call and listed. Captioned.
  - 30 s and 69 words: the densest of the four. `ig-c2-person` is the first cut.
  - The `display` map in the Captions fork is a small new feature; without it the captions would read "forty-five", which is slower.

---

## C3 · "Three myths"
**30.0 s · 15 bars · 900 f (3,600 f at 120 fps). Impact bar 14 (26.0 s, f780).**

### 1. Premise, views, conversion
- **Premise.** Three things owners believe about AI phone agents that stop them trying one, each struck out and answered with the real product: the disclosure in the greeting, the knowledge base's honest edge, the transfer to a person.
- **Why it gets views.**
  - *Hook:* a numbered list ("Three myths…") sets an open loop of exactly three; viewers stay to see if their objection is on it. The heuristic gives 81.
  - *Retention:* a countdown numeral rolls 3 → 1 → 2 → 3 in a figure window (film 1's clock mechanism). Each myth gets ~6 s; the busts get shorter (7 s, 6 s, 5 s), so the pace accelerates.
  - *Saves and comments:* objection-handling content gets saved; "myth" invites "what about…" comments (reply fuel for the account).
  - *Loop:* the numeral lands on 3 at the last myth, and the seam rolls it back to the "3" of frame 0.
- **How it converts.** It removes the three objections that stop a trial. The CTA is contrarian too: "Don't believe a reel. Test one yourself." That is exactly what the free trial offers (test calls on the real agent, no card).

### 2. The hook, frames 0–45
- **f0 picture.** Pearl ground with a faint rose tint (`MUTED_MESH`, `paletteB` = `MOMENT_LIGHTS.rush.ground`, mix .25). A huge numeral **"3"** in a figure window (film 1 `hook/Clock` `ClockLockup` cell, Instrument Sans 600, 440 px, −0.03 em, rose ink) at x 86, y 300–760. To its right, x 420–906: "myths" (headline 92, graphite, y 420). In the caption band: "that stop you" (caption 68, x 86, y 1240). Everything set at f0, at 72 % ink.
- **f0–f8.** The figure window's strip settles (a tiny damped landing from a wind-back that started "before" frame 0: `flickDisp` with the land at f6), so the numeral is visibly moving at frame 0. `fx-flip` on f0.
- **f10** "Three" onset: the numeral glints. Words lift on their onsets.
- **f40–45** "that stop you" is complete; at ≈ f58 it is replaced in the caption band by "trying an AI receptionist." (rising as a unit on "trying"); "AI receptionist" takes the rose accent.

### 3. VO script and on-screen text

| Line id | Window | Spoken (`say`) | Emotion | Screens |
|---|---|---|---|---|
| `ig-c3-hook` | 0.33–3.30 (f10–99) | "**Three myths** that stop you trying an **AI receptionist**." | confident, knowing | S1 "3 myths" + "that stop you" · S2 "3 myths" + "trying an AI receptionist." |
| `ig-c3-m1` | 4.00–5.90 (f120–177), "One" on the bar line | "**One**: it pretends to be **human**." | wry | S3 "1" + "it pretends to be human." |
| `lang-en` (borrowed, film 1) | 6.30–8.20 (f189–246) | "This is Ava, **an AI assistant**." | (film 1's take) | S4 "This is Ava, an AI assistant." (transcript card) |
| `ig-c3-b1` | 8.50–10.20 (f255–306) | "And there's **no off switch**." | firm, light | S5 "And there's no off switch." |
| `ig-c3-m2` | 11.00–12.70 (f330–381) | "**Two**: it **makes things up**." | wry | S6 "2" + "it makes things up." |
| `ig-c3-b2` | 13.00–16.80 (f390–504) | "Ours answers from **your documents**. Where they stop, it **says so**." | calm, precise | S7 "Ours answers from your documents." · S8 "Where they stop, it says so." |
| `ig-c3-m3` | 17.00–19.00 (f510–570) | "**Three**: callers get **stuck with a bot**." | wry | S9 "3" + "callers get stuck with a bot." |
| `ig-c3-b3` | 19.30–22.20 (f579–666) | "Ask for a **person**, and it **puts you through**." | warm | S10 "Ask for a person," · S11 "and it puts you through." |
| `ig-c3-cta` | 22.60–25.60 (f678–768) | "Don't believe a reel. **Test one yourself**. Comment **AGENT**." | playful, confident | S12 "Don't believe a reel." · S13 "Test one yourself." · S14 "Comment AGENT." |
| `kb2-brand` | 26.05–27.56 (f782–827) | "Neuro Tech Voice." | — | wordmark + URL |

72 spoken words (including the 6 borrowed).

### 4. Visuals per beat

| Beat | Time / frames | Picture |
|---|---|---|
| **b1 Hook** | 0.0–4.0 · f0–120 | As §2. At 3.6 "myths" and the caption exit; the numeral stays. |
| **b2 Myth one** | 4.0–6.0 · f120–180 | On "**One**" the figure window rolls 3 → 1 (`chainPos` flick, wind-back + damped landing, `fx-flip`) and the numeral scales down and parks at the label band (x 86, y 250, 120 px; it stays as the counter for the rest of the reel). A white **MythCard** (new: `Panel` x 120–900, y 560–800, a rose hairline rule on the left, the line typed in slate at 56 px with typographic quotes) rises on "it": "it pretends to be human." On 5.9 a rose **StrikeRule** (new: 2 px SVG hairline, `EASE.draw`, 0.35 s) draws through the text with `fx-pen`. |
| **b3 The greeting** | 6.0–8.4 · f180–252 | On the bar line the struck card exits up through its mask; `fx-trill` then `fx-pickup`. The teal orb (`components/Orb`, sunday palette, 200 px) blooms at (540, 1000), its volume on the borrowed take's real envelope. Above it a white transcript card (`RecordRow`'s TRANSCRIPT row, x 120–900, y 560–760): speaker tag `● AVA` in teal, and the greeting set word by word on the take's onsets (`recording/Type` reveal), "**an AI assistant**" in teal with a glint. |
| **b4 No off switch** | 8.4–11.0 · f252–330 | The transcript card shrinks into a slip and two identical slips fan behind it (`SlipStack`, their text redrawn as ink bars: the same line on every call). On "**no off switch**" a lucide `lock` icon (IG-local, 36 px, teal) snaps onto the front slip beside the teal phrase with a `fx-settle`. Nothing that looks like a settings toggle is drawn: there is no such toggle in the app, and inventing one would be fake UI. |
| **b5 Myth two** | 11.0–13.0 · f330–390 | Slips and orb step back; the counter rolls 1 → 2. New MythCard: "it makes things up." Strike on 12.7. |
| **b6 Documents** | 13.0–17.0 · f390–510 | The card swaps (`Swap`) into a paper `DocPage` (x 150–870, y 460–1120, kind token "PDF", heading "Price list", lines with tabular figures at 26 px as objects, as in film 2). On "**your documents**" a teal `InkSweep` runs across one line and a `MeaningLink` hairline curves from it to the orb, now small at (760, 400). On "**Where they stop**" the camera slides down the page to its bottom edge: blank paper, the page corner. On "**says so**" the orb speaks (volume up on her envelope) right at that blank edge. No invented answer text is shown. |
| **b7 Myth three** | 17.0–19.2 · f510–576 | The counter rolls 2 → **3**. MythCard: "callers get stuck with a bot." Strike on 19.0. |
| **b8 Put through** | 19.2–22.4 · f576–672 | A white app panel slides up (x 86–906, y 380–1100) with the real Agent `TabBar` (General · Conversation · Voice · Knowledge · Skills) at its top. The kit `Cursor` arcs to **Skills** and clicks (`click()`, `fx-click-down/up`) on "**person**"; the section header "Team and transfers" (`TabSkills.tsx:15`, 30 px) appears with one contact row: avatar disc, ink-bar name, tags "Live transfers" and "On call" (`TeamSkill.tsx:110-111`). On "**puts you through**" an outcome `Pill` rolls in under the row: "Transferred" (`call-display.tsx:18`) with a teal dot and `ring-hook`. |
| **b9 CTA** | 22.4–26.0 · f672–780 | The three struck MythCards return as a fanned `SlipStack` at y 360–640 (all three strikes visible, a satisfying recap), then collapse into the shared comment field (§1.7 step 1). "Don't believe a reel." in graphite; "Test one yourself." in teal. |
| **b10 Brand** | 26.0–29.3 · f780–879 | §1.7 step 2. |
| **b11 Seam** | 29.3–30.0 · f879–900 | The wordmark leaves up; the parked counter "3" grows back to 440 px at x 86, y 300–760 and "myths" / "that stop you" rise into place: frame 0. |

**Kit reused:** `hook/Clock` (`ClockLockup`, `flickDisp`, `chainPos`) for the counter, `components/Orb`, `RecordRow`, `recording/Type`, `SlipStack`, `Swap`, `DocPage`/`useDocPage`, `InkSweep`, `MeaningLink`, `TabBar`/`useTabBar`, `Cursor`/`click`, `Pill`, `Panel`, `Icon`, `Camera`, shared end card, forked Captions.
**New:** `MythCard` (~70 lines), `StrikeRule` (~40 lines; worth making shared, since a strike-through is a natural series device), IG icons `lock`, `phone-forwarded`, a "Team and transfers" section stub (header + one contact row + tags; ~100 lines, modelled on `components/skills/TeamSkill.tsx`).

### 5. Sound
- **Bed.** Call and response. Under each myth statement the bed drops to a hush (−6 dB, low-passed at 1.2 kHz, piano only, a single muted stab on the numeral); on each bust it blooms (full band, pad + strings, kick on 1 and 3). The three numerals ring the first three notes of the mallet phrase, and the phrase completes on the end card, so the brand lands as the resolution: E4 (One) → F#4 (Two) → G#4 (Three) → B4 (CTA "AGENT") → E5 (impact).
- **Cues.**

| t (s) | Cue | Note |
|---|---|---|
| 0.00 | `fx-flip` + `fx-mallet-gs4` (soft) | the "3" lands at frame 0 |
| 4.00 | `fx-flip` + `fx-mallet-e4` | "One" |
| 5.9 | `fx-pen` | strike |
| 6.0 / 6.25 | `fx-trill` / `fx-pickup` | the greeting call |
| ≈ 7.6 | `glint` | "an AI assistant" |
| ≈ 9.6 | `fx-settle` | lock on "no off switch" |
| 11.00 | `fx-flip` + `fx-mallet-fs4` | "Two" |
| 12.7 | `fx-pen` | strike |
| 13.2 / ≈ 14.2 | `fx-paper-*` / `draw` | page in / ink sweep |
| ≈ 15.4 | `swish` (soft) | camera down the page |
| 17.00 | `fx-flip` + `fx-mallet-gs4` | "Three" |
| 19.0 | `fx-pen` | strike |
| ≈ 19.8 | `fx-click-down/up` | Skills tab |
| ≈ 21.4 | `ring-hook` + `line` | "Transferred" |
| ≈ 22.8 | `fx-slip*` ×3 | the recap fan |
| ≈ 25.2 | `fx-mallet-b4` + click | "AGENT" sent |
| 26.00 | `impact` + `fx-mallet-e5` + E chord | logo |

### 6. End card / CTA and loop
- **Spoken:** "Don't believe a reel. Test one yourself. Comment AGENT." / "Neuro Tech Voice."
- **Loop:** the counter, parked at "3" since the third myth, grows back into frame 0's numeral; the replay's `fx-flip` is the seam.

### 7. Posting copy
- **Cover:** "3" (360 px, rose) + "myths about / AI receptionists" (110 px, graphite) at x 86, y 300–1180, with three small struck lines underneath as a graphic (y 1250–1450); series mark `STRAIGHT ANSWERS · 03`.
- **Caption (READY, human score 84.7 PASS):**

```
3 myths about AI receptionists, checked against our AI phone agent. Comment AGENT and we'll DM you the link.

Myth 1: it pretends to be human. Nope. Ours says it's an AI in its opening line, in whichever of its 14 languages you've set it to speak, and there's no setting anywhere that switches that off.

Myth 2: it makes things up. It answers from the documents you give it, and where they stop, it says so in words you chose. Can it still get something wrong? Yes, which is exactly why every call is transcribed for you to check the same day.

Myth 3: callers get stuck with a bot. Ask for a person and it puts you through to someone the business listed. If nobody picks up within 25 seconds, the caller is told and the team gets the message.

Ava and Northside Studio are sample names. 5 free minutes for 14 days, no card.

#AIReceptionist #VoiceAI #AIAgents #SmallBusinessTips
```
- **Comment keyword:** AGENT (UTM `reel_c3`). **Alt hook:** "Three things you believe about AI phone agents. All wrong." (84; "all wrong" over-reaches for the category, so I prefer the "myths that stop you" line).

### 8. Production estimate and risks
- **Medium-heavy.** Three vignettes, each on existing kit (greeting card, doc page, tab bar + cursor), plus two small new parts. The tab-bar vignette is the most work (cursor keys, a Skills section stub).
- **Risks.**
  - 30 s and 72 words, with three scene changes in 18 s. Retention depends on the counter and the strikes being crisp. If it runs long, cut `ig-c3-b1` ("And there's no off switch.") and let the lock carry it.
  - Myth 3's bust is true only when the business has listed someone with "Live transfers" on and has a real number. The caption states the conditions; the spoken line cannot.
  - Using the borrowed `lang-en` take puts Tessa in the agent's role. That is a real configuration (concepts-B §0.2: Tessa is a public Cartesia voice the product can select), but she is not the default voice. Caption it if the synthesis keeps B's "Voice in this video" line.
  - "No off switch" must never be shown as a UI toggle (none exists). The lock icon is a metaphor, not UI.

---

## C4 · "Five minutes"
**28.0 s · 14 bars · 840 f (3,360 f at 120 fps). Impact bar 13 (24.0 s, f720).**

### 1. Premise, views, conversion
- **Premise.** Speed-to-lead, taught with the one well-known study, voiced and credited, drawn as the real curve. Then the turn: a missed call starts the same clock, and an agent answers at the left edge of the graph.
- **Why it gets views.**
  - *Hook:* a countdown-clock pattern interrupt ("05:00" with a ticking sound at f0) and a crisp rule ("Five minutes. Not ten."). Heuristic 81.
  - *Retention:* the clock and the curve are one mechanism. The clock runs as the curve draws, so the viewer watches a number fall in real time. Then a **stop-time**: the ticking stops dead for one beat before the agent answers, which is the most attention-grabbing sound edit in the set.
  - *Saves and sends:* a sales-education reel with a named source gets saved and sent to sales leads.
  - *Loop:* the clock rolls back to 05:00 at the seam.
- **How it converts.** The value is concrete for lead-driven trades (home services, real estate, auto, insurance): answer inside the window and ask your qualification questions on the call. CTA: "Hear it answer yourself. Build one free. Comment AGENT."
- **Note:** this is RESEARCH-reels §8's angle 7, ranked low there for skip risk and the vendor link. I keep it because it is the only reel in A/B/C that is pure education with a real number, and the caption handles both caveats openly, which suits the angle.

### 2. The hook, frames 0–45
- **f0 picture.** Deep `MeshGround` (`INK_MESH`, `variant='deep'`), a cool key light top-left. Film 1's `ClockLockup` reading **05:00**: four figure windows (Instrument Sans 600, 260 px, paper ink at 90 %), centred at y 360–640, the colon a rose `MeshOrb` (the line light) breathing at 2 Hz. Hook type set at f0, headline 92, left-aligned x 86: "You have" (y 820) / "five minutes." (y 924), paper ink at 72 %.
- **f0 sound.** `fx-tick` on the first 8th, then ticks on every 8th (alternating `fx-tick` / `fx-tock`); the colon orb pulses on each.
- **f10** "You" onset; words lift on her onsets; "five minutes" takes the teal glint.
- **≈ f50–69** "Not **ten**.": on "ten" the minutes windows flick 05 → 10 in rose ink, hold 4 f, and snap back to 05 (`flickDisp` with a short wind; `fx-flip` both ways). "Not ten." sits beside the clock at y 1040.

### 3. VO script and on-screen text

| Line id | Window | Spoken (`say`) | Emotion | Screens |
|---|---|---|---|---|
| `ig-c4-hook` | 0.33–2.30 (f10–69) | "You have **five minutes**. Not **ten**." | crisp, confident | S1 clock + "You have / five minutes." · S2 + "Not ten." |
| `ig-c4-source` | 2.60–4.70 (f78–141) | "One study, **MIT Sloan** with **InsideSales**:" | matter-of-fact | S3 "One study, / MIT Sloan with InsideSales:" (and the chip) |
| `ig-c4-flat` | 5.00–8.60 (f150–258) | "A lead's odds of qualifying held **flat** for **five minutes**." | calm, explanatory | S4 "A lead's odds of qualifying" · S5 "held flat for five minutes." |
| `ig-c4-drop` | 9.00–12.40 (f270–372), "Four" on beat 3 | "**Four times lower** by ten. **Twenty-one times** by thirty." | grave, measured | S6 "4× lower by 10." · S7 "21× by 30." (display map) |
| `ig-c4-miss` | 12.80–15.00 (f384–450) | "Miss the call, and it's **already running**." | quiet, pointed | S8 "Miss the call, / and it's already running." |
| — | 15.0–16.0 | (stop-time: no voice) | — | the caption holds to 15.5, then leaves |
| `ig-c4-here` | 16.30–19.90 (f489–597) | "An agent answers **here**, on the **first ring**, and asks **your questions**." | warm, confident | S9 "An agent answers here," · S10 "on the first ring," · S11 "and asks your questions." |
| `ig-c4-cta` | 20.30–23.30 (f609–699) | "Hear it answer yourself. Build one **free**. Comment **AGENT**." | content | S12 "Hear it answer yourself." · S13 "Build one free. Comment AGENT." |
| `kb2-brand` | 24.05–25.56 (f722–767) | "Neuro Tech Voice." | — | wordmark + URL |

62 spoken words.

### 4. Visuals per beat

| Beat | Time / frames | Picture |
|---|---|---|
| **b1 Hook** | 0.0–2.5 · f0–75 | As §2. |
| **b2 Source** | 2.5–5.0 · f75–150 | The hook type exits up. The clock scales to 30 % and glides to the label band (x 86–330, y 250–330); it keeps ticking. A label chip types on her words at x 86, y 360: "MIT SLOAN WITH INSIDESALES" (label 28). Axis hairlines draw in for the chart (**DecayChart**, new): x-axis at y 1080 from x 150 to 880, y-axis at x 150 from y 480 to 1080. |
| **b3 Flat** | 5.0–9.0 · f150–270 | Geist Mono tick labels "0" and "5" (28 px) appear on her "five". The curve draws (`EASE.draw`, SVG, 3 px, teal-white) flat from 0 to 5 min at the top (y 520), synced so it reaches 5 on "**five minutes**". The parked clock rolls 00:00 → 05:00 with it (the figures roll; no fake seconds). The x scale is piecewise linear: 0–5 gets 30 % of the width, 5–10 gets 30 %, 10–30 gets 40 %, so the early drop reads. |
| **b4 The drop** | 9.0–12.6 · f270–378 | On "**Four times lower**" the curve falls to 0.25 at 10 min (log-log interpolation per `qualifyOddsAt`, drawn in rose), the tick "10" appears, the clock rolls 05 → 10, and a marker dot lands with the label "÷4" on "four". On "**Twenty-one times** by thirty" it continues to 1/21 at 30 min, tick "30", the clock rolls to 30:00, marker "÷21". The area under the curve fills rose at 8 % behind the line. |
| **b5 Miss** | 12.6–15.0 · f378–450 | The clock comes back to centre-top (x 290–790, y 250–420), resets to 00:00 and **runs live** (minutes window still, seconds rolling every 30 f); its colon orb turns rose. A small rose dot starts travelling along the flat segment from 0 towards 5. |
| **b6 Stop-time** | 15.0–16.0 · f450–480 | At 15.0 everything freezes (the ticking, the dot, the seconds), except the mesh drift. One beat of held breath. |
| **b7 Here** | 16.0–20.2 · f480–606 | On the bar line, `fx-trill`. The teal Orb (`components/Orb`, sunday palette, 150 px) blooms **on the y-axis at t = 0** (x 150, y 520): the site's `SHELF_CLAIM` staged as the site intended. On "**here**" it settles; on "**first ring**" one teal RingPulse; the running clock rolls back to 00:00 and its colon turns teal; the rose dot fades out. On "**your questions**" a small white card rises from the orb (x 200–700, y 620–880) titled "Lead questions" (the Skills section's real name, `LeadQuestionsSkill.tsx:139`, 30 px) with three rows of ink bars, each getting a teal `CheckMark` on a 16th. |
| **b8 CTA** | 20.2–24.0 · f606–720 | Shared end card §1.7 step 1 over the chart (stepped back, the teal orb still at the origin). |
| **b9 Brand** | 24.0–27.3 · f720–819 | §1.7 step 2. |
| **b10 Seam** | 27.3–28.0 · f819–840 | The wordmark leaves; the chart folds away; the clock grows back to frame 0's size at y 360–640 and rolls 00:00 → 05:00; the colon turns rose; "You have / five minutes." rises into place. The replay's first tick is the seam. |

**Kit reused:** `hook/Clock` (`ClockLockup`, `flickDisp`, `chainPos`), `MeshOrb`, `components/Orb`, `hook/Rings` (RingPulse), `MeshGround` + `INK_MESH`, `CheckMark`, `Panel`, `Camera`, shared end card, forked Captions with the `display` map.
**New:** `DecayChart` (axes, piecewise x scale, log-log curve from the three published points, markers, area fill; ~150 lines; copy the three points and the interpolation with a source comment pointing at `lib/site.ts:736-774`), the clock's "live seconds" mode (a strip that advances once per second; on top of `ClockLockup`, no edit to it).

### 5. Sound
- **Bed.** A clock pulse from f0 (`fx-tick` / `fx-tock` on 8ths) over a low E drone and a sparse felt piano. The drone bends down a whole step on each drop (filtered, never a cartoon "wah"). b5 adds a heartbeat kick on 1 and 3 under the running clock. **Stop-time at 15.0: every bus cuts on the sample, as film 2's Part I ending did.** At 16.0 the trill, then the bed returns in E major (pad + strings) on the orb, brighter than anything before. Snare roll into 20.2; E chord on the impact.
- **Cues.**

| t (s) | Cue | Note |
|---|---|---|
| 0.00 → 15.0 | `fx-tick` / `fx-tock` on 8ths | the clock (−6 dB under speech via `buildCues` ducking) |
| ≈ 1.8 / 2.0 | `fx-flip` ×2 | 05 → 10 → 05 on "ten" |
| ≈ 2.9 | `fx-tag` | source chip |
| 5.0–8.6 | `draw` (long, soft) | flat segment |
| ≈ 9.2 | `sub` + `thump` | "four times lower" |
| ≈ 11.2 | `sub` (deeper) + `thump` | "twenty-one times" |
| 12.8 | `fx-tick` doubles to 16ths | the live clock |
| 15.00 | **hard cut to silence** | stop-time (`MIX.cutRoom`) |
| 16.00 | `fx-trill` → `chime-sunday` | the agent answers |
| ≈ 17.4 | `ping` | "first ring" |
| ≈ 18.8–19.6 | `fx-mallet-e4/gs4/b4` | the three checks |
| 20.3–23.3 | `fx-click-down/up` | CTA |
| 24.00 | `impact` + E chord | logo |

### 6. End card / CTA and loop
- **Spoken:** "Hear it answer yourself. Build one free. Comment AGENT." / "Neuro Tech Voice."
- **Loop:** the clock rolls 00:00 → 05:00 in the last 0.7 s and the colon turns rose, matching frame 0; the replay's tick restarts the pulse.

### 7. Posting copy
- **Cover:** the "05:00" clock lockup (260 px, y 360–640, rose colon) + "You have / 5 minutes." (140 px, paper ink, x 86, y 820–1120), deep ground; series mark `STRAIGHT ANSWERS · 04`.
- **Caption (READY, human score 82.4 PASS):**

```
One study gives you five minutes to answer a lead. Comment AGENT for the link to an AI receptionist that picks up.

The source is the Lead Response Management study by Dr James Oldroyd (MIT Sloan) with InsideSales.com: against a reply inside 5 minutes, the odds of qualifying a lead were 4 times lower at 10 minutes and 21 times lower at 30.

Two caveats, and we'd rather you hear them from us. It measured follow-up on web leads, not missed calls, and it was run with a company that sells lead-response software, so it's a direction, not a promise.

Why it still matters: a missed call starts the same clock. Ours answers while the caller's still on the line. Then it asks the lead questions you set.

5 free minutes for 14 days, no card. Test calls don't use them. A phone number for real customers is a separate purchase.

#SpeedToLead #AIReceptionist #MissedCalls #SalesTips
```
- **Comment keyword:** AGENT (UTM `reel_c4`). **Alt hook:** "Call back in ten minutes and your odds are already four times worse." (82; longer, more precise to the study).

### 8. Production estimate and risks
- **Medium.** One chart part, the clock's live mode, and a sound edit (the stop-time). The rest is kit.
- **Risks.**
  - Data reels skip more (RESEARCH-reels §8). The clock-and-curve mechanism and the stop-time are there to fight that; still, post it fourth and A/B its hook once Trial Reels unlock.
  - The study is old, vendor-linked and about web leads. Both caveats are in the caption; the reel itself never claims the agent improves conversion by any factor. **Do not** add a line like "21× more leads".
  - "You have five minutes" is our framing of the study's baseline window. The source line follows within 0.3 s, and the curve shows exactly that window.
  - "MIT Sloan with InsideSales" must not be shortened to "an MIT study" anywhere (it hides the vendor).
  - The stop-time must survive Instagram's loudness handling: keep the room silent but not digital zero for the full beat (−60 dBFS air), or the platform's player may treat it as a glitch.

---

## 9. Side by side

| | C1 The beep | C2 Not even ours | C3 Three myths | C4 Five minutes |
|---|---|---|---|---|
| Hook device | sound (beep) + statement about the viewer | contradiction from an AI brand | numbered open loop | clock + rule |
| Retention device | study bar → diptych → message card | the 168-cell week grid | counter 3→1→2→3, strikes | clock + curve, stop-time |
| Main platform signal | comments, sends | sends, comments (debate) | saves, comments | saves, sends |
| Third-party number | 411 Locals (voiced, credited) | none (arithmetic) | none | Oldroyd / MIT Sloan with InsideSales (voiced, credited) |
| Plan gates shown | none | none | none | none |
| New parts | `VmLine`, `StudyBar`, `MessageCard`, `fx-vm-beep` | `WeekGrid` | `MythCard`, `StrikeRule`, Skills stub | `DecayChart`, clock live mode |
| New voice lines | 6 | 7 | 8 (+ `lang-en`) | 7 |
| Effort | medium | medium | medium-heavy | medium |
| Biggest risk | rhetorical generalisation; vendor study | read as anti-AI; densest script | length; transfer conditions | skip rate; study caveats |

**What C adds to the synthesis.** If only one or two of mine make the final four, I'd take **C2** (no other draft has the "keep your people" stance, and it carries the highest heuristic score and the most debate) and **C3** (the best pinned objection-handler, and it reuses B's app-panel work). C1 overlaps A1's after-hours pain but brings the sourced number and the beep. C4 is the strongest pure-education piece, and the right reel to test once Trial Reels exist.

## 10. Shared build list for C (beyond the kit)
1. Forked Captions (`src/ig/components/Captions.tsx`) **plus a `display` map** (numerals over spoken word spans). C2 and C4 need it, A suggested it, so build it once.
2. `StrikeRule` (C3; also usable as a series device by A or B).
3. Small parts: `VmLine`, `StudyBar`, `MessageCard` (C1), `WeekGrid` (C2), `MythCard`, Skills section stub (C3), `DecayChart`, clock live mode (C4).
4. IG-local icons: `message-circle` (shared end card), `phone-forwarded`, `lock`.
5. One new SFX: `fx-vm-beep` (B5 sine, phone band), built by the IG sound driver with `dsp.mjs` and written under the IG sfx dir (never `public/sfx` or `public/kb`).
6. Four bed arrangements in `scripts/ig/bed.mjs` (copied instruments): C1 silent-then-in, C2 the shift pulse, C3 hush/bloom with the mallet phrase, C4 clock pulse + stop-time.
7. 28 new Tessa lines in `scripts/ig/voice-lines-ig.json` (ids `ig-c1-*` … `ig-c4-*`), plus the borrows `kb2-brand` (kb) and `lang-en` (main).
