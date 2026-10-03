import { isSurface, loadCueModule, SURFACES } from "@/lib/audio";

/* ------------------------------------------------------------------ *
 * Each surface's cue file as plain JSON, written at build time.
 *
 * Not the way a stage loads its cues: that is import(), on first use
 * (lib/audio/index.ts). This is its retry. A chunk that failed to load
 * once (a dropped connection, a transient error) stays failed in the
 * bundler's runtime for the rest of the visit, so loadCueFile fetches the
 * same file from here instead, which a later press can try again.
 * ------------------------------------------------------------------ */

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return SURFACES.map((surface) => ({ surface }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (!isSurface(surface)) return new Response("Not found", { status: 404 });
  return Response.json(await loadCueModule(surface));
}
