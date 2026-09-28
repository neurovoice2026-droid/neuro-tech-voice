'use client'

import { useEffect, useState } from 'react'
import { Building2, Clock, Loader2, MessageSquareText, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { UpgradeNotice } from '@/components/shared/UpgradeNotice'
import { TimezoneCombobox } from '@/components/settings/TimezoneCombobox'
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog'
import { errorMessage, requestJson } from '@/components/skills/request'
import { canonicalTimeZone, timeZoneOffsetLabel } from '@/app/api/settings/timezone'
import type { Plan } from '@/types'

const NAME_MAX = 100

interface SettingsPageClientProps {
  organization: { name: string | null; timezone: string; sms_enabled: boolean }
  email: string | null
  smsEntitled: boolean
  smsRequiredPlan: Plan
}

interface SettingsResponse {
  organization: { name: string | null; timezone: string; sms_enabled: boolean }
}

function useClock(timeZone: string): string {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const timer = window.setInterval(tick, 30_000)
    return () => window.clearInterval(timer)
  }, [])
  if (!now) return ''
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(now)
  } catch {
    return ''
  }
}

export function SettingsPageClient({ organization, email, smsEntitled, smsRequiredPlan }: SettingsPageClientProps) {
  const router = useRouter()
  const [saved, setSaved] = useState(organization)
  const [name, setName] = useState(organization.name ?? '')
  const [timezone, setTimezone] = useState(organization.timezone)
  const [savingName, setSavingName] = useState(false)
  const [savingZone, setSavingZone] = useState(false)
  const [savingSms, setSavingSms] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [browserZone, setBrowserZone] = useState<string | null>(null)
  const clock = useClock(timezone)

  useEffect(() => {
    setBrowserZone(canonicalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone))
  }, [])

  const save = async (patch: Partial<SettingsResponse['organization']>, success: string) => {
    const res = await requestJson<SettingsResponse>('/api/settings', { method: 'PATCH', body: patch })
    setSaved(res.organization)
    toast.success(success)
    // The shell and other pages read the organization on the server.
    router.refresh()
    return res.organization
  }

  const trimmedName = name.trim()
  const nameError = !trimmedName ? 'Add your business name.' : trimmedName.length > NAME_MAX ? `Keep it under ${NAME_MAX} characters.` : null
  const nameDirty = trimmedName !== (saved.name ?? '')

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault()
    if (nameError || !nameDirty) return
    setSavingName(true)
    try {
      const org = await save({ name: trimmedName }, 'Business name saved')
      setName(org.name ?? '')
    } catch (err) {
      toast.error('Your business name wasn’t saved', { description: errorMessage(err) })
    } finally {
      setSavingName(false)
    }
  }

  const saveZone = async () => {
    if (timezone === saved.timezone) return
    setSavingZone(true)
    try {
      const org = await save({ timezone }, 'Time zone saved')
      setTimezone(org.timezone)
    } catch (err) {
      toast.error('Your time zone wasn’t saved', { description: errorMessage(err) })
    } finally {
      setSavingZone(false)
    }
  }

  const toggleSms = async (enabled: boolean) => {
    const previous = saved
    setSaved({ ...saved, sms_enabled: enabled })
    setSavingSms(true)
    try {
      await save({ sms_enabled: enabled }, enabled ? 'Texts to callers are on' : 'Texts to callers are off')
    } catch (err) {
      setSaved(previous)
      toast.error('That change wasn’t saved', { description: errorMessage(err) })
    } finally {
      setSavingSms(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm break-words text-muted-foreground">
          Your business details, time zone and messaging{email ? ` for ${email}` : ''}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
            Business name
          </CardTitle>
          <CardDescription>Your agent uses it when it greets callers and in text messages.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveName} className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1 space-y-1.5 sm:max-w-sm">
              <Label htmlFor="org-name" className="sr-only">
                Business name
              </Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="organization"
                aria-invalid={Boolean(nameError) && nameDirty}
                aria-describedby={nameError && nameDirty ? 'org-name-error' : undefined}
              />
              {nameError && nameDirty && (
                <p id="org-name-error" className="text-xs text-destructive">
                  {nameError}
                </p>
              )}
            </div>
            <Button type="submit" disabled={!nameDirty || Boolean(nameError) || savingName} className="sm:w-auto">
              {savingName && <Loader2 className="animate-spin" aria-hidden="true" />}
              {savingName ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            Time zone
          </CardTitle>
          <CardDescription>
            Used for your working hours, bookings, reminders and call statistics. Your agent tells callers times in this zone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="org-timezone" className="sr-only">
            Time zone
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1 sm:max-w-sm">
              <TimezoneCombobox id="org-timezone" value={timezone} onChange={setTimezone} disabled={savingZone} describedBy="org-timezone-help" />
            </div>
            <Button type="button" onClick={saveZone} disabled={timezone === saved.timezone || savingZone}>
              {savingZone && <Loader2 className="animate-spin" aria-hidden="true" />}
              {savingZone ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <p id="org-timezone-help" className="min-h-4 text-xs text-muted-foreground">
            {clock && (
              <>
                It’s {clock} there ({timeZoneOffsetLabel(timezone)}).{' '}
              </>
            )}
            {browserZone && browserZone !== timezone && (
              <button type="button" onClick={() => setTimezone(browserZone)} className="text-primary underline-offset-4 hover:underline">
                Use this device’s time zone ({browserZone.replace(/_/g, ' ')})
              </button>
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="size-4 text-muted-foreground" aria-hidden="true" />
            Text messages to callers
          </CardTitle>
          <CardDescription>
            Booking confirmations, reminders and details your agent texts during a call. Callers can always reply STOP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="sms-enabled" className="text-sm font-medium">
                Send texts to callers
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Texts go out from your phone number when it can send them. Turning this off stops texts to callers right away; text alerts to your own team keep working.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {savingSms && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
              <Switch
                id="sms-enabled"
                checked={smsEntitled && saved.sms_enabled}
                onCheckedChange={toggleSms}
                disabled={!smsEntitled || savingSms}
              />
            </div>
          </div>
          {!smsEntitled && <UpgradeNotice compact feature="Texts to callers" requiredPlan={smsRequiredPlan} />}
        </CardContent>
      </Card>

      <Card className="ring-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <TriangleAlert className="size-4" aria-hidden="true" />
            Danger zone
          </CardTitle>
          <CardDescription>
            Delete your account and everything in it: your agent, phone numbers, calls, recordings, documents and settings.
            Subscriptions are cancelled. This can’t be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete account
          </Button>
        </CardContent>
      </Card>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} orgName={saved.name} />
    </div>
  )
}
