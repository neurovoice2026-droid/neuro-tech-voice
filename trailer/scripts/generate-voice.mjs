#!/usr/bin/env node
/**
 * Neuro Tech Voice trailer — the voices.
 *
 * Synthesises every spoken line in scripts/voice-lines.json with Kokoro-82M
 * (Apache-2.0, open weights), run locally through sherpa-onnx:
 *   · Ava   = af_bella  (female, the AI agent)
 *   · Caller = am_michael, second caller = bf_emma, both through a phone-line EQ
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
 *   npm run voice            (≈ 1 min on 4 CPU cores)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const cfg = JSON.parse(readFileSync(path.join(HERE, 'voice-lines.json'), 'utf8'));
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
mkdirSync(OUT, { recursive: true });
const result = { fps: FPS, model: 'Kokoro-82M int8 (en v0.19) via sherpa-onnx', voices: cfg.voices, lines: {} };
for (const line of cfg.lines) {
  const v = cfg.voices[line.voice];
  const audio = tts.generate({ text: line.say, sid: v.sid, speed: v.speed });
  const sr = audio.sampleRate;
  let s = trim(Float32Array.from(audio.samples), sr);
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
  console.log(`[voice] ${line.id.padEnd(7)} ${v.name.padEnd(10)} ${dur.toFixed(2)} s  "${line.say}"`);
}
writeFileSync(
  TS_OUT,
  '/* GENERATED by scripts/generate-voice.mjs — do not edit. Re-run `npm run voice`. */\n' +
    `export const VOICE = ${JSON.stringify(result)} as const;\n` +
    'export type VoiceId = keyof typeof VOICE.lines;\n',
);
console.log(`[voice] ${cfg.lines.length} lines → public/voice + src/voice.generated.ts in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
