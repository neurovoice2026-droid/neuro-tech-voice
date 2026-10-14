'use client'

// Small pieces every store onboarding step uses: the step header bound to the
// store flow's step list, and the loading / error blocks (always with a retry).

import { AlertCircle, RotateCw } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { COMMERCE_ONBOARDING_STEPS } from '@/lib/commerce/business-type'
import { cn } from '@/lib/utils'
import { StepHeader } from '../StepIndicator'

type StepHeaderProps = React.ComponentProps<typeof StepHeader>

/** StepHeader with the store flow's labels: the eyebrow reads "Step 3 · Access & sync". */
export function CommerceStepHeader(props: Omit<StepHeaderProps, 'steps' | 'stepWord'>) {
  return <StepHeader steps={COMMERCE_ONBOARDING_STEPS} {...props} />
}

interface ErrorBlockProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  retrying?: boolean
  className?: string
}

/** A failed request: the server's message and a retry. */
export function ErrorBlock({ title, message, onRetry, retryLabel = 'Retry', retrying, className }: ErrorBlockProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle aria-hidden="true" />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{message}</AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button variant="outline" size="sm" onClick={onRetry} loading={retrying} loadingText="Retrying…">
            <RotateCw aria-hidden="true" />
            {retryLabel}
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}

interface LoadingBlockProps {
  label: string
  description?: string
  size?: 64 | 32
  className?: string
}

/** A region being loaded (reserve its height with className so nothing jumps). */
export function LoadingBlock({ label, description, size = 32, className }: LoadingBlockProps) {
  return (
    <OrbLoader
      size={size}
      layout={size === 32 ? 'row' : 'stack'}
      label={label}
      description={description}
      className={cn('justify-center rounded-2xl bg-secondary p-6', className)}
    />
  )
}
