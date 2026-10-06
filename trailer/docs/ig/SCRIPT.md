# Instagram reels: the final four (SCRIPT)

Label `synth`. Written on 2026-10-06 at HEAD `4ea0aa8` (`claude/remotion-trailer`). This is a planning document: no code, scripts, `public/` or `src/` were touched.

What this synthesis draws on:
- `docs/ig/RESEARCH-product.md`: product truth, the kit, the render path
- `docs/ig/RESEARCH-reels.md`: the platform
- the twelve drafted concepts (`drafts/concepts-{A,B,C}.md`)
- the two judges (`drafts/judge-{growth,production}.md`)
- `docs/kb/PIPELINE.md`

Every product line below was re-checked in the site source; the paths are given in §0.4.

Companion files:
- `docs/ig/POSTING.md`: captions, covers, DMs, schedule, measurement, profile
- `docs/ig/PIPELINE.md`: how the builders make it
- `scripts/voice-lines-ig.json`: every spoken line

---

## 0. Decisions

### 0.1 The four, in posting order

| id | Title | Length | Hook (frame 0 + first words) | Proof | Ends on (CTA) | Plan gate |
|---|---|---|---|---|---|---|
| **ig1** | **Not even ours** | 26.0 s · 13 bars · 780 f | desk-phone ring + "Don't fire your receptionist for an AI. Not even ours." | the week grid: 45 of 168 hours staffed; the other 123 turn teal | "Five free minutes, no card. Comment AGENT for the link." | none |
| **ig2** | **Booked after hours** | 22.0 s · 11 bars · 660 f | ring in the dark + "Nine forty-seven. You're closed. Watch it book this call." | one call, agent's side: greeting with AI disclosure → two times → name → "You're booked" | "Calendar booking comes with Pro." + "Comment AGENT for the link." | **Pro, spoken and shown** |
| **ig3** | **Twelve minutes** | 24.0 s · 12 bars · 720 f | colour timer at 12:00 + a phone ringing across the room + "Twelve minutes on the colour. You can't touch the phone." | the agent answers from the salon's own list; the timer hits 00:00 on the hang-up | "Try it free on your price list. Comment AGENT." | none |
| **ig4** | **Can you trip it up?** | 26.0 s · 13 bars · 780 f | ring + a price list + "Can you trip up this AI receptionist?" | three phrasings land on one line; a question that isn't written down gets the owner's own fallback | "Test it free. Comment AGENT, then try to trip it up." | none |

**Lengths are 26 / 22 / 24 / 26 s**, all inside the client's 0:20–0:30.

**Masters** are 1080×1920 at 120 fps: a 30 fps timeline × SUB 4, so 3120 / 2640 / 2880 / 3120 render frames.

**Delivery**, one pair per reel: an H.264 file at 1080p 120 fps, ≤ 28 MB (the client's spec), plus a 60 fps upload copy.
- Instagram's published Reels spec stops at 60 fps (RESEARCH-reels §2.4). The client should hear one line about this: "the 120 fps file is the master, and Instagram plays at most 60."

**The arc a stranger gets from any two of them:**
1. Why: keep your people; cover the empty hours.
2. What it looks like: one of those hours, booked.
3. Is it for me: hands in tint, and it answers from your list.
4. Don't take our word for it: try to trip it up, free.

### 0.2 How the drafts were grafted (both judges' fixes applied)

| Reel | Base | Grafted in | Fixes applied |
|---|---|---|---|
| ig1 | C2 "Not even ours" (both judges picked it) | the B family's desk-phone trill at 0.0 s (growth fix 2) | cut `ig-c2-person` (both judges); grid filling by ≈ 3.7 s; impact one bar before the end; caption explains how calls reach the agent (production 3.3) |
| ig2 | B1 "Watch it book" (growth #2), rebuilt as production §4's honest Pro reel | A1's frame-0 clock with the rose line light as its colon and film 2's orb birth (production's #1 reel); A1's "9:47 pm" specificity | caller's **name collected** before booking; **no SMS** (one gate, not two); **no call timer** (the reel claims no real-time continuity); PRO + BETA chips; no Google logo (trademark line in the caption); weekday only, no date; CTA does not put "free" next to booking; keyword AGENT, not BOOK |
| ig3 | A2 "Twelve minutes" (growth #3) | the salon page's own kicker (`lib/pages/industries/salons-spas.ts:51`) | b2 tightened (growth); the tug is **one move** and "+05:00" is cut (production); no ring-delay claim; the routing is answered honestly in caption + pinned comment using the site's wording "point your calls at it" |
| ig4 | B4 "Can you trip it up?" (both judges) | the site's own figure labels "Asked as", "Lands on", "Close enough to answer" | "Three ways to ask" cut; page headed "Northside Studio · Price list" so "$85" reads as the sample's price; 1 px "nudge" cut; hook left-aligned ≤ 820 px; Ava answers the hardest phrasing; CTA loops into the hook; test on a real agent before posting |

**Benched, with the reason:**
- **A1.** Its clock, colon light and orb birth live in ig2. Its rewind and C1's voicemail beep are kept for a later "Same call, two endings" reel.
- **A3.** Dropped: a near re-cut of film 2, and it has the weakest hook.
- **A4.** Kept for a Facebook push later. It needs a bought number and live transfers, and its audience is thinner on Instagram.
- **B2.** Becomes a carousel or Story Highlight ("Start free"). It is the heaviest build and has a weak cold hook.
- **B3.** Later, and only for markets where numbers are sold, with native voices. One agent speaks one language. Numbers are not sold in DE, ES, FR, IT, NL, PL or RO.
- **C1.** First reserve.
- **C3.** Becomes a carousel. Its "test one yourself" idea is ig4's CTA.
- **C4.** Becomes a carousel. Its web-lead study does not stretch to missed calls.

### 0.3 Series rules (all four)

**Voice: Tessa only.** One role, `ava` = Tessa (Emotive) `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`, speed 1.05, as in film 2. The client's rule: *the woman's voice speaks whenever there is text on screen.*
- **Narrator lines** are untagged captions.
- **The sample agent "Ava" on a call** is tagged `● AVA` in sunday teal, and the orb speaks.
- **Callers are never voiced.** A caller's words appear on screen only when Tessa says them (ig4):
  - ig2 and ig3 are **one-sided calls**. The agent restates what was asked ("Saturday morning?", "A walk-in trim?"), as good receptionists do. The caller's turn is a `● CALLER` row with a slate **level meter** (five bars, no words, no voice), with the line hiss lifted 3 dB. The gaps are 0.6–0.8 s; this compression is honest because no call timer is shown.
  - In ig4 the narrator **reads the phrasings** under the site's own label "Asked as". She is demonstrating what callers say, not playing a character.
- This also removes the four-caller density both judges flagged.

**Captions:**
- On-screen words = the line's `say`, word-synced through the IG Captions fork. Each caption rises as a unit 2 f ahead of its first word, holds ≥ 1 beat after its last word, and leaves in 4 f.
- **≤ 7 words per screen.** The screens are listed per beat below as word-index spans.
- **Frame-0 rule:** each reel's first screen is already set at frame 0 at 72 % ink, so the cover and the muted first impression read. Each word lifts to 100 % with a 1-frame accent glint on Tessa's onset (C's rule).
- **`display` map** (new, built once in the fork): numerals over spoken word spans.
  - ig1: `45 hours.`, `168.`, `123?`
  - ig2: `9:47 pm.`
  - ig4: `$85.`

**App chrome is not a line** (film 2's precedent):
- Outcome pills, tool rows, tab and field labels, document lines, chips and "Asked as" stay ≤ 32 px (document lines ≤ 44 px, as objects).
- Each appears on, or after, the spoken word it belongs to.
- Every string is the dashboard's or the site's own (§0.4). No heading-size text ever appears without her voice.

**Colour and ground:**
- One accent per part. Every reel turns **rose** (ringing, missed, the dilemma) into **sunday teal** (answered) once. **Graphite** = people. **Slate** = the caller.
- Palettes only from `src/kb/palettes.ts`: `MUTED_MESH`, `KB_MESH`, `INK_MESH`, `MOMENT_LIGHTS.{rush,sunday,night}`. Outcome pills use the app's own colours: Booked emerald, Answered blue, Message taken indigo, Transferred violet.
- **Only ig2 has a dark ground** (encode-tested first, PIPELINE §8).

**House motion:**
- Pure functions of `t`, no CSS animation. Reveals rise out of masks; no blur, glow or bokeh.
- One moving text at a time. Moving type rides the sub-pixel glide layer.
- Springs from `lib/motion` (`SPRING.site/pop/land`, `EASE.house/inOut/draw/in3`). Typographic apostrophes (`typo()`). No people and no handset are drawn: a phone is the rose line light and its sound.

**Grid:**
- 120 BPM: bar = 60 f = 2.0 s, beat = 15 f, 8th = 7.5 f, 16th = 3.75 f. Bar *n* starts at f = 60(n−1).
- Rings land on beats. The **logo impact lands on the bar line one bar before the end** (growth fix 3).

**Anchoring:**
- The frames below are **targets**. `src/ig/<reel>/timing.ts` places each line at `upBeat`/`upQuarter(previous voiceEnd + gap)` from the measured takes, as both films did.
- Act boundaries, IMPACT and END stay on the stated bars. A long take borrows from the gaps before the CTA, never from the hook. If it still does not fit, the reel gains one bar (it stays ≤ 28 s).

**Layout bands** (1080×1920; PIPELINE §7 enforces them):

| Band | y | Use |
|---|---|---|
| Top UI | 0–239 | mesh only, no text, no orb |
| Label band | 240–340 | kicker, orb parking, chrome labels |
| Stage | 340–1180 | cards, grid, panel, page |
| Caption band | 1200–1480 | captions, left-aligned at x 86, max width 820 (to x 906) |
| Bottom UI | 1520–1920 | mesh only |
| **Right rail** | **x > 906 at y 900–1650** | nothing (like/comment/share column) |

- Centred blocks are ≤ 780 px wide (x 150–930 only above y 900).
- **3:4 grid crop** = y 240–1680. Cover words go in x 86–930, y 260–1500.

**The shared end card (`IgEnd`, built once, same choreography in all four):**
1. **CTA (75–83 % of runtime).** The last product shot steps back (× .92, shade .08).
   - The CTA caption rises centred at y 700–860 (caption 68, ≤ 780 px wide).
   - A white **comment field** (radius 60, `meshElevation`) rises at x 174–906, y 940–1060 **before** she says "Comment AGENT", so muted viewers get the instruction (growth fix). It holds an IG-local lucide `message-circle` icon at x 214, a caret, and a teal send disc Ø 72 at x 812–884.
   - **AGENT types one letter per 16th** from her word "AGENT" (`typedCount`, no rise), with `keys` cues. The send disc presses (.97) as the last word ends.
   - Nothing imitates Instagram's own UI: no placeholder text, no logo, no username.
2. **Impact on the bar line (END − 60).**
   - The field leaves up through its mask (4 f).
   - `kb/scenes/cta/LightGL` blooms with **one teal emitter** into the filled backlight.
   - The **NEUROVOICE** wordmark (film 1 `cta/EndCard` `Wordmark`, dark ink, Inter Tight via `cta/font/wordmark.css`) surfaces centre-out at y 760–900, ≤ 800 px wide.
   - `ig1-07` "Neuro Tech Voice." starts 4 f after the impact, into its ring.
   - `neurotechvoice.com` (EndCard `Url`, Geist Mono 44, y ≈ 1000, x ≈ 300–780) types on "Neuro | Tech | Voice".
   - There is no "Start free" button: it is unspoken, and it would split the CTA.
3. **Seam (last 14 f).**
   - The wordmark leaves up and the reel's frame-0 composition re-forms, mid-motion.
   - The mix fades exponentially to < −60 dBFS on the last frame (check-mix).
   - Frame 0's ring is the replay's first sound, so autoplay loops read as continuous.

**Sound family:**
- 120 BPM, E major (both films' key). One `scripts/ig/bed.mjs` with four arrangements (film 2's instruments copied).
- The **desk trill** `fx-trill` (G#4/B4) means "a call" in every reel and is each reel's frame-0 attack.
- The **mallet pentatonic** E4 F#4 G#4 B4 E5 means "true / done".
- Every reel builds a half-bar snare roll into the impact (E chord), then the name into its ring, then the fade.
- Levels: Instagram master −14 LUFS integrated, ≤ −1 dBTP after AAC; dialogue −18.5 LUFS (PIPELINE §6).

### 0.4 Truth table (every claim the four make, with its source)

| Claim in a reel | Source | Hedge kept |
|---|---|---|
| It tells every caller it's an AI, in its opening line | `lib/site.ts:2527-2529`; `lib/voice/greetings.ts:243-247` | ig2/ig3 greetings say "an AI assistant" aloud; the greeting is the owner's to word, the disclosure is not optional |
| Answers on the first ring | `lib/site.ts:713` `SHELF_CLAIM` | said of one call; no latency number |
| Takes messages; puts calls through to people you listed | `lib/voice/tools/definitions.ts:145-176`; `lib/site.ts:2522`; "Live transfers" `components/skills/TeamSkill.tsx:110` | "people you listed" is spoken; caption: real callers need a bought number |
| 9 to 6 × weekdays = 45 of 168 hours; 123 left | arithmetic; the site's own "arithmetic rather than a claim" (`lib/pages/industries/salons-spas.ts:245`) | "example schedule, put in your own" (caption) |
| "the work only people can do" | `lib/pages/ai-agents.ts:149-150`; film 2 `kb2-vo-8` | never "replace staff" |
| Booking needs availability, the caller's yes **and their name** | `definitions.ts:83` (`book_appointment`) | the call shows all three |
| Calendar booking is Pro and up, Google Calendar in beta | `lib/pages/ai-agents.ts:40`; `lib/billing/entitlements.ts` (trial `googleIntegrations: false`) | spoken in ig2; PRO + BETA chips; trademark line in caption |
| Answers from your own documents, matched on meaning | `lib/pages/knowledge-base.ts:27-28, 213, 238-240` | caption: "can occasionally get something wrong" (`:393`) |
| Where your documents stop, it says so; the owner writes the fallback | `knowledge-base.ts:362, 373`; field label `components/agent/tabs/TabConversation.tsx:312` | the line in ig4 is the owner's, shown in that field |
| Knowledge base on every plan, the trial included; test calls never touch the five minutes | `knowledge-base.ts:495-497`; `lib/site.ts:1813` | "Try/Test it free" only next to ungated features |
| Five free minutes, no card (14 days) | `lib/pages/home/pricing.ts:224`; `lib/site.ts:1812` | never next to booking |
| "Point your calls at it" / its own number alongside your line, no porting | `lib/pages/ai-agents.ts:40`; `components/site/industry/closing.tsx:35`; `lib/site.ts:1932` | caption + pinned comment (ig1, ig3) |
| Sample business, agent, price list | `lib/pages/home/credits.ts:15-18`; `knowledge-base.ts:59, 76-82` (`Sports massage · 60 min · $85`) | page headed "Northside Studio · Price list"; captions say "sample" |
| Dashboard strings shown | `components/calls/call-display.tsx:12-44` (Booked, Answered, Message taken, Transferred; "Checked your availability", "Booked an appointment", "Looked it up in your documents"); `lib/pages/knowledge-base.ts:215, 365` ("Asked as" / "Lands on" / "Close enough to answer"); `components/agent/tabs/TabKnowledge.tsx:44-50` (type labels) | — |

**Not said anywhere:**
- any price of ours, minute allowance or plan other than Pro (named only as the booking gate)
- "every call", "never misses", "every language", "5 minutes"
- statistics, testimonials or customer names
- SMS, porting, or a language switch
- "Tessa is the voice you get"

---

## ig1 · "Not even ours"
**26.0 s · 13 bars · 780 timeline frames (3120 at 120 fps).** Impact f720 (bar 13, 24.0 s). END f780.
Acts (`SCENES`): `hook` 0–105 · `hours` 105–255 · `shift` 255–360 · `does` 360–480 · `desk` 480–585 · `end` 585–780.

### 1. Premise
An AI company tells owners **not** to fire their receptionist for an AI, its own included, and then proves with arithmetic which hours an agent should cover instead. A desk open 9 to 6 on weekdays is staffed for 45 of the week's 168 hours. The other 123 cascade teal: the agent's shift.

### 2. Why it performs
- **Stop:**
  - a contradiction from an AI brand, resolved by "Not even ours" in under 3.1 s (hookscore 87, the highest of all the drafts)
  - over a ringing desk phone at 0.0 s
  - with the full first sentence readable on frame 0
- **Hold:** the week grid. Viewers count along: a number is promised (45), a bigger one arrives (168), then the remainder lights up. That mid-reel payoff lands at ≈ 10 s (38 %).
- **Spread:** sends and debate ("see, it's not coming for your job"), between owners, office managers and receptionists. It also pre-empts anti-AI comments, which is why it posts first.
- **Converts:** it reframes the purchase from "replace a salary" (scary) to "cover the hours nobody's there" (easy). That use needs a real number and a paid plan.

### 3. Beat sheet

| Beat | Frames | Seconds | VO (id @ frame) | Screens (word spans of `say`) |
|---|---|---|---|---|
| b1 Hook | 0–105 | 0.00–3.50 | `ig1-01` @6: "Don't fire your receptionist for an AI. Not even ours." | S1 [0–6] "Don't fire your receptionist / for an AI." (set at f0, 72 %) · S2 [7–9] "Not even ours." |
| b2 Hours | 105–255 | 3.50–8.50 | `ig1-02` @108: "Nine to six, weekdays: forty-five hours. The week has a hundred and sixty-eight." | S3 [0–5] "Nine to six, weekdays: 45 hours." · S4 [6–12] "The week has 168." |
| b3 Shift | 255–360 | 8.50–12.00 | `ig1-03` @255: "The other hundred and twenty-three? That's the agent's shift." | S5 [0–4] "The other 123?" · S6 [5–8] "That's the agent's shift." |
| b4 Does | 360–480 | 12.00–16.00 | `ig1-04` @360: "It answers, takes messages, and puts calls through to people you listed." | S7 [0–3] "It answers, takes messages," · S8 [4–7] "and puts calls through" · S9 [8–11] "to people you listed." |
| b5 Desk | 480–585 | 16.00–19.50 | `ig1-05` @483: "Your receptionist keeps the work only people can do." | S10 [0–4] "Your receptionist keeps the work" · S11 [5–8] "only people can do." |
| b6 CTA | 585–720 | 19.50–24.00 | `ig1-06` @585: "Five free minutes, no card. Comment AGENT for the link." | S12 [0–4] "Five free minutes, no card." · S13 [5–9] "Comment AGENT for the link." |
| b7 Brand | 720–766 | 24.00–25.53 | `ig1-07` @724: "Neuro Tech Voice." | wordmark + `neurotechvoice.com` |
| b8 Seam | 766–780 | 25.53–26.00 | — | S1 back in place at 72 % |

66 words over 26 s: 2.5 w/s overall, ≤ 3.1 inside each line. The CTA starts at 75 %.

### 4. Picture, camera and sound per beat

**b1 Hook (f0–105)**
- **Ground:** pearl `MeshGround variant='light'` on `MUTED_MESH`, warmed toward graphite (`keyLight` low-left, strength .35), already drifting at f0.
- **Type:** S1 in headline 92, left at x 86, on three rows ("Don't fire your" y 420 · "receptionist" y 524 · "for an AI." y 628). "fire" is in rose ink; the rest is graphite at 72 %. Each word lifts to 100 % on its onset.
- **The desk:** a 1.5 px graphite hairline at y 760 draws from x 86 to x 906 (`EASE.draw` 0.6 s, started at f −6, so it is moving at f0). At its right end sits a rose line light (`MeshOrb` 18 px, `MOMENT_LIGHTS.rush`), the front-desk phone. A rose `RingPulse` leaves it at f0 and at f30.
- **≈ f22 "fire":** a 1-frame rose glint.
- **S2 at `vWord(ig1-01,7) − 2` (≈ f66):** S1 exits up through its masks (4 f). "Not even ours." rises at y 520 in display 112, teal ink. Its full stop is the teal orb (`MeshOrb` Ø 40, breathing): the brand's mark punctuates the joke.
- **Camera:** slow push 1.00 → 1.02 (container transform, `camMotion` for the glide flag).
- **Sound:**
  - f0: `fx-trill` (key hit; the frame-0 attack), and its second burst at f30.
  - The bed starts at f0 at −6 dB under the voice: shaker 8ths plus a muted felt-piano ostinato on E in a low graphite register (the "shift pulse").
  - ≈ f22: a soft `thump`.
  - ≈ f88 "ours": `ping` + `chime-sunday-soft`.
- **Kit:** `MeshGround`, `MeshOrb`, `hook/Rings` (`RingPulse`), forked Captions.

**b2 Hours (f105–255)**
- **Grid in:** S2 exits up. The orb full stop detaches and parks at (840, 300), Ø 40, breathing. The **WeekGrid** (new) rises in as a unit (f105–111):
  - 7 columns × 24 rows of rounded 6 px SVG cells, x 130–890, y 360–1140
  - cells 92 × 26, gaps 16 / 6, pale graphite at 10 %
- **On "Nine" (≈ f110):** a Geist Mono chrome tick "09" (28 px) appears at the left edge of row 9; on "six", "18". On "weekdays", the label "MON–FRI" (label role) appears above columns 1–5.
- **The staffed block** (rows 9–17 × columns 1–5 = 45 cells) fills graphite column by column, one column per 16th, from "Nine" (f110 → f129). The grid is filling by 3.7 s (growth fix).
- **On "forty-five" (≈ f165):** S3 shows "45 hours." and the block's outline lifts once (`SPRING.pop`, 4 px).
- **On "a hundred and sixty-eight" (≈ f215–240):** the camera eases back 1.02 → .94 (`EASE.inOut`, 0.8 s), and every empty cell draws its hairline outline in one diagonal wave (32nds).
- **Sound:** `fx-tick` × 5 on the 16ths (columns); `fx-tock` on "forty-five"; a soft `swish` on the camera move.
- **New:** `WeekGrid` (≈ 180 lines; fills and outlines are pure functions of `t`). **Kit:** `Camera`/`camMotion`, display map.

**b3 Shift (f255–360). The mid-reel payoff.**
- **On "other" (≈ f262):** the 123 empty cells fill **teal** (sunday ink at 70 %) in a diagonal cascade. It starts at Friday 18:00 and runs through the nights and the weekend, one row-diagonal per 16th, over ≈ 1.2 s (f262–298).
- **Ground:** a sunday pool rises behind the grid (`paletteB = MOMENT_LIGHTS.sunday.ground`, `mix` 0 → .3 over 1 s).
- **On "agent's shift" (≈ f320):** the parked orb glides into the grid's top-right corner (840, 400) and grows to Ø 120 (y < 900, so clear of the rail). It breathes on her envelope (narrator volume `.12 + .6·env`).
- **Sound:**
  - f262: pad and strings open an octave.
  - `fx-pluck` rising arpeggio (E-major pentatonic) on 16ths through the cascade.
  - `glint` + `fx-ting` on "shift".

**b4 Does (f360–480)**
- The grid recedes (× .86, shade .1) and stays visible.
- Three white outcome cards land stacked (x 140–880, y 480–900, `SPRING.land`, contact shadows thickening), each on its verb. Each card is a `Panel` with an **OutcomePill** (new) and ink bars, with no unspoken words:
  - "answers" → **Answered** (blue)
  - "messages" → **Message taken** (indigo)
  - "puts calls through" → **Transferred** (violet)
- **On "people you listed":** a contact row slides under the third card (y 820–880): avatar disc, an ink bar for the name, an IG-local lucide `phone-forwarded` icon, and the tag "Live transfers" (28 px).
- **Sound:** light kick on 1 and 3 from f360; `fx-tag` × 3 on the cards; `line` on the contact row.

**b5 Desk (f480–585)**
- The cards fan out and leave (`SlipStack` collapse, exiting up through a mask).
- The grid returns to full size (camera .86 → 1.0). On "receptionist" the graphite block lifts 8 px with a `ContactShadow`: people. The teal stays: the agent.
- "only people can do" takes graphite accent ink. The orb dims to rest.
- **Sound:** the bed thins to piano (the people beat); `land` on the lift.

**b6–b8 End (f585–780):** the shared `IgEnd` (§0.3), over the two-colour grid.
- The field rises at f593.
- AGENT types from `vWord(ig1-06,6)`. The send press lands on the end of "link".
- Snare roll from f690. Impact + `sub` + E chord at f720. `ig1-07` at f724; URL keys on her syllables.
- **Seam:** the teal drains from the grid back into the orb, the grid collapses into the desk hairline, the orb shrinks to the rose desk dot, and S1 rises into place at 72 % by f779. `MIX.fadeOut` [766, 780].

### 5. Safe zones and the cover
- **Zones:** the hook type is at x 86–≈ 900, y 420–700, above the rail band. Grid x 130–890; cards x 140–880; captions x 86–906 in y 1200–1480. The orb parks at (840, 300/400), above y 900. Nothing below y 1480.
- **Frame 0** is a designed still inside the 3:4 crop (y 240–1680): the headline, the moving desk hairline and the ringing rose dot.
- **Cover** (custom PNG from `IG1-Cover-9x16`, built on f330's two-colour grid):
  - the kicker `AI RECEPTIONIST · 01` (label role, x 86, y 270)
  - the title **"Don't fire your receptionist."** (128 px, "fire" in rose, x 86, y 330–700, every line measured ≤ 844 px)
  - the grid thumbnail, graphite and teal, at y 760–1460
  - all inside x 86–930, y 260–1500
- **Fallback cover:** frame 0.

---

## ig2 · "Booked after hours"
**22.0 s · 11 bars · 660 f (2640 at 120 fps).** Impact f600 (bar 11, 20.0 s). END f660.
Acts: `hook` 0–105 · `call` 105–465 · `booked` 465–528 · `end` 528–660.

### 1. Premise
It's 9:47 pm and the studio is closed; the phone rings. "Watch it book this call."
- The agent picks up on the first ring and says it's an AI.
- It checks Saturday morning and offers ten or eleven-thirty.
- It confirms ten, asks the caller's name and books it.
- It files the call.

Then the honest line: "Calendar booking comes with Pro."

### 2. Why it performs
- **Stop:** a ring in the dark at 0.0 s, the time as a lockup with the ringing light as its colon, and a promise ("Watch it book this call.") by 1.7 s. This is the "listen to this call" format that voice AI is known for (RESEARCH-reels §4).
- **Hold:** an open loop (will it actually book?). Something changes every 0.6–1.2 s: the tool row spins to a check, chips light, a chip fills, the chip becomes an event, the Booked pill swaps in. "You're booked" lands at 13.9 s (63 %).
- **Spread:** "look what AI can do", sent to the person who answers the phones.
- **Converts:** the only reel that sells the **paid tier on purpose**. Booking is Pro, said aloud and shown with PRO + BETA chips. The DM and the pinned comment say what the free trial can do (build it, hear it answer, take messages), so trial users don't churn on day one.

### 3. Beat sheet

| Beat | Frames | Seconds | VO (id @ frame) | Screens |
|---|---|---|---|---|
| b1 Hook | 0–105 | 0.00–3.50 | `ig2-01` @6: "Nine forty-seven. You're closed. Watch it book this call." | S1 [0–1] "9:47 pm." (the clock lockup, display map) + [2–3] "You're closed." (both set at f0, 72 %) · S2 [4–8] "Watch it book this call." |
| b2 Pickup | 105–111 | 3.50–3.70 | — (pickup click) | — |
| b3 Greeting | 111–192 | 3.70–6.40 | `ig2-02` (Ava) @111: "Northside Studio, this is Ava, an AI assistant." | transcript row `● AVA` [0–7] |
| b4 Caller | 192–216 | 6.40–7.20 | — | `● CALLER` row: level meter, no words |
| b5 Offer | 216–288 | 7.20–9.60 | `ig2-03` (Ava) @216: "Saturday morning? I have ten, or eleven-thirty." | `● AVA` [0–6] |
| b6 Caller | 288–306 | 9.60–10.20 | — | meter row |
| b7 Choice | 306–363 | 10.20–12.10 | `ig2-04` (Ava) @309: "Ten it is. And your name?" | `● AVA` [0–5] |
| b8 Caller | 363–381 | 12.10–12.70 | — | meter row |
| b9 Booked | 381–465 | 12.70–15.50 | `ig2-05` (Ava) @384: "Thanks, Maya. You're booked, Saturday at ten." | `● AVA` [0–6] |
| b10 The gate | 465–528 | 15.50–17.60 | `ig2-06` @483: "Calendar booking comes with Pro." | S3 [0–4] (caption band) |
| b11 CTA | 528–600 | 17.60–20.00 | `ig2-07` @543: "Comment AGENT for the link." | S4 [0–4] |
| b12 Brand | 600–646 | 20.00–21.53 | `ig1-07` @604: "Neuro Tech Voice." | wordmark + URL |
| b13 Seam | 646–660 | 21.53–22.00 | — | the 9:47 pm lockup back |

50 words over 22 s: 2.3 w/s. The gate line starts at 73 % and the CTA at 82 %.

### 4. Picture, camera and sound per beat

**b1 Hook (f0–105)**
- **Ground:** the series' only dark ground. `MeshGround variant='deep'` on `INK_MESH`, with a `MOMENT_LIGHTS.night` tint (ground + ink), `keyLight` on the colon, `dither` 1, and the IG finish grain re-seeded at 30 fps (PIPELINE §8).
- **S1a, the clock lockup "9:47 pm."** Film 1 `hook/Clock` `ClockLockup`, Instrument Sans 600 tabular, ≈ 220 px figures, paper ink at 90 %, centred at y 300–520. **Its colon is the rose line light** (`MeshOrb`, `MOMENT_LIGHTS.rush`), mid-pulse, with a `RingPulse` already in flight (launched at f −4). The lockup *is* the caption of "Nine forty-seven" (display map), so it is spoken text.
- **S1b "You're closed."** Headline 92, centred ≤ 780, y 640–740.
- **S2 at `vWord(ig2-01,4) − 2` (≈ f54):** "You're closed." exits up, and "Watch it book / this call." rises (y 640–840). "book" takes a teal glint on its onset.
- **f80–105:** a white call panel's top edge rises from y 1920 toward y 1500, pulling the eye down into the demo.
- **Camera:** a 0.4 % breathing push.
- **Sound:**
  - Room tone (`fx-roomtone`, night) at ≈ −53 dBFS, plus `fx-trill` at f0 and f60, each with a `RingPulse` and a low `sub` pulse at −24 dBFS.
  - **No bed**: the ring is the opener.

**b2–b3 Pickup and greeting (f105–192)**
- **f105, pickup:** a `fx-pickup` click cuts the ring, and `fx-linehiss` comes in at −50 dBFS.
- **The colon light springs open into the teal orb.** This is film 2's birth: a 3-frame seed, `SPRING.pop` 0 → 1.06 → 1, one hairline ring, and `mixPalette` rush → sunday over 6 f.
- The figures exit up through their masks. The orb glides (`EASE.inOut` 0.6 s) to the label band at (160, 300), Ø 132.
- **The call panel** finishes rising (`SPRING.site`): a white `Panel` at x 86–906, y 400–1180, `meshElevation` with `INK_MESH` shadow ink.
  - **Header row** (y 430): `● SAMPLE CALL` (label 28, graphite; the site's own `REEL.kicker`). **No call timer.**
  - **Body:** the **LiveTranscript** (new). Rows append as turns: a `TurnLabel` tag (`● AVA` teal / `● CALLER` slate, label 28) plus words in title 52, word-synced. That row *is* the caption.
  - Two or three rows stay visible. Older rows scroll up under a paper fade mask, one row per turn, `SPRING.site`.
- **ig2-02:** "an AI assistant" takes the teal glint. The orb speaks at the in-call volume (`.44 + .38·env`).
- **Sound:**
  - f108: `fx-seed` + `fx-ting` (the birth).
  - **f120, bar 3:** the bed enters, a muted felt-piano ostinato (B–E 8ths) with a sub on 1, ducked −8 dB under the call.

**b4, b6, b8 Caller turns (f192–216, 288–306, 363–381)**
- A `● CALLER` row appends with the **CallerMeter** (new): 5 slate bars (8 × 28 px) bouncing on a seeded envelope. There are no words.
- The orb switches to its `listen` palette and leans (scale .97).
- **Sound:** `fx-linehiss` +3 dB only. Nothing is voiced.

**b5 Offer (f216–288)**
- **On "Saturday morning?":** an inline **ToolRow** (meta 30, lucide `loader` turning) reads "Checked your availability" and resolves to a drawn `CheckMark` at ≈ f240.
- **The SlotStrip** (new) rises inside the panel's lower part (y 960–1120):
  - the chrome label "SAT" (28 px)
  - five chips, 150 × 72 with 14 px gaps (x 120–872): `9:00 · 10:00 · 10:30 · 11:30 · 12:00`
  - 9:00, 10:30 and 12:00 are taken: 35 % ink with a hairline strike
  - 10:00 and 11:30 take a teal outline as the check lands
- **On "ten" and "eleven-thirty":** each free chip pulses (`SPRING.pop` 1 → 1.04 → 1).
- **Sound:** a quiet `fx-tick` roll under the spinner (f218–240); `fx-ting` on the check; a brushed 16th shaker enters at f240; `fx-pluck` G#5 on "ten" and B5 on "eleven-thirty".

**b7 Choice (f306–363)**
- **On "Ten":** the 10:00 chip fills teal and its label turns paper-white.
- **Sound:** `fx-tock`.

**b9 Booked (f381–465)**
- **On "Maya" (≈ f396):** a small name chip "Maya" clips onto the 10:00 chip. It is a spoken word.
- **On "booked" (≈ f417):** the chip widens in place into an **event block** "Maya · Sat 10:00". The ToolRow "Booked an appointment" ticks. The harmony lifts A → B.
- **f465, hang-up (beat):** `Swap` turns the header's `● SAMPLE CALL` into the outcome pill **Booked** (emerald, `OUTCOME_META.booked`, the only emerald in the series).
- **Sound:** `fx-mallet-e5` + a small `pop` on "booked"; at f465, `fx-click-down/up` (hang-up) with the line hiss cut on the sample.

**b10 The gate (f465–528)**
- **f468:** the panel folds to its header and steps back (× .92, shade .06). Two white cards land on 16ths (`SPRING.land`, contact shadows):
  1. An **EventCard** (new, x 120–880, y 560–820): a neutral day column headed "Saturday" with the block "Maya · 10:00". **No Google UI and no logo.**
  2. A **RecordCard** (x 120–880, y 860–1040): kit `RecordRow` with the `TRANSCRIPT` row label, the Booked pill and ink bars.
- **On "Pro" (≈ f520):** a **PRO** chip (label 28, violet `APP.primary` outline) clips onto the EventCard's top-right, with a **BETA** chip beside it (the app's own beta badge, as on "Connect Google Calendar"). The caption explains it.
- **Camera:** a slow push × 1.00 → 1.03.
- **Sound:** `fx-paper` slaps tuned E4 / G#4 (f468, f472); a strings swell under the cascade, thinning under the gate line; `fx-tag` on the PRO chip.

**b11–b13 End (f528–660):** the shared `IgEnd`.
- The stack drifts up and dims to 40 %. The field rises at f531.
- AGENT types from `vWord(ig2-07,1)`. Send at the end of "link". Snare roll from f585.
- Impact at f600; `ig1-07` at f604.
- **Seam:** night returns. The orb shrinks back into the colon of the "9:47 pm" lockup, which rises into place. A `RingPulse` launches at f656, so the replay begins mid-pulse exactly as frame 0 shows it. `MIX.fadeOut` [646, 660].

### 5. Safe zones and the cover
- **Zones:** clock and headline at y 300–840 (above the rail band, centred ≤ 780). Panel at x 86–906, y 400–1180, with the slot strip at x 120–872. Gate and CTA caption in the caption band.
- **Dark-ground note:** the night mesh is the banding risk. Encode-test a 2 s strip of f0–60 at this reel's bitrate before building anything else (PIPELINE §8).
- **Cover** (custom PNG from `IG2-Cover-9x16`, night ground):
  - the kicker `AI RECEPTIONIST · 02` (y 270)
  - the "9:47 pm" lockup with the teal orb as its colon (y 330–560)
  - the title **"Booked at 9:47 pm."** (128 px, paper ink, y 640–900)
  - a small emerald **Booked** pill with the **PRO** chip (y 980–1060), so the gate is visible on the grid too
  - all inside x 86–930
- **Fallback cover:** frame 0.

---

## ig3 · "Twelve minutes" (salons)
**24.0 s · 12 bars · 720 f (2880 at 120 fps).** Impact f660 (bar 12, 22.0 s). END f720.
Acts: `hook` 0–240 · `call` 240–435 · `payoff` 435–546 · `end` 546–720.

### 1. Premise
This is the site's own salon line: "Gloves on, tint on, timer running — and the phone is across the room."
- Pick the phone up and the colour over-processes. Leave it and she books elsewhere.
- The call reaches the agent, which answers the walk-in question from the salon's own service list.
- **The call ends on the same frame the timer hits 00:00.**

### 2. Why it performs
- **Stop:** a POV every stylist knows, a countdown already running at frame 0, and a ring (hookscore 84).
- **Hold:** the countdown itself, because viewers wait for zero. The payoff (timer 00:00 = hang-up, check, "Answered") is rewatchable and lands at 14.5 s (60 %).
- **Spread:** "literally us on Saturdays", sent within the salon niche. That niche is the most Instagram-native buyer (growth §1.4).
- **Converts:** everything shown works on the free trial with the owner's own price list. The CTA is exactly that test. It is also the template for a per-trade series (dental, trades, restaurant variants are drafted in concepts-A).

### 3. Beat sheet

| Beat | Frames | Seconds | VO (id @ frame) | Screens |
|---|---|---|---|---|
| b1 Hook | 0–105 | 0.00–3.50 | `ig3-01` @6: "Twelve minutes on the colour. You can't touch the phone." | S1 [0–4] "Twelve minutes on the colour." (set at f0, 72 %) · S2 [5–9] "You can't touch the phone." |
| b2 The pull | 105–240 | 3.50–8.00 | `ig3-02` @108: "Pick it up, the colour over-processes. Leave it, she books elsewhere." | S3 [0–5] "Pick it up, the colour over-processes." · S4 [6–10] "Leave it, she books elsewhere." |
| b3 Pickup + greeting | 240–330 | 8.00–11.00 | `ig3-03` (Ava) @246: "Thanks for calling. This is Ava, an AI assistant." | `● AVA` row [0–8] |
| b4 Caller | 330–354 | 11.00–11.80 | — | `● CALLER` meter row |
| b5 Answer | 354–435 | 11.80–14.50 | `ig3-04` (Ava) @354: "A walk-in trim? You can, Tuesday to Saturday." | `● AVA` row [0–7] |
| b6 Payoff | 435–546 | 14.50–18.20 | `ig3-05` @450: "Timer's done. Caller's sorted. You never looked up." | S5 [0–3] "Timer's done. Caller's sorted." · S6 [4–7] "You never looked up." |
| b7 CTA | 546–660 | 18.20–22.00 | `ig3-06` @546: "Try it free on your price list. Comment AGENT." | S7 [0–6] "Try it free on your price list." · S8 [7–8] "Comment AGENT." |
| b8 Brand | 660–706 | 22.00–23.53 | `ig1-07` @664 | wordmark + URL |
| b9 Seam | 706–720 | 23.53–24.00 | — | timer card back at 12:00 |

58 words over 24 s: 2.4 w/s. The CTA starts at 76 %.

### 4. Picture, camera and sound per beat

**b1 Hook (f0–105)**
- **Ground:** pearl `MeshGround variant='light'` on `MUTED_MESH`, with a rose pool top-left (`paletteB = MOMENT_LIGHTS.rush.ground`, `mix` .2, `keyLight` top-left).
- **The TimerCard** (new), centred: a white disc Ø 440 (x 320–760, y 420–860).
  - A rose SVG progress arc (6 px).
  - Tabular "12:00" (Instrument Sans 600, 150 px, tabular figures) ticking in real seconds: 11:59 at f30, 11:58 at f60, and so on.
  - It is the object "Twelve minutes" names, so it is no unspoken caption.
- **The phone across the room:** a rose line light (`MeshOrb` 22 px) at (150, 300). Rose `RingPulse` hairlines travel from it toward the card and die short of it, at f0, f60, f120 and f180.
- **S1 / S2:** headline 92, left at x 86, y 1080–1300, max 820.
- **Camera:** still. The timer is the motion.
- **Sound:**
  - `fx-trill` at f0, f60, f120, f180 (key hits, −5 dB under speech).
  - A dry `tick` on every real second (every 30 f) from f0 is **the rhythm**.
  - A low E pedal and felt-piano B–E dyads.

**b2 The pull (f105–240)**
- **On "Pick it up" (≈ f110):** the card **tugs** toward the dot. This is one move: translate (−40, −28) px plus rotate −1.5° on `SPRING.site`, returning over 0.5 s.
- **On "over-processes" (≈ f150):** the arc's segment past 12 o'clock darkens to deep rose. Colour only, no move.
- **"Leave it":** the card holds still. **On "elsewhere" (≈ f205)** the rose dot dims to 35 %, the caller giving up. It does not slide out. One moving element at a time.
- **Sound:** `whoosh-soft` + a sub `thump` on "Pick it up"; rings at f120 and f180; the ticks go on.

**b3 Pickup + greeting (f240–330)**
- **f240, bar 5:** a pickup click. **Before the dimmed dot is gone, it springs open into the teal orb** (Ø 200 at (220, 340); the same birth as ig2).
- **The timer card** shrinks and glides to a corner chip (x 700–906, y 260–380; above y 900, so clear of the rail). Its arc turns teal, and it **time-lapses from 11:52 to 00:00 over [240, HANGUP]**, a pure mapping that ends exactly on HANGUP.
- **The call strip** (fork of film 2's `call/Strip` + `TurnLabel`, sharing ig2's LiveTranscript rows) runs at y 520–760, x 86–906. The `● AVA` row shows words in title 56. "an AI assistant" takes the teal glint.
- **Sound:**
  - `fx-pickup` + `fx-ting` (the birth).
  - The bed resolves to E – C#m7 – A – B, ducked under the call.
  - The ticks double to 8ths under the time-lapse; line hiss is in.

**b4 Caller (f330–354):** the CallerMeter row, the orb in `listen`, line hiss +3 dB.

**b5 Answer (f354–435)**
- **On "walk-in trim" (≈ f360):** a `DocPage` slides up at y 820–1160, x 86–906:
  - kind token `PDF`; heading "Services" (32 px)
  - lines as 44 px objects: `Cut & finish` / `Trim · walk-in · Tue–Sat` / `Colour · patch test first`
  - no figures, so no price of anyone's can be misread
- The dashboard chip "Looked it up in your documents" (28 px) rises beside the heading.
- **On "Tuesday to Saturday":** a teal `InkSweep` (12 %) runs under the Trim line.
- **Sound:** `fx-felttip` on the sweep; the ticks go to 16ths into a very low `riser-short`.

**b6 Payoff (f435–546)**
- **HANGUP = f435 (beat 2 of bar 8).** On the same frame:
  - the hang-up click
  - **the corner chip reads 00:00**, springs back to centre at full size (`SPRING.site`), its arc closes, and a teal `CheckMark` draws in the disc
  - the outcome pill **Answered** (blue) lands under it on a kit `RecordRow` (`TRANSCRIPT` + check)
  - the tick **stops dead**
- **This is the rewatch moment: spend the polish here.** HANGUP is re-anchored to `upBeat(voiceEnd(ig3-04) + 4)`, so the time-lapse always ends on it.
- **On "looked up":** the orb dims to rest.
- **Sound:** `fx-mallet-e5` + `fx-glass` ting at f435 (the strongest hit before the impact); `tock` on the pill; the bed opens with a high piano line.

**b7–b9 End (f546–660…720):** the shared `IgEnd`.
- The card and record step back. The field rises at f552. AGENT types from `vWord(ig3-06,8)`.
- Snare roll from f630. Impact at f660; `ig1-07` at f664.
- **Seam:** the timer card rises back to centre reading 12:00 with a rose arc, the dot fades in top-left, and a `RingPulse` leaves at f716. `MIX.fadeOut` [706, 720].

### 5. Safe zones and the cover
- **Zones:** the card at y 420–860; the corner chip above y 900; transcript and page at x 86–906; captions in y 1080–1480 at x 86.
- **Cover** (custom PNG from `IG3-Cover-9x16`, pearl):
  - the kicker `AI RECEPTIONIST · 03 · SALONS` (y 270)
  - the TimerCard at 12:00, Ø 400 (y 330–730)
  - the title **"Twelve minutes on the colour."** (two lines at 128 px, y 820–1120)
  - the rose dot top-left
  - all inside x 86–930
- **Fallback cover:** frame 0.

### 6. Trade variants (after launch; same body, four lines, one document and the cover change)
Dental, trades and restaurant, as drafted in `concepts-A.md` A2 §7: admin calls only, never clinical. Each variant adds its own `igN-*` lines in a new file, so the launch file is not reopened.

---

## ig4 · "Can you trip it up?"
**26.0 s · 13 bars · 780 f (3120 at 120 fps).** Impact f720 (bar 13, 24.0 s). END f780.
Acts: `hook` 0–90 · `asked` 90–345 · `edge` 345–516 · `thesis` 516–594 · `end` 594–780.

### 1. Premise
A challenge to the viewer.
- The narrator reads three ways to ask a price, under the site's own label "Asked as". Every phrasing lands on the same line of a sample price list, including "pricey", which the page never says.
- Ava answers the hardest one.
- Then comes a question that isn't written down ("Do you do home visits?"). Instead of guessing, the agent says the owner's own fallback line.
- "Where your documents stop, it says so."

### 2. Why it performs
- **Stop:** a challenge that makes the viewer a participant, a ring at 0.0 s, and a legible price list on frame 0. The hook heuristic scores it 38 because it reads text only; the visible document and the ring carry it (growth judge).
- **Hold:** "will it fail?" suspense, and a quick-fire rhythm: a ring, a phrasing and a hairline, three times in 5 s.
- **Middle:**
  - a stop-time on the curveball (the bed cuts on the sample)
  - the twist that the best answer is honesty, at 14.6 s (56 %)
  - a verbal loop: "…then try to trip it up." → "Can you trip up this AI receptionist?"
- **Spread:** comments ("ask it about parking!") and saves. The pinned comment turns them into reply-with-a-reel follow-ups on the same kit.
- **Converts:** the CTA *is* the trial action. The knowledge base is on every plan, and test calls never touch the five minutes.

### 3. Beat sheet

| Beat | Frames | Seconds | VO (id @ frame) | Screens |
|---|---|---|---|---|
| b1 Hook | 0–90 | 0.00–3.00 | `ig4-01` @6: "Can you trip up this AI receptionist?" | S1 [0–6] "Can you trip up this / AI receptionist?" (set at f0, 72 %) |
| b2 Asked 1 | 90–135 | 3.00–4.50 | ring f90 · `ig4-02` @96: "How much is an hour?" | slot: "“How much is an hour?”" |
| b3 Asked 2 | 135–195 | 4.50–6.50 | ring f135 · `ig4-03` @141: "What would a session set me back?" | slot: "“What would a session set me back?”" |
| b4 Asked 3 | 195–255 | 6.50–8.50 | ring f195 · `ig4-04` @201: "Is the long massage pricey?" | slot: "“Is the long massage pricey?”" |
| b5 Answer | 255–345 | 8.50–11.50 | `ig4-05` (Ava) @258: "An hour of sports massage is eighty-five dollars." | `● AVA` [0–7] "An hour of sports massage / is $85." |
| b6 Curveball | 345–408 | 11.50–13.60 | ring f345 · `ig4-06` @351: "Now: do you do home visits?" | slot: "Now: “Do you do home visits?”" |
| b7 Stop-time | 408–435 | 13.60–14.50 | — (bed cut on the sample) | — |
| b8 Fallback | 435–516 | 14.50–17.20 | `ig4-07` (Ava) @438: "I won't guess. The team will call you back." | the owner's field, lighting word by word [0–8] |
| b9 Thesis | 516–594 | 17.20–19.80 | `ig4-08` @516: "Where your documents stop, it says so." | S2 [0–6] |
| b10 CTA | 594–720 | 19.80–24.00 | `ig4-09` @594: "Test it free. Comment AGENT, then try to trip it up." | S3 [0–2] "Test it free." · S4 [3–4] "Comment AGENT," · S5 [5–10] "then try to trip it up." |
| b11 Brand | 720–766 | 24.00–25.53 | `ig1-07` @724 | wordmark + URL |
| b12 Seam | 766–780 | 25.53–26.00 | — | price list + hook rising |

68 words over 26 s: 2.6 w/s. The CTA starts at 76 %.

### 4. Picture, camera and sound per beat

**b1 Hook (f0–90)**
- **Ground:** pearl `MeshGround variant='light'` on `KB_MESH`, with a warm key top-right.
- **The price list:** a `DocPage` (`useDocPage`) centred at x 140–900, y 360–980, `meshElevation` 3.
  - kind token `PDF`; heading **"Northside Studio · Price list"** (32 px; production fix)
  - lines as 44 px tabular objects: `Sports massage · 30 min · $50` / `Sports massage · 60 min · $85` / `Physio assessment · 45 min · $95` (the site's sample KB)
  - a 0.3 % breathing float
- **Ava's teal orb:** Ø 110 at (150, 290), in `listen`.
- **S1:** headline 92, **left-aligned at x 86**, y 1080–1300, max 820 (production fix). "trip up" takes the teal glint on its onset.
- **f60–90:** S1 exits up through its masks, and the page glides up to y 300–800 (scale .85, sub-pixel glide).
- **No "nudge"** (production fix).
- **Sound:** `fx-trill` at f0 with `fx-pickup` a 16th later; the bed from f0, a light call-and-response pluck riff with a soft kick and rim.

**b2–b4 Asked as (f90–255)**
- **The SingleSlot** (new) forms at y 1180–1420, x 86–906: a slate hairline frame with the chrome eyebrow **"ASKED AS"** (label 28, y 1150; the site's `MEANING.asked`).
- **Each phrasing** rises in slate (title 60, typographic quotes) on its ring.
- **On its last word,** a `MeaningLink` hairline draws up from the slot to the line `Sports massage · 60 min · $85`, tagged **"LANDS ON"** (`MEANING.landsOn`; the tag shows on the first landing only).
- **A ring** sends the old phrasing up and out. **The hairlines stay**, so by b4 three converge on one line.
- **The InkSweep** (sunday 12 %) under that line darkens one step per landing.
- **On "pricey" (≈ f230):** a slate underline draws under the word the page never says.
- **Sound:** each ring is one `fx-trill` chirp cut by `fx-pickup` a 16th later. The landings play `fx-pluck` E5 → G#5 → B5 (a chord building), each with a pen scratch.
- **Kit:** `DocPage`, `MeaningLink`, `InkSweep`, `labelWidth`. **New:** `SingleSlot`.

**b5 Answer (f255–345)**
- The slot swaps (`Swap`) to a `● AVA` row with her words. The display map shows "$85.".
- The three hairlines contract into the swept line, and the page's `$85` takes the teal glint on "eighty-five". The orb speaks at the in-call volume.
- **Sound:** `fx-mallet-e5` on "eighty-five" resolves the chord.

**b6 Curveball (f345–408)**
- **f345, ring:** the page shrinks into a column of five `DocRow`s (x 86–906, y 340–1000; 32 px chrome; `TabKnowledge` type labels): `Price list · PDF`, `Cancellation policy · Word`, `Aftercare · Markdown`, `Opening hours · Text`, `FAQ page · Web page`.
- **A ThresholdRule** (new, a variant built *around* `MeaningLink`, not an edit) draws across at y 1060, labelled "Close enough to answer" (28 px, `LIMITS.figure.threshold`).
- **The slot shows** "Now:" followed by the quoted question in slate.
- **On "visits" (≈ f392):** five hairlines rise from the slot toward the five rows on 32nds and **stop short of the threshold**, each ending in a small open circle.
- **Sound:** five muted, low-passed `fx-tock`s descending (E4 C#4 B3 A3 G#3).

**b7 Stop-time (f408–435)**
- The mesh desaturates a touch (`saturation` 1 → .85) and nothing moves.
- **Sound:** the **bed and the tails cut on the sample** (film 2's hard stop). Only room tone and line hiss remain, at a −60 dBFS air floor, never digital zero.

**b8 Fallback (f435–516)**
- The rows step back. A white kit **`FieldCard`** slides up (x 86–906, y 420–880):
  - the dashboard label **"When the answer isn’t in your documents"** (28 px)
  - as its text, the owner's line, title 56: "I won't guess. The team will call you back."
- **It lights from 40 % to full ink word by word as she says it.** This is in the spirit of WordReset, with no movement, so the field text *is* the caption.
- A `● AVA` tag sits above it. A sunday focus ring settles round the field on "back".
- **Sound:** one warm pad (sympathy); a `fx-glass` tick on the focus ring.

**b9 Thesis (f516–594)**
- The field steps back. S2 sits in the caption band, with "says so" in teal glint. The five rows behind brighten to 100 %: the knowledge base at rest.
- **Sound:** the bed returns with a lift on "says so".

**b10–b12 End (f594–780):** the shared `IgEnd`.
- The field rises at f600; AGENT types from `vWord(ig4-09,4)`.
- Snare roll from f690. Impact at f720; `ig1-07` at f724.
- **Seam:** the price-list page slides back to centre, and S1 is already rising into its frame-0 place (the verbal and visual loop). `MIX.fadeOut` [766, 780].

### 5. Safe zones and the cover
- **Zones:** the page at x 140–900; the slot and rows at x 86–906; the hook left-aligned at x 86 (≤ 820). Nothing below y 1420 except captions, which end at y 1480.
- **Cover** (custom PNG from `IG4-Cover-9x16`, pearl):
  - the kicker `AI RECEPTIONIST · 04` (y 270)
  - the price list with three hairlines converging on `$85` (y 330–900)
  - the title **"Can you trip it up?"** (two lines at 140 px, y 1000–1360)
  - all inside x 86–930
- **Fallback cover:** frame 0.

---

## 5. Shared build list (what the four need beyond the kit)

| Piece | Where | New or fork | Used by |
|---|---|---|---|
| Captions with the `display` map (numerals over word spans), explicit screens as word-index spans, frame-0 72 %-ink set mode | `src/ig/components/Captions.tsx` | fork of `src/kb/components/Captions.tsx` | all |
| `IgEnd`: CTA caption, CommentField typing AGENT, LightGL teal emitter, Wordmark, Url, seam hook | `src/ig/components/End.tsx` | new, from film 1 `cta/EndCard` parts + `kb/scenes/cta/LightGL` (imported) | all |
| Orb wrapper: rose line light → teal orb birth, `listen` / `speak`, parking glides | `src/ig/components/Orb.tsx` | fork of `kb/scenes/turn/Orb` on film 1 `components/Orb` | all |
| LiveTranscript + TurnLabel + CallerMeter + ToolRow | `src/ig/components/Call.tsx` | fork of `kb/scenes/call/Strip` (TurnLabel) + new rows | ig2, ig3 |
| OutcomePill (Booked / Answered / Message taken / Transferred, app colours) | `src/ig/components/OutcomePill.tsx` | new (labels and colours from `call-display.tsx`) | ig1, ig2, ig3 |
| IG-local icons: `message-circle`, `send`, `phone-forwarded`, `loader` | `src/ig/components/icons.tsx` | new (lucide path data, like the kit's) | all |
| IgFinish: `Grain` + `Dither` re-seeded per **timeline** frame (30 fps) | `src/ig/components/Finish.tsx` | new, composing film 1 `components/Grain` exports | all |
| WeekGrid | `src/ig/ig1/WeekGrid.tsx` | new | ig1 |
| SlotStrip, EventCard, PRO / BETA chips | `src/ig/ig2/*` | new | ig2 |
| TimerCard (tabular countdown, SVG arc, tug, corner chip, time-lapse to HANGUP) | `src/ig/ig3/TimerCard.tsx` | new | ig3 |
| SingleSlot, ThresholdRule + short-falling hairlines | `src/ig/ig4/*` | new (around kit `MeaningLink`) | ig4 |
| Clock lockup "9:47 pm" | film 1 `scenes/hook/Clock` (`ClockLockup`, `flickDisp`) | imported | ig2 |
| Cover stills `IG<n>-Cover-9x16` | `src/ig/<reel>/Cover.tsx` | new (image, no voice needed) | all |

Voice lines: `scripts/voice-lines-ig.json` has 33 lines, 29 placed plus 4 "link in bio" alternates, Tessa only. `ig1-07` is the sign-off of all four reels.
