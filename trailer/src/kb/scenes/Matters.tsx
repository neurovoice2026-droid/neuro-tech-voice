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
 *   b16      a slow push toward the card (the camera, eased in: zoom 1 → 1.05); "That's the work / only people can
 *            do." rises over the desk's upper band word by word on vo-8 (headline; 9:16: the clock leaves up and the
 *            dot rises above the title); on "do." the key phrase eases into sunday ink as the glint runs through it,
 *            and the old slips lift and glide off toward the teal dot, still reading "nine till two"
 *   dark     the last three beats: the mesh hands off to the night (MUTED → INK_MESH, light → deep, its light pool
 *            pulled onto the dot, keyed teal), the paper sinks into it, the type fades with the light — the teal dot
 *            is the key light, and the frame lands in the dark on the close's bar
 *
 * PLANES: the ground (screen-fixed: a mesh has nothing to parallax), the desk 0.6 (card, reply, pad, stack), the
 * near plane 1.0 (the clock); the title is a screen graphic; the dot is drawn over everything (it outlives all).
 * No cursor and no app tabs here: nobody is working the app — the desk is people.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Camera, Layer } from '../../components/Camera';
import { camMotion } from '../../lib/glide';
import { mixHex } from '../../lib/motion';
import { useLayout } from '../../lib/layout';
import { MeshGround, meshShadowInk } from '../kit';
import { HOME, INK_MESH, MOMENT_LIGHTS, MUTED_MESH } from '../palettes';
import { useKbSceneFrame } from '../scene';
import { ACCENT } from '../theme';
import { MATTERS_LOCAL as M, SCENES } from '../timing';
import { MattersCard } from './matters/Card';
import { MattersClock } from './matters/Clock';
import { TealDot, TealRing } from './matters/Dot';
import { OldStack, Pad } from './matters/Paper';
import { DeskReply } from './matters/Reply';
import { darkness, dotAt, groundGrade, mattersCam, mattersLayout, paperFade, paperShade, PLANE } from './matters/stage';
import { LeftTitle, type TitleLine } from './recording/Type';
import { REPEAT_GROUND } from './Repeat';

const SHADOW_INK = meshShadowInk(MUTED_MESH);
const SUNDAY = MOMENT_LIGHTS.sunday;
/** her light on the ground (the sunday orb's body) */
const TEAL = SUNDAY.orb[2];

/** the room's teal tint from the dot: .035 at rest (b01's rose was .03), a pulse on the ring and the pickup */
const roomTint = (t: number) => {
  let p = 0;
  for (const f of [M.ring, M.pickup]) {
    const dt = t - f;
    if (dt >= 0) p = Math.max(p, Math.exp(-dt / 9) * (1 - Math.exp(-dt / 0.8)) * (f === M.ring ? 1 : 0.6));
  }
  return 0.035 + 0.03 * p;
};

/** b16's title, a line per phrase; each word on its spoken onset (a frame ahead, as captions lead) */
const titleLines = (): TitleLine[] => {
  const w = (k: number) => M.vo8Words[k] - 1;
  return [
    { words: ["That's", 'the', 'work'], at: [w(0), w(1), w(2)] },
    { words: ['only', 'people', 'can', 'do.'], at: [w(3), w(4), w(5), w(6)] },
  ];
};

/** The whole picture at act-local `t` (negative = the act's first picture held; exported for the neighbours). */
export const MattersDesk: React.FC<{ t: number }> = ({ t }) => {
  const L = useLayout();
  const v = L.vertical;
  const g = mattersLayout(v);
  const cam = mattersCam(t, v);
  const cm = camMotion((u) => mattersCam(u, v), t);
  const dark = darkness(t);
  const dot = dotAt(t, v);
  const shade = paperShade(t);
  const fade = paperFade(t);
  // the ground: Part I's mesh on the timeline's clock, keyed by her dot; in the dark it hands off to the night —
  // the lit shade goes out with the light, the mesh's light pool is pulled onto her dot, and its tint deepens to her
  // ink (on the deep ground the tint is light ADDED: kept to her darker teal so the dot stays the brightest thing)
  const key = roomTint(t) * 4 * (1 - dark) + 0.5 * dark;
  const keyColor = mixHex(TEAL, SUNDAY.orb[1], dark);
  const gg = groundGrade(t);
  return (
    <AbsoluteFill>
      <MeshGround
        t={SCENES.matters.from + t}
        palette={REPEAT_GROUND.palette}
        paletteB={INK_MESH}
        mix={gg.mix}
        lift={REPEAT_GROUND.lift * gg.lift}
        brightness={gg.brightness}
        saturation={gg.saturation}
        shade={gg.shade}
        seed={REPEAT_GROUND.seed}
        keyLight={{ x: dot.x, y: dot.y, strength: key, color: keyColor, radius: L.pick(620, 600) * (1 - 0.12 * dark) }}
      />
      <TealRing t={t} g={g} />
      <Camera x={cam.x} y={cam.y} zoom={cam.zoom} moving={cm.moving} zooming={cm.zooming}>
        <Layer depth={PLANE.desk}>
          {/* the paper sinks into the night, then is gone into it before the cut */}
          <AbsoluteFill style={{ opacity: fade < 0.999 ? fade : undefined }}>
            {fade > 0.001 ? (
              <>
                <Pad g={g} ink={SHADOW_INK} shade={shade} />
                <OldStack t={t} g={g} ink={SHADOW_INK} shade={shade} />
                <MattersCard t={t} g={g} ink={SHADOW_INK} shade={shade} />
                <DeskReply t={t} g={g} />
              </>
            ) : null}
          </AbsoluteFill>
        </Layer>
        <Layer depth={PLANE.near}>
          <MattersClock t={t} g={g} />
        </Layer>
      </Camera>
      <LeftTitle
        t={t}
        lines={titleLines()}
        x={g.title.x}
        y={g.title.y}
        vertical={v}
        color={HOME.ink}
        keyPhrase={{ text: 'only people can do.', at: M.key, color: ACCENT.sunday, glint: TEAL }}
        exit={{ at: M.titleOut, stagger: 1, dur: 9 }}
      />
      <TealDot t={t} g={g} />
    </AbsoluteFill>
  );
};

export const Matters: React.FC = () => {
  const t = useKbSceneFrame('matters');
  return <MattersDesk t={Math.max(t, -1e3)} />;
};
