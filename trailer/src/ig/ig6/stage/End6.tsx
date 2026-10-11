/**
 * REEL 6 · THE END CARD — STUB (the infrastructure step). The white End6 of docs/ig/ig6/STYLE.md §9.10 / SCRIPT.md §8
 * (the CTA lockup "Comment / AGENT" in the reel's type, a local white comment field with the long shadow, the teal dome
 * as the send disc that flies to stamp NEUROVOICE's full stop, the URL on "Neuro | Tech | Voice", the seam re-forming
 * frame 0) is the scene build's. Until then this is SCRIPT §8's FALLBACK: the series' shared card (components/End.tsx
 * IgEnd, unchanged) with tone "pearl" on ig6's flat white — the CTA caption with AGENT in teal, the comment field typing
 * AGENT one letter per 16th, the impact on f780, the NEUROVOICE wordmark, neurotechvoice.com in three chunks — and, in
 * the seam, the frame-0 lockup (S1a at 72 %) re-forming.
 *
 * Built from End.tsx's exports only (endAct → IgEnd): no shared file is edited.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { endAct } from '../../components/End';
import { Frame0Lockup } from '../acts/Placeholder';
import * as T from '../timing';
import { INK } from './style';

const White: React.FC = () => <AbsoluteFill style={{ background: INK.ground }} />;

export const End6: React.FC = endAct(T, { tone: 'pearl', ground: () => <White />, seam: () => <Frame0Lockup /> });
