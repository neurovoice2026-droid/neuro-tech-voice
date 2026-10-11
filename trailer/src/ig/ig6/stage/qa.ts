/**
 * REEL 6 · QA CONTEXT: whether the reel renders in zone mode (the IG6-Zones-9x16 stills of check-zones), so the stage can
 * run its own lockup-overlap check there (STYLE.md §9.12: the lockup box x 296–900, y 1080–1400 must stay clear of the
 * object's strokes at every screen onset — the zone guard tests text against the frame only). A breach is logged in the
 * zone guard's own format, so `check:zones:ig -- --film=ig6` fails on it like any other violation. Picture only.
 */
import { createContext, useContext } from 'react';

export const Ig6Qa = createContext<{ zones: boolean }>({ zones: false });
export const useIg6Qa = () => useContext(Ig6Qa);
