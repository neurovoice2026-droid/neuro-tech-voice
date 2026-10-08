import { Eyebrow } from '@/components/shared/Eyebrow'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Short violet opener above the title ("Calls", a date…). */
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Chips / meta line under the description (StatusChip, Badge, muted text). */
  meta?: React.ReactNode
  /** Right-aligned actions (buttons, a switch pill). Wraps under the title below md. */
  actions?: React.ReactNode
  className?: string
}

/** Generic app page header: eyebrow, display-face h1, description, meta chips and actions. */
export function PageHeader({ eyebrow, title, description, meta, actions, className }: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn('mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between', className)}
    >
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1
          className={cn(
            'font-heading font-title text-[28px] leading-[34px] tracking-[-0.02em] text-balance md:text-[32px] md:leading-[38px]',
            eyebrow ? 'mt-3' : null
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[62ch] text-[15px] leading-[22px] text-pretty text-muted-foreground">{description}</p>
        )}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
