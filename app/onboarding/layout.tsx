import { OnboardingTopBar } from '@/components/onboarding/OnboardingTopBar'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <OnboardingTopBar />
      {/* pt accounts for fixed top bar (h-16 = 64px) + progress bar (h-1.5 = 6px) */}
      <main className="pt-[70px]">
        <div className="mx-auto max-w-2xl px-4 py-12">
          {children}
        </div>
      </main>
    </div>
  )
}
