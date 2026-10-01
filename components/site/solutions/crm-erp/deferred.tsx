import type { CSSProperties, ReactNode } from "react";
import {
  RESERVE_AT as SAAS_RESERVE_AT,
  RESERVE_TIERS,
  reserveLine,
} from "@/components/site/solutions/custom-saas-platforms/deferred";

/* ------------------------------------------------------------------ *
 * The page's content-visibility box: the SaaS page's `SaasDeferred`
 * (custom-saas-platforms/deferred.tsx) with this page's own rows, as the
 * Automations page's `AutoDeferred` and the Mobile page's `MobDeferred`
 * are. The same `.home-deferred` element and home.css's rules for it,
 * and the same reserve that follows the width inside each tier: a
 * straight line through the box's height at every width in `RESERVE_AT`,
 * one `calc()` per tier over `100vw` in that tier's `--home-cis-*`
 * (`reserveStyle`). The line (`reserveLine`) and the tiers
 * (`RESERVE_TIERS`) are imported, not copied, so the four pages draw the
 * same line and switch where home.css switches. So are the SaaS widths;
 * this page adds some of its own, and the heights are its own.
 *
 * WHY. A box's reserve is its height until it first paints, and a
 * reserve off the truth moves the page when it does: under a reader
 * scrolling back up after a reload or a Back, and past a jump on its way
 * (the hero jumps to #process, #core and #team, #process's captions to
 * each #core card, #checks back up to #ledger) or a shared link landing
 * deep (#core-yours, #connect, #whose). Text rewraps at every width, so
 * one figure per tier is exact only at the width it was taken at, and
 * this page's phone rows are its longest: #core is 7,381px on a 320px
 * phone, #shape 5,452 and #move 4,998.
 *
 * WHY 331, 332, 346, 359, 520, 623, 624, 720 AND 920. The SaaS list has
 * nothing between 320 and 340, 340 and 360, 510 and 540, 600 and 639,
 * 700 and 744, or 900 and 950, and this page's rows turn inside each of
 * those gaps. Three of them step in one pixel, so each is measured on
 * both sides (a step between two widths is a slope across them): #shape
 * loses 22px from 331 to 332, as the card's title and the ledger's lead
 * each take a line fewer; #core gains 176px from 359 to 360, where its
 * nine cards take their full padding (core.tsx); and #process loses
 * 274px from 623 to 624, where the record window sets its screen beside
 * the customer's history (erp-process.css §4: the panel reaches 560px
 * there; under it the two stack, since beside each other a narrower
 * window wrapped half the history's rows). 346, 520, 720 and 920 are
 * where #process and #core bend inside a gap (at 520, #core's cards'
 * lines give way one after another between 510 and 540; at 920, 108px of
 * them from 900, 46 of it from 918: bends, not steps), the spec's rule:
 * a width wherever a row strays more than 60px from the line through its
 * neighbours. With the SaaS widths and the spec's first guesses (330,
 * 350) the line ran 164px off in #process at the window's step, 111px in
 * #core at 356 and 70px in #shape at 332: a reload there would have
 * landed the reader that far out; without 520, #core ran 77px off at
 * 520, and without 920, 65px at 920. With these nine, checked every 4px
 * from 320 to 1279, each box is off its line by 3–13px on average and
 * 56px at worst (#checks at 408). The test pins the list.
 *
 * MEASURED, NOT GUESSED, and any change to a section's height changes
 * its row. Each row is that box's height at each width in `RESERVE_AT`,
 * with ?tier=full, in a window 800px tall (so from lg #process has the
 * short screen's stage: `PROCESS_BY_HEIGHT` below carries it to a taller
 * one), as it first paints: #process at
 * its finished frame (One system, step 08 arrived, the record window on
 * "This month"); #shape on Wholesale · Operations; #checks on "All";
 * every index, `<details>` and FAQ row closed. Each includes the box's
 * trailing Gap (and, for #move, its wash band's own padding; for #terms,
 * the Rule and the Gap above them), and holds 49 heights in `RESERVE_AT`
 * order: 30 for the phone tier (320…767), 10 for md (768…1023), 8 for lg
 * (1024…1279) and 1 for xl, where the Frame is capped and nothing
 * rewraps. Taken by the SaaS method: every box painted at once, with
 * reduced motion so #process stays at its finished frame, and the window
 * resized through the list; then every width from 320 to 1440 checked
 * against the line the rows draw.
 *
 * WHAT NO RESERVE KNOWS, and why nothing needs one:
 *   · #process is built never to grow (spec §2.3): the lanes drawing
 *     has a fixed aspect, the list and the pile are both 512px, the
 *     caption card lays the intro over stacks of every step's words, as
 *     tall as the tallest, and its "Who" keeps both its words' room, the record
 *     panel a stack over its two views, the window's screen a stack over
 *     its eight screens and its history always eight rows, and the
 *     controls row keeps "Start again"'s slot before it shows. So its
 *     box is the same height before, during and after a tour, and in
 *     either view, and a reload or a Back from a reader who watched the
 *     tour lands where it should.
 *   · #shape changes height only on the reader's own pick (a part's
 *     "why" rewrapping), and a shift within half a second of a reader's
 *     input is excused from the layout-shift score. Its row is its first
 *     paint.
 *   · One thing on the page follows the window's height: from lg,
 *     #process's stage on a screen 900px tall or less draws its lanes
 *     880px wide at most, the legend beside them where there is room
 *     (erp-process.css §1), and the rows are measured there; a taller
 *     screen keeps the stage's full width, and `PROCESS_BY_HEIGHT`
 *     adds what that costs, as the Mobile page's #hold carries its
 *     phone's growth.
 * The rest is caught as it happens, by the SaaS shell this page renders
 * in: a page that arrives part-way down paints the boxes above it at
 * once, while the reader is still, and scroll anchoring holds the screen
 * (settle.tsx); every same-page jump gets one more look once it has
 * settled (jumps.tsx).
 * ------------------------------------------------------------------ */

/** This page's own widths, between the SaaS page's where its rows step or bend (above). */
const OWN_AT = [331, 332, 346, 359, 520, 623, 624, 720, 920] as const;

/** Where every reserve is measured: the SaaS page's widths and this page's own, in order. */
export const RESERVE_AT: readonly number[] = [...SAAS_RESERVE_AT, ...OWN_AT].sort((a, b) => a - b);

/** Each box's height at every width in `RESERVE_AT`, in page order, laid out as it is: a line per tier. */
// 49 widths: 320, 331, 332, 340, 346, 359, 360, 375, 390, 393, 402, 412, 430, 440, 460, 480, 510, 520, 540, 570, 600, 623, 624, 639, 640, 670,
//            700, 720, 744, 767 | 768, 800, 820, 834, 870, 900, 920, 950, 1000, 1023 | 1024, 1050, 1080, 1112, 1150, 1180, 1230, 1279 | 1280
// prettier-ignore
export const RESERVES = {
  process: [
    2778, 2739, 2739, 2687, 2626, 2626, 2626, 2594, 2559, 2534, 2514, 2479, 2479, 2479, 2418, 2392, 2392, 2392, 2384, 2359, 2359, 2339, 2065, 2059, 2065, 2059, 2059, 2059, 2059, 2059,
    1688, 1684, 1684, 1684, 1684, 1684, 1684, 1684, 1684, 1684,
    1468, 1452, 1452, 1447, 1401, 1389, 1349, 1349,
    1366,
  ],
  shape: [
    5452, 5369, 5347, 5347, 5295, 5149, 5127, 5086, 5039, 5039, 5017, 4979, 4716, 4596, 4542, 4433, 4357, 4335, 4335, 4307, 4263, 4238, 4238, 4238, 4238, 4238, 4238, 4216, 4216, 4172,
    3940, 3918, 3898, 3898, 3898, 3854, 3854, 3810, 3744, 3722,
    2937, 2867, 2865, 2865, 2843, 2843, 2821, 2821,
    2821,
  ],
  move: [
    4998, 4897, 4881, 4872, 4862, 4808, 4810, 4764, 4706, 4696, 4693, 4646, 4562, 4532, 4497, 4395, 4312, 4291, 4218, 4196, 4106, 4023, 4023, 4023, 4023, 4001, 4001, 4001, 4001, 4001,
    3429, 3443, 3451, 3457, 3451, 3430, 3420, 3418, 3420, 3430,
    3005, 3016, 3007, 2920, 2926, 2917, 2916, 2908,
    2908,
  ],
  core: [
    7381, 7069, 7069, 6978, 6892, 6624, 6800, 6508, 6215, 6193, 6037, 5889, 5705, 5521, 5390, 5212, 5092, 5074, 4807, 4709, 4629, 4545, 4545, 4505, 4545, 4447, 4407, 4313, 4313, 4225,
    3626, 3562, 3484, 3468, 3446, 3352, 3244, 3244, 3144, 3080,
    3009, 2969, 2903, 2881, 2782, 2734, 2674, 2598,
    2498,
  ],
  team: [
    1520, 1520, 1520, 1476, 1454, 1416, 1416, 1416, 1416, 1394, 1318, 1255, 1233, 1233, 1233, 1233, 1193, 1193, 1193, 1124, 1124, 1124, 1124, 1124, 1124, 1124, 1124, 1124, 1124, 1088,
     890,  890,  890,  890,  868,  868,  868,  868,  846,  800,
     862,  794,  770,  750,  750,  726,  712,  712,
     712,
  ],
  terms: [
    2003, 1982, 1982, 1961, 1919, 1894, 1894, 1852, 1852, 1831, 1810, 1810, 1751, 1709, 1600, 1579, 1514, 1472, 1472, 1407, 1407, 1407, 1386, 1365, 1386, 1365, 1365, 1323, 1302, 1302,
    1425, 1404, 1383, 1362, 1362, 1362, 1320, 1299, 1278, 1211,
    1278, 1211, 1211, 1125, 1125, 1125, 1125, 1125,
     930,
  ],
  checks: [
    2897, 2897, 2897, 2853, 2835, 2773, 2773, 2726, 2701, 2701, 2701, 2571, 2571, 2505, 2440, 2422, 2360, 2360, 2277, 2277, 2277, 2233, 2233, 2233, 2233, 2215, 2215, 2193, 2193, 2157,
    2189, 2146, 2124, 2124, 2099, 2099, 2099, 2099, 2077, 2009,
    1955, 1933, 1897, 1891, 1847, 1831, 1793, 1775,
    1775,
  ],
  faq: [
    1587, 1529, 1529, 1529, 1501, 1501, 1501, 1445, 1417, 1417, 1417, 1417, 1361, 1325, 1297, 1241, 1213, 1213, 1213, 1213, 1157, 1157, 1157, 1129, 1157, 1129, 1129, 1129, 1129, 1129,
    1187, 1187, 1187, 1187, 1187, 1187, 1187, 1187, 1187, 1187,
    1093, 1093, 1093, 1037, 1037, 1009, 1009, 1009,
    1009,
  ],
  start: [
    2232, 2160, 2160, 2160, 2117, 2081, 2081, 2045, 1984, 1944, 1944, 1908, 1890, 1890, 1854, 1854, 1818, 1800, 1764, 1746, 1746, 1710, 1710, 1710, 1654, 1636, 1596, 1596, 1542, 1542,
    1489, 1453, 1453, 1453, 1417, 1417, 1417, 1417, 1417, 1417,
    1481, 1481, 1463, 1427, 1409, 1409, 1409, 1409,
    1395,
  ],
} as const satisfies Record<string, readonly number[]>;

export type ErpReserveId = keyof typeof RESERVES;

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
 * #process's height past a 900px-tall screen, from lg: the stage's lanes
 * at its full width (0.272 of it, where the short screen's stop at 880px:
 * 239) and, from 1208px, where the short screen's legend stands beside
 * the lanes, the legend's own row (40px) back. Measured at 800 and 1000px
 * tall: +5 at 1024, +54 at 1207, +95 at 1208, +108 at 1260–1279, +103 from
 * xl; the line is within 3px of each. Nought at 900px or less, and the
 * whole of it from 901: `(100vh - 900px) * 1000` is a step, not a slope.
 */
const PROCESS_BY_HEIGHT = {
  lg: reserveLine([
    [1024, 5],
    [1207, 54],
    [1208, 95],
    [1260, 108],
  ]),
  xl: "103px",
} as const;

/** A length that is nought on a screen 900px tall or less, and `len` on a taller one. */
const pastShort = (len: string) => `min(${len}, max(0px, (100vh - 900px) * 1000))`;

/** Every tier's line through one box's row, and for #process from lg its height past a short screen. */
function boxStyle(box: ErpReserveId): CSSProperties {
  const style = reserveStyle(RESERVES[box]) as Record<string, string>;
  if (box !== "process") return style;
  const grown = (line: string, by: string) => `calc(${line} + ${pastShort(by)})`;
  return {
    ...style,
    "--home-cis-lg": grown(style["--home-cis-lg"], PROCESS_BY_HEIGHT.lg),
    "--home-cis-xl": grown(style["--home-cis-xl"], PROCESS_BY_HEIGHT.xl),
  } as CSSProperties;
}

/**
 * A section below the cover, in a content-visibility box holding `box`'s
 * reserve. `erp-deferred` gives its mono a fallback as wide as the face
 * (erp.css §6), so the face's late swap never rewraps a line under a
 * reader who landed deep in the page.
 */
export function ErpDeferred({ box, children }: { box: ErpReserveId; children: ReactNode }) {
  return (
    <div className="home-deferred erp-deferred" data-box={box} style={boxStyle(box)}>
      {children}
    </div>
  );
}
