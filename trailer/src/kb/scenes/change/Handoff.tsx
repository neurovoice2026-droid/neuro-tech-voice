/**
 * b12's LAST PICTURE, handed over and cleared: frame 0 draws b12's agent page exactly as b12 leaves it — line/Panel.tsx's
 * LinePanel at LINE_LOCAL.end (the owner's line saved, the sunday ring settled, the pointer hidden on Save changes) — so
 * the cut is the same picture. Then the app SINKS BACK (a step of depth: scale .94 about its centre, a little down,
 * fading in its second half) as the owner's own file comes forward over it (change/FilePage.tsx): the edit happens
 * outside the app.
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
  const hp = handoffPose(t);
  if (!hp.on) return null;
  const P = G.panel;
  const cx = P.x + P.w / 2;
  const cy = P.y + P.h / 2;
  const tf = hp.q > 0 ? `translate(0px, ${hp.dy.toFixed(3)}px) scale(${hp.scale.toFixed(5)})` : undefined;
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
    </div>
  );
};

/** where b12 left the pointer (Save changes, line/Panel.tsx cursorKeys): this act's cursor comes back from there */
export function useLinePointer(vertical: boolean) {
  const G = usePageGeometry(lineStage(vertical));
  return { x: G.save.x + G.save.w * 0.5, y: G.save.y + G.save.h * 0.56 };
}
