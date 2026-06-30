import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { knowledgeBase, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const supabase = await createClient()
  const { docId } = await params

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch the document — RLS ensures it belongs to this org
  const { data: doc, error: fetchError } = await supabase
    .from('knowledge_documents')
    .select('id, org_id, storage_path, elevenlabs_doc_id')
    .eq('id', docId)
    .eq('org_id', org.id)
    .single()

  if (fetchError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Remove from Supabase Storage if it has a file
  if (doc.storage_path) {
    await supabase.storage
      .from('knowledge-documents')
      .remove([doc.storage_path])
  }

  // Remove from ElevenLabs knowledge base
  if (elConfigured() && doc.elevenlabs_doc_id) {
    try {
      await knowledgeBase.delete(doc.elevenlabs_doc_id)
    } catch {
      // Non-fatal
    }
  }

  const { error: deleteError } = await supabase
    .from('knowledge_documents')
    .delete()
    .eq('id', docId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
