/**
 * After the call: THE CALL → SLACK → CRM, at film scale, drawn like a
 * product diagram — hairline precision, one accent:
 *
 *   rail      a 4 px hairline track node → node; the accent line draws along
 *             it (EASE.peel: leaves the node slow, arrives slow) with a small
 *             solid head — no comet, no glow, no smear
 *   nodes     30 px rings; each fills ON its station frame (the accent disc
 *             springs in, one soft overshoot) and sends out one thin ring; the
 *             CRM node — FLOW_END, where the CTA's iris opens — confirms with
 *             a white check and pings twice; then light pulses run along the
 *             finished rail call → CRM on the 8th notes (data syncing)
 *   stations  white cards (Cards.tsx) that land with their content (never an
 *             empty card): a monoline icon that draws on in the accent and
 *             settles to ink, the line in the title role (64 / 56 px); 16:9
 *             names (title role) above the nodes, 9:16 names in the card's
 *             top-left. The call's "Booked" pill is in the scene's one accent
 *             (emerald on a pale emerald tint — no second accent here); the
 *             CRM's "Contact saved" turns to the accent as its check lands.
 */
import React from 'react';
import { BOOKING } from '../../components/Shared';
import { C, R } from '../../theme';
import { aos, EASE, mixHex, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { reveal, revealStyle, useGlide } from '../../components/Type';
import { Card, DrawIcon } from './Cards';
import { STATION_ICONS, STATION_NAMES } from './data';
import type { Geo, Pt } from './geometry';
import { ACCENT, ACCENT_LIT, ACCENT_TINT, META, rgba, tintInk } from './lights';

export type FlowTiming = {
  trackIn: number;
  stations: readonly number[];
  fills: readonly number[];
  cardsIn: readonly number[];
  rails: readonly (readonly [number, number])[];
  ok: number;
  ping: readonly [number, number];
  /** the frames each light pulse leaves the call node (it reaches the CRM `moteDur` later) */
  stream: readonly number[];
  moteDur: number;
  callIn: number;
  pill: number;
};

const NODE = 30;
const RAIL = 4;
const HEAD = 12;
const TRACK = 'rgba(20,16,28,0.10)';
const RING = 'rgba(20,16,28,0.18)';

/** the rail head along segment i at f (EASE.peel: leaves the node slow, arrives slow) */
const headAt = (f: number, [a, b]: readonly [number, number]) => tween(f, [a, b], [0, 1], EASE.peel);

/** a node's fill: the disc springs in from the frame before its station (ζ ≈ .6: one soft 8 % overshoot) */
const FILL = { stiffness: 420, damping: 20, mass: 0.6 };

/* ── the rail + nodes (+ 16:9 names) ─────────────────────────────── */
export const Rail: React.FC<{ t: number; G: Geo; vertical: boolean; T: FlowTiming }> = ({ t, G, vertical, T }) => {
  if (t < T.trackIn - 2) return null;
  const [n0, , n2] = G.nodes;
  const len = vertical ? n2.y - n0.y : n2.x - n0.x;
  const reveal0 = Math.min(1, Math.max(0, aos(t, T.trackIn, { anticip: 0, depth: 0, config: SPRING.glide })));
  const bar = (A: Pt, l: number, color: string): React.CSSProperties => ({
    position: 'absolute',
    borderRadius: RAIL,
    background: color,
    ...(vertical
      ? { left: A.x - RAIL / 2, top: A.y, width: RAIL, height: Math.max(0, l) }
      : { left: A.x, top: A.y - RAIL / 2, width: Math.max(0, l), height: RAIL }),
  });

  const segs = T.rails.map((r, i) => {
    const A = G.nodes[i];
    const B = G.nodes[i + 1];
    const L = vertical ? B.y - A.y : B.x - A.x;
    return { A, L, f: headAt(t, r), i };
  });

  return (
    <>
      {/* the hairline track */}
      <div style={bar(n0, len * reveal0, TRACK)} />
      {/* the accent line, node to node, with a small solid head while it runs */}
      {segs.map((s) =>
        s.f > 0 ? (
          <React.Fragment key={`fill-${s.i}`}>
            <div style={bar(s.A, s.L * s.f, ACCENT)} />
            {s.f < 1 ? (
              <div
                style={{
                  position: 'absolute',
                  left: (vertical ? s.A.x : s.A.x + s.L * s.f) - HEAD / 2,
                  top: (vertical ? s.A.y + s.L * s.f : s.A.y) - HEAD / 2,
                  width: HEAD,
                  height: HEAD,
                  borderRadius: '50%',
                  background: ACCENT,
                  // the head eases in off the node and out into the next (no pop)
                  transform: `scale(${(smooth(0, 0.12, s.f) * (1 - smooth(0.9, 1, s.f))).toFixed(4)})`,
                }}
              />
            ) : null}
          </React.Fragment>
        ) : null,
      )}

      {/* the finished rail syncs: short pulses of light run call → CRM on the 8th notes */}
      {T.stream.map((a, j) => {
        const u = tween(t, [a, a + T.moteDur], [0, 1], EASE.inOut);
        if (t < a || u >= 1) return null;
        const head = vertical ? { x: n0.x, y: n0.y + len * u } : { x: n0.x + len * u, y: n0.y };
        const ml = 90;
        const fade = smooth(0, 0.15, u) * (1 - smooth(0.88, 1, u));
        const dir = vertical ? 'to bottom' : 'to right';
        return (
          <div
            key={`pulse-${j}`}
            style={{
              position: 'absolute',
              ...(vertical
                ? { left: head.x - RAIL / 2, top: head.y - ml, width: RAIL, height: ml }
                : { left: head.x - ml, top: head.y - RAIL / 2, width: ml, height: RAIL }),
              borderRadius: RAIL,
              background: `linear-gradient(${dir}, ${rgba(ACCENT_LIT, 0)}, ${rgba(ACCENT_LIT, 0.9)} 70%, #e9fff5)`,
              opacity: fade,
            }}
          />
        );
      })}

      {/* nodes */}
      {G.nodes.map((n, i) => {
        const appear = aos(t, T.trackIn + i * 2, { anticip: 0, depth: 0, config: SPRING.pop });
        if (appear <= 0) return null;
        const st = T.stations[i];
        const last = i === G.nodes.length - 1;
        const fill = springUnit(t - T.fills[i], FILL);
        const rings = last ? [[st, st + 16, 2.6], [T.ping[0] + 4, T.ping[0] + 26, 3.4]] : [[st, st + 16, 2.4]];
        // the CRM receives each pulse: a breath of the ring (the node itself never moves: FLOW_END)
        let recv = 0;
        if (last) for (const a of T.stream) recv = Math.max(recv, t < a + T.moteDur - 1 ? 0 : 1 - tween(t, [a + T.moteDur - 1, a + T.moteDur + 9], [0, 1], EASE.out3));
        return (
          <div
            key={`node-${i}`}
            style={{
              position: 'absolute',
              left: n.x - NODE / 2,
              top: n.y - NODE / 2,
              width: NODE,
              height: NODE,
              transform: appear < 0.9999 || appear > 1.0001 ? `scale(${Math.max(0, appear).toFixed(4)})` : undefined,
            }}
          >
            {/* the ring on paper (a white disc with a hairline, a hair of contact shadow) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: C.white,
                boxShadow: `inset 0 0 0 2px ${fill > 0.5 ? ACCENT : RING}, 0 0 0 5px ${C.white}, 0 3px 8px -3px rgba(20,16,28,0.25)`,
              }}
            />
            {rings.map(([a, b, k], j) => {
              if (t < a || t > b) return null;
              const p = tween(t, [a, b], [0, 1], EASE.out3);
              return (
                <div
                  key={j}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    boxShadow: `inset 0 0 0 ${(2 / (1 + (k - 1) * p)).toFixed(3)}px ${ACCENT}`,
                    opacity: (1 - p) * (1 - p) * 0.8,
                    transform: `scale(${(1 + (k - 1) * p).toFixed(4)})`,
                  }}
                />
              );
            })}
            {recv > 0.01 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  boxShadow: `0 0 0 ${(6 * recv).toFixed(2)}px ${rgba(ACCENT_LIT, 0.22 * recv)}`,
                }}
              />
            ) : null}
            {fill > 0.001 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: ACCENT,
                  transform: `scale(${Math.max(0, fill).toFixed(4)})`,
                }}
              />
            ) : null}
            {last && t >= st ? (
              // the confirm: a white check draws inside the CRM node
              <svg width={NODE} height={NODE} viewBox="0 0 40 40" style={{ position: 'absolute', inset: 0, transform: `scale(${Math.max(0, Math.min(1.06, fill)).toFixed(4)})` }}>
                <path
                  d="M12.5 20.5 L17.5 25.5 L27.5 15"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={3.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray="1 2"
                  strokeDashoffset={1 - tween(t, [st + 1, st + 7], [0, 1], EASE.out3)}
                />
              </svg>
            ) : null}
          </div>
        );
      })}

      {/* 16:9: the station names, centred above their nodes */}
      {vertical
        ? null
        : G.names.map((p, i) => (
            <div
              key={`name-${i}`}
              style={{
                position: 'absolute',
                left: p.x - 300,
                width: 600,
                top: p.y - 38,
                textAlign: 'center',
                ...typeStyle('title', false, { tone: 'paper' }),
                lineHeight: '76px',
                color: C.ink,
                whiteSpace: 'nowrap',
              }}
            >
              <MaskWords text={STATION_NAMES[i]} t={t} at={T.cardsIn[i]} />
            </div>
          ))}
    </>
  );
};

/* ── type ────────────────────────────────────────────────────────── */
/** words rising out of their masks (0.8 f apart) — never an empty card, never a plain fade */
const MaskWords: React.FC<{ text: string; t: number; at: number; color?: string }> = ({ text, t, at, color }) => {
  // under the flow's push / nudges each word holds its own sub-pixel layer (no 1 px ticks)
  const glide = useGlide();
  const ws = text.split(' ');
  return (
    <>
      {ws.map((w, j) => {
        const r = reveal(t, at + 0.8 * j, { config: SPRING.caption, rise: 100, fade: 0.5 });
        return (
          <span key={j} style={maskBox(j < ws.length - 1 ? 0.24 : 0)}>
            <span style={{ ...revealStyle(r, undefined, glide), color }}>{w}</span>
          </span>
        );
      })}
    </>
  );
};

/** the station's icon: drawn on in the accent as its card lands, settling to ink */
const StationIcon: React.FC<{ i: number; t: number; at: number; st: number; size: number }> = ({ i, t, at, st, size }) => {
  const draw = tween(t, [at, at + 10], [0, 1], EASE.out3);
  const k = 1 - smooth(st + 4, st + 20, t);
  return <DrawIcon Icon={STATION_ICONS[i]} size={size} color={tintInk(ACCENT, k)} draw={draw} stroke={1.5} />;
};

/** the "Booked" pill, in the scene's one accent (emerald on its pale tint) */
const Pill: React.FC<{ t: number; at: number; size: number }> = ({ t, at, size }) => {
  if (t < at - 1) return null;
  const p = springUnit(t - (at - 1), { stiffness: 320, damping: 20, mass: 0.7 });
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.36,
        height: size * 1.7,
        padding: `0 ${size * 0.66}px 0 ${size * 0.56}px`,
        borderRadius: R.pill,
        background: ACCENT_TINT,
        color: ACCENT,
        ...typeStyle('label', false, { tone: 'paper', size, weight: 520 }),
        letterSpacing: '0.01em',
        textTransform: 'none',
        opacity: smooth(0, 0.4, p),
        transform: `scale(${(0.86 + 0.14 * p).toFixed(4)})`,
        transformOrigin: '0% 50%',
      }}
    >
      <div style={{ width: size * 0.3, height: size * 0.3, borderRadius: '50%', background: ACCENT }} />
      Booked
    </div>
  );
};

/** the CRM's check badge: pops on the confirm, its check drawing */
const Check: React.FC<{ t: number; at: number; size: number }> = ({ t, at, size }) => {
  if (t < at - 1) return null;
  const p = springUnit(t - (at - 1), { stiffness: 360, damping: 19, mass: 0.6 });
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: ACCENT,
        transform: `scale(${Math.max(0, p).toFixed(4)})`,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block' }}>
        <path
          d="M12.5 20.5 L17.5 25.5 L27.5 15"
          fill="none"
          stroke="#ffffff"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1 2"
          strokeDashoffset={1 - tween(t, [at, at + 6], [0, 1], EASE.out3)}
        />
      </svg>
    </div>
  );
};

/** the Slack line's booking, short: "Wed 3 PM" (the call's booking, as said) */
const WHEN = `${BOOKING.day.slice(0, 3)} ${BOOKING.time}`;

/** One station card's content. i: 0 the call, 1 Slack, 2 CRM. */
export const StationFace: React.FC<{ i: number; t: number; T: FlowTiming; vertical: boolean }> = ({ i, t, T, vertical: v }) => {
  const pad = v ? 38 : 42;
  const st = T.stations[i];
  // (THE CALL is the Japanese card in flight: its face is up as it hands over, mid-flight — never an empty card)
  const at = i === 0 ? T.callIn - 0.5 : T.cardsIn[i];
  const title = typeStyle('title', v, { tone: 'paper' });
  const icon = <StationIcon i={i} t={t} at={at} st={st} size={v ? 50 : 58} />;
  const saved = tween(t, [T.ok, T.ok + 10], [0, 1], EASE.house);
  const lineStyle: React.CSSProperties = { ...title, lineHeight: 1.08, color: C.ink, whiteSpace: 'nowrap' };
  const lines: React.ReactNode[] =
    i === 0
      ? [<MaskWords key="a" text="New caller" t={t} at={at} />]
      : i === 1
        ? v
          ? [<MaskWords key="a" text={`Booked ${BOOKING.sep} ${WHEN}`} t={t} at={at} />]
          : [<MaskWords key="a" text="Booked" t={t} at={at} />, <MaskWords key="b" text={WHEN} t={t} at={at + 0.8} />]
        : [<MaskWords key="a" text="Contact saved" t={t} at={at} color={mixHex(C.ink, ACCENT, saved)} />];
  const tag =
    i === 0 ? (
      <Pill t={t} at={T.pill} size={v ? 28 : 32} />
    ) : i === 1 ? (
      <div style={{ ...typeStyle('meta', v, { tone: 'paper' }), color: META, whiteSpace: 'nowrap' }}>
        <MaskWords text="#front-desk" t={t} at={at + 1} />
      </div>
    ) : (
      <Check t={t} at={T.ok} size={v ? 52 : 56} />
    );
  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {lines.map((l, j) => (
        <div key={j} style={lineStyle}>
          {l}
        </div>
      ))}
    </div>
  );
  return v ? (
    <>
      <div style={{ position: 'absolute', left: pad, top: pad - 6, display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={lineStyle}>
          <MaskWords text={STATION_NAMES[i]} t={t} at={at} />
        </div>
        {i === 1 ? tag : null}
      </div>
      <div style={{ position: 'absolute', right: pad, top: pad }}>{icon}</div>
      <div style={{ position: 'absolute', left: pad, bottom: pad - 10, display: 'flex', alignItems: 'center', gap: 22 }}>
        {body}
        {i === 1 ? null : tag}
      </div>
    </>
  ) : (
    <>
      <div style={{ position: 'absolute', left: pad, top: pad }}>{icon}</div>
      <div style={{ position: 'absolute', right: pad, top: pad + (i === 2 ? -3 : 4) }}>{tag}</div>
      <div style={{ position: 'absolute', left: pad, bottom: pad - 12 }}>{body}</div>
    </>
  );
};

/** Slack + CRM: card and content land together (a rise + settle, its shadow tightening as it lands). */
export const StationCards: React.FC<{ t: number; G: Geo; vertical: boolean; T: FlowTiming }> = ({ t, G, vertical, T }) => (
  <>
    {[1, 2].map((i) => {
      const at = T.cardsIn[i];
      if (t < at - 1) return null;
      // ζ ≈ .7: up in ≈ 4 f (it lands ON its station frame), one soft overshoot
      const p = springUnit(t - (at - 1), { stiffness: 330, damping: 23, mass: 0.8 });
      const moving = Math.abs(1 - p) > 2e-4;
      return (
        <Card
          key={i}
          r={G.stations[i]}
          transform={moving ? `translateY(${((1 - p) * 44).toFixed(3)}px) scale(${(0.965 + 0.035 * p).toFixed(5)})` : undefined}
          opacity={smooth(0, 0.35, p)}
          lift={1 + 0.9 * Math.max(0, 1 - p)}
          radius={vertical ? 28 : 30}
          moving={moving}
        >
          <StationFace i={i} t={t} T={T} vertical={vertical} />
        </Card>
      );
    })}
  </>
);
