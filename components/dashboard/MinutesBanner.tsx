import { Clock } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { MINUTES_ACTION_ROW, MinutesActionLinks } from '@/components/billing/MinutesActionLinks'
import { minutesBannerActions, minutesBannerCopy, type MinutesBannerState } from '@/components/billing/minutes-logic'
import { cn } from '@/lib/utils'

/**
 * The minutes banner on every dashboard page (DashboardShell): out of
 * minutes (calls are paused) or running low. The state is decided on the
 * server by the dashboard layout (components/billing/minutes-logic.ts
 * minutesBannerState), where the minute-cap switch is known. Both states
 * offer the same choice: the next plan up of the organization's family and
 * the 100-minute pack (lib/billing/upgrade.ts; no pack on the trial).
 */
export function MinutesBanner({ state, className }: { state: MinutesBannerState; className?: string }) {
  const { title, description } = minutesBannerCopy(state)
  return (
    <Alert variant={state.kind === 'out' ? 'destructive' : 'warning'} className={cn(className)}>
      <Clock aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {/* Below `sm` the buttons share the text column and a long upgrade label wraps inside it; from `sm` they
          stack in the trailing column, so the label wraps there instead of squeezing the text. */}
      <AlertAction className={cn(MINUTES_ACTION_ROW, 'sm:max-w-72 sm:flex-col sm:items-stretch')}>
        <MinutesActionLinks actions={minutesBannerActions(state)} />
      </AlertAction>
    </Alert>
  )
}
