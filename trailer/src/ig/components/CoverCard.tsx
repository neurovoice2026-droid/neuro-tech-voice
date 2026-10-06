/**
 * THE COVER FRAMEWORK (docs/ig/SCRIPT.md "Safe zones and the cover", PIPELINE.md §7–8.3 C): a reel's cover still
 * (IG<n>-Cover-9x16, rendered to PNG by scripts/ig/finish.mjs) — the reel's ground, the reel's ART (a still of its own
 * scene parts, passed in as `art`), the kicker (label role) and the title (display weight, one accent word), everything
 * inside the cover box x 86–930, y 260–1500 (the profile grid's 3:4 crop), and the IG finish over it.
 *
 * THE TITLE is measured, never flowed (the kit's canvas measureText, the DOM's face): explicit `rows` (the word index
 * each row after the first starts at) or a greedy wrap, and it is FITTED — set at `size`, or as large as fits below it,
 * so every row is ≤ `maxW` (default 844 px, x 86–930). Words joined by a no-break space ( ) never part. The fitted
 * size is reported to the zone guard (cover mode: every rect checked against the cover box) and logged in the zone
 * stills, so a cover that would wrap to three rows is caught.
 *
 *   <CoverCard spec={{ reel: 'ig3', night: false, kicker: 'AI receptionist · 03 · salons', title: 'Twelve minutes on the colour.',
 *                      rows: [2], size: 128, titleY: 820 }} art={<TimerCard … />} />
 *
 * Without `art`, a marked placeholder box shows where the reel's art goes (spec.art), until the reel builds it.
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
  /** the title; words joined by a no-break space ( ) never wrap apart */
  title: string;
  /** the one word in accent ink (rose / teal) */
  accent?: { word: string; ink: string };
  /** the size to set the title at (px) — the largest it may be: it shrinks (in whole px) until every row fits maxW */
  size: number;
  /** explicit row breaks: the word index each row after the first starts at (else a greedy wrap) */
  rows?: readonly number[];
  /** the widest a row may be (px; default 844: x 86–930) */
  maxW?: number;
  /** the title's top (px) */
  titleY: number;
  /** placeholder: where the reel's art goes [x, y, w, h] and what it will be (shown only without `art`) */
  art?: { rect: readonly [number, number, number, number]; what: string };
};

const MAX_W = 844;
const NBSP = ' ';
const titleSpec = (size: number) => ({ size, weight: TYPE.display.weight, tracking: -0.03 });

/** The title's rows and the size they fit at (needs the faces). */
export function fitTitle(spec: CoverSpec): { rows: string[][]; size: number } {
  const words = typo(spec.title).split(' ');
  const maxW = spec.maxW ?? MAX_W;
  const layout = (size: number): string[][] => {
    const T = titleSpec(size);
    if (spec.rows && spec.rows.length) {
      const starts = [0, ...spec.rows];
      return starts.map((s, i) => words.slice(s, starts[i + 1] ?? words.length));
    }
    const space = spaceWidth(T);
    const out: string[][] = [];
    let cur: string[] = [];
    let w = 0;
    for (const word of words) {
      const ww = measureText(word, T);
      if (cur.length && w + space + ww > maxW) {
        out.push(cur);
        cur = [];
        w = 0;
      }
      w += (cur.length ? space : 0) + ww;
      cur.push(word);
    }
    if (cur.length) out.push(cur);
    return out;
  };
  let size = spec.size;
  for (; size > 60; size--) {
    const rows = layout(size);
    if (Math.max(...rows.map((r) => measureText(r.join(' '), titleSpec(size)))) <= maxW + 0.01) return { rows, size };
  }
  return { rows: layout(size), size };
}

export const CoverCard: React.FC<{ spec: CoverSpec; zones?: boolean; art?: React.ReactNode; ground?: React.ReactNode }> = ({ spec, zones = false, art, ground }) => {
  useState(() => waitForFonts());
  const ready = useKitFaces();
  const ink = spec.night ? '#edecf1' : '#2b2a2e';
  const dim = spec.night ? 'rgba(237, 236, 241, 0.62)' : 'rgba(43, 42, 46, 0.62)';
  const { rows, size } = ready ? fitTitle(spec) : { rows: [] as string[][], size: spec.size };
  const T = titleSpec(size);
  const lh = size * 1.04;
  const titleW = rows.length ? Math.max(...rows.map((r) => measureText(r.join(' '), T))) : 0;
  const K = { size: 28, weight: TYPE.label.weight, tracking: 0.14 };
  return (
    <ZoneProvider value={{ on: zones, reel: spec.reel, frame: 0, cover: true }}>
      <AbsoluteFill style={{ background: spec.night ? '#06040a' : '#f3f2f6' }}>
        {ground ?? (spec.night ? <NightGround t={0} /> : <PearlGround t={0} />)}
        {art ??
          (spec.art ? (
            <div
              style={{
                position: 'absolute',
                left: spec.art.rect[0],
                top: spec.art.rect[1],
                width: spec.art.rect[2],
                height: spec.art.rect[3],
                border: `2px dashed ${dim}`,
                borderRadius: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: FONT.mono,
                fontSize: 26,
                color: dim,
              }}
            >
              {spec.art.what}
            </div>
          ) : null)}
        <div style={{ position: 'absolute', left: 86, top: 270, fontFamily: FONT.ui, fontSize: K.size, fontWeight: K.weight, letterSpacing: TRACK.label, textTransform: 'uppercase', color: dim, whiteSpace: 'nowrap' }}>{spec.kicker}</div>
        <ZoneRect what="cover kicker" rect={{ x: 86, y: 270, w: ready ? measureText(spec.kicker.toUpperCase(), K) : 0, h: 34 }} />
        <div style={{ position: 'absolute', left: 86, top: spec.titleY, fontFamily: FONT.ui, fontSize: size, fontWeight: T.weight, letterSpacing: TRACK.section, lineHeight: 1.04, color: ink }}>
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
        <ZoneRect what={`cover title (${rows.length} rows at ${size} px)`} rect={{ x: 86, y: spec.titleY, w: titleW, h: rows.length * lh }} />
        <IgFinish white={spec.night ? 0 : 1} />
        {zones ? <ZoneOverlay cover /> : null}
      </AbsoluteFill>
    </ZoneProvider>
  );
};
