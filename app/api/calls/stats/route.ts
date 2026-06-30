import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { conversations, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

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
    .select('elevenlabs_agent_id')
    .eq('org_id', org.id)
    .single()

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  // Try ElevenLabs
  if (elConfigured() && agent?.elevenlabs_agent_id) {
    try {
      // Fetch all conversations for this agent (up to 100 for stats)
      const [allData, thisMonthData, lastMonthData] = await Promise.all([
        conversations.list({
          agent_id: agent.elevenlabs_agent_id,
          page_size: 100,
        }),
        conversations.list({
          agent_id: agent.elevenlabs_agent_id,
          page_size: 100,
          call_start_after_unix: Math.floor(thisMonthStart.getTime() / 1000),
        }),
        conversations.list({
          agent_id: agent.elevenlabs_agent_id,
          page_size: 100,
          call_start_after_unix: Math.floor(lastMonthStart.getTime() / 1000),
          call_start_before_unix: Math.floor(lastMonthEnd.getTime() / 1000),
        }),
      ])

      const all = allData.conversations ?? []
      const thisMonth = thisMonthData.conversations ?? []
      const lastMonth = lastMonthData.conversations ?? []

      const durations = all
        .filter((c) => c.call_duration_secs && c.call_duration_secs > 0)
        .map((c) => c.call_duration_secs!)
      const totalDuration = durations.reduce((s, d) => s + d, 0)
      const avgDuration = durations.length > 0 ? Math.round(totalDuration / durations.length) : 0

      const callsThisMonth = thisMonth.length
      const callsLastMonth = lastMonth.length
      const monthTrend = callsLastMonth === 0
        ? (callsThisMonth > 0 ? 100 : 0)
        : Math.round(((callsThisMonth - callsLastMonth) / callsLastMonth) * 100)

      return NextResponse.json({
        total_calls: all.length,
        calls_this_month: callsThisMonth,
        calls_last_month: callsLastMonth,
        month_trend: monthTrend,
        avg_duration_seconds: avgDuration,
        total_duration_seconds: Math.round(totalDuration),
      })
    } catch (err) {
      console.error('ElevenLabs stats failed, falling back to DB:', err)
    }
  }

  // Fallback: Supabase
  const thisMonthISO = thisMonthStart.toISOString()
  const lastMonthISO = lastMonthStart.toISOString()
  const lastMonthEndISO = lastMonthEnd.toISOString()

  const [allRes, thisMonthRes, lastMonthRes, completedRes] = await Promise.all([
    supabase.from('calls').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
    supabase.from('calls').select('id', { count: 'exact', head: true }).eq('org_id', org.id).gte('created_at', thisMonthISO),
    supabase.from('calls').select('id', { count: 'exact', head: true }).eq('org_id', org.id).gte('created_at', lastMonthISO).lte('created_at', lastMonthEndISO),
    supabase.from('calls').select('duration_seconds').eq('org_id', org.id).eq('status', 'completed'),
  ])

  const total_calls = allRes.count ?? 0
  const calls_this_month = thisMonthRes.count ?? 0
  const calls_last_month = lastMonthRes.count ?? 0

  const durations = (completedRes.data ?? []).map((c) => c.duration_seconds as number)
  const total_duration_seconds = durations.reduce((s, d) => s + (d ?? 0), 0)
  const avg_duration_seconds = durations.length > 0
    ? Math.round(total_duration_seconds / durations.length) : 0

  const month_trend = calls_last_month === 0
    ? (calls_this_month > 0 ? 100 : 0)
    : Math.round(((calls_this_month - calls_last_month) / calls_last_month) * 100)

  return NextResponse.json({
    total_calls,
    calls_this_month,
    calls_last_month,
    month_trend,
    avg_duration_seconds,
    total_duration_seconds,
  })
}
