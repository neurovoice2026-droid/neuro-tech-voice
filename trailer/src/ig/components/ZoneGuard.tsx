/**
 * THE ZONE GUARD (docs/ig/PIPELINE.md §7). Every text-bearing part reports its measured rect (1080×1920 frame px) with
 * <ZoneRect>. Outside the IG-QA compositions it renders nothing. In zone mode (`zones`, the IG<n>-Zones-9x16 comps and
 * covers rendered with --props='{"zones":true}') it outlines each rect — green inside the rules, red when it breaks one
 * — and logs every violation with console.error:
 *   [ig-zones] VIOLATION <reel> f<frame> <what> {"x":…,"y":…,"w":…,"h":…} <why>
 * scripts/ig/check-zones.mjs renders the zone stills and fails on any such line. <ZoneOverlay> paints the platform's
 * bands (header, caption/username, the right rail), the side margins and the 3:4 grid crop.
 *
 * Mesh, orbs and hairlines are exempt: they are not text.
 */
import React, { createContext, useContext } from 'react';
import { AbsoluteFill } from 'remotion';
import { FONT } from '../../theme';
import { ZONES, coverFaults, zoneFaults, type Rect } from '../common/zones';

type ZoneState = { on: boolean; reel: string; frame: number; cover: boolean };
const ZoneCtx = createContext<ZoneState>({ on: false, reel: '', frame: 0, cover: false });
/** set once per reel / cover, outside the act sequences (so `frame` is the absolute timeline frame) */
export const ZoneProvider = ZoneCtx.Provider;

const RED = '#ff1f3d';
const OK = 'rgba(0, 150, 110, 0.9)';

/** A text block's rect. In zone mode: outlined, and every broken rule logged as a VIOLATION. */
export const ZoneRect: React.FC<{ what: string; rect: Rect }> = ({ what, rect }) => {
  const z = useContext(ZoneCtx);
  if (!z.on) return null;
  const faults = z.cover ? coverFaults(rect) : zoneFaults(rect);
  const r = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) };
  if (faults.length) console.error(`[ig-zones] VIOLATION ${z.reel} f${Number(z.frame.toFixed(2))} ${what} ${JSON.stringify(r)} ${faults.join('; ')}`);
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        outline: `3px solid ${faults.length ? RED : OK}`,
        background: faults.length ? 'rgba(255, 31, 61, 0.16)' : 'transparent',
        pointerEvents: 'none',
      }}
    />
  );
};

const band = (top: number, height: number, left = 0, width: number = ZONES.frame.w): React.CSSProperties => ({
  position: 'absolute',
  left,
  top,
  width,
  height,
  background: 'repeating-linear-gradient(45deg, rgba(255, 31, 61, 0.16) 0 14px, rgba(255, 31, 61, 0.05) 14px 28px)',
  borderTop: '2px solid rgba(255, 31, 61, 0.6)',
  borderBottom: '2px solid rgba(255, 31, 61, 0.6)',
});
const tag: React.CSSProperties = { position: 'absolute', fontFamily: FONT.mono, fontSize: 22, color: 'rgba(160, 0, 30, 0.95)', background: 'rgba(255,255,255,0.75)', padding: '2px 8px' };

/** The platform's no-text bands, the side margins and the 3:4 crop (zone mode only). */
export const ZoneOverlay: React.FC<{ cover?: boolean }> = ({ cover = false }) => {
  const Z = ZONES;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={band(0, Z.top)} />
      <div style={band(Z.bottom, Z.frame.h - Z.bottom)} />
      <div style={band(Z.rail.y0, Z.rail.y1 - Z.rail.y0, Z.rail.x, Z.frame.w - Z.rail.x)} />
      <div style={{ ...band(0, Z.frame.h, 0, Z.side), borderTop: 'none', borderBottom: 'none' }} />
      <div style={{ ...band(0, Z.frame.h, Z.frame.w - Z.side, Z.side), borderTop: 'none', borderBottom: 'none' }} />
      {[Z.crop34.y0, Z.crop34.y1].map((y) => (
        <div key={y} style={{ position: 'absolute', left: 0, top: y - 1, width: Z.frame.w, height: 0, borderTop: '2px dashed rgba(20, 20, 160, 0.8)' }} />
      ))}
      {cover ? (
        <div style={{ position: 'absolute', left: Z.cover.x0, top: Z.cover.y0, width: Z.cover.x1 - Z.cover.x0, height: Z.cover.y1 - Z.cover.y0, outline: '2px dashed rgba(20, 20, 160, 0.8)' }} />
      ) : null}
      <div style={{ ...tag, left: 70, top: 196 }}>top UI · text y ≥ {Z.top}</div>
      <div style={{ ...tag, left: 70, top: Z.bottom + 8 }}>caption / username / audio · text y ≤ {Z.bottom}</div>
      <div style={{ ...tag, left: Z.rail.x - 250, top: Z.rail.y0 + 8 }}>rail x &gt; {Z.rail.x}</div>
      <div style={{ ...tag, left: 70, top: Z.crop34.y1 + 6, color: 'rgba(20, 20, 160, 0.95)' }}>3:4 grid crop y {Z.crop34.y0}–{Z.crop34.y1}</div>
    </AbsoluteFill>
  );
};
