/**
 * The moment tag — "☀ SUNDAY · 10:24" — says why the room's light is teal:
 * this call comes in on a Sunday (#demo's Sunday light; the sun is #demo's
 * own Sunday key icon, lucide Sun). TYPE.label in sunday ink, tabular
 * figures — the scene's one family.
 *
 * 16:9: it sits just left of the status pill and rides its edge (when the
 * pill's phrase changes width the tag is carried along on the site spring,
 * never touching the pill). 9:16: right-aligned under the pill.
 *
 * Entrance (momentTag, an 8th after the pill): the sun turns in (its rays
 * spin to rest as it scales up) and the words rise out of their mask a frame
 * behind it. No bloom, no glow, no glint: the colour is in the type.
 */
import React from 'react';
import { Reveal, subpixel } from '../../components/Type';
import { rgba } from '../../lib/lights';
import { EASE, SPRING, springUnit, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { KNOWLEDGE_LOCAL } from '../../timing';
import { INK, MOMENT, type Geo } from './geometry';
import { pillLeftAt } from './Status';

const KL = KNOWLEDGE_LOCAL;
const DAY = MOMENT.day;
const TIME = MOMENT.time;

/** 16:9: the tag's right edge — carried along by the pill on the site spring, never into it */
function rightAt(t: number, G: Geo) {
  const gap = G.top.tag.gap;
  const steady = (f: number) => pillLeftAt(f, G) - gap;
  let x = steady(KL.momentTag);
  for (const at of [KL.scanFlip, KL.missFlip]) {
    if (t < at + 1) break;
    const from = steady(at - 1);
    const to = steady(at + 12);
    x += (to - from) * springUnit(t - at - 1, SPRING.site);
  }
  return Math.min(x, steady(t));
}

const Sun: React.FC<{ size: number; p: number; color: string }> = ({ size, p, color }) => {
  const rays = ['M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41'];
  const q = Math.max(0, p);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', overflow: 'visible' }}>
      <g style={{ transformOrigin: '12px 12px', transform: `scale(${(0.5 + 0.5 * Math.min(1.05, q)).toFixed(4)})` }}>
        <circle cx={12} cy={12} r={4} />
      </g>
      <g
        style={{
          transformOrigin: '12px 12px',
          transform: `rotate(${(-90 * (1 - Math.min(1, q))).toFixed(3)}deg) scale(${Math.min(1.05, q).toFixed(4)})`,
          opacity: Math.min(1, q * 1.6),
        }}
      >
        {rays.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
};

export const Moment: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const s = KL.momentTag;
  if (t < s - 2) return null;
  const T = G.top;
  const M = T.tag;
  const W = G.v ? 1080 : 1920;
  const right = M.mode === 'below' ? T.pillRight : rightAt(t, G);
  const y = M.mode === 'below' ? M.y : T.y;
  const sunP = springUnit(t - (s - 1), SPRING.site);
  const sunO = tween(t, [s - 1, s + 3], [0, 1], EASE.out3);
  const st = typeStyle('label', G.v, { tone: 'paper', size: M.size, tabular: true });
  // (16:9: it rides the pill — a compositor move while it travels, so it is sub-pixel smooth)
  const vx = M.mode === 'below' ? 0 : rightAt(t + 0.25, G) - rightAt(t - 0.25, G);
  return (
    <div
      style={{
        position: 'absolute',
        right: W - right,
        top: y,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        ...subpixel('translateY(-50%)', Math.abs(vx) > 0.005),
        color: INK,
        ...st,
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ opacity: sunO }}>
        <Sun size={M.icon} p={sunP} color={INK} />
      </div>
      <Reveal t={t} start={s} config={SPRING.text} rise={100}>
        {DAY}
      </Reveal>
      <Reveal t={t} start={s + 1} config={SPRING.text} rise={100}>
        <span
          style={{
            display: 'inline-block',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: rgba(INK, 0.6),
            transform: 'translateY(-0.18em)',
            margin: '0 0.1em',
          }}
        />
      </Reveal>
      <Reveal t={t} start={s + 2} config={SPRING.text} rise={100}>
        {TIME}
      </Reveal>
    </div>
  );
};
