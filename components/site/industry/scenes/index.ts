import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * The scene loaders, named one at a time.
 *
 * The stage used to reach for its scene with a template import —
 * `import(\`./scenes/${slug}\`)` — which asks the bundler to include
 * every module in this folder and match one at runtime. That worked, and
 * it cost the set a scare: a stray file left behind in here by a tool,
 * with nothing in it, took all sixteen industry pages to a 500 until
 * somebody noticed.
 *
 * An explicit map is worth the sixteen lines. Only a file named here is
 * ever part of the build, so a leftover, a draft or a half-written
 * experiment in this folder is inert. Each entry is still its own
 * dynamic import, so a reader downloads exactly the one scene for the
 * trade they are looking at.
 * ------------------------------------------------------------------ */

type Loader = () => Promise<{ scene: Scene }>;

const LOADERS: Record<string, Loader> = {
  "home-services": () => import("./home-services"),
  "real-estate": () => import("./real-estate"),
  restaurants: () => import("./restaurants"),
  "law-firms": () => import("./law-firms"),
  automotive: () => import("./automotive"),
  logistics: () => import("./logistics"),
  "salons-spas": () => import("./salons-spas"),
  veterinary: () => import("./veterinary"),
  insurance: () => import("./insurance"),
  "property-management": () => import("./property-management"),
  hospitality: () => import("./hospitality"),
  "financial-services": () => import("./financial-services"),
  retail: () => import("./retail"),
  education: () => import("./education"),
  fitness: () => import("./fitness"),
  "clinics-dental": () => import("./clinics-dental"),
};

/** The trade's scene, or null when there is no scene for that slug. */
export async function loadScene(slug: string): Promise<Scene | null> {
  const load = LOADERS[slug];
  if (!load) return null;
  const mod = await load();
  return mod.scene;
}
