/**
 * REEL 5 · ITS ZONE OVERLAY AND REGISTRATION (docs/ig/ig5/SCRIPT.md §1.2–1.3): ig5's combined TikTok + Instagram rule
 * (../zones.ts) handed to the shared zone guard (components/ZoneGuard registerZones), so the IG5-Zones-9x16 stills and
 * the cover are checked against it, and the overlay paints ig5's bands instead of Instagram's: the header (0–240), the
 * bottom (1400–1920: TikTok's caption / username / sound block and Instagram's), the text margins (x < 86, x > 900),
 * TikTok's right rail (x > 880 below y 840, objects included), the 3:4 grid crop and, on the cover, its word box.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { FONT } from '../../../theme';
import { registerZones } from '../../components/ZoneGuard';
import { IG5_ZONES, ig5CoverFaults, ig5Faults } from '../zones';

const Z = IG5_ZONES;
const band = (left: number, top: number, width: number, height: number): React.CSSProperties => ({
  position: 'absolute',
  left,
  top,
  width,
  height,
  background: 'repeating-linear-gradient(45deg, rgba(255, 31, 61, 0.16) 0 14px, rgba(255, 31, 61, 0.05) 14px 28px)',
  outline: '2px solid rgba(255, 31, 61, 0.5)',
});
const tag: React.CSSProperties = { position: 'absolute', fontFamily: FONT.mono, fontSize: 22, color: 'rgba(160, 0, 30, 0.95)', background: 'rgba(255,255,255,0.75)', padding: '2px 8px' };

export const Ig5ZoneOverlay: React.FC<{ cover: boolean }> = ({ cover }) => {
  const B = Z.bands;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={band(0, 0, Z.frame.w, B.header)} />
      <div style={band(0, B.bottom, Z.frame.w, Z.frame.h - B.bottom)} />
      <div style={band(0, B.header, B.side, B.bottom - B.header)} />
      <div style={band(Z.text.x1, B.header, Z.frame.w - Z.text.x1, B.rail.y0 - B.header)} />
      <div style={band(Z.object.x1, B.rail.y0, Z.frame.w - Z.object.x1, B.bottom - B.rail.y0)} />
      <div style={{ position: 'absolute', left: 0, top: Z.price.y0 - 1, width: Z.frame.w, borderTop: '2px dotted rgba(200, 120, 0, 0.8)' }} />
      <div style={{ position: 'absolute', left: 0, top: Z.price.y1 - 1, width: Z.frame.w, borderTop: '2px dotted rgba(200, 120, 0, 0.8)' }} />
      {[B.crop34.y0, B.crop34.y1].map((y) => (
        <div key={y} style={{ position: 'absolute', left: 0, top: y - 1, width: Z.frame.w, height: 0, borderTop: '2px dashed rgba(20, 20, 160, 0.8)' }} />
      ))}
      {cover ? (
        <div style={{ position: 'absolute', left: Z.cover.x0, top: Z.cover.y0, width: Z.cover.x1 - Z.cover.x0, height: Z.cover.y1 - Z.cover.y0, outline: '2px dashed rgba(20, 20, 160, 0.8)' }} />
      ) : null}
      <div style={{ ...tag, left: 70, top: 196 }}>ig5 · top UI · text y ≥ {B.header}</div>
      <div style={{ ...tag, left: 70, top: B.bottom + 8 }}>TikTok + IG bottom · text y ≤ {B.bottom}</div>
      <div style={{ ...tag, left: Z.object.x1 - 330, top: B.rail.y0 + 8 }}>TikTok rail · x &gt; {Z.object.x1} from y {B.rail.y0}</div>
      <div style={{ ...tag, left: 70, top: Z.price.y0 + 4, color: 'rgba(150, 90, 0, 0.95)' }}>price numerals y {Z.price.y0}–{Z.price.y1}</div>
    </AbsoluteFill>
  );
};

/** register ig5's rule with the guard (idempotent; Reel5 and Cover5 call it at module scope) */
export function registerIg5Zones(): void {
  registerZones('ig5', { faults: ig5Faults, coverFaults: ig5CoverFaults, overlay: Ig5ZoneOverlay });
}
