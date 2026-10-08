import { OnboardingTopBar } from '@/components/onboarding/OnboardingTopBar'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <OnboardingTopBar />
      {/* pt-14 clears the fixed 56 px top bar; pb-32 clears the sticky step actions on phones. */}
      <main className="pt-14">
        <div className="mx-auto w-full max-w-[640px] px-4 pt-10 pb-32 md:pt-14">{children}</div>
      </main>
    </div>
  )
}
