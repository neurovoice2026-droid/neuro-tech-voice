import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// List the organization's purchased phone numbers.
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

  const { data: numbers, error } = await supabase
    .from('phone_numbers')
    .select('*, agents(name)')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(numbers ?? [])
}
