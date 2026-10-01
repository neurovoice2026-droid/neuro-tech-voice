/**
 * The phone: a dark slab (#0b0910, 1px rim, an edge catching the light).
 * Its screen is dead until TWIST.phoneOn, then powers on — a thin line of
 * light expands (expo), opens to the full screen (house ease) through a
 * 2-frame flash — onto the #demo night room: "INCOMING CALL", the avatar
 * (Ava's orb, drawn by the scene in screen space so it can become the
 * call's orb) and the number in Geist Mono. Lilac light spills around it.
 */
import React from 'react';
import type { Layout } from '../../lib/layout';
import { EASE, SPRING, aos, breathe, tween } from '../../lib/motion';
import { C, FONT, NIGHT_ROOM, TRACK } from '../../theme';
import { TWIST } from '../../timing';
import { MIDNIGHT_ROOM } from '../call/Light';
import { avatarOnPhone, TW, type Geo } from './geometry';

const LILAC = '185,163,255';
const ELECTRIC = '124,58,237';
const PAPER = '237,236,241';

/** Screen power-on progress. */
export function screenState(t: number) {
  const lineW = tween(t, TW.screenLine, [0, 1], EASE.expo);
  const open = tween(t, TW.screenOpen, [0, 1], EASE.house);
  const f0 = TW.screenOpen[0];
  const flash = t >= f0 && t < f0 + 2 ? 0.7 - (t - f0) * 0.2 : t >= f0 + 2 ? 0.3 * Math.exp(-(t - f0 - 2) / 1.8) : 0;
  const on = tween(t, [TWIST.phoneOn, TW.screenOpen[1]], [0, 1], EASE.house);
  return { lineW, open, flash, on };
}

/** Per-letter reveal for small UI type (rise + blur-in, 1-frame stagger). */
const Stagger: React.FC<{ text: string; t: number; start: number; out: number; style: React.CSSProperties }> = ({
  text,
  t,
  start,
  out,
  style,
}) => (
  <div style={{ display: 'flex', justifyContent: 'center', whiteSpace: 'pre', ...style }}>
    {text.split('').map((ch, i) => {
      const p = aos(t, start + i * 0.8, { anticip: 2, depth: 0.1, config: SPRING.pop });
      const o = Math.min(1, Math.max(0, p * 1.3)) * (1 - out);
      const blur = tween(t, [start + i * 0.8, start + i * 0.8 + 8], [3, 0], EASE.house);
      return (
        <span
          key={i}
          style={{
            display: 'inline-block',
            opacity: o,
            transform: `translateY(${((1 - p) * 0.6).toFixed(3)}em)`,
            filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
          }}
        >
          {ch}
        </span>
      );
    })}
  </div>
);

/** `grade`: the call's roomGrade (0 through the twist unless the call starts its grade early) —
 *  the screen's night room grades into the midnight exactly as the call's RoomBox does. */
export const Phone: React.FC<{ t: number; g: Geo; L: Layout; f: number; grade?: number }> = ({ t, g, L, f, grade = 0 }) => {
  const { w, h } = g.phone;
  const sw = g.screen.w;
  const sh = g.screen.h;
  const s = screenState(t);
  const heavy = f < 2.6; // drop big soft effects once we are inside
  const glowBreath = 1 + breathe(t, 60, 0.08);
  const uiOut = tween(t, [TWIST.pushToPhone[0] + 3, TWIST.pushToPhone[0] + 15], [0, 1], EASE.inOut);
  const haloOut = tween(t, [TWIST.pushToPhone[0] + 14, TWIST.pushToPhone[1] - 4], [0, 1], EASE.inOut);

  const openH = s.open * sh;
  const av = avatarOnPhone(t, g);
  const clipTop = (sh - openH) / 2;

  return (
    <div style={{ position: 'absolute', left: g.phone.cx - w / 2, top: g.phone.cy - h / 2, width: w, height: h }}>
      {/* lilac spill */}
      {heavy && s.on > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: w / 2 - w * 1.9,
            top: h / 2 - h * 1.05,
            width: w * 3.8,
            height: h * 2.1,
            background: `radial-gradient(closest-side, rgba(${LILAC},0.26), rgba(${ELECTRIC},0.10) 48%, rgba(${ELECTRIC},0) 100%)`,
            opacity: Math.min(1.3, s.on * glowBreath + s.flash * 0.6) * (1 - uiOut * 0.5),
          }}
        />
      ) : null}
      {/* body */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 46,
          background: `linear-gradient(155deg, #16131d 0%, #0b0910 30%, #0b0910 72%, #0e0c14 100%)`,
          boxShadow: [
            `inset 0 0 0 1px rgba(255,255,255,0.12)`,
            `inset 1.5px 1px 0 rgba(255,255,255,0.06)`,
            `inset 0 0 0 1px rgba(${LILAC},${(0.22 * s.on).toFixed(3)})`,
            heavy ? `0 50px 90px -30px rgba(0,0,0,0.85)` : '',
            heavy ? `0 16px 30px -14px rgba(0,0,0,0.7)` : '',
          ]
            .filter(Boolean)
            .join(', '),
        }}
      />
      {/* edge reflection: a thin highlight down the left edge */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 46,
          background: `linear-gradient(100deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 4%, rgba(255,255,255,0) 96%, rgba(${LILAC},${(0.08 * s.on).toFixed(3)}) 100%)`,
        }}
      />
      {/* side keys */}
      {[
        { side: -1, y: 118, hh: 34 },
        { side: -1, y: 166, hh: 56 },
        { side: -1, y: 232, hh: 56 },
        { side: 1, y: 176, hh: 86 },
      ].map((k, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: k.side < 0 ? -2.5 : w - 0.5,
            top: k.y,
            width: 3,
            height: k.hh,
            borderRadius: 2,
            background: '#15121c',
            boxShadow: `inset 0 0 0 0.5px rgba(255,255,255,0.14)`,
          }}
        />
      ))}
      {/* screen */}
      <div
        style={{
          position: 'absolute',
          left: g.bezel,
          top: g.bezel,
          width: sw,
          height: sh,
          borderRadius: g.screen.r,
          overflow: 'hidden',
          background: '#040306',
        }}
      >
        {s.open > 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: NIGHT_ROOM,
              clipPath: s.open < 1 ? `inset(${clipTop.toFixed(2)}px 0 ${clipTop.toFixed(2)}px 0)` : undefined,
            }}
          >
            {grade > 0.001 ? (
              <div style={{ position: 'absolute', inset: 0, background: MIDNIGHT_ROOM, opacity: Math.min(1, grade) }} />
            ) : null}
            {s.flash > 0.01 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `radial-gradient(90% 60% at 50% 50%, rgba(${PAPER},1), rgba(${LILAC},0.6))`,
                  opacity: s.flash,
                }}
              />
            ) : null}
            {/* avatar halo + glow (the orb itself is drawn by the scene) */}
            <div
              style={{
                position: 'absolute',
                left: sw / 2 - av * 2.2,
                top: sh / 2 - av * 2.2,
                width: av * 4.4,
                height: av * 4.4,
                background: `radial-gradient(closest-side, rgba(${LILAC},0.34), rgba(${ELECTRIC},0.12) 50%, rgba(${ELECTRIC},0) 100%)`,
                opacity: (0.8 + 0.2 * glowBreath) * (1 - haloOut),
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: sw / 2 - av * 0.85,
                top: sh / 2 - av * 0.85,
                width: av * 1.7,
                height: av * 1.7,
                borderRadius: '50%',
                boxShadow: `inset 0 0 0 1px rgba(${LILAC},0.32)`,
                opacity: tween(t, [TW.uiLabel, TW.uiLabel + 8], [0, 1], EASE.house) * (1 - haloOut),
              }}
            />
            {/* the site's Label (Inter 500, 0.14em, uppercase, paper-dim) at a readable
                30 px: two centred rows ("INCOMING" / "CALL") — one row would not fit the
                242 px screen. paddingLeft re-centres the trailing tracking.
                16:9: label above the orb, the number below it. 9:16: the caller ID sits where
                a phone puts it — label and number both above the orb — so everything that is
                read stays above the frame's bottom UI band (y ≤ 1500) while the phone's body
                runs on below it. */}
            {['Incoming', 'call'].map((word, row) => (
              <Stagger
                key={word}
                text={word}
                t={t}
                start={TW.uiLabel + row * 4}
                out={uiOut}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: sh / 2 + L.pick(-168, -200) + row * 36,
                  paddingLeft: '0.14em',
                  transform: `translateY(${(-uiOut * 40).toFixed(2)}px)`,
                  fontFamily: FONT.body,
                  fontWeight: 500,
                  fontSize: 30,
                  lineHeight: 1,
                  letterSpacing: TRACK.label,
                  textTransform: 'uppercase',
                  color: C.paperDim,
                }}
              />
            ))}
            <Stagger
              text="+1 555 0129"
              t={t}
              start={TW.uiNumber}
              out={uiOut}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: sh / 2 + L.pick(86, -110),
                // exits away from the orb with the rest of the UI (down in 16:9, up in 9:16)
                transform: `translateY(${(uiOut * L.pick(50, -34)).toFixed(2)}px)`,
                fontFamily: FONT.mono,
                fontWeight: 500,
                fontSize: 30,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: C.paper,
              }}
            />
          </div>
        ) : null}
        {/* the line of light the screen opens from */}
        {s.lineW > 0 && s.open < 0.98 ? (
          <div
            style={{
              position: 'absolute',
              left: (sw * (1 - s.lineW)) / 2,
              width: sw * s.lineW,
              top: sh / 2 - 1.5 - openH / 2,
              height: 3 + openH,
              background: `linear-gradient(180deg, rgba(255,255,255,1), rgba(${LILAC},0.5) 10%, rgba(${LILAC},0) 50%, rgba(${LILAC},0.5) 90%, rgba(255,255,255,1))`,
              opacity: Math.min(1, 1.6 * (1 - s.open)),
              boxShadow: `0 0 16px 3px rgba(${LILAC},0.85), 0 0 4px 1px rgba(255,255,255,0.9)`,
              borderRadius: 2,
            }}
          />
        ) : null}
        {/* glass */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(118deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.045) 47%, rgba(255,255,255,0) 58%)`,
            opacity: 1 - uiOut,
          }}
        />
        {/* island */}
        <div
          style={{
            position: 'absolute',
            left: sw / 2 - 36,
            top: 13,
            width: 72,
            height: 21,
            borderRadius: 11,
            background: '#000',
            opacity: 1 - uiOut,
          }}
        >
          <div style={{ position: 'absolute', right: 8, top: 6, width: 9, height: 9, borderRadius: '50%', background: '#0d0b16', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }} />
        </div>
      </div>
    </div>
  );
};
