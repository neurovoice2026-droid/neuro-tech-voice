'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

export function DashboardWelcome() {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      toast.success('🎉 Setup complete! Your AI voice agent is ready.', {
        description: "Add a phone number if you haven't already to start receiving calls.",
        duration: 6000,
      })
      // Remove the query param without a full reload
      const url = new URL(window.location.href)
      url.searchParams.delete('welcome')
      url.searchParams.delete('session_id')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  return null
}
