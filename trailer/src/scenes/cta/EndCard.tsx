/**
 * The end card's type, in the site's idiom — every size is the site's own
 * ratio of its font size (hero.tsx CoverCta). It builds CALMLY, one element at
 * a time, each on a soft spring that has settled before the next one moves
 * (client: "the ending is too fast"):
 *
 *  <Url>       a CornerDot + "neurotechvoice.com" (Geist Mono 500), typed ON
 *              Ava's words in three chunks ("neuro" | "tech" | "voice.com" on
 *              "Neuro" "Tech" "Voice.") with a caret; the hairline draws out
 *              from it.
 *  <CoverCta>  "Start free →" as DARK GLASS lit by the halo above it (never a
 *              flat light slab under the logo, v5 critics): the night's plum at
 *              ≈75 % over the night, a 1.5 px lilac rim, a specular top edge and
 *              an inner glow falling from above; the label (padding .8em 1em,
 *              gap .45em) in paper. It UNFOLDS out of a gathered point of lilac
 *              light once the URL has typed: the plate opens from the centre
 *              (wider than tall), over-exposed as it condenses, and its words
 *              are already rising on its first frame (never a blank plate); a
 *              soft lift (≈40 px, .94 → 1, ≈3 % over, settled in ≈14 f), a
 *              sheen crossing the glass as it settles. At `press` it is
 *              CLICKED: a hover lift (anticipation), .94 in 2 f, back on a soft
 *              spring; the glass FILLS to the full plum from the arrow (a
 *              brightness lift — the label stays paper, no colour swap), its
 *              rim brightens, a plum ripple leaves the arrow (0 → 1.3 × the
 *              plate's width), a glint crosses the plum face; it keeps the
 *              site's hover (arrow +8 px) with a plum glow.
 *  <Note>      "5 free minutes, no card" (pricing copy), Inter 500, 82 % paper,
 *              one word every `step` frames on the same soft spring.
 *
 * `rest(t, v, target)` (from the scene) pins every residual to its exact
 * rest value by CTA.finalHold: the hold is dead still.
 */
import React from 'react';
import { Easing } from 'remotion';
import { aos, EASE, mix, SPRING, springAt, tween } from '../../lib/motion';
import { CornerDot } from '../../components/Type';
import { C, FONT } from '../../theme';

export type Rest = (t: number, v: number, target: number) => number;

/** the plate's rise: ≈3 % over, settled (±1 %) in ≈14 f — premium, not snappy */
const RISE = { stiffness: 130, damping: 17, mass: 1 };
/** words out of their masks: ≈2 % over, settled in ≈13 f */
const SOFT = { stiffness: 150, damping: 19, mass: 1 };
/** the plate back from the click: one soft ≈5 % overshoot, settled in ≈12 f */
const BACK = { stiffness: 230, damping: 21, mass: 1 };
/** ease-in-out sine for the hover lift */
const SINE = Easing.bezier(0.37, 0, 0.63, 1);

const MaskRise: React.FC<{
  t: number;
  at: number;
  children: React.ReactNode;
  pad?: string | number;
  config?: typeof SPRING.site;
  blur?: number;
  rest: Rest;
}> = ({ t, at, children, pad = 0, config = SOFT, blur = 3, rest }) => {
  const p = rest(t, aos(t, at, { anticip: 3, depth: 0.05, config }), 1);
  const pPrev = aos(t - 1, at, { anticip: 3, depth: 0.05, config });
  const b = rest(t, tween(t, [at, at + 10], [blur, 0], EASE.house) + Math.min(6, Math.abs(p - pPrev) * 110 * 0.1), 0);
  return (
    <span
      style={{
        display: 'inline-block',
        overflow: 'hidden',
        verticalAlign: 'top',
        paddingBottom: '0.16em',
        marginBottom: '-0.16em',
        paddingRight: pad,
        whiteSpace: 'pre',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          transform: p < 1 - 1e-4 || p > 1 + 1e-4 ? `translateY(${((1 - p) * 110).toFixed(2)}%)` : undefined,
          filter: b > 0.05 ? `blur(${b.toFixed(2)}px)` : undefined,
        }}
      >
        {children}
      </span>
    </span>
  );
};

export type PressSpec = {
  /** the hover lift before the click (anticipation) */
  lift: readonly [number, number];
  /** frames down to .94 */
  down: number;
  /** the plum floods the plate from the arrow */
  flood: readonly [number, number];
  /** the plum ripple leaves the arrow */
  ripple: readonly [number, number];
  /** the glint across the plum face */
  glint: readonly [number, number];
};

/** where the arrow sits in the plate (the click point): right padding 1em + half the arrow */
const ARROW_X = 'calc(100% - 1.5em)';

/** the glass at rest: the night's plum over the night, lit from above by the halo */
const GLASS = {
  fill: [
    'radial-gradient(120% 150% at 50% -38%, rgba(214,200,250,0.30) 0%, rgba(206,190,240,0.10) 40%, rgba(206,190,240,0) 64%)',
    'linear-gradient(180deg, rgba(104,46,164,0.80) 0%, rgba(85,26,137,0.74) 46%, rgba(44,13,78,0.80) 100%)',
  ].join(', '),
  rim: 'inset 0 0 0 1.5px rgba(192,172,224,0.62), inset 0 1.5px 0 0 rgba(255,255,255,0.22), inset 0 -0.35em 0.6em -0.35em rgba(6,4,10,0.55)',
};
/** … and clicked: the full plum, brighter, its rim lit */
const PLUM = {
  fill: [
    'radial-gradient(120% 150% at 50% -38%, rgba(228,218,255,0.40) 0%, rgba(214,200,250,0.14) 42%, rgba(214,200,250,0) 66%)',
    'linear-gradient(180deg, #7a3cc2 0%, #5f1f9a 50%, #4b1680 100%)',
  ].join(', '),
  rim: 'inset 0 0 0 1.5px rgba(222,210,255,0.92), inset 0 1.5px 0 0 rgba(255,255,255,0.36), inset 0 -0.35em 0.6em -0.35em rgba(20,6,40,0.45)',
};

export const CoverCta: React.FC<{
  t: number;
  at: number;
  press: number;
  fontSize: number;
  spec: PressSpec;
  rest: Rest;
}> = ({ t, at, press, fontSize: F, spec, rest }) => {
  if (t < at - 5) return null;
  /* ── the unfold ── */
  const e = t < at ? 0 : springAt(t, at, RISE);
  const ePrev = t - 1 < at ? 0 : springAt(t - 1, at, RISE);
  const y = rest(t, (1 - e) * 0.6 * F, 0);
  const sc0 = rest(t, mix(0.94, 1, e), 1);
  const vy = Math.abs(e - ePrev) * 0.6 * F; // px/frame of the lift
  // the glass condenses out of its point of light: in over 2 f, over-exposed (lilac-bright), settling
  // to its own depth over 8 f — light becoming glass, never a slab
  const fadeIn = tween(t, [at - 1, at + 1], [0, 1], EASE.out3);
  // … unfolding out of that point (a rounded rect opening from the centre, wider than tall)
  const open = tween(t, [at - 1, at + 4], [0, 1], EASE.out3);
  const clip =
    open >= 1 ? undefined : `inset(${((1 - open) * 46).toFixed(2)}% ${((1 - open) * 49).toFixed(2)}% round 0.2em)`;
  const glow = t < at - 1 ? 0 : rest(t, 1 - tween(t, [at, at + 8], [0, 1], EASE.out3), 0);
  const blur = rest(t, tween(t, [at, at + 8], [4, 0], EASE.out3) + Math.min(3, vy * 0.18), 0);
  // the point of lilac light it unfolds out of: gathers over 4 f, peaks ON `at`, hands over in 5 f
  const gather = t < at ? Math.sin(((t - (at - 4)) / 4) * (Math.PI / 2)) : Math.max(0, 1 - (t - at) / 5);
  // the settle's accent: a sheen crosses the glass as it comes to rest
  const s0 = at + 9;
  const s1 = at + 19;
  const sweep = tween(t, [s0, s1], [-0.4, 1.4], EASE.inOut);
  const sweepO = t > s0 && t < s1 ? 0.3 * Math.sin(Math.PI * tween(t, [s0, s1], [0, 1])) : 0;

  /* ── the press ── */
  const lift = t < spec.lift[0] ? 0 : t < press ? SINE(tween(t, spec.lift, [0, 1], (x) => x)) : 0;
  const D = spec.down;
  const u = t - press;
  const down = u < 0 ? 1 + 0.025 * lift : u < D ? mix(1.025, 0.94, EASE.in2(u / D)) : mix(0.94, 1, springAt(t, press + D, BACK));
  const click = rest(t, down, 1);
  // the glass fills to the full plum from the arrow, then the arrow takes the site's hover
  const fl = t < press ? 0 : rest(t, tween(t, spec.flood, [0, 1], EASE.out3), 1);
  const hs = rest(t, t < press ? 0 : springAt(t, press, SPRING.site), 1);
  // the click's light: a brightness lift as it goes down, decaying over ≈ 6 f
  const flash = t < press ? 0 : rest(t, Math.exp(-(t - press) / 4) * Math.min(1, (t - press + 1) / 2), 0);
  // the lift hands over to the hover continuously (no jump on the click frame)
  const liftK = t < press ? lift : rest(t, Math.max(0, 1 - hs), 0);
  const arrowX = 8 * hs + 3 * liftK;
  const rippleU = tween(t, spec.ripple, [0, 1], EASE.out3);
  const rippleO = t >= press && t < spec.ripple[1] ? Math.pow(1 - rippleU, 1.4) : 0;
  const g0 = spec.glint[0];
  const g1 = spec.glint[1];
  const gl = tween(t, [g0, g1], [-0.4, 1.4], EASE.inOut);
  const glO = t > g0 && t < g1 ? 0.42 * Math.sin(Math.PI * tween(t, [g0, g1], [0, 1])) : 0;

  // the plate's diagonal reach from the arrow (in em): the flood covers it all at fl = 1
  const reach = 6.2;
  const floodR = fl * reach * F;
  const floodMask =
    fl >= 1 ? undefined : `radial-gradient(circle at ${ARROW_X} 50%, #000 ${Math.max(0, floodR - 10).toFixed(1)}px, transparent ${(floodR + 2).toFixed(1)}px)`;

  /** one face of the plate: the glass at rest, or the full plum once clicked (the label is paper on both) */
  const face = (pressed: boolean) => {
    const look = pressed ? PLUM : GLASS;
    return (
      <span
        style={{
          gridArea: '1 / 1',
          position: 'relative',
          // each face is its own stacking context: the glass face's label never paints over the plum
          zIndex: pressed ? 2 : 1,
          isolation: 'isolate',
          display: 'inline-grid',
          borderRadius: '0.2em',
          overflow: 'hidden',
          background: look.fill,
          boxShadow: look.rim,
          WebkitMaskImage: pressed ? floodMask : undefined,
          maskImage: pressed ? floodMask : undefined,
        }}
      >
        <span
          style={{
            gridArea: '1 / 1',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.45em',
            padding: '0.8em 1em',
            color: pressed ? '#f7f3ff' : C.paper,
            whiteSpace: 'nowrap',
            textShadow: '0 0.04em 0.12em rgba(6,4,10,0.35)',
          }}
        >
          <span>
            <MaskRise t={t} at={at - 4} pad="0.24em" rest={rest}>
              Start
            </MaskRise>
            <MaskRise t={t} at={at - 2.5} rest={rest}>
              free
            </MaskRise>
          </span>
          <span style={{ display: 'inline-block', transform: arrowX > 0.01 ? `translateX(${arrowX.toFixed(2)}px)` : undefined }}>
            <MaskRise t={t} at={at - 1} rest={rest}>
              →
            </MaskRise>
          </span>
        </span>
        {/* the sheens: one across the glass on the settle, one across the plum face after the click */}
        {!pressed && sweepO > 0.01 ? (
          <span
            style={{
              gridArea: '1 / 1',
              zIndex: 2,
              background: `linear-gradient(105deg, rgba(233,224,255,0) ${((sweep - 0.25) * 100).toFixed(1)}%, rgba(233,224,255,${sweepO.toFixed(3)}) ${(sweep * 100).toFixed(1)}%, rgba(233,224,255,0) ${((sweep + 0.25) * 100).toFixed(1)}%)`,
              mixBlendMode: 'screen',
            }}
          />
        ) : null}
        {pressed && glO > 0.01 ? (
          <span
            style={{
              gridArea: '1 / 1',
              zIndex: 2,
              background: `linear-gradient(105deg, rgba(233,224,255,0) ${((gl - 0.22) * 100).toFixed(1)}%, rgba(233,224,255,${glO.toFixed(3)}) ${(gl * 100).toFixed(1)}%, rgba(233,224,255,0) ${((gl + 0.22) * 100).toFixed(1)}%)`,
              mixBlendMode: 'screen',
            }}
          />
        ) : null}
      </span>
    );
  };

  const bright = 1 + 0.6 * glow + 0.3 * flash;
  return (
    <div style={{ position: 'relative', display: 'inline-grid' }}>
      {gather > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: F * 2.6,
            height: F * 2.6,
            marginLeft: -F * 1.3,
            marginTop: -F * 1.3,
            borderRadius: '50%',
            opacity: gather,
            transform: `translateY(${(0.6 * F * (t < at ? 1 : 1 - e)).toFixed(1)}px) scale(${(t < at ? mix(0.35, 0.85, gather) : 0.85 + (0.5 * (t - at)) / 5).toFixed(3)})`,
            background: 'radial-gradient(circle, rgba(247,243,255,0.95) 0%, rgba(185,163,255,0.55) 18%, rgba(124,58,237,0.2) 42%, rgba(124,58,237,0) 70%)',
          }}
        />
      ) : null}
      <div
        style={{
          display: 'inline-grid',
          fontFamily: FONT.display,
          fontWeight: 400,
          fontSize: F,
          lineHeight: 1.2,
          letterSpacing: '-0.04em',
          transform: `translateY(${y.toFixed(2)}px) scale(${(sc0 * click).toFixed(4)})`,
          opacity: fadeIn,
          clipPath: clip,
          filter:
            [blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '', bright > 1.005 ? `brightness(${bright.toFixed(3)})` : '']
              .join(' ')
              .trim() || undefined,
          borderRadius: '0.2em',
          // its light on the night (the plum glow, stronger once clicked) and a soft contact shadow
          boxShadow: [
            `0 0 ${(36 + 22 * fl + 20 * flash).toFixed(0)}px rgba(124,58,237,${(0.2 + 0.28 * fl + 0.2 * flash).toFixed(3)})`,
            `0 ${((0.5 + 0.12 * liftK) * F).toFixed(1)}px ${((1.4 + 0.2 * liftK) * F).toFixed(1)}px ${(-0.5 * F).toFixed(1)}px rgba(0,0,0,0.7)`,
          ].join(', '),
        }}
      >
        {face(false)}
        {fl > 0 ? face(true) : null}
      </div>
      {rippleO > 0.01 ? <Ripple u={rippleU} o={rippleO} F={F} /> : null}
    </div>
  );
};

/**
 * The click's ripple: a plum ring with a lilac edge leaving the arrow, out to
 * 1.3 × the plate's width (≈ 8.4em at "Start free →"), thinning as it goes.
 */
const Ripple: React.FC<{ u: number; o: number; F: number }> = ({ u, o, F }) => {
  const d = mix(0.4, 8.4, u) * F;
  const w = mix(3, 1, u);
  return (
    <div
      style={{
        position: 'absolute',
        right: `${1.5 * F}px`,
        top: '50%',
        width: 0,
        height: 0,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: -d / 2,
          top: -d / 2,
          width: d,
          height: d,
          borderRadius: '50%',
          border: `${w.toFixed(2)}px solid rgba(206,190,240,${(0.9 * o).toFixed(3)})`,
          background: `radial-gradient(circle, rgba(85,26,137,0) 55%, rgba(124,58,237,${(0.22 * o).toFixed(3)}) 88%, rgba(124,58,237,0) 100%)`,
          boxShadow: `0 0 ${(20 + 12 * u).toFixed(1)}px ${(5 * (1 - u) + 2).toFixed(1)}px rgba(124,58,237,${(0.55 * o).toFixed(3)}), inset 0 0 ${(22 + 16 * u).toFixed(1)}px rgba(124,58,237,${(0.5 * o).toFixed(3)})`,
        }}
      />
    </div>
  );
};

export const Note: React.FC<{ t: number; at: number; step: number; size: number; rest: Rest }> = ({ t, at, step, size, rest }) => {
  const words = '5 free minutes, no card'.split(' ');
  if (t < at - 4) return null;
  return (
    <div
      style={{
        fontFamily: FONT.body,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.3,
        letterSpacing: '-0.01em',
        color: 'rgba(237,236,241,0.82)',
        whiteSpace: 'nowrap',
      }}
    >
      {words.map((w, i) => (
        <MaskRise key={i} t={t} at={at + i * step} pad={i < words.length - 1 ? '0.26em' : 0} rest={rest}>
          {w}
        </MaskRise>
      ))}
    </div>
  );
};

/**
 * The colophon strip: the hero's masthead hairline (paper at 16 %) running
 * to the safe margins, broken by a CornerDot + the URL. The URL TYPES from
 * its cue frame (one character per `step` frames, each landing with a 1-frame
 * rise), a brand-lit caret riding ahead of it; the rule draws out from the
 * URL as it types. Full paper, never dimmed.
 */
export const Url: React.FC<{
  t: number;
  at: number;
  text: string;
  /** typed in chunks: chunk k starts at character `from` on frame `at` */
  chunks?: readonly { from: number; at: number }[];
  size: number;
  dot: number;
  ruleW: number;
  step: number;
  rest: Rest;
}> = ({ t, at, text, chunks, size, dot, ruleW, step, rest }) => {
  if (t < at - 3) return null;
  const d = rest(t, aos(t, at - 1, { anticip: 2, depth: 0.2, config: SPRING.site }), 1);
  const draw = tween(t, [at + 2, at + 24], [0, 1], EASE.house);
  const n = text.length;
  const parts = chunks && chunks.length ? chunks : [{ from: 0, at }];
  /** the frame character i is typed */
  const charAt = (i: number) => {
    let c = parts[0];
    for (const p of parts) if (i >= p.from) c = p;
    return c.at + (i - c.from) * step;
  };
  let typedN = 0;
  for (let i = 0; i < n; i++) if (t >= charAt(i)) typedN = i + 1;
  const typed = typedN - 1 + 1e-3; // (whole characters typed, for the caret)
  const doneAt = charAt(n - 1);
  // caret: on while typing, then a blink off
  const caretO = t < at ? 0 : t <= doneAt + 2 ? 1 : tween(t, [doneAt + 2, doneAt + 6], [1, 0], EASE.in2);
  const rule = (origin: 'left' | 'right') => (
    <div
      style={{
        flex: 1,
        height: 1,
        background: 'rgba(222,220,224,0.16)',
        transform: `scaleX(${draw.toFixed(4)})`,
        transformOrigin: origin,
      }}
    />
  );
  return (
    <div style={{ width: ruleW, display: 'flex', alignItems: 'center', gap: Math.round(size * 0.9) }}>
      {rule('right')}
      <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.45) }}>
        <span
          style={{
            display: 'block',
            transform: `scale(${Math.max(0, d).toFixed(3)}) rotate(${((1 - Math.min(1, d)) * -90).toFixed(2)}deg)`,
          }}
        >
          <CornerDot size={dot} color={C.brandLit} />
        </span>
        <div
          style={{
            position: 'relative',
            fontFamily: FONT.mono,
            fontWeight: 500,
            fontSize: size,
            lineHeight: 1.2,
            letterSpacing: '0.01em',
            color: C.paper,
            whiteSpace: 'pre',
            display: 'flex',
          }}
        >
          {text.split('').map((ch, i) => {
            const k = t - charAt(i); // ≥ 0 once typed
            const up = k < 0 ? 0 : rest(t, springAt(t, charAt(i), SPRING.pop), 1);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  opacity: k < 0 ? 0 : 1,
                  transform: up < 1 - 1e-4 || up > 1 + 1e-4 ? `translateY(${((1 - up) * 0.22).toFixed(3)}em)` : undefined,
                }}
              >
                {ch}
              </span>
            );
          })}
          {caretO > 0.01 ? (
            <span
              style={{
                position: 'absolute',
                top: '0.12em',
                left: `${(Math.min(n, Math.max(0, Math.floor(typed) + 1)) * 0.61).toFixed(3)}em`, // Geist Mono advance .6em + .01em tracking
                width: '0.08em',
                height: '0.96em',
                marginLeft: '0.06em',
                background: C.brandLit,
                opacity: caretO,
                boxShadow: `0 0 12px rgba(192,172,224,${(0.6 * caretO).toFixed(3)})`,
              }}
            />
          ) : null}
        </div>
      </div>
      {rule('left')}
    </div>
  );
};
