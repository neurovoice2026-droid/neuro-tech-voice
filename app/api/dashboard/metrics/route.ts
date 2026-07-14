import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { conversations, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id, minutes_used, minutes_limit')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: agent } = await supabase
    .from('agents')
    .select('elevenlabs_agent_id')
    .eq('org_id', org.id)
    .single()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Try ElevenLabs
  if (elConfigured() && agent?.elevenlabs_agent_id) {
    try {
      const data = await conversations.list({
        agent_id: agent.elevenlabs_agent_id,
        page_size: 100,
      })

      const all = data.conversations ?? []

      const totalCalls = all.length
      const durations = all.map((c) => c.call_duration_secs ?? 0)
      const totalDuration = durations.reduce((s, d) => s + d, 0)
      const completed = all.filter((c) => c.call_duration_secs && c.call_duration_secs > 0)
      const avgDuration = completed.length > 0
        ? Math.round(totalDuration / completed.length) : 0

      const todayUnix = Math.floor(todayStart.getTime() / 1000)
      const weekUnix = Math.floor(weekStart.getTime() / 1000)
      const monthUnix = Math.floor(monthStart.getTime() / 1000)

      const callsToday = all.filter((c) => (c.start_time_unix_secs ?? 0) >= todayUnix).length
      const callsThisWeek = all.filter((c) => (c.start_time_unix_secs ?? 0) >= weekUnix).length
      const callsThisMonth = all.filter((c) => (c.start_time_unix_secs ?? 0) >= monthUnix).length

      const sentimentBreakdown = {
        positive: all.filter((c) => c.call_successful === 'true').length,
        negative: all.filter((c) => c.call_successful === 'false').length,
        neutral: all.filter((c) => c.call_successful !== 'true' && c.call_successful !== 'false').length,
      }

      // Peak hour
      const hourCounts = new Array(24).fill(0)
      completed.forEach((c) => {
        if (c.start_time_unix_secs) {
          const h = new Date(c.start_time_unix_secs * 1000).getHours()
          hourCounts[h]++
        }
      })
      const peakHour = hourCounts.indexOf(Math.max(...hourCounts))

      const successRate = totalCalls > 0
        ? Math.round((completed.length / totalCalls) * 100) : 0

      return NextResponse.json({
        total_calls: totalCalls,
        total_duration_seconds: Math.round(totalDuration),
        avg_duration_seconds: avgDuration,
        calls_today: callsToday,
        calls_this_week: callsThisWeek,
        calls_this_month: callsThisMonth,
        sentiment_breakdown: sentimentBreakdown,
        peak_hour: peakHour,
        success_rate: successRate,
        minutes_used: org.minutes_used,
        minutes_limit: org.minutes_limit,
      })
    } catch (err) {
      console.error('ElevenLabs metrics failed, falling back to DB:', err)
    }
  }

  // Fallback: Supabase
  const todayISO = todayStart.toISOString()
  const weekISO = weekStart.toISOString()
  const monthISO = monthStart.toISOString()

  const { data: calls } = await supabase
    .from('calls')
    .select('duration_seconds, status, sentiment, started_at')
    .eq('org_id', org.id)

  const allCalls = calls ?? []
  const completedCalls = allCalls.filter((c) => c.status === 'completed')
  const totalDuration = allCalls.reduce((s, c) => s + (c.duration_seconds ?? 0), 0)

  const hourCounts = new Array(24).fill(0)
  completedCalls.forEach((c) => {
    const h = new Date(c.started_at).getHours()
    hourCounts[h]++
  })

  return NextResponse.json({
    total_calls: allCalls.length,
    total_duration_seconds: totalDuration,
    avg_duration_seconds: completedCalls.length > 0 ? Math.round(totalDuration / completedCalls.length) : 0,
    calls_today: allCalls.filter((c) => c.started_at >= todayISO).length,
    calls_this_week: allCalls.filter((c) => c.started_at >= weekISO).length,
    calls_this_month: allCalls.filter((c) => c.started_at >= monthISO).length,
    sentiment_breakdown: {
      positive: allCalls.filter((c) => c.sentiment === 'positive').length,
      neutral: allCalls.filter((c) => c.sentiment === 'neutral').length,
      negative: allCalls.filter((c) => c.sentiment === 'negative').length,
    },
    peak_hour: hourCounts.indexOf(Math.max(...hourCounts)),
    success_rate: allCalls.length > 0 ? Math.round((completedCalls.length / allCalls.length) * 100) : 0,
    minutes_used: org.minutes_used,
    minutes_limit: org.minutes_limit,
  })
}
