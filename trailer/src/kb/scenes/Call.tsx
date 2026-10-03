/** b09–b11 · THE CALL — placeholder card. The live ring, the filler, the stop-time, the answer, the record. */
import React from 'react';
import { ACCENT } from '../theme';
import { CALL_LOCAL as C } from '../timing';
import { ActCard } from './common';

export const Call: React.FC = () => (
  <ActCard
    act="call"
    part="PART III · FOUND BY MEANING"
    beats="b09–b11"
    title="Between question and answer."
    keyPhrase="answer."
    keyAt={C.resume}
    accent={ACCENT.sunday}
    room="paper"
    moments={[C.ring, C.pickup, C.freeze, ...C.links, C.resume, C.record]}
  />
);
