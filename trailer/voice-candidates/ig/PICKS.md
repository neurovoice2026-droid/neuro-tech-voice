# Instagram reels (ig1–ig4): voice picks

Chosen 2026-10-06 (label `voices`) from five Cartesia sets of the 33 lines (`take-1` … `take-5`, see `STATUS.md`). Nobody here
can listen, so every choice is a measurement, by film 2's method (`voice-candidates/kb/PICKS.md`): an analysis script scored
every line of every take, and the four real `src/ig/ig<n>/timing.ts` were run on candidate combinations to see what each
take does to the reel. Tessa (Emotive) speaks every line.

## The outcome

| reel | plan | with the picks | hook: her last word lands / take ends | CTA starts |
|---|---|---|---|---|
| ig1 Not even ours | 26.0 s · impact f720 | **28.0 s** · impact f780 (+1 bar) | "ours." 3.70 s / 4.27 s | 21.8 s (78 %) |
| ig2 Booked after hours | 22.0 s · impact f600 | **28.0 s** · impact f780 (+3 bars) | "call." 3.87 s / 4.30 s | 23.6 s (84 %) |
| ig3 Twelve minutes | 24.0 s · impact f660 | **26.0 s** · impact f720 (+1 bar) | "phone." 3.03 s / 3.50 s | 20.4 s (78 %) |
| ig4 Can you trip it up? | 26.0 s · impact f780 | **28.0 s** · impact f780 (+1 bar) | "receptionist?" 1.57 s / 2.50 s | 22.1 s (79 %) |

All four are inside the client's 20–30 s and the script's ≤ 28 s. No combination of takes reaches the plan's lengths: at
speed 1.05 Tessa reads these lines at 1.9–3.3 words/s, not the 2.5–3.2 the script budgeted, and every call line of ig2 runs
≈ 1 s over its slot (the shortest take of each still gives 28 s; 26 s would need the caller turns cut to ≈ 0.5 s).

**Take-4 and take-5 have no `<break/>` tags** (STATUS.md): Sonic pauses ≈ 0.5 s at every sentence end anyway, and the tags
doubled it. With takes 1–3 alone the reels run 30 / 28 / 28 / 30 s. Fifteen installed lines come from these two sets;
the eleven of them whose `speak` had breaks now carry the break-free `speak` in `scripts/voice-lines-ig.json`
(its `say`, i.e. every caption word, is unchanged), so the file reproduces every installed read. To return to the
written `speak`, install takes 1–3 only: the reels then run 30 / 28 / 28 / 30 s.

## The picks

Columns: duration (the five takes' durations in brackets); `↑` is a question's rise from its dip, `land` the last 60 ms of a
phrase against its median (st; negative = falls), `key` the key phrase's loudness / pitch against the rest of the line.

| line | take | why |
|---|---|---|
| ig1-01 | **take-5** | 3.98 s [4.20/4.15/4.14/3.69/3.98]. With the other picks only the two break-free takes keep ig1 at 28 s (takes 1–3 move the impact a bar); a 0.31 s beat before "Not even ours.". Its "ours." falls cleanly into creak (land −5.5 st) with no voiced lift; take-4 (0.3 s shorter) and takes 1–3 end with one. Stronger "fire" than take-4 (key 2.0× stretch). |
| ig1-02 | **take-5** | 5.31 s [6.63/6.69/6.80/5.95/5.31]. The only take that keeps ig1 at 28 s: takes 1–3 (6.6–6.8 s, a 0.6–0.8 s sentence gap) and take-4 put the impact a bar later (30 s). "forty-five hours." falls as a small fact (land −2.2), a 0.23 s beat, then "The week" rises before the low, final "a hundred and sixty-eight." `to+six,` share an onset (the "18" tick lands with "to"). |
| ig1-03 | **take-3** | 3.30 s (shortest, with take-1). A real question: "twenty-three?" rises +5.6 st. Unlike takes 1 and 5, the payoff "agent's" sits high (the key's pitch at the line median, not 8 st under it). |
| ig1-04 | **take-1** | 4.47 s. "listed." falls (land −1.1); takes 3 and 4 end rising (+4.2/+1.9), which reads as uptalk on "the honest condition". Fewer clicks than take-5. Every take keeps ig1 at 28 s. |
| ig1-05 | **take-5** | 3.11 s. "only people can do." settles low and falls (land −2.4); take-1's "do." rises (+5.6) and starts 0.19 s late; take-4 pushes the reel a bar. |
| ig1-06 | **take-4** | 3.63 s [4.14/4.10/4.16/3.63/3.73]. The strongest "Comment AGENT" of all (key +3.3 dB, +4.4 st) and the shortest; takes 1–3 put the impact a bar later. |
| ig1-06-bio | **take-4** | 3.20 s: shorter than the CTA it replaces (a swap keeps 28 s), the same set as the CTA, "bio." falls. |
| ig1-07 | **take-4** | 1.35 s (≤ 1.45 s; only takes 1, 4 and 5 qualify). "Voice." falls into creak with no voiced lift (take-5 lifts at the end, as do takes 2 and 3), and it ends 1 f before the 14-f seam (take-1 runs 2 f into it). The series' sign-off in all four reels. |
| ig2-01 | **take-2** | 3.94 s. The only "book" with real stress (key +3.7 dB, +2.7 st) and no shared onset on "book" (takes 1 and 5 time `it+book` together, so the glint would come early). "Nine forty-seven." low, then a 0.59 s pause, as directed. Every take gives the same pickup (f135). |
| ig2-02 | **take-1** | 3.57 s. The brightest greeting (F0 range 12.3 st) with the clearest commas (0.20/0.15 s) and the least sunken "an AI assistant" (key −0.6 dB). Take-4 merges `is+Ava,`; take-5's "Studio," gap is 0.07 s; takes 2 and 3 would push ig2 a bar (30 s). |
| ig2-03 | **take-3** | 3.79 s. "Saturday morning?" rises +5.8 st, then the two times as a closed choice: "eleven-thirty." falls (land −6.9). Takes 1, 2, 4 and 5 end "eleven-thirty" rising (+2.0 to +4.2), which sounds unsure. |
| ig2-04 | **take-2** | 2.04 s. The clearest question rise on "name?" (+3.5 st), almost no fry (0.01). Take-1 is 2.56 s with no rise; take-5 has none either. |
| ig2-05 | **take-2** | 3.15 s. A natural "Thanks, Maya." (level, not rising like take-5's +4.3) and a strong "You're booked" (key +2.2 dB, +4.7 st); "ten." falls. |
| ig2-06 | **take-1** | 1.88 s (shortest). "Pro." falls cleanly (land −3.9) with little fry; takes 3–5 end creaky or rising. |
| ig2-07 | **take-1** | 1.68 s. The only "AGENT" with stress (key +1.9 dB); "link." falls. |
| ig2-07-bio | **take-1** | 1.18 s, clean, no shared onsets. |
| ig3-01 | **take-1** | 3.17 s (the hook ends at f105, 3.50 s, where the plan's b2 starts). The only take that stresses "can't" (18 st, against 14–16 elsewhere) and the one with a real 0.54 s beat between its sentences. |
| ig3-02 | **take-4** | 4.09 s [4.70/4.64/4.53/4.09/4.36]. The only take that keeps the pickup on its bar (f240) once the dilemma waits for the third ring (f115): "elsewhere." ends 2 f before the pickup click, so the agent answers the moment she gives up. Every other take moves the pickup, and the reel, a bar. |
| ig3-03 | **take-2** | 3.35 s. Warm and bright (9.4 st range), a friendly lift on "calling." (+0.7), commas 0.31/0.14 s. All takes keep ig3 at 26 s. |
| ig3-04 | **take-1** | 3.59 s. The check-back "A walk-in trim?" rises cleanly to +5.4 st and "You can," is the emphatic, bright yes the direction asks for. The break-free takes 4/5 (shorter) barely rise (+2.6/+2.9), then rise again on "can,", which makes the one-sided call harder to follow. Costs nothing: 26 s holds with take-5 of ig3-05 below. `to+Saturday.` share an onset. |
| ig3-05 | **take-5** | 3.10 s [3.95/3.76/3.77/3.42/3.10]. The three small beats ("done." and "sorted." lift like a list, "You never looked up." falls); fry 0.05. With ig3-04 at take-1, any other take pushes ig3 a bar (28 s). `You+never` share an onset (S6 starts on "You"). |
| ig3-06 | **take-4** | 2.90 s. The clearest "AGENT" (the line's highest pitch, key +2.6 st) and the shortest; takes 1–3 push ig3 a bar. |
| ig3-06-bio | **take-4** | 2.84 s: as long as its CTA, same set, both phrases fall. |
| ig4-01 | **take-3** | 2.27 s. A real question rise (+12.3 st onto "receptionist?") and "trip up" held level and present (key +0.1 dB, the slowest stretch, 1.17). Take-1 hardly rises. Every take leaves the first ring on f90. |
| ig4-02 | **take-3** | 1.22 s (≈ 1.2 s as scripted). A light rise on "hour?" (+4.5 st); take-4 has none. `an+hour?` share an onset. |
| ig4-03 | **take-3** | 2.08 s. The only "back?" that lifts (+4.2 st): the playful second phrasing. Every take rings the third ring on f210. |
| ig4-04 | **take-5** | 1.77 s. The sly stress on "pricey" (+8.8 st peak, the strongest key) and no fry. Takes 1 and 3 delay the answer a 16th and so the curveball's ring a beat (30 s). |
| ig4-05 | **take-4** | 3.19 s [3.44/3.46/3.47/3.19/3.28]. The only take that keeps ig4 at 28 s (any other rings the curveball a beat later: 30 s). Same contour as every take ("An hour… massage" bright, "eighty-five dollars" level and sure). `of+sports` share an onset. |
| ig4-06 | **take-5** | 2.25 s. A real 0.39 s turn after "Now:" and the best rise on "visits?" (+2.4 st); take-4 runs "Now" into the question (0.16 s). |
| ig4-07 | **take-1** | 2.70 s. Calm, with a real 0.53 s beat after "I won't guess." (the break-free takes 4/5 leave 0.21/0.24 s), and "call you back." settles (land −1.6). Fits 28 s with ig4-08 take-3 and ig4-09 take-4 (1 f to spare). `will+call` share an onset. |
| ig4-08 | **take-3** | 2.49 s. "says so" the most present of the takes that fit (key +2.0 st, stretch 1.43), a clean comma (0.21 s). |
| ig4-09 | **take-4** | 3.31 s. The strongest CTA of the series (key +4.4 dB, +4.6 st on "Comment AGENT") and the shortest; "try to trip it up" ends down (land −0.6). `it+free.`, `to+trip` share onsets. |
| ig4-09-bio | **take-4** | 3.36 s, same set as its CTA; a swap still keeps 28 s (0 f spare). |

Eight lines come from take-1, four from take-2, six from take-3, nine from take-4 and six from take-5.

**Installed** with `node scripts/generate-voice.mjs --film=ig1 --install=voice-candidates/ig/take-<k> --only=…`, one call per set,
onto an emptied `src/ig/voice.generated.ts` (so its `engine` reads `cartesia`, not `mixed` with the Kokoro placeholders it
replaced). Every `public/ig/voice/<id>.wav` is byte-identical to its pick and every entry equals the pick's (only `file`
differs); checked by sha256 and JSON for all 33.

## The timelines (re-anchored to the real reads; no picture code touched)

`src/ig/ig<n>/timing.ts` derive every line from the measured takes by the script's anchoring rule (acts, IMPACT and END on
their bars; a long take borrows from the gaps; only the CTA pushes the end card, by whole bars). Changed anchors:

- **all four, the frame-0 ring** (`common/series.ts` `afterRing`, `RING_OUT` 10 f): the first line starts once the
  frame-0 ring has rung out before her first word (ig1 f8, ig2 f10, ig3 f9; ig4 f6, its chirp being 4 f).
- **ig1:** the grid's act `HOURS` opens after the hook (a beat past "ours.", f131, not the plan's f105, when she is
  still speaking) and "Nine…" keeps the plan's 3-f lead; `CASCADE` (the teal cascade on "other") is exported and the
  check-mix arc window follows it.
- **ig2:** the second ring sits on the last beat that rings out before "You're closed." (f45, `RINGS`; the plan's f60
  fell on "You're"); the bed enters a beat after the pickup (`MUSIC.bedFrom`, the plan's +1 beat); the CTA keeps the
  plan's beat after the gate line, so the comment field rises after "…with Pro." (f697), not over it; the arc window is
  the booked act.
- **ig3:** the rings of the phone across the room sit in her pauses (`RINGS` 0 / 45 / 105 / 180; the plan's bar lines
  60 / 120 / 180 fell on "You", "up," and "Leave"), and the dilemma waits for the third to ring out (f115); the arc
  window follows the hang-up.
- **ig4:** each ring waits for her *voice* to stop (the take's last loud frame, not the file's silent tail), which keeps
  the second ring on its beat (f135); the rings are one chirp (`fx-trill-1`, film 2's one-chirp trill, now in the series'
  families) as the script describes; the arc window spans the three phrasings.

## Checks

- `npm run sfx:ig` builds all four (−14.0 LUFS, −1.65 dBTP).
- `check-mix --film=ig1…ig4`, the **dialogue gates pass in all four**: every file −23.0 LUFS (± 0.00); every line in the
  stem −20.0 to −20.4 LUFS (target −20 ± 0.5); every word's intelligibility ≥ 0.7 (lowest: ig1 "keeps" 0.84, ig2
  "assistant." 0.87, ig3 "You" 0.73, ig4 "this"/"What" 0.88); the name 0.97 / 1.00 / 0.98 (≥ 0.9). The remaining FAILs
  (climax lead +0.4 to +0.8 LU of the +1 needed, the end tail, the arc) belong to the sound pass (stub bed, impact sample).
- End-to-end sync: every phrase's first word on the timeline against her actual onset in the built dialogue stem:
  within 2.7 frames in all four reels (ig1 2.3, ig2 2.3, ig3 2.7, ig4 1.7), the word timing early where it differs.
- `check-zones --all`: PASS; its stills show each screen's words lighting on their onsets.
- `npx tsc --noEmit -p .` clean.

## Flags

- **Three of the four hooks still run past the script's 3.1 s** (ig1 4.27 s, ig2 4.30 s, ig3 3.50 s; ig4 2.50 s). The turn
  lands at 3.2 s (ig1 "Not even ours."), 2.1 s (ig2 "You're closed.") and 2.3 s (ig3 "You can't…").
- **ig2 is 28 s, three bars over its plan**: its four call lines are ≈ 1 s over their slots in every take. 26 s needs the
  caller turns cut to ≈ 0.5 s, which the call would not survive.
- **ig1 and ig4 have 3 f and 1 f to spare** before their impact moves a bar: swapping ig1-02, ig1-06, ig4-05, ig4-07 or
  ig4-09 for another take, or lengthening a gap, makes those reels 30 s.
- **Shared word onsets** (Cartesia gives some short words zero length; the pair lights together): `to+six,` (ig1-02, the
  "18" tick), `you+back.`/`will+call` (ig4-07's field), `to+Saturday.` (ig3-04's sweep). At most ≈ 0.1 s early.
- **Fry**: Tessa ends most phrases in creak (fry 0.03–0.34 of voiced frames), as in film 2.
- `CARTESIA_IG_AVA_VOICE` was unset, so the pinned id in `voice-lines-ig.json` was used (the right voice).

## Method (`trailer/out/ig/voices/`, deleted after the run; `out/` is ignored)

The measuring tape is film 2's `out/kb/voices/analyse.mjs` with the IG line sheet: rate, pauses at punctuation (audio
silence and aligned gap), YIN F0 (range, movement, fry), question rises and statement landings, key-phrase emphasis,
clicks / drops / roughness, peak and knee; plus word-timing sanity per take (count, monotonic, shared onsets, onsets in
silence, phrase-initial drift against the audio) and each reel's `timing.ts` run on every set and on every one-line swap of
the picks. A combination search over the over-long lines found the takes that keep each reel on its bar.
