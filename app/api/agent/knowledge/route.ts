import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { knowledgeBase, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

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

  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('org_id', org.id)
    .single()

  if (!agent) return NextResponse.json([])

  const { data: docs, error } = await supabase
    .from('knowledge_documents')
    .select('*')
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(docs ?? [])
}

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

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const typeMap: Record<string, string> = { pdf: 'pdf', txt: 'txt', docx: 'docx', md: 'md' }
  const docType = typeMap[ext]

  if (!docType) {
    return NextResponse.json({ error: 'Unsupported file type. Allowed: pdf, txt, docx, md' }, { status: 400 })
  }

  const storagePath = `${org.id}/${agent.id}/${Date.now()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('knowledge-documents')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  const { data: doc, error: insertError } = await supabase
    .from('knowledge_documents')
    .insert({
      agent_id: agent.id,
      org_id: org.id,
      name: file.name,
      type: docType,
      storage_path: storagePath,
      size_bytes: file.size,
      status: 'processing',
    })
    .select()
    .single()

  if (insertError) {
    await supabase.storage.from('knowledge-documents').remove([storagePath])
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Sync to ElevenLabs knowledge base if agent has an ElevenLabs ID
  if (elConfigured() && agent.elevenlabs_agent_id) {
    try {
      const elDoc = await knowledgeBase.createFromFile(file, file.name)
      // Link the document to the agent
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
    // No ElevenLabs agent — mark ready locally
    await supabase
      .from('knowledge_documents')
      .update({ status: 'ready' })
      .eq('id', doc.id)
    doc.status = 'ready'
  }

  return NextResponse.json(doc, { status: 201 })
}
