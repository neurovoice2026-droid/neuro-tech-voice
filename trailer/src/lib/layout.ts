import { useVideoConfig } from 'remotion';

/**
 * One design, two frames. Both renders have a 1080 px short side, so pixel
 * sizes carry over 1:1; only positions change with orientation.
 *
 *   const L = useLayout();
 *   L.pick(landscapeValue, verticalValue)
 */
export function useLayout() {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  return {
    width,
    height,
    vertical,
    cx: width / 2,
    cy: height / 2,
    /** Choose a value per orientation. */
    pick<T>(landscape: T, portrait: T): T {
      return vertical ? portrait : landscape;
    },
    /** Safe title margins (5 % of the short side, 8 % sides on vertical). */
    safe: vertical ? { x: 86, y: 160 } : { x: 120, y: 80 },
  };
}
export type Layout = ReturnType<typeof useLayout>;
