import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { CONTACT_SALES_HREF, CONTACT_SALES_PHONE, isAppPath, type OutOfMinutesAction } from '@/lib/billing/upgrade'
import { cn } from '@/lib/utils'

/**
 * Long labels ("Upgrade to Store Scale (2,000 minutes for $500/mo)") wrap on a phone instead of running off
 * the card. `shrink` (tailwind-merge drops the button's `shrink-0`) and `max-w-full` let the link narrow to
 * its row, so `whitespace-normal` can take effect; the row (MINUTES_ACTION_ROW) must be able to narrow too.
 */
export const MINUTES_ACTION_WRAP = 'h-auto min-h-8 max-w-full shrink whitespace-normal py-1.5 text-center'

/**
 * The AlertAction holding these buttons: below `sm` a grid cell as wide as the text column that may narrow
 * below its content (min-w-0), so a long label wraps instead of widening the page; from `sm` its own
 * trailing column, sized by its content again.
 */
export const MINUTES_ACTION_ROW = 'w-full min-w-0 sm:w-auto'

/**
 * The out-of-minutes choice as buttons (lib/billing/upgrade.ts
 * outOfMinutesActions; the store overview's problem buttons use it too):
 * one filled, the other outlined. App paths are client-side links; the sales
 * line ("Talk to us", a tel: link) is a plain anchor that prints the number
 * too, since a tel: link does nothing in most desktop browsers.
 */
export function MinutesActionLinks({ actions }: { actions: ReadonlyArray<Omit<OutOfMinutesAction, 'kind'> & { kind: string }> }) {
  return (
    <>
      {actions.map((action) => {
        const className = cn(buttonVariants({ size: 'sm', variant: action.primary ? 'default' : 'outline' }), MINUTES_ACTION_WRAP)
        return isAppPath(action.href) ? (
          <Link key={action.kind} href={action.href} className={className}>
            {action.label}
          </Link>
        ) : (
          <a key={action.kind} href={action.href} className={className}>
            {action.label}
            {action.href === CONTACT_SALES_HREF && <span className="tabular-nums">{` · ${CONTACT_SALES_PHONE}`}</span>}
          </a>
        )
      })}
    </>
  )
}
