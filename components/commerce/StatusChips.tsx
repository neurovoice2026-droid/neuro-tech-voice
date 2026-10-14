import { OrbInline } from '@/components/shared/OrbLoader'
import { StatusChip } from '@/components/shared/StatusChip'
import type { OrderListDto } from '@/lib/commerce/types'
import {
  connectionStatusLabel, connectionStatusTone,
  orderStatusLabel, orderStatusTone,
  runOutcomeLabel, runOutcomeTone,
  runStatusLabel, runStatusTone,
  stockStatusLabel, stockStatusTone,
} from './labels'

// The Store section's chips: tone + dot/icon + text, built on the shared
// StatusChip so a status is never colour alone.

export function ConnectionStatusChip({ status, className }: { status: string | null | undefined; className?: string }) {
  const connecting = status === 'connecting'
  return (
    <StatusChip
      tone={connectionStatusTone(status)}
      dot={!connecting}
      icon={connecting ? <OrbInline state="connecting" /> : undefined}
      className={className}
    >
      {connectionStatusLabel(status)}
    </StatusChip>
  )
}

export function RunStatusChip({ status, className }: { status: string; className?: string }) {
  const live = status === 'calling'
  return (
    <StatusChip tone={runStatusTone(status)} dot={!live} live={live} className={className}>
      {runStatusLabel(status)}
    </StatusChip>
  )
}

/** The outcome chip, or a muted dash when the run has none yet (never an empty cell). */
export function RunOutcomeChip({ outcome, className }: { outcome: string | null; className?: string }) {
  const label = runOutcomeLabel(outcome)
  if (!label) return <span className="text-[13px] text-muted-foreground">—</span>
  return (
    <StatusChip tone={runOutcomeTone(outcome)} dot className={className}>
      {label}
    </StatusChip>
  )
}

export function OrderStatusChip({ status, className }: { status: OrderListDto['status'] | string; className?: string }) {
  return (
    <StatusChip tone={orderStatusTone(status)} dot className={className}>
      {orderStatusLabel(status)}
    </StatusChip>
  )
}

export function StockStatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <StatusChip tone={stockStatusTone(status)} dot className={className}>
      {stockStatusLabel(status)}
    </StatusChip>
  )
}

export function CodChip({ className }: { className?: string }) {
  return (
    <StatusChip tone="warning" className={className} title="Cash on delivery">
      COD
    </StatusChip>
  )
}
