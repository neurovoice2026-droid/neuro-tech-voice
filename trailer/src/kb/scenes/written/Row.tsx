/**
 * A DOCUMENT ROW of the Knowledge tab (components/agent/tabs/TabKnowledge.tsx DocumentRow: rounded-lg border p-3,
 * the kind tile, the name in font-medium, the status pill, the … trigger) — the kit's DocRow (kit/ui.tsx) rebuilt
 * so its BOX can change size while it moves: the paper and its hairline border are one SVG rect (anti-aliased at
 * its exact fractional edges every render frame; a CSS box's width paints pixel-snapped), the content is placed
 * from the left edge and the … trigger from the right, so a row can be born from a slip and widen into the list.
 *
 *   layout 'stack'   16:9: the name over the pill (the app's two-line row)
 *   layout 'inline'  9:16: one line — tile, name, the pill pushed right, …
 *
 * `morph` (0 → 1) is the slip → row change: corner radius, the border coming in, the paper's lift. With `slip` the
 * row draws b06/b07's strip of "Yes, Saturdays, nine till two." on top, leaving up through its mask at `slip.out`
 * (scenes/written/Slips.tsx hands its last slip over to this, pixel for pixel). The row's own content rises in at
 * `contentAt` (tile, name, pill — a 16th apart).
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { APP, Icon, measureText, Pill, type PillState } from '../../kit';
import type { RowKind } from './stage';

const KIND_TOKEN: Record<RowKind, string> = { pdf: 'PDF', docx: 'DOCX', txt: 'TXT', url: 'URL' };
const RULE = 'rgba(20, 10, 36, 0.075)';

export const rowPill = (size: number) => Math.max(26, Math.round(size * 0.6));

/** a soft lifted shadow for a row off the list (no crisp ring: the SVG border is the edge) */
const flightShadow = (lift: number, ink: string) => {
  const l = Math.max(0, lift);
  const c = ink;
  return [
    `0 ${(0.6 + l * 0.6).toFixed(2)}px ${(1.2 + l * 1.2).toFixed(2)}px ${c}22`,
    `0 ${(2 + l * 4).toFixed(2)}px ${(5 + l * 9).toFixed(2)}px -${(1 + l * 2).toFixed(2)}px ${c}24`,
    `0 ${(6 + l * 12).toFixed(2)}px ${(14 + l * 26).toFixed(2)}px -${(4 + l * 7).toFixed(2)}px ${c}26`,
  ].join(', ');
};

export type SlipLook = {
  /** the strip's scale against b06's strip (940 × 130 px, text 64 px) */
  k: number;
  text: string;
  color: string;
  /** the strip's text leaves up through its mask from here */
  out: number;
};

export const Row: React.FC<{
  t: number;
  x: number;
  y: number;
  w: number;
  h: number;
  layout: 'stack' | 'inline';
  /** the name size (title role) */
  size: number;
  kind: RowKind;
  name: string;
  pill?: readonly PillState[];
  /** 0 the slip's paper … 1 the row's (radius, border) */
  morph?: number;
  /** the paper's lift (0 = flat in the list: border only) and the shadow's ink (hex) */
  lift?: number;
  ink?: string;
  slip?: SlipLook;
  /** the row's content rises in from here (undefined: shown) */
  contentAt?: number;
  opacity?: number;
  scale?: number;
  moving?: boolean;
  /** the … trigger's hover / press */
  menuHover?: number;
  menuPress?: number;
  /** the slip's corner radius (b06's strip: 12 × k) */
  slipRadius?: number;
}> = ({ t, x, y, w, h, layout, size, kind, name, pill, morph = 1, lift = 0, ink = '#1e1442', slip, contentAt, opacity = 1, scale = 1, moving = false, menuHover = 0, menuPress = 0, slipRadius }) => {
  const L = useLayout();
  const v = L.vertical;
  const rRow = size * 0.32;
  const rSlip = slipRadius ?? rRow;
  const radius = rSlip + (rRow - rSlip) * morph;
  const pad = size * 0.42;
  const tokenSize = Math.max(24, Math.round(size * 0.5));
  const tile = layout === 'stack' ? size * 1.5 : size * 1.4;
  const tileW = Math.max(tile, measureText('DOCX', { size: tokenSize, weight: TYPE.label.weight, tracking: 0.08 }) + size * 0.6);
  const btn = size * 1.05;
  const pillSize = rowPill(size);
  const border = 1.25;
  const borderA = morph;
  // the content's entrance (a 16th apart): the tile and the pill settle in (a box: scale + fade, never cropped by a
  // mask), the name rises through its mask (type) — or everything shown
  const shown = (k: number) => contentAt === undefined || t >= contentAt + k * 2 - 0.5;
  const piece = (k: number, node: React.ReactNode, style: React.CSSProperties, mode: 'box' | 'type') => {
    if (!shown(k)) return null;
    if (contentAt === undefined) return <div style={{ position: 'absolute', ...style }}>{node}</div>;
    const at = contentAt + k * 2;
    if (mode === 'type') {
      const r = reveal(t, at, { rise: 90, fade: 0.5 });
      return (
        <div style={{ position: 'absolute', ...style }}>
          <span style={{ ...maskBox(0), display: 'block' }}>
            <span style={{ ...revealStyle(r, undefined, t - at < 16), display: 'block' }}>{node}</span>
          </span>
        </div>
      );
    }
    const p = springUnit(t - at, SPRING.text);
    const moving = Math.abs(1 - p) > 1e-3;
    return (
      <div
        style={{
          position: 'absolute',
          ...style,
          opacity: p >= 0.999 ? undefined : smooth(0, 0.6, p),
          transformOrigin: '0% 50%',
          ...subpixel(moving ? `translateY(${((1 - p) * 10).toFixed(3)}px) scale(${(0.94 + 0.06 * Math.min(1, p)).toFixed(5)})` : undefined, moving),
        }}
      >
        {node}
      </div>
    );
  };
  const nameNode = <div style={{ ...typeStyle('title', v, { size }), color: APP.foreground, whiteSpace: 'nowrap', lineHeight: 1.05 }}>{name}</div>;
  const pillNode = pill ? <Pill t={t} states={pill} size={pillSize} /> : null;
  const tileNode = (
    <div
      style={{
        width: tileW,
        height: tile,
        borderRadius: size * 0.24,
        background: APP.muted,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...typeStyle('label', v, { size: tokenSize }),
        letterSpacing: '0.08em',
        color: APP.mutedFg,
      }}
    >
      {KIND_TOKEN[kind]}
    </div>
  );
  const mx = w - pad - btn;
  const my = (h - btn) / 2;
  const msc = 1 - 0.03 * menuPress;
  /* ── the slip's own face (b06's strip at scale k), leaving up through its mask ── */
  let slipFace: React.ReactNode = null;
  if (slip) {
    const k = slip.k;
    const q = tween(t, [slip.out, slip.out + 5], [0, 1], EASE.in2);
    if (q < 1) {
      const sz = 64 * k;
      const rowH = sz * 1.18;
      slipFace = (
        <>
          <div style={{ position: 'absolute', left: 50 * k, right: 50 * k, top: 27 * k + rowH - sz * 0.12, height: 1.25, background: RULE, opacity: 1 - q }} />
          <div style={{ position: 'absolute', left: 50 * k, top: 27 * k, height: rowH, overflow: 'hidden' }}>
            <div
              style={{
                ...typeStyle('title', v, { tone: 'paper', size: sz }),
                lineHeight: `${rowH}px`,
                color: slip.color,
                whiteSpace: 'nowrap',
                opacity: q > 0 ? 1 - Math.min(1, q * 1.4) : undefined,
                ...subpixel(q > 0 ? `translateY(${(-q * rowH).toFixed(3)}px)` : undefined, q > 0),
              }}
            >
              {slip.text}
            </div>
          </div>
        </>
      );
    }
  }
  const tf = `translate(${x.toFixed(3)}px, ${y.toFixed(3)}px)${Math.abs(scale - 1) > 1e-5 ? ` scale(${scale.toFixed(5)})` : ''}`;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: Math.ceil(w),
        height: Math.ceil(h),
        transformOrigin: `${(w / 2).toFixed(2)}px ${(h / 2).toFixed(2)}px`,
        opacity: opacity >= 0.999 ? undefined : opacity,
        ...subpixel(tf, moving),
      }}
    >
      {lift > 0.001 ? <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: radius, boxShadow: flightShadow(lift, ink) }} /> : null}
      <svg width={Math.ceil(w) + 2} height={Math.ceil(h) + 2} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
        <rect x={0} y={0} width={Math.max(0, w)} height={Math.max(0, h)} rx={radius} ry={radius} fill={APP.card} />
        {borderA > 0.001 ? (
          <rect
            x={border / 2}
            y={border / 2}
            width={Math.max(0, w - border)}
            height={Math.max(0, h - border)}
            rx={Math.max(0, radius - border / 2)}
            ry={Math.max(0, radius - border / 2)}
            fill="none"
            stroke={APP.border}
            strokeOpacity={borderA}
            strokeWidth={border}
          />
        ) : null}
      </svg>
      {slipFace}
      {piece(0, tileNode, { left: pad, top: (h - tile) / 2 }, 'box')}
      {layout === 'stack' ? (
        <>
          {piece(1, nameNode, { left: pad * 2 + tileW, top: h / 2 - (size * 1.05 + size * 0.22 + pillSize * 1.72) / 2 }, 'type')}
          {pillNode ? piece(2, pillNode, { left: pad * 2 + tileW, top: h / 2 - (size * 1.05 + size * 0.22 + pillSize * 1.72) / 2 + size * 1.05 + size * 0.22, display: 'flex' }, 'box') : null}
        </>
      ) : (
        <>
          {piece(1, nameNode, { left: pad * 2 + tileW, top: (h - size * 1.05) / 2 }, 'type')}
          {pillNode ? piece(2, pillNode, { right: Math.ceil(w) - mx + pad * 0.6, top: (h - pillSize * 1.72) / 2, display: 'flex' }, 'box') : null}
        </>
      )}
      {shown(2) ? (
        <div
          style={{
            position: 'absolute',
            left: mx,
            top: my,
            width: btn,
            height: btn,
            borderRadius: size * 0.22,
            background: menuHover > 0.001 || menuPress > 0.001 ? `rgba(238, 235, 244, ${Math.max(menuHover, menuPress).toFixed(3)})` : undefined,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: APP.foreground,
            opacity: contentAt === undefined ? undefined : Math.min(1, Math.max(0, (t - contentAt - 4) / 5)),
            transform: Math.abs(msc - 1) > 1e-4 ? `scale(${msc.toFixed(5)})` : undefined,
          }}
        >
          <Icon name="ellipsis" size={size * 0.56} stroke={2.4} />
        </div>
      ) : null}
    </div>
  );
};
