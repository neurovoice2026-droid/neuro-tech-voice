import type { CSSProperties, ReactNode } from "react";
import {
  RESERVE_AT as SAAS_RESERVE_AT,
  RESERVE_TIERS,
  reserveLine,
} from "@/components/site/solutions/custom-saas-platforms/deferred";

/* ------------------------------------------------------------------ *
 * The page's content-visibility box: the SaaS page's `SaasDeferred`
 * (custom-saas-platforms/deferred.tsx), with this page's own rows. The
 * same `.home-deferred` element and home.css's rules for it, and the
 * same reserve that follows the width inside each tier: a straight line
 * through the box's height measured at every width in `RESERVE_AT`, one
 * `calc()` per tier over `100vw` in that tier's `--home-cis-*`
 * (`reserveStyle`). The line (`reserveLine`) and the tiers
 * (`RESERVE_TIERS`) are imported, not copied, so the two pages draw the
 * same line and switch where home.css switches. So are the SaaS widths;
 * this page adds three of its own between two of them, and the heights
 * are its own.
 *
 * WHY. A box's reserve is its height until it first paints, and a
 * reserve off the truth moves the page when it does: under a reader
 * scrolling back up after a reload or a Back, and past a jump on its way.
 * Text rewraps at every width, so one figure per tier is exact only at
 * the width it was taken at; the SaaS header has the figures (a reload
 * 639px off at 360, a CLS up to 1.8 below md) that made that page follow
 * the width, and this page is longer still.
 *
 * WHY 325, 330 AND 335. The SaaS list has nothing between 320 and 340,
 * and this page's phone rows bend there: #work loses 99px from 320 to
 * 330 and nothing more by 340, #breaks 106px from 325 to 330. A line
 * from 320 straight to 340 leaves the boxes above #start 104px too tall
 * at 330; when it was first measured (94px then), a reload there landed
 * the reader 99px low (a CLS of 0.12–0.14, over 0.1 from 329 to 333),
 * and a jump to #build, #team, #start or #faq scored up to 0.14 as it
 * settled. 330 alone moved the error to 322–328; with all three, the
 * boxes above #start are at most 49px off anywhere from 321 to 339
 * (at 337), and exact at 325, 330 and 335.
 *
 * MEASURED, NOT GUESSED, and any change to a section's height changes
 * its row. Each row is that box's height at each width in `RESERVE_AT`,
 * with ?tier=full, as it first paints: the workbench on "A customer
 * pays" at its finished frame, before a tour; #work on Finance · A
 * process; #breaks on "Down all night"; #checks on "All"; the
 * workbench's index, the samples' index, the results' index and every
 * FAQ row closed. Each includes the box's trailing Gap (and, for #build,
 * its wash band's own padding; for #terms, the Rule and the Gap above
 * them), and holds 43 heights in `RESERVE_AT` order: 25 for the phone
 * tier (320…767), 9 for md (768…1023), 8 for lg (1024…1279) and 1 for
 * xl, where the Frame is capped and nothing rewraps. Taken by the SaaS
 * method: every box painted at once, with reduced motion so the
 * workbench stays at its first paint, and the window resized through
 * the list. A fresh load with motion on paints every box to the pixel
 * of its row (checked at 320, 325, 330, 335, 390, 768, 1024 and 1440),
 * and the workbench's box holds that height through a whole tour.
 * lib/pages/custom-automations.test.ts holds the rows to the page's
 * boxes, in order, each a positive height at every width.
 *
 * WHAT IT IS OFF BY. Exact at every width in the list. Between them text
 * wraps in steps and the line runs across them: over every width from
 * 320 to 1279, 5px per box on average, and at worst 70px next to a step
 * (#checks at 411). The first guesses these rows replaced, built from
 * the SaaS rows and the composition, were 185px off per box on average
 * and up to 775px (the workbench at 330): below md this page's
 * instruments are far taller than the SaaS page's.
 *
 * WHAT NO RESERVE KNOWS, and why nothing needs one:
 *   · The workbench is built not to grow once its tour starts (spec
 *     §5.2.4): the caption is a stack as tall as its longest line, the
 *     list below xl is as tall as the lens's rows whatever the tour has
 *     reached, the map at xl is as tall as its lens's rows and fixed while the
 *     lens is, the sticky inspector is shorter than the run log beside it
 *     from md, and below md it does not follow a tour (it follows only
 *     the reader's own step). So, unlike the SaaS explorer's, its
 *     reserve holds after a tour too, and a reload or a Back from a
 *     reader who watched one lands where it should. The measure pass
 *     checks that the box is the same height before and after a tour.
 *   · #work and #breaks change height only on the reader's own pick (a
 *     field and a level, a scenario), and a shift within half a second of
 *     a reader's input is excused from the layout-shift score. Their rows
 *     are their first paint.
 * The rest is caught as it happens, by the SaaS shell this page renders
 * in: a page that arrives part-way down paints the boxes above it at
 * once, while the reader is still, and scroll anchoring holds the screen
 * (settle.tsx); every same-page jump gets one more look once it has
 * settled (jumps.tsx).
 * ------------------------------------------------------------------ */

/** This page's own widths, between the SaaS page's 320 and 340, where its phone rows bend. */
const OWN_AT = [325, 330, 335] as const;

/** Where every reserve is measured: the SaaS page's widths and this page's own, in order. */
export const RESERVE_AT: readonly number[] = [...SAAS_RESERVE_AT, ...OWN_AT].sort((a, b) => a - b);

/** Each box's measured height at every width in `RESERVE_AT`, laid out as it is: a line per tier. */
// prettier-ignore
export const RESERVES = {
  running: [
    5130, 5048, 4976, 4940, 4876, 4800, 4739, 4599, 4599, 4571, 4524, 4470, 4430, 4376, 4315, 4207, 4129, 4057, 3994, 3972, 3994, 3972, 3954, 3936, 3896,
    3054, 3012, 2994, 2976, 2976, 2976, 2924, 2888, 2888,
    2808, 2762, 2762, 2762, 2762, 2708, 2652, 2652,
    2577,
  ],
  work: [
    3242, 3181, 3143, 3143, 3143, 3029, 2993, 2892, 2892, 2872, 2852, 2780, 2758, 2633, 2569, 2523, 2503, 2503, 2460, 2384, 2438, 2362, 2308, 2290, 2272,
    2065, 2043, 2025, 2025, 1964, 1918, 1899, 1837, 1837,
    1823, 1801, 1779, 1757, 1757, 1757, 1733, 1715,
    1675,
  ],
  breaks: [
    3211, 3186, 3080, 3044, 3026, 2925, 2795, 2741, 2741, 2741, 2723, 2642, 2624, 2588, 2570, 2532, 2469, 2415, 2397, 2397, 2397, 2379, 2341, 2341, 2305,
    2327, 2291, 2251, 2251, 2251, 2251, 2251, 2251, 2251,
    1820, 1800, 1800, 1800, 1800, 1800, 1800, 1800,
    1624,
  ],
  team: [
    1429, 1429, 1429, 1429, 1385, 1347, 1347, 1325, 1303, 1285, 1269, 1247, 1200, 1164, 1164, 1124, 1124, 1124, 1124, 1124, 1124, 1124, 1124, 1124, 1124,
     868,  868,  868,  868,  868,  846,  846,  846,  846,
     840,  796,  774,  774,  728,  712,  712,  690,
     690,
  ],
  build: [
    2696, 2674, 2634, 2576, 2554, 2466, 2404, 2281, 2259, 2259, 2237, 2193, 2171, 2149, 2053, 1985, 1905, 1883, 1817, 1817, 1817, 1817, 1817, 1795, 1795,
    2007, 2007, 1985, 1985, 1985, 1985, 1963, 1963, 1941,
    1481, 1481, 1459, 1415, 1415, 1415, 1375, 1375,
    1375,
  ],
  terms: [
    1940, 1940, 1919, 1875, 1875, 1724, 1640, 1640, 1619, 1619, 1619, 1520, 1520, 1520, 1499, 1453, 1367, 1367, 1367, 1281, 1323, 1281, 1260, 1239, 1239,
    1324, 1303, 1282, 1282, 1240, 1240, 1240, 1219, 1152,
    1219, 1173, 1152, 1131, 1110, 1110, 1110, 1110,
     957,
  ],
  checks: [
    2594, 2572, 2572, 2572, 2554, 2489, 2489, 2428, 2428, 2428, 2330, 2308, 2286, 2188, 2163, 2145, 2098, 2076, 2076, 2058, 2058, 2058, 2015, 2015, 1979,
    2036, 2011, 2011, 2011, 1986, 1968, 1968, 1943, 1875,
    1799, 1777, 1755, 1755, 1693, 1659, 1659, 1643,
    1643,
  ],
  faq: [
    1531, 1473, 1445, 1445, 1417, 1389, 1361, 1361, 1361, 1361, 1361, 1361, 1325, 1297, 1241, 1185, 1185, 1157, 1157, 1157, 1157, 1157, 1157, 1157, 1129,
    1215, 1187, 1187, 1187, 1187, 1187, 1187, 1187, 1187,
    1065, 1065, 1037, 1037, 1037, 1037, 1037, 1009,
    1009,
  ],
  start: [
    2024, 1970, 1952, 1909, 1891, 1855, 1837, 1819, 1819, 1776, 1758, 1740, 1700, 1664, 1646, 1646, 1592, 1574, 1574, 1502, 1464, 1446, 1446, 1446, 1428,
    1394, 1376, 1358, 1358, 1340, 1322, 1322, 1304, 1304,
    1368, 1368, 1368, 1350, 1332, 1332, 1332, 1332,
    1300,
  ],
} as const satisfies Record<string, readonly number[]>;

export type AutoReserveId = keyof typeof RESERVES;

/** Every tier's line through one box's row, over this page's widths: the style its box carries (the SaaS `reserveStyle`, with `RESERVE_AT` this page's). */
export function reserveStyle(heights: readonly number[]): CSSProperties {
  return Object.fromEntries(
    RESERVE_TIERS.map(([name, lo, hi]) => [
      name,
      reserveLine(RESERVE_AT.flatMap((w, i) => (w >= lo && w <= hi ? [[w, heights[i]] as const] : []))),
    ]),
  ) as CSSProperties;
}

/** A section below the cover, in a content-visibility box holding `box`'s reserve. */
export function AutoDeferred({ box, children }: { box: AutoReserveId; children: ReactNode }) {
  return (
    <div className="home-deferred" style={reserveStyle(RESERVES[box])}>
      {children}
    </div>
  );
}
