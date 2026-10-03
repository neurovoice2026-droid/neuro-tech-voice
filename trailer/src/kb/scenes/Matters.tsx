/** PART IV · b15–b16 · WORK THAT MATTERS — placeholder card. The desk; the ring Ava takes; a bar of room tone; vo-8. */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { EASE, tween } from '../../lib/motion';
import { ROOM } from '../../theme';
import { useKbSceneFrame } from '../scene';
import { ACCENT } from '../theme';
import { MATTERS_LOCAL as M } from '../timing';
import { ActCard } from './common';

export const Matters: React.FC = () => {
  const t = useKbSceneFrame('matters');
  // b16's last three beats: the paper darkens into night (the close starts on the bar)
  const dark = tween(t, [M.dark[0], M.dark[1]], [0, 1], EASE.inOut);
  return (
    <>
      <ActCard
        act="matters"
        part="PART IV · WORK THAT MATTERS"
        beats="b15–b16"
        title="That's the work only people can do."
        keyPhrase="only people can do."
        keyAt={M.vo8}
        accent={ACCENT.sunday}
        room="paper"
        moments={[M.nervous, M.ring, M.label, M.do]}
      />
      {dark > 0.001 ? <AbsoluteFill style={{ background: ROOM.night, opacity: dark }} /> : null}
    </>
  );
};
