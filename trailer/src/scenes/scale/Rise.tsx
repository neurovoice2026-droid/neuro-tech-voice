/**
 * Kinetic type for SCALE, in the site's two idioms:
 *
 *  <Rise>   the heading reveal — every character in its own mask rises from
 *           110 % with anticipation + overshoot (site spring), velocity blur,
 *           and exits upwards (power2.in) with its own stagger.
 *  <Voice>  the voice section's greeting — words (or characters, for
 *           Japanese) rise 10 px → 0 while un-blurring 3 px → 0, tiny
 *           stagger; exits lift and fade.
 *  <Stack>  overlays swaps in one slot (old line exits, new one rises).
 */
import React from 'react';
import type { SpringConfig } from 'remotion';
import { aos, EASE, SPRING, tween } from '../../lib/motion';

export const Stack: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <span style={{ display: 'inline-grid', justifyItems: 'start', alignItems: 'start', ...style }}>
    {React.Children.map(children, (c) => (
      <span style={{ gridArea: '1 / 1', whiteSpace: 'nowrap' }}>{c}</span>
    ))}
  </span>
);

export const Rise: React.FC<{
  text: string;
  t: number;
  at: number;
  out?: number;
  stagger?: number;
  outStagger?: number;
  config?: Partial<SpringConfig>;
  colorAt?: (i: number) => string | undefined;
  /** mask travel in % of the line box */
  travel?: number;
  /** reveal per character (default) or per word */
  unit?: 'char' | 'word';
  /** frames each character takes to leave */
  outDur?: number;
}> = ({
  text,
  t,
  at,
  out,
  stagger = 1,
  outStagger = 0.6,
  config = SPRING.site,
  colorAt,
  travel = 112,
  unit = 'char',
  outDur = 8,
}) => {
  const parts = unit === 'char' ? Array.from(text) : text.split(/( )/).filter((s) => s.length > 0);
  const n = parts.filter((p) => p !== ' ').length;
  const mask: React.CSSProperties = {
    display: 'inline-block',
    overflow: 'hidden',
    verticalAlign: 'top',
    paddingBottom: '0.16em',
    marginBottom: '-0.16em',
    fontKerning: 'none',
    whiteSpace: 'pre',
  };
  // settled and not leaving: one span (same box, same advances) keeps the DOM small
  if (t > at + n * stagger + 22 && (out === undefined || t < out) && !colorAt) {
    return <span style={mask}>{text}</span>;
  }
  if (t < at - 3) {
    return <span style={{ ...mask, visibility: 'hidden' }}>{text}</span>;
  }
  let k = 0;
  return (
    <>
      {parts.map((ch, pi) => {
        if (ch === ' ') return <span key={pi} style={{ whiteSpace: 'pre', fontKerning: 'none' }}> </span>;
        const i = k++;
        const s = at + i * stagger;
        const pAt = (f: number) => aos(f, s, { anticip: 3, depth: 0.1, config });
        const p = pAt(t);
        let y = (1 - p) * travel;
        let q = 0;
        if (out !== undefined) {
          const e = out + i * outStagger;
          q = tween(t, [e, e + outDur], [0, 1], EASE.in2);
          // 1.6× the mask so descenders clear it
          y -= q * travel * 1.6;
        }
        // the last 40 % of an exit also fades, so no half-glyphs hang in the slot
        const fade = q > 0.6 ? 1 - tween(q, [0.6, 1], [0, 1], EASE.inOut) : 1;
        const visible = t >= s - 3 && q < 1;
        const speed = Math.abs(pAt(t + 0.5) - pAt(t - 0.5)) * travel + (q > 0 && q < 1 ? 14 * q : 0);
        const blur = Math.min(6, speed * 0.09);
        return (
          <span key={pi} style={mask}>
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${visible ? y.toFixed(2) : travel}%)`,
                color: colorAt?.(i),
                opacity: fade < 1 ? fade : undefined,
                filter: visible && blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
              }}
            >
              {ch}
            </span>
          </span>
        );
      })}
    </>
  );
};

/** One token of a spoken line; `u` marks tokens under the disclosure underline. */
export type Tok = { s: string; u?: boolean; lead?: boolean };

export const Voice: React.FC<{
  lines: Tok[][];
  t: number;
  at: number;
  stagger?: number;
  rise?: number;
  /** 0..1 underline draw (only drawn under `u` tokens) */
  underline?: number;
  underlineColor?: string;
  out?: number;
}> = ({ lines, t, at, stagger = 1.2, rise = 10, underline = 0, underlineColor = '#7c3aed', out }) => {
  let k = 0;
  const q = out === undefined ? 0 : tween(t, [out, out + 6], [0, 1], EASE.in2);
  return (
    <>
      {lines.map((line, li) => {
        // group consecutive underline tokens into one span so the rule is continuous
        const groups: { u: boolean; toks: Tok[] }[] = [];
        for (const tok of line) {
          const g = groups[groups.length - 1];
          if (g && g.u === !!tok.u) g.toks.push(tok);
          else groups.push({ u: !!tok.u, toks: [tok] });
        }
        return (
          <div key={li} style={{ whiteSpace: 'nowrap' }}>
            {groups.map((g, gi) => (
              <span key={gi} style={{ position: 'relative', display: 'inline-block' }}>
                {g.toks.map((tok, ti) => {
                  const s = at + k++ * stagger;
                  const p = aos(t, s, { anticip: 2, depth: 0.08, config: SPRING.site });
                  const pv = aos(t - 1, s, { anticip: 2, depth: 0.08, config: SPRING.site });
                  // site: 0.45 s power2.out; tightened to sit inside an 8th note
                  const o = tween(t, [s, s + 7], [0, 1], EASE.out3);
                  const blur = tween(t, [s, s + 9], [3, 0], EASE.out3) + Math.min(3, Math.abs(p - pv) * rise * 0.25);
                  return (
                    <span
                      key={ti}
                      style={{
                        display: 'inline-block',
                        whiteSpace: 'pre',
                        transform: `translateY(${((1 - p) * rise - q * 6).toFixed(2)}px)`,
                        opacity: o * (1 - q),
                        filter: blur > 0.08 && o > 0 ? `blur(${blur.toFixed(2)}px)` : undefined,
                      }}
                    >
                      {tok.s}
                    </span>
                  );
                })}
                {g.u && underline > 0 ? (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      // the site's text-underline-offset .28em below the baseline
                      // (Cormorant at line-height 1.1: baseline sits .87em down the box)
                      bottom: '-0.1em',
                      height: 3,
                      borderRadius: 2,
                      background: underlineColor,
                      transform: `scaleX(${underline.toFixed(4)})`,
                      transformOrigin: '0 50%',
                    }}
                  />
                ) : null}
              </span>
            ))}
          </div>
        );
      })}
    </>
  );
};

/** Split a greeting line into tokens (words keep their trailing space). */
export function tokenize(line: string, perChar: boolean, disclose?: string): Tok[] {
  if (perChar) return Array.from(line).map((s) => ({ s }));
  const words = line.split(' ');
  const dw = disclose ? disclose.split(' ') : [];
  // find the disclosure phrase inside this line
  let start = -1;
  if (dw.length) {
    for (let i = 0; i + dw.length <= words.length; i++) {
      if (dw.every((w, j) => words[i + j].replace(/[.,]$/, '') === w)) {
        start = i;
        break;
      }
    }
  }
  const toks: Tok[] = [];
  words.forEach((w, i) => {
    const inU = start >= 0 && i >= start && i < start + dw.length;
    const last = i === words.length - 1;
    if (inU && i === start + dw.length - 1 && /[.,]$/.test(w)) {
      // the rule stops before the full stop, as the site's span does
      toks.push({ s: w.slice(0, -1), u: true });
      toks.push({ s: w.slice(-1) + (last ? '' : ' ') });
    } else {
      toks.push({ s: w + (last ? '' : ' '), u: inU });
    }
  });
  // spaces between underlined words stay inside the rule; the one after it does not
  for (let i = 0; i < toks.length - 1; i++) {
    if (toks[i].u && !toks[i + 1].u && toks[i].s.endsWith(' ')) {
      toks[i] = { ...toks[i], s: toks[i].s.trimEnd() };
      toks.splice(i + 1, 0, { s: ' ' });
      i++;
    }
  }
  return toks;
}
