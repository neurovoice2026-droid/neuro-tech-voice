/** PART III · b08 · WRITTEN ONCE — placeholder card. The rows land on their nouns; the eyebrow on "knowledge". */
import React from 'react';
import { ACCENT } from '../theme';
import { WRITTEN_LOCAL as W } from '../timing';
import { ActCard } from './common';

export const Written: React.FC = () => (
  <ActCard
    act="written"
    part="PART III · WRITTEN ONCE"
    beats="b08"
    title="That's your knowledge base."
    keyPhrase="knowledge base."
    keyAt={W.knowledge}
    accent={ACCENT.sunday}
    room="paper"
    moments={[W.once, ...W.rows, ...W.ready, W.knowledge]}
  />
);
