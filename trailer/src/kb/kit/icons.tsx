/**
 * The app's lucide icons, drawn as inline SVG from lucide's own node data (lucide-react 1.49,
 * node_modules/lucide-react/dist/esm/icons/*.mjs — the same 24-unit grid, round caps and joins,
 * stroke 2), so they are vector-sharp at any DPR and their stroke can follow the trailer's scale.
 * The agent page uses Settings2 · MessagesSquare · Volume2 · BookOpen · Sparkles on its tabs
 * (components/agent/AgentPageClient.tsx:60–66); the knowledge tab's rows, pills and menu use the rest
 * (components/agent/tabs/TabKnowledge.tsx).
 */
import React from 'react';

type Node = readonly ['path', { d: string }] | readonly ['circle', { cx: number; cy: number; r: number }] | readonly ['rect', { x: number; y: number; width: number; height: number; rx: number }] | readonly ['line', { x1: number; y1: number; x2: number; y2: number }];

export const ICONS = {
  /** settings-2.mjs */
  settings2: [
    ['path', { d: 'M14 17H5' }],
    ['path', { d: 'M19 7h-9' }],
    ['circle', { cx: 17, cy: 17, r: 3 }],
    ['circle', { cx: 7, cy: 7, r: 3 }],
  ],
  /** messages-square.mjs */
  messagesSquare: [
    ['path', { d: 'M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' }],
    ['path', { d: 'M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1' }],
  ],
  /** volume-2.mjs */
  volume2: [
    ['path', { d: 'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z' }],
    ['path', { d: 'M16 9a5 5 0 0 1 0 6' }],
    ['path', { d: 'M19.364 18.364a9 9 0 0 0 0-12.728' }],
  ],
  /** book-open.mjs */
  bookOpen: [
    ['path', { d: 'M12 5v16' }],
    ['path', { d: 'M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z' }],
  ],
  /** sparkles.mjs */
  sparkles: [
    ['path', { d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z' }],
    ['path', { d: 'M20 2v4' }],
    ['path', { d: 'M22 4h-4' }],
    ['circle', { cx: 4, cy: 20, r: 2 }],
  ],
  /** ellipsis.mjs (MoreHorizontal) */
  ellipsis: [
    ['circle', { cx: 12, cy: 12, r: 1 }],
    ['circle', { cx: 19, cy: 12, r: 1 }],
    ['circle', { cx: 5, cy: 12, r: 1 }],
  ],
  /** check.mjs */
  check: [['path', { d: 'M20 6 9 17l-5-5' }]],
  /** loader-circle.mjs (Loader2) */
  loader: [['path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' }]],
  /** circle-check.mjs (CheckCircle2) */
  circleCheck: [
    ['circle', { cx: 12, cy: 12, r: 10 }],
    ['path', { d: 'm16 9-5.5 5.5L8 12' }],
  ],
  /** refresh-cw.mjs */
  refresh: [
    ['path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }],
    ['path', { d: 'M21 3v5h-5' }],
    ['path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' }],
    ['path', { d: 'M8 16H3v5' }],
  ],
  /** replace.mjs */
  replace: [
    ['path', { d: 'M14 4a1 1 0 0 1 1-1' }],
    ['path', { d: 'M15 10a1 1 0 0 1-1-1' }],
    ['path', { d: 'M21 4a1 1 0 0 0-1-1' }],
    ['path', { d: 'M21 9a1 1 0 0 1-1 1' }],
    ['path', { d: 'm3 7 3 3 3-3' }],
    ['path', { d: 'M6 10V5a2 2 0 0 1 2-2h2' }],
    ['rect', { x: 3, y: 14, width: 7, height: 7, rx: 1 }],
  ],
  /** trash.mjs (Trash2) */
  trash: [
    ['path', { d: 'M10 11v6' }],
    ['path', { d: 'M14 11v6' }],
    ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }],
    ['path', { d: 'M3 6h18' }],
    ['path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }],
  ],
  /** file-text.mjs */
  fileText: [
    ['path', { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' }],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
    ['path', { d: 'M10 9H8' }],
    ['path', { d: 'M16 13H8' }],
    ['path', { d: 'M16 17H8' }],
  ],
  /** globe.mjs */
  globe: [
    ['circle', { cx: 12, cy: 12, r: 10 }],
    ['path', { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' }],
    ['path', { d: 'M2 12h20' }],
  ],
  /** link-2.mjs */
  link2: [
    ['path', { d: 'M9 17H7A5 5 0 0 1 7 7h2' }],
    ['path', { d: 'M15 7h2a5 5 0 1 1 0 10h-2' }],
    ['line', { x1: 8, x2: 16, y1: 12, y2: 12 }],
  ],
} as const satisfies Record<string, readonly Node[]>;

export type IconName = keyof typeof ICONS;

/**
 * A lucide icon at `size` px. `stroke` is lucide's 24-unit stroke (2 = the default); `absolute`
 * makes it a constant px width whatever the size (lucide's absoluteStrokeWidth).
 */
export const Icon: React.FC<{
  name: IconName;
  size: number;
  color?: string;
  stroke?: number;
  absolute?: boolean;
  style?: React.CSSProperties;
  /** rotate (deg) about the centre — the spinner */
  rotate?: number;
}> = ({ name, size, color = 'currentColor', stroke = 2, absolute = false, style, rotate }) => {
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
        {(ICONS[name] as readonly Node[]).map((n, i) => {
          if (n[0] === 'path') return <path key={i} d={n[1].d} />;
          if (n[0] === 'circle') return <circle key={i} cx={n[1].cx} cy={n[1].cy} r={n[1].r} />;
          if (n[0] === 'rect') return <rect key={i} x={n[1].x} y={n[1].y} width={n[1].width} height={n[1].height} rx={n[1].rx} />;
          return <line key={i} x1={n[1].x1} y1={n[1].y1} x2={n[1].x2} y2={n[1].y2} />;
        })}
      </g>
    </svg>
  );
};
