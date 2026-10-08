'use client'

import { createContext, useContext } from 'react'
import { Check } from 'lucide-react'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { cn } from '@/lib/utils'

/** The four onboarding steps, in order (the top bar, step headers and progress read from here). */
export const ONBOARDING_STEPS = [
  { num: 1, label: 'Company' },
  { num: 2, label: 'Agent' },
  { num: 3, label: 'Voice' },
  { num: 4, label: 'Launch' },
] as const

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length

interface StepIndicatorProps {
  currentStep: number
  className?: string
}

/**
 * Text step list for the onboarding top bar: `01 Company · 02 Agent · 03 Voice · 04 Launch`.
 * Done steps are ink with a check, the current one sits on a tinted pill, upcoming ones are muted.
 */
export function StepIndicator({ currentStep, className }: StepIndicatorProps) {
  return (
    <nav aria-label="Onboarding progress" className={className}>
      <ol className="flex items-center gap-1">
        {ONBOARDING_STEPS.map((step, idx) => {
          const isCompleted = step.num < currentStep
          const isCurrent = step.num === currentStep
          return (
            <li key={step.num} className="flex items-center gap-1">
              {idx > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-px w-3 transition-colors duration-300',
                    isCompleted || isCurrent ? 'bg-foreground/40' : 'bg-border'
                  )}
                />
              )}
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] leading-4 font-medium tracking-[0.12em] uppercase transition-colors duration-200',
                  isCurrent && 'bg-secondary text-foreground',
                  isCompleted && 'text-foreground',
                  !isCurrent && !isCompleted && 'text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="size-3" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <span className="tabular-nums">{String(step.num).padStart(2, '0')}</span>
                )}
                {step.label}
                {isCompleted && <span className="sr-only">(done)</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export type StepDirection = 'forward' | 'back'

const StepEnterContext = createContext<StepDirection | null>(null)

/** Set by OnboardingWrapper to the direction of the last step change; without it nothing animates. */
export const StepEnterProvider = StepEnterContext.Provider

/**
 * The step-enter slide (12 px + fade, 240 ms) for one block of a step: the header, the body and
 * the action row's contents. It is never put on an ancestor of StepActions: while a transform
 * runs, that ancestor becomes the containing block of the fixed action bar and drags it into the
 * column. Fill mode 'backwards' (the class says 'forwards') leaves no transform behind either.
 */
function useStepEnter(): { className?: string; style?: React.CSSProperties } {
  const direction = useContext(StepEnterContext)
  if (!direction) return {}
  return {
    className: direction === 'forward' ? 'animate-step-enter' : 'animate-step-enter-back',
    style: { animationFillMode: 'backwards' },
  }
}

/** A step's content (fields, pickers, panels). Keep StepActions outside it, see `useStepEnter`. */
export function StepBody({ children, className }: { children: React.ReactNode; className?: string }) {
  const enter = useStepEnter()
  return (
    <div className={cn(enter.className, className)} style={enter.style}>
      {children}
    </div>
  )
}

interface StepHeaderProps {
  step: number
  title: React.ReactNode
  description?: React.ReactNode
  /** Overrides the eyebrow ("Step 2 · Agent" by default). */
  eyebrow?: React.ReactNode
  /** Ref to the title, for callers that move focus to it (it is always focusable with tabIndex -1). */
  headingRef?: React.Ref<HTMLHeadingElement>
  className?: string
}

/**
 * Opener of every onboarding step: eyebrow, display title (the page's h1) and a 15 px description.
 * The title takes focus (tabIndex -1) when the step changes, see OnboardingWrapper.
 */
export function StepHeader({ step, title, description, eyebrow, headingRef, className }: StepHeaderProps) {
  const label = ONBOARDING_STEPS.find((s) => s.num === step)?.label
  const enter = useStepEnter()
  return (
    <header className={cn('mb-10', enter.className, className)} style={enter.style}>
      <Eyebrow>{eyebrow ?? `Step ${step} · ${label ?? ''}`}</Eyebrow>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-3 font-heading font-title text-[30px] leading-[36px] tracking-[-0.025em] text-balance text-foreground outline-none md:text-[36px] md:leading-[42px]"
      >
        {title}
      </h1>
      {description && (
        <p className="mt-3 max-w-[56ch] text-[15px] leading-[22px] text-pretty text-muted-foreground">{description}</p>
      )}
    </header>
  )
}

interface StepActionsProps {
  children: React.ReactNode
  /**
   * 'mobile' (default): a sticky bar at the bottom of the screen on phones, an inline row under
   * a hairline from `md`. 'always': sticky at every width (long lists such as the voice step).
   */
  sticky?: 'mobile' | 'always'
  className?: string
}

/** Back / Continue row of a step. Render it outside StepBody (it is fixed on phones). */
export function StepActions({ children, sticky = 'mobile', className }: StepActionsProps) {
  // Only the row inside the bar slides in; the fixed bar itself stays put.
  const enter = useStepEnter()
  return (
    <div
      data-slot="step-actions"
      className={cn(
        'fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-white/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md',
        // While the bar is fixed, the page keeps focused/scrolled-to fields clear of it.
        sticky === 'mobile'
          ? 'max-md:[html:has(&)]:scroll-pb-28 md:static md:z-auto md:mt-10 md:bg-transparent md:px-0 md:pt-6 md:pb-0 md:backdrop-blur-none'
          : '[html:has(&)]:scroll-pb-28'
      )}
    >
      <div className={cn('mx-auto flex w-full max-w-[608px] items-center gap-3', enter.className, className)} style={enter.style}>
        {children}
      </div>
    </div>
  )
}
