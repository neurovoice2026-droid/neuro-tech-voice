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
  /** the shared end card's moments (components/End.tsx IgEnd), absolute frames */
  readonly END_CARD: {
    /** the CTA line starts */
    readonly cta: number;
    /** the comment field rises (before she says "Comment AGENT") */
    readonly field: number;
    /** her word "AGENT": the field types it, one letter per 16th */
    readonly agent: number;
    /** the send disc presses (the CTA line's last word ends) */
    readonly send: number;
    /** the snare roll into the impact (half a bar) */
    readonly roll: number;
    /** the logo impact (the bar line one bar before the end) */
    readonly impact: number;
    /** the sign-off "Neuro Tech Voice." starts */
    readonly brand: number;
    /** the URL's three chunks type on "Neuro" | "Tech" | "Voice" */
    readonly url: readonly number[];
    /** the seam: the last SEAM frames re-form frame 0 */
    readonly seam: number;
  };
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
