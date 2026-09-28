import type { LucideIcon } from 'lucide-react'

interface StepHeaderProps {
  icon: LucideIcon
  title: string
  description: string
}

/**
 * Step title. The heading takes focus when the step changes (OnboardingWrapper),
 * so keyboard and screen reader users start at the top of the new step.
 */
export function StepHeader({ icon: Icon, title, description }: StepHeaderProps) {
  return (
    <div className="flex flex-col items-start gap-3 sm:gap-4">
      <div className="rounded-xl bg-purple-100 p-2.5" aria-hidden="true">
        <Icon className="h-6 w-6 text-purple-600 sm:h-7 sm:w-7" />
      </div>
      <div>
        <h2 data-step-heading tabIndex={-1} className="text-xl font-bold text-foreground outline-none sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</p>
      </div>
    </div>
  )
}
