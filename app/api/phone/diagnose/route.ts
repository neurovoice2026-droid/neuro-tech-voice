import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { phoneNumbers as elPhone, isConfigured as elConfigured } from '@/lib/elevenlabs/client'
import { createAgentWithFallback } from '@/lib/elevenlabs/create-agent'
import { getTwilioClient } from '@/lib/twilio/client'

// Diagnostic + repair endpoint for phone routing. Open in the browser while
// logged in: it reports the DB + ElevenLabs state and tries to (re)link each
// number to the agent, surfacing the real ElevenLabs error if any.
//
// IMPORTANT: ElevenLabs only auto-configures the Twilio voice webhook during
// import (their documented behavior - "ElevenLabs automatically configures
// the Twilio phone number with the correct settings"). A plain PATCH that
// only changes agent_id on an already-imported number does not reliably
// retrigger that configuration, so every repair here deletes the existing
// ElevenLabs phone number (if any) and re-imports it fresh with the agent_id
// already attached, rather than patching in place. A previous version of
// this endpoint instead force-set a hand-written static webhook URL - that
// produced Twilio's generic "application error" tone for at least one real
// number, so don't reintroduce a hardcoded ElevenLabs URL without solid
// evidence it's correct for the account in question.
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!org) return NextResponse.json({ error: 'No organization' }, { status: 404 })

  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, elevenlabs_agent_id, voice_id, voice_name, is_active, system_prompt, first_message, language')
    .eq('org_id', org.id)
    .limit(1)
    .maybeSingle()

  const { data: numbers } = await supabase
    .from('phone_numbers')
    .select('id, number, twilio_sid, elevenlabs_phone_number_id, agent_id, is_active')
    .eq('org_id', org.id)

  const report: Record<string, unknown> = {
    elevenlabs_configured: elConfigured(),
    twilio_env: {
      account_sid_set: !!process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your-twilio-account-sid',
      auth_token_set: !!process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_AUTH_TOKEN !== 'your-twilio-auth-token',
    },
    agent: agent ?? null,
    db_numbers: numbers ?? [],
  }

  const repair: unknown[] = []
  let elAgentId: string | null = (agent?.elevenlabs_agent_id as string) ?? null

  // ── Step 1: create the ElevenLabs agent if it's missing ──────────────────
  if (elConfigured() && agent && !elAgentId) {
    const result = await createAgentWithFallback({
      name: agent.name,
      system_prompt: agent.system_prompt,
      first_message: agent.first_message,
      language: agent.language,
      voice_id: agent.voice_id,
    })
    elAgentId = result.agent_id
    repair.push({ step: 'create_agent', ok: !!elAgentId, voice_error: result.voiceError, error: result.error })
    if (elAgentId) {
      await supabase.from('agents').update({ elevenlabs_agent_id: elAgentId, is_active: true }).eq('id', agent.id)
    }
  }

  // ── Step 2: delete + re-import each number so ElevenLabs reconfigures the
  // Twilio voice webhook fresh, then assign the agent at creation time ──────
  if (elConfigured() && agent && elAgentId) {
    for (const n of numbers ?? []) {
      if (n.elevenlabs_phone_number_id) {
        try {
          await elPhone.delete(n.elevenlabs_phone_number_id as string)
        } catch (e) {
          repair.push({ number: n.number, action: 'delete_failed', ok: false, error: e instanceof Error ? e.message : String(e) })
        }
        await supabase.from('phone_numbers').update({ elevenlabs_phone_number_id: null }).eq('id', n.id)
      }

      if (!n.twilio_sid || String(n.twilio_sid).startsWith('mock')) continue

      try {
        const imported = await elPhone.create({
          phone_number: n.number as string,
          label: `${org.id}-${n.number}`,
          agent_id: elAgentId,
          provider_config: {
            twilio: {
              account_sid: process.env.TWILIO_ACCOUNT_SID!,
              auth_token: process.env.TWILIO_AUTH_TOKEN!,
              phone_number_sid: n.twilio_sid as string,
            },
          },
        })
        await supabase
          .from('phone_numbers')
          .update({ elevenlabs_phone_number_id: imported.phone_number_id, agent_id: agent.id })
          .eq('id', n.id)

        // Don't just trust that create() succeeding means agent_id actually
        // stuck - read the record back from ElevenLabs directly and report
        // exactly what it says, so this is a real confirmation, not an
        // assumption based on a 2xx response.
        let confirmedAgentId: string | null | undefined = undefined
        try {
          const fetched = await elPhone.get(imported.phone_number_id)
          confirmedAgentId = (fetched.agent_id as string | undefined) ?? null
        } catch (e) {
          confirmedAgentId = undefined
          repair.push({ number: n.number, action: 'verify_fetch_failed', ok: false, error: e instanceof Error ? e.message : String(e) })
        }

        repair.push({
          number: n.number,
          action: 'imported_and_assigned',
          ok: confirmedAgentId === elAgentId,
          phone_number_id: imported.phone_number_id,
          requested_agent_id: elAgentId,
          confirmed_agent_id: confirmedAgentId,
        })
      } catch (e) {
        repair.push({ number: n.number, action: 'import_error', ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
  } else if (!elAgentId) {
    report.repair_note = 'Could not create/find an ElevenLabs agent — see repair_results for the error.'
  }

  report.repair_results = repair

  // ── Step 2c: confirm what ElevenLabs actually has AFTER repair (not a
  // stale pre-repair snapshot - a previous version of this report queried
  // the list before running repairs, so it always showed last run's state) ─
  if (elConfigured()) {
    try {
      const list = await elPhone.list()
      report.elevenlabs_phone_numbers = list.map((p) => ({
        phone_number_id: p.phone_number_id,
        phone_number: p.phone_number,
        agent_id: p.agent_id ?? null,
      }))
    } catch (e) {
      report.elevenlabs_list_error = e instanceof Error ? e.message : String(e)
    }
  }

  // ── Step 3: inspect the Twilio number's actual voice routing ─────────────
  // If voiceUrl is empty, Twilio has no instructions for inbound calls, so the
  // call just fails silently even though ElevenLabs has the agent assigned.
  // If it's set but the call still errors, the value itself is worth seeing.
  const twSidSet = (report.twilio_env as { account_sid_set: boolean }).account_sid_set
  if (twSidSet) {
    const twInfo: unknown[] = []
    for (const n of numbers ?? []) {
      if (!n.twilio_sid || String(n.twilio_sid).startsWith('mock')) continue
      try {
        const tw = await getTwilioClient().incomingPhoneNumbers(n.twilio_sid as string).fetch()
        twInfo.push({
          number: n.number,
          status: tw.status,
          voiceUrl: tw.voiceUrl || null,
          voiceMethod: tw.voiceMethod || null,
          voiceApplicationSid: tw.voiceApplicationSid || null,
          voiceReceiveMode: (tw as unknown as { voiceReceiveMode?: string }).voiceReceiveMode ?? null,
          capabilities: tw.capabilities,
          trunkSid: (tw as unknown as { trunkSid?: string }).trunkSid ?? null,
        })
      } catch (e) {
        twInfo.push({ number: n.number, error: e instanceof Error ? e.message : String(e) })
      }
    }
    report.twilio_numbers = twInfo
  }

  return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
}
