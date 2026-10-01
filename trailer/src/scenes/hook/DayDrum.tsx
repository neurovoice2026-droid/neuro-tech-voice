/**
 * The moment's name above the clock, as a drum: one row per moment
 * ("MID-RUSH", "AFTER CLOSING", "SUNDAY", "TUESDAY NIGHT"), each led by the
 * brand's CornerDot in its light. It rolls with the clock's strips (the same
 * flick curve), so day and time change as one mechanism.
 *
 * Set as the film's label (TYPE.label: Instrument Sans, uppercase, 0.14em),
 * a size up for the moment names. No glow, no blur: the row passes under the
 * window's short feather and the motion itself is the transition (120 fps).
 */
import React from 'react';
import { CornerDot, subpixel } from '../../components/Type';
import { useLayout } from '../../lib/layout';
import { typeStyle } from '../../lib/type';
import { TRACK } from '../../theme';

export type DrumRow = {
  text: string;
  /** the label's ink */
  color: string;
  /** the dot: the light's own colour */
  dot: string;
};

export const DayDrum: React.FC<{
  rows: readonly DrumRow[];
  /** drum position in rows (0 = first row centred; −1 = nothing yet; past the last = gone) */
  pos: number;
  /** rows / frame */
  speed: number;
  fontSize: number;
  width: number;
  dotSize: number;
}> = ({ rows, pos, speed, fontSize, width, dotSize }) => {
  const L = useLayout();
  const rowH = Math.round(fontSize * 1.6);
  const mask = 'linear-gradient(180deg, transparent 0%, #000 20%, #000 80%, transparent 100%)';
  const moving = Math.abs(speed) > 4e-4;
  const label = typeStyle('label', L.vertical, { tone: 'night', size: fontSize });
  return (
    <div
      style={{
        position: 'relative',
        width,
        height: rowH,
        overflow: 'hidden',
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      {rows.map((r, i) => {
        const d = i - pos;
        if (Math.abs(d) > 1.05) return null;
        const y = d * rowH;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width,
              height: rowH,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: Math.round(fontSize * 0.46),
              ...subpixel(Math.abs(y) > 0.004 ? `translateY(${y.toFixed(3)}px)` : undefined, moving),
            }}
          >
            <CornerDot size={dotSize} color={r.dot} style={{ marginTop: -1 }} />
            <span style={{ ...label, whiteSpace: 'nowrap', color: r.color, marginRight: `-${TRACK.label}` }}>{r.text}</span>
          </div>
        );
      })}
    </div>
  );
};
