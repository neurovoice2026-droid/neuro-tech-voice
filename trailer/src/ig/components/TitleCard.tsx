/**
 * PLACEHOLDER ACTS (the foundation): a title card per act on the reel's real timeline, until the act is built. It shows
 * the act (name, window, place in the reel), the lines placed in it, and the current screen in the caption band, its
 * words lighting on their onsets (frame-0 screens set at 72 % ink) — so stills, zone checks and the mix can be judged
 * against the real timeline from day one. The ground is the reel's (components/Ground.tsx): pearl (MUTED_MESH) or ig2's
 * night (INK_MESH).
 * Every text block reports its rect to the zone guard.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { measureText, spaceWidth, useKitFaces } from '../../kb/kit';
import { FONT, TRACK, TYPE } from '../../theme';
import { useActFrame } from '../scene';
import type { ReelTimeline } from '../types';
import { NightGround, PearlGround } from './Ground';
import { timedScreens, type TimedScreen, type Token } from './screens';
import { ZoneRect } from './ZoneGuard';

const CAP = { size: 68, weight: TYPE.caption.weight, tracking: -0.02 };
const CAP_X = 86;
const CAP_Y = 1200;
const CAP_W = 820;
const CAP_LH = 1.18;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const secs = (f: number) => (f / 30).toFixed(2);

/** greedy wrap of a screen's tokens (a display token such as "9:47 pm." never breaks) into rows ≤ maxW */
const wrapTokens = (tokens: Token[], maxW: number): Token[][] => {
  const space = spaceWidth(CAP);
  const rows: Token[][] = [];
  let cur: Token[] = [];
  let w = 0;
  for (const tok of tokens) {
    const tw = measureText(tok.text, CAP);
    if (cur.length && w + space + tw > maxW + 0.01) {
      rows.push(cur);
      cur = [];
      w = 0;
    }
    w += (cur.length ? space : 0) + tw;
    cur.push(tok);
  }
  if (cur.length) rows.push(cur);
  return rows;
};

/** the screen showing at absolute frame f (the latest one that has risen) */
const screenAt = (screens: TimedScreen[], f: number) => [...screens].reverse().find((s) => f >= s.from && f < s.to) ?? null;

export const titleCard = (T: ReelTimeline, key: string): React.FC => {
  const screens = timedScreens(T);
  const act = T.SCENES[key];
  const idx = T.ORDER.indexOf(key);
  const lines = T.VOICES.filter((v) => v.at < act.to && v.at + T.vFrames(v.id) > act.from);
  const night = T.GRAIN.ground === 'night';
  const ink = night ? '#edecf1' : '#2b2a2e';
  const dim = night ? 'rgba(237, 236, 241, 0.62)' : 'rgba(43, 42, 46, 0.6)';
  const Card: React.FC = () => {
    const ready = useKitFaces();
    const t = useActFrame(T.SCENES, key);
    const f = act.from + t;
    const sc = screenAt(screens, f);
    const u = Math.max(0, Math.min(1, t / (act.to - act.from)));
    const rows = sc && ready ? wrapTokens(sc.tokens, CAP_W) : [];
    const lh = CAP.size * CAP_LH;
    // the end card's brand moment (wordmark + URL, no caption): from the impact to the seam
    const brandOn = f >= T.END_CARD.impact && f < T.END_CARD.seam;
    const brandW = ready ? measureText('NEUROVOICE', { size: 112, weight: TYPE.display.weight, tracking: -0.03 }) : 0;
    const urlW = ready ? measureText('neurotechvoice.com', { size: 44, weight: 460, mono: true }) : 0;
    const capW = rows.length ? Math.max(...rows.map((r) => measureText(r.map((x) => x.text).join(' '), CAP))) : 0;
    return (
      <AbsoluteFill>
        {night ? <NightGround t={f} seed={idx * 37} /> : <PearlGround t={f} seed={idx * 37} />}
        <div style={{ position: 'absolute', left: 86, top: 262, fontFamily: FONT.ui, fontSize: 28, fontWeight: TYPE.label.weight, letterSpacing: TRACK.label, textTransform: 'uppercase', color: dim, whiteSpace: 'nowrap' }}>
          {T.REEL} · {T.TITLE} · placeholder
        </div>
        <ZoneRect what="kicker" rect={{ x: 86, y: 262, w: ready ? measureText(`${T.REEL} · ${T.TITLE} · placeholder`.toUpperCase(), { size: 28, weight: TYPE.label.weight, tracking: 0.14 }) : 600, h: 34 }} />
        <div style={{ position: 'absolute', left: 86, top: 330, fontFamily: FONT.ui, fontSize: 92, fontWeight: TYPE.headline.weight, letterSpacing: TRACK.section, lineHeight: 1.06, color: ink, whiteSpace: 'nowrap' }}>
          {cap(key)}
        </div>
        <ZoneRect what="act title" rect={{ x: 86, y: 330, w: ready ? measureText(cap(key), { size: 92, weight: TYPE.headline.weight, tracking: -0.03 }) : 300, h: 98 }} />
        <div style={{ position: 'absolute', left: 86, top: 452, fontFamily: FONT.mono, fontSize: 28, color: dim, whiteSpace: 'nowrap' }}>
          act {idx + 1}/{T.ORDER.length} · f{act.from}–{act.to} · {secs(act.from)}–{secs(act.to)} s · f{Math.floor(f)}
        </div>
        <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
          <line x1={86} y1={520} x2={906} y2={520} stroke={dim} strokeWidth={1.5} opacity={0.35} />
          <line x1={86} y1={520} x2={86 + 820 * u} y2={520} stroke={ink} strokeWidth={1.5} />
        </svg>
        {lines.map((v, i) => (
          <div key={`${v.id}@${v.at}`} style={{ position: 'absolute', left: 86, top: 560 + i * 44, fontFamily: FONT.mono, fontSize: 26, color: dim, whiteSpace: 'nowrap' }}>
            {v.id} @{v.at}–{v.at + T.vFrames(v.id)} · {T.SCREENS[v.id]?.kind ?? '—'}
          </div>
        ))}
        {brandOn ? (
          <>
            <div style={{ position: 'absolute', left: 140, top: 770, width: 800, textAlign: 'center', fontFamily: FONT.ui, fontSize: 112, fontWeight: TYPE.display.weight, letterSpacing: TRACK.section, lineHeight: 1.04, color: ink }}>NEUROVOICE</div>
            <ZoneRect what="wordmark (placeholder)" rect={{ x: 540 - brandW / 2, y: 770, w: brandW, h: 117 }} />
            <div style={{ position: 'absolute', left: 140, top: 1000, width: 800, textAlign: 'center', fontFamily: FONT.mono, fontSize: 44, color: dim }}>neurotechvoice.com</div>
            <ZoneRect what="url (placeholder)" rect={{ x: 540 - urlW / 2, y: 1000, w: urlW, h: 53 }} />
          </>
        ) : null}
        {sc && rows.length ? (
          <>
            <div style={{ position: 'absolute', left: CAP_X, top: CAP_Y, width: CAP_W, fontFamily: FONT.ui, fontSize: CAP.size, fontWeight: CAP.weight, letterSpacing: TRACK.caption, lineHeight: CAP_LH, color: ink }}>
              {rows.map((r, ri) => (
                <div key={ri} style={{ whiteSpace: 'nowrap' }}>
                  {r.map((tok, k) => (
                    <span key={k} style={{ opacity: f >= tok.onset - 2 ? 1 : sc.set0 ? 0.72 : 0.38 }}>
                      {tok.text}
                      {k < r.length - 1 ? ' ' : ''}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <ZoneRect what={`screen ${sc.id}#${sc.k}`} rect={{ x: CAP_X, y: CAP_Y, w: capW, h: rows.length * lh }} />
          </>
        ) : null}
      </AbsoluteFill>
    );
  };
  Card.displayName = `${T.REEL}-${key}-placeholder`;
  return Card;
};
