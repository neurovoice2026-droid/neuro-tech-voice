/**
 * REEL 1 · b4 "It answers, takes messages, and puts calls through to people you listed." (docs/ig/SCRIPT.md ig1 b4):
 * three white call records land on their verbs over the receding week — each the dashboard's own row at trailer scale
 * (components/calls CallsTable: the caller cell, the OutcomeChip): a phone disc, two ink bars where the caller's number
 * and intent would be (no unspoken words), and the outcome pill in the app's colours —
 *
 *   "answers"              Answered (blue)
 *   "messages"             Message taken (indigo)
 *   "puts calls through"   Transferred (violet)
 *
 * and on "people you listed" the team member it went to slides out from under the third record (the agent tab's Team
 * row, TeamSkill.tsx: an avatar disc, a name bar, the Tag "Live transfers" with lucide phone-forwarded).
 *
 * The records land like cards set down on a table (SPRING.land from a hand's breadth above, a whisper of scale, the
 * mesh-tinted shadow thickening as each settles); in b5 they leave up through their mask on 16ths (top first) before the
 * desk beat. Every value is a pure function of the absolute timeline frame `t`.
 */
import React from 'react';
import { subpixel } from '../../lib/glide';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { APP, measureText, meshElevation, meshShadowInk, W } from '../../kb/kit';
import { MUTED_MESH } from '../../kb/palettes';
import { GRAPHITE } from '../../kb/theme';
import { IgIcon } from '../components/icons';
import { OutcomePill, outcomePillSize, type OutcomeKind } from '../components/OutcomePill';
import { ZoneRect } from '../components/ZoneGuard';
import * as T from './timing';

const M = T.M;
const SHADOW_INK = meshShadowInk(MUTED_MESH);

/** the records' column (SCRIPT: x 140–880, y 480–900) */
export const CARDS = { x: 140, w: 740, h: 128, r: 32, ys: [472, 620, 768] as const, pill: 32 } as const;
/** the contact row under the third record */
export const CONTACT = { y: CARDS.ys[2] + CARDS.h - 26, h: 116, inset: 26 } as const;

type Rec = { kind: OutcomeKind; at: number; bars: readonly [number, number] };
export const RECORDS: readonly Rec[] = [
  { kind: 'answered', at: M.answers, bars: [212, 132] },
  { kind: 'messageTaken', at: M.messages, bars: [176, 150] },
  { kind: 'transferred', at: M.puts, bars: [198, 118] },
];
/** b4 → b5: the records leave together, top first a 32nd apart, once "…listed." has been said (the stage is clear before
 *  "Your receptionist" rises and the people's block lifts) */
export const leaveAt = (i: number) => M.recordsOut + i * (T.SIXTEENTH / 2);

/** lucide phone-incoming (lucide-react 1.49 phone-incoming.mjs), drawn locally */
const PhoneIncoming: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }} aria-hidden>
    <path d="M16 2v6h6" />
    <path d="m22 2-6 6" />
    <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
  </svg>
);

/** a card set down: from a hand's breadth above, a whisper of scale, landing on SPRING.land */
function landing(t: number, at: number) {
  const p = springUnit(t - at, SPRING.land);
  const dy = (1 - p) * -34;
  const sc = 1 + (1 - Math.min(1, p)) * 0.035;
  const lift = 1.6 + 3.4 * Math.max(0, 1 - p);
  const o = smooth(0, 0.3, p);
  return { dy, sc, lift, o, moving: Math.abs(1 - p) > 2e-4 };
}
/** leaving up through the mask (5 f, power3.in) */
function leaving(t: number, at: number) {
  const q = tween(t, [at, at + 5], [0, 1], EASE.in3);
  return { dy: -q * 70, o: 1 - smooth(0.25, 1, q), q };
}

const InkBar: React.FC<{ x: number; y: number; w: number; h: number; a: number }> = ({ x, y, w, h, a }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: h / 2, background: GRAPHITE.text, opacity: a }} />
);

export const OutcomeCards: React.FC<{ t: number }> = ({ t }) => {
  if (t < RECORDS[0].at - 1 || t > leaveAt(3) + 7) return null;
  const C = CARDS;
  return (
    <>
      {/* the team member under the third record (drawn first: it slides out from beneath it) */}
      <ContactRow t={t} />
      {RECORDS.map((rec, i) => {
        if (t < rec.at - 0.5) return null;
        const L = landing(t, rec.at);
        const X = leaving(t, leaveAt(i));
        const o = L.o * X.o;
        if (o <= 0.002) return null;
        const y = C.ys[i] + L.dy + X.dy;
        const moving = L.moving || X.q > 0;
        const pill = outcomePillSize(rec.kind, C.pill);
        const tf = `translate(${C.x}px, ${y.toFixed(3)}px) scale(${L.sc.toFixed(5)})`;
        return (
          <React.Fragment key={rec.kind}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: C.w,
                height: C.h,
                borderRadius: C.r,
                background: '#ffffff',
                boxShadow: meshElevation(L.lift, SHADOW_INK, 1),
                transformOrigin: '50% 50%',
                opacity: o < 0.999 ? o : undefined,
                ...subpixel(tf, moving),
              }}
            >
              {/* the caller cell: a phone disc, the number's and the intent's ink bars */}
              <div style={{ position: 'absolute', left: 32, top: (C.h - 64) / 2, width: 64, height: 64, borderRadius: 32, background: APP.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PhoneIncoming size={28} color={GRAPHITE.tag} />
              </div>
              <InkBar x={122} y={42} w={rec.bars[0]} h={17} a={0.24} />
              <InkBar x={122} y={72} w={rec.bars[1]} h={13} a={0.12} />
              {/* the outcome, the dashboard's chip */}
              <div style={{ position: 'absolute', right: 32, top: (C.h - pill.h) / 2 }}>
                <OutcomePill kind={rec.kind} size={C.pill} />
              </div>
            </div>
            {o > 0.5 ? <ZoneRect what={`b4 outcome pill ${rec.kind}`} rect={{ x: C.x + C.w - 32 - pill.w, y: y + (C.h - pill.h) / 2, w: pill.w, h: pill.h }} /> : null}
          </React.Fragment>
        );
      })}
    </>
  );
};

/* ── the team member (TeamSkill.tsx's row: name, the "Live transfers" Tag) ── */
const TAG = { size: 28, icon: 26, padX: 14, gap: 10, h: 48 } as const;
const TAG_LABEL = 'Live transfers';

const ContactRow: React.FC<{ t: number }> = ({ t }) => {
  const at = M.people;
  if (t < at - 0.5) return null;
  const C = CARDS;
  const R = CONTACT;
  // it slides down out of the third record (from under it) on the site's spring, and leaves with it
  const p = springUnit(t - at, SPRING.site);
  const X = leaving(t, leaveAt(2));
  const L3 = landing(t, RECORDS[2].at);
  const dy = mix(-R.h + 30, 0, p) + L3.dy + X.dy;
  const o = smooth(0, 0.25, p) * X.o;
  if (o <= 0.002) return null;
  const x = C.x + R.inset;
  const w = C.w - 2 * R.inset;
  const y = R.y + dy;
  const tw = measureText(TAG_LABEL, { size: TAG.size, weight: W.medium, tracking: -0.006 });
  const tagW = TAG.padX * 2 + TAG.icon + TAG.gap + tw;
  const moving = Math.abs(1 - p) > 2e-4 || X.q > 0;
  const tagX = w - 26 - tagW;
  const top = 26 + (R.h - 26 - TAG.h) / 2;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: R.h,
          borderRadius: `0 0 ${C.r - 6}px ${C.r - 6}px`,
          background: '#fbfafc',
          boxShadow: meshElevation(1.2, SHADOW_INK, 0.9),
          opacity: o < 0.999 ? o : undefined,
          ...subpixel(`translate(${x}px, ${y.toFixed(3)}px)`, moving),
        }}
      >
        {/* the person: an avatar disc, the name's ink bar, the role's */}
        <div style={{ position: 'absolute', left: 22, top: top + (TAG.h - 52) / 2, width: 52, height: 52, borderRadius: 26, background: GRAPHITE.text, opacity: 0.16 }} />
        <InkBar x={92} y={top + 6} w={158} h={15} a={0.3} />
        <InkBar x={92} y={top + 31} w={104} h={12} a={0.13} />
        {/* the Tag: rounded-md, bg-muted, the icon in muted ink, the label */}
        <div
          style={{
            position: 'absolute',
            left: tagX,
            top,
            height: TAG.h,
            padding: `0 ${TAG.padX}px`,
            borderRadius: 12,
            background: APP.muted,
            display: 'flex',
            alignItems: 'center',
            gap: TAG.gap,
            fontFamily: '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif',
            fontSize: TAG.size,
            fontWeight: W.medium,
            letterSpacing: '-0.006em',
            color: APP.foreground,
            whiteSpace: 'nowrap',
          }}
        >
          <IgIcon name="phoneForwarded" size={TAG.icon} color={APP.mutedFg} stroke={2} />
          <span style={{ display: 'block', transform: 'translateY(-0.02em)' }}>{TAG_LABEL}</span>
        </div>
      </div>
      {o > 0.5 ? <ZoneRect what="b4 contact Live transfers" rect={{ x: x + tagX, y: y + top, w: tagW, h: TAG.h }} /> : null}
    </>
  );
};
