import { createClient } from '@/lib/supabase/server'
import { AgentPageClient } from '@/components/agent/AgentPageClient'
import type { Agent, PhoneNumber } from '@/types'

export default async function AgentPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('user_id', user.id)
    .single()

  if (!org) return null

  const [{ data: existingAgent }, { data: phoneNumbers }] = await Promise.all([
    supabase
      .from('agents')
      .select('*')
      .eq('org_id', org.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('phone_numbers')
      .select('*')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false }),
  ])

  // Ensure the org always has an agent to edit (older accounts may lack one).
  let agent = existingAgent
  if (!agent) {
    const { data: created } = await supabase
      .from('agents')
      .insert({ org_id: org.id, name: org.name ? `${org.name} Agent` : 'My Agent' })
      .select('*')
      .single()
    agent = created
  }

  return (
    <AgentPageClient
      initialAgent={agent as Agent | null}
      phoneNumbers={(phoneNumbers ?? []) as PhoneNumber[]}
    />
  )
}
