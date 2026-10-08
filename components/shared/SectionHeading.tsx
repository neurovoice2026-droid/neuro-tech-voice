import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Right-aligned control (a "View all" ghost button, segmented tabs, a badge). */
  action?: React.ReactNode
  /** Heading level; the look stays the same. */
  as?: 'h2' | 'h3'
  className?: string
}

/** Section title (display face, 20 px) with optional description and a trailing action. */
export function SectionHeading({ title, description, action, as: Tag = 'h2', className }: SectionHeadingProps) {
  return (
    <div data-slot="section-heading" className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <Tag className="font-heading font-title text-[20px] leading-[26px] tracking-[-0.01em]">{title}</Tag>
        {description && (
          <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
