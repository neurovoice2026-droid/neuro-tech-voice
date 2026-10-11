/**
 * REEL 6 · PLACEHOLDER ACTS (the infrastructure step): a title card per act on the reel's real timeline, on ig6's flat
 * white, until the scene build replaces it (STYLE.md §9.1: Camera, Dial, Hand, Lockup, Transitions). It shows the act
 * (name, window, the hook rung, the lines placed in it) in small grey type at the top, and THE LOCKUP OF THE MOMENT at
 * its real place in the real faces (STYLE §9.8 positions, stage/style.ts LAYOUT): the lead in Instrument Sans 580, the
 * accent in teal Cormorant Garamond Italic 600 (loaded ig6-locally, stage/fonts.ts), the grey sentence tier in
 * Instrument Sans 450 — every word set at 72 % ink until her onset, then full ink (no motion yet: the mask rises, the
 * accent's slide + wipe and the exits are the scene build's Lockup.tsx). Baselines are exact (SVG text).
 *
 * The lockups' windows follow SCRIPT §4's type grammar closely enough to judge stills against the mock: a screen is set
 * PLAN.cardLead before its first word (S1a at frame 0), holds ≥ 15 f after its last word and up to the next screen when
 * the gap would be ≤ 30 f; 1b holds HOOK.hold after "answer."; 2a holds silently through ring 2; S3 holds to the whip;
 * S5 to the ring cut − 4; S6 to the recede. The CTA (S7) is the end card's (stage/End6.tsx).
 * Every text block reports its rect to the zone guard.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { measureText, typo, useKitFaces } from '../../../kb/kit';
import { mixHex } from '../../../lib/motion';
import { useActFrame } from '../../scene';
import { ZoneRect } from '../../components/ZoneGuard';
import { VOICE } from '../voice.generated';
import { measureSans, measureSerif, useIg6Faces } from '../stage/fonts';
import { FACE, INK, LAYOUT, TIER } from '../stage/style';
import * as T from '../timing';

type Tok = { text: string; onset: number };
export type LockScreen = {
  id: string;
  k: number;
  layout: T.LockupLayout;
  from: number;
  to: number;
  lastOnset: number;
  lead: Tok[];
  accent: Tok[];
  tier: Tok[][];
};

/** the tier of ig6-02a continues with ig6-02b's words: one tier screen across the two takes (SCRIPT §5.1 S2a + S2b) */
const JOIN: Readonly<Record<string, string>> = { 'ig6-02a': 'ig6-02b' };
const range = ([a, e]: readonly [number, number]) => Array.from({ length: e - a + 1 }, (_, i) => a + i);
const SAY = (id: string) => typo((VOICE.lines as Record<string, { say: string }>)[id].say).split(' ');

/** every lockup screen of the placed lines (before the end card), with its window — pure, from the timeline */
export function lockScreens(): LockScreen[] {
  const placed = T.VOICES.filter((v) => T.LOCKUPS[v.id] && v.at < T.SCENES.end.from);
  const tokens = (id: T.VoiceId, at: number, ks: number[], display: boolean): Tok[] =>
    ks.map((i) => ({ text: (display ? T.DISPLAY.find((d) => d.id === id && d.from === i)?.text : undefined) ?? SAY(id)[i], onset: at + T.vWord(id, i) }));
  const out: LockScreen[] = [];
  for (const v of placed) {
    const spans = T.SCREENS[v.id].spans;
    T.LOCKUPS[v.id].forEach((L, k) => {
      const span = spans[k];
      let tier: Tok[][] = [tokens(v.id, v.at, range(span), false)];
      const join = JOIN[v.id];
      const jv = join ? T.VOICES.find((x) => x.id === join) : undefined;
      if (jv) tier = [tier[0], tokens(jv.id, jv.at, range(T.SCREENS[jv.id].spans[0]), false)];
      const set0 = !!T.SCREENS[v.id].set0 && k === 0;
      out.push({
        id: v.id,
        k,
        layout: L.layout,
        from: set0 ? 0 : v.at + T.vWord(v.id, span[0]) - T.PLAN.cardLead,
        to: Infinity,
        lastOnset: v.at + T.vWord(v.id, span[1]),
        lead: tokens(v.id, v.at, range(L.lead), true),
        accent: tokens(v.id, v.at, range(L.accent), true),
        tier,
      });
    });
  }
  // the joined screen (ig6-02b) shows 02a's tier row above its own
  out.forEach((s) => {
    const prev = out.find((p) => JOIN[p.id] === s.id);
    if (prev) s.tier = prev.tier;
  });
  out.forEach((s, i) => {
    const next = out[i + 1];
    const hold = (() => {
      if (s.id === T.TAKES.hook && s.k === 1) return s.lastOnset + T.HOOK.hold;
      if (JOIN[s.id]) return next ? next.from : s.lastOnset + 15;
      if (s.id === T.TAKES.missed) return T.M.whip;
      if (s.id === T.TAKES.words) return T.M.ringShot - 4;
      if (s.id === T.TAKES.ring) return T.M.exit[0];
      if (next && next.id === s.id) return next.from;
      return next ? Math.max(s.lastOnset + 15, next.from - 30) : s.lastOnset + 15;
    })();
    s.to = next ? Math.min(next.from, hold) : hold;
  });
  return out;
}

/** a word's ink: set at 72 % (mixed toward the white ground) until her onset, full from it */
const inked = (full: string, t: number, onset: number) => (t >= onset ? full : mixHex(INK.ground, full, INK.setInk));

/** the lockup showing at absolute frame t (nothing in the wordless beats) */
export const Lockups: React.FC<{ t: number; screens: LockScreen[] }> = ({ t, screens }) => {
  const ready = useIg6Faces();
  const s = screens.find((x) => t >= x.from && t < x.to);
  if (!s || !ready) return null;
  const P = LAYOUT[s.layout];
  const leadText = s.lead.map((w) => w.text).join(' ');
  const accText = s.accent.map((w) => w.text).join(' ');
  const leadW = measureSans(leadText, P.lead.size, TIER.lead.weight, TIER.lead.tracking);
  const accW = measureSerif(accText, P.accent.size);
  const leadX = P.centred ? P.lead.x - leadW / 2 : P.lead.x;
  const accX = P.centred ? P.accent.x - accW / 2 : P.accent.x;
  const tierX = P.tier.x ?? accX + accW / 2;
  const rows = s.tier.length > 1 ? s.tier : s.tier[0].length > 5 && P.tier.base.length > 1 ? splitRow(s.tier[0], s) : s.tier;
  const span = (toks: Tok[], full: string) =>
    toks.map((w, i) => (
      <tspan key={i} fill={inked(full, t, w.onset)}>
        {i ? ' ' : ''}
        {w.text}
      </tspan>
    ));
  const sans = (size: number, weight: number, tracking: number): React.CSSProperties => ({ fontFamily: FACE.sans, fontSize: size, fontWeight: weight, letterSpacing: `${tracking}em`, fontSynthesis: 'none', whiteSpace: 'pre' });
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
        <text x={P.centred ? P.lead.x : leadX} y={P.lead.base} textAnchor={P.centred ? 'middle' : 'start'} style={sans(P.lead.size, TIER.lead.weight, TIER.lead.tracking)}>
          {span(s.lead, INK.ink)}
        </text>
        <text
          x={P.centred ? P.accent.x : accX}
          y={P.accent.base}
          textAnchor={P.centred ? 'middle' : 'start'}
          style={{ fontFamily: FACE.serif, fontStyle: 'italic', fontSize: P.accent.size, fontWeight: TIER.accent.weight, letterSpacing: `${TIER.accent.tracking}em`, fontSynthesis: 'none', whiteSpace: 'pre' }}
        >
          {/* the accent lifts as a unit on its first word (SCRIPT §1.2) */}
          <tspan fill={inked(INK.teal, t, s.accent[0].onset)}>{accText}</tspan>
        </text>
        {rows.map((r, i) => (
          <text key={i} x={tierX} y={P.tier.base[Math.min(i, P.tier.base.length - 1)]} textAnchor="middle" style={sans(TIER.tier.size, TIER.tier.weight, TIER.tier.tracking)}>
            {span(r, INK.tier)}
          </text>
        ))}
      </svg>
      <ZoneRect what={`text lockup lead ${s.id}#${s.k}`} rect={{ x: leadX, y: P.lead.base - P.lead.size * 0.76, w: leadW, h: P.lead.size }} />
      <ZoneRect what={`text lockup accent ${s.id}#${s.k}`} rect={{ x: accX, y: P.accent.base - P.accent.size * 0.72, w: accW, h: P.accent.size * 0.98 }} />
      {rows.map((r, i) => {
        const w = measureSans(r.map((x) => x.text).join(' '), TIER.tier.size, TIER.tier.weight);
        const base = P.tier.base[Math.min(i, P.tier.base.length - 1)];
        return <ZoneRect key={i} what={`text lockup tier ${s.id}#${s.k}.${i}`} rect={{ x: tierX - w / 2, y: base - TIER.tier.size * 0.78, w, h: TIER.tier.size }} />;
      })}
    </>
  );
};
/** a long tier screen in two rows: at the lead's first word when the lockup quotes the line's end (S3 "A missed call is /
 *  someone else's customer."), else halved */
const splitRow = (row: Tok[], s: LockScreen): Tok[][] => {
  const at = row.findIndex((w) => w.onset === s.lead[0].onset);
  const k = at > 0 ? at : Math.ceil(row.length / 2);
  return [row.slice(0, k), row.slice(k)];
};

const SCREENS6 = lockScreens();
const secs = (f: number) => (f / 30).toFixed(2);
const KICK = { size: 26, weight: 600, tracking: 0.08 };
const META = { size: 24, weight: 460, mono: true };

/** the placeholder act `key`: its card and the lockup of the moment */
export const placeholderAct = (key: T.SceneKey): React.FC => {
  const act = T.SCENES[key];
  const idx = T.ORDER.indexOf(key);
  const lines = T.VOICES.filter((v) => v.at < act.to && v.at + T.vFrames(v.id) > act.from);
  const Card: React.FC = () => {
    const kit = useKitFaces();
    const t = useActFrame(T.SCENES, key);
    const f = act.from + t;
    const kicker = `${T.REEL} · ${T.TITLE} · placeholder · ${key}`.toUpperCase();
    const meta = `act ${idx + 1}/${T.ORDER.length} · f${act.from}–${act.to} · ${secs(act.from)}–${secs(act.to)} s · f${Math.floor(f)}`;
    const hook = `cast ${T.HOOK.cast} · hook rung ${T.HOOK.rung} ${T.HOOK.take} (1b hold ${T.HOOK.hold}) · trim ${T.TRIM}`;
    const u = Math.max(0, Math.min(1, t / (act.to - act.from)));
    return (
      <AbsoluteFill>
        <div style={{ position: 'absolute', left: 86, top: 262, fontFamily: FACE.sans, fontSize: KICK.size, fontWeight: KICK.weight, letterSpacing: `${KICK.tracking}em`, color: INK.tier, whiteSpace: 'nowrap' }}>{kicker}</div>
        <ZoneRect what="text placeholder kicker" rect={{ x: 86, y: 262, w: kit ? measureText(kicker, KICK) : 600, h: 32 }} />
        {[meta, hook, ...lines.map((v) => `${v.id} @${v.at}–${v.at + T.vFrames(v.id)}`)].map((s, i) => (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: 86, top: 306 + i * 34, fontFamily: '"Geist Mono Variable", ui-monospace, monospace', fontSize: META.size, fontWeight: META.weight, color: INK.tickSec, whiteSpace: 'nowrap' }}>{s}</div>
            <ZoneRect what="text placeholder meta" rect={{ x: 86, y: 306 + i * 34, w: kit ? measureText(s, META) : 600, h: 30 }} />
          </React.Fragment>
        ))}
        <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
          <line x1={86} y1={300} x2={900} y2={300} stroke={INK.tickMinor} strokeWidth={2} />
          <line x1={86} y1={300} x2={86 + 814 * u} y2={300} stroke={INK.teal} strokeWidth={2} />
        </svg>
        <Lockups t={f} screens={SCREENS6} />
      </AbsoluteFill>
    );
  };
  Card.displayName = `ig6-${key}-placeholder`;
  return Card;
};
/** the frame-0 lockup (S1a set at 72 %), for the seam and the cover */
export const Frame0Lockup: React.FC = () => <Lockups t={0} screens={SCREENS6} />;
