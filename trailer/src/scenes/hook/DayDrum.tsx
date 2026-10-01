/**
 * The day label above the clock as a drum: one row per moment ("MID-RUSH",
 * "AFTER CLOSING", "SUNDAY", "TUESDAY NIGHT"), each with the brand dot in its
 * light. It rolls with the clock's strips (same flick curve: wind-back,
 * power3 travel, spring overshoot), so day and time change as one mechanism.
 * Vertical motion blur ∝ drum speed; the window's edges are soft.
 */
import React from 'react';
import { CornerDot } from '../../components/Type';
import { FONT, TRACK } from '../../theme';

export type DrumRow = { text: string; color: string; dot: string };

export const DayDrum: React.FC<{
  rows: readonly DrumRow[];
  /** drum position in rows (0 = first row centred; −1 = nothing yet) */
  pos: number;
  /** rows / frame */
  speed: number;
  fontSize: number;
  width: number;
  dotSize: number;
}> = ({ rows, pos, speed, fontSize, width, dotSize }) => {
  const rowH = Math.round(fontSize * 1.6);
  const sigma = Math.min(0.3 * rowH, 0.22 * Math.max(0, Math.abs(speed) - 0.06) * rowH);
  const blurOn = sigma > 0.4;
  const mask = 'linear-gradient(180deg, transparent 0%, #000 24%, #000 76%, transparent 100%)';
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
      {blurOn ? (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
          <defs>
            <filter id="hook-drum-blur" x="-5%" y="-80%" width="110%" height="260%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`0 ${sigma.toFixed(2)}`} />
            </filter>
          </defs>
        </svg>
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: blurOn ? 'url(#hook-drum-blur)' : undefined,
          opacity: 1 - Math.min(0.3, Math.abs(speed) * 0.12),
        }}
      >
        {rows.map((r, i) => {
          const d = i - pos;
          if (Math.abs(d) > 1.35) return null;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                width,
                top: d * rowH,
                height: rowH,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: Math.round(fontSize * 0.42),
              }}
            >
              <CornerDot size={dotSize} color={r.dot} style={{ marginTop: -1 }} />
              <span
                style={{
                  fontFamily: FONT.body,
                  fontWeight: 500,
                  fontSize,
                  lineHeight: 1.2,
                  letterSpacing: TRACK.label,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  color: r.color,
                  marginRight: `-${TRACK.label}`,
                }}
              >
                {r.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
