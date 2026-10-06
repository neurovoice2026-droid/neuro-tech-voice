/**
 * REEL 4 · THE FIVE DOCUMENTS (docs/ig/SCRIPT.md ig4 b6, b8, b9, end): the sample studio's knowledge base as the
 * Knowledge tab lists it (components/agent/tabs/TabKnowledge.tsx DocumentRow: a bordered white row, the icon tile —
 * the app's muted square with lucide FileText, Globe for a web page — the name in font-medium, the muted TYPE_LABELS
 * word), the site's own five (lib/pages/knowledge-base.ts ROOM.docs: Price list · PDF, Cancellation policy · Word,
 * Aftercare · Markdown, Opening hours · Text, FAQ page · Web page), 32 px chrome.
 *
 *   b6   on the curveball's ring the price list folds into the first row; the other four land on 16ths
 *   b8   they step back behind the owner's field
 *   b9   they come forward at full ink under the thesis: the knowledge base at rest
 *   end  they pull back and up behind the CTA (a compact stack above it), and go out under the card's light
 *
 * Every row is its own small layer, posed by transform from the stack's pose (z about the stack's anchor + a shift).
 */
import React from 'react';
import { subpixel } from '../../lib/glide';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { APP, Icon, meshElevation, meshShadowInk, ui, useKitFaces, W } from '../../kb/kit';
import { KB_MESH } from '../../kb/palettes';
import { ZoneRect } from '../components/ZoneGuard';
import { ROWS, rowY } from './layout';

/** the stack's pose: scale z about (ax, ay), then a shift; its ink (opacity) and a shade (stepping back) */
export type StackPose = { z: number; ax: number; ay: number; dx: number; dy: number; opacity: number; shade: number; moving: boolean };
export const REST: StackPose = { z: 1, ax: 540, ay: ROWS.y, dx: 0, dy: 0, opacity: 1, shade: 0, moving: false };

const PAD = 22;
const TILE = 56;

/** a row's face (row px): the icon tile, the name, the type word — also drawn by the folding paper (Stage.tsx FoldCard) */
export const RowFace: React.FC<{ k: number }> = ({ k }) => {
  const d = ROWS.docs[k];
  const H = ROWS.h;
  return (
    <>
      <div style={{ position: 'absolute', left: PAD, top: (H - TILE) / 2, width: TILE, height: TILE, borderRadius: 12, background: APP.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', color: APP.mutedFg }}>
        <Icon name={d.kind === 'url' ? 'globe' : 'fileText'} size={27} stroke={2} />
      </div>
      <div style={{ position: 'absolute', left: PAD * 2 + TILE, top: (H - ROWS.size * 1.2) / 2, ...ui(ROWS.size, W.medium), color: APP.foreground }}>{d.name}</div>
      <div style={{ position: 'absolute', right: PAD + 6, top: (H - 28 * 1.2) / 2, ...ui(28, W.regular), color: APP.mutedFg }}>{d.type}</div>
    </>
  );
};

export const KbRows: React.FC<{
  t: number;
  /** each row's landing (row 0: it appears in place as the page folds into it) */
  lands: readonly number[];
  pose: StackPose;
}> = ({ t, lands, pose }) => {
  const ready = useKitFaces();
  if (!ready || t < lands[0] - 1 || pose.opacity <= 0.002) return null;
  const ink = meshShadowInk(KB_MESH);
  const H = ROWS.h;
  return (
    <>
      {ROWS.docs.map((d, k) => {
        const at = lands[k];
        if (t < at - 0.5) return null;
        // the landing: row 0 grows in place out of the folding page; the others drop in on the landing spring
        // (row 0 lands ON the folded paper — same box: only its face fades up, nothing moves)
        const s = springUnit(t - at, SPRING.land);
        // (the others rise into place from just below — never over the row above)
        const ly = k === 0 ? 0 : (1 - s) * 0.26 * H;
        const lsc = k === 0 ? 1 : mix(0.985, 1, Math.min(1, s));
        const lo = k === 0 ? tween(t, [at - 1, at + 4], [0, 1], EASE.inOut) : smooth(0, 0.3, s);
        const landing = Math.abs(1 - s) > 1e-3;
        // the stack's pose
        const bx = ROWS.x;
        const by = rowY(k) + ly;
        const x = pose.ax + pose.z * (bx - pose.ax) + pose.dx;
        const y = pose.ay + pose.z * (by - pose.ay) + pose.dy;
        const sc = pose.z * lsc;
        // scale about the row's centre for the landing: shift so the centre stays put
        const ox = (ROWS.w * pose.z * (1 - lsc)) / 2;
        const oy = (H * pose.z * (1 - lsc)) / 2;
        const moving = pose.moving || landing;
        const o = lo * pose.opacity;
        if (o <= 0.002) return null;
        const tf = `translate(${(x + ox).toFixed(3)}px, ${(y + oy).toFixed(3)}px)${Math.abs(sc - 1) > 1e-6 ? ` scale(${sc.toFixed(6)})` : ''}`;
        return (
          <React.Fragment key={k}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: ROWS.w,
                height: H,
                borderRadius: 20,
                background: APP.card,
                boxShadow: `inset 0 0 0 1.25px ${APP.border}, ${meshElevation(0.7, ink, 0.8)}`,
                transformOrigin: '0 0',
                opacity: o >= 0.999 ? undefined : o,
                ...subpixel(tf, moving),
              }}
            >
              <RowFace k={k} />
              {pose.shade > 0.001 ? <div style={{ position: 'absolute', inset: 0, borderRadius: 20, background: `rgba(20, 10, 36, ${pose.shade.toFixed(4)})` }} /> : null}
            </div>
            {o > 0.5 ? <ZoneRect what={`document row ${d.name}`} rect={{ x: x + (PAD * 2 + TILE) * sc, y: y + ((H - ROWS.size * 1.2) / 2) * sc, w: (ROWS.w - PAD * 3 - TILE) * sc, h: ROWS.size * 1.2 * sc }} /> : null}
          </React.Fragment>
        );
      })}
    </>
  );
};

/** a stack pose between two (u 0 → 1) */
export const blendPose = (a: StackPose, b: StackPose, u: number): StackPose => ({
  z: mix(a.z, b.z, u),
  ax: mix(a.ax, b.ax, u),
  ay: mix(a.ay, b.ay, u),
  dx: mix(a.dx, b.dx, u),
  dy: mix(a.dy, b.dy, u),
  opacity: mix(a.opacity, b.opacity, u),
  shade: mix(a.shade, b.shade, u),
  moving: a.moving || b.moving || (u > 0 && u < 1),
});
