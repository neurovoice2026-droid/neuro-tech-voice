/**
 * THE L-CUT (SCRIPT.md b14, 72.75 on the plan): under her last words the frame CROSSES BACK TO THE DESK — one camera
 * move against the reading direction (change/stage.ts crossPush; 16:9 the call slides out left, 9:16 up).
 *
 * Critic fix, build B: the old push carried both pictures a whole frame in 12 frames (peaks of 114 px per 120 fps frame,
 * strobing into copies at share rates). Now ONE curve (24 frames, a sine in-out) drives it all: this act's picture is
 * carried out 40 % of the frame, b15's first picture (scenes/Matters.tsx MattersDesk at t ≤ 0: its MUTED_MESH ground on
 * the timeline's clock, the desk, the clock with Ava's teal dot) is carried in by the same 40 %, and a soft edge of
 * CONSTANT width crosses the frame on the same curve, handing the grounds over under it (the mask is in screen space, on
 * a still element; the desk moves inside it on its own layer). Its width never changes, so nothing reshapes the leading
 * edge's motion. The push lands at rest on the act's last frame: the cut into b15 is the same picture.
 *
 * Viewer fix (fix:lcut): NO TEXT ON TEXT. Only the GROUNDS meet under the soft edge: in this act's picture everything
 * standing on its ground (ChangeGround, carried as before) is wiped off by a short soft edge that runs just AHEAD of
 * the grounds' ramp (PushWipe: clear from `edge − feather`); b15's desk (MattersDesk part="desk": card,
 * reply, slips, clock, dot) is revealed by the same short edge just BEHIND it (opaque ground from `edge`, desk from
 * `edge + CLEAR`). So across the ramp there is ground and ground only, and the two pictures' cards, slips and lines are
 * never drawn over one another. 9:16, the call's transcript is carried up toward the platform's top zone: it clears
 * through a soft band in screen space under it (TOP_ZONE … + TOP_FADE) — no word of it is drawn in the top 250 px.
 * Nothing changes at rest: before the push and on its landing frame the picture is the same tree as before (the
 * wrappers are display: contents, no masks), and MattersDesk without `part` is the whole picture, so b15 (and the cut
 * into it) is untouched.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { subpixel } from '../../../lib/glide';
import { CHANGE_LOCAL as K } from '../../timing';
import { MattersDesk } from '../Matters';
import { crossPush, type ChangeStage } from './stage';

/** the short soft edge that wipes this act's cards off ahead of the grounds' ramp and reveals b15's desk behind it (px) */
const CLEAR = 40;
/** 9:16: the platform's top zone (frame px) — the outgoing transcript is fully clear above it … */
const TOP_ZONE = 250;
/** … and whole from this far under it (its topmost piece at rest, SAME QUESTION at y 402, is below the band) */
const TOP_FADE = 120;

/** a soft ramp in SCREEN px along the axis over [a, a + w]: rising (clear before a, opaque from a + w) or falling */
function ramp(axis: 'x' | 'y', a: number, w: number, rising: boolean) {
  const N = 10;
  const dir = axis === 'x' ? 'to right' : 'to bottom';
  const stops: string[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const s = u * u * (3 - 2 * u);
    stops.push(`rgba(0,0,0,${(rising ? s : 1 - s).toFixed(4)}) ${(a + w * u).toFixed(2)}px`);
  }
  return `linear-gradient(${dir}, ${stops.join(', ')})`;
}

const maskStyle = (mask: string | undefined) => (mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined);
const shift = (S: ChangeStage, d: number) => (S.cross.axis === 'x' ? `translate(${d.toFixed(3)}px, 0px)` : `translate(0px, ${d.toFixed(3)}px)`);

/**
 * A wrapper that is NO BOX at rest (display: contents: the picture is laid out, layered and painted exactly as without
 * it — no frame outside the push changes) and, while a mask is given, a full-frame layer (AbsoluteFill's own box)
 * carrying it.
 */
const MaskBox: React.FC<{ mask: string | undefined; children: React.ReactNode }> = ({ mask, children }) => (
  <div
    style={
      mask
        ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', WebkitMaskImage: mask, maskImage: mask }
        : { display: 'contents' }
    }
  >
    {children}
  </div>
);

/** the outgoing picture: this act's frame, carried out by the push */
export const PushOut: React.FC<{ t: number; S: ChangeStage; children: React.ReactNode }> = ({ t, S, children }) => {
  const cp = crossPush(t, S);
  const tf = cp.p > 0 ? shift(S, cp.out) : undefined;
  return <AbsoluteFill style={subpixel(tf, cp.moving)}>{children}</AbsoluteFill>;
};

/**
 * Inside PushOut, everything but the ground: wiped off by the short edge running just ahead of the grounds' ramp (clear
 * from screen `edge − feather`; its local coordinates are the screen's − the push).
 */
export const PushWipe: React.FC<{ t: number; S: ChangeStage; children: React.ReactNode }> = ({ t, S, children }) => {
  const cp = crossPush(t, S);
  const on = cp.p > 0 && cp.p < 1;
  return <MaskBox mask={on ? ramp(S.cross.axis, cp.edge - cp.feather - CLEAR - cp.out, CLEAR, false) : undefined}>{children}</MaskBox>;
};

/**
 * 9:16, inside PushOut: the call's transcript clears through a soft band under the platform's top zone as the push
 * carries it up (screen TOP_ZONE … + TOP_FADE); 16:9 (a sideways push) and at rest it is drawn as is.
 */
export const PushTop: React.FC<{ t: number; S: ChangeStage; children: React.ReactNode }> = ({ t, S, children }) => {
  const cp = crossPush(t, S);
  const on = S.cross.axis === 'y' && cp.p > 0 && cp.p < 1;
  return <MaskBox mask={on ? ramp('y', TOP_ZONE - cp.out, TOP_FADE, true) : undefined}>{children}</MaskBox>;
};

export const Cross: React.FC<{ t: number; S: ChangeStage }> = ({ t, S }) => {
  const cp = crossPush(t, S);
  if (!cp.on || cp.p <= 0) return null;
  const dt = Math.min(0, t - K.end);
  // landed: the whole of b15's first picture, at rest (the cut is the same picture)
  if (cp.p >= 1) {
    return (
      <AbsoluteFill>
        <AbsoluteFill style={subpixel(undefined, cp.moving)}>
          <MattersDesk t={dt} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  const tf = shift(S, cp.in);
  const ax = S.cross.axis;
  return (
    <>
      {/* the grounds hand over under the soft edge: clear before edge − feather, opaque from edge */}
      <AbsoluteFill style={maskStyle(ramp(ax, cp.edge - cp.feather, cp.feather, true))}>
        <AbsoluteFill style={subpixel(tf, cp.moving)}>
          <MattersDesk t={dt} part="ground" />
        </AbsoluteFill>
      </AbsoluteFill>
      {/* the desk only where its ground is already whole */}
      <AbsoluteFill style={maskStyle(ramp(ax, cp.edge, CLEAR, true))}>
        <AbsoluteFill style={subpixel(tf, cp.moving)}>
          <MattersDesk t={dt} part="desk" />
        </AbsoluteFill>
      </AbsoluteFill>
    </>
  );
};
