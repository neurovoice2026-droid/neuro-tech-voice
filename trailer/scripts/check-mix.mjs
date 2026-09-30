#!/usr/bin/env node
/**
 * Offline mix check: sums the bed + every cue from src/timing.ts at its
 * exact frame (the way Remotion mixes them) and reports peak levels, so the
 * master is proven free of clipping before a 10-minute render.
 *
 *   node --experimental-strip-types scripts/check-mix.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { CUES, BED, FPS, DURATION } = await import(path.join(HERE, '..', 'src', 'timing.ts'));

function readWav(file) {
  const b = readFileSync(path.join(HERE, '..', 'public', 'sfx', file));
  const ch = b.readUInt16LE(22);
  const sr = b.readUInt32LE(24);
  const bits = b.readUInt16LE(34);
  let o = 12;
  while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4);
  const len = b.readUInt32LE(o + 4);
  const data = o + 8;
  const n = len / (ch * (bits / 8));
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = data + i * ch * 3;
    L[i] = b.readIntLE(p, 3) / 8388608;
    R[i] = b.readIntLE(p + 3, 3) / 8388608;
  }
  return { sr, L, R };
}

const SR = 48000;
const N = Math.ceil((DURATION / FPS) * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const add = (file, atFrame, vol) => {
  const w = readWav(file);
  const s0 = Math.round((atFrame / FPS) * SR);
  for (let i = 0; i < w.L.length && s0 + i < N; i++) {
    L[s0 + i] += w.L[i] * vol;
    R[s0 + i] += w.R[i] * vol;
  }
};
add(BED.file, 0, BED.vol);
let bedPeak = 0;
for (let i = 0; i < N; i++) bedPeak = Math.max(bedPeak, Math.abs(L[i]), Math.abs(R[i]));
for (const c of CUES) add(c.file, c.at, c.vol ?? 1);

let peak = 0;
let peakAt = 0;
let sumSq = 0;
for (let i = 0; i < N; i++) {
  const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
  if (a > peak) { peak = a; peakAt = i; }
  sumSq += L[i] * L[i] + R[i] * R[i];
}
const db = (x) => (20 * Math.log10(x)).toFixed(1);
console.log(`bed peak         ${db(bedPeak)} dBFS`);
console.log(`mix peak         ${db(peak)} dBFS at ${(peakAt / SR).toFixed(2)} s (frame ${Math.round((peakAt / SR) * FPS)})`);
console.log(`mix RMS          ${db(Math.sqrt(sumSq / (2 * N)))} dBFS`);
console.log(peak < 1 ? 'OK — no clipping' : 'CLIPPING — lower some cue volumes');
process.exit(peak < 1 ? 0 : 1);
