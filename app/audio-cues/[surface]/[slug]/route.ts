import { INDUSTRY_SURFACES, isIndustrySurface } from "@/lib/audio";
import { INDUSTRY_CUES, loadIndustryCueModule } from "@/lib/audio/industry-cues";

/* ------------------------------------------------------------------ *
 * Each trade's cue file of an industry surface as plain JSON, written at
 * build time: the retry for a chunk that failed (lib/audio's
 * loadIndustryCueFile), as ../route.ts is for every other surface.
 * ------------------------------------------------------------------ */

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return INDUSTRY_SURFACES.flatMap((surface) => Object.keys(INDUSTRY_CUES[surface]).map((slug) => ({ surface, slug })));
}

export async function GET(_request: Request, { params }: { params: Promise<{ surface: string; slug: string }> }) {
  const { surface, slug } = await params;
  if (!isIndustrySurface(surface)) return new Response("Not found", { status: 404 });
  const file = await loadIndustryCueModule(surface, slug).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  return Response.json(file.default);
}
