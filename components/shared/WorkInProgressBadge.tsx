import { Construction } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// Google integrations (OAuth connect + workflow/call actions) aren't
// reliably verified against live production credentials yet - this flags
// every surface that touches them so customers aren't surprised when a
// "Connect"/"Send" action doesn't do what it says.
export function WorkInProgressBadge({ className }: { className?: string }) {
  return (
    <Badge variant="warning" className={className}>
      <Construction aria-hidden />
      Work in progress
    </Badge>
  )
}
