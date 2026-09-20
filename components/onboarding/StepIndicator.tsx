'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ONBOARDING_STEPS } from '@/app/onboarding/_lib/onboarding-state'

interface StepIndicatorProps {
  currentStep: number
  /** Lets the owner jump back to a finished step. */
  onStepClick?: (step: number) => void
}

export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <nav aria-label="Setup progress" className="mb-8 sm:mb-10">
      <ol className="flex items-start justify-center">
        {ONBOARDING_STEPS.map((step, idx) => {
          const isCompleted = step.num < currentStep
          const isCurrent = step.num === currentStep
          const isUpcoming = step.num > currentStep
          const srLabel = `Step ${step.num}: ${step.label}${isCompleted ? ', completed' : isCurrent ? ', current step' : ''}`
          const dotClass = cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 sm:h-8 sm:w-8',
            isCompleted && 'bg-primary text-primary-foreground',
            isCurrent && 'border-2 border-primary bg-white text-primary shadow-sm ring-4 ring-primary/15',
            isUpcoming && 'bg-gray-100 text-gray-400'
          )
          const dotContent = (
            <>
              <span aria-hidden="true">{isCompleted ? <Check className="h-4 w-4" /> : step.num}</span>
              <span className="sr-only">{srLabel}</span>
            </>
          )

          return (
            <li key={step.num} className="flex items-start" aria-current={isCurrent ? 'step' : undefined}>
              {/* Connector line */}
              {idx > 0 && (
                <div
                  aria-hidden="true"
                  className={cn(
                    'mt-3.5 h-px w-6 shrink-0 transition-colors duration-300 sm:mt-4 sm:w-14',
                    isCompleted || isCurrent ? 'bg-primary' : 'bg-gray-200'
                  )}
                />
              )}

              {/* Dot + label */}
              <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                {isCompleted && onStepClick ? (
                  <button
                    type="button"
                    onClick={() => onStepClick(step.num)}
                    className={cn(dotClass, 'outline-none hover:ring-4 hover:ring-primary/15 focus-visible:ring-4 focus-visible:ring-ring/50')}
                  >
                    {dotContent}
                  </button>
                ) : (
                  <span className={dotClass}>{dotContent}</span>
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    'whitespace-nowrap text-xs font-medium',
                    isCurrent ? 'text-foreground' : 'text-muted-foreground',
                    // Phones show only the current step's name.
                    !isCurrent && 'hidden sm:block'
                  )}
                >
                  {step.label}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
