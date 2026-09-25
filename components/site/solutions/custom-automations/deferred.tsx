import type { ReactNode } from "react";
import { RESERVE_AT, reserveStyle } from "@/components/site/solutions/custom-saas-platforms/deferred";

/* ------------------------------------------------------------------ *
 * The page's content-visibility box: the SaaS page's `SaasDeferred`
 * (custom-saas-platforms/deferred.tsx), with this page's own rows. The
 * same `.home-deferred` element and home.css's rules for it, and the
 * same reserve that follows the width inside each tier: a straight line
 * through the box's height measured at every width in `RESERVE_AT`, one
 * `calc()` per tier over `100vw` in that tier's `--home-cis-*`
 * (`reserveStyle`). The widths, the line and the tiers are imported, not
 * copied, so the two pages measure at the same points and switch where
 * home.css switches; only the heights are this page's.
 *
 * WHY. A box's reserve is its height until it first paints, and a
 * reserve off the truth moves the page when it does: under a reader
 * scrolling back up after a reload or a Back, and past a jump on its way.
 * Text rewraps at every width, so one figure per tier is exact only at
 * the width it was taken at; the SaaS header has the figures (a reload
 * 639px off at 360, a CLS up to 1.8 below md) that made that page follow
 * the width, and this page is longer still.
 *
 * MEASURED, NOT GUESSED, and any change to a section's height changes
 * its row. Each row is that box's height at each width in `RESERVE_AT`,
 * with ?tier=full, as it first paints: the workbench on "A customer
 * pays" at its finished frame, before a tour; #work on Finance · A
 * process; #breaks on "Down all night"; #checks on "All"; the
 * workbench's index, the samples' index, the results' index and every
 * FAQ row closed. Each includes the box's trailing Gap (and, for #build,
 * its wash band's own padding; for #terms, the Rule and the Gap above
 * them), and holds 40 heights in `RESERVE_AT` order: 22 for the phone
 * tier (320…767), 9 for md (768…1023), 8 for lg (1024…1279) and 1 for
 * xl, where the Frame is capped and nothing rewraps. Taken by the SaaS
 * method: every box painted at once, with reduced motion so the
 * workbench stays at its first paint, and the window resized through
 * the list. A fresh load with motion on paints every box to the pixel
 * of its row (checked at 320, 390, 768, 1024 and 1440), and the
 * workbench's box holds that height through a whole tour.
 * lib/pages/custom-automations.test.ts holds the rows to the page's
 * boxes, in order, each a positive height at every width.
 *
 * WHAT IT IS OFF BY. Exact at every width in the list. Between them text
 * wraps in steps and the line runs across them: over 18 widths between
 * the points, from 330 to 1260, 9px per box on average, and at worst
 * 60px next to a step (#breaks at 355). The first guesses these rows
 * replaced, built from the SaaS rows and the composition, were 185px off
 * per box on average and up to 775px (the workbench at 330): below md
 * this page's instruments are far taller than the SaaS page's.
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

export { RESERVE_AT };

/** Each box's measured height at every width in `RESERVE_AT`, laid out as it is: a line per tier. */
// prettier-ignore
export const RESERVES = {
  running: [
    4815, 4631, 4549, 4441, 4388, 4366, 4338, 4316, 4262, 4226, 4154, 4136, 4057, 4001, 3907, 3869, 3833, 3851, 3833, 3833, 3833, 3811,
    2997, 2953, 2935, 2919, 2919, 2901, 2831, 2831, 2831,
    2749, 2703, 2703, 2685, 2685, 2685, 2613, 2613,
    2568,
  ],
  work: [
    3348, 3310, 3214, 3137, 3079, 3061, 3023, 2985, 2949, 2927, 2820, 2756, 2710, 2647, 2647, 2629, 2553, 2571, 2531, 2477, 2477, 2477,
    2162, 2122, 2122, 2122, 2079, 2033, 2014, 1970, 1970,
    1956, 1934, 1912, 1890, 1890, 1890, 1866, 1812,
    1812,
  ],
  breaks: [
    3159, 2992, 2888, 2804, 2732, 2732, 2714, 2696, 2617, 2599, 2581, 2563, 2507, 2444, 2390, 2372, 2372, 2372, 2336, 2316, 2316, 2280,
    2302, 2284, 2244, 2244, 2244, 2226, 2226, 2226, 2226,
    1799, 1779, 1779, 1779, 1775, 1775, 1775, 1775,
    1599,
  ],
  team: [
    1404, 1360, 1322, 1322, 1300, 1278, 1260, 1244, 1222, 1200, 1164, 1164, 1124, 1099, 1099, 1099, 1099, 1099, 1099, 1099, 1099, 1099,
     927,  883,  865,  865,  843,  843,  843,  843,  821,
     833,  815,  815,  815,  725,  703,  703,  703,
     703,
  ],
  build: [
    2660, 2536, 2448, 2368, 2263, 2241, 2241, 2219, 2153, 2131, 2109, 2053, 1967, 1887, 1865, 1799, 1799, 1799, 1799, 1777, 1777, 1777,
    1989, 1989, 1989, 1967, 1967, 1967, 1945, 1945, 1923,
    1463, 1441, 1441, 1397, 1379, 1379, 1357, 1357,
    1357,
  ],
  terms: [
    1917, 1875, 1724, 1640, 1640, 1619, 1619, 1619, 1520, 1520, 1520, 1499, 1453, 1367, 1367, 1344, 1281, 1323, 1281, 1260, 1239, 1239,
    1324, 1303, 1282, 1282, 1240, 1240, 1240, 1219, 1152,
    1219, 1173, 1152, 1131, 1110, 1110, 1110, 1110,
     957,
  ],
  checks: [
    2528, 2492, 2427, 2427, 2384, 2384, 2384, 2308, 2308, 2286, 2188, 2141, 2123, 2076, 2076, 2076, 2058, 2058, 2058, 2015, 2015, 1979,
    2036, 2011, 2011, 2011, 1986, 1968, 1968, 1943, 1875,
    1777, 1755, 1755, 1755, 1693, 1659, 1659, 1643,
    1643,
  ],
  faq: [
    1395, 1309, 1281, 1253, 1253, 1253, 1253, 1253, 1253, 1217, 1189, 1133, 1077, 1077, 1077, 1077, 1077, 1077, 1077, 1077, 1077, 1049,
    1135, 1107, 1107, 1107, 1107, 1107, 1107, 1107, 1107,
     957,  957,  957,  957,  957,  957,  957,  929,
     929,
  ],
  start: [
    1988, 1855, 1819, 1801, 1783, 1783, 1758, 1740, 1722, 1682, 1646, 1610, 1610, 1574, 1556, 1556, 1484, 1446, 1428, 1428, 1428, 1428,
    1358, 1340, 1340, 1340, 1322, 1304, 1304, 1268, 1268,
    1332, 1332, 1332, 1332, 1314, 1314, 1314, 1314,
    1264,
  ],
} as const satisfies Record<string, readonly number[]>;

export type AutoReserveId = keyof typeof RESERVES;

/** A section below the cover, in a content-visibility box holding `box`'s reserve. */
export function AutoDeferred({ box, children }: { box: AutoReserveId; children: ReactNode }) {
  return (
    <div className="home-deferred" style={reserveStyle(RESERVES[box])}>
      {children}
    </div>
  );
}
