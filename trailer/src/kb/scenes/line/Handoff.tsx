/**
 * b11's LAST PICTURE, handed over and cleared (SCRIPT.md b12: "the record row slides away"): frame 0 draws the call's
 * record row and its Opening hours page exactly as b11 leaves them — call/Answer.tsx's RecordRow (the kit's) and
 * call/Page.tsx's OpeningHoursPage at CALL_LOCAL.end — so the cut is the same picture. Then both leave UP together
 * (power3.in, fading in the second half), the next screen rising in under them from below (line/Panel.tsx): one
 * direction, like a page of the app scrolling on.
 */
import React from 'react';
import { subpixel } from '../../../lib/glide';
import { RecordRow } from '../../kit';
import { MOMENT_LIGHTS } from '../../palettes';
import { CALL_LOCAL as C } from '../../timing';
import { OpeningHoursPage, usePage } from '../call/Page';
import { callStageOf, leavePose, type LineStage } from './stage';

const SUNDAY = MOMENT_LIGHTS.sunday.ink;

export const Handoff: React.FC<{ t: number; S: LineStage; ink: string }> = ({ t, S, ink }) => {
  const CS = callStageOf(S);
  const g = usePage(CS);
  const lp = leavePose(t, S);
  if (!lp.on) return null;
  const tf = `translate(0px, ${lp.dy.toFixed(3)}px)`;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: S.W, height: S.H, opacity: lp.opacity >= 0.999 ? undefined : lp.opacity, ...subpixel(lp.dy !== 0 ? tf : undefined, lp.moving) }}>
      <OpeningHoursPage t={C.end} S={CS} g={g} ink={ink} />
      <RecordRow t={C.end} x={CS.record.x} y={CS.record.y} w={CS.record.w} at={C.record} checkAt={C.check} accent={SUNDAY} size={CS.record.size} ink={ink} />
    </div>
  );
};
