'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { num: 1, label: 'Company' },
  { num: 2, label: 'Agent' },
  { num: 3, label: 'Voice' },
  { num: 4, label: 'Phone' },
  { num: 5, label: 'Integrations' },
  { num: 6, label: 'Launch' },
]

interface StepIndicatorProps {
  currentStep: number
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-start justify-center mb-10">
      {STEPS.map((step, idx) => {
        const isCompleted = step.num < currentStep
        const isCurrent = step.num === currentStep
        const isUpcoming = step.num > currentStep

        return (
          <div key={step.num} className="flex items-start">
            {/* Connector line */}
            {idx > 0 && (
              <div
                className={cn(
                  'mt-4 h-px w-10 shrink-0 transition-colors duration-300 sm:w-14',
                  isCompleted || isCurrent ? 'bg-primary' : 'bg-gray-200'
                )}
              />
            )}

            {/* Dot + label */}
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent &&
                    'border-2 border-primary bg-white text-primary shadow-sm ring-4 ring-primary/15',
                  isUpcoming && 'bg-gray-100 text-gray-400'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.num}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground',
                  // On mobile show only current step label
                  !isCurrent && 'hidden sm:block'
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
