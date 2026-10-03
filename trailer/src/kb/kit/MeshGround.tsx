/**
 * <MeshGround> — the site's gradient mesh as a Remotion ground (CLIENT DIRECTION v2 §1). The math
 * (recipe, clocks, grade, key light) is kit/mesh.ts; this paints it.
 *
 * HOW IT PAINTS. One 2D canvas, DPR-sized (CSS W×H × devicePixelRatio × `quality`), redrawn every
 * render frame in a layout effect: the floor, then each pool as an elliptical radial gradient with
 * the gaussian falloff (26 stops, alpha only — the colour never changes along a pool, so no
 * premultiplication fringes), the key light's tint (screen: light adds), then the lit shade
 * (.pp-mesh-shade: a soft white upper-left, the edges falling to the palette's own m0). No CSS
 * filter, no blur: a mesh has no detail finer than ~300 px, so the canvas is drawn at half the
 * device resolution by default and the compositor's bilinear upscale is exact; at 4K it is a
 * 1920×1080 backing. On top, at full device resolution, the site's grain (.pp-noise →
 * components/Grain: overlay grain, + the sparse dither on the deep variant) — it also breaks the
 * 8-bit steps of the long gradients before the encoder can turn them into bands.
 *
 * Every value is a pure function of `t` (fractional timeline frames): smooth at 120 fps.
 *
 *   <MeshGround t={t} palette={KB_MESH} variant="light" key={{ x, y, strength: .3 }} />
 *   <MeshGround t={t} palette={MUTED_MESH} paletteB={KB_MESH} mix={u} lift={1 - u} />   // a hand-off
 */
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { Grain } from '../../components/Grain';
import { hexToRgb } from '../../lib/lights';
import type { Palette } from '../palettes';
import { FALLOFF_STOPS, falloff, meshAt, type KeyLight, type MeshPool } from './mesh';
import { parseRecipe, recipeAt } from './recipe';

export type MeshVariant = 'light' | 'deep';

export type MeshGroundProps = {
  /** 30 fps timeline frames (fractional at 120 fps) — the mesh's clock */
  t: number;
  /** five colours, darkest first (src/kb/palettes.ts: MUTED_MESH, KB_MESH, INK_MESH, MOMENT_LIGHTS[id].orb …) */
  palette: Palette;
  /** a second palette to hand off to, mixed in OKLab by `mix` (0 = palette, 1 = paletteB) */
  paletteB?: Palette;
  mix?: number;
  /** 'light' (pearl, for white UI on top) | 'deep' (the orb's material). `lift` overrides it with a number. */
  variant?: MeshVariant;
  /** 0 = deep … 1 = light (animatable: a designed transition between the two) */
  lift?: number;
  /** a source in frame (the line light, Ava's orb) that pulls a pool onto itself and tints the ground */
  keyLight?: KeyLight | null;
  /** × lightness (1 = as is) */
  brightness?: number;
  /** × chroma on top of the site's saturate(1.35) (1 = the site) */
  saturation?: number;
  /** × the clocks (1 = the site's 14 s / 21 s) */
  speed?: number;
  /** × the drift reach */
  drift?: number;
  /** × the b-field's turn */
  turn?: number;
  /** frames of phase offset, so two acts never show the same field */
  seed?: number;
  /** the lit shade (.pp-mesh-shade): 1 = the site's; 0 = none */
  shade?: number;
  /** an extra CSS film grain over the ground (components/Grain overlay). Default 0: the film's finishing
   *  grain (Film.tsx FilmGrain) already lies over every shot; use it where that is off. */
  grain?: number;
  /** the in-canvas dither (≈ ±1 LSB, moved every render frame): keeps the long ramps from banding. 1 = on. */
  dither?: number;
  /** canvas backing resolution × device pixels (default .5: exact for a mesh, 4× cheaper) */
  quality?: number;
  /** a pearl recipe instead of a palette (palettes.ts PLAN_LIGHTS[id].ground, PRICING_PANEL): its pools drift like mesh-flow.ts */
  recipe?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);
const rgbStr = (hex: string) =>
  hexToRgb(hex)
    .map((v) => Math.round(v * 255))
    .join(',');

/**
 * The in-canvas DITHER: a 256² tile of mid-grey noise (seeded, made once), soft-lit over the mesh at
 * ±~1 LSB and moved every render frame. The canvas's gradients are 8-bit; without it their long, slow
 * ramps keep 1-level plateaus tens of px wide, which an encoder turns into bands. Soft-light is
 * neutral on mid-grey, so the mean colour does not move. Costs a pattern fill — no full-frame CSS
 * blend layer (a CSS overlay grain at 4K measured ≈ .24 s/frame; this is a few ms).
 */
const TILE = 256;
let noiseTile: HTMLCanvasElement | null = null;
function getNoiseTile(): HTMLCanvasElement | null {
  if (noiseTile || typeof document === 'undefined') return noiseTile;
  const c = document.createElement('canvas');
  c.width = TILE;
  c.height = TILE;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(TILE, TILE);
  let s = 0x9e3779b9;
  const rnd = () => {
    // mulberry32: deterministic, the same tile in every render tab
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < TILE * TILE; i++) {
    // triangular noise (the sum of two uniforms): the dither that leaves no pattern of its own
    const v = Math.round(127.5 + 127.5 * (rnd() + rnd() - 1));
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

/** one pool, painted (ctx in CSS px units) */
function paintPool(ctx: CanvasRenderingContext2D, p: MeshPool, stops?: readonly (readonly [number, string, number])[]) {
  if (p.a <= 0.001 || p.rx < 1 || p.ry < 1) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.rx, p.ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  if (stops) {
    for (const [u, rgb, a] of stops) g.addColorStop(u, `rgba(${rgb},${(a * p.a).toFixed(4)})`);
  } else {
    const rgb = rgbStr(p.color);
    for (const u of FALLOFF_STOPS) g.addColorStop(u, `rgba(${rgb},${(p.a * falloff(u, p.k)).toFixed(4)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

/** .pp-mesh-shade: the soft white light upper-left, the edges falling to the palette's m0 (smooth, many stops) */
function paintShade(ctx: CanvasRenderingContext2D, W: number, H: number, ink: string, k: number) {
  if (k <= 0.001) return;
  // the highlight: white .22 at 30 % / 24 %, gone by 30 % of the farthest-corner distance (smoothstep instead of the linear ramp's kink)
  const hx = 0.3 * W;
  const hy = 0.24 * H;
  const hr = 0.3 * Math.hypot(Math.max(hx, W - hx), Math.max(hy, H - hy));
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const s = (1 - u) * (1 - u) * (1 + 2 * u);
    g.addColorStop(u, `rgba(255,255,255,${(0.22 * k * s).toFixed(4)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // the shadow side: transparent to 58 %, then to m0 at 55 % by the corner (circle at 50 % 44 %). Painted
  // MULTIPLY, so the edge deepens the colour under it towards the palette's darkest (the same material,
  // the site's intent) instead of laying a grey film over a light pool
  const vx = 0.5 * W;
  const vy = 0.44 * H;
  const vr = Math.hypot(Math.max(vx, W - vx), Math.max(vy, H - vy));
  const v = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
  const rgb = rgbStr(ink);
  v.addColorStop(0, `rgba(${rgb},0)`);
  for (let i = 0; i <= 16; i++) {
    const u = 0.58 + (0.42 * i) / 16;
    const s = (i / 16) * (i / 16) * (3 - (2 * i) / 16);
    v.addColorStop(u, `rgba(${rgb},${(0.55 * k * Math.pow(s, 1.15)).toFixed(4)})`);
  }
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
}

export const MeshGround: React.FC<MeshGroundProps> = ({
  t,
  palette,
  paletteB,
  mix = 0,
  variant = 'light',
  lift,
  keyLight = null,
  brightness = 1,
  saturation = 1,
  speed = 1,
  drift = 1,
  turn = 1,
  seed = 0,
  shade = 1,
  grain = 0,
  dither = 1,
  quality = 0.5,
  recipe,
  style,
  children,
}) => {
  const { width: W, height: H } = useVideoConfig();
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const k = lift ?? (variant === 'light' ? 1 : 0);
  const q = Math.max(0.1, quality) * dpr();
  const cw = Math.max(2, Math.round(W * q));
  const ch = Math.max(2, Math.round(H * q));

  const parsed = recipe ? parseRecipe(recipe) : null;
  const mesh = parsed
    ? null
    : meshAt({ t, W, H, palette, paletteB, mix, grade: { lift: k, brightness, saturation }, key: keyLight, speed, drift, turn, seed });
  const rec = parsed ? recipeAt(parsed, t * speed + seed, W, H, drift) : null;
  const floor = mesh ? mesh.floor : rec!.floor;

  useLayoutEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d', { alpha: false });
    if (!c || !ctx) return;
    ctx.setTransform(cw / W, 0, 0, ch / H, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, W, H);
    if (mesh) {
      const keyTint = keyLight?.color && keyLight.strength > 0;
      mesh.pools.forEach((p, i) => {
        if (keyTint && i === mesh.pools.length - 1) {
          // the source's light on the ground: light ADDS on a deep ground (screen), and on a light one it
          // tints the surface (a wash) — crossfaded with the variant, so a lift animation never pops
          ctx.globalCompositeOperation = 'screen';
          paintPool(ctx, { ...p, a: p.a * (1 - k) });
          ctx.globalCompositeOperation = 'source-over';
          paintPool(ctx, { ...p, a: p.a * k * 0.6 });
          return;
        }
        ctx.globalCompositeOperation = 'source-over';
        paintPool(ctx, p);
      });
      ctx.globalCompositeOperation = 'source-over';
      paintShade(ctx, W, H, mesh.shadeInk, shade);
    } else if (rec) {
      for (const p of rec.pools) paintPool(ctx, p, p.stops);
    }
    const tile = dither > 0 ? getNoiseTile() : null;
    if (tile) {
      // in backing pixels (one noise sample per canvas pixel), offset per render frame
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const pat = ctx.createPattern(tile, 'repeat');
      if (pat) {
        pat.setTransform(new DOMMatrix().translate(Math.floor(random(`mx${frame}`) * TILE), Math.floor(random(`my${frame}`) * TILE)));
        ctx.globalCompositeOperation = 'soft-light';
        // soft-light moves a pixel in proportion to d·(1 − d): ≈ 1 LSB rms on the mid-tones, less towards
        // white (where a 1-level step cannot be seen anyway) — stronger would read as grain on the pearls
        ctx.globalAlpha = Math.min(1, 0.055 * dither);
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  });

  const g = Math.max(0, grain);
  return (
    <AbsoluteFill style={{ background: floor, overflow: 'hidden', ...style }}>
      <canvas ref={ref} width={cw} height={ch} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} />
      {/* the site's .pp-noise, when the film's finishing grain is not over this shot */}
      {g > 0 ? <Grain opacity={g * (0.075 - 0.03 * k)} blend="overlay" seed="mesh" /> : null}
      {children}
    </AbsoluteFill>
  );
};
