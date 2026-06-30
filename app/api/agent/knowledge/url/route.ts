import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { knowledgeBase, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: agent } = await supabase
    .from('agents')
    .select('id, elevenlabs_agent_id')
    .eq('org_id', org.id)
    .single()

  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const { url } = (await request.json()) as { url: string }

  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: 'URL must be http or https' }, { status: 400 })
  }

  const { data: doc, error: insertError } = await supabase
    .from('knowledge_documents')
    .insert({
      agent_id: agent.id,
      org_id: org.id,
      name: parsedUrl.hostname + parsedUrl.pathname,
      type: 'url',
      url,
      status: 'processing',
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Sync to ElevenLabs
  if (elConfigured() && agent.elevenlabs_agent_id) {
    try {
      const elDoc = await knowledgeBase.createFromUrl({ url, name: parsedUrl.hostname + parsedUrl.pathname })
      await knowledgeBase.addToAgent(agent.elevenlabs_agent_id, elDoc.id)
      await supabase
        .from('knowledge_documents')
        .update({ status: 'ready', elevenlabs_doc_id: elDoc.id })
        .eq('id', doc.id)
      doc.status = 'ready'
      doc.elevenlabs_doc_id = elDoc.id
    } catch {
      await supabase
        .from('knowledge_documents')
        .update({ status: 'failed', error_message: 'ElevenLabs sync error' })
        .eq('id', doc.id)
      doc.status = 'failed'
    }
  } else {
    await supabase
      .from('knowledge_documents')
      .update({ status: 'ready' })
      .eq('id', doc.id)
    doc.status = 'ready'
  }

  return NextResponse.json(doc, { status: 201 })
}
