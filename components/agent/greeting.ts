// Greeting helpers for the agent settings. An empty first_message means the
// agent uses the generated greeting for its tone and language at call time
// (lib/voice/session.ts), so "automatic" also covers a stored greeting that is
// exactly the generated one (onboarding saves it that way).

import { greetingFor } from '@/lib/voice/greetings'
import type { Agent, AgentTone } from '@/types'

export function generatedGreeting(input: { language: string; tone: AgentTone; orgName: string | null; agentName: string }): string {
  return greetingFor({
    language: input.language,
    tone: input.tone,
    company: input.orgName ?? '',
    agentName: input.agentName,
  })
}

export function isAutomaticGreeting(
  agent: Pick<Agent, 'first_message' | 'language' | 'tone' | 'name'>,
  orgName: string | null
): boolean {
  const text = agent.first_message?.trim()
  if (!text) return true
  return text === generatedGreeting({ language: agent.language, tone: agent.tone, orgName, agentName: agent.name })
}

/** Keeps a preview under the preview endpoint's limit, cutting at a sentence end when possible. */
export function clipForPreview(text: string, max = 300): { text: string; clipped: boolean } {
  const clean = text.trim()
  if (clean.length <= max) return { text: clean, clipped: false }
  const slice = clean.slice(0, max)
  const lastStop = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('。'),
    slice.lastIndexOf('।')
  )
  const cut = lastStop > max * 0.5 ? slice.slice(0, lastStop + 1) : slice
  return { text: cut.trim(), clipped: true }
}
