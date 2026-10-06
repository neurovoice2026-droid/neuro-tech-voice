'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Post-onboarding toast (`?welcome=true`, e.g. the Stripe success redirect).
 * `agentActive` comes from the server-rendered agent row: a paid checkout can
 * finish while the launch left the agent inactive (provider sync failed), so
 * "ready" is only claimed when the agent is actually live.
 */
export function DashboardWelcome({ agentActive }: { agentActive: boolean }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      if (agentActive) {
        toast.success('🎉 Setup complete! Your AI voice agent is ready.', {
          description: "Add a phone number if you haven't already to start receiving calls.",
          duration: 6000,
        })
      } else {
        toast.warning('Setup complete — your agent is not live yet', {
          description: 'Open your agent to activate it. Calls are not answered by the AI until it is live.',
          duration: 10000,
          action: { label: 'Open agent', onClick: () => router.push('/agent') },
        })
      }
      // Remove the query param without a full reload
      const url = new URL(window.location.href)
      url.searchParams.delete('welcome')
      url.searchParams.delete('session_id')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, agentActive, router])

  return null
}
