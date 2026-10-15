import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RequestError, apiError, assertSameOrigin, requestErrorResponse } from '@/lib/api/http'
import { validateWorkflowActions } from '@/lib/workflows/outbound'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: workflows, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(workflows ?? [])
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err)
    throw err
  }
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  // Webhook and Slack URLs are fetched server-side later: refuse unsafe ones now.
  const checked = await validateWorkflowActions(body.actions ?? [])
  if (!checked.ok) return apiError('invalid_request', checked.error, 400, { details: checked.details })

  const { data: workflow, error } = await supabase
    .from('workflows')
    .insert({
      org_id: org.id,
      name: body.name,
      description: body.description ?? null,
      trigger: body.trigger,
      trigger_config: body.trigger_config ?? {},
      actions: checked.actions,
      enabled: body.enabled ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(workflow, { status: 201 })
}
