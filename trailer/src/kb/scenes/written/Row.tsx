/**
 * A DOCUMENT ROW of the Knowledge tab (components/agent/tabs/TabKnowledge.tsx DocumentRow: rounded-lg border p-3,
 * the icon tile — size-9 rounded-md bg-muted with lucide FileText, Globe for a web page —, the name in font-medium,
 * the status pill then the muted TYPE_LABELS word (PDF · Word · Text · Web page), the … trigger) — the kit's DocRow
 * (kit/ui.tsx) rebuilt
 * so its BOX can change size while it moves: the paper and its hairline border are one SVG rect (anti-aliased at
 * its exact fractional edges every render frame; a CSS box's width paints pixel-snapped), the content is placed
 * from the left edge and the … trigger from the right, so a row can be born from a slip and widen into the list.
 *
 *   layout 'stack'   16:9: the name over the pill and its type word (the app's two-line row)
 *   layout 'inline'  9:16: one line — tile, name, the pill and its type word pushed right, …
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
import { APP, Icon, measureText, Pill, ui, W as WT, type PillState } from '../../kit';
import type { RowKind } from './stage';

/** the app's TYPE_LABELS (TabKnowledge.tsx:44–50): the muted word after the pill */
export const TYPE_LABEL: Record<RowKind, string> = { pdf: 'PDF', docx: 'Word', txt: 'Text', url: 'Web page' };
const RULE = 'rgba(20, 10, 36, 0.075)';

export const rowPill = (size: number) => Math.max(26, Math.round(size * 0.6));

/**
 * A row's face geometry (row px) for its name size / layout / height — call/Page.tsx and change/NewRow.tsx draw the
 * Opening hours row's face themselves when it unfolds into its page, from THIS, so the hand-over is the same picture.
 *   tile     the icon tile's side (a square: size-9 against the name's text-sm), its icon (size-4 in it)
 *   nameX/Y  the name's top-left; meta: the type word's size and the gap after the pill (gap-x-2)
 */
export function rowFace(size: number, layout: 'stack' | 'inline', h: number, pill?: number) {
  const pad = size * 0.42;
  const tile = layout === 'stack' ? size * 1.5 : size * 1.4;
  // the pill (and its type word): rowPill(size), or the layout's own size — 9:16's ad-size rows set the app's own
  // text-xs : text-sm ratio (12 : 14) so the status reads on a phone
  const pillSize = pill ?? rowPill(size);
  const btn = size * 1.05;
  const nameY = layout === 'stack' ? h / 2 - (size * 1.05 + size * 0.22 + pillSize * 1.72) / 2 : (h - size * 1.05) / 2;
  return { pad, tile, icon: tile * 0.46, radius: tile * 0.17, pillSize, btn, nameX: pad * 2 + tile, nameY, metaSize: pillSize, metaGap: pillSize * 0.62 };
}

/** the type word's width (row px) */
export const typeLabelWidth = (kind: RowKind, size: number) => measureText(TYPE_LABEL[kind], { size, weight: WT.regular });

/** the icon tile: the app's muted square with FileText (Globe for a web page) */
export const KindTile: React.FC<{ kind: RowKind; side: number; icon: number; radius: number; style?: React.CSSProperties }> = ({ kind, side, icon, radius, style }) => (
  <div style={{ width: side, height: side, borderRadius: radius, background: APP.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', color: APP.mutedFg, ...style }}>
    <Icon name={kind === 'url' ? 'globe' : 'fileText'} size={icon} stroke={2} />
  </div>
);

/** the type word (text-xs, muted) */
export const TypeLabel: React.FC<{ kind: RowKind; size: number }> = ({ kind, size }) => (
  <span style={{ ...ui(size, WT.regular), color: APP.mutedFg, whiteSpace: 'nowrap', lineHeight: 1 }}>{TYPE_LABEL[kind]}</span>
);

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
  /** the pill's size (default rowPill(size)) */
  pillSize?: number;
}> = ({ t, x, y, w, h, layout, size, kind, name, pill, morph = 1, lift = 0, ink = '#1e1442', slip, contentAt, opacity = 1, scale = 1, moving = false, menuHover = 0, menuPress = 0, slipRadius, pillSize: pillAt }) => {
  const L = useLayout();
  const v = L.vertical;
  const rRow = size * 0.32;
  const rSlip = slipRadius ?? rRow;
  const radius = rSlip + (rRow - rSlip) * morph;
  const F = rowFace(size, layout, h, pillAt);
  const { pad, tile, btn, pillSize } = F;
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
  // the pill, then the type word (gap-x-2): a flex row, so the word follows the pill's width as it rolls
  const pillNode = pill ? (
    <>
      <Pill t={t} states={pill} size={pillSize} />
      <span style={{ display: 'inline-block', width: F.metaGap }} />
      <TypeLabel kind={kind} size={F.metaSize} />
    </>
  ) : null;
  const tileNode = <KindTile kind={kind} side={tile} icon={F.icon} radius={F.radius} />;
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
          {piece(1, nameNode, { left: F.nameX, top: F.nameY }, 'type')}
          {pillNode ? piece(2, pillNode, { left: F.nameX, top: F.nameY + size * 1.05 + size * 0.22, height: pillSize * 1.72, display: 'flex', alignItems: 'center' }, 'box') : null}
        </>
      ) : (
        <>
          {piece(1, nameNode, { left: F.nameX, top: F.nameY }, 'type')}
          {pillNode ? piece(2, pillNode, { right: Math.ceil(w) - mx + pad * 0.6, top: (h - pillSize * 1.72) / 2, height: pillSize * 1.72, display: 'flex', alignItems: 'center' }, 'box') : null}
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
