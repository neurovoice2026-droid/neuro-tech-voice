#!/usr/bin/env node
/**
 * Proves the port is exact (docs/kb/PIPELINE.md §4, §11.B gate 10): src/lib/cuesheet.ts, fed film 1's own
 * HITS, SFX, VOICE, VOICES and WHITE_ACT, rebuilds film 1's exported CUES, SPEECH, PHRASES and
 * VOICES.map(voiceCut) exactly: deep strict equality (key sets, order, -0, undefined-valued keys) AND
 * byte-identical JSON (what the mix hashes read). Also checked:
 *   · voiceEnd, vFrames, vWord on every line and word; speaking() on every quarter frame (4 argument sets)
 *   · every voiceCut branch: 27 180 synthetic cuts against film 1's exported voiceCut / voiceEnd
 *   · firstSound and the grid snaps against film 1's PRIVATE originals, read from src/timing.ts's source
 *   · verbatim: each ported definition is film 1's code token for token, apart from 4 listed edits
 *     (this covers the paths film 1's data never takes; an INFO line lists the paths its hits do take)
 *   · film 1's language cascade rebuilt with the port's firstSound + voiceCut equals film 1's VOICES
 *   · `dir` routes a film's extras (e.g. kb/sfx/…) while film 1's families stay in sfx/
 *   · the proof has teeth: five mutations of the inputs must each break the equality
 *   · the port is film-agnostic and Node-safe (H10): only `.ts` relative imports, only film 1's house
 *     constants as values (FPS, BEAT, CUT, LIGHT_SEMI), types marked `type`, strip-only syntax, no React
 *     or Remotion; no film 1 source imports it
 *
 *   node scripts/kb/check-port.mjs        (from trailer/; re-runs itself with --experimental-strip-types)
 *
 * Exit 0 when everything is identical, 1 with a diff on any mismatch. Read-only: writes nothing.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

if (!process.features.typescript) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT_REL = 'src/lib/cuesheet.ts';
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const T1 = await imp('src/timing.ts');
const { VOICE } = await imp('src/voice.generated.ts');
const P = await imp(PORT_REL);

/* ── reporting ── */
const results = [];
const pass = (name, msg) => results.push({ ok: true, name, msg });
const fail = (name, msg) => results.push({ ok: false, name, msg });
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const fmt = (v) => (v === undefined ? 'undefined' : Object.is(v, -0) ? '-0' : typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v));
const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
/** every difference between port value `a` and film 1 value `b` (paths like CUES[12].vol), up to `max` */
function diff(a, b, p, out, max) {
  if (out.length >= max || Object.is(a, b)) return;
  const ta = kind(a);
  const tb = kind(b);
  const show = (t, v) => (t === 'undefined' || t === 'null' ? t : `${t} ${fmt(v)}`);
  if (ta !== tb) return void out.push(`${p}: port ${show(ta, a)} ≠ film 1 ${show(tb, b)}`);
  if (ta === 'array') {
    if (a.length !== b.length) out.push(`${p}.length: port ${a.length} ≠ film 1 ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length) && out.length < max; i++) diff(a[i], b[i], `${p}[${i}]`, out, max);
    return;
  }
  if (ta === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (out.length >= max) return;
      if (!Object.hasOwn(a, k)) out.push(`${p}.${k}: missing in the port (film 1 ${fmt(b[k])})`);
      else if (!Object.hasOwn(b, k)) out.push(`${p}.${k}: extra in the port (${fmt(a[k])})`);
      else diff(a[k], b[k], `${p}.${k}`, out, max);
    }
    return;
  }
  out.push(`${p}: port ${fmt(a)} ≠ film 1 ${fmt(b)}`);
}
/** deep strict equality + identical JSON bytes; on a mismatch, the first differences (with context) */
function same(name, port, film1, summary, context = () => '') {
  const jp = JSON.stringify(port);
  const j1 = JSON.stringify(film1);
  if (isDeepStrictEqual(port, film1) && jp === j1) return pass(name, `${summary}: deep-equal, JSON identical (sha256 ${sha(j1)})`);
  const all = [];
  diff(port, film1, name, all, 100000);
  const shown = all.slice(0, 20).map((d) => {
    const i = d.match(/^[^[]*\[(\d+)\]/)?.[1];
    return `      ${d}${context(i === undefined ? -1 : +i)}`;
  });
  const order = all.length === 0 && jp !== j1 ? '      (values equal, but the JSON differs: key order)\n' : '';
  fail(name, `${summary}: ${all.length || 'no'} difference(s)${all.length > 20 ? ', first 20' : ''}\n${order}${shown.join('\n')}`);
}

/* ── 1. the port, fed film 1's own data ── */
const roomAt = (f) => (f >= T1.WHITE_ACT[0] && f < T1.WHITE_ACT[1] ? 'white' : 'night');
const kit = P.makeVoiceKit(VOICE);
const S = P.makeSpeech(VOICE, T1.VOICES);
const CUES = P.buildCues(T1.HITS, { sfx: T1.SFX, speaking: S.speaking, roomAt });
const cueLabel = (i) => (T1.CUES[i] ? `   [film 1 cue ${i}: ${T1.CUES[i].label}]` : '');
const lineOf = (i) => (T1.VOICES[i] ? `   [${T1.VOICES[i].id} at ${T1.VOICES[i].at}]` : '');

same('CUES', CUES, T1.CUES, `${T1.CUES.length} cues from ${T1.HITS.length} hits`, cueLabel);
same('SPEECH', S.SPEECH, T1.SPEECH, `${T1.SPEECH.length} speech windows`, lineOf);
same('PHRASES', S.PHRASES, T1.PHRASES, `${T1.PHRASES.length} phrases`);
const cuts1 = T1.VOICES.map(T1.voiceCut);
same('voiceCut', T1.VOICES.map(kit.voiceCut), cuts1, `VOICES.map(voiceCut), ${cuts1.length} lines (${cuts1.filter(Boolean).length} cut)`, lineOf);
// (the same cue sheet with film 1's own speaking(): the builder alone, independent of makeSpeech)
same('CUES/film-1-speaking', P.buildCues(T1.HITS, { sfx: T1.SFX, speaking: T1.speaking, roomAt }), T1.CUES, 'buildCues with film 1\'s speaking()', cueLabel);

/* ── 2. the rest of the kit ── */
same('voiceEnd', T1.VOICES.map(kit.voiceEnd), T1.VOICES.map(T1.voiceEnd), `${T1.VOICES.length} lines`, lineOf);
{
  const ids = Object.keys(VOICE.lines);
  const words = ids.flatMap((id) => VOICE.lines[id].words.map((_, k) => [id, k]));
  same('vFrames', ids.map(kit.vFrames), ids.map(T1.vFrames), `${ids.length} lines`);
  same('vWord', words.map(([id, k]) => kit.vWord(id, k)), words.map(([id, k]) => T1.vWord(id, k)), `${words.length} words`);
}
{
  const frames = [];
  for (let f = -20; f <= T1.DURATION + 20; f += 0.25) frames.push(f);
  const argSets = [[], [0, 0], [6, 2], [10, 10]];
  const port = argSets.map((a) => frames.map((f) => S.speaking(f, ...a)));
  const film1 = argSets.map((a) => frames.map((f) => T1.speaking(f, ...a)));
  same('speaking', port, film1, `${frames.length} quarter frames × ${argSets.length} (before, after) sets, ${film1[0].filter(Boolean).length} speaking at the defaults`);
}

/* ── 3. every voiceCut branch, on synthetic cuts (film 1's voiceCut / voiceEnd take any line and `until`) ── */
{
  const { CUT } = T1;
  const branchOf = (id, u) => {
    const env = VOICE.lines[id].env;
    const e = (i) => env[Math.max(0, Math.min(env.length - 1, i))];
    const iu = Math.round(u);
    if (iu >= env.length - 1) return 'whole';
    if (e(iu) <= CUT.quiet) return 'silent';
    for (let i = iu + 1; i <= iu + CUT.max && i < env.length; i++) {
      if (e(i) <= CUT.quiet) return 'let-go';
      if (e(i) <= CUT.dip && e(i + 1) > e(i) + 0.03) return 'dip';
    }
    return 'fade';
  };
  const branches = { whole: 0, silent: 0, 'let-go': 0, dip: 0, fade: 0 };
  const port = [];
  const film1 = [];
  for (const id of Object.keys(VOICE.lines)) {
    for (const at of [1000, 1000.25, 1000.5, 1000.75]) {
      for (let u = -2; u <= VOICE.lines[id].frames + 2; u += 0.25) {
        const v = { at, id, until: at + u };
        port.push([kit.voiceCut(v), kit.voiceEnd(v)]);
        film1.push([T1.voiceCut(v), T1.voiceEnd(v)]);
        branches[branchOf(id, u)]++;
      }
    }
  }
  const counts = Object.entries(branches).map(([k, n]) => `${k} ${n}`).join(' · ');
  const missing = Object.entries(branches).filter(([, n]) => !n).map(([k]) => k);
  if (missing.length) fail('voiceCut sweep', `branches never reached (${missing.join(', ')}): ${counts}`);
  else same('voiceCut sweep', port, film1, `${port.length} synthetic cuts (every line × 4 sub-frame starts × an \`until\` on every quarter frame), [voiceCut, voiceEnd]; branches ${counts}`);
}

/* ── 4. film 1's private originals, read from src/timing.ts ── */
const SRC1 = readFileSync(path.join(ROOT, 'src', 'timing.ts'), 'utf8');
const SRCP = readFileSync(path.join(ROOT, PORT_REL), 'utf8');
/** the source lines from the line matching `start` to the first line after it matching `end` (or just that line) */
function block(src, file, start, end) {
  const lines = src.split('\n');
  const i = lines.findIndex((l) => start.test(l));
  if (i < 0) throw new Error(`check-port: no line matching ${start} in ${file}`);
  if (!end) return lines[i];
  const j = lines.findIndex((l, k) => k > i && end.test(l));
  if (j < 0) throw new Error(`check-port: no end ${end} after ${start} in ${file}`);
  return lines.slice(i, j + 1).join('\n');
}
const film1Private = new Function(
  'BEAT', 'FPS', 'CUT', 'VOICE',
  `${stripTypeScriptTypes(
    [
      block(SRC1, 'src/timing.ts', /^const upHalf = /),
      block(SRC1, 'src/timing.ts', /^const upBeat = /),
      block(SRC1, 'src/timing.ts', /^const upQuarter = /),
      block(SRC1, 'src/timing.ts', /^const firstSound = /, /^\};$/),
    ].join('\n'),
  )}\nreturn { upHalf, upBeat, upQuarter, firstSound };`,
)(T1.BEAT, T1.FPS, T1.CUT, VOICE);
{
  const xs = [];
  for (let f = -60; f <= 3000; f += 0.25) xs.push(f);
  for (let k = -8; k <= 800; k++) for (const e of [-2e-9, -1e-9, -1e-10, -1e-12, 0, 1e-12, 1e-10, 1e-9, 2e-9]) xs.push(k * (T1.BEAT / 4) + e);
  for (const n of ['upHalf', 'upBeat', 'upQuarter']) same(n, xs.map(P[n]), xs.map(film1Private[n]), `${xs.length} frame counts (quarter frames + every 16th ± 1e-12…2e-9)`);
  const ids = Object.keys(VOICE.lines);
  same('firstSound', ids.map(kit.firstSound), ids.map(film1Private.firstSound), `${ids.length} lines`);
}
{
  // film 1's CASCADE (src/timing.ts), with the port's firstSound + voiceCut in place of film 1's
  const at = (scene, local) => T1.SCENES[scene].from + local;
  const CASCADE = [];
  let lagged = 0;
  T1.SCALE.langVoices.forEach((id, i) => {
    const sw = at('scale', T1.SCALE.langAt[i]);
    const prev = CASCADE[i - 1];
    const cut = prev ? kit.voiceCut(prev) : null;
    const lag = cut && cut[0] >= sw ? Math.max(0, cut[0] + T1.CUT.clear - (sw + kit.firstSound(id))) : 0;
    if (lag) lagged++;
    CASCADE.push({ at: sw + Math.round(lag * 4) / 4, id, ...(i > 0 && i < 5 ? { until: at('scale', T1.SCALE.langAt[i + 1]) } : {}) });
  });
  const film1 = T1.VOICES.filter((v) => T1.SCALE.langVoices.includes(v.id));
  same('cascade', CASCADE, film1, `the ${CASCADE.length}-language cascade rebuilt (${lagged} entr${lagged === 1 ? 'y waits' : 'ies wait'} for a release)`);
}

/* ── 5. `dir`: a film's extras get their own folder; film 1's families stay in sfx/ ── */
{
  const sfx = {
    ...T1.SFX,
    'fx-test': { n: 2, pk: 3, group: 'tr', trim: 0, send: -18, dir: 'kb/sfx' },
    'fx-one': { n: 1, pk: 0, group: 'sig', trim: 0, send: -12, dir: 'kb/sfx' },
  };
  const h = (at, snd) => ({ at, snd, light: 'none', x: 0.5, w: 2, label: `${snd} @${at}` });
  const opts = { sfx, speaking: () => false, roomAt: () => 'night' };
  const files = P.buildCues([h(100, 'fx-test'), h(200, 'fx-test'), h(300, 'fx-one'), h(400, 'click'), h(500, 'riser')], opts).map((c) => c.file);
  same('dir', files, ['kb/sfx/fx-test-0.wav', 'kb/sfx/fx-test-1.wav', 'kb/sfx/fx-one.wav', 'sfx/click-0.wav', 'sfx/riser.wav'], 'cue files with two kb/sfx extras');
  let msg = '';
  try {
    P.buildCues([h(100, 'nope')], opts);
  } catch (e) {
    msg = e.message;
  }
  if (/"nope"/.test(msg)) pass('unknown sound', `a hit on a sound missing from sfx is refused by name: ${msg}`);
  else fail('unknown sound', `expected a named error for an unknown sound, got ${msg ? JSON.stringify(msg) : 'no error'}`);
}

/* ── 6. teeth: each mutation of the inputs must break the equality ── */
{
  const cuesWith = (o) => P.buildCues(o.hits ?? T1.HITS, { sfx: T1.SFX, speaking: S.speaking, roomAt, ...o });
  const uncut = T1.VOICES.map(({ until, ...v }) => v);
  const sfxTrim = { ...T1.SFX, click: { ...T1.SFX.click, trim: T1.SFX.click.trim + 0.5 } };
  const mutants = [
    ['roomAt always night', () => isDeepStrictEqual(cuesWith({ roomAt: () => 'night' }), T1.CUES)],
    ['nobody speaking', () => isDeepStrictEqual(cuesWith({ speaking: () => false }), T1.CUES)],
    ['click trim +0.5 dB', () => isDeepStrictEqual(cuesWith({ sfx: sfxTrim }), T1.CUES)],
    ['last hit dropped', () => isDeepStrictEqual(cuesWith({ hits: T1.HITS.slice(0, -1) }), T1.CUES)],
    ['cascade cuts removed', () => isDeepStrictEqual(uncut.map(kit.voiceCut), cuts1) || isDeepStrictEqual(P.makeSpeech(VOICE, uncut).SPEECH, T1.SPEECH)],
  ];
  const blind = mutants.filter(([, equal]) => equal()).map(([n]) => n);
  if (blind.length) fail('teeth', `these mutations still compare equal (the check would miss them): ${blind.join(', ')}`);
  else pass('teeth', `all ${mutants.length} mutations detected (${mutants.map(([n]) => n).join(' · ')})`);
}

/* ── 7. verbatim: the port's code IS film 1's code, token for token, apart from the listed edits ──
 * (this covers the branches film 1's data never takes). Both sides: comments and `export` dropped,
 * whitespace normalised. Film 1's names become the port's generic ones (VoiceId → Id, Snd → S,
 * Hit → Hit<S>, the inline voice type → Voiced<Id>); every other change must be one of EDITS, and
 * each edit must match film 1's text exactly once. */
{
  const norm = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ').replace(/\s+/g, ' ').replace(/ ?([^\w$ ]) ?/g, '$1').replace(/(^|[;{}])export /g, '$1').trim();
  const PORT_FILEOF = "const fileOf = (s: S, k: number) => `${SFX[s].dir ?? 'sfx'}/${SFX[s].n > 1 ? `${s}-${k}.wav` : `${s}.wav`}`;";
  const GUARD_HITS = 'for (const h of hits) if (!SFX[h.snd]) throw new Error(`buildCues: "${h.label}" (at ${h.at}) plays "${h.snd}", which is not in sfx`);';
  const GUARD_DEF = 'if (!def) throw new Error(`buildCues: "${h.label}" (at ${h.at}) needs "${snd}", which is not in sfx`);';
  const VOICE_NAMES = [[/\bVoiceId\b/g, 'Id'], [/\{at:number;id:Id;until\?:number\}/g, 'Voiced<Id>']];
  const CUE_NAMES = [[/\bSnd\b/g, 'S'], [/\bHit\b(?!<)/g, 'Hit<S>']];
  // [name, film 1 [start, end?], port [start, end?], renames, EDITS (film 1 text → port text)]
  const PAIRS = [
    ['upHalf', [/^const upHalf = /], [/^export const upHalf = /]],
    ['upBeat', [/^const upBeat = /], [/^export const upBeat = /]],
    ['upQuarter', [/^const upQuarter = /], [/^export const upQuarter = /]],
    ['vFrames', [/^export const vFrames = /], [/^ {2}const vFrames = /], VOICE_NAMES],
    ['vWord', [/^export const vWord = /], [/^ {2}const vWord = /], VOICE_NAMES],
    ['voiceCut', [/^export function voiceCut\(/, /^\}$/], [/^ {2}function voiceCut\(/, /^ {2}\}$/], VOICE_NAMES],
    ['firstSound', [/^const firstSound = /, /^\};$/], [/^ {2}const firstSound = /, /^ {2}\};$/], VOICE_NAMES],
    ['voiceEnd', [/^export const voiceEnd =/], [/^ {2}const voiceEnd = /], VOICE_NAMES],
    ['SPEECH', [/^export const SPEECH = /], [/^ {2}const SPEECH = /]],
    ['PHRASES', [/^export const PHRASES = /, /^\}\);$/], [/^ {2}const PHRASES = /, /^ {2}\}\);$/]],
    ['speaking', [/^export const speaking = /], [/^ {2}const speaking = /]],
    ['W_DB', [/^const W_DB/], [/^const W_DB/]],
    ['SPEECH_DB', [/^const SPEECH_DB/], [/^const SPEECH_DB/]],
    ['DETUNE_CENTS', [/^const DETUNE_CENTS/], [/^const DETUNE_CENTS/]],
    ['panOf', [/^const panOf/], [/^const panOf/]],
    ['fileOf', [/^const fileOf = /], [/^ {2}const fileOf = /], CUE_NAMES, [
      ['const fileOf = (s: S, k: number) => sfx(SFX[s].n > 1 ? `${s}-${k}.wav` : `${s}.wav`);', PORT_FILEOF], // the folder comes from the family
    ]],
    ['buildCues', [/^function buildCues\(/, /^\}$/], [/^export function buildCues</, /^\}$/], CUE_NAMES, [
      // the film's data become parameters; fileOf moves inside (compared above); a named error for a missing sound
      ['function buildCues(hits: Hit<S>[]): Cue[] {', `function buildCues<S extends string>(hits: readonly Hit<S>[], { sfx: SFX, speaking, roomAt }: CueOptions<S>): Cue[] { ${PORT_FILEOF} ${GUARD_HITS}`],
      ['const def: SfxDef = SFX[snd];', `const def: SfxDef = SFX[snd]; ${GUARD_DEF}`], // a named error for a missing soft variant
      ["const room = hit >= WHITE_ACT[0] && hit < WHITE_ACT[1] ? 'white' : 'night';", 'const room = roomAt(hit);'], // roomAt replaces WHITE_ACT
    ]],
  ];
  const bad = [];
  let edits = 0;
  let chars = 0;
  for (const [name, [s1, e1], [sp, ep], renames = [], EDITS = []] of PAIRS) {
    let a = norm(block(SRC1, 'src/timing.ts', s1, e1));
    for (const [re, to] of renames) a = a.replace(re, to);
    for (const [from, to] of EDITS) {
      const f = norm(from);
      const n = a.split(f).length - 1;
      if (n !== 1) {
        bad.push(`${name}: the edit "${from.slice(0, 70)}…" matches film 1's text ${n}× (expected once)`);
        continue;
      }
      a = a.replace(f, () => norm(to));
      edits++;
    }
    const b = norm(block(SRCP, PORT_REL, sp, ep));
    chars += b.length;
    if (a !== b) {
      let i = 0;
      while (i < a.length && a[i] === b[i]) i++;
      bad.push(`${name}: differs from film 1 at token offset ${i}\n        film 1 (edited): …${a.slice(Math.max(0, i - 50), i + 70)}…\n        port:            …${b.slice(Math.max(0, i - 50), i + 70)}…`);
    }
  }
  if (bad.length) fail('verbatim', bad.join('\n      '));
  else pass('verbatim', `${PAIRS.length} definitions (${chars} normalised chars) are film 1's code token for token, apart from the ${edits} listed edits (fileOf reads def.dir; buildCues takes { sfx, speaking, roomAt } and roomAt(hit) replaces WHITE_ACT; 2 named errors for a sound missing from sfx)`);

  // INFO: which of buildCues' paths film 1's own hits take (the paths they skip are covered by the text check)
  const H1 = T1.HITS;
  const n = (f) => H1.filter(f).length;
  const sorted = [...H1].sort((x, y) => x.at - y.at);
  const kept = [];
  let dropped = 0;
  let replaced = 0;
  for (const h of sorted) {
    const g = T1.SFX[h.snd].group;
    if (g === 'sig' || h.layer) { kept.push(h); continue; }
    const rival = kept.find((k) => !k.layer && T1.SFX[k.snd].group === g && Math.abs(k.at - h.at) <= 2);
    if (!rival) { kept.push(h); continue; }
    const score = (x) => -x.w * 10 + (T1.SFX[x.snd].rank ?? 0);
    if (score(h) > score(rival)) { kept.splice(kept.indexOf(rival), 1, h); replaced++; } else dropped++;
  }
  const paths = {
    'merge: later hit dropped': dropped, 'merge: rival replaced': replaced, 'sig never merged': n((h) => T1.SFX[h.snd].group === 'sig'), layer: n((h) => h.layer),
    'run.step': n((h) => h.run?.step), 'run.offs': n((h) => h.run?.offs), 'run.xs': n((h) => h.run?.xs), 'run.semi': n((h) => h.run?.semi), 'run.semis': n((h) => h.run?.semis),
    'run n>3 jitter': n((h) => h.run && h.run.n > 3 && !h.run.xs), split: n((h) => h.split), 'pan move': n((h) => Array.isArray(h.x)), tuned: n((h) => T1.SFX[h.snd].tune),
    'hit semi': n((h) => h.semi), 'hit db': n((h) => h.db !== undefined), 'soft chime swap': n((h) => /^chime-(rush|closing|sunday|night)$/.test(h.snd) && T1.speaking(h.at)),
    'white room': T1.CUES.filter((c) => c.room === 'white').length, 'under speech': T1.CUES.filter((c) => c.speech).length,
  };
  const skipped = Object.entries(paths).filter(([, v]) => !v).map(([k]) => k);
  results.push({ info: true, name: 'coverage', msg: `film 1's hits take ${Object.entries(paths).map(([k, v]) => `${k} ${v}`).join(' · ')}${skipped.length ? `; NOT taken: ${skipped.join(', ')}` : '; every path taken'}` });
}

/* ── 8. film-agnostic and Node-safe (H10); film 1 does not import it ── */
{
  const src = SRCP;
  const bad = [];
  const ALLOWED_VALUES = new Set(['FPS', 'BEAT', 'CUT', 'LIGHT_SEMI']);
  const specs = [];
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm)) specs.push({ typeOnly: !!m[1], names: m[2], spec: m[3] });
  for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) specs.push({ typeOnly: false, names: '', spec: m[1] });
  if (/\bimport\s*\(/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))) bad.push('a dynamic import()');
  for (const { typeOnly, names, spec } of specs) {
    if (/(^|\/)(react|remotion)(\/|$)|^@remotion\//.test(spec)) bad.push(`imports ${spec}`);
    if (!spec.startsWith('.') || !spec.endsWith('.ts')) bad.push(`"${spec}" is not a relative .ts specifier`);
    if (spec !== '../timing.ts') bad.push(`imports "${spec}" (only film 1's house constants from ../timing.ts are allowed)`);
    if (typeOnly) continue;
    for (const raw of names.replace(/[{}]/g, '').split(',').map((s) => s.trim()).filter(Boolean)) {
      if (raw.startsWith('type ')) continue;
      const name = raw.split(/\s+as\s+/)[0];
      if (!ALLOWED_VALUES.has(name)) bad.push(`value import "${name}" from ${spec} (film 1 data, or a type not marked \`type\`)`);
    }
  }
  try {
    stripTypeScriptTypes(src, { mode: 'strip' });
  } catch (e) {
    bad.push(`not strip-only syntax: ${e.message.split('\n')[0]}`);
  }
  const importers = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rel = path.relative(ROOT, p).split(path.sep).join('/');
      if (e.isDirectory()) {
        if (rel !== 'src/kb') walk(p);
      } else if (/\.(ts|tsx|mjs|js)$/.test(e.name) && rel !== PORT_REL && /cuesheet/.test(readFileSync(p, 'utf8'))) importers.push(rel);
    }
  };
  walk(path.join(ROOT, 'src'));
  if (importers.length) bad.push(`film 1 sources mention cuesheet: ${importers.join(', ')}`);
  const values = specs.filter((s) => !s.typeOnly).flatMap((s) => s.names.replace(/[{}]/g, '').split(',').map((x) => x.trim()).filter((x) => x && !x.startsWith('type ')));
  if (bad.length) fail('H10', bad.join('\n      '));
  else pass('H10', `imports only ${values.join(', ')} (+ types) from ../timing.ts; strip-only syntax; no React/Remotion; no film 1 source imports it`);
}

/* ── verdict ── */
const w = Math.max(...results.map((r) => r.name.length));
console.log(`check-port: ${PORT_REL} vs film 1 (src/timing.ts)`);
for (const r of results) console.log(`  ${r.info ? 'INFO' : r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(w)}  ${r.msg}`);
const checks = results.filter((r) => !r.info);
const failed = checks.filter((r) => !r.ok).length;
console.log(failed ? `check-port: ${failed} of ${checks.length} FAILED` : `check-port: all ${checks.length} checks PASS — the port rebuilds film 1's cue sheet exactly`);
process.exit(failed ? 1 : 0);
