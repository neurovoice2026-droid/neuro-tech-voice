/**
 * The transcript's screen-space furniture (captions themselves are the
 * shared <Captions>, driven by the voice):
 *
 *   <SpeakerTag>  AVA / CALLER, stacked above the caption, led by a small
 *                 mesh orb in the speaker's colours; it swaps on each cut.
 *   <Chips>       the slot chips "3:00 PM" · "4:30 PM": pop ON the spoken words,
 *                 3:00 PM is picked (squash, fill flood, glow), 4:30 PM drops out.
 *   <MarkRow>     row B of the last line — "Wednesday at 3 PM" arrives word
 *                 by word ON the voice, "3 PM" ignites ember on "three", then it
 *                 is the single <BookedMark> the result picks up.
 */
import React from 'react';
import { MeshOrb } from '../../components/MeshOrb';
import { BOOKING, BookedMark } from '../../components/Shared';
import { rgba } from '../../lib/lights';
import { EASE, mixHex, SPRING, springAt, tween } from '../../lib/motion';
import { C, FONT, LIGHTS, TRACK } from '../../theme';
import { exitCurve, glintBg, popOpacity, popScale, RingPulse, Sparks } from './Accents';
import { AVA_GLOW, CALLER_GLOW } from './Light';
import type { Who } from './voice';

/** a tag's / chip's light: Ava's lilac core or the caller's blue */
const tagInk = (who: Who) => (who === 'agent' ? AVA_GLOW.core : CALLER_GLOW.core);

export const SpeakerTag: React.FC<{
  t: number;
  who: Who;
  /** frame the tag swaps in (the cut) */
  at: number;
  /** frame its dot peaks (the pop's hit, 1 f after the cut) */
  hit: number;
  /** the next cut (the tag leans back over the 3 f before it), or Infinity */
  next: number;
  x: number;
  y: number;
  fontSize: number;
  dot: number;
}> = ({ t, who, at, hit, next, x, y, fontSize, dot }) => {
  if (t < at) return null;
  const label = who === 'agent' ? 'AVA' : 'CALLER';
  const ink = tagInk(who);
  const col = who === 'agent' ? C.lilac : C.callerLit;
  // the dot: a seed on the cut, the pop's peak 1 f later, settled ≈ 10 f on
  const dotS = popScale(t, hit, 1.18, { from: 0.5, anticip: 1 });
  // the cut is coming: the tag leans back (the anticipation of its exit, which IS the cut)
  const lean = tween(t, [next - 3, next], [0, 1], EASE.in2);
  const spark = t >= hit ? Math.exp(-(t - hit) / 3) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${(1 - 0.06 * lean).toFixed(4)})`,
        display: 'flex',
        alignItems: 'center',
        gap: Math.round(fontSize * 0.42),
        opacity: 0.92 * (1 - 0.45 * lean),
      }}
    >
      <div style={{ position: 'relative', width: dot, height: dot }}>
        <RingPulse t={t} at={hit} x={dot / 2} y={dot / 2} w={dot} h={dot} radius={dot / 2} color={ink} grow={3.2} life={11} width={1.5} />
        <div
          style={{
            width: dot,
            height: dot,
            transform: `scale(${dotS.toFixed(4)})`,
            borderRadius: '50%',
            boxShadow: `0 0 ${(12 + 16 * spark).toFixed(1)}px ${rgba(ink, 0.55 + 0.4 * spark)}`,
          }}
        >
          <MeshOrb size={dot} palette={who === 'agent' ? LIGHTS.night.orb : LIGHTS.night.listen} time={t / 30} />
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          fontFamily: FONT.body,
          fontWeight: 600,
          fontSize,
          lineHeight: 1,
          letterSpacing: TRACK.tag,
          marginRight: `-${TRACK.tag}`,
          color: col,
          textShadow: `0 0 14px ${rgba(ink, 0.35)}`,
        }}
      >
        {label.split('').map((ch, k) => {
          const a = hit + 1 + k * 0.8;
          return (
            <span
              key={k}
              style={{
                display: 'inline-block',
                opacity: popOpacity(t, a, 2),
                transform: `scale(${popScale(t, a, 1.14, { from: 0.6, anticip: 2 }).toFixed(4)})`,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/* ── slot chips (line 3): "3:00 PM" · "4:30 PM" (as Ava says them) ─── */

/** a vertical smear filter (id unique per chip) */
const VSmear: React.FC<{ id: string; sigma: number }> = ({ id, sigma }) => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
    <defs>
      <filter id={id} x="-20%" y="-120%" width="140%" height="340%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={`${(sigma * 0.15).toFixed(2)} ${sigma.toFixed(2)}`} />
      </filter>
    </defs>
  </svg>
);

export const Chips: React.FC<{
  t: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  fontSize: number;
  /** the pop's hit frames (the spoken times): a seed 3 f before, the overshoot peaks ON them */
  pops: readonly [number, number];
  /** 3:00 PM is picked (squash 2 f before, the pop ON it) */
  pick: number;
  /** 4:30 PM lifts (2 f) and drops away from here */
  drop: number;
  /** the 3:00 PM chip squashes (2 f) and leaves up into the light from here */
  leave: number;
  /** where it leaves to (the orb's centre), screen px */
  leaveTo: { x: number; y: number };
}> = ({ t, cx, cy, w, h, fontSize, pops, pick, drop, leave, leaveTo }) => {
  if (t < pops[0] - 3 || t > leave + 12) return null;
  const labels = ['3:00 PM', '4:30 PM'];
  const gap = 32;
  const WAVE = AVA_GLOW.core;
  const nodes: React.ReactNode[] = [];
  labels.forEach((lab, i) => {
    const hit = pops[i];
    if (t < hit - 3) return;
    const selected = i === 0;
    const baseX = cx + (i === 0 ? -1 : 1) * (w / 2 + gap / 2);
    // the entrance: seed → anticipation → 1.12 ON the spoken time → settle
    const s = popScale(t, hit, 1.12, { from: 0.5, anticip: 3 });
    // pick: 3:00 PM squashes (.92, 2 f), pops to 1.08 ON the pick and settles
    const press = selected
      ? t < pick - 2
        ? 1
        : t < pick
          ? 1 - 0.08 * EASE.in2((t - (pick - 2)) / 2)
          : 1.08 - 0.08 * springAt(t, pick, SPRING.pop)
      : 1;
    const fill = selected ? tween(t, [pick, pick + 6], [0, 1], EASE.house) : 0;
    // 4:30 PM: lifts 2 f (the counter-move), then drops away, tipping
    const dp = !selected ? exitCurve(t, drop + 2, 8, { anticip: 2, dip: 0.14 }) : 0;
    // 3:00 PM: squashes 2 f, then leaves up into the orb, stretching along its path
    const lv = selected ? exitCurve(t, leave + 2, 7, { anticip: 2, dip: 0.1 }) : 0;
    const lvOut = Math.max(0, lv);
    const leaveSquash = lv < 0 ? -lv / 0.1 : 0;
    const dpOut = Math.max(0, dp);
    // (3:00 PM is gone before it overlaps the orb: absorbed, not pasted on it)
    const op = popOpacity(t, hit, 3) * (1 - dpOut) * Math.pow(1 - lvOut, 2.2);
    if (op <= 0.002) return;
    // 3:00 PM flies into the orb (it is fully gone, absorbed, a little short of its centre)
    const toX = (leaveTo.x - baseX) * 0.8;
    const toY = (leaveTo.y - cy) * 0.8;
    const travelX = Math.max(0, lv) * toX;
    const travelY = dp * 46 + lv * toY;
    const vY = Math.abs(
      (!selected ? exitCurve(t + 0.5, drop + 2, 8, { anticip: 2, dip: 0.14 }) * 46 : exitCurve(t + 0.5, leave + 2, 7, { anticip: 2, dip: 0.1 }) * toY) -
        (!selected ? exitCurve(t - 0.5, drop + 2, 8, { anticip: 2, dip: 0.14 }) * 46 : exitCurve(t - 0.5, leave + 2, 7, { anticip: 2, dip: 0.1 }) * toY),
    );
    const smear = vY > 6 ? Math.min(18, vY * 0.35) : 0;
    const sx = Math.max(0, s) * press * (1 + 0.05 * leaveSquash) * (1 - 0.35 * lvOut) * (1 - 0.06 * dpOut);
    const sy = Math.max(0, s) * press * (1 - 0.1 * leaveSquash) * (1 - 0.35 * lvOut + 0.3 * lvOut) * (1 - 0.06 * dpOut);
    const flash = t >= hit ? Math.exp(-(t - hit) / 3.5) : t >= hit - 3 ? 0.6 : 0;
    const pickFlash = selected && t >= pick ? Math.exp(-(t - pick) / 4) : 0;
    const glint = glintBg(tween(t, [hit, hit + 9], [0, 1], EASE.inOut), 0.55) ?? (selected ? glintBg(tween(t, [pick + 1, pick + 10], [0, 1], EASE.inOut), 0.7) : null);
    const id = `call-chip-smear-${i}`;
    nodes.push(
      <React.Fragment key={lab}>
        {/* the hit's accent: a ring leaves the pill (the sparks fly up and out over it, below — never across the caption) */}
        <RingPulse t={t} at={hit} x={baseX} y={cy} w={w} h={h} radius={h / 2} color={WAVE} grow={1.55} life={12} />
        {selected ? <RingPulse t={t} at={pick} x={baseX} y={cy} w={w} h={h} radius={h / 2} color={C.paper} grow={1.9} life={14} width={2.5} /> : null}
        {smear > 0.4 ? <VSmear id={id} sigma={smear} /> : null}
        <div
          style={{
            position: 'absolute',
            left: baseX - w / 2 + travelX,
            top: cy - h / 2 + travelY,
            width: w,
            height: h,
            opacity: op,
            transform: `rotate(${(7 * dpOut).toFixed(3)}deg)`,
            filter: smear > 0.4 ? `url(#${id})` : dpOut > 0.02 ? `blur(${(5 * dpOut).toFixed(2)}px)` : undefined,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: h / 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              background: `rgba(255,255,255,${(0.08 + 0.14 * flash).toFixed(3)})`,
              boxShadow:
                `inset 0 0 0 1.5px ${rgba(WAVE, 0.5 * (1 - fill) + 0.45 * flash)}, inset 0 1px 0 rgba(255,255,255,${(0.1 + 0.3 * fill).toFixed(3)}), 0 18px 36px -18px rgba(2,3,14,0.95)` +
                `, 0 0 ${(18 + 26 * flash + 30 * fill).toFixed(1)}px ${rgba(WAVE, 0.18 * flash + 0.5 * fill + 0.3 * pickFlash)}`,
              transform: `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
              fontFamily: FONT.mono,
              fontWeight: 500,
              fontSize,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
              color: mixHex(C.paper, C.ink, fill),
            }}
          >
            {fill > 0.001 ? (
              /* the selection floods out from the centre (an ink-fill, clipped by the pill) */
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: C.paper,
                  clipPath: `circle(${(14 + (Math.hypot(w, h) / 2 - 10) * fill).toFixed(2)}px at 50% 50%)`,
                }}
              />
            ) : null}
            {glint ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: glint.layer,
                  backgroundSize: glint.size,
                  backgroundPosition: glint.pos,
                  backgroundRepeat: 'no-repeat',
                  mixBlendMode: fill > 0.5 ? 'normal' : 'screen',
                }}
              />
            ) : null}
            <span style={{ position: 'relative' }}>{lab}</span>
          </div>
        </div>
        <Sparks t={t} at={hit} x={baseX} y={cy} color={WAVE} n={10} rx={w * 0.56} ry={h * 0.62} reach={74} life={13} size={4} arc={[-200, 20]} seed={`chip${i}`} />
        {selected ? (
          <Sparks t={t} at={pick} x={baseX} y={cy} color={WAVE} hot={C.paper} n={14} rx={w * 0.56} ry={h * 0.62} reach={104} life={15} size={4.5} arc={[-205, 25]} seed="pick" />
        ) : null}
      </React.Fragment>,
    );
  });
  return <>{nodes}</>;
};

/* ── the last line's row B: the booked mark ─────────────────────── */

/** "Wednesday" · "at" · "3 PM" — the time arrives as one, with the ember, on "three" */
const MARK_WORDS = [BOOKING.day, BOOKING.at, BOOKING.time];
const ENTER = 6;

/** The mark's box, exactly as <BookedMark> sets it (Shared.tsx), so the swap is invisible. */
const markBox = (x: number, y: number, fontSize: number): React.CSSProperties => ({
  position: 'absolute',
  left: x,
  top: y,
  transform: 'translate(-50%, -50%)',
  whiteSpace: 'nowrap',
  fontFamily: FONT.body,
  fontWeight: 500,
  fontSize,
  lineHeight: 1.22,
  letterSpacing: '-0.01em',
});

/** a word entering in place: opacity, .16em rise, blur 3 → 0 over 6 f (on its appear frame it is 1/6 in) */
const enterStyle = (t: number, a: number): React.CSSProperties => {
  const u = Math.min(1, Math.max(0, (t - a + 1) / ENTER));
  if (u >= 1) return { display: 'inline-block' };
  const e = EASE.out3(u);
  return {
    display: 'inline-block',
    opacity: u <= 0 ? 0 : e,
    transform: `translateY(${(0.16 * (1 - e)).toFixed(4)}em)`,
    filter: u > 0 ? `blur(${(3 * (1 - e)).toFixed(2)}px)` : undefined,
  };
};

export const MarkRow: React.FC<{
  t: number;
  /** appear frames of "Wednesday", "at", "3 PM" and the period */
  appear: readonly [number, number, number, number];
  /** 0..1 paper → ember */
  ember: number;
  /** 0..1 light sweep across the mark (ember turn); <0 or >1 none */
  sheen: number;
  /** the payoff beat: the mark's scale (exactly 1 before the hand-over) */
  pulse: number;
  /** the period leaves with its row (the caption's designed exit, CallCaptions.wordExit), or null */
  periodExit: { dy: number; scale: number; op: number } | null;
  /** 0..1 the mark takes the orb: it flares (hotter ember, a glow round the letters) */
  flare?: number;
  x: number;
  y: number;
  fontSize: number;
  show: boolean;
}> = ({ t, appear, ember, sheen, pulse, periodExit, flare = 0, x, y, fontSize, show }) => {
  if (!show || t < appear[0] - 1) return null;
  const color = mixHex(mixHex(C.paper, C.emberLit, ember), C.emberSoft, 0.7 * flare);
  const flareShadow = flare > 0.01 ? `0 0 ${(0.3 + 0.25 * flare).toFixed(3)}em rgba(255,170,110,${(0.75 * flare).toFixed(3)})` : undefined;
  const sheenOn = sheen > 0 && sheen < 1;
  const allIn = t >= appear[2] - 1 + ENTER;
  const pPeriod = Math.min(1, Math.max(0, (t - appear[3] + 1) / ENTER));
  const scale = `scale(${pulse.toFixed(5)})`;
  return (
    <>
      {allIn ? (
        <BookedMark
          color={color}
          x={x}
          y={y}
          fontSize={fontSize}
          style={{
            transform: `translate(-50%, -50%) ${scale}`,
            textShadow: flareShadow,
            ...(sheenOn
              ? {
                  backgroundImage: `linear-gradient(100deg, ${color} 0%, ${color} 38%, ${C.emberSoft} 50%, ${color} 62%, ${color} 100%)`,
                  backgroundSize: '300% 100%',
                  backgroundPosition: `${((1 - sheen) * 100).toFixed(2)}% 0`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }
              : null),
          }}
        />
      ) : (
        /* arriving: the mark's own box, one span per word, each entering on its spoken word */
        <div style={{ ...markBox(x, y, fontSize), transform: `translate(-50%, -50%) ${scale}`, color }}>
          {MARK_WORDS.map((w, i) => (
            <React.Fragment key={i}>
              {i > 0 ? ' ' : null}
              <span
                style={{
                  ...enterStyle(t, appear[i]),
                  // "3 PM" arrives with the ember: a hot core that cools into the mark
                  textShadow:
                    i === 2 && t >= appear[2] ? `0 0 0.4em rgba(255,184,119,${(0.7 * (1 - ember)).toFixed(3)})` : undefined,
                }}
              >
                {w}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      {/* the period rides a twin of the mark's box (same face / size) */}
      {pPeriod > 0 && (!periodExit || periodExit.op > 0.002) ? (
        <div style={{ ...markBox(x, y, fontSize), color: C.paper }}>
          <span style={{ visibility: 'hidden' }}>{BOOKING.mark}</span>
          <span
            style={{
              position: 'absolute',
              left: '100%',
              top: `calc(${((1 - EASE.out3(pPeriod)) * 0.16).toFixed(3)}em + ${(periodExit ? periodExit.dy : 0).toFixed(2)}px)`,
              opacity: EASE.out3(pPeriod) * (periodExit ? periodExit.op : 1),
              filter: pPeriod < 1 ? `blur(${(3 * (1 - EASE.out3(pPeriod))).toFixed(2)}px)` : undefined,
              transform: periodExit ? `scale(${periodExit.scale.toFixed(4)})` : undefined,
              transformOrigin: '0% 80%',
            }}
          >
            .
          </span>
        </div>
      ) : null}
    </>
  );
};
