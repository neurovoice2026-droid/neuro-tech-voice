/**
 * RETIRED. Floating dust / bokeh specks read as stock "AI" decoration; the
 * film's grounds are motivated light only (components/Atmosphere.tsx).
 * <Dust> keeps its props so existing scenes compile, and renders nothing —
 * remove it from a scene when you touch it.
 */
import type React from 'react';

export const Dust: React.FC<{
  count?: number;
  seed?: string;
  color?: string;
  opacity?: number;
  speed?: number;
  size?: [number, number];
  blur?: [number, number];
  frame?: number;
}> = () => null;
