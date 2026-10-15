'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import {
  LayoutDashboard, PhoneCall, Bot, Phone, Plug, CreditCard,
  LogOut, Menu, GitBranch, Settings, ChevronsUpDown,
  Store, Cable, Package, Users, Tag, Workflow, PhoneOff, SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CornerDot } from '@/components/site/corner-dot'
import { LiveDot } from '@/components/shared/LiveDot'
import { Logo } from '@/components/shared/Logo'
import { OrbInline } from '@/components/shared/OrbLoader'
import { signOut } from '@/lib/auth/actions'
import { MinutesBanner } from '@/components/dashboard/MinutesBanner'
import { minutesMeterTone, showsMinutesBanner, type MinutesBannerState } from '@/components/billing/minutes-logic'
import { planBadgeText, planDisplayName } from '@/components/dashboard/plan-label'
import { cn } from '@/lib/utils'
import type { Organization, Agent } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

/** Sidebar groups, like the site's drawing of the workspace: no label · Configure · Account. */
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/calls', label: 'Calls', icon: PhoneCall },
    ],
  },
  {
    label: 'Configure',
    items: [
      { href: '/agent', label: 'Agent', icon: Bot },
      { href: '/phone', label: 'Phone numbers', icon: Phone },
      { href: '/integrations', label: 'Integrations', icon: Plug },
      { href: '/workflows', label: 'Workflows', icon: GitBranch },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/billing', label: 'Billing', icon: CreditCard },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

/** The store section of an e-commerce organization (migration 024), after the first group. */
const COMMERCE_NAV_GROUP: NavGroup = {
  label: 'Store',
  items: [
    { href: '/store', label: 'Overview', icon: Store },
    { href: '/store/connections', label: 'Connections', icon: Cable },
    { href: '/store/orders', label: 'Orders', icon: Package },
    { href: '/store/customers', label: 'Customers', icon: Users },
    { href: '/store/products', label: 'Products', icon: Tag },
    { href: '/store/automations', label: 'Automations', icon: Workflow },
    { href: '/store/do-not-call', label: 'Do-not-call list', icon: PhoneOff },
    { href: '/store/settings', label: 'Store settings', icon: SlidersHorizontal },
  ],
}

/** Service organizations see exactly the groups above; e-commerce ones get the Store group too. */
function navGroupsFor(org: Organization): NavGroup[] {
  if (org.business_type !== 'ecommerce') return NAV_GROUPS
  return [NAV_GROUPS[0], COMMERCE_NAV_GROUP, ...NAV_GROUPS.slice(1)]
}

/** Section roots: active on their own path only, so their sub-pages do not light them up too. */
const EXACT_MATCH_PAGES = ['/dashboard', '/store']

/** Pages whose content sits in a left-aligned 768 px column inside the default PageContainer. */
const NARROW_PAGES = ['/billing', '/settings', '/store/settings']

interface DashboardShellProps {
  children: React.ReactNode
  org: Organization
  agent: Agent | null
  userEmail: string
  hasPhoneNumber: boolean
  /** Out of minutes / running low (decided by the layout); null hides the banner. */
  minutesBanner?: MinutesBannerState | null
}

function isActive(pathname: string, href: string) {
  return pathname === href || (!EXACT_MATCH_PAGES.includes(href) && pathname.startsWith(href))
}

/**
 * Whether a scroll box has links out of view above / below (the sidebar nav's scroll cue). The
 * observer's first callback takes the first measure; it runs again when the window or the list
 * changes height, and every scroll updates it.
 */
function useScrollCue() {
  const ref = useRef<HTMLElement>(null)
  const [cue, setCue] = useState({ above: false, below: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const above = el.scrollTop > 1
      const below = el.scrollTop + el.clientHeight < el.scrollHeight - 1
      setCue((c) => (c.above === above && c.below === below ? c : { above, below }))
    }
    const observer = new ResizeObserver(update)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    el.addEventListener('scroll', update, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', update)
    }
  }, [])

  return { ref, ...cue }
}

function NavLinks({ pathname, groups, dense = false, onNavigate }: {
  pathname: string
  groups: NavGroup[]
  /** Tighter rows on the desktop sidebar (the store org's longer list); the phone sheet keeps 36 px rows. */
  dense?: boolean
  onNavigate?: () => void
}) {
  const { ref, above, below } = useScrollCue()
  const activeRef = useRef<HTMLAnchorElement>(null)

  // On a short screen the current page's link can sit below the fold (Settings, Billing): bring it in.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [pathname])

  return (
    <div className="relative mt-1 flex min-h-0 flex-1 flex-col">
      <nav ref={ref} aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div>
          {groups.map((group, i) => (
            <div key={group.label ?? i}>
              {group.label && (
                <p className={cn('px-2.5 pt-5 pb-1.5 text-[11px] leading-4 text-muted-foreground', dense && 'lg:pt-3.5')}>{group.label}</p>
              )}
              <ul className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href)
                  return (
                    <li key={href}>
                      <Link
                        ref={active ? activeRef : undefined}
                        href={href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          // scroll-my keeps a link brought into view clear of the fades.
                          'flex h-9 scroll-my-8 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] transition-[background-color,color] duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring',
                          dense && 'lg:h-8',
                          active
                            ? 'bg-secondary font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        )}
                      >
                        <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                        <span className="min-w-0 truncate">{label}</span>
                        {active && <CornerDot className="ml-auto size-2 shrink-0 text-brand" />}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      {/* Scroll cue: a fade over the edge where links sit out of view (short laptop screens, phones). */}
      <div
        aria-hidden="true"
        data-scroll-cue="above"
        className={cn('pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white to-transparent transition-opacity duration-200', above ? 'opacity-100' : 'opacity-0')}
      />
      <div
        aria-hidden="true"
        data-scroll-cue="below"
        className={cn('pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent transition-opacity duration-200', below ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  )
}

/** Menu row that navigates (Base UI LinkItem rendered as a Next link), styled like DropdownMenuItem. */
function MenuLink({ href, onNavigate, children }: { href: string; onNavigate?: () => void; children: React.ReactNode }) {
  return (
    <MenuPrimitive.LinkItem
      closeOnClick
      onClick={onNavigate}
      render={<Link href={href} />}
      className="relative flex h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-sm text-foreground outline-hidden select-none focus:bg-secondary data-highlighted:bg-secondary [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
    >
      {children}
    </MenuPrimitive.LinkItem>
  )
}

/** The workspace pill under the wordmark: org name, and the account menu behind it. */
function WorkspaceMenu({ org, userEmail, onNavigate }: { org: Organization; userEmail: string; onNavigate?: () => void }) {
  const [signingOut, startSignOut] = useTransition()
  const orgName = org.name ?? 'My Company'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${orgName} (${userEmail}): account menu`}
        className="mx-3 flex h-9 items-center justify-between gap-2 rounded-[10px] bg-white px-3 text-left text-[13px] text-foreground shadow-hair transition-[background-color,color] duration-200 outline-none hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring data-popup-open:bg-band"
      >
        <span className="min-w-0 truncate font-medium">{orgName}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      {/* Wide enough for a typical e-mail address; longer ones still truncate. */}
      <DropdownMenuContent align="start" className="w-auto min-w-64 max-w-80">
        <DropdownMenuGroup>
          <div className="px-2.5 pt-2 pb-2.5">
            <p className="truncate text-sm font-medium text-foreground">{orgName}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            <Badge variant="secondary" className="mt-2">
              {planBadgeText(org.plan)}
            </Badge>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <MenuLink href="/billing" onNavigate={onNavigate}>
            <CreditCard aria-hidden="true" />
            Billing
          </MenuLink>
          <MenuLink href="/settings" onNavigate={onNavigate}>
            <Settings aria-hidden="true" />
            Settings
          </MenuLink>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          closeOnClick={false}
          disabled={signingOut}
          onClick={() => startSignOut(async () => { await signOut() })}
        >
          {signingOut ? <OrbInline state="working" className="-ml-0.5" /> : <LogOut aria-hidden="true" />}
          {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Minutes meter at the foot of the sidebar (≥ 80 % warning, ≥ 100 % danger). */
function UsageTile({ org }: { org: Organization }) {
  const pct = org.minutes_limit > 0 ? Math.round((org.minutes_used / org.minutes_limit) * 100) : 0
  // Prepaid extra minutes keep calls going past the included ones: the meter warns instead of alarming.
  const extra = Math.max(0, Math.floor(org.extra_minutes_balance ?? 0))
  const tone = minutesMeterTone(pct, extra)
  // The plan's display name, not its id; "min" after the figures leaves the name the row's width.
  const planName = planDisplayName(org.plan)
  return (
    <div className="rounded-2xl bg-secondary p-3">
      <div className="flex items-center justify-between gap-2 text-xs leading-4">
        <span className="min-w-0 truncate text-muted-foreground" title={planName}>
          {planName}
        </span>
        <span className="shrink-0 text-foreground tabular-nums">
          {org.minutes_used.toLocaleString('en-US')} / {org.minutes_limit.toLocaleString('en-US')} min
        </span>
      </div>
      <Progress
        value={Math.min(pct, 100)}
        tone={tone}
        surface="tinted"
        aria-label="Included minutes used this period"
        className="mt-2"
      />
      {extra > 0 && (
        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground tabular-nums">
          {`+${extra.toLocaleString('en-US')} extra ${extra === 1 ? 'minute' : 'minutes'}`}
        </p>
      )}
    </div>
  )
}

export function DashboardShell({ children, org, agent, userEmail, hasPhoneNumber, minutesBanner = null }: DashboardShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-5 pt-5 pb-4">
        <Link
          href="/dashboard"
          aria-label="NeuroVoice home"
          onClick={() => setMobileOpen(false)}
          className="inline-flex rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-solid focus-visible:outline-ring"
        >
          <Logo size="sm" />
        </Link>
      </div>

      <WorkspaceMenu org={org} userEmail={userEmail} onNavigate={() => setMobileOpen(false)} />

      <NavLinks
        pathname={pathname}
        groups={navGroupsFor(org)}
        dense={org.business_type === 'ecommerce'}
        onNavigate={() => setMobileOpen(false)}
      />

      <div className="p-3">
        <UsageTile org={org} />
      </div>
    </div>
  )

  const showNumberBanner = !hasPhoneNumber && !pathname.startsWith('/phone')
  // The billing page's Minutes section shows the same out-of-minutes callout (and the auto top-up form).
  const showMinutesBanner = !!minutesBanner && showsMinutesBanner(pathname)
  // The banner lines up with the page below it: same 1176 px container as PageContainer, and on
  // form pages the same left-aligned 768 px column, so its left edge matches the page header's.
  const narrowPage = NARROW_PAGES.some((p) => pathname.startsWith(p))
  const agentState = !agent ? null : !agent.is_active ? 'paused' : hasPhoneNumber ? 'live' : 'no-number'

  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-rule bg-white lg:flex">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="bg-white">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-rule bg-white/85 px-4 backdrop-blur-md lg:hidden">
          <Link
            href="/dashboard"
            aria-label="NeuroVoice home"
            className="inline-flex rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-solid focus-visible:outline-ring"
          >
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-1">
            {agent && (
              <span className="flex items-center gap-2 px-2 text-[13px] text-muted-foreground">
                {/* Static dot: the pinging dot is kept for calls in progress. */}
                <LiveDot
                  active={false}
                  tone={agentState === 'live' ? 'success' : agentState === 'no-number' ? 'warning' : 'idle'}
                />
                <span className="max-w-[9rem] truncate">{agent.name}</span>
                <span className="sr-only">
                  {agentState === 'live' ? 'is live' : agentState === 'no-number' ? 'has no phone number' : 'is paused'}
                </span>
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="tap-44 -mr-2"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu aria-hidden="true" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {(showNumberBanner || showMinutesBanner) && (
            <div className="px-4 pt-4 sm:px-6 lg:px-10 lg:pt-6">
              <div className="mx-auto w-full max-w-[1176px] space-y-3">
                {showMinutesBanner && minutesBanner && <MinutesBanner state={minutesBanner} className={cn(narrowPage && 'max-w-[768px]')} />}
                {showNumberBanner && (
                  <Alert variant="warning" className={cn(narrowPage && 'max-w-[768px]')}>
                    <Phone aria-hidden="true" />
                    <AlertTitle>Your agent can&apos;t take calls yet</AlertTitle>
                    <AlertDescription>Add a phone number to start answering and making calls.</AlertDescription>
                    <AlertAction>
                      <Link href="/phone" className={buttonVariants({ size: 'sm' })}>
                        Add a number
                      </Link>
                    </AlertAction>
                  </Alert>
                )}
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
