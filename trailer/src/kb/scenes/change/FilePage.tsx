/**
 * THE OWNER'S OWN FILE (SCRIPT.md b13) — opening-hours.txt on plain paper: the file name in Geist Mono at the top, the
 * heading and the site's three sample lines in the title role with tabular figures, NO app chrome (there is no in-app
 * editor: the edit happens outside the app). The kit's DocPage layout (useDocPage, fileName mode), drawn here so the
 * edit can follow the real cursor:
 *
 *   caret    the I-beam presses on "14:00": the caret clicks in at the press point (the script's "caret clicks in")
 *   drag     the selection follows the pointer across the digits, a character at a time (an editor's selection snaps
 *            to characters), as a flat sunday wash at 12 % — released over the end of "00"
 *   keys     "16:00" typed over it, one key per 16th, IN PLACE as an editor shows keystrokes (kit/typed.ts: no travel,
 *            a one-frame appearance centred on the key): the selected "14:00" and its wash go as "1" comes, in the same
 *            frame; the caret is the pen after the last half-visible character (never ahead of the text), solid while
 *            typing, blinking on the beat once idle
 *   park     the file steps up into the corner over the app (a transform about its top-left: one layer, sub-pixel)
 *   flight   on "Replace with new file" the parked file DROPS INTO THE LIST: its paper becomes the new row's (box, corner,
 *            the row's hairline border coming in, its lift settling to 0) while its words fade out early — at the
 *            landing the row (change/NewRow.tsx) takes over pixel for pixel
 */
import React from 'react';
import { Easing } from 'remotion';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { APP, cursorPos, measureText, meshElevation, typedOpacity, ui, type CursorKey, type DocPageGeometry } from '../../kit';
import { CHANGE_LOCAL as K } from '../../timing';
import { filePose, lerp, type ChangeStage } from './stage';

export const FILE_NAME = 'opening-hours.txt';
export const FILE_LINES = ['Monday to Friday · 8:00–20:00', 'Saturday · 9:00–14:00', 'Sunday · closed'] as const;
/** the edit: line 1, "14:00" → "16:00" */
export const EDIT = { line: 1, find: '14:00', replace: '16:00' } as const;

const titleSpec = (size: number) => ({ size, weight: TYPE.title.weight, tracking: -0.02 });
/** the lines are set with TABULAR figures (every digit on the advance of "0"); the canvas measure is proportional — so a
 *  run is measured with its digits as zeros (the edit's caret, characters and selection then sit exactly on the type) */
const tabW = (text: string, size: number) =>
  // used as a PREFIX's advance: the DOM also tracks after its last glyph (the kit's measure leaves that one out)
  text ? measureText(text.replace(/[0-9]/g, '0'), titleSpec(size)) - 0.02 * size : 0;

/** the edit's geometry (card-local px at scale 1): the prefix width, each character boundary of "14:00", the typed text */
export function editGeo(g: DocPageGeometry) {
  const size = g.spec.size;
  const ln = FILE_LINES[EDIT.line];
  const k = ln.indexOf(EDIT.find);
  const pre = ln.slice(0, k);
  const preW = tabW(pre, size);
  const r = g.lineRects[EDIT.line];
  const x0 = r.x - g.card.x + preW;
  const bounds = Array.from({ length: EDIT.find.length + 1 }, (_, i) => x0 + tabW(EDIT.find.slice(0, i), size));
  return { pre, preW, x0, bounds, y: r.y - g.card.y, h: r.h, cy: r.cy - g.card.y };
}

/** frame px of the drag's ends (the page at rest): where the I-beam presses and where it lets go */
export function dragPoints(g: DocPageGeometry) {
  const e = editGeo(g);
  const ox = g.card.x;
  const oy = g.card.y;
  return { start: { x: ox + e.bounds[0] + 2, y: oy + e.cy }, end: { x: ox + e.bounds[e.bounds.length - 1] - 1, y: oy + e.cy + 1 }, typedEnd: { x: ox + e.x0 + tabW(EDIT.replace, g.spec.size), y: oy + e.cy } };
}

/** the page's words (card-local, scale 1) at t: the file name, the heading, the rule, the lines with the live edit */
const Content: React.FC<{ g: DocPageGeometry; t: number; keys: readonly CursorKey[]; accent: string; caretOn: number }> = ({ g, t, keys, accent, caretOn }) => {
  const L = useLayout();
  const size = g.spec.size;
  const pad = g.pad;
  const ox = g.card.x;
  const oy = g.card.y;
  const e = editGeo(g);
  const title = typeStyle('title', L.vertical, { size, tabular: true });
  const typedN = K.keys.filter((f) => f <= t).length;
  // the selection: from the press, following the pointer a character at a time; the whole word once released
  let selN = 0;
  if (t >= K.drag.down && typedN === 0) {
    if (t >= K.drag.up) selN = EDIT.find.length;
    else {
      const px = cursorPos(keys, t).x - ox;
      for (let i = 1; i < e.bounds.length; i++) if (px >= (e.bounds[i - 1] + e.bounds[i]) / 2) selN = i;
    }
  }
  // the selected word and its wash go as the first key's character comes (in place, the same one-frame ramp)
  const outQ = typedOpacity(t, K.keys[0]);
  const lineH = size * 1.18;
  const sweepH = size * 1.22;
  const typedW = tabW(EDIT.replace.slice(0, typedN), size);
  // the caret: at the press point (before a selection exists), then after the typed text
  let caret: React.ReactNode = null;
  if (t >= K.drag.down && caretOn > 0.001 && (selN === 0 || typedN > 0)) {
    const cx = typedN > 0 ? e.x0 + typedW : e.bounds[0];
    const idleFrom = typedN > 0 ? K.keys[K.keys.length - 1] + 8 : Infinity;
    const ph = (((t - idleFrom) % 30) + 30) % 30;
    const blink = t >= idleFrom ? (ph < 15 ? 1 : 1 - smooth(15, 16.5, ph)) : 1;
    caret = <div style={{ position: 'absolute', left: cx + size * 0.025, top: e.y + size * 0.03, width: Math.max(2, size * 0.05), height: size * 1.1, background: APP.foreground, opacity: blink * caretOn }} />;
  }
  // the entrance (the paper is in first, opaque): each block rises through its own mask — file name, heading, the rule
  // draws, the three lines on 16ths (house type: never a fade of text over text)
  const m = size * 0.34;
  const block = (k: number, top: number, h: number, node: React.ReactNode, key: string | number) => {
    const at = enterAt(k);
    if (at === null) return <React.Fragment key={key}>{node}</React.Fragment>;
    if (t < at - 0.5) return null;
    const sp = springUnit(t - at, SPRING.text);
    const rising = Math.abs(1 - sp) > 1e-3;
    const dy = (1 - Math.min(1, sp)) * h * 0.9;
    return (
      <div key={key} style={{ position: 'absolute', left: 0, top: top - m, width: g.card.w, height: h + 2 * m, overflow: rising ? 'hidden' : undefined }}>
        <div style={{ position: 'absolute', left: 0, top: -(top - m), width: g.card.w, height: g.card.h, opacity: rising ? smooth(0, 0.5, sp) : undefined, ...subpixel(rising ? `translateY(${dy.toFixed(3)}px)` : undefined, rising) }}>
          {node}
        </div>
      </div>
    );
  };
  const enterAt = (k: number): number | null => (entering ? K.page[0] + 2 + 2 * k : null);
  const entering = t < K.page[0] + 26;
  const ruleP = entering ? tween(t, [K.page[0] + 5, K.page[0] + 16], [0, 1], EASE.draw) : 1;
  const nameTop = pad;
  const headTop = pad + size * 0.62 * 1.6;
  return (
    <>
      {block(0, nameTop, size * 0.62 * 1.3, <div style={{ position: 'absolute', left: pad, top: nameTop, ...ui(size * 0.62, 460, { mono: true }), color: APP.mutedFg, whiteSpace: 'nowrap' }}>{FILE_NAME}</div>, 'name')}
      {block(
        1,
        headTop,
        size * 1.08 * 1.12,
        <div style={{ position: 'absolute', left: pad, top: headTop, ...typeStyle('title', L.vertical, { size: size * 1.08, weight: 560 }), color: APP.foreground, whiteSpace: 'nowrap' }}>Opening hours</div>,
        'head',
      )}
      {ruleP > 0 ? <div style={{ position: 'absolute', left: pad, width: (g.card.w - 2 * pad) * ruleP, top: g.lineRects[0].y - oy - size * 0.55, height: 1.25, background: APP.border }} /> : null}
      {FILE_LINES.map((ln, i) => {
        const r = g.lineRects[i];
        if (i !== EDIT.line) {
          return block(
            2 + i,
            r.y - oy,
            lineH,
            <div style={{ position: 'absolute', left: r.x - ox, top: r.y - oy, ...title, letterSpacing: '-0.02em', color: APP.foreground, whiteSpace: 'nowrap' }}>{ln}</div>,
            i,
          );
        }
        return block(
          2 + i,
          r.y - oy,
          lineH,
          <>
            {/* the selection wash (sunday, 12 %): grows a character at a time with the drag */}
            {selN > 0 && outQ < 1 ? (
              <div
                style={{
                  position: 'absolute',
                  left: e.bounds[0] - size * 0.04,
                  top: e.y - size * 0.02,
                  width: e.bounds[selN] - e.bounds[0] + size * 0.08,
                  height: sweepH,
                  background: accent,
                  opacity: 0.12 * (1 - outQ),
                  borderRadius: size * 0.08,
                }}
              />
            ) : null}
            <div style={{ position: 'absolute', left: r.x - ox, top: r.y - oy, ...title, letterSpacing: '-0.02em', color: APP.foreground, whiteSpace: 'nowrap' }}>{e.pre}</div>
            {/* the old "14:00": in place until the first key replaces it (no travel) */}
            {outQ < 0.999 ? (
              <div style={{ position: 'absolute', left: e.x0, top: e.y, ...title, letterSpacing: '-0.02em', color: APP.foreground, whiteSpace: 'nowrap', opacity: outQ > 0.001 ? 1 - outQ : undefined }}>
                {EDIT.find}
              </div>
            ) : null}
            {/* the typed characters, IN PLACE at their pen positions: a one-frame appearance on each key */}
            {EDIT.replace.split('').map((ch, j) => {
              const o = typedOpacity(t, K.keys[j]);
              if (o <= 0.001) return null;
              const x = e.x0 + tabW(EDIT.replace.slice(0, j), size);
              return (
                <span key={j} style={{ position: 'absolute', left: x, top: r.y - oy, ...title, letterSpacing: '-0.02em', color: APP.foreground, whiteSpace: 'nowrap', opacity: o >= 0.999 ? undefined : o }}>
                  {ch}
                </span>
              );
            })}
          </>,
          i,
        );
      })}
      {caret}
    </>
  );
};

/** The file: rising in, edited, stepping up into its corner (until the flight takes it). */
export const FilePage: React.FC<{ t: number; S: ChangeStage; g: DocPageGeometry; keys: readonly CursorKey[]; ink: string; accent: string }> = ({ t, S, g, keys, ink, accent }) => {
  if (t >= K.fly[0]) return null;
  const pose = filePose(t, S, g.card.h);
  if (!pose.on) return null;
  const size = g.spec.size;
  const radius = size * 0.22;
  // the caret goes as the file is put away
  const caretOn = 1 - smooth(K.park[0], K.park[0] + 4, t);
  const tf = `translate(${pose.x.toFixed(3)}px, ${pose.y.toFixed(3)}px)${Math.abs(pose.k - 1) > 1e-5 ? ` scale(${pose.k.toFixed(5)})` : ''}`;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: g.card.w,
        height: g.card.h,
        borderRadius: radius,
        background: APP.card,
        boxShadow: meshElevation(pose.lift, ink),
        opacity: pose.opacity >= 0.999 ? undefined : pose.opacity,
        transformOrigin: '0 0',
        ...subpixel(tf, pose.moving),
      }}
    >
      <Content g={g} t={t} keys={keys} accent={accent} caretOn={caretOn} />
    </div>
  );
};

/** the flight's progress (0 → 1, landing exactly at K.land): a drop that eases in and settles */
const FLIGHT = Easing.bezier(0.45, 0, 0.2, 1);
export const flightAt = (t: number) => FLIGHT(Math.min(1, Math.max(0, (t - K.fly[0]) / (K.fly[1] - K.fly[0]))));

/**
 * The flight: the parked file's paper → the new row's box (frame px, the list's top slot). One SVG rect (exact at every
 * fractional edge), its corner easing to the row's, the row's hairline border coming in, its lift settling to 0; the
 * file's words (scaled with the paper's height) fade out over the first 40 %.
 */
export const Flight: React.FC<{
  t: number;
  S: ChangeStage;
  g: DocPageGeometry;
  keys: readonly CursorKey[];
  row: { x: number; y: number; w: number; h: number; radius: number };
  ink: string;
  accent: string;
}> = ({ t, S, g, keys, row, ink, accent }) => {
  if (t < K.fly[0] || t >= K.fly[1]) return null;
  const u = flightAt(t);
  const pose = filePose(K.fly[0], S, g.card.h);
  // its centre travels on the drop; it flattens early and widens late — a card crossing the tab bar, a row in the list
  const cx = lerp(pose.x + pose.w / 2, row.x + row.w / 2, u);
  const cy = lerp(pose.y + pose.h / 2, row.y + row.h / 2, u);
  const w = lerp(pose.w, row.w, smooth(0.45, 1, u));
  const h = lerp(pose.h, row.h, smooth(0, 0.65, u));
  const x = cx - w / 2;
  const y = cy - h / 2;
  const radius = lerp(g.spec.size * 0.22 * pose.k, row.radius, u);
  const lift = lerp(pose.lift, 0, u) + 1.4 * Math.sin(Math.PI * u);
  const border = smooth(0.35, 0.9, u);
  const wordsO = 1 - smooth(0, 0.4, u);
  const k = pose.k * Math.min(w / pose.w, h / pose.h);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, ...subpixel(`translate(${x.toFixed(3)}px, ${y.toFixed(3)}px)`, true) }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: radius, boxShadow: lift > 0.01 ? meshElevation(lift, ink, Math.min(1, lift / 1.2)) : undefined }} />
      <svg width={Math.ceil(w) + 2} height={Math.ceil(h) + 2} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
        <rect x={0} y={0} width={w} height={h} rx={radius} ry={radius} fill={APP.card} />
        {border > 0.001 ? <rect x={0.625} y={0.625} width={Math.max(0, w - 1.25)} height={Math.max(0, h - 1.25)} rx={Math.max(0, radius - 0.6)} fill="none" stroke={APP.border} strokeWidth={1.25} strokeOpacity={border} /> : null}
      </svg>
      {wordsO > 0.001 ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', borderRadius: radius }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: g.card.w, height: g.card.h, transformOrigin: '0 0', transform: `scale(${k.toFixed(5)})`, opacity: wordsO }}>
            <Content g={g} t={t} keys={keys} accent={accent} caretOn={0} />
          </div>
        </div>
      ) : null}
    </div>
  );
};
