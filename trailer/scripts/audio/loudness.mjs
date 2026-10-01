/**
 * Loudness at any sample rate (ITU-R BS.1770-4 / EBU R 128), for the dialogue
 * pipeline (scripts/generate-voice.mjs normalises every line with it) and the
 * mix QA (scripts/check-mix.mjs: per-line dialogue loudness, momentary loudness
 * of the master at the logo impact vs the dialogue, the ending).
 *
 * The K-weighting is designed for the signal's own rate (the libebur128 /
 * pyloudnorm formulation), so a 44.1 kHz voice take measures the same as its
 * 48 kHz resample. Channels are summed with weight 1 (L, R / mono), so a mono
 * line placed dual-mono in a stereo mix reads +3.01 LU there.
 */

/** The two K-weighting biquads for sample rate `sr`. */
export function kCoeffs(sr) {
  // stage 1: the head's high shelf (+4 dB above ~1.7 kHz)
  let f0 = 1681.974450955533;
  const G = 3.999843853973347;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / sr);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const s1 = {
    b: [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0],
    a: [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
  };
  // stage 2: the RLB high-pass (~38 Hz)
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / sr);
  a0 = 1 + K / Q + K * K;
  const s2 = { b: [1, -2, 1], a: [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0] };
  return [s1, s2];
}

function kWeight(ch, sr) {
  const [s1, s2] = kCoeffs(sr);
  const out = new Float64Array(ch.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0, w1 = 0, w2 = 0;
  for (let i = 0; i < ch.length; i++) {
    const x = ch[i];
    const y = s1.b[0] * x + s1.b[1] * x1 + s1.b[2] * x2 - s1.a[0] * y1 - s1.a[1] * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    const z = s2.b[0] * y + s2.b[1] * z1 + s2.b[2] * z2 - s2.a[0] * w1 - s2.a[1] * w2;
    z2 = z1; z1 = y; w2 = w1; w1 = z;
    out[i] = z;
  }
  return out;
}

const lu = (z) => -0.691 + 10 * Math.log10(Math.max(1e-20, z));

/**
 * Block powers: `win` s windows every `hop` s over the K-weighted channels
 * (prefix sums, so a fine hop costs nothing). Returns { t: start times (s), p: powers }.
 */
export function blockPowers(chs, sr, { win = 0.4, hop = 0.1, from = 0, to = Infinity } = {}) {
  const kw = chs.map((c) => kWeight(c, sr));
  const n = kw[0].length;
  const cum = new Float64Array(n + 1);
  for (const ch of kw) {
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += ch[i] * ch[i];
      cum[i + 1] += acc;
    }
  }
  // (cum holds the running sum over every channel: the BS.1770 channel sum with weight 1)
  const bl = Math.round(win * sr);
  const hp = Math.max(1, Math.round(hop * sr));
  const t = [];
  const p = [];
  const s0 = Math.max(0, Math.round(from * sr));
  const s1 = Math.min(n - bl, Math.round(to * sr));
  for (let s = s0; s <= s1; s += hp) {
    t.push(s / sr);
    p.push((cum[s + bl] - cum[s]) / bl);
  }
  return { t, p };
}

/** Integrated loudness (LUFS), absolute (-70) and relative (-10 LU) gated — over [from, to] s if given. */
export function integrated(chs, sr, range = {}) {
  const { p } = blockPowers(chs, sr, { win: 0.4, hop: 0.1, ...range });
  const abs = p.filter((z) => lu(z) > -70);
  if (!abs.length) return -Infinity;
  const rel = lu(abs.reduce((a, z) => a + z, 0) / abs.length) - 10;
  const g = abs.filter((z) => lu(z) > rel);
  return lu(g.reduce((a, z) => a + z, 0) / g.length);
}

/** Momentary loudness (400 ms) series: [{ t: window start (s), lufs }], hop `hop` s. */
export function momentary(chs, sr, { hop = 0.01, from = 0, to = Infinity } = {}) {
  const { t, p } = blockPowers(chs, sr, { win: 0.4, hop, from, to });
  return t.map((x, i) => ({ t: x, lufs: lu(p[i]) }));
}

/** RMS level (dBFS, all channels) over [a, e] seconds. */
export function rmsDb(chs, sr, a, e) {
  const i0 = Math.max(0, Math.round(a * sr));
  const i1 = Math.min(chs[0].length, Math.round(e * sr));
  let z = 0;
  for (const c of chs) for (let i = i0; i < i1; i++) z += c[i] * c[i];
  return 10 * Math.log10(Math.max(1e-24, z / Math.max(1, (i1 - i0) * chs.length)));
}
