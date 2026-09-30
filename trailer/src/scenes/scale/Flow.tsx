/**
 * After the call: THE CALL → SLACK → CRM, at film scale.
 *
 *   rail      an 8 px electric line node → node, drawn by a 20 px glowing
 *             bead (comet tail + a directional shutter blur while it runs)
 *             over a pale track
 *   nodes     40 px; each fills ON its station frame through 1.35 → 1 (k380
 *             c14) with a 2.5× ping; the CRM node is green and pings twice
 *   stations  big white cards (a 96 px icon + one plain line) that slam in
 *             with their content (never an empty card); 16:9 names above the
 *             nodes, 9:16 names in the card's top-left
 */
import React from 'react';
import { C, FONT, R } from '../../theme';
import { aos, EASE, mixHex, SPRING, tween } from '../../lib/motion';
import { Box, popFill } from './Cards';
import { dspring } from './curves';
import { STATION_ICONS, STATION_NAMES } from './data';
import type { Geo, Pt } from './geometry';
import { DirBlur, dirBlurRef, sigmaFor } from './MotionBlur';
import { Rise } from './Rise';

export type FlowTiming = {
  trackIn: number;
  stations: readonly number[];
  fills: readonly number[];
  cardsIn: readonly number[];
  rails: readonly (readonly [number, number])[];
  ok: number;
  ping: readonly [number, number];
  callIn: number;
  pill: number;
};

const NODE = 40;
const RAIL = 8;
const BEAD = 20;

/** the rail head along segment i at f (EASE.peel: leaves the node slow, arrives slow) */
const headAt = (f: number, [a, b]: readonly [number, number]) => tween(f, [a, b], [0, 1], EASE.peel);

/* ── the rail + nodes (+ 16:9 names) ─────────────────────────────── */
export const Rail: React.FC<{ t: number; G: Geo; vertical: boolean; T: FlowTiming }> = ({ t, G, vertical, T }) => {
  if (t < T.trackIn - 2) return null;
  const [n0, , n2] = G.nodes;
  const len = vertical ? n2.y - n0.y : n2.x - n0.x;
  const reveal = aos(t, T.trackIn, { anticip: 0, depth: 0, config: SPRING.site });
  const bar = (A: Pt, l: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute',
    borderRadius: RAIL,
    background: color,
    ...(vertical
      ? { left: A.x - RAIL / 2, top: A.y, width: RAIL, height: Math.max(0, l) }
      : { left: A.x, top: A.y - RAIL / 2, width: Math.max(0, l), height: RAIL }),
    ...extra,
  });

  const segs = T.rails.map((r, i) => {
    const A = G.nodes[i];
    const B = G.nodes[i + 1];
    const L = vertical ? B.y - A.y : B.x - A.x;
    const f = headAt(t, r);
    const v = (headAt(t + 0.5, r) - headAt(t - 0.5, r)) * L; // px / frame
    const on = t >= r[0] - 0.5 && t <= r[1] + 0.5;
    return { A, L, f, v, on, i };
  });

  return (
    <>
      {/* the pale track */}
      <div style={bar(n0, len * Math.min(1, Math.max(0, reveal)), 'rgba(124,58,237,0.13)')} />
      {/* the electric fill, node to node */}
      {segs.map((s) => (s.f > 0 ? <div key={`fill-${s.i}`} style={bar(s.A, s.L * s.f, C.electric)} /> : null))}
      {/* the bead: comet tail + shutter blur while it runs */}
      {segs.map((s) => {
        if (!s.on || s.f >= 1) return null;
        const head = vertical ? { x: s.A.x, y: s.A.y + s.L * s.f } : { x: s.A.x + s.L * s.f, y: s.A.y };
        const tail = Math.min(140, Math.abs(s.v) * 1.1);
        const sig = Math.min(12, Math.max(0, sigmaFor(s.v)));
        const id = `scale-bead-${s.i}`;
        const f = dirBlurRef(id, vertical ? 0 : sig, vertical ? sig : 0);
        return (
          <React.Fragment key={`bead-${s.i}`}>
            {f ? <DirBlur id={id} sx={vertical ? 0 : sig} sy={vertical ? sig : 0} /> : null}
            <div style={{ position: 'absolute', inset: 0, filter: f }}>
              <div
                style={{
                  position: 'absolute',
                  ...(vertical
                    ? { left: head.x - BEAD / 2, top: head.y - tail - BEAD / 2, width: BEAD, height: tail + BEAD }
                    : { left: head.x - tail - BEAD / 2, top: head.y - BEAD / 2, width: tail + BEAD, height: BEAD }),
                  borderRadius: BEAD,
                  background: `linear-gradient(${vertical ? 'to bottom' : 'to right'}, rgba(124,58,237,0), rgba(124,58,237,0.55) 70%, ${C.electric})`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: head.x - BEAD / 2,
                  top: head.y - BEAD / 2,
                  width: BEAD,
                  height: BEAD,
                  borderRadius: '50%',
                  background: `radial-gradient(circle at 40% 40%, #ffffff 0%, ${C.lilac} 28%, ${C.electric} 70%)`,
                  boxShadow: '0 0 18px rgba(124,58,237,0.6), 0 0 0 3px rgba(124,58,237,0.18)',
                }}
              />
            </div>
          </React.Fragment>
        );
      })}

      {/* nodes */}
      {G.nodes.map((n, i) => {
        const appear = aos(t, T.trackIn + i * 2, { anticip: 2, depth: 0.12, config: SPRING.pop });
        if (appear <= 0) return null;
        const at = T.fills[i];
        const st = T.stations[i];
        const last = i === G.nodes.length - 1;
        const col = last ? C.settled : C.electric;
        // fill: 0 → 1.35 on the station frame, then k380 c14 back to 1
        const fill =
          t < at ? 0 : t < st ? tween(t, [at, st], [0, 1.35], EASE.out3) : 1.35 - 0.35 * dspring(t - st, { stiffness: 380, damping: 14, mass: 1 });
        const rings = last ? [[st, st + 12, 2.5, 0.55], [T.ping[0] + 4, T.ping[1], 3.4, 0.35]] : [[st, st + 12, 2.5, 0.5]];
        return (
          <div
            key={`node-${i}`}
            style={{
              position: 'absolute',
              left: n.x - NODE / 2,
              top: n.y - NODE / 2,
              width: NODE,
              height: NODE,
              transform: `scale(${Math.max(0, appear).toFixed(4)})`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: C.white,
                boxShadow: `inset 0 0 0 3px rgba(124,58,237,0.32), 0 0 0 6px ${C.white}, 0 6px 16px -6px rgba(24,16,40,0.3)`,
              }}
            />
            {rings.map(([a, b, k, o], j) => {
              if (t < a || t > b) return null;
              const p = tween(t, [a, b], [0, 1], EASE.out3);
              return (
                <div
                  key={j}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    boxShadow: `inset 0 0 0 ${(3 / (1 + (k - 1) * p)).toFixed(3)}px ${col}`,
                    background: last ? 'rgba(31,138,85,0.16)' : 'rgba(124,58,237,0.14)',
                    opacity: o * (1 - p) * (1 - p) / 0.5,
                    transform: `scale(${(1 + (k - 1) * p).toFixed(4)})`,
                  }}
                />
              );
            })}
            {fill > 0.001 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: col,
                  transform: `scale(${fill.toFixed(4)})`,
                  boxShadow: `0 0 ${(22 * Math.min(1, fill)).toFixed(1)}px ${last ? 'rgba(31,138,85,0.55)' : 'rgba(124,58,237,0.55)'}`,
                }}
              />
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
                top: p.y - 27,
                textAlign: 'center',
                fontFamily: FONT.body,
                fontWeight: 500,
                fontSize: 44,
                lineHeight: '54px',
                letterSpacing: '-0.015em',
                color: C.ink,
                whiteSpace: 'nowrap',
              }}
            >
              <Rise text={STATION_NAMES[i]} t={t} at={T.cardsIn[i]} stagger={0.4} />
            </div>
          ))}
    </>
  );
};

/* ── station faces ───────────────────────────────────────────────── */
const line = (size: number, color: string = C.ink): React.CSSProperties => ({
  fontFamily: FONT.body,
  fontWeight: 500,
  fontSize: size,
  lineHeight: 1.15,
  letterSpacing: '-0.012em',
  color,
  whiteSpace: 'nowrap',
});

/** the station's icon: ink, flashing electric (settled on the CRM) on its station frame */
const StationIcon: React.FC<{ i: number; t: number; at: number; size: number }> = ({ i, t, at, size }) => {
  const Icon = STATION_ICONS[i];
  const fk = t < at ? 0 : 1 - tween(t, [at, at + 6], [0, 1], EASE.out3);
  const hot = i === 2 ? C.settled : C.electric;
  const glow = i === 2 ? '31,138,85' : '124,58,237';
  return (
    <div style={{ width: size, height: size, filter: fk > 0.01 ? `drop-shadow(0 0 26px rgba(${glow},${(0.65 * fk).toFixed(3)}))` : undefined }}>
      <Icon size={size} strokeWidth={2} color={mixHex(C.ink, hot, fk)} />
    </div>
  );
};

/** the ember "Booked" pill (the only ember in the act) */
const Pill: React.FC<{ t: number; at: number; size: number }> = ({ t, at, size }) => {
  const p = aos(t, at, { anticip: 2, depth: 0.12, config: { stiffness: 420, damping: 16, mass: 0.7 } });
  if (t < at - 2) return null;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.34,
        height: size * 1.6,
        padding: `0 ${size * 0.62}px 0 ${size * 0.52}px`,
        borderRadius: R.pill,
        background: C.emberSoft,
        color: C.emberInk,
        fontFamily: FONT.body,
        fontWeight: 500,
        fontSize: size,
        opacity: tween(t, [at, at + 2], [0, 1], EASE.out3),
        transform: `scale(${Math.max(0, 0.6 + 0.4 * p).toFixed(4)})`,
        transformOrigin: '0% 50%',
        boxShadow: `0 0 0 ${(8 * Math.max(0, 1 - tween(t, [at, at + 10], [0, 1], EASE.out3))).toFixed(2)}px rgba(238,84,35,0.14)`,
      }}
    >
      <div style={{ width: size * 0.32, height: size * 0.32, borderRadius: '50%', background: C.ember }} />
      Booked
    </div>
  );
};

/** One station card's content. i: 0 the call, 1 Slack, 2 CRM. */
export const StationFace: React.FC<{ i: number; t: number; T: FlowTiming; vertical: boolean }> = ({ i, t, T, vertical }) => {
  const pad = vertical ? 36 : 40;
  const st = T.stations[i];
  const icon = <StationIcon i={i} t={t} at={st} size={96} />;
  const okP = i === 2 ? dspring(t - T.ok, { stiffness: 480, damping: 15, mass: 0.6 }) : 0;
  const body =
    i === 0 ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={line(40)}>New caller</div>
        <Pill t={t} at={T.pill} size={30} />
      </div>
    ) : i === 1 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: 32, lineHeight: 1.1, color: C.muted, whiteSpace: 'nowrap' }}>#front-desk</div>
        <div style={line(40)}>Booked · Wed 15:00</div>
      </div>
    ) : (
      <div style={{ ...line(40, mixHex(C.ink, C.settled, tween(t, [T.ok, T.ok + 3], [0, 1], EASE.out3))), display: 'flex', alignItems: 'center', gap: 14 }}>
        Contact saved
        <span
          style={{
            display: 'inline-block',
            color: C.settled,
            transform: `scale(${(t < T.ok ? 0 : Math.max(0, okP)).toFixed(4)})`,
            transformOrigin: '50% 60%',
          }}
        >
          ✓
        </span>
      </div>
    );
  return vertical ? (
    <>
      <div style={{ position: 'absolute', left: pad, top: pad - 4, ...line(40) }}>{STATION_NAMES[i]}</div>
      <div style={{ position: 'absolute', right: pad, top: pad }}>{icon}</div>
      <div style={{ position: 'absolute', left: pad, bottom: pad - 4 }}>{body}</div>
    </>
  ) : (
    <>
      <div style={{ position: 'absolute', left: pad - 4, top: pad - 4 }}>{icon}</div>
      <div style={{ position: 'absolute', left: pad, bottom: pad - 6 }}>{body}</div>
    </>
  );
};

/** Slack + CRM: card and content slam in together (y +40 → 0, the landing spring at film tempo). */
export const StationCards: React.FC<{ t: number; G: Geo; vertical: boolean; T: FlowTiming }> = ({ t, G, vertical, T }) => (
  <>
    {[1, 2].map((i) => {
      const at = T.cardsIn[i];
      if (t < at - 1) return null;
      // SPRING.land's shape (≈ 18 % overshoot), 1.6× faster so it lands inside an 8th note
      const p = dspring((t - at + 1) * 1.6, SPRING.land);
      const pv = dspring((t - at + 1.5) * 1.6, SPRING.land) - dspring((t - at + 0.5) * 1.6, SPRING.land);
      const sy = Math.min(10, sigmaFor(pv * 40));
      const id = `scale-st-${i}`;
      const f = t < at + 5 ? dirBlurRef(id, 0, sy) : undefined;
      return (
        <React.Fragment key={i}>
          {f ? <DirBlur id={id} sx={0} sy={sy} /> : null}
          <Box
            r={G.stations[i]}
            transform={`translateY(${((1 - p) * 40).toFixed(2)}px) scale(${(0.95 + 0.05 * Math.min(1.1, p)).toFixed(4)})`}
            opacity={tween(t, [at - 1, at + 1], [0, 1], EASE.out3)}
            lift={Math.max(0, 1 - p) * 0.8}
            bg={popFill(t, T.stations[i])}
            filter={f}
          >
            <StationFace i={i} t={t} T={T} vertical={vertical} />
          </Box>
        </React.Fragment>
      );
    })}
  </>
);
