/* ------------------------------------------------------------------ *
 * Who #pricing is showing plans to: service businesses (the default) or
 * online stores. The choice lives in the URL, so a link can open the
 * section on the store plans (`/?audience=stores#pricing`) and the reader
 * can pass on what they are looking at. Pure and DOM-free: the section
 * hands it `location.search` and `location.hash` and writes back what it
 * returns.
 * ------------------------------------------------------------------ */

export type Audience = "services" | "stores";

/** The query parameter that carries the audience. */
export const AUDIENCE_PARAM = "audience";

/** The segmented control's two choices, in order; the first is the default. */
export const AUDIENCES = [
  { id: "services", label: "Service businesses" },
  { id: "stores", label: "Online stores" },
] as const satisfies readonly { id: Audience; label: string }[];

export const DEFAULT_AUDIENCE: Audience = AUDIENCES[0].id;

export function isAudience(value: unknown): value is Audience {
  return AUDIENCES.some((a) => a.id === value);
}

/** The query a hash carries after its own `?` (`#pricing?audience=stores` → `audience=stores`), or nothing. */
function queryInHash(hash: string): string {
  const q = hash.indexOf("?");
  return q >= 0 ? hash.slice(q + 1) : "";
}

/**
 * The audience a URL asks for: `?audience=stores` in the query, or the
 * same pair carried inside the hash (`#pricing?audience=stores`, which a
 * hand-written link may use). Anything else, including no parameter at
 * all, is the default. A link straight to the estimator (`#your-bill`)
 * is a link to the service plans, which is the only family it prices.
 */
export function audienceFromUrl(search: string, hash = ""): Audience {
  if (hash.split("?")[0] === ESTIMATOR_HASH) return DEFAULT_AUDIENCE;
  const fromQuery = new URLSearchParams(search).get(AUDIENCE_PARAM);
  const fromHash = new URLSearchParams(queryInHash(hash)).get(AUDIENCE_PARAM);
  const asked = fromQuery ?? fromHash;
  return isAudience(asked) ? asked : DEFAULT_AUDIENCE;
}

/** The hash a link to the estimator carries: it names the service plans (audienceFromUrl). */
const ESTIMATOR_HASH = "#your-bill";

/**
 * `href` with the audience written into its query: the parameter set for
 * the store plans, removed for the default (the default needs no URL), and
 * any copy of it carried in the hash dropped. A hash on the estimator
 * would name the service plans over the query, so the store plans swap it
 * for the section's own. A relative href stays relative; an absolute one
 * stays absolute.
 */
export function withAudience(href: string, audience: Audience): string {
  const absolute = /^[a-z][a-z0-9+.-]*:/i.test(href);
  const url = new URL(href, "https://relative.invalid");
  if (audience === DEFAULT_AUDIENCE) url.searchParams.delete(AUDIENCE_PARAM);
  else url.searchParams.set(AUDIENCE_PARAM, audience);
  const q = url.hash.indexOf("?");
  if (q >= 0) url.hash = url.hash.slice(0, q);
  if (audience !== DEFAULT_AUDIENCE && url.hash === ESTIMATOR_HASH) url.hash = "#pricing";
  return absolute ? url.href : `${url.pathname}${url.search}${url.hash}`;
}

/** The pricing section open on the store plans, for links from anywhere on the site. */
export const STORE_PRICING_HREF = withAudience("/#pricing", "stores");
