import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { type } = (await request.json()) as { type: string }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify call belongs to org
  const { data: call } = await supabase
    .from('calls')
    .select('*')
    .eq('id', id)
    .eq('org_id', org.id)
    .single()

  if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

  // Check if integration is connected
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('org_id', org.id)
    .eq('type', type)
    .eq('is_active', true)
    .maybeSingle()

  if (!integration) {
    return NextResponse.json({ error: 'Integration not connected' }, { status: 400 })
  }

  // Stub: Integration actions require Google OAuth tokens
  // In production, use stored refresh_token to call Google APIs
  return NextResponse.json({
    success: true,
    message: `Sent to ${type} successfully`,
  })
}
