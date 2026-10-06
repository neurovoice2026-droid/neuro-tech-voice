/**
 * PLACEHOLDER COVER (the foundation): the cover's words where SCRIPT.md §5 puts them — the kicker (label role) and the
 * title (128 / 140 px, one accent word), measured and wrapped to ≤ 844 px, inside the cover box x 86–930, y 260–1500
 * (the 3:4 grid crop) — over the reel's ground, with a marked box where the reel's art goes. The reels' own covers
 * (src/ig/<reel>/Cover.tsx) replace the art box with the real thumbnail. In zone mode (--props='{"zones":true}') every
 * word block is checked against the cover box (components/ZoneGuard).
 */
import React, { useState } from 'react';
import { AbsoluteFill } from 'remotion';
import { measureText, spaceWidth, typo, useKitFaces } from '../../kb/kit';
import { waitForFonts } from '../../lib/fonts';
import { FONT, TRACK, TYPE } from '../../theme';
import { IgFinish } from './Finish';
import { NightGround, PearlGround } from './Ground';
import { ZoneOverlay, ZoneProvider, ZoneRect } from './ZoneGuard';

export type CoverSpec = {
  reel: string;
  night: boolean;
  kicker: string;
  /** the title; words joined by a no-break space (\u00a0) never wrap apart */
  title: string;
  /** the one word in accent ink (rose / teal) */
  accent?: { word: string; ink: string };
  size: number;
  /** the title's top (px) */
  titleY: number;
  /** where the reel's art goes [x, y, w, h] and what it will be */
  art: { rect: readonly [number, number, number, number]; what: string };
};

const MAX_W = 844;
/** a no-break space in a title keeps its words on one row ("9:47\u00a0pm.") */
const NBSP = '\u00a0';

export const CoverCard: React.FC<{ spec: CoverSpec; zones?: boolean }> = ({ spec, zones = false }) => {
  useState(() => waitForFonts());
  const ready = useKitFaces();
  const ink = spec.night ? '#edecf1' : '#2b2a2e';
  const dim = spec.night ? 'rgba(237, 236, 241, 0.62)' : 'rgba(43, 42, 46, 0.62)';
  const T = { size: spec.size, weight: TYPE.display.weight, tracking: -0.03 };
  const words = typo(spec.title).split(' ');
  const rows: string[][] = [];
  if (ready) {
    const space = spaceWidth(T);
    let cur: string[] = [];
    let w = 0;
    for (const word of words) {
      const ww = measureText(word, T);
      if (cur.length && w + space + ww > MAX_W) {
        rows.push(cur);
        cur = [];
        w = 0;
      }
      w += (cur.length ? space : 0) + ww;
      cur.push(word);
    }
    if (cur.length) rows.push(cur);
  }
  const lh = spec.size * 1.04;
  const titleW = rows.length ? Math.max(...rows.map((r) => measureText(r.join(' '), T))) : 0;
  const K = { size: 28, weight: TYPE.label.weight, tracking: 0.14 };
  const [ax, ay, aw, ah] = spec.art.rect;
  return (
    <ZoneProvider value={{ on: zones, reel: spec.reel, frame: 0, cover: true }}>
      <AbsoluteFill style={{ background: spec.night ? '#06040a' : '#f3f2f6' }}>
        {spec.night ? <NightGround t={0} /> : <PearlGround t={0} />}
        <div style={{ position: 'absolute', left: ax, top: ay, width: aw, height: ah, border: `2px dashed ${dim}`, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.mono, fontSize: 26, color: dim }}>
          {spec.art.what}
        </div>
        <div style={{ position: 'absolute', left: 86, top: 270, fontFamily: FONT.ui, fontSize: K.size, fontWeight: K.weight, letterSpacing: TRACK.label, textTransform: 'uppercase', color: dim, whiteSpace: 'nowrap' }}>{spec.kicker}</div>
        <ZoneRect what="cover kicker" rect={{ x: 86, y: 270, w: ready ? measureText(spec.kicker.toUpperCase(), K) : 0, h: 34 }} />
        <div style={{ position: 'absolute', left: 86, top: spec.titleY, fontFamily: FONT.ui, fontSize: spec.size, fontWeight: T.weight, letterSpacing: TRACK.section, lineHeight: 1.04, color: ink }}>
          {rows.map((r, i) => (
            <div key={i} style={{ whiteSpace: 'nowrap' }}>
              {r.map((w, k) => (
                <span key={k}>
                  {w.split(NBSP).map((part, j) => (
                    <span key={j} style={{ color: spec.accent && part.replace(/[.,?’]/g, '') === spec.accent.word ? spec.accent.ink : undefined }}>
                      {j ? NBSP : ''}
                      {part}
                    </span>
                  ))}
                  {k < r.length - 1 ? ' ' : ''}
                </span>
              ))}
            </div>
          ))}
        </div>
        <ZoneRect what="cover title" rect={{ x: 86, y: spec.titleY, w: titleW, h: rows.length * lh }} />
        <IgFinish white={spec.night ? 0 : 1} />
        {zones ? <ZoneOverlay cover /> : null}
      </AbsoluteFill>
    </ZoneProvider>
  );
};
