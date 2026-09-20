// Tab ids for the agent page, shared by the server page (?tab=) and the client.

export const AGENT_TABS = ['general', 'conversation', 'voice', 'knowledge', 'skills'] as const
export type AgentTab = (typeof AGENT_TABS)[number]

export function parseAgentTab(value: unknown): AgentTab {
  const raw = Array.isArray(value) ? value[0] : value
  return AGENT_TABS.find((tab) => tab === raw) ?? 'general'
}
