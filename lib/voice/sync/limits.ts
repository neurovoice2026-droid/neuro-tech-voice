// Length limits for agent settings, shared by the API schemas (./schemas) and
// the dashboard inputs. No zod here, so the agent page can show the limits
// without shipping the validation library.

export const AGENT_LIMITS = {
  name: 64,
  systemPrompt: 8000,
  firstMessage: 600,
  fallbackMessage: 300,
  notInDocumentsMessage: 300,
  keyterms: 100,
  keytermChars: 100,
  leadFields: 12,
  voiceName: 100,
  scheduleMessage: 500,
  companyName: 120,
  companyDescription: 2000,
} as const
