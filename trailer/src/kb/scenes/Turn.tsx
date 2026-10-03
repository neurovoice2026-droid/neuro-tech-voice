/** PART II · b07 · TWO KINDS — placeholder card. The seam; Ava's orb is born on "Ava"; "the first kind". */
import React from 'react';
import { ACCENT } from '../theme';
import { TURN_LOCAL as T, TURN_FLIPS } from '../timing';
import { ActCard } from './common';

export const Turn: React.FC = () => (
  <ActCard
    act="turn"
    part="PART II · THE TURN"
    beats="b07"
    title="Some work repeats. Some work matters."
    keyPhrase="Some work matters."
    keyAt={T.matters}
    accent={ACCENT.sunday}
    room="paper"
    moments={[T.seam[0], ...TURN_FLIPS, T.ava, T.firstKind]}
  />
);
