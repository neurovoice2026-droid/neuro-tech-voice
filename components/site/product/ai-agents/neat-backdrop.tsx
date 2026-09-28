"use client";

import { useEffect, useRef } from "react";
import type { NeatConfig, NeatGradient } from "@firecms/neat";
import { whenIdle, whenIntent } from "../motion-kit";

/* ------------------------------------------------------------------ *
 * WebGL gradient backdrops for the hero reel's panels, keyed by scene id.
 *
 * The settings are exported from the Neat editor as-is. The editor is a
 * release ahead of the npm package, so a few keys (secondary wave, prism
 * edge, texture mode) are not in 1.0.2's types; all of them are off here,
 * and the index signature lets them through untouched.
 * ------------------------------------------------------------------ */

type EditorConfig = NeatConfig & Record<string, unknown>;

/**
 * Every setting but the palette. The panels' exports differ only in their
 * colours, so the rest is kept once and each scene brings its own five.
 */
const BASE = {
  speed: 4,
  horizontalPressure: 4,
  verticalPressure: 3,
  waveFrequencyX: 0,
  waveFrequencyY: 0,
  waveAmplitude: 0,
  secondaryWaveEnabled: false,
  secondaryWaveFrequencyX: 3,
  secondaryWaveFrequencyY: 3,
  secondaryWaveAmplitude: 5,
  secondaryWaveSpeed: 0.6,
  secondaryWaveAngle: 1,
  shadows: 2,
  highlights: 7,
  colorBrightness: 1,
  colorSaturation: 8,
  wireframe: false,
  antialias: false,
  colorBlending: 5,
  backgroundColor: "#FF0000",
  backgroundAlpha: 1,
  grainScale: 0,
  grainSparsity: 0,
  grainIntensity: 0,
  grainSpeed: 0,
  resolution: 0.5,
  yOffset: 100,
  yOffsetWaveMultiplier: 1.5,
  yOffsetColorMultiplier: 1.8,
  yOffsetFlowMultiplier: 2,
  flowDistortionA: 1.2,
  flowDistortionB: 1.8,
  flowScale: 1.5,
  flowEase: 0.25,
  flowEnabled: false,
  enableProceduralTexture: false,
  transparentTextureVoid: false,
  textureMode: "bitmap",
  bakeEdgeSoftness: 1,
  textureVoidLikelihood: 0.27,
  textureVoidWidthMin: 60,
  textureVoidWidthMax: 420,
  textureBandDensity: 1.2,
  textureColorBlending: 0.06,
  textureSeed: 333,
  textureEase: 0.75,
  proceduralBackgroundColor: "#0E0707",
  textureShapeTriangles: 20,
  textureShapeCircles: 15,
  textureShapeBars: 15,
  textureShapeSquiggles: 10,
  domainWarpEnabled: false,
  domainWarpIntensity: 0,
  domainWarpScale: 3,
  vignetteIntensity: 0,
  vignetteRadius: 0.8,
  fresnelEnabled: false,
  fresnelPower: 2,
  fresnelIntensity: 0.5,
  fresnelColor: "#FFFFFF",
  iridescenceEnabled: false,
  iridescenceIntensity: 0.5,
  iridescenceSpeed: 1,
  prismEdgeEnabled: false,
  prismEdgeIntensity: 0.5,
  prismEdgeThinness: 3,
  prismEdgeSpread: 1,
  prismEdgeSpeed: 0.5,
  prismEdgeRipple: 1,
  bloomIntensity: 0,
  bloomThreshold: 0.7,
  chromaticAberration: 0,
  shapeType: "plane",
  shapeRotationX: 0,
  shapeRotationY: 0,
  shapeRotationZ: 0,
  shapeAutoRotateSpeedX: 0,
  shapeAutoRotateSpeedY: 0,
  sphereRadius: 15,
  torusRadius: 15,
  torusTube: 5,
  cylinderRadius: 10,
  cylinderHeight: 40,
  planeBend: 0,
  planeTwist: 0,
  silhouetteFade: 0.25,
  cylinderFade: 0.08,
  ribbonFade: 0.05,
  flatShading: true,
  cameraLock: true,
  cameraX: 0,
  cameraY: 0,
  cameraZ: 0,
  cameraRotationX: 0,
  cameraRotationY: 0,
  cameraRotationZ: 0,
  cameraZoom: 1,
} satisfies Omit<NeatConfig, "colors"> & Record<string, unknown>;

export const SCENE_GRADIENTS: Partial<Record<string, EditorConfig>> = {
  booking: {
    ...BASE,
    colors: [
      { color: "#77593F", enabled: true },
      { color: "#2E1E12", enabled: true },
      { color: "#CDAE89", enabled: true },
      { color: "#573921", enabled: true },
      { color: "#A08060", enabled: true },
      { color: "#A8E6CF", enabled: false },
    ],
  },
  qualify: {
    ...BASE,
    colors: [
      { color: "#1A261F", enabled: true },
      { color: "#BDCFB6", enabled: true },
      { color: "#617060", enabled: true },
      { color: "#34483A", enabled: true },
      { color: "#869A82", enabled: true },
      { color: "#A8E6CF", enabled: false },
    ],
  },
  support: {
    ...BASE,
    colors: [
      { color: "#2E3A51", enabled: true },
      { color: "#B9C5DB", enabled: true },
      { color: "#7B869D", enabled: true },
      { color: "#171D2A", enabled: true },
      { color: "#515B71", enabled: true },
      { color: "#A8E6CF", enabled: false },
    ],
  },
  "after-hours": {
    ...BASE,
    colors: [
      { color: "#9684B8", enabled: true },
      { color: "#0F0A18", enabled: true },
      { color: "#453B58", enabled: true },
      { color: "#231737", enabled: true },
      { color: "#645780", enabled: true },
      { color: "#A8E6CF", enabled: false },
    ],
  },
};

function luma(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

/** A backdrop's enabled colours, darkest first. */
export function paletteByLuma(config: EditorConfig) {
  return config.colors
    .filter((c) => c.enabled)
    .map((c) => c.color)
    .sort((a, b) => luma(a) - luma(b));
}

/**
 * What the panel shows before WebGL paints, and instead of it without
 * WebGL: the palette laid out the way the gradient tends to fall — its
 * light colours pooled high, its body low, on the darkest one.
 */
export function gradientPoster(config: EditorConfig) {
  const [floor, deep, body, light, lightest] = paletteByLuma(config);
  return [
    `radial-gradient(70% 55% at 72% 18%, ${lightest} 0%, transparent 70%)`,
    `radial-gradient(60% 50% at 22% 38%, ${light}cc 0%, transparent 72%)`,
    `radial-gradient(90% 70% at 30% 96%, ${body} 0%, transparent 70%)`,
    `radial-gradient(80% 60% at 88% 78%, ${deep} 0%, transparent 72%)`,
    floor,
  ].join(", ");
}

/**
 * The gradient itself. Nothing is fetched or compiled until the canvas is
 * both laid out and on screen — a card hidden on a phone never starts one —
 * and the visitor has shown a sign of life, and then only in an idle
 * moment: compiling the shader holds the main thread for a moment, and that
 * moment should never be the one in which the page becomes usable. Until
 * then the poster stands in; the canvas fades in over it on its first frame.
 */
export function NeatBackdrop({ config }: { config: EditorConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gradient: NeatGradient | null = null;
    let cancelled = false;
    let cancelIdle: (() => void) | null = null;
    let raf = 0;
    const onScroll = () => {
      if (gradient) gradient.yOffset = window.scrollY;
    };

    let armed = false;
    const start = () => {
      if (armed) return;
      armed = true;
      whenIntent().then(() => {
        if (cancelled) return;
        cancelIdle = whenIdle(() => {
          // Imported here rather than at the top: it is WebGL-only, and this
          // keeps it out of the server render and off the page's first bundle.
          import("@firecms/neat").then(({ NeatGradient }) => {
            if (cancelled) return;
            const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            gradient = new NeatGradient({
              ref: canvas,
              ...config,
              ...(still ? { speed: 0 } : null),
            });
            window.addEventListener("scroll", onScroll, { passive: true });
            raf = requestAnimationFrame(() => {
              raf = requestAnimationFrame(() => {
                canvas.style.opacity = "1";
              });
            });
          });
        });
      });
    };

    let seen = false;
    let sized = false;
    const check = () => {
      if (seen && sized) start();
    };
    const io = new IntersectionObserver(
      ([e]) => {
        seen = e.isIntersecting;
        check();
      },
      { rootMargin: "10% 0px" },
    );
    const ro = new ResizeObserver(([e]) => {
      sized = e.contentRect.width > 0 && e.contentRect.height > 0;
      check();
    });
    io.observe(canvas);
    ro.observe(canvas);

    return () => {
      cancelled = true;
      io.disconnect();
      ro.disconnect();
      cancelIdle?.();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      gradient?.destroy();
    };
  }, [config]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 size-full opacity-0 transition-opacity duration-700"
    />
  );
}
