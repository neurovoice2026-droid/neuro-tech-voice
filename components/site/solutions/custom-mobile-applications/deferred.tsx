import type { CSSProperties, ReactNode } from "react";
import {
  RESERVE_AT as SAAS_RESERVE_AT,
  RESERVE_TIERS,
  reserveLine,
} from "@/components/site/solutions/custom-saas-platforms/deferred";

/* ------------------------------------------------------------------ *
 * The page's content-visibility box: the SaaS page's `SaasDeferred`
 * (custom-saas-platforms/deferred.tsx) with this page's own rows, as the
 * Automations page's `AutoDeferred` is. The same `.home-deferred`
 * element and home.css's rules for it, and the same reserve that follows
 * the width inside each tier: a straight line through the box's height
 * at every width in `RESERVE_AT`, one `calc()` per tier over `100vw` in
 * that tier's `--home-cis-*` (`reserveStyle`). The line (`reserveLine`)
 * and the tiers (`RESERVE_TIERS`) are imported, not copied, so the three
 * pages draw the same line and switch where home.css switches. So are
 * the SaaS widths; this page adds some of its own, and the heights are
 * its own.
 *
 * WHY. A box's reserve is its height until it first paints, and a
 * reserve off the truth moves the page when it does: under a reader
 * scrolling back up after a reload or a Back, and past a jump on its way
 * (#server, #gate-website and #server-push are jumped to from higher up
 * the page). Text rewraps at every width, so one figure per tier is
 * exact only at the width it was taken at; the SaaS header has the
 * figures that made that page follow the width, and this page is longer
 * still: #path alone is 5,089px on a 320px phone, and #server 5,717.
 *
 * WHY 325, 330, 335, 343, 344, 350, 365, 417 AND 607. The SaaS list has
 * nothing between 320 and 340, nor between 340 and 360, nor 360 and 375,
 * and this page's phone rows bend there: #server loses 407px from 320
 * to 340, most of it by 325, and #path 255, as their narrow columns stop
 * wrapping; and 344 is where the phone stops scaling (the Frame is 312
 * there, the stage's padding leaves 280, the device's cap), so #hold and
 * everything it stacks under the phone shrink with the window below it
 * and hold above it. 344 is also where #server's cards take their full
 * padding (server.tsx), and the box grows 158px in that one pixel, so 343
 * is measured beside it: a step between two widths is a slope across
 * them. 417 and 607 are where #server and #start bend inside the SaaS
 * list's gaps (412–430, 600–639), the spec's rule: a width wherever a
 * phone row strays more than 60px from the line through its neighbours.
 * With the SaaS widths and 344 alone, the line ran up to 146px off in one
 * box (#server at 343) and the boxes above #start 216px too tall at 324
 * and 178px at 328: a reload there would have landed the reader that far
 * out. With these nine, checked every 4px from 320 to 1279, each box is
 * off its line by 3–11px on average and 57px at worst (#server at 500).
 * The test pins the list.
 *
 * MEASURED, NOT GUESSED, and any change to a section's height changes
 * its row. Each row is that box's height at each width in `RESERVE_AT`,
 * with ?tier=full, in a window 800px tall, as it first paints: #hold at
 * its finished frame (the lock screen, the reminder arrived; from lg its
 * phone is sized by the window's height too, 256px at 800, and
 * `HOLD_BY_HEIGHT` carries its row to other heights); #kinds on Bookings · Your
 * customers; #checks on "All"; every index and FAQ row closed. Each
 * includes the box's trailing Gap (and, for #path, its wash band's own
 * padding; for #terms, the Rule and the Gap above them), and holds 49
 * heights in `RESERVE_AT` order: 31 for the phone tier (320…767), 9 for
 * md (768…1023), 8 for lg (1024…1279) and 1 for xl, where the Frame is
 * capped and nothing rewraps. Taken by the SaaS method: every box
 * painted at once, with reduced motion so #hold stays at its finished
 * frame, and the window resized through the list; then every width from
 * 320 to 1440 checked against the line the rows draw.
 *
 * WHAT NO RESERVE KNOWS, and why nothing needs one:
 *   · #hold is built never to grow (spec §2.3): the device has a fixed
 *     aspect and holds its sheet, dialog and notification inside it, the
 *     caption is a stack as tall as its tallest frame, the rail, the lane
 *     and the chips have fixed rows, and the drawing has a fixed aspect.
 *     So its box is the same height before, during and after a tour, and
 *     after a platform switch, and a reload or a Back from a reader who
 *     watched the tour lands where it should.
 *   · #kinds changes height only on the reader's own pick, and a shift
 *     within half a second of a reader's input is excused from the
 *     layout-shift score. Its row is its first paint.
 *   · The owner switch (`PUBLISHED_APPS`, lib/pages/custom-mobile-
 *     applications.ts) changes words in the hero, #path, #checks, the
 *     FAQ and the credits, and with them their heights. The rows say
 *     what they were measured with (`RESERVES_MEASURED_WITH`), and the
 *     test fails until the page is measured again with the apps named.
 * The rest is caught as it happens, by the SaaS shell this page renders
 * in: a page that arrives part-way down paints the boxes above it at
 * once, while the reader is still, and scroll anchoring holds the screen
 * (settle.tsx); every same-page jump gets one more look once it has
 * settled (jumps.tsx).
 * ------------------------------------------------------------------ */

/** This page's own widths, where its phone rows bend between the SaaS page's (above): 344 is where the phone stops scaling, and 343 the pixel before #server's cards widen their padding. */
const OWN_AT = [325, 330, 335, 343, 344, 350, 365, 417, 607] as const;

/** Where every reserve is measured: the SaaS page's widths and this page's own, in order. */
export const RESERVE_AT: readonly number[] = [...SAAS_RESERVE_AT, ...OWN_AT].sort((a, b) => a - b);

/** Each box's height at every width in `RESERVE_AT`, laid out as it is: a line per tier. Measured (above). */
// 49 widths: 320, 325, 330, 335, 340, 343, 344, 350, 360, 365, 375, 390, 393, 402, 412, 417, 430, 440, 460, 480, 510, 540, 570, 600, 607, 639, 640, 670, 700, 744, 767 |
//            768, 800, 820, 834, 870, 900, 950, 1000, 1023 | 1024, 1050, 1080, 1112, 1150, 1180, 1230, 1279 | 1280
// prettier-ignore
export const RESERVES = {
  hold: [
    3063, 3073, 3065, 3076, 3086, 3067, 3051, 3029, 3007, 2989, 2989, 2939, 2939, 2903, 2887, 2873, 2833, 2833, 2815, 2765, 2740, 2740, 2697, 2679, 2679, 2654, 2679, 2654, 2618, 2618, 2596,
    1921, 1881, 1849, 1849, 1831, 1785, 1785, 1767, 1767,
    1732, 1732, 1718, 1718, 1718, 1700, 1700, 1700,
    1700,
  ],
  kinds: [
    2762, 2667, 2650, 2628, 2628, 2612, 2612, 2576, 2551, 2482, 2464, 2410, 2410, 2410, 2410, 2410, 2318, 2318, 2293, 2293, 2272, 2224, 2224, 2199, 2163, 2163, 2163, 2163, 2163, 2163, 2163,
    1834, 1834, 1740, 1740, 1740, 1718, 1718, 1718, 1718,
    1646, 1646, 1646, 1646, 1646, 1646, 1646, 1646,
    1586,
  ],
  path: [
    5089, 5029, 4999, 4940, 4834, 4834, 4812, 4756, 4734, 4712, 4653, 4557, 4557, 4517, 4470, 4426, 4337, 4294, 4294, 4206, 4122, 4053, 4053, 4010, 4010, 3941, 3903, 3859, 3859, 3805, 3805,
    4702, 4666, 4628, 4628, 4588, 4544, 4440, 4418, 4400,
    3660, 3659, 3627, 3571, 3560, 3537, 3527, 3510,
    3510,
  ],
  server: [
    5717, 5488, 5426, 5354, 5310, 5268, 5426, 5362, 5188, 5103, 4995, 4889, 4827, 4761, 4696, 4594, 4576, 4492, 4284, 4222, 4051, 3941, 3853, 3795, 3759, 3668, 3690, 3646, 3548, 3486, 3486,
    2856, 2780, 2714, 2652, 2632, 2590, 2544, 2480, 2480,
    2220, 2198, 2160, 2138, 2114, 2088, 2014, 2014,
    2014,
  ],
  team: [
    1429, 1429, 1429, 1429, 1407, 1407, 1407, 1385, 1347, 1347, 1347, 1347, 1303, 1249, 1233, 1233, 1211, 1211, 1186, 1164, 1124, 1124, 1124, 1124, 1124, 1124, 1124, 1124, 1124, 1124, 1088,
     868,  868,  868,  868,  846,  846,  846,  846,  800,
     840,  772,  728,  728,  728,  712,  712,  712,
     712,
  ],
  terms: [
    1984, 1984, 1963, 1963, 1942, 1942, 1942, 1942, 1942, 1921, 1900, 1831, 1810, 1810, 1810, 1753, 1732, 1690, 1648, 1648, 1604, 1520, 1474, 1453, 1453, 1432, 1432, 1432, 1411, 1369, 1348,
    1454, 1389, 1347, 1347, 1335, 1326, 1272, 1272, 1226,
    1272, 1226, 1226, 1184, 1184, 1184, 1163, 1163,
    1001,
  ],
  checks: [
    2672, 2672, 2650, 2628, 2628, 2628, 2628, 2603, 2563, 2563, 2545, 2498, 2480, 2480, 2386, 2386, 2364, 2302, 2262, 2219, 2201, 2154, 2154, 2132, 2092, 2070, 2070, 2070, 2027, 2009, 1933,
    1990, 1965, 1965, 1965, 1940, 1940, 1940, 1915, 1847,
    1838, 1779, 1755, 1749, 1687, 1671, 1655, 1655,
    1655,
  ],
  faq: [
    1587, 1557, 1557, 1529, 1501, 1501, 1501, 1473, 1417, 1417, 1417, 1389, 1389, 1389, 1333, 1333, 1333, 1269, 1241, 1241, 1213, 1213, 1157, 1129, 1129, 1129, 1129, 1129, 1129, 1129, 1129,
    1187, 1187, 1187, 1187, 1187, 1187, 1187, 1187, 1187,
    1093, 1093, 1065, 1009, 1009, 1009, 1009, 1009,
    1009,
  ],
  start: [
    2489, 2453, 2453, 2417, 2417, 2417, 2417, 2320, 2302, 2284, 2208, 2154, 2154, 2129, 2129, 2111, 2093, 2093, 2057, 2003, 1985, 1931, 1895, 1895, 1819, 1819, 1763, 1763, 1745, 1727, 1709,
    1543, 1525, 1507, 1507, 1507, 1489, 1489, 1435, 1435,
    1499, 1499, 1499, 1481, 1463, 1427, 1427, 1427,
    1431,
  ],
} as const satisfies Record<string, readonly number[]>;

/**
 * What the rows were measured with, beyond the page's words: how many
 * apps `PUBLISHED_APPS` named. Naming apps adds a hero proof, a card in
 * #path, a checks row, an FAQ sentence and a credits item, so the test
 * holds this to `PUBLISHED_APPS?.length ?? 0` and fails until the page
 * is measured again.
 */
export const RESERVES_MEASURED_WITH = { publishedApps: 0 } as const;

export type MobReserveId = keyof typeof RESERVES;

/** Every tier's line through one box's row, over this page's widths: the style its box carries (the SaaS `reserveStyle`, with `RESERVE_AT` this page's). */
export function reserveStyle(heights: readonly number[]): CSSProperties {
  return Object.fromEntries(
    RESERVE_TIERS.map(([name, lo, hi]) => [
      name,
      reserveLine(RESERVE_AT.flatMap((w, i) => (w >= lo && w <= hi ? [[w, heights[i]] as const] : []))),
    ]),
  ) as CSSProperties;
}

/**
 * #hold's one height that follows the screen's height too. From lg the
 * phone's column is sized by the screen's height as well as its width
 * (mob-hold.css §1: never under 256px, and 256px on the 800px-tall window
 * the rows are measured in, and on any under about 855), and #hold grows
 * about 1.35px for every pixel the phone widens past 256 — 2.05 of
 * height, less the platform line and the hint, which wrap less beside a
 * wider phone, and less the drawing's key where it moves into the band
 * beside the drawing. Measured at 1230–1920: +7px at 880px tall, +27 at
 * 900, +55 at 950, +87 from 1000, where the phone reaches its 318px; the
 * term is within 10px of each, and of 1024–1150's (0 to +55).
 */
const HOLD_BY_HEIGHT = "1.35 * (clamp(256px, min(25vw + 4px, (100svh - 330px) / 2.05), 318px) - 256px)";

/** Every tier's line through one box's row, and for #hold from lg the phone's growth with the screen's height. */
function boxStyle(box: MobReserveId): CSSProperties {
  const style = reserveStyle(RESERVES[box]) as Record<string, string>;
  if (box !== "hold") return style;
  const grown = (line: string) => `calc(${line} + ${HOLD_BY_HEIGHT})`;
  return { ...style, "--home-cis-lg": grown(style["--home-cis-lg"]), "--home-cis-xl": grown(style["--home-cis-xl"]) } as CSSProperties;
}

/**
 * A section below the cover, in a content-visibility box holding `box`'s
 * reserve. `mob-deferred` gives its mono a fallback as wide as the face
 * (mob.css §6), so the face's late swap never rewraps a line under a
 * reader who landed deep in the page.
 */
export function MobDeferred({ box, children }: { box: MobReserveId; children: ReactNode }) {
  return (
    <div className="home-deferred mob-deferred" data-box={box} style={boxStyle(box)}>
      {children}
    </div>
  );
}
