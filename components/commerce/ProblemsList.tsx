import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import type { CommerceOverviewDto } from '@/lib/commerce/types'

type Problem = CommerceOverviewDto['problems'][number]

/** Problems that stop calls outright read as red; the rest (a failing webhook, a sync error) as a warning. */
const BLOCKING = new Set<Problem['code']>(['no_connection', 'credentials_expired', 'no_phone_number', 'encryption_not_configured', 'minutes_exhausted'])

const LINK_LABEL: Partial<Record<Problem['code'], string>> = {
  no_connection: 'Connect store',
  connection_error: 'View connection',
  credentials_expired: 'Reconnect',
  webhook_failure: 'View connection',
  sync_error: 'View connection',
  no_phone_number: 'Add a number',
  no_consent: 'Confirm consent',
  agent_inactive: 'Open agent',
  minutes_exhausted: 'View plan',
  encryption_not_configured: 'Contact support',
}

/** The overview's problem list: each a message from the server and, when it has one, the page that fixes it. */
export function ProblemsList({ problems, id }: { problems: Problem[]; id?: string }) {
  if (problems.length === 0) return null
  return (
    <ul id={id} aria-label="Problems to fix" className="space-y-3">
      {problems.map((problem) => (
        <li key={problem.code}>
          <Alert variant={BLOCKING.has(problem.code) ? 'destructive' : 'warning'}>
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{problem.message}</AlertTitle>
            <AlertDescription>
              {BLOCKING.has(problem.code)
                ? 'Until it is fixed, automations cannot call customers.'
                : 'Automations keep running, but some data may arrive late.'}
            </AlertDescription>
            {problem.href && (
              <AlertAction>
                <Link href={problem.href} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                  {LINK_LABEL[problem.code] ?? 'Fix'}
                </Link>
              </AlertAction>
            )}
          </Alert>
        </li>
      ))}
    </ul>
  )
}
