import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { getGoogleClientWithToken } from '@/lib/google/client'
import { sendEmail, isConfigured as emailConfigured } from '@/lib/email/client'

interface CallRow {
  id: string
  caller_number: string | null
  direction: string
  duration_seconds: number | null
  sentiment: string | null
  summary: string | null
  started_at: string | null
}

function report(call: CallRow): string {
  return [
    'Call report',
    '',
    `Caller: ${call.caller_number ?? 'Unknown'}`,
    `Direction: ${call.direction}`,
    `Duration: ${call.duration_seconds ?? 0}s`,
    `Sentiment: ${call.sentiment ?? 'unknown'}`,
    `Date: ${call.started_at ?? ''}`,
    '',
    'Summary:',
    call.summary ?? '(no summary)',
  ].join('\n')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { type } = (await request.json()) as { type: string }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // The call id may be a DB uuid or an ElevenLabs conversation id.
  const { data: call } = await supabase
    .from('calls')
    .select('id, caller_number, direction, duration_seconds, sentiment, summary, started_at')
    .eq('org_id', org.id)
    .or(`id.eq.${id},elevenlabs_conversation_id.eq.${id}`)
    .maybeSingle()

  if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

  try {
    // ── Email summary (uses Resend, sent to the account owner) ──────────────
    if (type === 'gmail') {
      if (!emailConfigured()) {
        return NextResponse.json({ error: 'Email is not configured' }, { status: 400 })
      }
      if (!user.email) {
        return NextResponse.json({ error: 'No email on file' }, { status: 400 })
      }
      const ok = await sendEmail({
        to: user.email,
        subject: `Call summary — ${call.caller_number ?? 'Unknown'}`,
        html: `<pre style="font-family:inherit;white-space:pre-wrap">${report(call)
          .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))}</pre>`,
      })
      if (!ok) return NextResponse.json({ error: 'Failed to send email' }, { status: 502 })
      return NextResponse.json({ success: true, message: `Summary emailed to ${user.email}` })
    }

    // ── Google actions need a connected integration with a refresh token ────
    const { data: integration } = await supabase
      .from('integrations')
      .select('google_refresh_token, is_active, config')
      .eq('org_id', org.id)
      .eq('type', type)
      .maybeSingle()

    if (!integration?.is_active || !integration.google_refresh_token) {
      return NextResponse.json({ error: 'Integration not connected' }, { status: 400 })
    }

    const auth = getGoogleClientWithToken(integration.google_refresh_token as string)

    if (type === 'google_docs') {
      const docs = google.docs({ version: 'v1', auth })
      const created = await docs.documents.create({
        requestBody: { title: `Call report — ${call.caller_number ?? 'Unknown'} — ${call.started_at ?? ''}` },
      })
      const documentId = created.data.documentId
      if (documentId) {
        await docs.documents.batchUpdate({
          documentId,
          requestBody: { requests: [{ insertText: { location: { index: 1 }, text: report(call) } }] },
        })
      }
      return NextResponse.json({ success: true, message: 'Call report created in Google Docs' })
    }

    if (type === 'google_sheets') {
      const sheets = google.sheets({ version: 'v4', auth })
      const cfg = (integration.config ?? {}) as Record<string, string>
      let spreadsheetId: string | undefined = cfg.call_log_spreadsheet_id

      // Create a single per-org call-log spreadsheet on first use.
      if (!spreadsheetId) {
        const created = await sheets.spreadsheets.create({
          requestBody: { properties: { title: 'Neuro Tech Voice — Call Log' } },
        })
        spreadsheetId = created.data.spreadsheetId ?? undefined
        if (spreadsheetId) {
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'A:Z',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['Date', 'Caller', 'Direction', 'Duration (s)', 'Sentiment', 'Summary']] },
          })
          await supabase
            .from('integrations')
            .update({ config: { ...cfg, call_log_spreadsheet_id: spreadsheetId } })
            .eq('org_id', org.id)
            .eq('type', 'google_sheets')
        }
      }

      if (!spreadsheetId) {
        return NextResponse.json({ error: 'Could not access spreadsheet' }, { status: 502 })
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'A:Z',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            call.started_at ?? '',
            call.caller_number ?? '',
            call.direction,
            String(call.duration_seconds ?? 0),
            call.sentiment ?? '',
            call.summary ?? '',
          ]],
        },
      })
      return NextResponse.json({ success: true, message: 'Call logged to Google Sheets' })
    }

    return NextResponse.json({ error: `Unsupported integration: ${type}` }, { status: 400 })
  } catch (err) {
    console.error(`Integration action (${type}) failed:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Integration action failed' },
      { status: 502 }
    )
  }
}
