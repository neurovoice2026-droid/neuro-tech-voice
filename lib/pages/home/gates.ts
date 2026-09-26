import { requiredPlanFor } from "@/lib/billing/entitlements";
import { PLANS } from "@/types";

/* ------------------------------------------------------------------ *
 * The plans the landing's samples need, read off the entitlements the
 * routes enforce, never typed: when a feature moves plan, every hedge
 * on the page moves with it. The same reading the product pages use
 * (custom-ai-agents.ts CALENDAR_PLAN, workflows/service.ts).
 * ------------------------------------------------------------------ */

/**
 * Booking by phone (voice/tools/calendar.ts `bookingGate`) and every
 * Google Workspace step (workflows/service.ts) start on this plan.
 */
export const GOOGLE_PLAN = PLANS[requiredPlanFor("googleIntegrations")].name;

/** Confirmation texts start on this plan; the free trial sends none. */
export const SMS_PLAN = PLANS[requiredPlanFor("smsConfirmations")].name;
