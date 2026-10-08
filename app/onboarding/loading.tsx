import { OrbLoader } from '@/components/shared/OrbLoader'

/** Shown inside the onboarding layout (top bar stays) while the page reads the organisation. */
export default function OnboardingLoading() {
  return <OrbLoader state="breathing" label="Preparing your setup…" className="min-h-[70vh]" />
}
