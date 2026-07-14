import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { conversations, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

export interface ChartDataPoint {
  date: string
  calls: number
  duration: number
}

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

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  // Try ElevenLabs
  if (elConfigured() && agent?.elevenlabs_agent_id) {
    try {
      const data = await conversations.list({
        agent_id: agent.elevenlabs_agent_id,
        page_size: 100,
        call_start_after_unix: Math.floor(sevenDaysAgo.getTime() / 1000),
      })

      const convs = data.conversations ?? []
      const result: ChartDataPoint[] = []

      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        d.setHours(0, 0, 0, 0)
        const dayStartUnix = Math.floor(d.getTime() / 1000)
        const dayEndUnix = dayStartUnix + 86400

        const dayCalls = convs.filter((c) => {
          const t = c.start_time_unix_secs ?? 0
          return t >= dayStartUnix && t < dayEndUnix
        })

        const completed = dayCalls.filter((c) => c.call_duration_secs && c.call_duration_secs > 0)
        const totalSecs = completed.reduce((s, c) => s + (c.call_duration_secs ?? 0), 0)
        const avgMins = completed.length > 0
          ? Math.round((totalSecs / completed.length) / 60 * 10) / 10 : 0

        result.push({
          date: days[d.getDay()],
          calls: dayCalls.length,
          duration: avgMins,
        })
      }

      return NextResponse.json(result)
    } catch (err) {
      console.error('ElevenLabs calls-chart failed, falling back to DB:', err)
    }
  }

  // Fallback: Supabase
  const result: ChartDataPoint[] = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const dayStart = d.toISOString()
    const dayEnd = new Date(d.getTime() + 86400000).toISOString()

    const { data: calls } = await supabase
      .from('calls')
      .select('duration_seconds, status')
      .eq('org_id', org.id)
      .gte('started_at', dayStart)
      .lt('started_at', dayEnd)

    const dayCalls = calls ?? []
    const completed = dayCalls.filter((c) => c.status === 'completed')
    const totalSecs = completed.reduce((s, c) => s + (c.duration_seconds ?? 0), 0)
    const avgMins = completed.length > 0
      ? Math.round((totalSecs / completed.length) / 60 * 10) / 10 : 0

    result.push({
      date: days[d.getDay()],
      calls: dayCalls.length,
      duration: avgMins,
    })
  }

  return NextResponse.json(result)
}
