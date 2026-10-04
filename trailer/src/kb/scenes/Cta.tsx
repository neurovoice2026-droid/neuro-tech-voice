/**
 * CLOSE · b17–b18 · YOUR ANSWERS → THE END CARD (SCRIPT.md b17–b18; CLIENT DIRECTION v2). Every time is CTA_LOCAL
 * (src/kb/timing.ts, from the real word onsets); every pose and light is scenes/cta/stage.ts.
 *
 * Built by docs/kb/PIPELINE.md §7's FALLBACK route (the headline differs from film 1's, so film 1's Cta is not
 * mounted as is): film 1's timing-free parts — scenes/cta/EndCard (Wordmark · StartFree · Note · Url) and orbPass
 * (the site's FluidOrb in one WebGL context), the backlight forked from heroShader (cta/lightShader.ts), HeroGL
 * forked without the portrait (cta/LightGL.tsx) — on the site's gradient mesh, timed by CTA_LOCAL.
 *
 *   0        the cut lands on b16's last picture exactly: the deep INK_MESH all but black, her teal dot (where b16
 *            left it) keying the room. The night comes up over a bar and a half — the mesh's violet material
 *            opening out of the dark, her dot still the room's light
 *   words    Ava: "Your answers. / Written once, there for every call." — the house two-tone heading, centred, each
 *            row rising on its phrase's first word; "there for every call." takes her teal word by word as it is said
 *   lights   THE FOUR LIGHTS, one at a time on 8ths from the corners as the heading completes: SUNDAY first — her
 *            dot springs open into her orb (16:9 at its corner; 9:16 it glides from the top centre to its corner) —
 *            then rush (top left), closing (lower left), night (lower right). The room's key moves onto her orb.
 *            The ring of four drifts toward the centre, turning on the way they came (counter-clockwise)
 *   converge on the beat: the heading leaves up through its masks word by word; the ring swells, whirls and spirals
 *            into the core P; the three pour into HER light, which takes all four hues, holds alone, is squeezed
 *   IMPACT   on the bar: her light gives itself away in a short white burst and the merged light opens OUT of the
 *            core as the wide, filled, luminous BACKLIGHT (film 1's); NEUROVOICE (Inter Tight 500, −0.07em, the
 *            wordmark ink) surfaces letter by letter from the centre out as the light reaches it; the four lights
 *            come up as the colours of its rim, each on the side it arrived from; the backlight lights the mesh
 *   brand    "Neuro Tech Voice.": neurotechvoice.com rises on her words; "Start free →" on "…Voice."; the note a beat
 *            later; THE CLICK — a real pointer comes in from the right on a calm arc, the button takes the site's
 *            hover (plum) as the pointer enters it, rests, presses (.97, the pointer .9), releases
 *   hold     dead still (every residual pinned), the picture fading with the master (MIX.fadeOut) into the night
 *
 * The mesh is screen-fixed (a mesh has nothing to parallax) and there is no camera: the type sits still and crisp;
 * the lights, the light and the pointer are what move. One WebGL context (the lights + the backlight); the mesh is a
 * 2D canvas; everything else is crisp vector DOM.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import '../../scenes/cta/font/wordmark.css';
import { flowTime, seedTime } from '../../components/Orb';
import type { OrbDraw } from '../../components/orbGL';
import { useFaceReady } from '../../lib/fonts';
import { useLayout } from '../../lib/layout';
import { ALL_GLOW, GLOW, hexToRgb, inkFor, mixColor } from '../../lib/lights';
import { EASE, mix, tween, windowed } from '../../lib/motion';
import { Note, StartFree, Url, Wordmark, WORDMARK_FONT, WORDMARK_INK, WORDMARK_TEXT } from '../../scenes/cta/EndCard';
import { C, TRACK } from '../../theme';
import { click, Cursor, cursorPos, measureText, MeshGround, useKitFaces, type CursorKey, type Rect } from '../kit';
import { HOME, INK_MESH, MOMENT_LIGHTS } from '../palettes';
import { useKbSceneFrame } from '../scene';
import { CTA_LOCAL as K, MATTERS_LOCAL, SCENES } from '../timing';
import { Heading, type HeadingRow } from './cta/Heading';
import { LightGL, type Glow, type LightUniforms } from './cta/LightGL';
import {
  arriveAt,
  bloomAt,
  brandEnv,
  breathAt,
  ctaLayout,
  endLight,
  groundAt,
  lightsAt,
  orbVolume,
  rest,
  smoothUnit,
  SURVIVOR,
  type CtaLayout,
} from './cta/stage';
import { mattersLayout } from './matters/stage';
import { TealDot } from './matters/Dot';
import { REPEAT_GROUND } from './Repeat';

const SUNDAY = MOMENT_LIGHTS.sunday;
/** the key phrase on the night: her teal's light end (lights.ts inkFor('sunday', 'dark') — #a5eaf5) */
const KEY_INK = inkFor('sunday', 'dark');
/** the glint that runs into each key word as it is said: her lightest teal */
const GLINT = SUNDAY.orb[4];
const rgb01 = (hex: string) => hexToRgb(hex) as [number, number, number];

/** the heading's rows: 16:9 two (the last two phrases share a row), 9:16 a row per phrase */
function headingRows(vertical: boolean): HeadingRow[] {
  const words = 'Your answers. Written once, there for every call.'.split(' ');
  const groups: number[][] = vertical ? K.phrases.map((p) => [...p]) : [[...K.phrases[0]], [...K.phrases[1], ...K.phrases[2]]];
  return groups.map((idx) => ({ words: idx.map((i) => words[i]), idx, at: K.words[idx[0]] - K.riseLead }));
}
const KEY_ONSETS: ReadonlyMap<number, number> = new Map(K.key.map((i) => [i, K.words[i]]));

/* ── the click ─────────────────────────────────────────────────────── */

/** the site button's box (EndCard StartFree: title role 500, height 2.25em, padding 1.125em, gap .4em) */
function buttonRect(G: CtaLayout): Rect {
  const F = G.button.size;
  const spec = { size: F, weight: 500, tracking: parseFloat(TRACK.title) };
  const w = 2 * 1.125 * F + measureText('Start free', spec) + 0.4 * F + measureText('→', spec);
  const h = 2.25 * F;
  return { x: G.W / 2 - w / 2, y: G.button.y - h / 2, w, h };
}

/** the pointer: in from the right edge at the button's height (clear of every row of type), a calm arc onto the
 *  button — its tip in the gap between "free" and the arrow, so it never sits on a letter through the hold —
 *  `dwell` frames to read it, the press, the release */
function cursorKeys(G: CtaLayout, r: Rect): CursorKey[] {
  const F = G.button.size;
  const spec = { size: F, weight: 500, tracking: parseFloat(TRACK.title) };
  const gapX = r.x + 1.125 * F + measureText('Start free', spec) + 0.2 * F;
  const target = { x: gapX, y: r.y + r.h * 0.56 };
  const entry = G.vertical ? { x: G.W + 60, y: target.y + 40 } : { x: G.W + 70, y: target.y + 60 };
  return [{ at: K.press - K.dwell - 40, x: entry.x, y: entry.y }, ...click(K.press, target.x, target.y, { dwell: K.dwell, hold: K.release - K.press })];
}

/** the frame the pointer's hotspot first enters the button (its hover starts there) */
function hoverStart(keys: readonly CursorKey[], r: Rect) {
  for (let tt = K.press - 45; tt <= K.press; tt += 0.25) {
    const p = cursorPos(keys, tt);
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return tt;
  }
  return K.press - 6;
}

const Row: React.FC<{ y: number; children: React.ReactNode }> = ({ y, children }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', transform: 'translateY(-50%)' }}>{children}</div>
);

/* ── the scene ──────────────────────────────────────────────────────── */

export const Cta: React.FC = () => {
  const L = useLayout();
  const t = useKbSceneFrame('cta');
  const v = L.vertical;
  const wordmarkReady = useFaceReady(`500 100px ${WORDMARK_FONT}`, WORDMARK_TEXT);
  useKitFaces();
  const G = ctaLayout(v);
  const I = K.impact;

  const lights = lightsAt(t, G);
  const ground = groundAt(t, G, lights);

  /* ── the four lights in the GL context: orbs + their blooms (film 1's light model) ── */
  const vol = orbVolume(t);
  const flow = flowTime(Math.max(0, t), orbVolume);
  const inP = tween(t, K.orbIn, [0, 1], EASE.inOut);
  const burst = tween(t, K.burst, [0, 1], EASE.out3);
  const survivorW = windowed(t, K.merge[0], K.survivor[0], I - 1, I + 4, EASE.out3, EASE.in2);
  const toAll = tween(t, K.merge, [0, 1], EASE.inOut);
  const sv = lights[SURVIVOR];
  const sw = (t - K.merge[0]) * 0.32;
  const orbs: OrbDraw[] = [];
  const glows: Glow[] = lights.map((o) => {
    const shown = o.pop > 0 && o.d >= 1 && o.opacity > 0.002;
    const body = GLOW[o.id];
    const glowBody = mixColor(mixColor(body.body, body.core, 0.4), ALL_GLOW.body, o.i === SURVIVOR ? toAll : 0);
    // a point of light: its bloom (≈ its own size) does the work of the light, a brighter flash on its arrival
    let gs = 0.7 * o.gather;
    let gr = o.gather > 0 ? G.orb * (0.25 + 0.25 * o.gather) : 0;
    if (shown) {
      gs += (0.42 * o.light + 0.32 * o.flash) * (1 + 0.3 * inP) * o.opacity;
      gr = Math.max(gr, 0.8 * o.d * (1 + 0.3 * o.flash));
    }
    gs = Math.min(1.3, gs);
    const own = {
      x: o.x,
      y: o.y,
      r: gr,
      s: gs,
      color: rgb01(mixColor(glowBody, MOMENT_LIGHTS[o.id].orb[3], smoothUnit(o.gather * (1 - Math.min(1, o.light / 0.4))))),
    };
    // in the merge every slot travels onto the survivor as one of its four colour glows (slot k = light k, always)
    const a = sw + (o.i * Math.PI) / 2;
    const mine = { x: sv.x + Math.cos(a) * sv.d * 0.55, y: sv.y + Math.sin(a) * sv.d * 0.55, r: sv.d * 0.72, s: 0.6 * survivorW, color: rgb01(MOMENT_LIGHTS[o.id].orb[2]) };
    let g: Glow = {
      x: mix(own.x, mine.x, survivorW),
      y: mix(own.y, mine.y, survivorW),
      r: mix(own.r, mine.r, survivorW),
      s: mix(own.s, mine.s, survivorW),
      color: [0, 1, 2].map((c) => mix(own.color[c], mine.color[c], survivorW)) as [number, number, number],
    };
    if (t >= I) {
      // the impact: the survivor's slot is the burst — a white-lilac light from the core, hot for 2–3 frames,
      // handing over to the backlight; the others are gone
      g =
        o.i === SURVIVOR
          ? { x: sv.x, y: sv.y, r: mix(sv.d * 1.1, G.halo[0] * 0.5, burst), s: 0.85 * Math.exp(-(t - I) / 2.2), color: rgb01(mixColor('#f7f3ff', MOMENT_LIGHTS.night.orb[3], 0.35)) }
          : { ...g, s: 0 };
    }
    if (shown) orbs.push({ x: o.x, y: o.y, d: o.d, palette: o.palette, volume: vol, time: flow + seedTime(o.i), opacity: o.opacity });
    return g;
  });
  // the survivor on top in the merge
  orbs.sort((p, q) => (p.palette === sv.palette ? 1 : q.palette === sv.palette ? -1 : 0));

  /* ── the backlight ── */
  const bloomS = bloomAt(t);
  const haloScale = mix(G.bloomFrom, 1, bloomS);
  const flare = t < I ? 0 : rest(t, Math.exp(-(t - I) / 6), 0);
  const u: LightUniforms = {
    haloC: [G.P.x, G.P.y],
    haloR: [G.halo[0] * haloScale, G.halo[1] * haloScale, G.halo[2] * haloScale],
    haloGain: t < I ? 0 : rest(t, smoothUnit(bloomS / 0.5) * (1 + 0.22 * flare) * (1 + 0.012 * breathAt(t)) * (1 + 0.04 * brandEnv(t)), 1),
    merge: [1, 0.72, 0.42, 0.05],
    floor: [G.P.y + G.floor.dy, G.floor.len, G.floor.k * tween(t, [I + 4, K.button + 10], [0, 1], EASE.inOut), G.floor.rise],
    glows,
    // the four lights on its rim, each on the corner it arrived from: rush top-left, sunday top-right, night
    // bottom-right, closing bottom-left
    rim: [0.85 * tween(t, K.rimIn, [0, 1], EASE.inOut), 0, 0, 0.45],
    rimColors: (['rush', 'sunday', 'night', 'closing'] as const).map((id) => rgb01(mixColor(MOMENT_LIGHTS[id].orb[2], MOMENT_LIGHTS[id].orb[3], 0.25))),
    glowOver: 0.4,
    wide: [4.5, 0.07],
    seed: t,
  };
  const glOn = t >= K.lights[0] - 3;

  /* ── her dot (b16's, continuing exactly), until her light springs out of it ── */
  const dotO = 1 - tween(t, [K.lights[0] - 0.5, K.lights[0] + 3], [0, 1], EASE.inOut);

  /* ── the click ── */
  const rect = buttonRect(G);
  const keys = cursorKeys(G, rect);
  const hover = hoverStart(keys, rect);

  /* the impact's light: a white burst from the core (a light, not a veil), rising over 1.5 f, gone in ≈5 */
  const flash = t < I - 1.5 ? 0 : t < I ? Math.sin(((t - (I - 1.5)) / 1.5) * (Math.PI / 2)) : Math.exp(-(t - I) / 1.5);
  const endO = 1 - endLight(t);

  return (
    <AbsoluteFill style={{ background: HOME.night }}>
      <MeshGround
        t={SCENES.cta.from + t}
        palette={INK_MESH}
        lift={0}
        brightness={ground.brightness}
        saturation={ground.saturation}
        shade={ground.shade}
        seed={REPEAT_GROUND.seed}
        keyLight={ground.key}
      />
      {dotO > 0.001 ? (
        <AbsoluteFill style={{ opacity: dotO < 0.999 ? dotO : undefined }}>
          <TealDot t={MATTERS_LOCAL.end + t} g={mattersLayout(v)} />
        </AbsoluteFill>
      ) : null}
      {glOn ? <LightGL width={L.width} height={L.height} u={u} orbs={orbs} /> : null}
      {/* the type is the near plane: the lights pass behind it */}
      <Heading
        t={t}
        rows={headingRows(v)}
        cy={G.heading.cy}
        size={G.heading.size}
        vertical={v}
        color={C.paper}
        keyOn={KEY_ONSETS}
        keyColor={KEY_INK}
        glint={GLINT}
        exit={K.exit}
      />
      <Wordmark t={t} at={I} ready={wordmarkReady} rest={rest} spec={{ x: G.P.x, y: G.P.y, size: G.wordmark, arrive: arriveAt(G), color: WORDMARK_INK }} />
      <Row y={G.button.y}>
        <StartFree t={t} at={K.button} press={K.press} fontSize={G.button.size} vertical={v} spec={{ hover, down: K.release - K.press }} rest={rest} />
      </Row>
      <Row y={G.note.y}>
        <Note t={t} at={K.note} step={K.noteStep} size={G.note.size} vertical={v} />
      </Row>
      <Row y={G.url.y}>
        <Url
          t={t}
          text={K.urlText}
          chunks={K.urlChunks.map((from, k) => ({ from, at: K.url[k] }))}
          size={G.url.size}
          dot={G.url.dot}
          ruleW={G.url.rule}
          vertical={v}
          rest={rest}
        />
      </Row>
      <Cursor keys={keys} t={t} />
      {flash > 0.002 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${G.P.x.toFixed(1)}px ${G.P.y.toFixed(1)}px, rgba(255,255,255,${(0.75 * flash).toFixed(3)}) 0%, rgba(247,243,255,${(0.42 * flash).toFixed(3)}) ${L.pick(6, 5)}%, rgba(214,200,255,${(0.12 * flash).toFixed(3)}) ${L.pick(18, 15)}%, rgba(196,168,255,${(0.03 * flash).toFixed(3)}) 34%, rgba(196,168,255,0) 52%)`,
          }}
        />
      ) : null}
      {endO > 0.001 ? <AbsoluteFill style={{ background: HOME.night, opacity: endO }} /> : null}
    </AbsoluteFill>
  );
};
