/**
 * The reels' voice lookup for the SHARED React parts (docs/ig/ig5/PIPELINE.md §3.2 edits 4–8): components/Captions,
 * End, Orb, Call and screens import VOICE from here instead of '../voice.generated', so they can read ig5's lines
 * (src/ig/ig5/voice.generated.ts) and ig6's (src/ig/ig6/voice.generated.ts, docs/ig/ig6/PIPELINE.md §3.2 edit 4) as
 * well as ig1–ig4's (src/ig/voice.generated.ts).
 *
 * ig1–ig4's own entries WIN (spread last), then ig5's: every id of theirs — the borrowed sign-off ig1-07 included —
 * resolves to the very same object as before, and VOICE.fps / engine / voices are ig1–ig4's, so their picture cannot
 * change (gate P of scripts/ig5/guard.mjs, now scripts/ig6/guard.mjs for ig1–ig5, proves it byte for byte).
 * Deliberately NOT in src/ig/common/: every .ts there is an input to igHash, the stamp of the four delivered reels. A
 * view only: no file is generated or read at run time.
 */
import { VOICE as IG } from './voice.generated';
import { VOICE as IG5 } from './ig5/voice.generated';
import { VOICE as IG6 } from './ig6/voice.generated';

export const VOICE = { ...IG, lines: { ...IG6.lines, ...IG5.lines, ...IG.lines } };
