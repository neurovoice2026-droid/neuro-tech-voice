/**
 * REEL 5 · b6 THE SAMPLE CALL (docs/ig/ig5/SCRIPT.md b6; the dashboard's own strings, components/calls/call-display.tsx):
 * a white record that rises on "It" — its header chrome ● SAMPLE CALL (label 28) with, at its left, a small rose dot
 * ringing (an incoming call). On "picks up" her orb glides onto the dot and absorbs it (the pickup, one move) and stays
 * docked there as the agent, listening; the OutcomePill **Answered** (blue) lands at the header's right. Then the tool
 * step "Checked your availability" spins and resolves to a drawn check; on "books" the step "Booked an appointment"
 * ticks and the pill swaps Answered → **Booked** (emerald) with the kit's Swap. No calendar brand, no logo, no PRO chip.
 * The launch-gate cut (ig5-06-msg: "…and takes a message.") shows one step "Took a message" and swaps to Message taken.
 *
 * b7 (the shared end card): the record is pulled back and up over the CTA (× .62, dimmed to 50 %), her orb docked on
 * it; it goes out under the card's light on the bar.
 *
 * Chrome only (≤ 32 px, each on or after the spoken word it belongs to). Every rect is reported in frame px.
 */
import React from 'react';
import { subpixel } from '../../../lib/glide';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { CheckMark, measureText, meshElevation, meshShadowInk, Swap, ui, useKitFaces, W } from '../../../kb/kit';
import { MOMENT_LIGHTS, MUTED_MESH } from '../../../kb/palettes';
import { GRAPHITE } from '../../../kb/theme';
import { IgIcon } from '../../components/icons';
import { LineLight, Rings } from '../../components/Orb';
import { OutcomePill, outcomePillSize, type OutcomeKind } from '../../components/OutcomePill';
import { ZoneRect } from '../../components/ZoneGuard';
import * as T from '../timing';
import { at as atPose, bbox, poseTransform, RECORD, RECORD_BACK, type Pose } from './layout';
import { labelSpec } from './type';

const M = T.M;
const RUSH = MOMENT_LIGHTS.rush;
const SUNDAY = MOMENT_LIGHTS.sunday;
const SHADOW = meshShadowInk(MUTED_MESH);
const E = T.END_CARD;
const EPS = 2e-4;

/** the record rises a quarter beat after "It", once ours' fold has lifted clear of its place */
export const REC_UP = M.it + 8;
/** the dot rings as it lands (an incoming call) */
export const DOT_RINGS = [REC_UP + 4, REC_UP + 4 + 15] as const;
/** the outcome: Answered on "up", Booked on "books" (the launch-gate cut: Message taken) */
const ANSWERED_AT = M.up + 2;
const OUTCOME_AT = M.books + 2;
const OUTCOME: OutcomeKind = M.booked ? 'booked' : 'messageTaken';
/** the tool steps: availability after "can't", the booking on "books" (the cut: "Took a message" on "takes") */
const TOOLS = M.booked
  ? [
      { label: 'Checked your availability', at: M.cant + 4, done: M.books - 7 },
      { label: 'Booked an appointment', at: M.books, done: M.books + 8 },
    ]
  : [{ label: 'Took a message', at: M.books, done: M.books + 8 }];

/** the end card's pull-back (from just before the comment field rises) and the record's exit on the bar */
const PULL = [E.field - 8, E.field + 12] as const;
const OUT = [T.IMPACT - 6, T.IMPACT + 1] as const;

/** the record's pose at t (null before its rise / after its exit) */
export function recordState(t: number): { pose: Pose; opacity: number; moving: boolean } | null {
  if (t < REC_UP - 0.5 || t > OUT[1] + 0.5) return null;
  const e = springUnit(t - REC_UP, SPRING.site);
  const p = tween(t, PULL, [0, 1], EASE.inOut);
  const q = tween(t, OUT, [0, 1], EASE.in3);
  const s = mix(1, RECORD_BACK.s, p);
  const x = mix(RECORD.x, RECORD_BACK.c.x + (RECORD.x - RECORD_BACK.c.x) * RECORD_BACK.s, p);
  const y = mix(RECORD.y + (1 - e) * 72, RECORD_BACK.c.y + (RECORD.y - RECORD_BACK.c.y) * RECORD_BACK.s, p) - 30 * q;
  const opacity = smooth(0, 0.35, e) * mix(1, RECORD_BACK.opacity, p) * (1 - q);
  return { pose: { x, y, r: 0, s }, opacity, moving: Math.abs(1 - e) > EPS || (p > 0 && p < 1) || q > 0 };
}
/** her dock on the record (the dot's place), frame px, and the record's scale there */
export function dockAt(t: number): { x: number; y: number; s: number } {
  const st = recordState(Math.min(t, OUT[0])) ?? recordState(REC_UP + 30)!;
  const p = atPose(st.pose, RECORD.head.dot.x, RECORD.head.y + RECORD.head.h / 2);
  return { x: p.x, y: p.y, s: st.pose.s };
}

/* ── a tool step (the shared ToolRow's look — lucide loader turning, a drawn check taking its place — in the record's
 *    own coordinates, so it rides the record's pose and reports its frame rect) ── */
const ToolStep: React.FC<{ t: number; label: string; x: number; y: number; at: number; done: number; size: number }> = ({ t, label, x, y, at, done, size }) => {
  if (t < at - 1) return null;
  const k = springUnit(t - at, SPRING.caption);
  const dy = (1 - k) * size * 0.8;
  const icon = Math.round(size * 1.05);
  const spin = ((t - at) / 30) * 360;
  const swap = tween(t, [done - 1, done + 2], [0, 1], EASE.inOut);
  return (
    <div style={{ position: 'absolute', left: x, top: y, height: size * 1.3, overflow: 'hidden', paddingTop: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.45, ...ui(size, W.medium), color: '#6d6676', opacity: smooth(0, 0.5, k), transform: dy > 0.05 ? `translateY(${dy.toFixed(3)}px)` : undefined }}>
        <span style={{ position: 'relative', display: 'inline-block', width: icon, height: icon }}>
          {swap < 1 ? (
            <span style={{ position: 'absolute', inset: 0, opacity: 1 - swap }}>
              <IgIcon name="loader" size={icon} color="#6d6676" rotate={spin} stroke={2.2} />
            </span>
          ) : null}
          {t >= done - 0.5 ? (
            <span style={{ position: 'absolute', inset: 0, opacity: swap }}>
              <CheckMark size={icon} t={t} at={done} color={SUNDAY.ink} stroke={2.6} />
            </span>
          ) : null}
        </span>
        <span>{label}</span>
      </div>
    </div>
  );
};
const toolW = (label: string, size: number) => Math.round(size * 1.05) + size * 0.45 + measureText(label, { size, weight: W.medium });

export const RecordCard: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  const st = recordState(t);
  if (!ready || !st) return null;
  const R = RECORD;
  const H = R.head;
  const cy = H.y + H.h / 2;
  const lab = labelSpec(28);
  const labW = measureText('SAMPLE CALL', lab);
  const pillOld = outcomePillSize('answered', H.pill);
  const pillNew = outcomePillSize(OUTCOME, H.pill);
  const pillW = t < OUTCOME_AT ? pillOld.w : pillNew.w;
  // the rose dot: ringing until her orb lands on it (absorbed), then gone under her
  const dotA = 1 - tween(t, [M.up - 3, M.up + 1], [0, 1], EASE.in2);
  const show = st.opacity > 0.5;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: R.w,
          height: R.h,
          borderRadius: R.r,
          background: '#ffffff',
          boxShadow: meshElevation(2.6, SHADOW, 1.1),
          transformOrigin: '0 0',
          opacity: st.opacity >= 0.999 ? undefined : st.opacity,
          ...subpixel(poseTransform(st.pose), st.moving),
        }}
      >
        {/* the header: the ringing rose dot, ● SAMPLE CALL, the outcome */}
        {dotA > 0.002 ? (
          <>
            <Rings t={t} at={DOT_RINGS} x={H.dot.x} y={cy} d0={H.dot.d} d1={84} color={RUSH.orb[2]} strength={0.5} out={1 - dotA} />
            <LineLight t={t} x={H.dot.x} y={cy} d={H.dot.d} rings={DOT_RINGS} opacity={dotA} />
          </>
        ) : null}
        <div style={{ position: 'absolute', left: H.labelX, top: cy - 17, fontFamily: '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif', fontSize: 28, fontWeight: lab.weight, letterSpacing: `${lab.tracking}em`, lineHeight: 1.2, textTransform: 'uppercase', color: GRAPHITE.tag, whiteSpace: 'nowrap' }}>
          Sample call
        </div>
        {t >= ANSWERED_AT - 1 ? (
          <div style={{ position: 'absolute', left: R.w - R.pad - Math.max(pillOld.w, pillNew.w), top: cy - pillOld.h / 2 - 4, width: Math.max(pillOld.w, pillNew.w) + 8, height: pillOld.h + 8 }}>
            <Swap t={t} at={OUTCOME_AT} rise={24}>
              <div style={{ position: 'absolute', right: 8, top: 4 }}>
                <OutcomePill kind="answered" size={H.pill} t={t} at={ANSWERED_AT} />
              </div>
              <div style={{ position: 'absolute', right: 8, top: 4 }}>
                <OutcomePill kind={OUTCOME} size={H.pill} />
              </div>
            </Swap>
          </div>
        ) : null}
        <div style={{ position: 'absolute', left: R.pad, right: R.pad, top: R.ruleY, height: 1.25, background: '#e4e0eb' }} />
        {TOOLS.map((tl, i) => (
          <ToolStep key={i} t={t} label={tl.label} x={R.pad} y={R.tools[i]} at={tl.at} done={tl.done} size={R.toolSize} />
        ))}
      </div>
      {show ? (
        <>
          <ZoneRect what="object record" rect={bbox(st.pose, { x: 0, y: 0, w: R.w, h: R.h })} />
          <ZoneRect what="record SAMPLE CALL" rect={bbox(st.pose, { x: H.labelX, y: cy - 17, w: labW, h: 34 })} />
          {t >= ANSWERED_AT ? <ZoneRect what="record pill" rect={bbox(st.pose, { x: R.w - R.pad - pillW, y: cy - pillOld.h / 2, w: pillW, h: pillOld.h })} /> : null}
          {TOOLS.map((tl, i) => (t >= tl.at ? <ZoneRect key={i} what={`record tool “${tl.label}”`} rect={bbox(st.pose, { x: R.pad, y: R.tools[i], w: toolW(tl.label, R.toolSize), h: R.toolSize * 1.3 })} /> : null))}
        </>
      ) : null}
    </>
  );
};
