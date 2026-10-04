/**
 * b12's LAST PICTURE, handed over and cleared: frame 0 draws b12's agent page exactly as b12 leaves it — line/Panel.tsx's
 * LinePanel at LINE_LOCAL.end (the owner's line saved, the sunday ring settled, the pointer hidden since Save's release)
 * — so the cut is the same picture. Then the page LEAVES (critic fix, build B; polish pass): it recedes a depth (scale .9
 * about its centre), takes a shade and eases out to the left while the owner's own file (change/FilePage.tsx) comes in
 * OVER it and the page fades out beneath that paper (stage.ts handoffPose): one card is always there, no page is ever
 * seen empty.
 */
import React from 'react';
import { subpixel } from '../../../lib/glide';
import { LINE_LOCAL } from '../../timing';
import { LinePanel, usePageGeometry } from '../line/Panel';
import { lineStage } from '../line/stage';
import { handoffPose, type ChangeStage } from './stage';

export const Handoff: React.FC<{ t: number; S: ChangeStage; ink: string; accent: string }> = ({ t, S, ink, accent }) => {
  const LS = lineStage(S.vertical);
  const G = usePageGeometry(LS);
  const hp = handoffPose(t, S);
  if (!hp.on) return null;
  const P = G.panel;
  const cx = P.x + P.w / 2;
  const cy = P.y + P.h / 2;
  const tf = hp.q > 0 || hp.scale !== 1 ? `translate(${hp.dx.toFixed(3)}px, 0px) scale(${hp.scale.toFixed(5)})` : undefined;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: S.W,
        height: S.H,
        transformOrigin: `${cx.toFixed(2)}px ${cy.toFixed(2)}px`,
        opacity: hp.opacity >= 0.999 ? undefined : hp.opacity,
        ...subpixel(tf, hp.moving),
      }}
    >
      <LinePanel t={LINE_LOCAL.end} S={LS} G={G} ink={ink} accent={accent} />
      {/* the shade of a page stepping back (the kit Panel's own idiom), over its rounded box only */}
      {hp.shade > 0.001 ? <div style={{ position: 'absolute', left: P.x, top: P.y, width: P.w, height: P.h, borderRadius: P.radius, background: `rgba(20, 10, 36, ${hp.shade.toFixed(4)})` }} /> : null}
    </div>
  );
};

/** where b12 left the pointer (Save changes, line/Panel.tsx cursorKeys): this act's cursor comes back from there */
export function useLinePointer(vertical: boolean) {
  const G = usePageGeometry(lineStage(vertical));
  return { x: G.save.x + G.save.w * 0.5, y: G.save.y + G.save.h * 0.56 };
}
