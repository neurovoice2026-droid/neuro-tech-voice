import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  /** 'default' = 1176 px (lists, dashboard); 'narrow' = 768 px (forms: settings, billing, onboarding). */
  width?: 'default' | 'narrow'
  /** Applied to the inner, width-capped column (e.g. "space-y-10"). */
  className?: string
}

/** Page gutter (16/24/40 px), top/bottom rhythm and max content width for app pages. */
export function PageContainer({ children, width = 'default', className }: PageContainerProps) {
  return (
    <div data-slot="page-container" className="px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-10">
      <div
        className={cn(
          'mx-auto w-full',
          width === 'narrow' ? 'max-w-[768px]' : 'max-w-[1176px]',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}
