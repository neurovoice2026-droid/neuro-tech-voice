import { redirect, unstable_rethrow } from 'next/navigation'
import { requireOrg } from '@/lib/api/auth'
import { RequestError } from '@/lib/api/http'
import { onboardingVariant } from '@/lib/commerce/business-type'
import { createLogger } from '@/lib/observability/logger'
import type { BusinessType } from '@/types'

// The Store section exists only for e-commerce organizations: the business
// type is read from the organization row on every request (never from the
// browser), and any other organization is sent back to its dashboard.
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  let businessType: BusinessType | null = null
  try {
    const { supabase, org } = await requireOrg({ allowDeleting: true })
    const { data, error } = await supabase.from('organizations').select('business_type').eq('id', org.id).maybeSingle()
    // Migration 024 not applied yet (unknown column): nothing can be an e-commerce organization.
    if (error && error.code !== '42703' && error.code !== 'PGRST204') throw error
    const raw = (data as { business_type?: unknown } | null)?.business_type
    businessType = raw === 'ecommerce' || raw === 'services' ? raw : null
  } catch (err) {
    // Next.js control-flow signals (dynamic rendering) are not errors.
    unstable_rethrow(err)
    // Signed out / no organization: the dashboard layout already redirects; render nothing.
    if (err instanceof RequestError && (err.status === 401 || err.status === 404)) return null
    createLogger({ route: 'page.store' }).error('store_layout.require_org_failed', err)
    throw err
  }
  if (onboardingVariant({ business_type: businessType }) !== 'ecommerce') redirect('/dashboard')
  return children
}
