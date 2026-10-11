'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

/** Submit button of the /reset-password/confirm form, with the pending state of its server action. */
export function ConfirmResetButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending} loadingText="Opening…">
      Continue
    </Button>
  )
}
