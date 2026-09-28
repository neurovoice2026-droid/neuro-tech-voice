'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookingSkill } from '@/components/skills/BookingSkill'
import { TeamSkill } from '@/components/skills/TeamSkill'
import { MessagesSkill } from '@/components/skills/MessagesSkill'
import { LeadQuestionsSkill } from '@/components/skills/LeadQuestionsSkill'
import { errorMessage, isAbortError, requestJson } from '@/components/skills/request'
import type { ContactsResponse } from '@/components/skills/types'
import type { AgentUpdate } from '@/components/agent/types'
import type { Agent, EscalationContact } from '@/types'

const SECTIONS = [
  { id: 'booking', label: 'Booking' },
  { id: 'team', label: 'Team and transfers' },
  { id: 'messages', label: 'Messages' },
  { id: 'lead-questions', label: 'Lead questions' },
]

interface TabSkillsProps {
  agent: Agent
  onUpdate: AgentUpdate
  isSaving: boolean
  onDirtyChange?: (dirty: boolean) => void
  /**
   * Team and booking changes are saved by their own routes, which update the
   * agent's providers in the background; the page follows that sync.
   */
  onProviderSyncStarted?: () => void
}

export function TabSkills({ agent, onUpdate, isSaving, onDirtyChange, onProviderSyncStarted }: TabSkillsProps) {
  const [contacts, setContacts] = useState<EscalationContact[] | null>(null)
  const [contactsMax, setContactsMax] = useState(25)
  const [contactsAvailable, setContactsAvailable] = useState(true)
  const [contactsError, setContactsError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [bookingDirty, setBookingDirty] = useState(false)
  const [leadDirty, setLeadDirty] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    requestJson<ContactsResponse>('/api/contacts', { signal: controller.signal })
      .then((res) => {
        setContacts(res.contacts)
        setContactsMax(res.max)
        setContactsAvailable(res.available)
        setContactsError(null)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setContactsError(errorMessage(error, 'We couldn’t load your team.'))
      })
    return () => controller.abort()
  }, [reloadKey])

  useEffect(() => {
    onDirtyChange?.(bookingDirty || leadDirty)
  }, [bookingDirty, leadDirty, onDirtyChange])

  const retryContacts = useCallback(() => {
    setContactsError(null)
    setContacts(null)
    setReloadKey((k) => k + 1)
  }, [])

  return (
    <div className="space-y-6">
      <nav aria-label="Skills" className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <BookingSkill agentWorkingHours={agent.working_hours} onDirtyChange={setBookingDirty} onSaved={onProviderSyncStarted} />

      <TeamSkill
        contacts={contacts}
        max={contactsMax}
        available={contactsAvailable}
        loadError={contactsError}
        onRetry={retryContacts}
        onContactsChange={setContacts}
        onSaved={onProviderSyncStarted}
      />

      <MessagesSkill contacts={contacts} contactsFailed={Boolean(contactsError)} />

      <LeadQuestionsSkill leadFields={agent.lead_fields ?? []} onUpdate={onUpdate} isSaving={isSaving} onDirtyChange={setLeadDirty} />
    </div>
  )
}
