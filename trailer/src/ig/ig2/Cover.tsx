/**
 * REEL 2's cover (docs/ig/SCRIPT.md ig2 §5; IG2-Cover-9x16, night ground): the kicker AI RECEPTIONIST · 02; the
 * "9:47 pm" lockup with HER TEAL ORB as its colon (the reel's turn: the phone's rose light answered); the title
 * "Booked at 9:47 pm." (128 px, paper ink, "Booked" in her teal); the emerald Booked pill with the PRO chip, so the gate
 * is visible on the grid too. Everything inside x 86–930, y 260–1500 (the profile grid's 3:4 crop). An image: its
 * words need no voice.
 */
import React from 'react';
import { useKitFaces } from '../../kb/kit';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { CoverCard } from '../components/CoverCard';
import { LineLight } from '../components/Orb';
import { OutcomePill, outcomePillSize } from '../components/OutcomePill';
import { ZoneRect } from '../components/ZoneGuard';
import { Badge, chipBox, PRO_SPEC } from './Cards';
import { ClockLockup, lockColon, type LockAt } from './Clock';
import { Ground2 } from './Stage';

const SUNDAY = MOMENT_LIGHTS.sunday;
/** the lockup on the cover (SCRIPT: y 330–560 — set lower and larger, fix round 1: the block — lockup, title, pills —
 *  is centred in the profile grid's 3:4 crop (y 240–1680) instead of leaving its lower 40 % empty), the title below it,
 *  the pills under the title */
const AT: LockAt = { cx: 534, cy: 690, size: 244 };
const TITLE_Y = 900;
const PILLS_Y = 1250;
/** the PRO chip at the pill's size (the EventCard's Badge, × 32 / its label size) */
const PRO_K = 32 / PRO_SPEC.size;

const Art: React.FC = () => {
  const ready = useKitFaces();
  if (!ready) return null;
  const c = lockColon(AT);
  const pill = outcomePillSize('booked', 32);
  const pro = chipBox('Pro');
  return (
    <>
      <LineLight t={20} x={c.x} y={c.y} d={56} palette={SUNDAY.orb} />
      <ClockLockup t={0} onsets={[-30, -30]} exitAt={1e9} at={AT} what="cover lockup" />
      <div style={{ position: 'absolute', left: 86, top: PILLS_Y }}>
        <OutcomePill kind="booked" size={32} />
      </div>
      <div style={{ position: 'absolute', left: 86 + pill.w + 18, top: PILLS_Y + (pill.h - pro.h * PRO_K) / 2, width: pro.w, height: pro.h, transform: `scale(${PRO_K})`, transformOrigin: '0 0' }}>
        <Badge t={0} at={-30} text="Pro" bg="#ffffff" ring="#7c3aed" ink="#7c3aed" x={0} y={0} />
      </div>
      <ZoneRect what="cover pills (Booked + PRO)" rect={{ x: 86, y: PILLS_Y, w: pill.w + 18 + pro.w * PRO_K, h: pill.h }} />
    </>
  );
};

export const Cover2: React.FC<{ zones?: boolean }> = ({ zones }) => (
  <CoverCard
    zones={zones}
    ground={<Ground2 t={0} keyLight={{ x: lockColon(AT).x, y: AT.cy, strength: 0.56, color: SUNDAY.orb[1], radius: 520, pool: 'deep' }} />}
    art={<Art />}
    spec={{
      reel: 'ig2',
      night: true,
      kicker: 'AI receptionist · 02',
      title: 'Booked at 9:47 pm.',
      accent: { word: 'Booked', ink: '#a5eaf5' },
      rows: [2],
      size: 128,
      titleY: TITLE_Y,
    }}
  />
);
