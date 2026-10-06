/**
 * REEL 4 · THE PRICE LIST (docs/ig/SCRIPT.md ig4 b1–b6): the sample studio's own document on paper — the site's sample
 * knowledge base (lib/pages/knowledge-base.ts ROOM.docs "prices": "Price list", PDF, its three lines), headed
 * "Northside Studio · Price list" so "$85" reads as the sample's price (production fix), in the kit's DocPage idiom
 * (white paper, the mesh-tinted elevation, the kind token in the label role, a hairline rule, the lines as 44 px objects
 * with tabular figures) — set as a real price list: the service and its length on the left, the price in a right-hand
 * column (each line is the site's "Sports massage · 60 min · $85" with its second dot as the column gap).
 *
 * The heading is 32 px (app chrome, never heading-size: it is not spoken). Every part is a pure function of `t`:
 *   pose      its top-left and scale (layout.ts PagePose); a 0.3 % breathing float about its centre on frame 0 (b1)
 *   sweep     b2–b4: the flat sunday band under the target line, drawn on the first landing (EASE.draw), one step
 *             darker per landing (12 % at the third)
 *   price     b5: the line's "$85" takes her teal on "eighty-five" (a glint that settles into the sunday ink)
 *   fade      b6: the content goes as the paper folds into its row
 * It reports its text to the zone guard.
 */
import React from 'react';
import { subpixel } from '../../lib/glide';
import { EASE, mixHex, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { APP, meshElevation, meshShadowInk, measureText, ui, useKitFaces, W } from '../../kb/kit';
import { KB_MESH, MOMENT_LIGHTS } from '../../kb/palettes';
import { ZoneRect } from '../components/ZoneGuard';
import { PAGE, PAGE_H, rowTop, TARGET_ROW, type PagePose } from './layout';

const SUNDAY = MOMENT_LIGHTS.sunday;
/** the site's sample lines (knowledge-base.ts ROOM.docs prices): service · length | price */
export const PRICE_LINES = [
  { item: 'Sports massage · 30 min', price: '$50' },
  { item: 'Sports massage · 60 min', price: '$85' },
  { item: 'Physio assessment · 45 min', price: '$95' },
] as const;
export const PAGE_KIND = 'PDF';
export const PAGE_TITLE = 'Northside Studio · Price list';

/** the sweep's alpha after n landings (0 before the first) */
const SWEEP_STEPS = [0, 0.05, 0.085, 0.12];

export type PriceListProps = {
  t: number;
  pose: PagePose;
  /** the pose is moving (the page rides its sub-pixel layer) */
  moving?: boolean;
  /** breathing amount 0..1 (b1: the page's 0.3 % float about its centre) */
  breathe?: number;
  /** the landings (b2–b4): the sweep draws on the first, a step darker on each */
  lands?: readonly number[];
  /** "eighty-five": the price takes her teal */
  priceAt?: number;
  /** the content's opacity (b6: it goes as the paper folds into its row) */
  fade?: number;
  opacity?: number;
  /** a shade over the paper (stepping back) */
  shade?: number;
  zone?: boolean;
};

export const PriceList: React.FC<PriceListProps> = ({ t, pose, moving = false, breathe = 0, lands = [], priceAt, fade = 1, opacity = 1, shade = 0, zone = true }) => {
  const ready = useKitFaces();
  if (opacity <= 0.002) return null;
  // the breath: 0.3 % about the page's centre, a 3 s sine
  const b = 1 + 0.003 * breathe * Math.sin((t / 90) * Math.PI * 2);
  const cx = PAGE.w / 2;
  const cy = PAGE_H / 2;
  const S = pose.s * b;
  const X = pose.x + pose.s * cx * (1 - b);
  const Y = pose.y + pose.s * cy * (1 - b);
  const live = moving || breathe > 0.001;
  const tf = `translate(${X.toFixed(3)}px, ${Y.toFixed(3)}px)${Math.abs(S - 1) > 1e-6 ? ` scale(${S.toFixed(6)})` : ''}`;
  const title = typeStyle('title', true, { size: PAGE.size, tabular: true });
  const label = typeStyle('label', true, { tone: 'paper', size: 28 });
  // the sweep: drawn on the first landing, a step darker on each
  const n = lands.filter((f) => t >= f).length;
  const draw = lands.length ? tween(t, [lands[0], lands[0] + 15], [0, 1], EASE.draw) : 0;
  const last = n ? lands[n - 1] : 0;
  const alpha = n ? SWEEP_STEPS[n - 1] + (SWEEP_STEPS[n] - SWEEP_STEPS[n - 1]) * tween(t, [last, last + 6], [0, 1], EASE.out3) : 0;
  const sweepY = rowTop(TARGET_ROW) - PAGE.size * 0.04;
  const sweepH = PAGE.size * 1.26;
  // the price's ink: graphite → a glint of her light → the sunday ink
  const priceInk = (i: number) => {
    if (i !== TARGET_ROW || priceAt === undefined || t < priceAt - 1) return APP.foreground;
    const up = tween(t, [priceAt - 1, priceAt + 1], [0, 1], EASE.out3);
    const settle = tween(t, [priceAt + 1, priceAt + 14], [0, 1], EASE.inOut);
    return settle <= 0 ? mixHex(APP.foreground, SUNDAY.orb[2], up) : mixHex(SUNDAY.orb[2], SUNDAY.ink, settle);
  };
  const ink = meshShadowInk(KB_MESH);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: PAGE.w,
          height: PAGE_H,
          borderRadius: 14,
          background: APP.card,
          boxShadow: meshElevation(3, ink),
          opacity: opacity >= 0.999 ? undefined : opacity,
          transformOrigin: '0 0',
          ...subpixel(tf, live),
        }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: fade >= 0.999 ? undefined : fade }}>
          <div style={{ position: 'absolute', left: PAGE.pad, top: PAGE.kindY, ...label, lineHeight: 1.2, color: APP.mutedFg }}>{PAGE_KIND}</div>
          <div style={{ position: 'absolute', left: PAGE.pad, top: PAGE.headY, ...ui(PAGE.headSize, W.semibold, { tracking: -0.01 }), lineHeight: 1.25, color: APP.foreground }}>{PAGE_TITLE}</div>
          <div style={{ position: 'absolute', left: PAGE.pad, right: PAGE.pad, top: PAGE.ruleY, height: 1.25, background: APP.border }} />
          {draw > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: PAGE.pad - PAGE.size * 0.22,
                top: sweepY,
                width: PAGE.w - 2 * PAGE.pad + PAGE.size * 0.44,
                height: sweepH,
                borderRadius: PAGE.size * 0.18,
                background: SUNDAY.orb[2],
                opacity: alpha,
                clipPath: `inset(0 ${((1 - draw) * 100).toFixed(3)}% 0 0 round ${(PAGE.size * 0.18).toFixed(1)}px)`,
              }}
            />
          ) : null}
          {PRICE_LINES.map((ln, i) => (
            <React.Fragment key={i}>
              <div style={{ position: 'absolute', left: PAGE.pad, top: rowTop(i), ...title, lineHeight: 1.18, letterSpacing: '-0.02em', color: APP.foreground, whiteSpace: 'nowrap' }}>{ln.item}</div>
              <div style={{ position: 'absolute', right: PAGE.pad, top: rowTop(i), ...title, lineHeight: 1.18, letterSpacing: '-0.02em', color: priceInk(i), whiteSpace: 'nowrap', textAlign: 'right' }}>{ln.price}</div>
            </React.Fragment>
          ))}
        </div>
        {shade > 0.001 ? <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: `rgba(20, 10, 36, ${shade.toFixed(4)})` }} /> : null}
      </div>
      {zone && ready && fade > 0.5 && opacity > 0.5 ? (
        <ZoneRect what="price list text" rect={{ x: X + PAGE.pad * S, y: Y + PAGE.kindY * S, w: (PAGE.w - 2 * PAGE.pad) * S, h: (rowTop(2) + PAGE.size * 1.18 - PAGE.kindY) * S }} />
      ) : null}
    </>
  );
};

/** the width of a line's left text (page px; needs the faces) */
export const itemWidth = (i: number) => measureText(PRICE_LINES[i].item, { size: PAGE.size, weight: 480, tracking: -0.02 });
