/**
 * The site's after-call relay (after-call-relay.tsx) at film scale:
 *   dotted track (rgb(24 16 40 / .26) dots) · plum fill drawing with a bead
 *   on its leading end · hollow nodes that fill plum on arrival · the final
 *   node turns green and sends a ping ring out to 2.8×.
 * Stations: THE CALL (the collapsed deck, content drawn by <CallContent>),
 * SLACK (#front-desk) and CRM (POST … 200 OK). No logos — the site has none.
 */
import React from 'react';
import { spring } from 'remotion';
import { C, FONT, R, TRACK } from '../../theme';
import { aos, EASE, SPRING, tween } from '../../lib/motion';
import { FPS } from '../../timing';
import { Box, Slot } from './Cards';
import type { Geo, Pt } from './geometry';
import { Rise } from './Rise';

export type FlowTiming = {
  /** the track and hollow nodes appear */
  trackIn: number;
  /** arrival frame of each station (= the flow cues): the node is solid on it */
  stations: readonly number[];
  /** the node fill starts (a beat-fraction before its cue, so it is solid ON it) */
  fills: readonly number[];
  /** the CRM's "200 OK" row lands */
  ok: number;
  /** station labels + cards rise (0 = the call, drawn in the deck) */
  cardsIn: readonly number[];
  /** rail segments [start, end] between stations */
  rails: readonly (readonly [number, number])[];
  /** final ping ring */
  ping: readonly [number, number];
};

const NODE = 18;
const TRACK_W = 4;
const FILL_W = 3;
const BEAD = 11;

const rowIn = (t: number, at: number) => {
  const p = aos(t, at, { anticip: 2, depth: 0.06, config: SPRING.site });
  return {
    opacity: tween(t, [at, at + 6], [0, 1], EASE.out3),
    transform: `translateY(${((1 - p) * 10).toFixed(2)}px)`,
  };
};

export const Flow: React.FC<{ t: number; G: Geo; vertical: boolean; T: FlowTiming; part: 'rail' | 'stations' }> = ({
  t,
  G,
  vertical,
  T,
  part,
}) => {
  if (t < T.trackIn - 2) return null;
  const [n0, , n2] = G.nodes;

  /* ── the dotted track, revealed from the first node outward ── */
  const reveal = tween(t, [T.trackIn, T.trackIn + 10], [0, 1], EASE.house);
  const len = vertical ? n2.y - n0.y : n2.x - n0.x;
  const dots = `radial-gradient(circle, rgba(24,16,40,0.26) 1.3px, transparent 1.9px)`;
  const track: React.CSSProperties = vertical
    ? {
        left: n0.x - TRACK_W / 2,
        top: n0.y,
        width: TRACK_W,
        height: len * reveal,
        backgroundImage: dots,
        backgroundSize: `${TRACK_W}px 10px`,
        backgroundRepeat: 'repeat-y',
      }
    : {
        left: n0.x,
        top: n0.y - TRACK_W / 2,
        width: len * reveal,
        height: TRACK_W,
        backgroundImage: dots,
        backgroundSize: `10px ${TRACK_W}px`,
        backgroundRepeat: 'repeat-x',
      };

  /* ── plum fill + bead per segment ── */
  const segs = T.rails.map(([a, b], i) => {
    const A = G.nodes[i];
    const B = G.nodes[i + 1];
    const f = tween(t, [a, b], [0, 1], EASE.draw);
    const head: Pt = { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f };
    const bead = tween(t, [a, a + 2], [0, 1], EASE.out3) * (1 - tween(t, [b - 1, b + 2], [0, 1], EASE.in2));
    // velocity smear on the bead: a short tail behind it
    const v = tween(t + 0.5, [a, b], [0, 1], EASE.draw) - tween(t - 0.5, [a, b], [0, 1], EASE.draw);
    const tail = Math.min(60, v * Math.abs(vertical ? B.y - A.y : B.x - A.x) * 1.4);
    return { A, B, f, head, bead, tail, i };
  });

  if (part === 'rail')
    return (
    <>
      {/* dashed slots the station cards rise into */}
      {G.stations.map((r, i) =>
        i === 0 ? null : (
          <Slot
            key={`slot-${i}`}
            r={r}
            inhale={tween(t, [T.cardsIn[i] - 3, T.cardsIn[i]], [0, 1], EASE.inOut)}
            opacity={tween(t, [T.trackIn + 2 + i * 2, T.trackIn + 8 + i * 2], [0, 1], EASE.out3) *
              (1 - tween(t, [T.cardsIn[i] + 1, T.cardsIn[i] + 4], [0, 1]))}
          />
        ),
      )}

      <div style={{ position: 'absolute', ...track }} />

      {segs.map((s) =>
        s.f <= 0 ? null : (
          <React.Fragment key={`seg-${s.i}`}>
            <div
              style={{
                position: 'absolute',
                background: C.plum,
                borderRadius: FILL_W,
                ...(vertical
                  ? { left: s.A.x - FILL_W / 2, top: s.A.y, width: FILL_W, height: s.head.y - s.A.y }
                  : { left: s.A.x, top: s.A.y - FILL_W / 2, width: s.head.x - s.A.x, height: FILL_W }),
              }}
            />
            {s.bead > 0.01 ? (
              <div
                style={{
                  position: 'absolute',
                  left: s.head.x - BEAD / 2 - (vertical ? 0 : s.tail),
                  top: s.head.y - BEAD / 2 - (vertical ? s.tail : 0),
                  width: BEAD + (vertical ? 0 : s.tail),
                  height: BEAD + (vertical ? s.tail : 0),
                  borderRadius: BEAD,
                  background: vertical
                    ? `linear-gradient(to bottom, rgba(85,26,137,0), ${C.plum} ${s.tail > 1 ? 70 : 0}%)`
                    : `linear-gradient(to right, rgba(85,26,137,0), ${C.plum} ${s.tail > 1 ? 70 : 0}%)`,
                  transform: `scale(${s.bead.toFixed(3)})`,
                  transformOrigin: vertical ? '50% 100%' : '100% 50%',
                  boxShadow: '0 0 12px rgba(85,26,137,0.35)',
                }}
              />
            ) : null}
          </React.Fragment>
        ),
      )}
    </>
    );

  return (
    <>
      {/* nodes */}
      {G.nodes.map((n, i) => {
        const appear = aos(t, T.trackIn + i * 2, { anticip: 2, depth: 0.1, config: SPRING.pop });
        if (appear <= 0) return null;
        const at = T.fills[i];
        // the hollow node inhales (anticipation) as the bead reaches it, then fills
        const inhale = tween(t, [at - 2, at], [0, 1], EASE.inOut) * (1 - tween(t, [at, at + 3], [0, 1], EASE.out3));
        const fill = t < at ? 0 : spring({ frame: t - at, fps: FPS, config: { stiffness: 380, damping: 14, mass: 0.7 } });
        const last = i === G.nodes.length - 1;
        const col = last ? C.settled : C.plum;
        const pingP = last ? tween(t, T.ping, [0, 1], EASE.out3) : tween(t, [at, at + 14], [0, 1], EASE.out3);
        const pingS = last ? 1 + 1.8 * pingP : 1 + 0.9 * pingP;
        const pingO = t < (last ? T.ping[0] : at) ? 0 : (last ? 0.6 : 0.3) * (1 - pingP) * (1 - pingP);
        return (
          <div
            key={`node-${i}`}
            style={{
              position: 'absolute',
              left: n.x - NODE / 2,
              top: n.y - NODE / 2,
              width: NODE,
              height: NODE,
              transform: `scale(${(Math.max(0, appear) * (1 - 0.14 * inhale)).toFixed(4)})`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: C.chip,
                boxShadow: 'inset 0 0 0 2px rgba(24,16,40,0.18), 0 0 0 4px rgba(243,241,248,1)',
              }}
            />
            {pingO > 0.005 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: last ? 'rgba(31,138,85,0.35)' : 'rgba(85,26,137,0.3)',
                  boxShadow: `inset 0 0 0 ${(2 / pingS).toFixed(3)}px ${col}`,
                  opacity: pingO / (last ? 0.6 : 0.3),
                  transform: `scale(${pingS.toFixed(4)})`,
                }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: col,
                transform: `scale(${fill.toFixed(4)})`,
                boxShadow: last && fill > 0 ? `0 0 ${(18 * fill).toFixed(1)}px rgba(31,138,85,0.45)` : undefined,
              }}
            />
          </div>
        );
      })}

      {/* station labels */}
      {G.labels.map((p, i) => (
        <div
          key={`label-${i}`}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y - 15,
            fontFamily: FONT.body,
            fontWeight: 500,
            fontSize: 24,
            lineHeight: '30px',
            letterSpacing: TRACK.label,
            textTransform: 'uppercase',
            color: C.muted,
            whiteSpace: 'nowrap',
          }}
        >
          <Rise text={['The call', 'Slack', 'CRM'][i]} t={t} at={T.cardsIn[i]} stagger={0.4} />
        </div>
      ))}

      {/* station 2 — Slack (no logo: a "#" tile, as the site's channel token) */}
      <StationCard t={t} at={T.cardsIn[1]} r={G.stations[1]}>
        {vertical ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, height: '100%', padding: '0 34px' }}>
            <HashTile t={t} at={T.cardsIn[1] + 1} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <Channel t={t} at={T.cardsIn[1] + 2} />
              <Message t={t} at={T.cardsIn[1] + 4} size={40} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, height: '100%', padding: '0 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <HashTile t={t} at={T.cardsIn[1] + 1} />
              <Channel t={t} at={T.cardsIn[1] + 2} />
            </div>
            <Message t={t} at={T.cardsIn[1] + 4} size={34} />
          </div>
        )}
      </StationCard>

      {/* station 3 — CRM */}
      <StationCard t={t} at={T.cardsIn[2]} r={G.stations[2]}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 16,
            height: '100%',
            padding: `0 ${vertical ? 34 : 28}px`,
            fontFamily: FONT.mono,
            fontSize: vertical ? 38 : 34,
            lineHeight: vertical ? '46px' : '42px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div style={{ whiteSpace: 'nowrap', ...rowIn(t, T.cardsIn[2] + 1) }}>
            <span style={{ color: C.ink, fontWeight: 500 }}>POST</span>
            <span style={{ color: C.muted }}> crm.example.com</span>
          </div>
          <OkRow t={t} at={T.ok} />
        </div>
      </StationCard>
    </>
  );
};

const HashTile: React.FC<{ t: number; at: number }> = ({ t, at }) => (
  <div
    style={{
      width: 52,
      height: 52,
      flex: 'none',
      borderRadius: R.lg,
      background: C.stage,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT.mono,
      fontWeight: 500,
      fontSize: 30,
      color: C.plum,
      ...rowIn(t, at),
    }}
  >
    #
  </div>
);

const Channel: React.FC<{ t: number; at: number }> = ({ t, at }) => (
  <div style={{ fontFamily: FONT.mono, fontSize: 28, lineHeight: '34px', color: C.muted, whiteSpace: 'nowrap', ...rowIn(t, at) }}>
    #front-desk
  </div>
);

const Message: React.FC<{ t: number; at: number; size: number }> = ({ t, at, size }) => (
  <div
    style={{
      fontFamily: FONT.body,
      fontWeight: 500,
      fontSize: size,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
      color: C.ink,
      whiteSpace: 'nowrap',
      ...rowIn(t, at),
    }}
  >
    Booked · Wednesday 15:00
  </div>
);

const StationCard: React.FC<{ t: number; at: number; r: Geo['stations'][number]; children: React.ReactNode }> = ({
  t,
  at,
  r,
  children,
}) => {
  if (t < at - 2) return null;
  const p = aos(t, at, { anticip: 2, depth: 0.08, config: SPRING.site });
  const o = tween(t, [at, at + 4], [0, 1], EASE.out3);
  return (
    <Box
      r={r}
      opacity={o}
      transform={`translateY(${((1 - p) * 16).toFixed(2)}px) scale(${(0.96 + 0.04 * p).toFixed(4)})`}
      lift={Math.max(0, 1 - p) * 0.6}
    >
      {children}
    </Box>
  );
};

/** "200 OK" lands with the final node (read before the CTA's iris closes over it). */
const OkRow: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const d = t < at + 1 ? 0 : spring({ frame: t - at - 1, fps: FPS, config: { stiffness: 320, damping: 11, mass: 0.7 } });
  const col = tween(t, [at, at + 3], [0, 1], EASE.out3);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, ...rowIn(t, at) }}>
      {/* the site's 6 px dot at its 13 px text, scaled with the station (8 px × 1.25) */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: C.settled,
          transform: `scale(${(0.3 + 0.7 * d).toFixed(4)})`,
          opacity: 0.25 + 0.75 * col,
          boxShadow: `0 0 0 ${(4 * d).toFixed(2)}px rgba(31,138,85,${(0.14 * col).toFixed(3)})`,
        }}
      />
      <span style={{ color: C.settled, fontWeight: 500, opacity: 0.35 + 0.65 * col }}>200 OK</span>
    </div>
  );
};

/** Station 1's content, drawn inside the deck's top card once it has landed. */
export const CallContent: React.FC<{ t: number; at: number; pill: number; pad: number; big?: boolean }> = ({ t, at, pill, pad, big = false }) => {
  if (t < at - 2) return null;
  const pp = aos(t, pill, { anticip: 2, depth: 0.1, config: { stiffness: 340, damping: 15, mass: 0.7 } });
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: `0 ${pad}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      <div
        style={{
          fontFamily: FONT.mono,
          fontWeight: 500,
          fontSize: big ? 46 : 40,
          lineHeight: big ? '54px' : '48px',
          fontVariantNumeric: 'tabular-nums',
          color: C.ink,
          whiteSpace: 'nowrap',
        }}
      >
        <Rise text="+1 555 0129" t={t} at={at} stagger={0.45} />
        <span style={{ color: C.muted }}>
          <Rise text=" · 3:05" t={t} at={at + 5} stagger={0.45} />
        </span>
      </div>
      <div style={{ display: 'flex' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: big ? 46 : 42,
            padding: '0 18px 0 16px',
            borderRadius: R.pill,
            background: C.emberSoft,
            color: C.emberInk,
            fontFamily: FONT.body,
            fontWeight: 500,
            fontSize: big ? 26 : 24,
            opacity: tween(t, [pill, pill + 3], [0, 1], EASE.out3),
            transform: `scale(${Math.max(0, 0.7 + 0.3 * pp).toFixed(4)})`,
            transformOrigin: '0% 50%',
          }}
        >
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: C.ember }} />
          Booked
        </div>
      </div>
    </div>
  );
};
