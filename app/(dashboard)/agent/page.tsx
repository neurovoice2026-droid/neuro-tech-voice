import { createClient } from '@/lib/supabase/server'
import { AgentPageClient } from '@/components/agent/AgentPageClient'
import type { Agent, PhoneNumber } from '@/types'

export default async function AgentPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return null

  const [{ data: agent }, { data: phoneNumbers }] = await Promise.all([
    supabase
      .from('agents')
      .select('*')
      .eq('org_id', org.id)
      .maybeSingle(),
    supabase
      .from('phone_numbers')
      .select('*')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <AgentPageClient
      initialAgent={agent as Agent | null}
      phoneNumbers={(phoneNumbers ?? []) as PhoneNumber[]}
    />
  )
}
