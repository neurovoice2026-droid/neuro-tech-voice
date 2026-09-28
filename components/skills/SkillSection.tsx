import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type SkillStatusTone = 'on' | 'off' | 'warning' | 'neutral'

const STATUS_STYLES: Record<SkillStatusTone, string> = {
  on: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400',
  off: 'border-border bg-muted text-muted-foreground',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  neutral: 'border-border bg-background text-foreground',
}

interface SkillSectionProps {
  id: string
  icon: LucideIcon
  title: string
  description: string
  status?: { label: string; tone: SkillStatusTone } | null
  children: React.ReactNode
}

/** One skill on the Skills tab: a titled card with a status pill. */
export function SkillSection({ id, icon: Icon, title, description, status, children }: SkillSectionProps) {
  return (
    <Card id={id} role="region" aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-4.5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle id={`${id}-title`} className="text-base">
                {title}
              </CardTitle>
              {status && (
                <span className={cn('inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium', STATUS_STYLES[status.tone])}>
                  {status.label}
                </span>
              )}
            </div>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/** Inline load error with a retry button, sized like the content it replaces. */
export function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-destructive">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="self-start rounded-md border bg-background px-3 py-1.5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:self-auto"
      >
        Try again
      </button>
    </div>
  )
}
