/**
 * The peek (knowledge-stage.tsx, 16:9 only): the dashed sheet the reader is
 * still reading. It opens with the site's page reveal (clip from the top,
 * power3.out) as the scan starts; its skeleton lines shimmer while every
 * document is weighed, then collapse on the miss (right to left, 2 f
 * apart) — leaving the empty dashed page. That IS the "not found" picture;
 * the pill already says it in words.
 */
import React from 'react';
import { rgba } from '../../lib/lights';
import { aos, EASE, SPRING, tween } from '../../lib/motion';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { SUN, type Geo } from './geometry';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

export const Peek: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const P = G.peek;
  if (!P) return null;
  const openAt = KL.peekOpen;
  if (t < openAt) return null;
  const clip = tween(t, [openAt, openAt + 9], [100, 0], EASE.out3);
  const settle = aos(t, openAt, { anticip: 0, depth: 0, config: SPRING.site });
  // a small shrug once the page is empty
  const shrugAt = KL.peekCollapse[1] + 2;
  const shrug = t < shrugAt ? 0 : Math.sin(Math.min(1, (t - shrugAt) / 10) * Math.PI) * Math.exp(-(t - shrugAt) / 8);
  const sc = (0.965 + 0.035 * settle) * (1 - 0.012 * shrug);

  const padX = 44;
  const inner = P.w - padX * 2;
  const bars = [
    { w: 96, a: 0.07, y: 45 },
    { w: inner * 0.86, a: 0.05, y: 45 + 16 + 34 },
    { w: inner * 0.64, a: 0.05, y: 45 + 16 + 34 + 16 + 26 },
    { w: inner * 0.78, a: 0.05, y: 45 + 16 + 34 + 16 + 26 + 16 + 26 },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        left: P.x,
        top: P.y,
        width: P.w,
        height: P.h,
        borderRadius: 20,
        border: `2px dashed ${rgba(SUN.orb[0], 0.16)}`,
        background: rgba('#ffffff', 0.35),
        boxSizing: 'border-box',
        clipPath: `inset(0% 0% ${clip.toFixed(2)}% 0% round 20px)`,
        transform: `scale(${sc.toFixed(4)})`,
      }}
    >
      {/* the reveal edge: a scan line of Sunday light running down as the page opens */}
      {clip > 0.5 ? (
        <div
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            top: `calc(${(100 - clip).toFixed(2)}% - 3px)`,
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${rgba(SUN.orb[2], 0)}, ${rgba(SUN.orb[2], 0.9)} 30%, ${rgba(SUN.orb[3], 1)} 50%, ${rgba(SUN.orb[2], 0.9)} 70%, ${rgba(SUN.orb[2], 0)})`,
            boxShadow: `0 0 14px 2px ${rgba(SUN.orb[2], 0.45)}`,
            opacity: Math.min(1, clip / 30),
          }}
        />
      ) : null}
      {bars.map((b, i) => {
        const c0 = KL.peekCollapse[0] + i * 2;
        const q = tween(t, [c0, c0 + 6], [0, 1], EASE.in2);
        if (q >= 1) return null;
        // the shimmer: a plum glint sweeps each line every 10 f while reading (not after)
        const reading = t >= K.scan[0] && t < K.miss + 2;
        const ph = (((t - K.scan[0] - i * 1.5) % 10) + 10) % 10;
        const sweep = EASE.inOut(ph / 10);
        const band = 140;
        const gx = -band + sweep * (b.w + band);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: padX - 2,
              top: b.y - 2,
              width: b.w,
              height: 16,
              borderRadius: 8,
              overflow: 'hidden',
              background: `rgba(20,10,36,${b.a})`,
              transformOrigin: '0% 50%',
              transform: `scaleX(${(1 - q).toFixed(4)})`,
              opacity: 1 - 0.6 * q,
            }}
          >
            {reading ? (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: gx,
                  width: band,
                  background: `linear-gradient(90deg, ${rgba(SUN.orb[2], 0)}, ${rgba(SUN.orb[2], 0.3)}, ${rgba(SUN.orb[2], 0)})`,
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
