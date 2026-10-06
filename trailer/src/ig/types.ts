/**
 * What the React side reads of a reel's timeline (src/ig/<reel>/timing.ts): the structural contract every reel's
 * module satisfies, so the shared shell (Reel.tsx, the placeholder title cards, the zone overlay) works on any of them.
 * Function members are declared as methods (bivariant parameters): each reel narrows `id` to its own VoiceId.
 */
import type { Display, LineScreens } from './common/series';
import type { Acts } from './scene';

export type ReelTimeline = {
  readonly REEL: string;
  readonly TITLE: string;
  readonly DURATION: number;
  readonly IMPACT: number;
  readonly BRAND_AT: number;
  readonly SCENES: Acts;
  readonly ORDER: readonly string[];
  readonly MIX: { readonly file: string };
  readonly VOICES: readonly { readonly at: number; readonly id: string }[];
  readonly SCREENS: { readonly [id: string]: LineScreens };
  readonly DISPLAY: readonly Display[];
  readonly GRAIN: { readonly ground: 'pearl' | 'night' };
  readonly END_CARD: { readonly cta: number; readonly field: number; readonly impact: number; readonly brand: number; readonly seam: number };
  vWord(id: string, k: number): number;
  vFrames(id: string): number;
};

export type ReelProps = {
  /** one act only (the IG-Scenes compositions), on the real timeline */
  only?: string;
  /** play the reel's mix (off for acts, zone stills and covers) */
  audio?: boolean;
  /** the zone overlay + violation logger (the IG-QA compositions, scripts/ig/check-zones.mjs) */
  zones?: boolean;
  /** check-zones --selftest: one deliberately misplaced text rect (on the right rail), to prove a violation is caught */
  zoneProbe?: boolean;
};
