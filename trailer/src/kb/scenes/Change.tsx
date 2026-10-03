/** b13–b14 · CHANGE IT / THE NEXT CALL — placeholder card. The document changes; the same question, the new answer. */
import React from 'react';
import { ACCENT } from '../theme';
import { CHANGE_LOCAL as K } from '../timing';
import { ActCard } from './common';

export const Change: React.FC = () => (
  <ActCard
    act="change"
    part="PART III · CHANGE IT"
    beats="b13–b14"
    title="Change the document."
    keyPhrase="the document."
    keyAt={K.ready5}
    accent={ACCENT.sunday}
    room="paper"
    moments={[K.menu, K.ready5, K.ring, K.pickup, K.four]}
  />
);
