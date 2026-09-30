#!/usr/bin/env node
/**
 * Neuro Tech Voice trailer — the voices.
 *
 * Produces every spoken line in scripts/voice-lines.json with one of four
 * engines:
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
 * Callers are always put through a phone-line EQ; Ava stays full-band.
 *
 * Writes:
 *   public/voice/<id>.wav        (trimmed, peak-normalised to -5 dBFS)
 *   src/voice.generated.ts       durations, phrase + word timings (seconds) and
 *                                a per-frame loudness envelope (0..1) that
 *                                drives the orb and the waveform in sync
 *
 * The model is not committed. It is fetched once from the npm registry (the
 * Apache-2.0 package n8n-nodes-ttsbro ships the sherpa-onnx Kokoro int8 English
 * model) into .cache/, or pass KOKORO_DIR=/path/to/kokoro-int8-en-v0_19.
 * The generated WAVs + TS ARE committed, so rendering never needs the model.
 *
 *   npm run voice                       (files if voice-src/ is complete, else
 *                                        Cartesia / Fish if their key is set, else Kokoro)
 *   npm run voice -- --engine=cartesia  (force Cartesia)
 *   npm run voice -- --engine=files     (force files; a missing one is an error)
 *   npm run voice -- --engine=kokoro    (force the offline engine)
 *   npm run voice -- --list             (list fish.audio voice candidates)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const peakOf = (arr) => {
  let m = 0;
  for (const x of arr) m = Math.max(m, Math.abs(x));
  return m;
};
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(ROOT, 'public', 'voice');
const TS_OUT = path.join(ROOT, 'src', 'voice.generated.ts');
const FPS = 30;
const PEAK_DB = -5;

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

function cartesiaTTS(text, voiceId, { speed, emotion } = {}) {
  const generation = {};
  if (typeof speed === 'number' && speed !== 1) generation.speed = Math.max(0.6, Math.min(1.5, speed));
  if (emotion && CARTESIA_EMOTIONS.includes(emotion)) generation.emotion = emotion;
  const body = {
    model_id: CARTESIA_MODEL(),
    transcript: text,
    voice: voiceId,
    language: 'en',
    output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 44100 },
    ...(Object.keys(generation).length ? { generation_config: generation } : {}),
  };
  const dir = path.join(os.tmpdir(), `ntv-cartesia-body-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const bfile = path.join(dir, 'b.json');
  writeFileSync(bfile, JSON.stringify(body));
  try {
    return decodeWav(cartesiaCurl(['-X', 'POST', `${CARTESIA_API}/tts/bytes`, '--data-binary', `@${bfile}`]));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ── your own files (voice-src/) ───────────────────────────────── */
const SRC = path.join(ROOT, 'voice-src');
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
  constructor(type, f, q, sr) {
    const w = (2 * Math.PI * f) / sr;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
    else [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    const a0 = 1 + alpha;
    Object.assign(this, { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 });
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

function normalise(s, db) {
  const peak = peakOf(s);
  const g = Math.pow(10, db / 20) / (peak || 1);
  return Float32Array.from(s, (x) => x * g);
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
function timings(say, dur, ps) {
  const phrases = say.split(/(?<=[,.!?])\s+/).filter(Boolean);
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
    const ws = p.split(/\s+/);
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
const cfg = JSON.parse(readFileSync(path.join(HERE, 'voice-lines.json'), 'utf8'));
const forced = argv.find((a) => a.startsWith('--engine='))?.split('=')[1];
const haveAllFiles = cfg.lines.every((l) => srcFile(l.id));
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

let synth;
const chosen = {};
if (ENGINE === 'files') {
  const missing = cfg.lines.filter((l) => !srcFile(l.id)).map((l) => l.id);
  if (missing.length) throw new Error(`[voice] voice-src/ is missing: ${missing.join(', ')}`);
  for (const role of Object.keys(cfg.voices)) chosen[role] = { engine: 'files', dir: 'voice-src' };
  synth = (line) => decodeFile(srcFile(line.id));
} else if (ENGINE === 'cartesia') {
  if (!process.env.CARTESIA_API_KEY) throw new Error('--engine=cartesia needs CARTESIA_API_KEY');
  const taken = new Set();
  const voices = {};
  for (const [role, v] of Object.entries(cfg.voices)) {
    voices[role] = cartesiaVoice(role, v, taken);
    taken.add(voices[role].id);
    chosen[role] = { engine: 'cartesia', model: CARTESIA_MODEL(), id: voices[role].id, name: voices[role].name };
  }
  synth = (line, v, role) =>
    cartesiaTTS(line.say, voices[role].id, { speed: line.speed ?? v.cartesia?.speed ?? 1, emotion: line.emotion ?? v.cartesia?.emotion });
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

mkdirSync(OUT, { recursive: true });
const result = { fps: FPS, engine: ENGINE, voices: chosen, lines: {} };
for (const line of cfg.lines) {
  const v = cfg.voices[line.voice];
  const audio = synth(line, v, line.voice);
  const sr = audio.sampleRate;
  let s = trim(audio.samples, sr);
  s = v.phone ? phoneLine(s, sr) : clean(s, sr);
  s = fades(normalise(s, PEAK_DB), sr);
  writeWav(path.join(OUT, `${line.id}.wav`), s, sr);
  const dur = s.length / sr;
  const tm = timings(line.say, dur, pauses(s, sr));
  result.lines[line.id] = {
    file: `voice/${line.id}.wav`,
    voice: line.voice,
    say: line.say,
    duration: Math.round(dur * 1000) / 1000,
    frames: Math.ceil(dur * FPS),
    ...tm,
    env: envelope(s, sr),
  };
  console.log(`[voice] ${ENGINE} ${line.id.padEnd(7)} ${line.voice.padEnd(8)} ${dur.toFixed(2)} s  "${line.say}"`);
}
writeFileSync(
  TS_OUT,
  '/* GENERATED by scripts/generate-voice.mjs — do not edit. Re-run `npm run voice`. */\n' +
    `export const VOICE = ${JSON.stringify(result)} as const;\n` +
    'export type VoiceId = keyof typeof VOICE.lines;\n',
);
console.log(`[voice] ${cfg.lines.length} lines → public/voice + src/voice.generated.ts in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
