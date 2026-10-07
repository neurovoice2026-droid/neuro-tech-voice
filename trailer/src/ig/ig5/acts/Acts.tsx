/**
 * REEL 5 · "Don't pay $300" — THE ACTS (docs/ig/ig5/SCRIPT.md §2), PROVISIONAL: every act but the end is the
 * foundation's placeholder title card (components/TitleCard.tsx: the act, its window, the lines placed in it, and the
 * current screen in the caption band, its words lighting on her onsets — the display map's $300 / $1,500 / $99 / 50 /
 * $49 over the spoken words), on the reel's real timeline (../timing.ts). The end is the series' shared end card
 * (components/End.tsx IgEnd: the CTA caption, the comment field typing AGENT, the impact, the NEUROVOICE wordmark and
 * the URL) on the pearl.
 *
 * The scene build replaces the entries of ACTS5 one by one (each a React.FC mounted in its act's <Sequence>), in ig4's
 * shape (acts/Acts.tsx there): the slips, the square-up, ours, the setup dots, the call record — and the end's backdrop,
 * orb and frame-0 seam.
 */
import React from 'react';
import { endAct } from '../../components/End';
import { PearlGround } from '../../components/Ground';
import { titleCard } from '../../components/TitleCard';
import * as T from '../timing';

/** the shared end card on the reel's pearl (no backdrop / orb / seam until the acts exist) */
const End5 = endAct(T, { tone: 'pearl', ground: (tm) => <PearlGround t={tm} /> });

const BUILT: { readonly [key: string]: React.FC } = { end: End5 };

export const ACTS5: { readonly [key: string]: React.FC } = Object.fromEntries(T.ORDER.map((k) => [k, BUILT[k] ?? titleCard(T, k)]));
