'use client'

import { LogOut } from 'lucide-react'
import { useTransition } from 'react'
import { Logo } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { signOut } from '@/lib/auth/actions'

const TOTAL_STEPS = 4

export function OnboardingTopBar() {
  const currentStep = useOnboardingStore((s) => s.currentStep)
  const progress = (currentStep / TOTAL_STEPS) * 100
  const [isPending, startTransition] = useTransition()

  function handleExit() {
    startTransition(async () => {
      await signOut()
    })
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-50">
      {/* Top bar */}
      <div className="flex h-16 items-center justify-between border-b bg-white/80 px-4 backdrop-blur-md lg:px-8">
        <div className="flex items-center">
          <Logo size="sm" showText />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Step {currentStep} of {TOTAL_STEPS}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            disabled={isPending}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Exit
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-purple-100">
        <div
          className="h-full bg-purple-600 transition-all duration-500 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
