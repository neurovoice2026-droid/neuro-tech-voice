import type { CSSProperties, ReactNode } from "react";

/* ------------------------------------------------------------------ *
 * The page's content-visibility box: the landing's `HomeDeferred`
 * (home/deferred.tsx) — the same `.home-deferred` element and home.css's
 * rules for it — with a reserve that follows the width inside each tier,
 * where the landing's holds one figure per tier.
 *
 * WHY. A box's reserve is its height until it first paints, and a
 * reserve off the truth moves the page when it does: under a reader
 * scrolling back up after a reload or a Back, and past a jump on its way.
 * One figure per tier is exact only at the width it was taken at, and
 * text rewraps at every width: below md this page's boxes lose some
 * 1,400px between 360 and 430 and 2,100 more by 744. The figures this
 * page had, taken at 393, 768, 1024 and 1440, left a reload 639px off at
 * 360 and a Back 748px off, and scrolling up after one shifted the page
 * by a CLS of 0.36 at 360, 1.5–1.8 from 600 to 767 and up to 0.33 on
 * tablets and small laptops. Only the four measured widths were clean.
 *
 * A LINE THROUGH MEASURED POINTS. Each box is measured at every width in
 * `RESERVE_AT` — each tier's first and last, the screens people hold
 * (360, 375, 390, 393, 402, 412, 430, 440; 744, 768, 800, 820, 834;
 * 1024, 1080, 1112, 1180) and a width every 30–50px between — and between
 * two of them its reserve runs straight from one height to the next: one
 * `calc()` per tier over `100vw`, a `clamp()` per stretch
 * (`reserveLine`). It goes in the tier's `--home-cis-*`, so home.css
 * switches tiers as it does for the landing, and neither HomeDeferred nor
 * home.css changes. 639 and 640 are both measured: the Frame's gutter
 * widens at Tailwind's sm, and the line crosses that step in a pixel.
 * From 1280 up the Frame is capped and nothing rewraps, so xl is one
 * figure.
 *
 * WHAT IT IS OFF BY. Exact at every width in the list. Between them text
 * wraps in steps and the line runs across them: over every width from
 * 320 to 1279, 3–6px per box on average, and at worst some 70px next to
 * a step. A classic desktop scrollbar counts in `100vw` but not in the
 * text's width, so at lg on Windows the reserve is that of a window some
 * 15px wider: about 10px per box.
 *
 * WHAT NO RESERVE KNOWS. Below md the explorer grows once its tour
 * starts, by the tour's room (220px at 320, 154 at 393, 66 at 767), and
 * its reserve is the height it first paints at, before that. So below md
 * a reload or a Back from a reader who has seen the tour puts them that
 * much further down the page than they were; nothing moves after, and
 * with reduced motion or on the lite tier, where no tour plays, they land
 * exactly. The rest is caught as it happens: a page that arrives
 * part-way down paints the boxes above it at once, while the reader is
 * still, and scroll anchoring holds the screen (settle.tsx); every
 * same-page jump gets one more look once it has settled (jumps.tsx).
 *
 * MEASURED, NOT GUESSED, and any change to a section's height changes
 * its row. Each row is that box's height at each width in `RESERVE_AT`,
 * with ?tier=full, as it first paints: the explorer on the lens it opens
 * on, before a tour; the prototype holding room for its tallest screen;
 * the scope in its opening state; #checks on "All"; the explorer's index and
 * every FAQ row closed. Each includes the box's trailing Gap (and, for
 * #build, its wash band's own padding; for the terms, the Rule and the
 * Gap above them). Taken by rendering every box at once, with reduced
 * motion so the explorer stays at its first paint, and resizing the
 * window through the list: that matches a fresh load's first paint, box
 * for box, at every width checked from 320 to 1440.
 * ------------------------------------------------------------------ */

/** A box's height at each width in `RESERVE_AT`, in the same order. */
type Reserve = readonly number[];

/** Where every reserve is measured. Each tier's first and last width are in it: home.css switches at 48, 64 and 80rem. */
// prettier-ignore
export const RESERVE_AT = [
     320,  340,  360,  375,  390,  393,  402,  412,  430,  440,  460,  480,  510,  540,  570,  600,  639,  640,  670,  700,  744,  767,
     768,  800,  820,  834,  870,  900,  950, 1000, 1023,
    1024, 1050, 1080, 1112, 1150, 1180, 1230, 1279,
    1280,
] as const;

/** Each box's measured height at every width in `RESERVE_AT`, laid out as it is: a line per tier. */
// prettier-ignore
export const RESERVES = {
  credentials: [
    1729, 1685, 1644, 1600, 1582, 1560, 1499, 1483, 1461, 1461, 1436, 1436, 1396, 1327, 1327, 1327, 1327, 1327, 1327, 1327, 1327, 1291,
    1443, 1443, 1443, 1443, 1443, 1443, 1443, 1443, 1397,
    1060, 1014, 1014, 1014,  974,  974,  952,  952,
     952,
  ],
  platform: [
    2309, 2268, 2222, 2222, 2222, 2222, 2175, 2153, 2153, 2153, 2153, 2088, 2088, 2070, 2045, 2045, 2027, 2045, 2027, 1991, 1991, 1969,
    1847, 1847, 1847, 1847, 1847, 1847, 1801, 1801, 1757,
    1613, 1613, 1613, 1613, 1613, 1613, 1613, 1613,
    1798,
  ],
  scope: [
    2737, 2665, 2620, 2526, 2458, 2436, 2416, 2416, 2416, 2400, 2301, 2247, 2173, 2105, 2053, 2005, 1931, 1931, 1931, 1931, 1931, 1931,
    1849, 1833, 1833, 1833, 1833, 1763, 1763, 1763, 1711,
    1579, 1563, 1563, 1531, 1509, 1493, 1493, 1447,
    1447,
  ],
  prototype: [
    1407, 1407, 1365, 1347, 1271, 1246, 1224, 1224, 1202, 1180, 1180, 1180, 1155, 1155, 1127, 1127, 1127, 1127, 1127, 1127, 1127, 1091,
    1217, 1217, 1217, 1217, 1195, 1173, 1173, 1127, 1127,
     744,  744,  744,  744,  744,  744,  744,  744,
     744,
  ],
  build: [
    2118, 1978, 1956, 1916, 1819, 1819, 1819, 1763, 1723, 1723, 1625, 1603, 1559, 1559, 1515, 1497, 1475, 1475, 1475, 1475, 1475, 1475,
    1655, 1655, 1655, 1655, 1655, 1655, 1655, 1655, 1655,
    1207, 1185, 1143, 1143, 1125, 1125, 1057, 1029,
    1029,
  ],
  terms: [
    1919, 1875, 1875, 1770, 1724, 1724, 1703, 1682, 1583, 1562, 1499, 1499, 1499, 1478, 1409, 1386, 1365, 1365, 1365, 1323, 1281, 1281,
    1354, 1303, 1303, 1291, 1270, 1249, 1186, 1186, 1140,
    1186, 1140, 1140, 1140, 1140, 1140, 1140, 1140,
     957,
  ],
  checks: [
    2617, 2599, 2472, 2472, 2447, 2447, 2425, 2389, 2371, 2309, 2225, 2182, 2182, 2142, 2124, 2063, 2023, 2045, 2023, 2005, 2005, 1969,
    2001, 1958, 1958, 1958, 1958, 1933, 1933, 1933, 1865,
    1831, 1809, 1785, 1779, 1739, 1717, 1701, 1701,
    1701,
  ],
  faq: [
    1423, 1337, 1281, 1253, 1225, 1225, 1225, 1225, 1225, 1189, 1189, 1189, 1133, 1105, 1049, 1049, 1049, 1049, 1049, 1049, 1049, 1049,
    1107, 1107, 1107, 1107, 1107, 1107, 1107, 1107, 1107,
    1013,  985,  929,  929,  929,  929,  929,  929,
     929,
  ],
  start: [
    1974, 1837, 1819, 1801, 1740, 1740, 1740, 1704, 1686, 1686, 1650, 1632, 1574, 1556, 1520, 1520, 1520, 1464, 1464, 1464, 1428, 1428,
    1340, 1340, 1340, 1340, 1304, 1286, 1286, 1268, 1268,
    1332, 1332, 1332, 1332, 1278, 1278, 1278, 1278,
    1246,
  ],
} as const satisfies Record<string, Reserve>;

export type ReserveId = keyof typeof RESERVES;

/** Tailwind's tiers as home.css switches them: the custom property each fills, and its first and last width. */
export const RESERVE_TIERS = [
  ["--home-cis-sm", 0, 767],
  ["--home-cis-md", 768, 1023],
  ["--home-cis-lg", 1024, 1279],
  ["--home-cis-xl", 1280, Infinity],
] as const;

/**
 * A straight line through `points` ([width, height], by width) as a CSS
 * length of `100vw`: the first height, plus each stretch's slope times
 * how far into that stretch the window is. Flat before the first point
 * and after the last. A slope is kept to three places, which puts the
 * line under half a pixel from every point.
 */
export function reserveLine(points: readonly (readonly [number, number])[]): string {
  const terms: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const [wa, ha] = points[i - 1];
    const [wb, hb] = points[i];
    const slope = Number(((hb - ha) / (wb - wa)).toFixed(3));
    if (slope !== 0) terms.push(`${slope < 0 ? "-" : "+"} ${Math.abs(slope)} * clamp(0px, 100vw - ${wa}px, ${wb - wa}px)`);
  }
  const first = `${points[0][1]}px`;
  return terms.length ? `calc(${first} ${terms.join(" ")})` : first;
}

/** Every tier's line for one box's row: the style its box carries. */
export function reserveStyle(heights: Reserve): CSSProperties {
  return Object.fromEntries(
    RESERVE_TIERS.map(([name, lo, hi]) => [
      name,
      reserveLine(RESERVE_AT.flatMap((w, i) => (w >= lo && w <= hi ? [[w, heights[i]] as const] : []))),
    ]),
  ) as CSSProperties;
}

/** A section below the cover, in a content-visibility box holding `box`'s measured reserve. */
export function SaasDeferred({ box, children }: { box: ReserveId; children: ReactNode }) {
  return (
    <div className="home-deferred" style={reserveStyle(RESERVES[box])}>
      {children}
    </div>
  );
}
