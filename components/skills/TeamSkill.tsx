'use client'

import { useState } from 'react'
import { BellRing, Mail, MessageSquareText, Pencil, PhoneForwarded, Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { SectionError, SkillSection } from '@/components/skills/SkillSection'
import { ContactDialog } from '@/components/skills/ContactDialog'
import { errorMessage, requestJson } from '@/components/skills/request'
import type { EscalationContact } from '@/types'

interface TeamSkillProps {
  contacts: EscalationContact[] | null
  max: number
  available: boolean
  loadError: string | null
  onRetry: () => void
  onContactsChange: (contacts: EscalationContact[]) => void
  /** Called after a person is added, edited or removed (the agent's providers update in the background). */
  onSaved?: () => void
}

export function TeamSkill({ contacts, max, available, loadError, onRetry, onContactsChange, onSaved }: TeamSkillProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EscalationContact | null>(null)
  const [deleting, setDeleting] = useState<EscalationContact | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  const description =
    'The people your agent can put callers through to during a call, or alert when a message or something urgent comes in.'

  const transferCount = contacts?.filter((c) => c.transfer_enabled && c.phone).length ?? 0
  const status = contacts
    ? transferCount > 0
      ? { label: `${transferCount} can take transfers`, tone: 'on' as const }
      : contacts.length > 0
        ? { label: 'Alerts only', tone: 'neutral' as const }
        : { label: 'No one added', tone: 'off' as const }
    : null

  const openAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleting || !contacts) return
    setDeletePending(true)
    try {
      await requestJson(`/api/contacts/${deleting.id}`, { method: 'DELETE' })
      onContactsChange(contacts.filter((c) => c.id !== deleting.id))
      toast.success(`${deleting.name} removed from your team`)
      setDeleting(null)
      onSaved?.()
    } catch (error) {
      toast.error('This person wasn’t removed', { description: errorMessage(error) })
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <SkillSection id="team" icon={Users} title="Team and transfers" description={description} status={status}>
      {loadError ? (
        <SectionError message={loadError} onRetry={onRetry} />
      ) : !contacts ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading your team">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !available ? (
        <p className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
          Team contacts aren’t switched on for your account yet. We’re finishing an update; please check back soon.
        </p>
      ) : (
        <div className="space-y-3">
          {contacts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team members yet"
              description="Add the people callers may need: a manager, the on-call technician, the front desk."
              action={
                <Button type="button" onClick={openAdd}>
                  <Plus aria-hidden="true" />
                  Add a team member
                </Button>
              }
              className="py-8"
            />
          ) : (
            <>
              <ul className="space-y-2">
                {contacts.map((contact) => (
                  <li key={contact.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {contact.name}
                          {contact.role && <span className="font-normal text-muted-foreground"> · {contact.role}</span>}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {[contact.phone, contact.email].filter(Boolean).join(' · ')}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {contact.transfer_enabled && contact.phone && <Tag icon={PhoneForwarded} label="Live transfers" />}
                          {contact.is_on_call && <Tag icon={BellRing} label="On call" />}
                          {contact.notify_sms && contact.phone && <Tag icon={MessageSquareText} label="Text alerts" />}
                          {contact.notify_email && contact.email && <Tag icon={Mail} label="Email alerts" />}
                        </div>
                        {contact.conditions && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">When:</span> {contact.conditions}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditing(contact)
                            setDialogOpen(true)
                          }}
                          aria-label={`Edit ${contact.name}`}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleting(contact)}
                          aria-label={`Remove ${contact.name}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" onClick={openAdd} disabled={contacts.length >= max}>
                  <Plus aria-hidden="true" />
                  Add a team member
                </Button>
                <span className="text-xs text-muted-foreground">
                  {contacts.length}/{max} people
                </span>
              </div>
              {transferCount === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nobody can take live transfers yet. Edit someone and tick “Put live calls through” to let your agent connect callers.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <ContactDialog
        open={dialogOpen}
        contact={editing}
        onOpenChange={setDialogOpen}
        onSaved={(saved) => {
          const list = contacts ?? []
          onContactsChange(list.some((c) => c.id === saved.id) ? list.map((c) => (c.id === saved.id ? saved : c)) : [...list, saved])
          onSaved?.()
        }}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && !deletePending && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {deleting?.name}?</DialogTitle>
            <DialogDescription>
              Your agent will stop transferring calls to them and stop sending them alerts. Past messages stay in your inbox.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletePending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletePending}>
              {deletePending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SkillSection>
  )
}

function Tag({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
      <Icon className="size-3 text-muted-foreground" aria-hidden="true" />
      {label}
    </span>
  )
}
