#!/usr/bin/env node
/**
 * Neuro Tech Voice trailer — the voices.
 *
 * Produces every spoken line of ONE FILM (--film=<id>, required; paths from
 * scripts/films.mjs — film 1 "main": scripts/voice-lines.json → public/voice +
 * src/voice.generated.ts; film 2 "kb": scripts/voice-lines-kb.json →
 * public/kb/voice + src/kb/voice.generated.ts, sources in voice-src/kb) with one
 * of four engines:
 *
 *   · FILES (preferred for the final cut) — your own recordings or lines
 *     generated on fish.audio / ElevenLabs, dropped into trailer/voice-src/
 *     as <id>.wav|mp3|m4a|ogg|flac (see voice-src/README.md). Used
 *     automatically when every line has a file there.
 *   · CARTESIA SONIC (ultra-realistic, used when CARTESIA_API_KEY is set —
 *     the same key and API the product's voice gateway uses) — the product's
 *     own default English agent voices: Ava = Skylar, caller = Daniel
 *     (lib/voice/voice-map.ts), model sonic-3.6, a per-line emotion
 *     (neutral | calm | content | sad | angry). Override with
 *     CARTESIA_AVA_VOICE / CARTESIA_CALLER_VOICE / CARTESIA_CALLER2_VOICE,
 *     CARTESIA_TTS_MODEL. Needs network access to api.cartesia.ai.
 *   · FISH AUDIO (ultra-realistic, used when FISH_API_KEY is set) — the
 *     fish.audio TTS API (model s2-pro by default, FISH_MODEL to change),
 *     one voice model per role: FISH_AVA_VOICE, FISH_CALLER_VOICE,
 *     FISH_CALLER2_VOICE (fish.audio model IDs), or the `fish.id` in
 *     voice-lines.json; with no ID the script picks the most-used English
 *     voice of the right gender from the fish.audio library and prints it
 *     (pin it in voice-lines.json once you like it). Needs network access to
 *     api.fish.audio. Check the voice's licence for commercial use.
 *   · KOKORO-82M (offline fallback, Apache-2.0 open weights) via sherpa-onnx:
 *     Ava = af_bella, callers = am_michael / bf_emma.
 *
 * Callers are always put through a phone-line EQ; Ava stays full-band. A role
 * may carry its own corrective EQ (voices.<role>.eq in voice-lines.json — e.g.
 * caller2's presence lift). Then EVERY line is loudness-normalised to ONE
 * dialogue target (level.lufs, BS.1770 integrated over its phrases, mono; it
 * reads +3 LU dual-mono in the stereo dialogue bus), not to a peak: peak
 * normalising left a 5 LU spread between lines.
 *
 * Writes:
 *   public/voice/<id>.wav        (trimmed, EQ'd, at level.lufs integrated, peak ≤ level.peakMax)
 *   src/voice.generated.ts       durations, phrase + word timings (seconds) and
 *                                a per-frame loudness envelope (0..1) that
 *                                drives the orb and the waveform in sync
 *
 * The model is not committed. It is fetched once from the npm registry (the
 * Apache-2.0 package n8n-nodes-ttsbro ships the sherpa-onnx Kokoro int8 English
 * model) into .cache/, or pass KOKORO_DIR=/path/to/kokoro-int8-en-v0_19.
 * The generated WAVs + TS ARE committed, so rendering never needs the model.
 *
 *   node scripts/generate-voice.mjs --film=<id> [options]   (npm run voice = --film=main, voice:kb = --film=kb)
 *
 *   (no option)            files if the film's voice-src is complete, else Cartesia / Fish if
 *                          their key is set, else Kokoro
 *   --engine=cartesia      force Cartesia (files | fish | kokoro likewise; a missing file is an error)
 *   --list                 list fish.audio voice candidates
 *   --only=a,b             just these lines, merged into the live set (the others are left
 *                          byte-identical)
 *   --remaster             no new takes: re-level the film's current live lines to level.lufs and
 *                          apply any role EQ they don't carry yet; timings are kept
 *   --out=DIR              a complete candidate set (DIR/voice/*.wav + DIR/voice.generated.ts +
 *                          DIR/preview.wav) instead of the live one
 *   --install=DIR [--only=a,b]
 *                          no new takes: copy chosen takes from a candidate set (DIR/voice/<id>.wav
 *                          + their entries, `file` rewritten to the film's prefix) into the film's
 *                          live set. Existing entries keep their exact JSON and order (installed ids
 *                          replace theirs in place, new ids are appended); the top-level `voices` takes
 *                          the candidate's record for the installed lines' roles, `engine` becomes
 *                          "mixed" when the engines differ. One call per source take.
 *   --preview              also write the film's preview.wav (out/preview.wav, out/kb/preview.wav)
 *   --<role>=<voice id>    pin a role's Cartesia voice for this run (--ava=…, --caller2=…)
 *
 * FROZEN films (main: delivered) refuse every write to their live set — the default run, --only,
 * --remaster — unless --unfreeze is passed; --install never writes into a frozen film. --out
 * candidate sets are always allowed.
 *
 * BORROWED lines ({"id": "cta-1", "borrow": "main"} in the film's voice-lines JSON) are never
 * synthesised: the other film's WAV is byte-copied (same id) and its entry copied with `file`
 * rewritten. The engines skip them and --remaster leaves them as copied.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { integrated } from './audio/loudness.mjs';
import { FILMS, abs, filmOf, voiceFile } from './films.mjs';

const require = createRequire(import.meta.url);
const peakOf = (arr) => {
  let m = 0;
  for (const x of arr) m = Math.max(m, Math.abs(x));
  return m;
};
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
/* ── the film (scripts/films.mjs): every path below is that film's ── */
let FILM;
try {
  FILM = filmOf(process.argv.slice(2), { required: true });
} catch (e) {
  console.error(`[voice] ${e.message.replace(/^\[films\] /, '')} — e.g. node scripts/generate-voice.mjs --film=kb`);
  process.exit(2);
}
const OUT = abs(FILM, 'voiceDir');
const TS_OUT = abs(FILM, 'voiceTs');
const LINES_JSON = abs(FILM, 'voiceLines');
const FPS = 30;
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const TS_HEAD = `/* GENERATED by scripts/generate-voice.mjs — do not edit. Re-run \`${FILM.cmd.voice}\`. */\n`;
/** The VOICE object of a generated voice.generated.ts (live set or candidate set). */
const readVoiceTs = (file) => {
  const src = readFileSync(file, 'utf8');
  return JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf(' as const')));
};
const writeVoiceTs = (file, voice) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, TS_HEAD + `export const VOICE = ${JSON.stringify(voice)} as const;\n` + 'export type VoiceId = keyof typeof VOICE.lines;\n');
};

/* ── model ─────────────────────────────────────────────────────── */
function modelDir() {
  if (process.env.KOKORO_DIR) return process.env.KOKORO_DIR;
  const cache = path.join(ROOT, '.cache');
  const dir = path.join(cache, 'package', 'kokoro-int8-en-v0_19');
  if (!existsSync(path.join(dir, 'model.int8.onnx'))) {
    mkdirSync(cache, { recursive: true });
    console.log('[voice] fetching the Kokoro model from npm (≈ 150 MB, once)…');
    const out = execFileSync('npm', ['pack', 'n8n-nodes-ttsbro@0.1.6', '--pack-destination', cache, '--silent'], {
      cwd: cache,
    })
      .toString()
      .trim()
      .split('\n')
      .pop();
    execFileSync('tar', ['xzf', path.join(cache, out), '-C', cache, 'package/kokoro-int8-en-v0_19']);
  }
  return dir;
}


/* ── Fish Audio (api.fish.audio) ───────────────────────────────── */
const FISH_API = 'https://api.fish.audio';

/** Minimal MessagePack encoder (the payload shape the official SDK sends). */
function msgpack(v) {
  const parts = [];
  const u8 = (...b) => parts.push(Buffer.from(b));
  const enc = (x) => {
    if (x === null || x === undefined) return u8(0xc0);
    if (x === true) return u8(0xc3);
    if (x === false) return u8(0xc2);
    if (typeof x === 'number') {
      if (Number.isInteger(x) && x >= 0 && x < 128) return u8(x);
      if (Number.isInteger(x) && x < 0 && x >= -32) return u8(0x100 + x);
      if (Number.isInteger(x) && x >= 0 && x < 0x100000000) { const b = Buffer.alloc(5); b[0] = 0xce; b.writeUInt32BE(x, 1); return parts.push(b); }
      const b = Buffer.alloc(9); b[0] = 0xcb; b.writeDoubleBE(x, 1); return parts.push(b);
    }
    if (typeof x === 'string') {
      const s = Buffer.from(x, 'utf8');
      if (s.length < 32) u8(0xa0 | s.length);
      else if (s.length < 0x100) u8(0xd9, s.length);
      else { const h = Buffer.alloc(3); h[0] = 0xda; h.writeUInt16BE(s.length, 1); parts.push(h); }
      return parts.push(s);
    }
    if (Array.isArray(x)) {
      if (x.length < 16) u8(0x90 | x.length); else { const h = Buffer.alloc(3); h[0] = 0xdc; h.writeUInt16BE(x.length, 1); parts.push(h); }
      return x.forEach(enc);
    }
    const keys = Object.keys(x).filter((k) => x[k] !== undefined);
    if (keys.length < 16) u8(0x80 | keys.length); else { const h = Buffer.alloc(3); h[0] = 0xde; h.writeUInt16BE(keys.length, 1); parts.push(h); }
    for (const k of keys) { enc(k); enc(x[k]); }
  };
  enc(v);
  return Buffer.concat(parts);
}

/** curl honours HTTPS_PROXY and the system CA store on every platform. */
function curl(args, headers = {}) {
  const dir = path.join(os.tmpdir(), `ntv-fish-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const hfile = path.join(dir, 'h');
  writeFileSync(hfile, Object.entries({ Authorization: `Bearer ${process.env.FISH_API_KEY}`, ...headers }).map(([k, v]) => `${k}: ${v}`).join('\n'), { mode: 0o600 });
  try {
    return execFileSync('curl', ['-sS', '--fail-with-body', '--max-time', '120', '-H', `@${hfile}`, ...args], { maxBuffer: 1 << 28 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function fishList({ tag, language = 'en', pageSize = 30 }) {
  const q = new URLSearchParams({ page_size: String(pageSize), sort_by: 'task_count', language });
  if (tag) q.append('tag', tag);
  const res = JSON.parse(curl([`${FISH_API}/model?${q}`]).toString());
  return (res.items ?? []).map((m) => ({ id: m._id ?? m.id, title: m.title, tags: m.tags ?? [], languages: m.languages ?? [], uses: m.task_count ?? 0, likes: m.like_count ?? 0 }));
}

/** Resolve a fish.audio voice for a role: env var → voice-lines.json → library pick. */
function fishVoice(role, v) {
  const envName = v.fish?.env;
  const id = (envName && process.env[envName]) || v.fish?.id;
  if (id) return { id, title: v.fish?.title ?? '(pinned)' };
  const cands = fishList({ tag: v.fish?.gender, language: 'en' }).filter(
    (m) => m.languages.includes('en') && !m.tags.some((t) => /(anime|game|meme|cartoon|celebrit|character|asmr)/i.test(t)),
  );
  if (!cands.length) throw new Error(`[voice] no fish.audio voice found for ${role}; set ${envName}`);
  console.log(`[voice] ${role}: no voice pinned — picked "${cands[0].title}" (${cands[0].id}); set ${envName} to override`);
  return cands[0];
}

/** Decode a PCM WAV (16/24/32-bit, any channels) to mono float. */
function decodeWav(buf) {
  let o = 12, fmt = null, data = null;
  while (o + 8 <= buf.length) {
    const id = buf.toString('ascii', o, o + 4), len = buf.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { ch: buf.readUInt16LE(o + 10), sr: buf.readUInt32LE(o + 12), bits: buf.readUInt16LE(o + 22), float: buf.readUInt16LE(o + 8) === 3 };
    if (id === 'data') { data = buf.subarray(o + 8, o + 8 + Math.min(len, buf.length - o - 8)); break; }
    o += 8 + len + (len & 1);
  }
  if (!fmt || !data) throw new Error('[voice] fish.audio did not return a WAV');
  const bps = fmt.bits / 8, n = Math.floor(data.length / (bps * fmt.ch));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let c = 0; c < fmt.ch; c++) {
      const p = (i * fmt.ch + c) * bps;
      acc += fmt.float ? data.readFloatLE(p) : bps === 2 ? data.readInt16LE(p) / 32768 : bps === 3 ? data.readIntLE(p, 3) / 8388608 : data.readInt32LE(p) / 2147483648;
    }
    out[i] = acc / fmt.ch;
  }
  return { samples: out, sampleRate: fmt.sr };
}

function fishTTS(text, voice, speed) {
  const body = msgpack({
    text,
    reference_id: voice.id,
    format: 'wav',
    sample_rate: 44100,
    normalize: true,
    latency: 'normal',
    chunk_length: 200,
    temperature: 0.7,
    top_p: 0.7,
    prosody: { speed, volume: 0 },
  });
  const dir = path.join(os.tmpdir(), `ntv-fish-body-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const bfile = path.join(dir, 'b');
  writeFileSync(bfile, body);
  try {
    const wav = curl(['-X', 'POST', `${FISH_API}/v1/tts`, '--data-binary', `@${bfile}`], {
      'Content-Type': 'application/msgpack',
      model: process.env.FISH_MODEL || 's2-pro',
    });
    return decodeWav(wav);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}



/* ── Cartesia Sonic (api.cartesia.ai) ──────────────────────────── */
// Same API version, model and request shape as the product's own client
// (lib/cartesia/client.ts, verified live there).
const CARTESIA_API = 'https://api.cartesia.ai';
const CARTESIA_VERSION = '2026-08-14';
const CARTESIA_MODEL = () => process.env.CARTESIA_TTS_MODEL || 'sonic-3.6-2026-08-27';
const CARTESIA_EMOTIONS = ['neutral', 'calm', 'angry', 'content', 'sad'];

function cartesiaCurl(args) {
  const dir = path.join(os.tmpdir(), `ntv-cartesia-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const hfile = path.join(dir, 'h');
  writeFileSync(hfile, [`Authorization: Bearer ${process.env.CARTESIA_API_KEY}`, `Cartesia-Version: ${CARTESIA_VERSION}`, 'Content-Type: application/json'].join('\n'), { mode: 0o600 });
  try {
    return execFileSync('curl', ['-sS', '--fail-with-body', '--max-time', '120', '-H', `@${hfile}`, ...args], { maxBuffer: 1 << 28 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function cartesiaList(gender) {
  const q = new URLSearchParams({ limit: '100', gender, language: 'en' });
  const raw = JSON.parse(cartesiaCurl([`${CARTESIA_API}/voices?${q}`]).toString());
  const items = Array.isArray(raw) ? raw : raw.data ?? [];
  return items.map((v) => ({ id: v.id, name: v.name, tagline: v.tagline ?? '', description: v.description ?? '', pro: v.is_pro === true, status: v.status ?? 'active' }));
}

/** Resolve a Cartesia voice for a role: env var → voice-lines.json → library pick. */
function cartesiaVoice(role, v, taken) {
  const c = v.cartesia ?? {};
  const id = (c.env && process.env[c.env]) || c.id;
  if (id) return { id, name: c.name ?? '(pinned)' };
  const pick = cartesiaList(c.gender ?? 'feminine').filter((x) => !x.pro && x.status === 'active' && !taken.has(x.id));
  const pref = pick.find((x) => /(conversational|friendly|casual|natural|warm)/i.test(`${x.tagline} ${x.description}`)) ?? pick[0];
  if (!pref) throw new Error(`[voice] no Cartesia voice found for ${role}; set ${c.env}`);
  console.log(`[voice] ${role}: picked Cartesia "${pref.name}" (${pref.id}) — pin it in voice-lines.json to keep it`);
  return pref;
}

/**
 * One Cartesia generation over SSE (POST /tts/sse, add_timestamps) so every
 * spoken word comes back with its real start/end — captions then sync to the
 * actual performance, fillers and pauses included. `text` may carry Sonic
 * SSML (<emotion value=…/>, <break time=…/>) and [laughter].
 */
function cartesiaTTS(text, voiceId, { speed, emotion, volume, language = 'en' } = {}) {
  const generation = {};
  if (typeof speed === 'number' && speed !== 1) generation.speed = Math.max(0.6, Math.min(1.5, speed));
  if (typeof volume === 'number' && volume !== 1) generation.volume = Math.max(0.5, Math.min(2, volume));
  if (emotion) generation.emotion = emotion;
  const SR = 44100;
  const body = {
    model_id: CARTESIA_MODEL(),
    transcript: text,
    voice: voiceId,
    language,
    output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: SR },
    add_timestamps: true,
    ...(Object.keys(generation).length ? { generation_config: generation } : {}),
  };
  const dir = path.join(os.tmpdir(), `ntv-cartesia-body-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const bfile = path.join(dir, 'b.json');
  writeFileSync(bfile, JSON.stringify(body));
  let raw;
  try {
    raw = cartesiaCurl(['-N', '-X', 'POST', `${CARTESIA_API}/tts/sse`, '--data-binary', `@${bfile}`]).toString('utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const chunks = [];
  const words = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    let ev;
    try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
    if (ev.type === 'chunk' && ev.data) chunks.push(Buffer.from(ev.data, 'base64'));
    else if (ev.type === 'timestamps' && ev.word_timestamps) {
      const wt = ev.word_timestamps;
      (wt.words ?? []).forEach((w, i) => words.push({ w, start: wt.start[i], end: wt.end[i] }));
    } else if (ev.type === 'error') throw new Error(`[voice] Cartesia: ${ev.title ?? ''} ${ev.message ?? JSON.stringify(ev)}`);
  }
  const pcm = Buffer.concat(chunks);
  if (!pcm.length) throw new Error(`[voice] Cartesia returned no audio: ${raw.slice(0, 400)}`);
  const n = Math.floor(pcm.length / 2);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;
  return { samples, sampleRate: SR, words };
}

/** A line may be several takes, each with its own emotion (Cartesia's advice for emotion shifts), joined by a short breath. */
function cartesiaLine(line, voiceId, v) {
  const parts = line.parts ?? [{ speak: line.speak ?? line.say, emotion: line.emotion, speed: line.speed }];
  const gap = line.gap ?? 0.22;
  const out = [];
  const words = [];
  let t = 0;
  let sr = 44100;
  parts.forEach((p, i) => {
    const r = cartesiaTTS(p.speak, voiceId, { speed: p.speed ?? v.cartesia?.speed, emotion: p.emotion ?? v.cartesia?.emotion, volume: p.volume, language: line.language ?? 'en' });
    sr = r.sampleRate;
    const tr = trimLead(r.samples, sr);
    for (const w of r.words) words.push({ w: w.w, start: w.start - tr.offset + t, end: w.end - tr.offset + t });
    out.push(tr.samples);
    t += tr.samples.length / sr;
    if (i < parts.length - 1) { const g = new Float32Array(Math.round(gap * sr)); out.push(g); t += gap; }
  });
  const n = out.reduce((a, x) => a + x.length, 0);
  const samples = new Float32Array(n);
  let o = 0;
  for (const x of out) { samples.set(x, o); o += x.length; }
  return { samples, sampleRate: sr, words };
}

/** Cut leading/trailing silence of one take; report how much was cut at the front (s). */
function trimLead(s, sr, pad = 0.03) {
  let peak = 0;
  for (const x of s) peak = Math.max(peak, Math.abs(x));
  const thr = 0.01 * (peak || 1);
  let a = 0, b = s.length - 1;
  while (a < s.length && Math.abs(s[a]) < thr) a++;
  while (b > a && Math.abs(s[b]) < thr) b--;
  const p = Math.round(pad * sr);
  const start = Math.max(0, a - p);
  return { samples: s.slice(start, Math.min(s.length, b + p)), offset: start / sr };
}

/**
 * The canonical words of `say` (what the captions and timing.ts index, word k).
 * Spaced scripts split on whitespace; Japanese / Chinese have no spaces, so they
 * are cut into ICU word segments with punctuation kept on the word before it
 * (the tokens concatenate back to `say` with no separator).
 */
const UNSPACED = new Set(['ja', 'zh']);
function tokenize(text, language = 'en') {
  if (!UNSPACED.has(language)) return text.split(/\s+/).filter(Boolean);
  const out = [];
  for (const { segment, isWordLike } of new Intl.Segmenter(language, { granularity: 'word' }).segment(text)) {
    if (!segment.trim()) continue;
    if (!isWordLike && out.length) out[out.length - 1] += segment;
    else out.push(segment);
  }
  return out;
}
const splitPhrases = (say, language = 'en') =>
  UNSPACED.has(language) ? say.split(/(?<=[、。！？!?])/).filter((p) => p.trim()) : say.split(/(?<=[,.!?])\s+/).filter(Boolean);

/**
 * Map the canonical words (line.say) onto the words actually spoken (which may
 * add "um", "oh", "see you then"). Works on a character stream, so it holds
 * whether Cartesia times whole words, sub-words or single characters (Japanese):
 * each spoken unit's letters/digits get times spread over its [start, end]; each
 * canonical word is found in order in that stream (a small look-ahead skips
 * fillers). Unmatched words are interpolated; if too little matches (e.g. the
 * model re-spelt "AI" as katakana), the words are laid over the returned
 * timeline in proportion to their length. The result is always monotonic.
 */
function alignWords(say, spoken, language = 'en') {
  const norm = (w) => String(w).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const canon = tokenize(say, language);
  const stream = [];
  for (const x of spoken) {
    const n = [...norm(x.w)];
    n.forEach((c, i) => stream.push({ c, start: x.start + ((x.end - x.start) * i) / n.length, end: x.start + ((x.end - x.start) * (i + 1)) / n.length }));
  }
  const first = spoken.length ? spoken[0].start : 0, last = spoken.length ? spoken[spoken.length - 1].end : 0;
  const out = canon.map((w) => ({ w, t: NaN, end: NaN }));
  let p = 0, matched = 0;
  canon.forEach((w, i) => {
    const cs = [...norm(w)];
    if (!cs.length) return;
    let best = null;
    for (let s0 = p; s0 < Math.min(stream.length, p + 24); s0++) {
      if (stream[s0].c !== cs[0]) continue;
      let k = s0, hit = 1, endAt = s0;
      for (let ci = 1; ci < cs.length; ci++) {
        for (let q = k + 1; q < Math.min(stream.length, k + 3); q++) if (stream[q].c === cs[ci]) { k = q; endAt = q; hit++; break; }
      }
      if (hit / cs.length >= 0.6) { best = { s0, endAt }; break; }
    }
    if (!best) return;
    out[i].t = stream[best.s0].start; out[i].end = stream[best.endAt].end; p = best.endAt + 1; matched++;
  });
  const words = canon.filter((w) => norm(w)).length;
  if (stream.length && matched < Math.max(1, Math.ceil(words / 2))) {
    // fall back to the returned timestamps: canonical length → position in the spoken stream
    const total = canon.reduce((a, w) => a + Math.max(1, [...norm(w)].length), 0);
    let acc = 0;
    canon.forEach((w, i) => {
      const len = Math.max(1, [...norm(w)].length);
      const a = stream[Math.min(stream.length - 1, Math.floor((acc / total) * stream.length))];
      const z = stream[Math.min(stream.length - 1, Math.max(0, Math.ceil(((acc + len) / total) * stream.length) - 1))];
      out[i].t = a.start; out[i].end = z.end; acc += len;
    });
  }
  // interpolate the gaps
  for (let i = 0; i < out.length; i++) {
    if (!Number.isNaN(out[i].t)) continue;
    let a = i - 1; while (a >= 0 && Number.isNaN(out[a].t)) a--;
    let c = i + 1; while (c < out.length && Number.isNaN(out[c].t)) c++;
    const ta = a >= 0 ? out[a].end : first, tc = c < out.length ? out[c].t : last;
    const k = (i - a) / (c - a);
    out[i].t = ta + (tc - ta) * k; out[i].end = out[i].t + (tc - ta) / (c - a);
  }
  // monotonic: a start never precedes the one before it, an end never precedes its start
  for (let i = 0; i < out.length; i++) {
    if (i > 0 && out[i].t < out[i - 1].t) out[i].t = out[i - 1].t;
    if (!(out[i].end >= out[i].t)) out[i].end = out[i].t;
  }
  return out;
}

/* ── your own files (voice-src/) ───────────────────────────────── */
const SRC = abs(FILM, 'voiceSrc');
const EXTS = ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'webm'];
const srcFile = (id) => EXTS.map((e) => path.join(SRC, `${id}.${e}`)).find((f) => existsSync(f));

/** Decode any audio file to mono float (WAV natively, the rest through Remotion's ffmpeg). */
function decodeFile(file) {
  if (file.endsWith('.wav')) {
    try {
      return decodeWav(readFileSync(file));
    } catch {
      /* fall through to ffmpeg (e.g. a compressed WAV) */
    }
  }
  const wav = execFileSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', '-f', 'wav', '-'], {
    cwd: ROOT,
    env: { ...process.env, NTV_SKIP_SFX: '1' },
    maxBuffer: 1 << 28,
  });
  return decodeWav(wav);
}

/* ── tiny DSP ──────────────────────────────────────────────────── */
class Biquad {
  /** 'lp' | 'hp' | 'peak' (RBJ cookbook; `db` = the peak's gain) */
  constructor(type, f, q, sr, db = 0) {
    const w = (2 * Math.PI * f) / sr;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    let b0, b1, b2, a0, a2;
    if (type === 'peak') {
      const A = Math.pow(10, db / 40);
      [b0, b1, b2] = [1 + alpha * A, -2 * cos, 1 - alpha * A];
      [a0, a2] = [1 + alpha / A, 1 - alpha / A];
    } else {
      if (type === 'lp') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
      else [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
      [a0, a2] = [1 + alpha, 1 - alpha];
    }
    Object.assign(this, { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cos) / a0, a2: a2 / a0 });
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** A clean phone line: 280 Hz – 3.6 kHz band, a touch of saturation. */
function phoneLine(s, sr) {
  const hp1 = new Biquad('hp', 280, 0.707, sr), hp2 = new Biquad('hp', 280, 0.707, sr);
  const lp1 = new Biquad('lp', 3600, 0.707, sr), lp2 = new Biquad('lp', 3600, 0.707, sr);
  const out = new Float32Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const v = lp2.run(lp1.run(hp2.run(hp1.run(s[i]))));
    out[i] = Math.tanh(v * 1.6) / Math.tanh(1.6);
  }
  return out;
}

/** Gentle presence for Ava: take out the mud below 90 Hz. */
function clean(s, sr) {
  const hp = new Biquad('hp', 90, 0.707, sr);
  return Float32Array.from(s, (x) => hp.run(x));
}

function trim(s, sr, pad = 0.04) {
  const thr = 0.01 * peakOf(s);
  let a = 0, b = s.length - 1;
  while (a < s.length && Math.abs(s[a]) < thr) a++;
  while (b > a && Math.abs(s[b]) < thr) b--;
  const p = Math.round(pad * sr);
  return s.slice(Math.max(0, a - p), Math.min(s.length, b + p));
}

/** A role's corrective EQ: [{ type: 'peak' | 'hp' | 'lp', f, q, db }] in series. */
function roleEq(s, sr, eq = []) {
  if (!eq.length) return s;
  const bands = eq.map((e) => new Biquad(e.type ?? 'peak', e.f, e.q ?? 0.707, sr, e.db ?? 0));
  return Float32Array.from(s, (x) => bands.reduce((v, b) => b.run(v), x));
}
const eqSignature = (eq = []) => eq.map((e) => `${e.type ?? 'peak'}${e.f}/${e.q ?? 0.707}/${e.db ?? 0}`).join(',');

/**
 * Loudness-normalise a line to `lufs` (BS.1770 integrated, gated, mono). A peak that would
 * pass `peakMax` dBFS is caught by a soft knee in its last 2 dB (reported; the voices
 * have ~5 dB of crest to spare at the dialogue target, so it should never engage).
 */
function level(s, sr, { lufs, peakMax = -1 }) {
  const before = integrated([s], sr);
  const g = Math.pow(10, (lufs - before) / 20);
  const ceil = Math.pow(10, peakMax / 20);
  const knee = ceil * Math.pow(10, -2 / 20);
  let caught = 0;
  const out = Float32Array.from(s, (x) => {
    const y = x * g;
    const a = Math.abs(y);
    if (a <= knee) return y;
    caught++;
    return Math.sign(y) * (knee + (ceil - knee) * Math.tanh((a - knee) / (ceil - knee)));
  });
  return { s: out, gainDb: lufs - before, before, caught };
}

function fades(s, sr, ms = 12) {
  const n = Math.round((ms / 1000) * sr);
  for (let i = 0; i < n && i < s.length; i++) { s[i] *= i / n; s[s.length - 1 - i] *= i / n; }
  return s;
}

function writeWav(file, s, sr) {
  const data = Buffer.alloc(s.length * 3);
  for (let i = 0; i < s.length; i++) data.writeIntLE(Math.round(Math.max(-1, Math.min(1, s[i])) * 8388607), i * 3, 3);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 3, 28); h.writeUInt16LE(3, 32); h.writeUInt16LE(24, 34); h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
}

/* ── timing analysis ───────────────────────────────────────────── */
/** Per-frame RMS, normalised to the line's loudest frame. */
function envelope(s, sr) {
  const hop = sr / FPS;
  const n = Math.ceil(s.length / hop);
  const env = [];
  for (let f = 0; f < n; f++) {
    let sum = 0, c = 0;
    for (let i = Math.floor(f * hop); i < Math.min(s.length, Math.floor((f + 1) * hop)); i++) { sum += s[i] * s[i]; c++; }
    env.push(Math.sqrt(sum / (c || 1)));
  }
  const max = peakOf(env) || 1;
  return env.map((v) => Math.round((v / max) * 1000) / 1000);
}

/** Pauses ≥ 90 ms (10 ms RMS windows below 8 % of peak), as [start, end] seconds. */
function pauses(s, sr) {
  const win = Math.round(sr * 0.01);
  const rms = [];
  for (let i = 0; i + win <= s.length; i += win) {
    let sum = 0;
    for (let k = i; k < i + win; k++) sum += s[k] * s[k];
    rms.push(Math.sqrt(sum / win));
  }
  const thr = 0.08 * peakOf(rms);
  const out = [];
  let st = -1;
  rms.forEach((v, i) => {
    if (v < thr && st < 0) st = i;
    if ((v >= thr || i === rms.length - 1) && st >= 0) {
      if (i - st >= 9 && st > 0 && i < rms.length - 1) out.push([st / 100, i / 100]);
      st = -1;
    }
  });
  return out;
}

/**
 * Phrase + word timings. Phrases split at punctuation; if the detected pauses
 * match the phrase breaks, phrases snap to them, otherwise they share the
 * voiced time by length. Words share their phrase by length (+1 per word).
 */
function timingsFromWords(say, aligned, lead, language = 'en') {
  const phrases = splitPhrases(say, language);
  const words = aligned.map((x) => ({ w: x.w, t: Math.round(Math.max(0, x.t + lead) * 1000) / 1000 }));
  let k = 0;
  const ph = phrases.map((p) => {
    const n = Math.max(1, tokenize(p, language).length);
    const a = aligned[Math.min(k, aligned.length - 1)], z = aligned[Math.min(k + n - 1, aligned.length - 1)];
    k += n;
    return { text: p, start: Math.round(Math.max(0, a.t + lead) * 1000) / 1000, end: Math.round(Math.max(0, z.end + lead) * 1000) / 1000 };
  });
  return { phrases: ph, words };
}

function timings(say, dur, ps, language = 'en') {
  const phrases = splitPhrases(say, language);
  const weight = (t) => t.replace(/[^\p{L}\p{N}]/gu, '').length + 2;
  const total = phrases.reduce((a, p) => a + weight(p), 0);
  const lead = 0.04, tail = 0.04;
  // expected phrase boundaries by length, then each snapped to the nearest
  // real pause (±0.45 s) — "p.m." pauses inside a phrase are ignored
  const span = dur - lead - tail;
  let acc = lead;
  const expected = phrases.slice(0, -1).map((p) => (acc += (span * weight(p)) / total));
  const used = new Set();
  const cuts = expected.map((e) => {
    let best = -1;
    ps.forEach((p, k) => {
      const mid = (p[0] + p[1]) / 2;
      if (used.has(k) || Math.abs(mid - e) > 0.45) return;
      if (best < 0 || Math.abs(mid - e) < Math.abs((ps[best][0] + ps[best][1]) / 2 - e)) best = k;
    });
    if (best < 0) return [e, e];
    used.add(best);
    return ps[best];
  });
  const bounds = phrases.map((_, i) => [i === 0 ? lead : cuts[i - 1][1], i === phrases.length - 1 ? dur - tail : cuts[i][0]]);
  const words = [];
  phrases.forEach((p, i) => {
    const ws = tokenize(p, language);
    const wt = ws.reduce((a, w) => a + weight(w), 0);
    let t = bounds[i][0];
    for (const w of ws) {
      words.push({ w, t: Math.round(t * 1000) / 1000 });
      t += ((bounds[i][1] - bounds[i][0]) * weight(w)) / wt;
    }
  });
  return {
    phrases: phrases.map((p, i) => ({ text: p, start: Math.round(bounds[i][0] * 1000) / 1000, end: Math.round(bounds[i][1] * 1000) / 1000 })),
    words,
  };
}

/* ── run ───────────────────────────────────────────────────────── */
const t0 = Date.now();
const argv = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(LINES_JSON, 'utf8'));
const LINES_NAME = path.basename(LINES_JSON);
/* borrowed lines: copied from another film, never synthesised */
const isBorrow = (l) => typeof l.borrow === 'string';
for (const l of cfg.lines.filter(isBorrow)) {
  if (!Object.hasOwn(FILMS, l.borrow)) throw new Error(`[voice] ${l.id} borrows from an unknown film "${l.borrow}" (known: ${Object.keys(FILMS).join(', ')})`);
  if (l.borrow === FILM.id) throw new Error(`[voice] ${l.id} borrows from its own film "${l.borrow}"`);
}
/** A borrowed line: the source film's WAV (byte-copied by the caller) and its entry, `file` rewritten to this film. */
const borrowed = (line) => {
  const from = { id: line.borrow, ...FILMS[line.borrow] };
  const wav = path.join(abs(from, 'voiceDir'), `${line.id}.wav`);
  const entry = existsSync(abs(from, 'voiceTs')) ? readVoiceTs(abs(from, 'voiceTs')).lines[line.id] : undefined;
  if (!existsSync(wav) || !entry) throw new Error(`[voice] borrow: ${line.id} is not in film "${from.id}" (${from.voiceDir}/${line.id}.wav + ${from.voiceTs})`);
  return { wav, from, entry: { ...entry, file: voiceFile(FILM, line.id) } };
};
const cfg_override_ids = {};
const forced = argv.find((a) => a.startsWith('--engine='))?.split('=')[1];
const opt = (k) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
/** --out=DIR writes a complete candidate set (DIR/voice/*.wav + DIR/voice.generated.ts + DIR/preview.wav) instead of the live one. */
const OUT_DIR = opt('out') ? path.resolve(opt('out')) : null;
/** --install=DIR copies takes from a candidate set into the live set (no synthesis). */
const INSTALL = opt('install') ? path.resolve(opt('install')) : null;
/** --only=a,b generates just those lines and merges them into the live set (the other WAVs and their entries stay untouched). */
const ONLY = opt('only') ? opt('only').split(',').map((x) => x.trim()).filter(Boolean) : null;
if (ONLY) {
  const unknown = ONLY.filter((id) => !cfg.lines.some((l) => l.id === id));
  if (unknown.length) throw new Error(`[voice] --only: no such line(s) in ${LINES_NAME}: ${unknown.join(', ')}`);
  if (OUT_DIR) throw new Error('[voice] --only merges into the live set; it does not combine with --out');
}
const REMASTER = argv.includes('--remaster');
if (REMASTER && OUT_DIR) throw new Error('[voice] --remaster re-levels the live set; it does not combine with --out');
if (INSTALL && (OUT_DIR || REMASTER)) throw new Error('[voice] --install writes the live set; it does not combine with --out or --remaster');
/* the frozen guard: a delivered film's live set (its voice WAVs + voice.generated.ts) is not rewritten by accident */
if (FILM.frozen && !argv.includes('--list')) {
  if (INSTALL) throw new Error(`[voice] film "${FILM.id}" is frozen: --install never writes into it (candidate sets: --out=DIR)`);
  if (!OUT_DIR && !argv.includes('--unfreeze'))
    throw new Error(
      `[voice] film "${FILM.id}" is frozen (delivered): this run would rewrite ${FILM.voiceDir}/ and ${FILM.voiceTs}. ` +
        'Write a candidate set with --out=DIR, or add --unfreeze if you really mean to replace the live set.',
    );
}
const LINES = ONLY ? cfg.lines.filter((l) => ONLY.includes(l.id)) : cfg.lines;
const SYNTH = LINES.filter((l) => !isBorrow(l));
const RESERVED = new Set(['engine', 'out', 'only', 'install', 'film']);
for (const role of Object.keys(cfg.voices)) {
  if (RESERVED.has(role)) continue;
  const id = opt(role);
  if (id) cfg_override_ids[role] = id;
}
const haveAllFiles = SYNTH.every((l) => srcFile(l.id));
const ENGINE =
  forced ?? (haveAllFiles ? 'files' : process.env.CARTESIA_API_KEY ? 'cartesia' : process.env.FISH_API_KEY ? 'fish' : 'kokoro');

if (argv.includes('--list')) {
  if (!process.env.FISH_API_KEY) throw new Error('--list needs FISH_API_KEY');
  for (const gender of ['female', 'male']) {
    console.log(`\n${gender.toUpperCase()} (English, most used first):`);
    for (const m of fishList({ tag: gender })) console.log(`  ${m.id}  ${String(m.uses).padStart(8)} uses  ${m.title}  [${m.tags.join(', ')}]`);
  }
  process.exit(0);
}

/* ── the dialogue post chain: role EQ → one loudness target → edge fades ── */
const LEVEL = { lufs: -23, peakMax: -1, ...(cfg.level ?? {}) };
const r2 = (x) => Math.round(x * 100) / 100;
const postOf = (v, L) => ({ lufs: LEVEL.lufs, gainDb: r2(L.gainDb), eq: eqSignature(v.eq) });
const levelLog = (id, L) =>
  `${r2(L.before).toFixed(2).padStart(7)} → ${LEVEL.lufs} LUFS (${L.gainDb >= 0 ? '+' : ''}${L.gainDb.toFixed(2)} dB)${L.caught ? `  · soft knee caught ${L.caught} samples` : ''}`;

if (INSTALL) {
  // no new takes: chosen takes of a candidate set (--out=DIR, e.g. the Cartesia session's
  // voice-candidates/kb/take-N) become the film's live lines, byte for byte
  const candTs = path.join(INSTALL, 'voice.generated.ts');
  if (!existsSync(candTs)) throw new Error(`[voice] --install: ${rel(INSTALL)} is not a candidate set (no voice.generated.ts)`);
  const cand = readVoiceTs(candTs);
  if (cand.fps !== FPS) throw new Error(`[voice] --install: ${rel(candTs)} is at ${cand.fps} fps, the films use ${FPS}`);
  const want = ONLY ?? Object.keys(cand.lines);
  const strangers = want.filter((id) => !cfg.lines.some((l) => l.id === id));
  if (strangers.length) throw new Error(`[voice] --install: not lines of film "${FILM.id}" (${LINES_NAME}): ${strangers.join(', ')}`);
  const ids = cfg.lines.map((l) => l.id).filter((id) => want.includes(id)); // film order
  const absent = ids.filter((id) => !isBorrow(cfg.lines.find((l) => l.id === id)) && !cand.lines[id]);
  if (absent.length) throw new Error(`[voice] --install: not in the candidate set ${rel(INSTALL)}: ${absent.join(', ')}`);
  const prev = existsSync(TS_OUT) ? readVoiceTs(TS_OUT) : null;
  if (prev && prev.fps !== FPS) throw new Error(`[voice] --install: ${FILM.voiceTs} is at ${prev.fps} fps`);
  // check every take before anything is copied: the WAV is there and is the take its entry describes
  const plan = ids.map((id) => {
    const line = cfg.lines.find((l) => l.id === id);
    if (isBorrow(line)) return { id, line, borrow: borrowed(line) };
    const e = cand.lines[id];
    const wav = path.join(INSTALL, 'voice', `${id}.wav`);
    if (!existsSync(wav)) throw new Error(`[voice] --install: ${rel(wav)} is missing`);
    const w = decodeWav(readFileSync(wav));
    const dur = w.samples.length / w.sampleRate;
    if (Math.abs(dur - e.duration) > 0.002) throw new Error(`[voice] --install: ${rel(wav)} is ${dur.toFixed(3)} s, its entry says ${e.duration} s — not the take its timings describe`);
    const warn = [];
    if (e.say !== line.say) warn.push(`its say "${e.say}" ≠ ${LINES_NAME} "${line.say}"`);
    if (e.voice !== line.voice) warn.push(`its role ${e.voice} ≠ ${LINES_NAME} ${line.voice}`);
    return { id, line, e, wav, dur, warn };
  });
  mkdirSync(OUT, { recursive: true });
  const installed = {};
  for (const p of plan) {
    if (p.borrow) {
      copyFileSync(p.borrow.wav, path.join(OUT, `${p.id}.wav`));
      installed[p.id] = p.borrow.entry;
      console.log(`[voice] borrow  ${p.id.padEnd(10)} from film "${p.borrow.from.id}" (${p.borrow.from.voiceDir}/${p.id}.wav, byte copy)`);
      continue;
    }
    copyFileSync(p.wav, path.join(OUT, `${p.id}.wav`));
    installed[p.id] = { ...p.e, file: voiceFile(FILM, p.id) };
    console.log(`[voice] install ${p.id.padEnd(10)} ${p.e.voice.padEnd(8)} ${p.dur.toFixed(2)} s  ${rel(p.wav)} → ${FILM.voiceDir}/${p.id}.wav`);
    for (const w of p.warn) console.log(`[voice] WARN    ${p.id}: ${w} (re-generate it, or update the script)`);
  }
  const roles = new Set(plan.filter((p) => !p.borrow).map((p) => p.e.voice));
  const candVoices = Object.fromEntries(Object.entries(cand.voices ?? {}).filter(([r]) => roles.has(r)));
  const written = prev
    ? { ...prev, engine: prev.engine === cand.engine ? prev.engine : 'mixed', voices: { ...prev.voices, ...candVoices }, lines: { ...prev.lines, ...installed } }
    : { fps: cand.fps, engine: cand.engine, voices: candVoices, lines: installed };
  writeVoiceTs(TS_OUT, written);
  console.log(`[voice] installed ${plan.length} line(s) from ${rel(INSTALL)} → ${FILM.voiceDir} + ${FILM.voiceTs} (${Object.keys(written.lines).length} lines live) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(0);
}

if (REMASTER) {
  // no new takes: the current lines (already phone-lined / cleaned, trimmed and faded) get the
  // role EQ they don't carry yet and the dialogue loudness target; timings stay as they are
  const prev = readVoiceTs(TS_OUT);
  let n = 0;
  for (const line of cfg.lines) {
    if (isBorrow(line)) {
      console.log(`[voice] remaster ${line.id.padEnd(7)} borrowed from film "${line.borrow}" — left as copied`);
      continue;
    }
    n++;
    const v = cfg.voices[line.voice];
    const old = prev.lines[line.id];
    if (!old) throw new Error(`[voice] --remaster: ${line.id} is not in ${FILM.voiceTs} — generate it first`);
    const file = path.join(OUT, `${line.id}.wav`);
    const { samples, sampleRate: sr } = decodeWav(readFileSync(file));
    const want = eqSignature(v.eq);
    const has = old.post?.eq ?? '';
    if (has && has !== want) throw new Error(`[voice] --remaster: ${line.id} already carries EQ "${has}" (config: "${want}") — regenerate the take`);
    const L = level(has === want ? samples : roleEq(samples, sr, v.eq), sr, LEVEL);
    writeWav(file, L.s, sr);
    // (gainDb accumulates: the level change since the take's original peak normalisation)
    prev.lines[line.id] = { ...old, env: envelope(L.s, sr), post: { ...postOf(v, L), gainDb: r2((old.post?.gainDb ?? 0) + L.gainDb) } };
    console.log(`[voice] remaster ${line.id.padEnd(7)} ${line.voice.padEnd(8)}${has !== want ? ` EQ ${want}` : ''} ${levelLog(line.id, L)}`);
  }
  writeVoiceTs(TS_OUT, prev);
  console.log(`[voice] remastered ${n} lines (timings kept) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(0);
}

let synth;
const chosen = {};
if (!SYNTH.length) {
  /* only borrowed lines: no engine needed */
} else if (ENGINE === 'files') {
  const missing = SYNTH.filter((l) => !srcFile(l.id)).map((l) => l.id);
  if (missing.length) throw new Error(`[voice] ${FILM.voiceSrc}/ is missing: ${missing.join(', ')}`);
  for (const role of Object.keys(cfg.voices)) chosen[role] = { engine: 'files', dir: FILM.voiceSrc };
  synth = (line) => decodeFile(srcFile(line.id));
} else if (ENGINE === 'cartesia') {
  if (!process.env.CARTESIA_API_KEY) throw new Error('--engine=cartesia needs CARTESIA_API_KEY');
  const taken = new Set();
  const voices = {};
  for (const [role, v] of Object.entries(cfg.voices)) {
    if (cfg_override_ids[role]) v.cartesia = { ...(v.cartesia ?? {}), id: cfg_override_ids[role], name: `(cli ${role})`, env: undefined };
    voices[role] = cartesiaVoice(role, v, taken);
    taken.add(voices[role].id);
    chosen[role] = { engine: 'cartesia', model: CARTESIA_MODEL(), id: voices[role].id, name: voices[role].name };
  }
  synth = (line, v, role) => cartesiaLine(line, voices[role].id, v);
} else if (ENGINE === 'fish') {
  if (!process.env.FISH_API_KEY) throw new Error('--engine=fish needs FISH_API_KEY');
  const voices = Object.fromEntries(Object.entries(cfg.voices).map(([role, v]) => [role, fishVoice(role, v)]));
  for (const [role, v] of Object.entries(voices)) chosen[role] = { engine: 'fish', model: process.env.FISH_MODEL || 's2-pro', id: v.id, title: v.title };
  synth = (line, v, role) => fishTTS(line.say, voices[role], v.fish?.speed ?? v.speed ?? 1);
} else {
  const M = modelDir();
  const sherpa = require('sherpa-onnx-node');
  const tts = new sherpa.OfflineTts({
    model: {
      kokoro: { model: `${M}/model.int8.onnx`, voices: `${M}/voices.bin`, tokens: `${M}/tokens.txt`, dataDir: `${M}/espeak-ng-data` },
      numThreads: 4,
      provider: 'cpu',
      debug: false,
    },
    maxNumSentences: 1,
  });
  for (const [role, v] of Object.entries(cfg.voices)) chosen[role] = { engine: 'kokoro', model: 'Kokoro-82M int8 (en v0.19)', voice: v.name };
  synth = (line, v) => {
    const a = tts.generate({ text: line.say, sid: v.sid, speed: v.speed });
    return { samples: Float32Array.from(a.samples), sampleRate: a.sampleRate };
  };
}

const VOICE_DIR = OUT_DIR ? path.join(OUT_DIR, 'voice') : OUT;
mkdirSync(VOICE_DIR, { recursive: true });
const result = { fps: FPS, engine: ENGINE, voices: chosen, lines: {} };
const previewParts = [];
for (const line of LINES) {
  if (isBorrow(line)) {
    const b = borrowed(line);
    copyFileSync(b.wav, path.join(VOICE_DIR, `${line.id}.wav`));
    result.lines[line.id] = b.entry;
    const w = decodeWav(readFileSync(b.wav));
    previewParts.push({ s: w.samples, sr: w.sampleRate });
    console.log(`[voice] borrow ${line.id.padEnd(7)} from film "${b.from.id}" (${b.from.voiceDir}/${line.id}.wav, byte copy)`);
    continue;
  }
  const v = cfg.voices[line.voice];
  const audio = synth(line, v, line.voice);
  const sr = audio.sampleRate;
  const tr = trimLead(audio.samples, sr, 0.04);
  const L = level(roleEq(v.phone ? phoneLine(tr.samples, sr) : clean(tr.samples, sr), sr, v.eq), sr, LEVEL);
  const s = fades(L.s, sr);
  writeWav(path.join(VOICE_DIR, `${line.id}.wav`), s, sr);
  previewParts.push({ s, sr });
  const dur = s.length / sr;
  const tm = audio.words?.length
    ? timingsFromWords(line.say, alignWords(line.say, audio.words, line.language), -tr.offset, line.language)
    : timings(line.say, dur, pauses(s, sr), line.language);
  result.lines[line.id] = {
    file: voiceFile(FILM, line.id),
    voice: line.voice,
    say: line.say,
    ...(line.language ? { language: line.language } : {}),
    duration: Math.round(dur * 1000) / 1000,
    frames: Math.ceil(dur * FPS),
    ...tm,
    env: envelope(s, sr),
    post: postOf(v, L),
  };
  console.log(`[voice] ${ENGINE} ${line.id.padEnd(7)} ${line.voice.padEnd(8)} ${dur.toFixed(2)} s  "${line.say}"${audio.words?.length ? `  (${audio.words.length} timed words)` : ''}  ${levelLog(line.id, L)}`);
}
if ((OUT_DIR || argv.includes('--preview')) && previewParts.length) {
  // one listenable file: every line in order with short gaps (a line at another sample rate,
  // e.g. a borrowed one, is left out rather than played at the wrong speed)
  const sr = previewParts[0].sr;
  const gap = new Float32Array(Math.round(0.45 * sr));
  const odd = previewParts.filter((p) => p.sr !== sr).length;
  if (odd) console.log(`[voice] preview: ${odd} line(s) at another sample rate left out`);
  const all = previewParts.filter((p) => p.sr === sr).flatMap((p) => [p.s, gap]);
  const n = all.reduce((a, x) => a + x.length, 0);
  const buf = new Float32Array(n);
  let o = 0;
  for (const x of all) { buf.set(x, o); o += x.length; }
  const previewFile = OUT_DIR ? path.join(OUT_DIR, 'preview.wav') : abs(FILM, 'preview');
  mkdirSync(path.dirname(previewFile), { recursive: true });
  writeWav(previewFile, buf, sr);
}
let written = result;
if (ONLY && existsSync(TS_OUT)) {
  // merge: the existing entries keep their exact JSON (and position); new ids are appended
  const prev = readVoiceTs(TS_OUT);
  written = { ...prev, lines: { ...prev.lines, ...result.lines } };
}
const TS_FILE = OUT_DIR ? path.join(OUT_DIR, 'voice.generated.ts') : TS_OUT;
writeVoiceTs(TS_FILE, written);
console.log(`[voice] ${LINES.length} lines${ONLY ? ' (merged)' : ''} → ${rel(VOICE_DIR)} + ${rel(TS_FILE)} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
