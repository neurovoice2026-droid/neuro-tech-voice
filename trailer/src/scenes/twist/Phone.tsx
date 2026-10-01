/**
 * The phone: a real object — a brushed-titanium band (its edge catching the
 * light), black glass, the island. Its screen is dead until TWIST.phoneOn,
 * then wakes the way a phone does: the display comes up from the avatar
 * outward (a radial reveal, EASE.house) onto the #demo night room — Ava's
 * orb (drawn by the scene in screen space, so it can become the call's orb),
 * "INCOMING CALL" (TYPE.label) and the number (Instrument Sans, tabular),
 * each letter rising out of its own mask as the keys chatter. The screen is
 * the light: the room's glow around it is the scene's NightRoom key, not a
 * spill drawn here.
 *
 * No blur anywhere: every reveal is a mask rise, every exit leaves through it.
 */
import React from 'react';
import { Reveal } from '../../components/Type';
import type { Layout } from '../../lib/layout';
import { EASE, SPRING, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { C, NIGHT_ROOM } from '../../theme';
import { TWIST } from '../../timing';
import { MIDNIGHT_ROOM } from '../call/Light';
import { avatarOnPhone, TW, type Geo } from './geometry';

const LILAC = '185,163,255';

/** Screen power-on: the display's reveal radius (0 → 1 of the screen's half-diagonal) and level. */
export function screenState(t: number) {
  const open = tween(t, TW.screenOpen, [0, 1], EASE.house);
  // the display's level comes up with the reveal (a screen wakes, it does not flash)
  const on = tween(t, [TWIST.phoneOn, TW.screenOpen[1]], [0, 1], EASE.house);
  return { open, on };
}

/** A row of UI type, letter by letter out of their masks (the key chatter), leaving the same way. */
const Typed: React.FC<{ text: string; t: number; start: number; exitAt: number; exitTo: 'up' | 'down'; style: React.CSSProperties }> = ({
  text,
  t,
  start,
  exitAt,
  exitTo,
  style,
}) => (
  <div style={{ display: 'flex', justifyContent: 'center', whiteSpace: 'pre', ...style }}>
    {text.split('').map((ch, i) => (
      <Reveal
        key={i}
        t={t}
        start={start + i * 0.75}
        config={SPRING.caption}
        rise={90}
        exit={{ at: exitAt + i * 0.25, dur: 8, to: exitTo }}
      >
        {ch === ' ' ? ' ' : ch}
      </Reveal>
    ))}
  </div>
);

/** `grade`: the call's roomGrade — the screen's night room grades into the midnight exactly as the call's RoomBox does. */
export const Phone: React.FC<{ t: number; g: Geo; L: Layout; f: number; grade?: number }> = ({ t, g, L, f, grade = 0 }) => {
  const { w, h } = g.phone;
  const sw = g.screen.w;
  const sh = g.screen.h;
  const s = screenState(t);
  const near = f > 2.6; // inside: the body's fine detail is off-frame
  const uiOut0 = TWIST.pushToPhone[0] + 3;
  const uiOut = tween(t, [uiOut0, uiOut0 + 12], [0, 1], EASE.inOut);
  const haloOut = tween(t, [TWIST.pushToPhone[0] + 14, TWIST.pushToPhone[1] - 4], [0, 1], EASE.inOut);
  const av = avatarOnPhone(t, g);
  // the reveal grows from the avatar (the screen's centre) to past the corners
  const R = Math.hypot(sw, sh) / 2 + 2;
  const label = typeStyle('label', L.vertical, { tone: 'night', size: 30 });
  const number = typeStyle('title', L.vertical, { tone: 'night', size: 34, tabular: true });

  return (
    <div style={{ position: 'absolute', left: g.phone.cx - w / 2, top: g.phone.cy - h / 2, width: w, height: h }}>
      {/* the band: brushed titanium, lit from the upper left */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 46,
          background: 'linear-gradient(150deg, #57545e 0%, #2a2830 18%, #17151c 50%, #1f1d24 78%, #3d3a44 100%)',
          boxShadow: near ? undefined : '0 40px 80px -36px rgba(0,0,0,0.9), 0 14px 26px -16px rgba(0,0,0,0.75)',
        }}
      />
      {/* the black glass front, inset from the band */}
      <div
        style={{
          position: 'absolute',
          inset: 2.5,
          borderRadius: 43.5,
          background: '#050407',
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 0 1px rgba(${LILAC},${(0.14 * s.on).toFixed(3)})`,
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
            left: k.side < 0 ? -2 : w - 1,
            top: k.y,
            width: 3,
            height: k.hh,
            borderRadius: 2,
            background: k.side < 0 ? 'linear-gradient(90deg, #5a5761, #2a2830)' : 'linear-gradient(90deg, #2a2830, #4a4751)',
          }}
        />
      ))}
      {/* the screen */}
      <div
        style={{
          position: 'absolute',
          left: g.bezel,
          top: g.bezel,
          width: sw,
          height: sh,
          borderRadius: g.screen.r,
          overflow: 'hidden',
          background: '#020103',
        }}
      >
        {s.open > 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: NIGHT_ROOM,
              clipPath: s.open < 1 ? `circle(${(R * s.open).toFixed(2)}px at 50% 50%)` : undefined,
            }}
          >
            {grade > 0.001 ? (
              <div style={{ position: 'absolute', inset: 0, background: MIDNIGHT_ROOM, opacity: Math.min(1, grade) }} />
            ) : null}
            {/* the avatar's hairline ring (the orb itself is drawn by the scene) */}
            <div
              style={{
                position: 'absolute',
                left: sw / 2 - av * 0.86,
                top: sh / 2 - av * 0.86,
                width: av * 1.72,
                height: av * 1.72,
                borderRadius: '50%',
                boxShadow: `inset 0 0 0 1px rgba(${LILAC},0.34)`,
                opacity: tween(t, [TW.uiLabel, TW.uiLabel + 8], [0, 1], EASE.house) * (1 - haloOut),
              }}
            />
            {/* "INCOMING / CALL" — two centred label rows (one would not fit the 242 px screen); paddingLeft
                re-centres the trailing tracking. 16:9: the label above the orb, the number below it. 9:16: the
                caller ID sits where a phone puts it — label and number both above the orb — so everything read
                stays above the frame's bottom band (y ≤ 1500) while the body runs on below. */}
            {['Incoming', 'call'].map((word, row) => (
              <Typed
                key={word}
                text={word.toUpperCase()}
                t={t}
                start={TW.uiLabel + row * 4}
                exitAt={uiOut0 + row * 1.5}
                exitTo="up"
                style={{
                  ...label,
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: sh / 2 + L.pick(-170, -202) + row * 38,
                  paddingLeft: '0.14em',
                  color: C.paperDim,
                }}
              />
            ))}
            <Typed
              text="+1 555 0129"
              t={t}
              start={TW.uiNumber}
              exitAt={uiOut0 + 2}
              exitTo={L.pick('down', 'up')}
              style={{
                ...number,
                position: 'absolute',
                left: 0,
                right: 0,
                top: sh / 2 + L.pick(82, -116),
                color: C.paper,
              }}
            />
          </div>
        ) : null}
        {/* the glass: one faint diagonal reflection (a material, not a glare) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(118deg, rgba(255,255,255,0) 36%, rgba(255,255,255,0.04) 46%, rgba(255,255,255,0) 58%)',
            opacity: 1 - uiOut,
          }}
        />
        {/* the island */}
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
          <div
            style={{
              position: 'absolute',
              right: 8,
              top: 6,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 35%, #1c1a2a, #07060c)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          />
        </div>
      </div>
    </div>
  );
};
