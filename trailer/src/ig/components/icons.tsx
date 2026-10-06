/**
 * THE REELS' OWN LUCIDE ICONS (docs/ig/SCRIPT.md §5 "IG-local icons"), drawn as inline SVG from lucide's own node data
 * (lucide-react 1.49, node_modules/lucide-react/dist/esm/icons/<name>.mjs — the same 24-unit grid, round caps and joins,
 * stroke 2), exactly as the film 2 kit draws its icons (src/kb/kit/icons.tsx, imported read-only: its ICONS cannot be
 * extended from here, so the reels keep their own table). Vector-sharp at any DPR.
 *
 *   messageCircle   the end card's comment field (message-circle.mjs)
 *   send            the end card's send disc (send.mjs)
 *   phoneForwarded  ig1's "Live transfers" contact row (phone-forwarded.mjs)
 *   loader          ig2's ToolRow spinner (loader.mjs; the kit's own, repeated so one table serves the reels)
 *   calendar        ig2's event card (calendar.mjs)
 *   check           a plain check (check.mjs; the drawn one is the kit's CheckMark)
 *
 *   <IgIcon name="send" size={34} color="#fff" />
 */
import React from 'react';

type Node =
  | readonly ['path', { d: string }]
  | readonly ['circle', { cx: number; cy: number; r: number }]
  | readonly ['rect', { x: number; y: number; width: number; height: number; rx: number }];

export const IG_ICONS = {
  /** message-circle.mjs */
  messageCircle: [['path', { d: 'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719' }]],
  /** send.mjs */
  send: [
    ['path', { d: 'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z' }],
    ['path', { d: 'm21.854 2.147-10.94 10.939' }],
  ],
  /** phone-forwarded.mjs */
  phoneForwarded: [
    ['path', { d: 'M14 6h8' }],
    ['path', { d: 'm18 2 4 4-4 4' }],
    [
      'path',
      {
        d: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384',
      },
    ],
  ],
  /** loader.mjs */
  loader: [
    ['path', { d: 'M12 2v4' }],
    ['path', { d: 'm16.2 7.8 2.9-2.9' }],
    ['path', { d: 'M18 12h4' }],
    ['path', { d: 'm16.2 16.2 2.9 2.9' }],
    ['path', { d: 'M12 18v4' }],
    ['path', { d: 'm4.9 19.1 2.9-2.9' }],
    ['path', { d: 'M2 12h4' }],
    ['path', { d: 'm4.9 4.9 2.9 2.9' }],
  ],
  /** calendar.mjs */
  calendar: [
    ['path', { d: 'M8 2v3' }],
    ['path', { d: 'M16 2v3' }],
    ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }],
    ['path', { d: 'M3 9h18' }],
  ],
  /** check.mjs */
  check: [['path', { d: 'M20 6 9 17l-5-5' }]],
} as const satisfies Record<string, readonly Node[]>;

export type IgIconName = keyof typeof IG_ICONS;

/**
 * A lucide icon at `size` px. `stroke` is lucide's 24-unit stroke (2 = the default); `absolute` makes it a constant px
 * width whatever the size (lucide's absoluteStrokeWidth). `rotate` turns it about its centre (the spinner).
 */
export const IgIcon: React.FC<{
  name: IgIconName;
  size: number;
  color?: string;
  stroke?: number;
  absolute?: boolean;
  rotate?: number;
  style?: React.CSSProperties;
}> = ({ name, size, color = 'currentColor', stroke = 2, absolute = false, rotate, style }) => {
  const sw = absolute ? (stroke * 24) / size : stroke;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, overflow: 'visible', ...style }}
      aria-hidden
    >
      <g transform={rotate ? `rotate(${rotate.toFixed(3)} 12 12)` : undefined}>
        {(IG_ICONS[name] as readonly Node[]).map((n, i) => {
          if (n[0] === 'path') return <path key={i} d={n[1].d} />;
          if (n[0] === 'circle') return <circle key={i} cx={n[1].cx} cy={n[1].cy} r={n[1].r} />;
          return <rect key={i} x={n[1].x} y={n[1].y} width={n[1].width} height={n[1].height} rx={n[1].rx} />;
        })}
      </g>
    </svg>
  );
};
