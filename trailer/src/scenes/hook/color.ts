/**
 * Theme colours as "r,g,b" triplets / rgba() strings, so every glow and
 * gradient in the hook is written from a C token instead of a literal.
 */
export const rgbOf = (hex: string): string => {
  const p = parseInt(hex.slice(1), 16);
  return `${(p >> 16) & 255},${(p >> 8) & 255},${p & 255}`;
};

export const rgba = (hex: string, a: number): string => `rgba(${rgbOf(hex)},${Math.max(0, a).toFixed(3)})`;
