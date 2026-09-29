import "server-only";
import { AUTO_BREAKS, type BreakRow } from "./custom-automations";

/* ------------------------------------------------------------------ *
 * /solutions/custom-automations: the "When it breaks" (#breaks) table.
 *
 * OWNER: on the platform branch (HEAD 249b5c5) these six rows are worked
 * out at build time by running `deliverJson` and `describeDelivery`
 * (lib/workflows/webhook.ts, with lib/security/ssrf.ts) against scripted
 * receivers. Neither module is on main, and main's own workflow executor
 * sends one unsigned POST with no retries, so the rows are copied here as
 * that code produced them. Re-derive from webhook.ts when the platform
 * ships.
 * ------------------------------------------------------------------ */

/** The executor's label for a customer webhook (lib/workflows/executor.ts `runWebhook` at HEAD). */
export const ENDPOINT_LABEL = "Your endpoint";

const BREAK_TABLE: readonly BreakRow[] = [
  {
    "id": "ok",
    "ok": true,
    "status": 200,
    "attempts": [
      {
        "at": 0,
        "answer": 200,
        "retry": false
      }
    ],
    "waits": [],
    "durationMs": 0,
    "message": "Your endpoint accepted it (200).",
    "meta": "HTTP 200"
  },
  {
    "id": "busy",
    "ok": true,
    "status": 200,
    "attempts": [
      {
        "at": 0,
        "answer": 503,
        "retry": true
      },
      {
        "at": 1000,
        "answer": 200,
        "retry": false
      }
    ],
    "waits": [
      1000
    ],
    "durationMs": 1000,
    "message": "Your endpoint accepted it (200) on attempt 2.",
    "meta": "2 attempts · 1.0 s · HTTP 200"
  },
  {
    "id": "down",
    "ok": false,
    "status": 503,
    "attempts": [
      {
        "at": 0,
        "answer": 503,
        "retry": true
      },
      {
        "at": 1000,
        "answer": 503,
        "retry": true
      },
      {
        "at": 5000,
        "answer": 503,
        "retry": false
      }
    ],
    "waits": [
      1000,
      4000
    ],
    "durationMs": 5000,
    "message": "crm.example.com answered 503 after 3 attempts.",
    "meta": "3 attempts · 5.0 s · HTTP 503"
  },
  {
    "id": "slow",
    "ok": false,
    "status": null,
    "attempts": [
      {
        "at": 0,
        "answer": "timeout",
        "retry": true
      },
      {
        "at": 11000,
        "answer": "timeout",
        "retry": true
      },
      {
        "at": 25000,
        "answer": "timeout",
        "retry": false
      }
    ],
    "waits": [
      1000,
      4000
    ],
    "durationMs": 35000,
    "message": "crm.example.com didn’t answer within 10 seconds after 3 attempts.",
    "meta": "3 attempts · 35 s"
  },
  {
    "id": "moved",
    "ok": false,
    "status": 404,
    "attempts": [
      {
        "at": 0,
        "answer": 404,
        "retry": false
      }
    ],
    "waits": [],
    "durationMs": 0,
    "message": "crm.example.com answered 404: the address no longer exists. Check the link in this step.",
    "meta": "HTTP 404"
  },
  {
    "id": "private",
    "ok": false,
    "status": null,
    "attempts": [
      {
        "at": 0,
        "answer": "unsafe",
        "retry": false
      }
    ],
    "waits": [],
    "durationMs": 0,
    "message": "We can’t send to this address: it points to a private or internal network, which call data is never sent to.",
    "meta": ""
  }
];

/** Every scenario, in AUTO_BREAKS' order. Throws if a scenario and its row drift apart. */
export async function buildBreakTable(): Promise<readonly BreakRow[]> {
  return AUTO_BREAKS.scenarios.map((s, i) => {
    const row = BREAK_TABLE[i];
    if (!row || row.id !== s.id || row.ok !== s.expect.ok || row.attempts.length !== s.expect.attempts)
      throw new Error(`custom-automations: the #breaks row for "${s.id}" no longer matches its scenario`);
    return row;
  });
}
