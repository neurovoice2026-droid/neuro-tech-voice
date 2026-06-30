import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { voices, isConfigured } from '@/lib/elevenlabs/client'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isConfigured()) {
    return NextResponse.json({ voices: [] })
  }

  try {
    const data = await voices.getAll()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ voices: [] })
  }
}
