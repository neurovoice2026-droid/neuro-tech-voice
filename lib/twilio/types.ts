// Shapes the Phone Numbers API returns and the dashboard renders. Client-safe.

export type NumberRoutingStatus = 'connected' | 'needs_reconnect'

export interface PhoneNumberView {
  id: string
  number: string
  friendly_name: string | null
  country: string | null
  is_active: boolean
  agent_id: string | null
  agent_name: string | null
  /** The number can send and receive texts (booking confirmations, reminders). */
  sms_capable: boolean
  /** connected = calls reach the app router with the current URL. */
  routing_status: NumberRoutingStatus
  /** Still imported into ElevenLabs (bought before the voice upgrade): calls are answered there until reconnected. */
  legacy_import: boolean
  /** Owner-readable reason the last reconnect failed. */
  routing_error: string | null
  routing_synced_at: string | null
  monthly_cost: number | null
  created_at: string
}

export interface AvailableNumber {
  number: string
  friendly_name: string
  locality: string
  region: string
  capabilities: { voice: boolean; sms: boolean; mms: boolean }
}

export interface PhoneSearchResponse {
  numbers: AvailableNumber[]
  /** At least one result can send texts. */
  sms_available: boolean
}
