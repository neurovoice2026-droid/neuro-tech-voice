import type { SchedulingSettingsInput } from '@/app/api/scheduling/schema'
import type { EscalationContact, Plan } from '@/types'

/** GET/PUT /api/scheduling */
export interface SchedulingResponse {
  settings: SchedulingSettingsInput
  saved: boolean
  available: boolean
  entitled: boolean
  required_plan: Plan
  google: { configured: boolean; connected: boolean; account_email: string | null }
  calendars: { id: string; name: string; primary: boolean }[] | null
  calendars_error: string | null
  sms: { entitled: boolean; required_plan: Plan; org_enabled: boolean }
  timezone: string
}

/** GET /api/contacts */
export interface ContactsResponse {
  contacts: EscalationContact[]
  available: boolean
  max: number
}
