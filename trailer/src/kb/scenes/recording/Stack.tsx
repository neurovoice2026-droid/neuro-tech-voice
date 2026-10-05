/**
 * The day's paper → ONE COLUMN of the same line, scrolling like a teleprompter (SCRIPT.md b06).
 *
 *   0       Part I's pile exactly as it stopped (scenes/repeat Slips: the three answers on top — the third
 *           crooked — the rolls' sheets behind, a strip higher each, the pad's two blank sheets under them)
 *   pick up the pile is squared and lifted off the desk (its shadow opening) and carried with the camera
 *   fold    on the way every written sheet folds to ONE line: ● FRONT DESK lifts out of its mask, "nine till
 *           two." rolls up out of its row and into the first row after "Yes, Saturdays," (word masks, never a
 *           half-reflowed layout), and the paper closes round it —
 *           top edge down, bottom edge up, the right edge out to the column's width (the title role stays the
 *           title role); the ink settles from ink to slate, the answer said by rote
 *   deal    the strips deal down into one column, one per 16th, the top strip staying (the paper riffle):
 *           the newest answer on top, the slip above tucked over the top of the one below, each casting its
 *           shadow on the next; the pad's blank sheets go to the bottom, under the fade
 *   scroll  the column rises at a reading pace — a teleprompter of the same line — rows coming up out of
 *           the lower paper fade and leaving through the upper one (many-stop masks: the mesh shows through)
 *
 * The stack lives in its own frame (stage.ts stackFrame): Repeat's desk plane at the stop, easing to the
 * screen while it is carried, and the desk plane again (relative to P1) once the camera pulls back — the
 * column is left behind in the world, still scrolling.
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, mix, mixHex, smooth, SPRING, springUnit } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { APP, measureText, meshElevation, useKitFaces } from '../../kit';
import { GRAPHITE, KB_INK } from '../../theme';
import { RECORDING_LOCAL as RL, REPEAT_LOCAL } from '../../timing';
import { ANSWER_LINES, deskLayout, slipPose as repeatSlipPose, SLIP_COUNT, type DeskLayout } from '../repeat/desk';
import { stackFrame, type Stage } from './stage';

/** slate: the answer's ink once it is a line of the recording (the callers' slate — said by rote) */
export const STRIP_INK = KB_INK.caller.paper.text;
/** the pad's ruling (scenes/repeat/Slips.tsx) */
const RULE = 'rgba(20, 10, 36, 0.075)';
/** the fold: a soft, unhurried close (ζ ≈ .9) */
const FOLD = { stiffness: 150, damping: 22, mass: 1 } as const;
/** a strip dropping into its row: a quick paper snap (ζ ≈ .76, one small settle) */
const DEAL = { stiffness: 230, damping: 23, mass: 1 } as const;
/** the teleprompter: one row per 1.2 s, easing in over 24 frames once the deal has landed */
const ROW_FRAMES = 36;
const RAMP = 24;

/** more of the same under the bottom fade (the recording runs on): enough written rows that the scroll never
 *  reaches the end of the column, in either frame — sixteen rows deep */
const MORE = 7;
/** the column's rows: [answers 3, 2, 1] on top (the newest first), the six rolls, MORE strips of the same line
 *  (they exist only in the column, under the fade, once it stands), then the pad's two blank sheets, last */
type Sheet = { row: number; kind: 'slip'; k: number } | { row: number; kind: 'more' } | { row: number; kind: 'pad'; i: number };
const SHEETS: readonly Sheet[] = [
  ...[2, 1, 0].map((k, row) => ({ row, kind: 'slip' as const, k })),
  ...Array.from({ length: SLIP_COUNT - 3 }, (_, j) => ({ row: 3 + j, kind: 'slip' as const, k: 3 + j })),
  ...Array.from({ length: MORE }, (_, j) => ({ row: SLIP_COUNT + j, kind: 'more' as const })),
  { row: SLIP_COUNT + MORE, kind: 'pad', i: 0 },
  { row: SLIP_COUNT + MORE + 1, kind: 'pad', i: 1 },
];

/** the deal: row r ≥ 1 drops on RL.fan[r] (the pad's blank sheets with the last written strip) */
const dealAt = (row: number) => RL.fan[Math.min(row, RL.fan.length - 1)];
export const scrollStart = () => RL.fan[RL.fan.length - 1] + 12;
export function scrollAt(t: number, G: Stage) {
  const x = t - scrollStart();
  if (x <= 0) return 0;
  return (G.column.pitch / ROW_FRAMES) * (x < RAMP ? (x * x) / (2 * RAMP) : x - RAMP / 2);
}

/**
 * The fold's second line ROLLS up onto the first through the house masks (never a sliding, half-reflowed layout):
 * "nine till two." leaves row two up through its word masks (EASE.in3, a frame a word), and the same words rise into
 * row one's tail after "Saturdays," on the text spring (two frames a word, the first as the second-row word is half
 * gone) — the paper's right edge already ahead of each word as it rises, its bottom edge following the leaving row up.
 */
const ROLL_OUT = { at: RL.morph + 1, step: 1, dur: 6 } as const;
const ROLL_IN = { at: RL.morph + 5, step: 2 } as const;
/** 0 → 1: how far row two has rolled out (its last word's exit), which the paper's bottom edge follows up */
const rollOut = (t: number) => EASE.inOut(Math.min(1, Math.max(0, (t - ROLL_OUT.at) / (2 * ROLL_OUT.step + ROLL_OUT.dur))));

/** a sheet's face geometry (scenes/repeat/Slips.tsx SlipFace, verbatim) */
function faceOf(g: DeskLayout, vertical: boolean) {
  const s = g.slip;
  const labelSize = typeStyle('label', vertical).fontSize as number;
  const rowH = s.size * 1.18;
  const rowsTop = s.padTop + labelSize * 1.2 + (vertical ? 20 : 22);
  return { s, labelSize, rowH, rowsTop };
}

/** a sheet's rest pose at the stop (offsets from the pad's first sheet), its stacking and its shadow */
function restOf(sh: Sheet, vertical: boolean) {
  if (sh.kind === 'more') return { dx: 0, dy: 0, rot: 0, lift: 0.6, squash: 1, origin: 'bottom' as const };
  if (sh.kind === 'slip') {
    const p = repeatSlipPose(sh.k, REPEAT_LOCAL.hardStop, vertical);
    return { dx: p.dx, dy: p.dy, rot: p.rot, lift: p.lift, squash: p.squash, origin: 'bottom' as const };
  }
  // the pad under the first sheet (Slips.tsx `sheet`): two blank sheets, their edges showing
  return sh.i === 1
    ? { dx: -1.5, dy: 10, rot: 0.35, lift: 0.3, squash: 1, origin: 'center' as const }
    : { dx: 1, dy: 5, rot: -0.2, lift: 0.12, squash: 1, origin: 'center' as const };
}

const WordAt: React.FC<{ x: number; y: number; word: string; style: React.CSSProperties }> = ({ x, y, word, style }) => (
  <span style={{ position: 'absolute', left: 0, top: 0, ...style, whiteSpace: 'nowrap', ...subpixel(`translate(${x.toFixed(3)}px, ${y.toFixed(3)}px)`, true) }}>{word}</span>
);

/** a word at (x, y) in its own mask (lib/type maskBox), revealed / leaving by `r` (held on its sub-pixel layer) */
const MaskedWordAt: React.FC<{ x: number; y: number; word: string; style: React.CSSProperties; r: ReturnType<typeof reveal> }> = ({ x, y, word, style, r }) => (
  <span style={{ position: 'absolute', left: 0, top: 0, ...style, whiteSpace: 'nowrap', ...subpixel(`translate(${x.toFixed(3)}px, ${y.toFixed(3)}px)`, true) }}>
    <span style={maskBox(0)}>
      <span style={revealStyle(r, undefined, true)}>{word}</span>
    </span>
  </span>
);

/** One sheet of the pile: Part I's pad sheet at the stop, folding to a strip of the column. */
const SheetView: React.FC<{ sh: Sheet; t: number; G: Stage; g: DeskLayout; ink: string; z: number }> = ({ sh, t, G, g, ink, z }) => {
  const L = useLayout();
  const v = L.vertical;
  const { s, labelSize, rowH, rowsTop } = faceOf(g, v);
  const rest = restOf(sh, v);
  const written = sh.kind !== 'pad';
  const more = sh.kind === 'more';
  const C = G.column;
  const [s0, s1] = RL.slide;
  // squared and lifted, then carried to the column's row 0
  const sq = smooth(s0, s0 + 12, t);
  const carry = EASE.inOut(Math.min(1, Math.max(0, (t - s0) / (s1 - s0))));
  const fold = springUnit(t - RL.morph, FOLD);
  const f = Math.min(1, fold);
  const top0 = rowsTop - C.pad; // the strip's top edge inside the sheet once folded
  const ox = more ? C.x : mix(s.x, C.x, carry);
  const oy = more ? C.top - top0 : mix(s.y, C.top - top0, carry);
  const deal = more ? 1 : sh.row === 0 ? 0 : springUnit(t - dealAt(sh.row), DEAL);
  const x = ox + rest.dx * (1 - sq);
  const y = oy + rest.dy * (1 - sq) + sh.row * C.pitch * deal - scrollAt(t, G);
  const rot = rest.rot * (1 - sq);
  const squash = 1 + (rest.squash - 1) * (1 - sq);
  // the paper: the box closes round the first ruled line
  // (its bottom edge follows the second row up as it rolls out; its right edge is ahead of every word rolling
  // into the first row's tail — the guard below never binds on the fold spring, it only keeps that true)
  const word0 = { size: s.size, weight: TYPE.title.weight, tracking: -0.02 };
  const gap0 = 0.24 * s.size;
  const w1 = ANSWER_LINES[0].map((w) => measureText(w, word0));
  const w2 = ANSWER_LINES[1].map((w) => measureText(w, word0));
  const lineEnd = w1.reduce((a, b) => a + b + gap0, 0);
  const x2 = w2.map((_, j) => w2.slice(0, j).reduce((a, b) => a + b + gap0, 0));
  let rollNeed = 0;
  ANSWER_LINES[1].forEach((_, j) => {
    if (t > ROLL_IN.at + j * ROLL_IN.step) rollNeed = s.padX * 1.5 + lineEnd + x2[j] + w2[j];
  });
  const boxTop = mix(0, top0, fold);
  const boxBot = Math.max(mix(s.h, rowsTop + rowH + C.pad, fold), written ? rowsTop + rowH * (2 - rollOut(t)) + C.pad : 0);
  const boxW = Math.max(mix(s.w, C.w, fold), written ? rollNeed : 0);
  // the shadow: the front sheet lifted while carried; the sheets behind it lie flat until they are dealt
  const lifted = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - s0) / (s1 - s0 + 6))));
  const lift = more ? 0.6 : sh.row === 0 ? mix(rest.lift, 0.6, sq) + 1.5 * lifted : mix(mix(rest.lift, 0.12, sq), 0.6, Math.min(1, deal)) + 0.9 * Math.sin(Math.PI * Math.min(1, deal));
  const radius = v ? 11 : 12;
  const origin = rest.origin === 'bottom' ? `${s.w / 2}px ${s.h}px` : `${s.w / 2}px ${s.h / 2}px`;
  const tint = sh.kind === 'pad' ? (sh.i === 1 ? '#f4f3f7' : '#fafafc') : '#ffffff';
  // the face
  const label = typeStyle('label', v, { tone: 'paper' });
  const title = typeStyle('title', v, { tone: 'paper', size: s.size });
  const dot = Math.round(labelSize * 0.3);
  const col = mixHex(APP.foreground, STRIP_INK, f);
  let face: React.ReactNode = null;
  if (written) {
    if (t < RL.morph - 5) {
      // exactly Part I's face (inline, as Slips.tsx sets it)
      face = (
        <>
          <div style={{ position: 'absolute', left: s.padX, top: s.padTop, ...label, color: GRAPHITE.tag, whiteSpace: 'nowrap' }}>
            <span style={maskBox(0)}>
              <span style={{ ...revealStyle(reveal(t, -1e6), undefined, true), display: 'inline-flex', alignItems: 'center', gap: '0.5em' }}>
                <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: GRAPHITE.tag, transform: 'translateY(-0.04em)' }} />
                FRONT DESK
              </span>
            </span>
          </div>
          <div style={{ position: 'absolute', left: s.padX, top: rowsTop, ...title, lineHeight: `${rowH}px`, color: APP.foreground }}>
            {ANSWER_LINES.map((ws, li) => (
              <div key={li} style={{ whiteSpace: 'nowrap', height: rowH }}>
                {ws.map((w, j) => (
                  <span key={j} style={maskBox(j === ws.length - 1 ? 0 : 0.24)}>
                    <span style={revealStyle(reveal(t, -1e6), undefined, true)}>{w}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </>
      );
    } else {
      // folding: the label lifts out; the second line rolls up onto the first through its masks (ROLL_OUT / ROLL_IN)
      const lab = reveal(t, -1e6, { exit: { at: RL.morph - 5, dur: 6 } });
      face = (
        <>
          {lab.opacity > 0.001 ? (
            <div style={{ position: 'absolute', left: s.padX, top: s.padTop - boxTop, ...label, color: GRAPHITE.tag, whiteSpace: 'nowrap' }}>
              <span style={maskBox(0)}>
                <span style={{ ...revealStyle(lab, undefined, true), display: 'inline-flex', alignItems: 'center', gap: '0.5em' }}>
                  <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: GRAPHITE.tag, transform: 'translateY(-0.04em)' }} />
                  FRONT DESK
                </span>
              </span>
            </div>
          ) : null}
          {(() => {
            let xx = 0;
            return ANSWER_LINES[0].map((w, j) => {
              const el = <WordAt key={`a${j}`} x={s.padX + xx} y={rowsTop - boxTop} word={w} style={{ ...title, lineHeight: `${rowH}px`, color: col }} />;
              xx += w1[j] + gap0;
              return el;
            });
          })()}
          {ANSWER_LINES[1].map((w, j) => {
            // row two: "nine till two." leaves up through its masks, a frame a word …
            const out = reveal(t, -1e6, { exit: { at: ROLL_OUT.at + j * ROLL_OUT.step, dur: ROLL_OUT.dur } });
            return out.opacity > 0.001 ? (
              <MaskedWordAt key={`b${j}`} x={s.padX + x2[j]} y={rowsTop + rowH - boxTop} word={w} style={{ ...title, lineHeight: `${rowH}px`, color: col }} r={out} />
            ) : null;
          })}
          {ANSWER_LINES[1].map((w, j) => {
            // … and rises into row one's tail after "Saturdays," on the text spring, two frames a word
            const at = ROLL_IN.at + j * ROLL_IN.step;
            if (t < at - 1) return null;
            const r = reveal(t, at, { config: SPRING.text, rise: 100, fade: 0.55 });
            return <MaskedWordAt key={`c${j}`} x={s.padX + lineEnd + x2[j]} y={rowsTop - boxTop} word={w} style={{ ...title, lineHeight: `${rowH}px`, color: col }} r={r} />;
          })}
        </>
      );
    }
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: s.w,
        height: s.h,
        zIndex: z,
        transformOrigin: origin,
        ...subpixel(`translate(${x.toFixed(3)}px, ${y.toFixed(3)}px) rotate(${rot.toFixed(4)}deg)${Math.abs(squash - 1) > 1e-5 ? ` scaleY(${squash.toFixed(5)})` : ''}`, true),
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: boxTop,
          width: boxW,
          height: boxBot - boxTop,
          borderRadius: radius,
          background: tint,
          boxShadow: meshElevation(lift, ink, written ? 0.95 : 0.9),
          overflow: 'hidden',
        }}
      >
        {written ? (
          <>
            {/* the ruling: one hairline under each row; the second is closed off by the fold */}
            {[0, 1].map((r) => (
              <div key={r} style={{ position: 'absolute', left: s.padX, right: s.padX, top: rowsTop + (r + 1) * rowH - s.size * 0.12 - boxTop, height: 1.25, background: RULE }} />
            ))}
            {face}
          </>
        ) : null}
      </div>
    </div>
  );
};

/** a many-stop smoothstep mask (screen px): transparent → opaque over [a, b], opaque → transparent over [c, d];
 *  `k` = how far the fades are in (0: none) */
function fadeMask(a: number, b: number, c: number, d: number, k: number) {
  const stops: string[] = [];
  const N = 12;
  const push = (y: number, al: number) => stops.push(`rgba(0,0,0,${(1 - k + k * al).toFixed(4)}) ${y.toFixed(2)}px`);
  for (let j = 0; j <= N; j++) {
    const u = j / N;
    push(a + (b - a) * u, u * u * (3 - 2 * u));
  }
  for (let j = 0; j <= N; j++) {
    const u = j / N;
    push(c + (d - c) * u, 1 - u * u * (3 - 2 * u));
  }
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

export const Stack: React.FC<{ t: number; G: Stage; ink: string }> = ({ t, G, ink }) => {
  useKitFaces();
  const L = useLayout();
  const g = deskLayout(L.vertical);
  const fr = stackFrame(t, G);
  const k = smooth(RL.fades[0], RL.fades[1], t);
  const yS = (y: number) => G.H / 2 + fr.s * (y - G.H / 2) + fr.ty;
  const F = G.column.fade;
  const mask = k > 0 ? fadeMask(yS(F.a), yS(F.b), yS(F.c), yS(F.d), k) : undefined;
  const n = SHEETS.length;
  return (
    <div style={{ position: 'absolute', inset: 0, ...(mask ? { WebkitMaskImage: mask, maskImage: mask } : null) }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 50%', transform: `translate(${fr.tx.toFixed(4)}px, ${fr.ty.toFixed(4)}px) scale(${fr.s.toFixed(6)})` }}>
        {SHEETS.map((sh) => {
          // cull the rows under the fades' transparent ends once the column stands
          // the rows beyond the pile exist only once the column stands (under its bottom fade)
          if (sh.kind === 'more' && k < 0.999) return null;
          if (k > 0.999) {
            const deal = sh.kind === 'more' || sh.row === 0 ? 1 : springUnit(t - dealAt(sh.row), DEAL);
            const yTop = yS(G.column.top + sh.row * G.column.pitch * deal - scrollAt(t, G));
            if (yTop > yS(F.d) + 4 || yTop + G.column.h * fr.s < yS(F.a) - 4) return null;
          }
          return <SheetView key={sh.row} sh={sh} t={t} G={G} g={g} ink={ink} z={n - sh.row} />;
        })}
      </div>
    </div>
  );
};
