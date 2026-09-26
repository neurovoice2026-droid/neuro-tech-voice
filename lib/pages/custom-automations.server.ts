import "server-only";
import { assertPublicHttpsUrl } from "@/lib/security/ssrf";
import {
  deliverJson,
  describeDelivery,
  isRetryableOutcome,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_TIMEOUT_MS,
  type AttemptOutcome,
  type WebhookFetcher,
} from "@/lib/workflows/webhook";
import { AUTO_BREAKS, type BreakAnswer, type BreakRow, type BreakScenario } from "./custom-automations";

/* ------------------------------------------------------------------ *
 * /solutions/custom-automations — the one table on the page that the
 * platform's own code writes rather than the copy file.
 *
 * "When it breaks" (#breaks) asks what happens when a step fails at
 * 3 a.m., and lets the reader pick what the CRM does when a sample
 * workflow sends it a call: takes it, is busy and then takes it, is down
 * all night, never answers, has moved, or points inside a private
 * network. The answer is never typed. It is the platform's delivery code
 * itself — `deliverJson` and `describeDelivery` in lib/workflows/webhook.ts,
 * the functions every customer webhook goes through — run once for each
 * scenario while the page is built. #breaks receives the six rows as
 * plain props and only looks its row up; nothing here reaches the
 * browser.
 *
 * Kept out of the copy module on purpose. webhook.ts signs with
 * node:crypto and checks every address with lib/security/ssrf.ts, which
 * pulls node:dns and node:net; importing either from custom-automations.ts
 * would load that graph with the page's words. Here it loads once, at
 * build time, for a static route that calls `buildBreakTable()` from
 * page.tsx.
 *
 * NOTHING IS SENT, AND NOTHING WAITS. Each scenario gets a scripted
 * receiver in place of the network (`deliverJson`'s `fetcher`), a clock
 * that starts at 0 (`now`) and a sleep that only moves that clock
 * (`sleep`), so the six rows cost no request and no second of real time
 * and are the same on every build:
 *   - a scripted answer is an HTTP status, given back as the receiver's
 *     reply; the scenario's last answer repeats if the code tries again;
 *   - "timeout" is silence: the clock moves on by WEBHOOK_TIMEOUT_MS and
 *     the fetcher throws the TimeoutError `AbortSignal.timeout` throws;
 *   - "unsafe" awaits the real `assertPublicHttpsUrl` on the scenario's
 *     address, as `postJsonSafely` does before it sends. That address is
 *     an IP literal inside 10.0.0.0/8, refused before any DNS lookup, so
 *     the build stays offline.
 * The two addresses (AUTO_BREAKS.scenarios[].url) receive nothing
 * either way: crm.example.com is reserved for documentation, and the
 * private one is never reached.
 *
 * WHAT A ROW HOLDS. When each try started (on the fake clock), the waits
 * the code slept between them, how long the delivery took, the status
 * the last answer carried, and two lines as the dashboard prints them:
 * the step's message, `describeDelivery(result, { label: "Your endpoint",
 * url })` exactly as lib/workflows/executor.ts builds it for a customer
 * webhook, and the meta line ActionResultList.tsx puts under it
 * ("3 attempts · 5.0 s · HTTP 503"). Each try is drawn as instant: the
 * waits and the timeouts are the code's own, and the executor, which times
 * a step by the wall clock, would add only the requests themselves.
 *
 * At HEAD the code answers (tried at, in ms; the waits between):
 *   ok       0                         "Your endpoint accepted it (200)."
 *   busy     0, 1000     (1000)        "… accepted it (200) on attempt 2."
 *   down     0, 1000, 5000 (1000, 4000) "crm.example.com answered 503
 *                                       after 3 attempts."
 *   slow     0, 11000, 25000 (1000, 4000), 35 s in all: "… didn’t answer
 *                                       within 10 seconds after 3 attempts."
 *   moved    0                         "… answered 404: the address no
 *                                       longer exists. Check the link …"
 *   private  0                         "We can’t send to this address: it
 *                                       points to a private or internal
 *                                       network, which call data is never
 *                                       sent to."
 * lib/pages/custom-automations.test.ts re-runs the delivery code for
 * each scenario with its own scripted receiver and holds the table to it,
 * row for row.
 *
 * Throws, and so fails the build, if the code stops doing what a
 * scenario's label says (`expect`: whether it gets through, and in how
 * many tries), or gives up with tries to spare on an answer its own rule
 * would try again: a change to the retries, the waits or the time budget
 * must be worded on the page before the page can build.
 * ------------------------------------------------------------------ */

/** The executor's label for a customer webhook (lib/workflows/executor.ts `runWebhook`), held by the test. */
export const ENDPOINT_LABEL = "Your endpoint";

/**
 * The run's time budget, as the executor gives each workflow run
 * (RUN_BUDGET_MS in lib/workflows/executor.ts, not exported; held by the
 * test to its source). The fake clock starts the delivery at 0, as a
 * webhook step does at the head of a run, so the deadline is the budget.
 */
const DEADLINE_MS = 240_000;

/**
 * ActionResultList's meta line, as the dashboard prints it under a step's
 * message: the attempts when there was more than one, the time (ms under a
 * second, one decimal under ten seconds, whole seconds past that; nothing
 * for none), and the HTTP status when there was an answer, joined with
 * " · ". "" when it prints none. Held to that file's source by the test.
 */
export function resultMeta(attempts: number, ms: number, status: number | null): string {
  const time = !Number.isFinite(ms) || ms <= 0 ? "" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
  return [attempts > 1 ? `${attempts} attempts` : null, time || null, typeof status === "number" ? `HTTP ${status}` : null]
    .filter(Boolean)
    .join(" · ");
}

/** One scenario, delivered by the platform's own code against its scripted receiver. */
async function run(s: BreakScenario): Promise<BreakRow> {
  let clock = 0;
  let i = 0;
  const attempts: { at: number; answer: BreakAnswer; retry: boolean }[] = [];
  const waits: number[] = [];
  // The answer the receiver gives on each try; the last one repeats.
  const fetcher: WebhookFetcher = async (url) => {
    const answer = s.answers[Math.min(i++, s.answers.length - 1)];
    attempts.push({ at: clock, answer, retry: false });
    if (answer === "unsafe") {
      await assertPublicHttpsUrl(url);
      // Not refused: the "expect" guard below fails the build by name.
      throw new Error(`${s.id}: expected ${url} to be refused`);
    }
    if (answer === "timeout") {
      clock += WEBHOOK_TIMEOUT_MS;
      const silence = new Error("timed out");
      silence.name = "TimeoutError";
      throw silence;
    }
    return { status: answer, finalUrl: url };
  };
  const result = await deliverJson({
    url: s.url,
    body: "{}",
    headers: () => ({}),
    deadline: DEADLINE_MS,
    fetcher,
    now: () => clock,
    sleep: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
  });
  // A try the code followed with another is drawn ↻; the last one ✓ or ✕.
  attempts.forEach((a, k) => {
    a.retry = k < attempts.length - 1;
  });
  const status = result.outcome.kind === "response" ? result.outcome.status : null;
  const row: BreakRow = {
    id: s.id,
    ok: result.ok,
    status,
    attempts,
    waits,
    durationMs: result.duration_ms,
    message: describeDelivery(result, { label: ENDPOINT_LABEL, url: s.url }),
    meta: resultMeta(result.attempts, result.duration_ms, status),
  };
  if (row.ok !== s.expect.ok || result.attempts !== s.expect.attempts || attempts.length !== result.attempts) {
    throw new Error(
      `custom-automations: the delivery code no longer does what "${s.id}" says (ok ${row.ok}, ${result.attempts} attempts)`,
    );
  }
  // A failure that stopped with tries to spare must be one the code's own
  // rule calls final (a 404, a refused address), never a busy answer given up on.
  const last: AttemptOutcome = result.outcome;
  if (!row.ok && result.attempts < WEBHOOK_MAX_ATTEMPTS && isRetryableOutcome(last)) {
    throw new Error(`custom-automations: "${s.id}" stopped early, after ${result.attempts} attempts`);
  }
  return row;
}

/** Every scenario, in AUTO_BREAKS' order, as the platform's delivery code worked it out. */
export async function buildBreakTable(): Promise<readonly BreakRow[]> {
  return Promise.all(AUTO_BREAKS.scenarios.map(run));
}
