import "server-only";
import { SAAS_PLATFORM, type DownReason, type DownRow, type RouteMode } from "./custom-saas-platforms";

/* ------------------------------------------------------------------ *
 * /solutions/custom-saas-platforms: the "Take a part down" lens.
 *
 * OWNER: on the platform branch (HEAD 249b5c5) this table is worked out at
 * build time by `decideMode` in lib/voice/mode.ts. That module (breakers,
 * Cartesia budget, kv, Supabase admin) is not on main and must not be
 * imported by the site, so its sixteen answers are copied here as they came
 * out of it. Rows are the four switches' bits: gateway 1, credits 2,
 * self 4, managed 8. Re-derive from decideMode when the platform ships.
 * ------------------------------------------------------------------ */

const DOWN_TABLE: readonly { mask: number; mode: RouteMode; reason: DownReason }[] = [
  { mask: 0, mode: "cartesia_self", reason: "credits_available" },
  { mask: 1, mode: "elevenlabs", reason: "gateway_breaker_open" },
  { mask: 2, mode: "cartesia_managed", reason: "credits_exhausted" },
  { mask: 3, mode: "elevenlabs", reason: "gateway_breaker_open" },
  { mask: 4, mode: "cartesia_managed", reason: "self_breaker_open" },
  { mask: 5, mode: "elevenlabs", reason: "gateway_breaker_open" },
  { mask: 6, mode: "cartesia_managed", reason: "credits_exhausted" },
  { mask: 7, mode: "elevenlabs", reason: "gateway_breaker_open" },
  { mask: 8, mode: "cartesia_self", reason: "credits_available" },
  { mask: 9, mode: "elevenlabs", reason: "gateway_breaker_open" },
  { mask: 10, mode: "elevenlabs", reason: "managed_breaker_open" },
  { mask: 11, mode: "elevenlabs", reason: "gateway_breaker_open" },
  { mask: 12, mode: "elevenlabs", reason: "managed_breaker_open" },
  { mask: 13, mode: "elevenlabs", reason: "gateway_breaker_open" },
  { mask: 14, mode: "elevenlabs", reason: "managed_breaker_open" },
  { mask: 15, mode: "elevenlabs", reason: "gateway_breaker_open" },
];

/** The three modes the drawing has a route and a name for (`DownCopy.routes`, `.modes`). */
const MODES: readonly string[] = Object.keys(SAAS_PLATFORM.down.routes);

/** The "Take a part down" lens, row `mask` for each of the sixteen switch combinations. */
export function buildDownTable(): readonly DownRow[] {
  const whys = SAAS_PLATFORM.down.whys;
  return DOWN_TABLE.map((row, mask) => {
    if (row.mask !== mask) throw new Error(`custom-saas-platforms: down table row ${mask} is out of order`);
    if (!(row.reason in whys)) throw new Error(`custom-saas-platforms: no sentence for routing reason "${row.reason}"`);
    if (!MODES.includes(row.mode)) throw new Error(`custom-saas-platforms: no route drawn for mode "${row.mode}"`);
    return { ...row };
  });
}
