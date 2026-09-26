import type { Metadata } from 'next'
import { getOrgAgent, getOrgContext } from '@/lib/api/auth'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { VoiceLabClient } from '@/components/voice-lab/VoiceLabClient'

export const metadata: Metadata = {
  title: 'Voice Lab',
}

export default async function VoiceLabPage() {
  // The dashboard layout already requires a signed-in, onboarded organisation;
  // the agent only provides the starting language.
  const ctx = await getOrgContext()
  let language = 'en'
  if (ctx) {
    try {
      const agent = await getOrgAgent(ctx)
      language = normalizeAgentLanguage(agent?.language)
    } catch (error) {
      console.error('[voice-lab] loading the agent language failed', error instanceof Error ? error.message : error)
    }
  }
  return <VoiceLabClient defaultLanguage={language} />
}
