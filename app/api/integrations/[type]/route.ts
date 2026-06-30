import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_TYPES = [
  'google_calendar', 'gmail', 'google_sheets', 'google_docs', 'google_drive', 'webhook',
]

type Params = { params: Promise<{ type: string }> }

async function resolveOrgId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!org) return { error: 'Organization not found', status: 404 as const }
  return { orgId: org.id as string }
}

// Connection status for a single integration type.
export async function GET(_request: NextRequest, { params }: Params) {
  const { type } = await params
  const supabase = await createClient()
  const ctx = await resolveOrgId(supabase)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { data } = await supabase
    .from('integrations')
    .select('type, is_active, config, connected_at')
    .eq('org_id', ctx.orgId)
    .eq('type', type)
    .maybeSingle()

  return NextResponse.json({ connected: !!data?.is_active, integration: data ?? null })
}

// Connect/configure an integration. Used for the webhook type (Google types use
// the OAuth connect/callback routes instead).
export async function POST(request: NextRequest, { params }: Params) {
  const { type } = await params
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 })
  }

  const supabase = await createClient()
  const ctx = await resolveOrgId(supabase)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const body = (await request.json().catch(() => ({}))) as { config?: Record<string, unknown> }
  const config = body.config ?? {}

  if (type === 'webhook' && !config.url) {
    return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('integrations')
    .upsert(
      { org_id: ctx.orgId, type, config, is_active: true, connected_at: new Date().toISOString() },
      { onConflict: 'org_id,type' }
    )
    .select('type, is_active, config, connected_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ connected: true, integration: data })
}

// Disconnect an integration.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { type } = await params
  const supabase = await createClient()
  const ctx = await resolveOrgId(supabase)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('org_id', ctx.orgId)
    .eq('type', type)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ connected: false })
}
