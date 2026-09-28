import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PhoneNumbersView } from '@/components/phone/PhoneNumbersView'
import { getOrgContext } from '@/lib/api/auth'
import { isStripeConfigured, isTwilioConfigured } from '@/lib/env'
import { isVoiceRoutingReady, listPhoneNumbersForOrg } from '@/lib/twilio/numbers'
import type { PhoneNumberView } from '@/lib/twilio/types'

export const metadata: Metadata = { title: 'Phone Numbers' }

// Numbers are loaded on the server so the list renders complete on first
// paint; the client view refreshes after changes.
export default async function PhonePage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/login')

  let numbers: PhoneNumberView[] = []
  let loadError = false
  try {
    numbers = await listPhoneNumbersForOrg(ctx.supabase, ctx.org.id)
  } catch {
    // Logged in listPhoneNumbersForOrg; the view offers a retry.
    loadError = true
  }

  return (
    <PhoneNumbersView
      initialNumbers={numbers}
      initialError={loadError}
      canBuy={isStripeConfigured() && isTwilioConfigured()}
      canReconnect={isTwilioConfigured() && isVoiceRoutingReady()}
    />
  )
}
