/**
 * PART IV · b15–b16 · WORK THAT MATTERS (SCRIPT.md b15–b16; CLIENT DIRECTION v2) — every time is MATTERS_LOCAL
 * (src/kb/timing.ts, from the real word onsets); every pose is scenes/matters/stage.ts.
 *
 *   0        back to the desk from b01 — the same paper, the same framing, on Part I's own ground (the site's
 *            "no answer" grey mesh, MUTED_MESH, lift .88), now lit by HER: the clock reads WED 09:14 and its colon
 *            is Ava's teal dot (the room's only light, keyed into the mesh where the rose line light was). The pad is
 *            empty; the old slip stack sits at the desk's edge. The in-person card is at full depth, and its
 *            sentence finally completes: the em dash is lifted off and "nervous." rises in its place (73.0)
 *   desk2    ● FRONT DESK and the staff reply rise under it on Leo's words: "That's completely normal. / We'll take
 *            it slow."
 *   ring     74.5 (beat 2, ducked): the line rings once — one hairline teal ring leaves the dot; her soft pickup a
 *            16th later; AVA · ON A CALL rolls in under the clock where a second chirp would have been. The card
 *            DOES NOT MOVE: the missing motion is the payoff
 *   breath   ≥ a bar of room tone: nothing moves but the dot's breathing
 *   b16      a slow push toward the card (the camera, eased in: zoom 1 → 1.05); the clock's figures and labels leave up
 *            through their masks (her dot stays: the room's light; 9:16 it rises above the title). On "That's" the desk
 *            STEPS BACK (Part I's step back, SPRING.site: the card, its reply and the paper to .84 about the layout's
 *            anchor, a .06 shade, the reply dimmed) and THE THESIS takes the frame: "That's the work / only people can
 *            do." in the display role a step up (16:9 144 px, a clean left block on the card's edge, caps 120 px under
 *            the top; 9:16 three lines at 120 px), word by word on vo-8; on "do." the key phrase eases into sunday ink
 *            as the glint runs through it. A beat's fifth later the old slip stack lifts and glides off as one on an arc
 *            toward the teal dot and out of the frame, still reading "nine till two"
 *   dark     the last three beats: THE CLOSING KEY (stage.ts closingAt) — the room's light is pulled in from the frame's
 *            far edges onto her dot: the lit room (MUTED keyed teal) gives way to the night (INK_MESH, deep, her key
 *            pool — b17's first picture) behind a soft radial edge; the desk falls into silhouette pixel by pixel with
 *            the ground (its type goes first, by opacity); the thesis turns to light type where the dark reaches it —
 *            the last thing standing — and leaves up through its masks in the last third of a beat
 *
 * THE GROUND: Part I's MUTED_MESH, keyed on her teal colon the way Part I was keyed rose — a sunday tint pool at the
 * dot (its light pool pulled toward it), pulsing on the ring and the pickup, growing across b16, the mesh breathing
 * (drift × 1.4, clocks × 1.2: the pools visibly travel over the act).
 *
 * PLANES: the ground (screen-fixed: a mesh has nothing to parallax), the desk 0.6 (card, reply, pad, stack), the
 * near plane 1.0 (the clock); the title is a screen graphic; the dot is drawn over everything (it outlives all).
 * No cursor and no app tabs here: nobody is working the app — the desk is people.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Camera, Layer } from '../../components/Camera';
import { camMotion } from '../../lib/glide';
import { useLayout } from '../../lib/layout';
import { MeshGround, meshShadowInk } from '../kit';
import { INK_MESH, MOMENT_LIGHTS, MUTED_MESH } from '../palettes';
import { useKbSceneFrame } from '../scene';
import { MATTERS_LOCAL as M, SCENES } from '../timing';
import { MattersCard } from './matters/Card';
import { MattersClock } from './matters/Clock';
import { TealDot, TealRing } from './matters/Dot';
import { rampCss } from './matters/Night';
import { OldStack, Pad } from './matters/Paper';
import { DeskReply } from './matters/Reply';
import { closingAt, deskStep, dotAt, groundGrade, mattersCam, mattersLayout, PLANE } from './matters/stage';
import { Thesis } from './matters/Title';
import { REPEAT_GROUND } from './Repeat';

const SHADOW_INK = meshShadowInk(MUTED_MESH);
const SUNDAY = MOMENT_LIGHTS.sunday;
/** her light on the ground (the sunday orb's body) */
const TEAL = SUNDAY.orb[2];
/** the night the room closes onto: b16's last ground exactly (b17's first — cta/stage.ts groundAt reads the same) */
const NIGHT = groundGrade(M.end);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

/** the ring and the pickup on the room's teal key (b01's rose pulse idiom): 0 … 1 */
const pulse = (t: number) => {
  let p = 0;
  for (const f of [M.ring, M.pickup]) {
    const dt = t - f;
    if (dt >= 0) p = Math.max(p, Math.exp(-dt / 9) * (1 - Math.exp(-dt / 0.8)) * (f === M.ring ? 1 : 0.6));
  }
  return p;
};

/**
 * THE ROOM'S TEAL KEY on the lit ground (MeshGround keyLight strength: how far the mesh's light pool is pulled onto the
 * dot, and the tint's alpha — the light variant lays it at .6 of that). Her light the way Part I's rose was the line
 * light: a visible pool at rest (≈ .12 of tint at the dot), a pulse on the ring and the pickup, growing across b16, and
 * taking over as the room closes onto it.
 */
const tealKey = (t: number, c: number) => 0.23 + 0.12 * pulse(t) + 0.09 * smoothstep(M.b16, M.dark[0], t) + 0.6 * c;

/** b16's thesis, vo-8's seven words, each on its spoken onset (a frame ahead, as captions lead) */
const VO8_WORDS = ['That’s', 'the', 'work', 'only', 'people', 'can', 'do.'] as const;

/**
 * The whole picture at act-local `t` (negative = the act's first picture held; exported for the neighbours). `part`
 * (only b14's L-cut, change/Cross.tsx, which hands the grounds over under a soft edge and the desk behind it): just the
 * ground, or just what stands on it. Omitted — this act, and the push's landing — it is the whole picture, unchanged.
 */
export const MattersDesk: React.FC<{ t: number; part?: 'ground' | 'desk' }> = ({ t, part }) => {
  const ground = part !== 'desk';
  const desk = part !== 'ground';
  const L = useLayout();
  const v = L.vertical;
  const g = mattersLayout(v);
  const cam = mattersCam(t, v);
  const cm = camMotion((u) => mattersCam(u, v), t);
  const dot = dotAt(t, v);
  const cl = closingAt(t, v);
  const c = cl ? cl.c : 0;
  const step = deskStep(t, v);
  const G = Math.sqrt(L.width * L.height);
  // the lit room: Part I's mesh on the timeline's clock (breathing: drift × 1.4, clocks × 1.2), keyed by her dot. As the
  // room closes onto the dot it dims a touch and her key takes it over; beyond the closing key's edge it is gone
  const lit = (
    <MeshGround
      t={SCENES.matters.from + t}
      palette={REPEAT_GROUND.palette}
      lift={REPEAT_GROUND.lift}
      brightness={1 - 0.4 * c}
      seed={REPEAT_GROUND.seed}
      speed={1.2}
      drift={1.4}
      keyLight={{ x: dot.x, y: dot.y, strength: tealKey(t, c), color: TEAL, radius: G * (0.45 + 0.07 * smoothstep(M.b16, M.dark[0], t)) }}
    />
  );
  const litMask = cl ? rampCss(cl.x, cl.y, cl.ri, cl.ro, cl.a, 0, '0,0,0') : null;
  return (
    <AbsoluteFill>
      {ground && cl ? (
        // the night it closes onto: b17's first picture exactly (INK_MESH, deep, her key pool on the dot)
        <MeshGround
          t={SCENES.matters.from + t}
          palette={REPEAT_GROUND.palette}
          paletteB={INK_MESH}
          mix={NIGHT.mix}
          lift={REPEAT_GROUND.lift * NIGHT.lift}
          brightness={NIGHT.brightness}
          saturation={NIGHT.saturation}
          shade={NIGHT.shade}
          seed={REPEAT_GROUND.seed}
          keyLight={{ x: dot.x, y: dot.y, strength: 0.5, color: SUNDAY.orb[1], radius: L.pick(620, 600) * 0.88 }}
        />
      ) : null}
      {!ground ? null : litMask === null ? lit : cl && cl.ro > 0 && cl.a > 0.001 ? <AbsoluteFill style={{ maskImage: litMask, WebkitMaskImage: litMask }}>{lit}</AbsoluteFill> : null}
      {desk ? (
        <>
          <TealRing t={t} g={g} />
          <Camera x={cam.x} y={cam.y} zoom={cam.zoom} moving={cm.moving} zooming={cm.zooming}>
            <Layer depth={PLANE.desk}>
              {/* b16's step back: the whole desk about the layout's anchor (each part keeps its own sub-pixel layer) */}
              <AbsoluteFill
                style={
                  step.k > 0
                    ? { transform: `scale(${step.s.toFixed(5)})`, transformOrigin: `${step.ax}px ${step.ay}px` }
                    : undefined
                }
              >
                <Pad t={t} g={g} ink={SHADOW_INK} flat={step.shade} cl={cl} />
                <OldStack t={t} g={g} ink={SHADOW_INK} flat={step.shade} cl={cl} />
                <MattersCard t={t} g={g} ink={SHADOW_INK} flat={step.shade} cl={cl} />
                <DeskReply t={t} g={g} cl={cl} />
              </AbsoluteFill>
            </Layer>
            <Layer depth={PLANE.near}>
              <MattersClock t={t} g={g} />
            </Layer>
          </Camera>
          <Thesis
            t={t}
            words={VO8_WORDS}
            at={M.vo8Words.map((f) => f - 1)}
            lines={g.title.lines}
            x={g.title.x}
            y={g.title.y}
            size={g.title.size}
            vertical={v}
            keyPhrase={{ from: 3, at: M.key }}
            exit={{ at: M.titleOut, stagger: 0.5, dur: 7 }}
            cl={cl}
          />
          <TealDot t={t} g={g} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

export const Matters: React.FC = () => {
  const t = useKbSceneFrame('matters');
  return <MattersDesk t={Math.max(t, -1e3)} />;
};
