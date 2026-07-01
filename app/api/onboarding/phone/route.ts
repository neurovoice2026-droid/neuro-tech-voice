import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTwilioClient } from '@/lib/twilio/client'
import { phoneNumbers, isConfigured as elConfigured } from '@/lib/elevenlabs/client'
import { checkNumberAllowance } from '@/lib/phone/limits'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const body = await request.json()

  // Mark step even if skipping
  await supabase
    .from('organizations')
    .update({ onboarding_step: 5 })
    .eq('user_id', user.id)

  if (body.skipped) {
    return NextResponse.json({ success: true, skipped: true })
  }

  // Numbers are included in paid plans only — a trial user must pick a plan first.
  const allowance = await checkNumberAllowance(supabase, org.id)
  if (!allowance.allowed) {
    return NextResponse.json({ error: allowance.error }, { status: allowance.status })
  }

  const { number, country } = body

  // Purchase number via Twilio
  try {
    const twilio = getTwilioClient()

    // Provision the bare number — ElevenLabs takes over routing on import below.
    const purchased = await twilio.incomingPhoneNumbers.create({
      phoneNumber: number,
    })

    // Import into ElevenLabs (native Twilio integration owns inbound)
    let elevenlabsPhoneNumberId: string | null = null
    if (elConfigured()) {
      try {
        const elPhone = await phoneNumbers.create({
          phone_number: purchased.phoneNumber,
          label: purchased.friendlyName ?? purchased.phoneNumber,
          provider_config: {
            twilio: {
              account_sid: process.env.TWILIO_ACCOUNT_SID!,
              auth_token: process.env.TWILIO_AUTH_TOKEN!,
              phone_number_sid: purchased.sid,
            },
          },
        })
        elevenlabsPhoneNumberId = elPhone.phone_number_id
      } catch (elErr) {
        console.error('ElevenLabs phone import failed (non-fatal):', elErr)
      }
    }

    // Record in DB
    const { error: dbError } = await supabase.from('phone_numbers').insert({
      org_id: org.id,
      twilio_sid: purchased.sid,
      number: purchased.phoneNumber,
      friendly_name: purchased.friendlyName,
      country: country ?? 'US',
      is_active: true,
      is_verified: true,
      elevenlabs_phone_number_id: elevenlabsPhoneNumberId,
    })

    if (dbError) throw new Error(dbError.message)

    return NextResponse.json({
      success: true,
      number: purchased.phoneNumber,
      twilio_sid: purchased.sid,
      elevenlabs_phone_number_id: elevenlabsPhoneNumberId,
    })
  } catch (err) {
    // Dev fallback — return mock success so UI can progress
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        success: true,
        number,
        twilio_sid: `mock-${Date.now()}`,
        _mock: true,
      })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to purchase number' },
      { status: 500 }
    )
  }
}
