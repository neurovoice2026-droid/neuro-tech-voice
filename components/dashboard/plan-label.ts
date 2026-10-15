import { PLANS, isPlan } from '@/types'

/**
 * The trial's name, as its plan card and the billing page call it (TRIAL_TIER
 * through currentPlanName, components/pricing). Not imported from there: those
 * modules carry the homepage's pricing copy (lib/site.ts and the site's
 * palettes), which the dashboard shell would then load on every page.
 * tests/dashboard-ui.test.ts holds both names equal for every plan.
 */
const TRIAL_NAME = 'Free trial'

/**
 * A plan's name in the dashboard chrome (sidebar minutes tile, account menu,
 * Settings), as the billing page names the current plan: the PLANS display
 * name ("Store Growth", "Enterprise" for custom), "Free trial" on the trial.
 * An id this client does not know reads as the trial, like on the billing page.
 */
export function planDisplayName(plan: string | null | undefined): string {
  return isPlan(plan) && plan !== 'trial' ? PLANS[plan].name : TRIAL_NAME
}

/** The account menu's badge: "Store Growth plan", but "Free trial" alone. */
export function planBadgeText(plan: string | null | undefined): string {
  const name = planDisplayName(plan)
  return isPlan(plan) && plan !== 'trial' ? `${name} plan` : name
}
