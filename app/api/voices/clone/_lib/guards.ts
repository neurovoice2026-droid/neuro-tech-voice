import 'server-only'
import { ApiError } from '@/lib/api/http'
import type { OrgContext } from '@/lib/api/auth'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { MAX_CLONES_PER_ORG } from '@/components/voice/voice-options'
import { PLANS } from '@/types'
import { listOrgClones } from '../../_lib/catalog'

/** Our plan gate (distinct from the provider's plan_upgrade_required, which is our problem, not the owner's). */
export function requireCloningEntitlement(ctx: OrgContext): void {
  if (entitlementsFor(ctx.org.plan).voiceCloning) return
  const plan = PLANS[requiredPlanFor('voiceCloning')]
  throw new ApiError(
    403,
    'upgrade_required',
    `Voice cloning is available on the ${plan.name} plan and above. Upgrade your plan to clone a voice.`
  )
}

export async function requireCloneSlot(ctx: OrgContext): Promise<void> {
  const clones = await listOrgClones(ctx)
  if (clones.length >= MAX_CLONES_PER_ORG) {
    throw new ApiError(
      409,
      'clone_limit_reached',
      `You already have ${MAX_CLONES_PER_ORG} cloned voices. Delete one you no longer use to add another.`
    )
  }
}
