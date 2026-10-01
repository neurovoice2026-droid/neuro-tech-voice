/**
 * After the call: THE CALL → SLACK → CRM, at film scale.
 *
 *   rail      a 10 px line in the closing light node → node, drawn by a 26 px
 *             glowing bead (comet tail + a directional shutter blur while it
 *             runs) over a pale track
 *   nodes     56 px; each fills ON its station frame through 1.35 → 1 (k380
 *             c14) with a 2.5× ping; the CRM node is green and pings twice
 *   stations  big white cards that fill the frame, slamming in with their
 *             content (never an empty card): a pearl icon disc that lights on
 *             the station frame (ripple + sparks), the line at reading size
 *             (64 px 16:9 · 60 px 9:16); 16:9 names (64 px) above the nodes,
 *             9:16 names in the card's top-left
 */
import React from 'react';
import { C, FONT, R } from '../../theme';
import { aos, EASE, mixHex, SPRING, tween } from '../../lib/motion';
import { Box, HitBurst, popFill } from './Cards';
import { dspring } from './curves';
import { STATION_ICONS, STATION_NAMES } from './data';
import type { Geo, Pt } from './geometry';
import { DirBlur, dirBlurRef, sigmaFor } from './MotionBlur';
import { Rise } from './Rise';
import { bodyOf, discHot, discRest, FLOW_LIGHT, rgba, SETTLED } from './lights';
import { LIGHTS } from '../../theme';

/** the closing light: emerald = confirmed */
const FL = LIGHTS[FLOW_LIGHT].orb;
const BODY = bodyOf(FLOW_LIGHT);
const DEEP = FL[1];
const INK = LIGHTS[FLOW_LIGHT].ink;

export type FlowTiming = {
  trackIn: number;
  stations: readonly number[];
  fills: readonly number[];
  cardsIn: readonly number[];
  rails: readonly (readonly [number, number])[];
  ok: number;
  ping: readonly [number, number];
  /** [first mote leaves the call node, it reaches the CRM] */
  stream: readonly [number, number];
  callIn: number;
  pill: number;
};

const NODE = 56;
const RAIL = 10;
const BEAD = 26;

/** the stream along the finished rail: a mote every 8th note from the CRM's confirm (SCALE_LOCAL.stream) */
const streamAt = (T: FlowTiming) => [0, 1].map((j) => T.stream[0] + j * 7.5);

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
      <div style={bar(n0, len * Math.min(1, Math.max(0, reveal)), rgba(BODY, 0.16))} />
      {/* the lit fill, node to node (the closing light, glowing) */}
      {segs.map((s) =>
        s.f > 0 ? (
          <div
            key={`fill-${s.i}`}
            style={bar(s.A, s.L * s.f, `linear-gradient(${vertical ? '180deg' : '90deg'}, ${BODY}, ${DEEP})`, {
              boxShadow: `0 0 14px ${rgba(BODY, 0.45)}`,
            })}
          />
        ) : null,
      )}
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
                  background: `linear-gradient(${vertical ? 'to bottom' : 'to right'}, ${rgba(BODY, 0)}, ${rgba(BODY, 0.55)} 70%, ${BODY})`,
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
                  background: `radial-gradient(circle at 40% 40%, #ffffff 0%, ${FL[3]} 30%, ${BODY} 72%)`,
                  boxShadow: `0 0 18px ${rgba(BODY, 0.6)}, 0 0 36px ${rgba(FL[3], 0.5)}, 0 0 0 3px ${rgba(BODY, 0.18)}`,
                }}
              />
            </div>
          </React.Fragment>
        );
      })}

      {/* the finished rail streams: light motes run call → CRM on the 8th notes (data syncing) */}
      {streamAt(T).map((a, j) => {
        const MOTE_DUR = T.stream[1] - T.stream[0];
        const u = tween(t, [a, a + MOTE_DUR], [0, 1], EASE.inOut);
        if (t < a || u >= 1) return null;
        const head = vertical ? { x: n0.x, y: n0.y + len * u } : { x: n0.x + len * u, y: n0.y };
        const du = tween(t + 0.5, [a, a + MOTE_DUR], [0, 1], EASE.inOut) - tween(t - 0.5, [a, a + MOTE_DUR], [0, 1], EASE.inOut);
        const ml = 26 + Math.min(90, du * len * 1.4);
        const fade = Math.min(1, u / 0.12, (1 - u) / 0.1);
        return (
          <div
            key={`mote-${j}`}
            style={{
              position: 'absolute',
              ...(vertical
                ? { left: head.x - RAIL / 2 - 1, top: head.y - ml, width: RAIL + 2, height: ml }
                : { left: head.x - ml, top: head.y - RAIL / 2 - 1, width: ml, height: RAIL + 2 }),
              borderRadius: RAIL,
              background: `linear-gradient(${vertical ? 'to bottom' : 'to right'}, ${rgba(FL[3], 0)}, ${rgba(FL[3], 0.9)} 70%, #ffffff)`,
              boxShadow: `0 0 12px ${rgba(FL[3], 0.8)}`,
              opacity: fade,
            }}
          />
        );
      })}

      {/* nodes */}
      {G.nodes.map((n, i) => {
        const appear = aos(t, T.trackIn + i * 2, { anticip: 2, depth: 0.12, config: SPRING.pop });
        if (appear <= 0) return null;
        const at = T.fills[i];
        const st = T.stations[i];
        const last = i === G.nodes.length - 1;
        const col = last ? SETTLED : BODY;
        // fill: 0 → 1.35 on the station frame, then k380 c14 back to 1
        const fill =
          t < at ? 0 : t < st ? tween(t, [at, st], [0, 1.35], EASE.out3) : 1.35 - 0.35 * dspring(t - st, { stiffness: 380, damping: 14, mass: 1 });
        const rings = last ? [[st, st + 12, 2.5, 0.55], [T.ping[0] + 4, T.ping[1], 3.4, 0.35]] : [[st, st + 12, 2.5, 0.5]];
        // the CRM receives each mote: its glow swells (the node itself never moves: FLOW_END)
        let recv = 0;
        const MOTE_DUR = T.stream[1] - T.stream[0];
        if (last) for (const a of streamAt(T)) recv = Math.max(recv, t < a + MOTE_DUR - 1 ? 0 : 1 - tween(t, [a + MOTE_DUR - 1, a + MOTE_DUR + 7], [0, 1], EASE.out3));
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
                boxShadow: `inset 0 0 0 3px ${rgba(BODY, 0.38)}, 0 0 0 6px ${C.white}, 0 6px 16px -6px rgba(24,16,40,0.3)`,
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
                    background: rgba(last ? SETTLED : BODY, 0.16),
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
                  boxShadow: `0 0 ${(22 * Math.min(1, fill) * (1 + 0.6 * recv)).toFixed(1)}px ${rgba(last ? SETTLED : BODY, 0.55 + 0.3 * recv)}, 0 0 ${(44 * Math.min(1, fill) * (1 + 0.8 * recv)).toFixed(1)}px ${rgba(FL[3], 0.45 + 0.4 * recv)}`,
                }}
              />
            ) : null}
            {last && t >= st ? (
              // the confirm: a white check draws inside the CRM node
              <svg width={NODE} height={NODE} viewBox="0 0 40 40" style={{ position: 'absolute', inset: 0, transform: `scale(${Math.max(0, fill).toFixed(4)})` }}>
                <path
                  d="M12 20.5 L17.5 26 L28.5 14.5"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={3.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - tween(t, [st + 1, st + 6], [0, 1], EASE.out3)}
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
                fontFamily: FONT.ui,
                fontWeight: 500,
                fontSize: 64,
                lineHeight: '76px',
                letterSpacing: '-0.025em',
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
  lineHeight: 1.08,
  letterSpacing: '-0.02em',
  color,
  whiteSpace: 'nowrap',
});

/**
 * The station's icon on a pearl disc: on its station frame the disc lights
 * (the closing light; the CRM settles green), the icon turns white, a ripple
 * and sparks leave it, and it settles back to the pearl disc + the light's ink.
 */
const StationIcon: React.FC<{ i: number; t: number; at: number; D: number }> = ({ i, t, at, D }) => {
  const Icon = STATION_ICONS[i];
  const fk = t < at ? 0 : 1 - tween(t, [at, at + 8], [0, 1], EASE.out3);
  const crm = i === 2;
  // the CRM keeps a settled-green disc once it has confirmed
  const keep = crm && t >= at ? 1 : 0;
  const hot = crm ? SETTLED : INK;
  const icon = Math.round(D * 0.52);
  const pop = t < at ? 1 : 1 + 0.12 * Math.sin(Math.min(1, (t - at) / 6) * Math.PI) * (1 - tween(t, [at, at + 8], [0, 1], EASE.out3));
  const lit = Math.max(fk, keep);
  return (
    <div style={{ position: 'relative', width: D, height: D, transform: pop !== 1 ? `scale(${pop.toFixed(4)})` : undefined }}>
      <HitBurst t={t} at={at} cx={D / 2} cy={D / 2} r={D / 2} light={FLOW_LIGHT} seed={`station-${i}`} n={7} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', ...discRest() }} />
      {lit > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: crm ? `radial-gradient(90% 90% at 30% 24%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 42%), linear-gradient(135deg, #34c97e 0%, ${SETTLED} 100%)` : discHot(FLOW_LIGHT),
            opacity: Math.min(1, lit * 1.15),
            boxShadow: `0 0 ${(D * 0.35 * Math.max(fk, 0.35 * keep)).toFixed(1)}px ${rgba(crm ? SETTLED : BODY, 0.55)}`,
          }}
        />
      ) : null}
      <div style={{ position: 'absolute', left: (D - icon) / 2, top: (D - icon) / 2, width: icon, height: icon }}>
        <Icon size={icon} strokeWidth={2.1} color={lit > 0.5 ? '#ffffff' : mixHex(C.ink, hot, lit * 2)} />
      </div>
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
        boxShadow: `0 0 0 ${(10 * Math.max(0, 1 - tween(t, [at, at + 10], [0, 1], EASE.out3))).toFixed(2)}px rgba(238,84,35,0.16)`,
      }}
    >
      <div style={{ width: size * 0.32, height: size * 0.32, borderRadius: '50%', background: C.ember }} />
      Booked
    </div>
  );
};

/** the CRM's check badge: pops on the confirm (anticipation, 1.12 overshoot) with a green ring */
const Check: React.FC<{ t: number; at: number; size: number }> = ({ t, at, size }) => {
  if (t < at - 2) return null;
  const p = aos(t, at, { anticip: 2, depth: 0.1, config: { stiffness: 480, damping: 15, mass: 0.6 } });
  const ringP = tween(t, [at, at + 10], [0, 1], EASE.out3);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {t >= at && ringP < 1 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 ${(3 * (1 - ringP) + 1).toFixed(2)}px ${rgba(SETTLED, 0.6 * (1 - ringP))}`,
            transform: `scale(${(1 + 0.9 * ringP).toFixed(4)})`,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `linear-gradient(135deg, #34c97e 0%, ${SETTLED} 100%)`,
          boxShadow: `0 6px 16px -6px ${rgba(SETTLED, 0.6)}`,
          transform: `scale(${Math.max(0, p).toFixed(4)})`,
        }}
      >
        <svg width={size} height={size} viewBox="0 0 40 40" style={{ position: 'absolute', inset: 0 }}>
          <path
            d="M12 20.5 L17.5 26 L28.5 14.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - tween(t, [at, at + 5], [0, 1], EASE.out3)}
          />
        </svg>
      </div>
    </div>
  );
};

/** One station card's content. i: 0 the call, 1 Slack, 2 CRM. */
export const StationFace: React.FC<{ i: number; t: number; T: FlowTiming; vertical: boolean }> = ({ i, t, T, vertical }) => {
  const pad = vertical ? 36 : 40;
  const st = T.stations[i];
  const body = vertical ? 60 : 64;
  const D = vertical ? 104 : 112;
  const icon = <StationIcon i={i} t={t} at={st} D={D} />;
  const saved = tween(t, [T.ok, T.ok + 3], [0, 1], EASE.out3);
  // the line's words settle in with the card (0.8 f apart): never an empty card, never a plain fade
  const words = (s: string, at: number, size: number, color?: string) =>
    s.split(' ').map((w, j, all) => {
      const p = dspring(t - at + 1.4 - 0.8 * j, { stiffness: 560, damping: 20, mass: 0.6 });
      return (
        <React.Fragment key={j}>
          <span style={{ display: 'inline-block', color, transform: p < 0.999 ? `translateY(${((1 - p) * size * 0.4).toFixed(2)}px)` : undefined }}>{w}</span>
          {j < all.length - 1 ? ' ' : null}
        </React.Fragment>
      );
    });
  const settledInk = mixHex(C.ink, C.settled, saved);
  const content =
    i === 0
      ? { tag: <Pill t={t} at={T.pill} size={vertical ? 34 : 36} />, lines: [words('New caller', T.cardsIn[0], body)] }
      : i === 1
        ? {
            tag: <div style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: vertical ? 32 : 34, lineHeight: 1, color: C.muted, whiteSpace: 'nowrap' }}>#front-desk</div>,
            lines: vertical ? [words('Booked · Wed 15:00', T.cardsIn[1], body)] : [words('Booked ·', T.cardsIn[1], body), words('Wed 15:00', T.cardsIn[1] + 1.6, body)],
          }
        : { tag: <Check t={t} at={T.ok} size={vertical ? 64 : 68} />, lines: [words('Contact saved', T.cardsIn[2], body, settledInk)] };
  const lines = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {content.lines.map((l, j) => (
        <div key={j} style={line(body)}>
          {l}
        </div>
      ))}
    </div>
  );
  return vertical ? (
    <>
      <div style={{ position: 'absolute', left: pad, top: pad - 6, display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={line(64)}>{words(STATION_NAMES[i], T.cardsIn[i], 64)}</div>
        {i === 1 ? content.tag : null}
      </div>
      <div style={{ position: 'absolute', right: pad, top: pad - 4 }}>{icon}</div>
      <div style={{ position: 'absolute', left: pad, bottom: pad - 8, display: 'flex', alignItems: 'center', gap: 22 }}>
        {lines}
        {i === 1 ? null : content.tag}
      </div>
    </>
  ) : (
    <>
      <div style={{ position: 'absolute', left: pad - 4, top: pad - 4 }}>{icon}</div>
      <div style={{ position: 'absolute', right: pad, top: pad + (D - (i === 2 ? 68 : 58)) / 2 }}>{content.tag}</div>
      <div style={{ position: 'absolute', left: pad, bottom: pad - 10 }}>{lines}</div>
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
            bg={popFill(t, T.stations[i], FLOW_LIGHT)}
            filter={f}
          >
            <StationFace i={i} t={t} T={T} vertical={vertical} />
          </Box>
        </React.Fragment>
      );
    })}
  </>
);
