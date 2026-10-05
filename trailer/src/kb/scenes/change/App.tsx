/**
 * BACK IN THE APP (SCRIPT.md b13; CLIENT DIRECTION v2 §2 "b13: back to Knowledge") — the agent page of b08/b12 as a
 * white panel on her mesh, on its KNOWLEDGE tab: the real tab bar (General · Conversation · Voice · Knowledge · Skills,
 * line variant, Knowledge's count badge) over "Your documents" — b08's four rows newest first (the app's upsert puts a new
 * document on top), single-line rows (written/Row.tsx), each Ready.
 *
 *   rise      while the owner types it rises BEHIND the file (a landing with no bounce, at rest before the pointer leaves
 *             for its …); the file stepping up into its corner on "Change the document" reveals it
 *   menu      the cursor presses the Opening hours row's … (hover → the trigger's muted wash, press .97); on the release
 *             the menu opens from its trigger (the kit's Menu: Read again · Replace with new file · Remove,
 *             TabKnowledge.tsx:600–618); "Replace with new file" takes its hover, is pressed and released: the menu closes
 *   replace   the slot at the top opens as the edited file drops into it (change/FilePage.tsx Flight →
 *             change/NewRow.tsx); the badge counts BOTH versions (useKnowledge's docs: 4 → 5)
 *   Ready     on "the new answer" the old row leaves up through its own mask (the old version is removed once the new
 *             one is ready — hooks/useKnowledge.ts), the slot below closes, the badge goes back to 4
 *   recede    a beat before the next call rings the panel steps back a depth (.9, shade .06) and slides away down
 *
 * Both framings draw the same tree: the panel, the tab bar, "Your documents" and the rows over it, the menu over them.
 * 9:16 (fix:change) shows the WHOLE tab as 16:9 does — the panel holds five rows whole (change/stage.ts 9:16 FULL-TAB), so
 * no row ever goes under its edge: no clip box, no soft edge.
 */
import React from 'react';
import { subpixel } from '../../../lib/glide';
import { EASE, smooth, tween } from '../../../lib/motion';
import { APP, hoverAt, Menu, Panel, pressAt, TabBar, ui, W as WT, type CursorKey, type MenuGeometry, type Rect, type TabBarGeometry } from '../../kit';
import { CHANGE_LOCAL as K } from '../../timing';
import { Row } from '../written/Row';
import { ROWS } from '../written/stage';
import { appPose, listGeo, OLD, rowSlot, type ChangeStage } from './stage';

/** b08's rows newest first (written/stage.ts ROWS: Price list, Opening hours, Cancellation policy, FAQ page) */
export const NEWEST_FIRST = [3, 2, 1, 0] as const;

/** a row's … trigger, either layout (written/Row.tsx: pad .42 × size, button 1.05 × size, vertically centred) */
export function rowMenuRect(x: number, y: number, w: number, h: number, size: number): Rect & { cx: number; cy: number } {
  const pad = size * 0.42;
  const b = size * 1.05;
  const rx = x + w - pad - b;
  const ry = y + (h - b) / 2;
  return { x: rx, y: ry, w: b, h: b, cx: rx + b / 2, cy: ry + b / 2 };
}

/** the old Opening hours row at rest, frame px (the panel settled) */
export function oldRowBox(S: ChangeStage) {
  const Lg = listGeo(S);
  return { x: Lg.x, y: Lg.listY + OLD * Lg.pitch, w: Lg.w, h: Lg.h };
}

export const AppPanel: React.FC<{ t: number; S: ChangeStage; bar: TabBarGeometry; menu: MenuGeometry; keys: readonly CursorKey[]; ink: string }> = ({ t, S, bar, menu, keys, ink }) => {
  const ap = appPose(t, S);
  if (!ap.on) return null;
  const Lg = listGeo(S);
  const P = S.panel;
  const cx = P.x + P.w / 2;
  const cy = P.y + Lg.panelH / 2;
  // (9:16's sheet comes in from the right: dx; 16:9's dx is always 0)
  const tf = Math.abs(ap.dx) + Math.abs(ap.dy) > 0.01 || ap.scale !== 1 ? `translate(${ap.dx ? `${ap.dx.toFixed(3)}px` : '0px'}, ${ap.dy.toFixed(3)}px)${ap.scale !== 1 ? ` scale(${ap.scale.toFixed(5)})` : ''}` : undefined;
  const size = S.row.size;
  const dots = oldRowBox(S);
  const dotsRect = rowMenuRect(dots.x, dots.y, dots.w, dots.h, size);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: S.W,
        height: S.H,
        transformOrigin: `${cx.toFixed(2)}px ${cy.toFixed(2)}px`,
        opacity: ap.opacity >= 0.999 ? undefined : ap.opacity,
        ...subpixel(tf, ap.moving),
      }}
    >
      <Panel x={P.x} y={P.y} w={P.w} h={Lg.panelH} radius={P.radius} lift={ap.lift} ink={ink} shade={ap.shade}>
        {null}
      </Panel>
      <TabBar bar={bar} t={t} active="knowledge" cursor={keys} radius={P.radius} />
      <div style={{ position: 'absolute', left: Lg.x, top: Lg.headY, ...ui(S.heading, WT.medium), color: APP.foreground, whiteSpace: 'nowrap' }}>Your documents</div>
      {NEWEST_FIRST.map((ri, k) => {
        const R = ROWS[ri];
        const y = Lg.listY + rowSlot(k, t) * Lg.pitch;
        const moving = (t > K.fly[0] && t < K.land + 14) || (k > OLD && t > K.oldOut + 2 && t < K.oldOut + 22) || (t > K.lift[0] && t < K.lift[0] + 20);
        const isOld = k === OLD;
        // the old version leaves up through its own slot's mask on "the new answer"
        const q = isOld ? tween(t, [K.oldOut, K.oldOut + 9], [0, 1], EASE.in3) : 0;
        if (q >= 0.999) return null;
        const row = (
          <Row
            t={t}
            x={isOld ? 0 : Lg.x}
            y={isOld ? -q * Lg.h * 0.9 : y}
            w={Lg.w}
            h={Lg.h}
            layout={S.row.layout}
            size={size}
            pillSize={S.row.pill}
            kind={R.kind}
            name={R.name}
            pill={[{ at: -1e6, kind: 'ready', n: R.n }]}
            moving={moving || q > 0}
            opacity={isOld ? 1 - smooth(0.25, 1, q) : 1}
            menuHover={isOld ? hoverAt(keys, t, { x: dotsRect.x, y: dotsRect.y + (y - dots.y), w: dotsRect.w, h: dotsRect.h }) : 0}
            menuPress={isOld ? pressAt(keys, t, dotsRect) : 0}
          />
        );
        if (!isOld) return <React.Fragment key={R.name}>{row}</React.Fragment>;
        // the old row inside its own slot (a mask box a hair larger than the row: its border is never cut at rest)
        return (
          <div key={R.name} style={{ position: 'absolute', left: Lg.x - 2, top: y - 2, width: Lg.w + 4, height: Lg.h + 4, overflow: q > 0 ? 'hidden' : undefined }}>
            <div style={{ position: 'absolute', left: 2, top: 2 }}>{row}</div>
          </div>
        );
      })}
      <Menu menu={menu} t={t} openAt={K.menu.up} closeAt={K.replace.up} cursor={keys} ink={ink} />
    </div>
  );
};
