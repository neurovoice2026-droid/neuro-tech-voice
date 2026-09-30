/**
 * The section heading, site idiom (heading.tsx): CornerDot + violet eyebrow,
 * then the title in Instrument Sans. The eyebrow walks the site's own
 * sections (mega-menu note → #how eyebrow); the title rolls through the
 * act's three beats in one slot:
 *
 *   "16 industries."  →  "14 languages."  →  "After the call."
 *
 * the "1" stays for the first swap (the second figure rolls, the noun is
 * replaced letter by letter); the third is the site's #after section name,
 * so the flow is framed by a heading like every other section on the page.
 */
import React from 'react';
import { C, FONT, TRACK } from '../../theme';
import { EASE, mixHex, tween } from '../../lib/motion';
import { CornerDot } from '../../components/Type';
import { Rise, Stack } from './Rise';

export type HeadingTiming = {
  eyebrow: readonly [number, number]; // the two eyebrow lines in
  eyebrowOut: readonly [number, number]; // …and out (fast, so the next rises into a clear slot)
  title: number; // "16 industries." rises
  swap: number; // → "14 languages."
  out: number; // "14 languages." leaves…
  after: number; // …"After the call." rises
};

export const Heading: React.FC<{
  t: number;
  x: number;
  eyebrowY: number;
  titleY: number;
  size: number;
  T: HeadingTiming;
}> = ({ t, x, eyebrowY, titleY, size, T }) => {
  const [e0, e1] = T.eyebrow;
  const [o0, o1] = T.eyebrowOut;
  // key colour: the figures ease ink → violet after the site's 0.15 s delay
  const keyCol = (at: number) => mixHex(C.ink, C.violet, tween(t, [at + 5, at + 23], [0, 1], EASE.house));
  const dot = tween(t, [e0 - 2, e0 + 8], [0, 1], EASE.house) * (1 - tween(t, [o1 + 1, o1 + 6], [0, 1], EASE.in2));
  return (
    <>
      {dot > 0.005 ? (
        <div
          style={{
            position: 'absolute',
            left: x,
            top: eyebrowY,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: C.violet,
          }}
        >
          <CornerDot
            size={18}
            color={C.violet}
            style={{ transform: `scale(${(0.4 + 0.6 * dot).toFixed(4)}) rotate(${((1 - dot) * -90).toFixed(2)}deg)`, opacity: dot }}
          />
          <div
            style={{
              fontFamily: FONT.body,
              fontWeight: 500,
              fontSize: 22,
              lineHeight: '30px',
              letterSpacing: TRACK.label,
              textTransform: 'uppercase',
            }}
          >
            <Stack>
              <Rise text="Same agent, your vocabulary" t={t} at={e0} out={o0} stagger={0.5} outStagger={0.12} outDur={6} />
              <Rise text="What the caller hears" t={t} at={e1} out={o1} stagger={0.5} outStagger={0.12} outDur={6} />
            </Stack>
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          left: x - size * 0.04,
          top: titleY,
          fontFamily: FONT.ui,
          fontWeight: 460,
          fontSize: size,
          lineHeight: 1.04,
          letterSpacing: TRACK.section,
          color: C.ink,
          whiteSpace: 'nowrap',
        }}
      >
        <Stack>
          <span>
            {/* a tight 0.35 f cascade: the title is complete ~5 f before the grid breaks.
                The swaps are ROLLS: each old glyph leaves up while its replacement
                rises from below in the same frames, so no frame is a gap. */}
            <Rise text="1" t={t} at={T.title} out={T.out} outDur={5} colorAt={() => keyCol(T.title)} />
            <Stack>
              <Rise text="6" t={t} at={T.title + 0.6} out={T.swap - 4} outDur={5} colorAt={() => keyCol(T.title)} />
              <Rise text="4" t={t} at={T.swap - 3} out={T.out + 0.3} outDur={5} colorAt={() => keyCol(T.title)} />
            </Stack>
            <span style={{ whiteSpace: 'pre' }}> </span>
            <Stack>
              <Rise text="industries." t={t} at={T.title + 1.2} out={T.swap - 3} stagger={0.35} outStagger={0.3} outDur={5} />
              <Rise text="languages." t={t} at={T.swap - 2} out={T.out + 0.6} stagger={0.3} outStagger={0.2} outDur={5} />
            </Stack>
          </span>
          <Rise text="After the call." t={t} at={T.after} stagger={0.3} />
        </Stack>
      </div>
    </>
  );
};
