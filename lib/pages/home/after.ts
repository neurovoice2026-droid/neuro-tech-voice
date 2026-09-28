import { INT_ACTIONS, INT_GOOGLE, INT_HERO, INT_IDEA, RELAY, TRIGGERS, type ActionKind } from "@/lib/pages/integrations";
import { GOOGLE_PLAN } from "./gates";
import { must } from "./source";

/* ─── #after: what happens after the call ────────────────────────── *
 * Read by the section's server shell (after-call.tsx), which resolves the
 * run-done line and hands its relay plain strings.
 */

export const HOME_AFTER = {
  eyebrow: must(INT_IDEA.facts, "after").title,
  title: INT_HERO.title,
  key: "starts on its own",
  sub: INT_HERO.sub,
  triggers: TRIGGERS,
  relay: RELAY,
  // src: components/site/product/integrations/hero.tsx:27-32
  stepTitle: {
    webhook: "Send webhook",
    slack: "Notify Slack",
    tag: "Tag the call",
    wait: "Wait",
  } satisfies Record<ActionKind, string>,
  link: { label: "How workflows work", href: "/product/integrations" }, // NEW label
  google: {
    title: INT_GOOGLE.title,
    // The source's two sentences, then the plan the steps need (NEW),
    // read off the entitlements rather than typed.
    body: `${INT_GOOGLE.body} Google steps run on ${GOOGLE_PLAN} and above.`,
  },
  /**
   * @deprecated The trademark lines live in one place, the credits
   * (HOME_CREDITS); #after drops its column. Delete once after-call.tsx
   * no longer reads this.
   */
  trademarks: [INT_ACTIONS.trademarks, INT_GOOGLE.trademarks],
  defaultScene: "ended",
} as const;
