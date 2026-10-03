/** b12 · YOUR LINE — placeholder card. The owner's line types word by word on 16ths; the save; vo-6. */
import React from 'react';
import { ACCENT } from '../theme';
import { LINE_LOCAL as N } from '../timing';
import { ActCard } from './common';

export const Line: React.FC = () => (
  <ActCard
    act="line"
    part="PART III · YOUR LINE"
    beats="b12"
    title="When the answer isn't in your documents."
    keyPhrase="your documents."
    keyAt={N.save}
    accent={ACCENT.sunday}
    room="paper"
    moments={[N.caret, N.save, N.focus]}
  />
);
