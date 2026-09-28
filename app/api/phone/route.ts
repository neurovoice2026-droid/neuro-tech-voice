import { handleRoute, noStore } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { listPhoneNumbersForOrg } from '@/lib/twilio/numbers'

// The organization's phone numbers with routing and texting status.

export const runtime = 'nodejs'

export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  const numbers = await listPhoneNumbersForOrg(ctx.supabase, ctx.org.id)
  return noStore(Response.json(numbers))
})
