/**
 * THE OWNER'S OWN FILE (SCRIPT.md b13) — "Opening hours.txt" on plain paper: the file name in Geist Mono at the top (the
 * same name its row reads in the app, plus the extension — the app names a document by its file), the heading and the
 * site's three sample lines in the title role with tabular figures, NO app chrome (there is no in-app editor: the edit
 * happens outside the app). The kit's DocPage layout (useDocPage, fileName mode), drawn here so the edit can follow the
 * real cursor:
 *
 *   entrance the paper eases in (change/stage.ts filePose) and its words rise INSIDE it as it settles — file name,
 *            heading, the three lines a frame apart, the rule drawing — so the paper is never seen empty
 *   caret    the I-beam presses on "14:00": the caret clicks in at the press point (the script's "caret clicks in")
 *   drag     the selection follows the pointer across the digits, a character at a time (an editor's selection snaps
 *            to characters), as a flat sunday wash at 12 % — released over the end of "00"
 *   keys     "16:00" typed over it, one key per 16th, IN PLACE as an editor shows keystrokes (kit/typed.ts: no travel,
 *            a one-frame appearance, done on the key's frame): the selected "14:00" and its wash go as "1" comes, in the same
 *            frame; the caret is the pen after the last half-visible character (never ahead of the text), solid while
 *            typing, blinking on the beat once idle
 *   park     the file steps up into the corner over the app (a transform about its top-left: one layer, sub-pixel)
 *   flight   on "Replace with new file" the parked file DROPS INTO THE LIST: its paper becomes the new row's (box, corner,
 *            the row's hairline border coming in, its lift settling to 0) while its words fade out early and the row's
 *            own face (tile, name, Reading…, Text, …) fades in over the flight's last stretch — the box is never empty
 *            when it touches the list; at the landing the row (change/NewRow.tsx) takes over pixel for pixel
 *
 * THE EDITED LINE IS LAID OUT BY THE BROWSER, NOT BY MEASUREMENT (critic fix, build B): the old "14:00", the typed
 * characters and the caret are inline in a copy of the line's own text flow ("Saturday · 9:00–" + …, the title role with
 * tabular figures), so every glyph sits on exactly the pen position the static line — and b14's page, which sets
 * "Saturday · 9:00–16:00" as one string — gives it: no stray space after the en dash, the same spacing in every shot.
 */
import React from 'react';
import { Easing } from 'remotion';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { typeStyle } from '../../../lib/type';
import { APP, cursorPos, meshElevation, ui, type CursorKey, type DocPageGeometry } from '../../kit';
import { CHANGE_LOCAL as K } from '../../timing';
import { RowFace } from './NewRow';
import { filePose, lerp, type ChangeStage } from './stage';

export const FILE_NAME = 'Opening hours.txt';
export const FILE_LINES = ['Monday to Friday · 8:00–20:00', 'Saturday · 9:00–14:00', 'Sunday · closed'] as const;
/** the edit: line 1, "14:00" → "16:00" */
export const EDIT = { line: 1, find: '14:00', replace: '16:00' } as const;

/**
 * A typed character's appearance (kit/typed.ts's one-frame ramp, IN PLACE — no travel): here it ends ON the first
 * 30 fps frame at or after its key, so every timeline frame shows the line either before or after a keystroke (never a
 * half-drawn glyph or a half-gone selection); at 120 fps it is the four render frames before that.
 */
const keyDone = (key: number) => Math.ceil(key - 1e-6);
const keyOpacity = (t: number, key: number) => smooth(keyDone(key) - 1, keyDone(key), t);
/** how many characters are at least half drawn at t: the caret sits after the last of them */
const keyCount = (t: number, keys: readonly number[]) => keys.filter((k) => t >= keyDone(k) - 0.5).length;

/** the lines' CSS (the title role, tabular figures, the house tracking) — the one style every measure and flow uses */
const lineStyle = (size: number, vertical: boolean): React.CSSProperties => ({
  ...typeStyle('title', vertical, { size, tabular: true }),
  letterSpacing: '-0.02em',
  whiteSpace: 'nowrap',
});

/**
 * The DOM's own measure of a run in the lines' style (width = the pen advance after it, its tracking included; height
 * = the inline content area): a hidden span, read synchronously, cached once the face has loaded. Used only to aim the
 * cursor (where the I-beam presses, which character the drag is over) — the glyphs themselves are laid out by the flow.
 */
const domCache = new Map<string, { w: number; h: number }>();
function domMeasure(text: string, size: number, vertical: boolean): { w: number; h: number } {
  const key = `${vertical ? 'v' : 'h'}|${size}|${text}`;
  const hit = domCache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return { w: text.length * size * 0.5, h: size * 1.2 };
  const st = lineStyle(size, vertical);
  const span = document.createElement('span');
  Object.assign(span.style, {
    position: 'absolute',
    left: '-10000px',
    top: '0px',
    visibility: 'hidden',
    whiteSpace: 'pre',
    fontFamily: String(st.fontFamily),
    fontSize: `${size}px`,
    fontWeight: String(st.fontWeight),
    letterSpacing: '-0.02em',
    lineHeight: String(st.lineHeight),
    fontVariantNumeric: 'tabular-nums',
    fontKerning: 'normal',
  } as Partial<CSSStyleDeclaration>);
  span.textContent = text;
  document.body.appendChild(span);
  const r = span.getBoundingClientRect();
  document.body.removeChild(span);
  const m = { w: r.width, h: r.height };
  if (document.fonts.check(`${String(st.fontWeight)} ${size}px ${String(st.fontFamily)}`, text)) domCache.set(key, m);
  return m;
}

/** the edit's geometry (card-local px at scale 1): the prefix, each character boundary of "14:00" (DOM pens) */
export function editGeo(g: DocPageGeometry, vertical: boolean) {
  const size = g.spec.size;
  const ln = FILE_LINES[EDIT.line];
  const k = ln.indexOf(EDIT.find);
  const pre = ln.slice(0, k);
  const r = g.lineRects[EDIT.line];
  const lx = r.x - g.card.x;
  const preW = domMeasure(pre, size, vertical).w;
  const x0 = lx + preW;
  const bounds = Array.from({ length: EDIT.find.length + 1 }, (_, i) => lx + domMeasure(pre + EDIT.find.slice(0, i), size, vertical).w);
  return { pre, preW, lx, x0, bounds, y: r.y - g.card.y, h: r.h, cy: r.cy - g.card.y, content: domMeasure(pre, size, vertical).h };
}

/** frame px of the drag's ends (the page at rest): where the I-beam presses and where it lets go. It presses JUST LEFT
 *  of "14" (a real drag starts before the first character: the stem .18 em before the pen, on the dash, so the I-beam
 *  never sits on the digits being edited — polish round 2); the selection still snaps from the "1" (Content: a
 *  character joins it once the hotspot passes its middle) */
export function dragPoints(g: DocPageGeometry, vertical: boolean) {
  const e = editGeo(g, vertical);
  const ox = g.card.x;
  const oy = g.card.y;
  return { start: { x: ox + e.bounds[0] - 0.18 * g.spec.size, y: oy + e.cy }, end: { x: ox + e.bounds[e.bounds.length - 1] - 1, y: oy + e.cy + 1 } };
}

/** the page's words (card-local, scale 1) at t: the file name, the heading, the rule, the lines with the live edit */
const Content: React.FC<{ g: DocPageGeometry; t: number; keys: readonly CursorKey[]; accent: string; caretOn: number }> = ({ g, t, keys, accent, caretOn }) => {
  const L = useLayout();
  const v = L.vertical;
  const size = g.spec.size;
  const pad = g.pad;
  const ox = g.card.x;
  const oy = g.card.y;
  const e = editGeo(g, v);
  const LS = lineStyle(size, v);
  const lineHpx = size * (TYPE_LH as number);
  const typedN = keyCount(t, K.keys);
  // the selection: from the press, following the pointer a character at a time; the whole word once released
  let selN = 0;
  if (t >= K.drag.down && t < keyDone(K.keys[0])) {
    if (t >= K.drag.up) selN = EDIT.find.length;
    else {
      const px = cursorPos(keys, t).x - ox;
      for (let i = 1; i < e.bounds.length; i++) if (px >= (e.bounds[i - 1] + e.bounds[i]) / 2) selN = i;
    }
  }
  // the selected word and its wash go as the first key's character comes (in place, the same one-frame ramp)
  const oldO = 1 - keyOpacity(t, K.keys[0]);
  // the caret: at the press point (before a selection exists), then after the last half-visible typed character
  const caretShown = t >= K.drag.down && caretOn > 0.001 && (selN === 0 || typedN > 0);
  const idleFrom = K.keys[K.keys.length - 1] + 8;
  const ph = (((t - idleFrom) % 30) + 30) % 30;
  const blink = t >= idleFrom ? (ph < 15 ? 1 : 1 - smooth(15, 16.5, ph)) : 1;
  const caret = caretShown ? (
    // out of flow (absolute, horizontal position = its static position: the pen) — it never moves a glyph
    <span style={{ position: 'absolute', top: size * 0.03, marginLeft: size * 0.025, width: Math.max(2, size * 0.05), height: size * 1.1, background: APP.foreground, opacity: blink * caretOn }} />
  ) : null;
  // the wash's box (12 % sunday) over the selected characters: its sides from their own inline box, its top and height
  // set against the line (the inline box's content area sits half-leading into the line box)
  const washTop = -size * 0.02 - (lineHpx - e.content) / 2;
  // the entrance (the paper eases in first): each block rises through its own mask — file name, heading, the rule
  // draws, the three lines a frame apart, all while the paper is still settling (house type: never a fade of text over
  // text, never an empty paper)
  const m = size * 0.34;
  const entering = t < K.page[0] + 22;
  const enterAt = (k: number): number | null => (entering ? K.page[0] - 0.5 + 0.5 * k : null);
  const block = (k: number, top: number, h: number, node: React.ReactNode, key: string | number) => {
    const at = enterAt(k);
    if (at === null) return <React.Fragment key={key}>{node}</React.Fragment>;
    if (t < at - 0.5) return null;
    const sp = springUnit(t - at, SPRING.caption);
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
  const ruleP = entering ? tween(t, [K.page[0] + 1, K.page[0] + 9], [0, 1], EASE.draw) : 1;
  const nameTop = pad;
  const headTop = pad + size * 0.62 * 1.6;
  const lineH = size * 1.18;
  const r1 = g.lineRects[EDIT.line];
  const at1 = { position: 'absolute' as const, left: r1.x - ox, top: r1.y - oy, ...LS };
  return (
    <>
      {block(0, nameTop, size * 0.62 * 1.3, <div style={{ position: 'absolute', left: pad, top: nameTop, ...ui(size * 0.62, 460, { mono: true }), color: APP.mutedFg, whiteSpace: 'nowrap' }}>{FILE_NAME}</div>, 'name')}
      {block(
        1,
        headTop,
        size * 1.08 * 1.12,
        <div style={{ position: 'absolute', left: pad, top: headTop, ...typeStyle('title', v, { size: size * 1.08, weight: 560 }), color: APP.foreground, whiteSpace: 'nowrap' }}>Opening hours</div>,
        'head',
      )}
      {ruleP > 0 ? <div style={{ position: 'absolute', left: pad, width: (g.card.w - 2 * pad) * ruleP, top: g.lineRects[0].y - oy - size * 0.55, height: 1.25, background: APP.border }} /> : null}
      {FILE_LINES.map((ln, i) => {
        const r = g.lineRects[i];
        if (i !== EDIT.line) {
          return block(2 + i, r.y - oy, lineH, <div style={{ position: 'absolute', left: r.x - ox, top: r.y - oy, ...LS, color: APP.foreground }}>{ln}</div>, i);
        }
        return block(
          2 + i,
          r.y - oy,
          lineH,
          <>
            {/* the selection wash, in a copy of the flow (the prefix hidden, the selected characters hidden) */}
            {selN > 0 && oldO > 0.001 ? (
              <div style={{ ...at1, color: 'transparent' }} aria-hidden>
                {e.pre}
                <span style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: -size * 0.04, right: -size * 0.04, top: washTop, height: size * 1.22, borderRadius: size * 0.08, background: accent, opacity: 0.12 * oldO }} />
                  {EDIT.find.slice(0, selN)}
                </span>
              </div>
            ) : null}
            {/* the old "14:00", in the flow after a hidden copy of the prefix: in place until the first key replaces it */}
            {oldO > 0.001 ? (
              <div style={{ ...at1, color: APP.foreground }}>
                <span style={{ visibility: 'hidden' }}>{e.pre}</span>
                <span style={{ opacity: oldO < 0.999 ? oldO : undefined }}>{EDIT.find}</span>
              </div>
            ) : null}
            {/* the live line: the prefix, the typed characters in place (a one-frame appearance each), the caret */}
            <div style={{ ...at1, color: APP.foreground }}>
              {e.pre}
              {EDIT.replace.split('').map((ch, j) => {
                const o = keyOpacity(t, K.keys[j]);
                const c = j === typedN - 1 ? caret : null;
                if (o <= 0.001) return null;
                return (
                  <React.Fragment key={j}>
                    <span style={{ opacity: o >= 0.999 ? undefined : o }}>{ch}</span>
                    {c}
                  </React.Fragment>
                );
              })}
              {typedN === 0 ? caret : null}
            </div>
          </>,
          i,
        );
      })}
    </>
  );
};

/** the title role's line height (theme.ts TYPE.title.lineHeight) */
const TYPE_LH = typeStyle('title', false).lineHeight;

/** The file: easing in, edited, stepping up into its corner (until the flight takes it). */
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
 * file's words (scaled with the paper's height) fade out over the first 30 %; the row's own face fades in from 20 % to
 * 50 % as the paper widens into a row (the box is never empty when it reaches the list), laid out for the row and
 * carried by the box's right edge (its right-hand group on its own sub-pixel layer) — at the landing it IS the row.
 */
export const Flight: React.FC<{
  t: number;
  S: ChangeStage;
  g: DocPageGeometry;
  keys: readonly CursorKey[];
  row: { x: number; y: number; w: number; h: number; radius: number };
  size: number;
  ink: string;
  accent: string;
}> = ({ t, S, g, keys, row, size, ink, accent }) => {
  if (t < K.fly[0] || t >= K.fly[1]) return null;
  const u = flightAt(t);
  const pose = filePose(K.fly[0], S, g.card.h);
  // its centre travels on the drop — down first (it is below the list's heading before it spreads), across after; it
  // flattens early and widens late: a card leaving its corner, a row in the list
  const cx = lerp(pose.x + pose.w / 2, row.x + row.w / 2, u);
  const cy = lerp(pose.y + pose.h / 2, row.y + row.h / 2, EASE.out3(u));
  const w = lerp(pose.w, row.w, smooth(0.1, 0.6, u));
  const h = lerp(pose.h, row.h, smooth(0, 0.55, u));
  const x = cx - w / 2;
  const y = cy - h / 2;
  const radius = lerp(g.spec.size * 0.22 * pose.k, row.radius, u);
  const lift = lerp(pose.lift, 0, u) + 1.4 * Math.sin(Math.PI * u);
  const border = smooth(0.35, 0.9, u);
  const wordsO = 1 - smooth(0, 0.3, u);
  const faceO = smooth(0.2, 0.5, u);
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
      {faceO > 0.001 ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', borderRadius: radius }}>
          <RowFace t={t} rowW={row.w} rowH={row.h} h={h} shift={w - row.w} size={size} opacity={faceO} />
        </div>
      ) : null}
    </div>
  );
};
