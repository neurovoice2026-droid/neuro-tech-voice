/**
 * The four lights, drawn INSIDE the hero's WebGL2 context (the CTA may hold
 * one context only): the site's FluidOrb fragment shader, verbatim, imported
 * from components/orbGL.ts, rendered into two offscreen premultiplied layers
 * the hero pass composites — BACK (behind the figure: the hero hides it with
 * her own matte) and FRONT (over everything).
 *
 * Same maths as components/orbGL.ts OrbRenderer (which always draws to the
 * canvas itself, so it cannot share a canvas with the hero): each orb in its
 * scissor box at a sub-pixel origin, ONE / ONE_MINUS_SRC_ALPHA. No smear, no
 * simulated shutter: the film renders at 120 fps and every orb is drawn
 * crisp where it is.
 *
 * All texture work here uses unit 4, so the hero's units 0–3 stay bound.
 */
import { ORB_FRAG, ORB_VERT, paletteUniform, type OrbDraw } from '../../components/orbGL';

const UNIT = 4;

type Target = { tex: WebGLTexture; fb: WebGLFramebuffer };
type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

function program(gl: WebGL2RenderingContext, frag: string, names: string[]): Prog {
  const p = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, ORB_VERT],
    [gl.FRAGMENT_SHADER, frag],
  ] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`[cta orbs] ${gl.getShaderInfoLog(sh)}`);
    gl.attachShader(p, sh);
  }
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`[cta orbs] ${gl.getProgramInfoLog(p)}`);
  return { p, u: Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)])) };
}

export class OrbPass {
  private readonly orb: Prog;
  private readonly vao: WebGLVertexArrayObject;
  private w = 0;
  private h = 0;
  /** [back, front] */
  private targets: Target[] = [];
  /** layers drawn last frame (so an empty frame clears them once, not every frame) */
  private dirty = [false, false];

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.orb = program(gl, ORB_FRAG, ['uRes', 'uOrigin', 'uTime', 'uVol', 'uGrain', 'uAlpha', 'uColors']);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  private ensure(W: number, H: number) {
    const gl = this.gl;
    if (this.w === W && this.h === H && this.targets.length) return;
    for (const t of this.targets) {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fb);
    }
    this.targets = [0, 1].map(() => {
      const tex = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + UNIT);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fb };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.w = W;
    this.h = H;
    this.dirty = [false, false];
  }

  /** The two layer textures, for the hero pass to bind. */
  layers(W: number, H: number): [WebGLTexture, WebGLTexture] {
    this.ensure(W, H);
    return [this.targets[0].tex, this.targets[1].tex];
  }

  /**
   * Draw `layers[k]` (k = 0 back, 1 front) into their targets, back to front.
   * sx / sy: backing-store px per CSS px. Leaves the default framebuffer
   * bound, blending and scissor off, and the orb VAO unbound.
   */
  render(layers: readonly (readonly OrbDraw[])[], W: number, H: number, sx: number, sy: number, grain = 0.075) {
    const gl = this.gl;
    this.ensure(W, H);
    const box = (x0: number, y0: number, x1: number, y1: number) => {
      const a = Math.max(0, Math.floor(x0));
      const b = Math.max(0, Math.floor(y0));
      const c = Math.min(W, Math.ceil(x1));
      const d = Math.min(H, Math.ceil(y1));
      return c > a && d > b ? ([a, b, c - a, d - b] as const) : null;
    };
    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    for (let k = 0; k < 2; k++) {
      const orbs = (layers[k] ?? []).filter((o) => (o.opacity ?? 1) > 0 && o.d > 0);
      if (!orbs.length && !this.dirty[k]) continue;
      const target = this.targets[k];
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.dirty[k] = orbs.length > 0;
      gl.enable(gl.SCISSOR_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      for (const o of orbs) {
        const alpha = Math.max(0, Math.min(1, o.opacity ?? 1));
        const res = o.d * sx;
        const ox = (o.x - o.d / 2) * sx;
        const oy = H - (o.y + o.d / 2) * sy;
        const orbBox = box(ox - 1, oy - 1, ox + res + 1, oy + res + 1);
        if (!orbBox) continue;
        const u = this.orb.u;
        gl.scissor(...orbBox);
        gl.useProgram(this.orb.p);
        gl.uniform2f(u.uRes, res, res);
        gl.uniform2f(u.uOrigin, ox, oy);
        gl.uniform1f(u.uTime, o.time);
        gl.uniform1f(u.uVol, o.volume);
        gl.uniform1f(u.uGrain, o.grain ?? grain);
        gl.uniform1f(u.uAlpha, alpha);
        gl.uniform3fv(u.uColors, paletteUniform(o.palette, o.paletteB, o.mixB ?? 0));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
  }

  /** true if either layer holds anything this frame */
  get on() {
    return this.dirty[0] || this.dirty[1];
  }
}
