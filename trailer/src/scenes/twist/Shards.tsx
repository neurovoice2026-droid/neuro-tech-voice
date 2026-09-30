/**
 * The type breaks and rebuilds.
 *
 * t < 0   <HookLineStatic> (identical to the hook's line), gathering itself:
 *         scale 1 → 0.975 about its centre, a micro-tremble.
 * t = 0   per-letter shards. "Your business is" and "." blow outward
 *         (seeded direction, spin, depth-scale, velocity-scaled smear);
 *         "closed" holds, trembles, then slides into the start of the new
 *         line — the c becoming a C mid-move.
 * t ≥ 8   the shards turn round and land as "Closed is for the door,"
 *         (glyph swapped mid-flight while blurred), word by word on
 *         springs; "not the phone." rises and turns lilac.
 */
import React from 'react';
import { random } from 'remotion';
import { noise2D } from '@remotion/noise';
import { HookLineStatic } from '../../components/Shared';
import { Words } from '../../components/Type';
import { HOOK_LINE } from '../../lib/handoff';
import type { Layout } from '../../lib/layout';
import { EASE, SPRING, springAt, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';
import { TWIST } from '../../timing';
import { TW } from './geometry';
import { LINE_H, type Glyph, type TextLayout } from './measure';

const RETURN = { stiffness: 240, damping: 21, mass: 1 };
const SLIDE = SPRING.site;
const A0 = 0.975; // the line's scale when it breaks

type Kind = 'closed' | 'fly' | 'extra';
type Shard = {
  src: Glyph;
  dst: Glyph | null;
  kind: Kind;
  start: number;
  swap: number;
  vx: number;
  vy: number;
  rot: number;
  sOut: number;
  seed: string;
};

/** The whole-line gather before the break (t in [-8, 0]). */
export function gather(t: number) {
  const u = Math.min(1, Math.max(0, (t - TW.gather) / -TW.gather));
  const a = 1 - (1 - A0) * EASE.in2(u);
  const amp = 1.8 * u * u;
  return {
    a,
    x: amp * noise2D('gather-x', t * 0.9, 0.1),
    y: amp * noise2D('gather-y', 0.4, t * 0.9),
  };
}

export function buildShards(hook: TextLayout, tag: TextLayout, L: Layout): Shard[] {
  const H = HOOK_LINE(L);
  const byWord = (lay: TextLayout, w: number) => lay.glyphs.filter((g) => g.word === w);
  const hw = [0, 1, 2, 3].map((w) => byWord(hook, w)); // Your | business | is | closed.
  const tw = [0, 1, 2, 3, 4].map((w) => byWord(tag, w)); // Closed | is | for | the | door,
  const closedG = hw[3];
  const ex = closedG.slice(0, 6).reduce((s, g) => s + g.cx, 0) / 6;
  const E = { x: ex, y: H.cy + H.fontSize * 0.35 }; // the blast sits under "closed"

  const shards: Shard[] = [];
  const add = (src: Glyph, dst: Glyph | null, kind: Kind, targetWord: number, j: number) => {
    const seed = `tw-shard-${shards.length}`;
    const r = (k: string) => random(`${seed}-${k}`);
    let dx = src.cx - E.x;
    let dy = src.cy - E.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const turn = (r('a') - 0.5) * 1.1;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const ux = dx * c - dy * s;
    const uy = dx * s + dy * c - 0.35; // a little lift: they are thrown up and out
    const dist = L.pick(360, 300) + r('d') * L.pick(560, 380) + (kind === 'extra' ? 200 : 0);
    const start = kind === 'extra' ? 1e9 : TW.wordStarts[targetWord] + j * 0.9;
    shards.push({
      src,
      dst,
      kind,
      start,
      swap: kind === 'closed' ? start + 3 : start + 2,
      vx: ux * dist,
      vy: uy * dist * 0.8,
      rot: (r('r') - 0.5) * 2 * (90 + r('rr') * 220),
      sOut: 0.55 + r('s') * 1.55,
      seed,
    });
  };

  // closed → Closed
  closedG.slice(0, 6).forEach((g, j) => add(g, tw[0][j], 'closed', 0, j));
  // is → is
  hw[2].forEach((g, j) => add(g, tw[1][j], 'fly', 1, j));
  // "Your business" minus two (they burn out as dust) → for the door
  const pool = [...hw[0], ...hw[1]];
  const extras = new Set([0, 4]); // Y, b
  const targets = [...tw[2], ...tw[3], ...tw[4].slice(0, 4)];
  let k = 0;
  pool.forEach((g, i) => {
    if (extras.has(i)) {
      add(g, null, 'extra', 0, 0);
      return;
    }
    const d = targets[k++];
    const word = d.word; // 2, 3 or 4
    const j = tw[word].indexOf(d);
    add(g, d, 'fly', word, j);
  });
  // "." → "," (the sentence goes on)
  add(closedG[6], tw[4][4], 'fly', 4, 4);
  return shards;
}

type State = { x: number; y: number; rot: number; size: number; useDst: boolean; op: number; dof: number };

function shardState(sh: Shard, t: number, hook: TextLayout, tag: TextLayout, L: Layout): State {
  const H = HOOK_LINE(L);
  const hcx = H.left + H.width / 2;
  const g0 = gather(0);
  const x0 = hcx + (sh.src.cx - hcx) * g0.a + g0.x;
  const y0 = H.cy + (sh.src.cy - H.cy) * g0.a + g0.y;
  const size0 = hook.fontSize * g0.a;
  const dst = sh.dst;
  const tx = dst ? dst.cx : x0;
  const ty = dst ? dst.cy : y0;

  if (sh.kind === 'closed') {
    // hold + tremble, a small recoil toward camera as the rest is blown away
    const amp = 2.2 * (1 - tween(t, [sh.start, sh.start + 6], [0, 1], EASE.out3));
    const trx = amp * noise2D(`${sh.seed}-tx`, t * 0.8, 0);
    const tr = amp * noise2D(`${sh.seed}-ty`, 0, t * 0.8);
    const rec = t > 0 ? 0.045 * (t / 2) * Math.exp(1 - t / 2) : 0;
    const s = t >= sh.start ? springAt(t, sh.start, SLIDE) : 0;
    const sPrev = t - 1 >= sh.start ? springAt(t - 1, sh.start, SLIDE) : 0;
    const velX = (tx - x0) * (s - sPrev);
    return {
      x: x0 + trx + (tx - x0 - trx) * s,
      y: y0 + tr + (ty - y0 - tr) * s,
      rot: 0.9 * amp * noise2D(`${sh.seed}-tr`, t * 0.7, 3) - Math.max(-9, Math.min(9, velX * 0.07)),
      size: size0 * (1 + rec) + (tag.fontSize - size0 * (1 + rec)) * s,
      useDst: t >= sh.swap,
      op: 1,
      dof: 0,
    };
  }

  // out: the blast (first frame already ~30 % out — the impact)
  const u = Math.min(1, Math.max(0, (t + 1) / (TWIST.shatterOut + 1)));
  const q = 1 - Math.pow(1 - u, 3.2);
  const drift = 0.09 * tween(t, [TWIST.shatterOut, TWIST.shatterOut + 22], [0, 1], EASE.out3);
  let ox = x0 + sh.vx * (q + drift);
  let oy = y0 + sh.vy * (q + drift);
  let rot = sh.rot * (q + drift * 0.8);
  let size = size0 * (1 + (sh.sOut - 1) * q);
  let op = 1;

  if (sh.kind === 'extra') {
    // keeps going, shrinks, burns out into a mote
    const burn = tween(t, [4, 26], [0, 1], EASE.in2);
    ox += sh.vx * 0.55 * burn;
    oy += sh.vy * 0.55 * burn - 40 * burn;
    rot += sh.rot * 0.4 * burn;
    size *= 1 - 0.8 * burn;
    op = 1 - tween(t, [8, 26], [0, 1], EASE.inOut);
    return { x: ox, y: oy, rot, size, useDst: false, op, dof: 2 + 6 * burn + Math.abs(sh.sOut - 1) * 5 };
  }

  const s = t >= sh.start ? springAt(t, sh.start, RETURN) : 0;
  const sPrev = t - 1 >= sh.start ? springAt(t - 1, sh.start, RETURN) : 0;
  const velX = (tx - ox) * (s - sPrev);
  const scaleNow = size / size0;
  return {
    x: ox + (tx - ox) * s,
    y: oy + (ty - oy) * s,
    rot: rot * (1 - s) - Math.max(-10, Math.min(10, velX * 0.05)),
    size: size + (tag.fontSize - size) * s,
    useDst: t >= sh.swap,
    op,
    dof: Math.abs(scaleNow - 1) * 5 * (1 - Math.min(1, s)),
  };
}

const glyphStyle = (fontSize: number): React.CSSProperties => ({
  position: 'absolute',
  fontFamily: FONT.display,
  fontWeight: 500,
  fontSize,
  lineHeight: `${LINE_H * fontSize}px`,
  letterSpacing: TRACK.display,
  whiteSpace: 'pre',
  color: C.paper,
  transformOrigin: '50% 50%',
});

const SHUTTER = 0.75;

export const Shards: React.FC<{
  t: number;
  L: Layout;
  hook: TextLayout;
  tag: TextLayout;
  shards: Shard[];
  /** extra opacity (dive) */
  opacity?: number;
  /** when true, draw a light single-sample version (ghost copies) */
  ghost?: boolean;
  /** extra blur on every glyph (the dive) */
  extraBlur?: number;
}> = ({ t, L, hook, tag, shards, opacity = 1, ghost = false, extraBlur = 0 }) => {
  if (t < 0) {
    const g = gather(t);
    return (
      <HookLineStatic
        style={{
          transform: `translate(${g.x.toFixed(3)}px, ${g.y.toFixed(3)}px) translateY(-50%) scale(${g.a.toFixed(5)})`,
        }}
      />
    );
  }

  const line3 = tag.lines[2];
  return (
    <div style={{ position: 'absolute', inset: 0, opacity }}>
      {shards.map((sh, i) => {
        const st = shardState(sh, t, hook, tag, L);
        if (st.op < 0.01) return null;
        const pv = shardState(sh, t - 0.5, hook, tag, L);
        const speed = Math.hypot(st.x - pv.x, st.y - pv.y) * 2; // px / frame
        const n = ghost || speed < 3 ? 1 : Math.min(6, 2 + Math.floor(speed / 18));
        const samples = Array.from({ length: n }, (_, k) => {
          const tk = t - (n > 1 ? (k * SHUTTER) / (n - 1) : 0);
          return k === 0 ? st : shardState(sh, tk, hook, tag, L);
        });
        const spacing = n > 1 ? (speed * SHUTTER) / (n - 1) : 0;
        return (
          <React.Fragment key={i}>
            {samples
              .map((s, k) => {
                const g = s.useDst && sh.dst ? sh.dst : sh.src;
                const fs = s.useDst && sh.dst ? tag.fontSize : hook.fontSize;
                const lh = LINE_H * fs;
                const sc = s.size / fs;
                const blur = s.dof + extraBlur + (n > 1 ? Math.min(14, spacing * 0.5 + speed * 0.04) : 0);
                const op = s.op * (n === 1 ? 1 : k === 0 ? 0.8 : 0.5 * (1 - k / n));
                return (
                  <span
                    key={k}
                    style={{
                      ...glyphStyle(fs),
                      left: s.x - g.adv / 2,
                      top: s.y - lh / 2,
                      width: g.adv,
                      opacity: op,
                      transform: `rotate(${s.rot.toFixed(2)}deg) scale(${sc.toFixed(4)})`,
                      filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
                    }}
                  >
                    {g.ch}
                  </span>
                );
              })
              .reverse()}
          </React.Fragment>
        );
      })}
      {t >= TWIST.line2 - 6 ? (
        <div
          style={{
            position: 'absolute',
            left: line3.left,
            top: line3.top,
            width: line3.width + 40,
            filter: extraBlur > 0.15 ? `blur(${extraBlur.toFixed(2)}px)` : undefined,
          }}
        >
          <Words
            text="not the phone."
            start={TWIST.line2}
            stagger={3}
            frame={t}
            align="left"
            keys={[{ text: 'not the phone.', color: C.lilac, at: TWIST.keyColor }]}
            style={{ fontSize: tag.fontSize, whiteSpace: 'nowrap' }}
          />
        </div>
      ) : null}
    </div>
  );
};
