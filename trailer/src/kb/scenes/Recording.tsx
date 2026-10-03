/** b06 · A RECORDING — placeholder card. vo-1 after the hard stop; "Waiting." locks in on its bar. */
import React from 'react';
import { ACCENT } from '../theme';
import { RECORDING_LOCAL as R } from '../timing';
import { ActCard } from './common';

export const Recording: React.FC = () => (
  <ActCard
    act="recording"
    part="PART I · A RECORDING"
    beats="b06"
    title="The phone turned them into a recording."
    keyPhrase="a recording."
    keyAt={R.recordingKey}
    accent={ACCENT.rush}
    room="paper"
    moments={[R.title1, R.title2, R.waiting]}
  />
);
