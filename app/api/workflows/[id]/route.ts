import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RequestError, apiError, assertSameOrigin, requestErrorResponse } from '@/lib/api/http'
import { validateWorkflowActions } from '@/lib/workflows/outbound'

function sameOriginError(request: Request): NextResponse | null {
  try {
    assertSameOrigin(request)
    return null
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err)
    throw err
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rejected = sameOriginError(request)
  if (rejected) return rejected
  const supabase = await createClient()
  const { id } = await params

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()

  const allowed = ['name', 'description', 'trigger', 'trigger_config', 'actions', 'enabled']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  if ('actions' in updates) {
    // Webhook and Slack URLs are fetched server-side later: refuse unsafe ones now.
    const checked = await validateWorkflowActions(updates.actions)
    if (!checked.ok) return apiError('invalid_request', checked.error, 400, { details: checked.details })
    updates.actions = checked.actions
  }

  const { data: workflow, error } = await supabase
    .from('workflows')
    .update(updates)
    .eq('id', id)
    .eq('org_id', org.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(workflow)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rejected = sameOriginError(request)
  if (rejected) return rejected
  const supabase = await createClient()
  const { id } = await params

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('workflows')
    .delete()
    .eq('id', id)
    .eq('org_id', org.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
