import { OnboardingTopBar } from '@/components/onboarding/OnboardingTopBar'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <OnboardingTopBar />
      {/* pt accounts for fixed top bar (h-16 = 64px) + progress bar (h-1.5 = 6px).
          overflow-x-clip keeps the step slide-in from adding a horizontal scrollbar on phones. */}
      <main className="overflow-x-clip pt-[70px]">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
          {children}
        </div>
      </main>
    </div>
  )
}
