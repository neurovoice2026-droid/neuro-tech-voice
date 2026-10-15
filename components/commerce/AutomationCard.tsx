'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ban, ChevronRight, PackageCheck, PhoneForwarded, ShoppingCart, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { OrbInline } from '@/components/shared/OrbLoader'
import { StatusChip } from '@/components/shared/StatusChip'
import { commerceErrorMessage } from '@/hooks/useCommerceApi'
import { enableBlocked, saveAutomation } from '@/hooks/useCommerceAutomations'
import type { AutomationDto, AutomationType } from '@/lib/commerce/types'
import { cn } from '@/lib/utils'
import { formatCount } from './format'
import { AUTOMATION_TYPE_DESCRIPTION, AUTOMATION_TYPE_LABEL, STORE_PATHS, automationHref } from './labels'

const ICON: Record<AutomationType, LucideIcon> = {
  cod_confirmation: PhoneForwarded,
  abandoned_cart: ShoppingCart,
  order_follow_up: PackageCheck,
}

/** True when the template was never saved (the contract: `id` is null until configured). */
export function isConfigured(automation: AutomationDto): boolean {
  return typeof automation.id === 'string' && automation.id.length > 0
}

interface AutomationCardProps {
  automation: AutomationDto
  /** The server's row after the toggle (the card itself shows what the server answered). */
  onChanged: (automation: AutomationDto) => void
  className?: string
}

/**
 * Tinted tile per automation template. What it shows is what is true:
 * - unavailable on this platform → "Unavailable" + the reason, no switch;
 * - available but never configured → "Set up" link, no switch;
 * - configured but the consent is not confirmed → "Confirm consent" link, no switch
 *   (the route refuses to enable without it; pausing an enabled one never needs it);
 * - configured with consent → an enable/pause switch wired to PUT /api/commerce/automations/[type].
 */
export function AutomationCard({ automation, onChanged, className }: AutomationCardProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const Icon = ICON[automation.type]
  const configured = isConfigured(automation)
  const consentGiven = Boolean(automation.consent_confirmed_at)
  const needsConsent = configured && automation.available && !automation.enabled && !consentGiven
  const canToggle = configured && automation.available && !needsConsent
  const { stats } = automation

  async function toggle(enabled: boolean) {
    setPending(true)
    try {
      const next = await saveAutomation(automation.type, { connection_id: automation.connection_id, enabled })
      onChanged(next)
      toast.success(next.enabled ? 'Automation turned on' : 'Automation turned off', {
        description: AUTOMATION_TYPE_LABEL[next.type],
      })
    } catch (err) {
      const blocked = enableBlocked(err)
      if (blocked) {
        toast.warning('The automation cannot be enabled yet', {
          description: blocked.message,
          duration: 10_000,
          ...(blocked.href && blocked.action ? { action: { label: blocked.action, onClick: () => router.push(blocked.href!) } } : {}),
        })
      } else {
        toast.error('The automation state could not be changed', { description: commerceErrorMessage(err, 'Try again.') })
      }
    } finally {
      setPending(false)
    }
  }

  const switchId = `automation-${automation.type}`

  return (
    <div data-slot="automation-card" className={cn('flex min-w-0 flex-col gap-3 rounded-2xl bg-secondary p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-foreground shadow-hair">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {!automation.available ? (
          <StatusChip tone="muted" icon={<Ban aria-hidden="true" />}>Unavailable</StatusChip>
        ) : !configured ? (
          <StatusChip tone="muted" dot>Not set up</StatusChip>
        ) : automation.enabled ? (
          <StatusChip tone="success" dot>On</StatusChip>
        ) : (
          <StatusChip tone="muted" dot>Off</StatusChip>
        )}
      </div>

      <div className="min-w-0">
        <h3 id={`${switchId}-title`} className="text-[15px] leading-[22px] font-medium text-foreground">
          {AUTOMATION_TYPE_LABEL[automation.type]}
        </h3>
        <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
          {!automation.available && automation.unavailable_reason ? automation.unavailable_reason : AUTOMATION_TYPE_DESCRIPTION[automation.type]}
        </p>
        {needsConsent && (
          <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">It can be enabled once customer consent is confirmed.</p>
        )}
      </div>

      {configured && automation.available && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-4 text-muted-foreground tabular-nums">
          <div className="flex gap-1"><dt>Scheduled</dt><dd className="font-medium text-foreground">{formatCount(stats.scheduled)}</dd></div>
          {stats.retrying > 0 && <div className="flex gap-1"><dt>Retrying</dt><dd className="font-medium text-foreground">{formatCount(stats.retrying)}</dd></div>}
          <div className="flex gap-1"><dt>Completed</dt><dd className="font-medium text-foreground">{formatCount(stats.completed)}</dd></div>
          <div className="flex gap-1"><dt>Failed</dt><dd className="font-medium text-foreground">{formatCount(stats.failed)}</dd></div>
        </dl>
      )}

      <div className="mt-auto flex min-h-8 items-center justify-between gap-3 pt-1">
        {automation.available ? (
          <Link
            href={automationHref(automation.type)}
            className={cn(buttonVariants({ variant: configured ? 'ghost' : 'outline', size: 'sm' }), 'tap-44 -ml-2', !configured && 'ml-0')}
          >
            {configured ? 'Settings' : 'Set up'}
            <ChevronRight aria-hidden="true" />
          </Link>
        ) : (
          <Link href={STORE_PATHS.connections} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'tap-44 -ml-2 text-muted-foreground')}>
            View capabilities
            <ChevronRight aria-hidden="true" />
          </Link>
        )}
        {needsConsent && (
          <Link href={automationHref(automation.type)} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'tap-44')}>
            Confirm consent
            <ChevronRight aria-hidden="true" />
          </Link>
        )}
        {canToggle && (
          <span className="flex items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center" aria-hidden={!pending}>
              {pending && <OrbInline state="working" label="Saving" />}
            </span>
            <label htmlFor={switchId} className="text-[13px] text-muted-foreground select-none">
              {automation.enabled ? 'On' : 'Off'}
            </label>
            <Switch
              id={switchId}
              checked={automation.enabled}
              onCheckedChange={(checked) => void toggle(checked)}
              disabled={pending}
              aria-describedby={`${switchId}-title`}
            />
          </span>
        )}
      </div>
    </div>
  )
}
