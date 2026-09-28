import { INT_START } from "@/lib/pages/integrations";

/* ─── #start ─────────────────────────────────────────────────────── */

export const HOME_START = {
  eyebrow: INT_START.eyebrow,
  title: INT_START.title,
  key: "you'd hate to miss",
  // NEW. The product page's "Company, tone, voice, number: four screens"
  // counts the number as a screen; it is not one (onboarding-state.ts:
  // company, agent, voice, go live) but a separate purchase afterwards.
  body: "Company, tone, voice, go live: four screens, then a test call to hear how it sounds.",
  primary: INT_START.primary,
  secondary: INT_START.secondary,
  note: INT_START.note,
} as const;
