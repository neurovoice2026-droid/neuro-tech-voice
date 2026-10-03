/**
 * PART I · THE REPEAT (b01–b05) — placeholder card. Three rings, three callers, the same answer three
 * times (kb2-desk-1, the identical file); the clock rolls through the rest of the day; the hard stop.
 */
import React from 'react';
import { Label } from '../../components/Type';
import { useLayout } from '../../lib/layout';
import { useKbSceneFrame } from '../scene';
import { ACCENT } from '../theme';
import { REPEAT_LOCAL as R } from '../timing';
import { ActCard } from './common';

/** the clock (SCRIPT.md b01–b05): 09:13 → 09:14 on ring one → 11:02 → 14:30 → the rolls → still at the stop */
const ROLL_TIMES = ['15:05', '15:41', '16:20', '16:58', '17:26', '17:58'];
const clockAt = (t: number) => {
  const rolled = R.rolls.filter((f) => t >= f).length;
  if (rolled) return ROLL_TIMES[Math.min(rolled, ROLL_TIMES.length) - 1];
  return t >= R.rings[2] ? '14:30' : t >= R.rings[1] ? '11:02' : t >= R.rings[0] ? '09:14' : '09:13';
};

export const Repeat: React.FC = () => {
  const L = useLayout();
  const t = useKbSceneFrame('repeat');
  return (
    <ActCard
      act="repeat"
      part="PART I · THE REPEAT"
      beats="b01–b05"
      title="The same question, the same answer."
      keyPhrase="the same answer."
      keyAt={R.rings[2]}
      accent={ACCENT.rush}
      room="paper"
      moments={[...R.rings, ...R.slips, ...R.rolls]}
    >
      <div style={{ position: 'absolute', right: L.safe.x + 40, top: L.pick(150, 270), textAlign: 'right' }}>
        <Label tone="paper" color={ACCENT.muted}>{`TUE ${clockAt(t)} · LINE 1`}</Label>
      </div>
    </ActCard>
  );
};
