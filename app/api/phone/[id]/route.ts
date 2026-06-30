import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTwilioClient } from '@/lib/twilio/client'
import { phoneNumbers as elPhone, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

// Release a phone number: detach from ElevenLabs, release from Twilio, drop the row.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: num } = await supabase
    .from('phone_numbers')
    .select('id, twilio_sid, elevenlabs_phone_number_id')
    .eq('id', id)
    .eq('org_id', org.id)
    .maybeSingle()

  if (!num) return NextResponse.json({ error: 'Number not found' }, { status: 404 })

  // Best-effort cleanup with the providers — never block the DB delete on these.
  if (elConfigured() && num.elevenlabs_phone_number_id) {
    try { await elPhone.delete(num.elevenlabs_phone_number_id as string) } catch { /* ignore */ }
  }
  if (num.twilio_sid && !String(num.twilio_sid).startsWith('mock')) {
    try { await getTwilioClient().incomingPhoneNumbers(num.twilio_sid as string).remove() } catch { /* ignore */ }
  }

  const { error } = await supabase
    .from('phone_numbers')
    .delete()
    .eq('id', id)
    .eq('org_id', org.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// Toggle a number active/inactive.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { is_active } = (await request.json()) as { is_active?: boolean }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('phone_numbers')
    .update({ is_active: !!is_active })
    .eq('id', id)
    .eq('org_id', org.id)
    .select('*, agents(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
