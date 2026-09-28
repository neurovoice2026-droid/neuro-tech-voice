import "server-only";
import { decideMode, type ModeInputs } from "@/lib/voice/mode";
import { SAAS_PLATFORM, type DownReason, type DownRow, type RouteMode } from "./custom-saas-platforms";

/* ------------------------------------------------------------------ *
 * /solutions/custom-saas-platforms — the one table on the page that the
 * platform's own code writes rather than the copy file.
 *
 * "Take a part down" (the explorer's fifth lens) shows where the next
 * call goes when the reader switches parts off. The answer is never typed:
 * it is the platform's routing policy itself, `decideMode` in
 * lib/voice/mode.ts, run once for every combination of the four switches
 * while the page is built. The explorer receives the sixteen rows as plain
 * props and only looks its row up; nothing here reaches the browser.
 *
 * Kept out of the copy module on purpose. mode.ts pulls next/server's
 * `after`, the breaker store, the Cartesia budget, kv and the Supabase
 * admin client; importing it from custom-saas-platforms.ts would load that
 * whole graph with the page's words. Here it loads once, at build time,
 * for a static route that calls `buildDownTable()` from page.tsx.
 *
 * Every input is fixed except the four switches — a phone call, no
 * override, every provider configured, the agent set up on all three
 * paths, its budget left — so the table reads no environment and is the
 * same on every build. The switches, one bit each, as DownCopy.switches
 * labels them:
 *
 *   1  gateway   the voice gateway's breaker is open ("Voice gateway down")
 *   2  credits   this cycle's Cartesia speech credits are spent (the
 *                managed agent is paid from its own budget, left full)
 *   4  self      our own pipeline's breaker is open
 *   8  managed   Cartesia's managed agents' breaker is open
 *
 * At HEAD the policy answers: 0 and 8 our own pipeline (credits
 * available); every odd mask the ElevenLabs standby agent (gateway breaker
 * open); 2, 4 and 6 Cartesia's managed agent (credits exhausted, or our
 * pipeline's breaker open); 10, 12 and 14 the standby agent (managed
 * breaker open). lib/pages/custom-saas-platforms.test.ts re-runs the
 * policy for each mask and holds the table to it.
 *
 * Throws, and so fails the build, if the policy ever answers with a
 * reason the page has no sentence for (`DownCopy.whys`), or with a mode
 * outside the three the drawing can route: a new branch in mode.ts must
 * be worded here before the page can say it.
 * ------------------------------------------------------------------ */

/** The three modes the drawing has a route and a name for (`DownCopy.routes`, `.modes`). */
const MODES: readonly string[] = Object.keys(SAAS_PLATFORM.down.routes);

/**
 * The "Take a part down" lens, worked out by the platform's own routing
 * policy for all sixteen combinations of the four switches, at build time.
 * Row `mask` is the switches' bits (gateway 1, credits 2, self 4, managed 8).
 */
export function buildDownTable(): readonly DownRow[] {
  const whys = SAAS_PLATFORM.down.whys;
  return Array.from({ length: 16 }, (_, mask) => {
    const inputs: ModeInputs = {
      channel: "twilio",
      override: null,
      gatewayConfigured: true,
      cartesiaConfigured: true,
      openaiConfigured: true,
      elevenLabsConfigured: true,
      hasCartesiaVoice: true,
      hasManagedAgent: true,
      hasElevenLabsAgent: true,
      agentBudgetExhausted: false,
      gatewayBreakerOpen: Boolean(mask & 1),
      creditsExhausted: Boolean(mask & 2),
      selfBreakerOpen: Boolean(mask & 4),
      managedBreakerOpen: Boolean(mask & 8),
    };
    const d = decideMode(inputs);
    if (!(d.reason in whys)) throw new Error(`custom-saas-platforms: no sentence for routing reason "${d.reason}"`);
    if (!MODES.includes(d.mode)) throw new Error(`custom-saas-platforms: no route drawn for mode "${d.mode}"`);
    return { mask, mode: d.mode as RouteMode, reason: d.reason as DownReason };
  });
}
