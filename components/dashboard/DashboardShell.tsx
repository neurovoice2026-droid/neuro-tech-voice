'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import {
  LayoutDashboard, PhoneCall, Bot, Phone, Plug, CreditCard,
  LogOut, Menu, GitBranch, Settings, ChevronsUpDown,
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
import { cn } from '@/lib/utils'
import type { Organization, Agent } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

/** Sidebar groups, like the site's drawing of the workspace: no label · Configure · Account. */
const NAV_GROUPS: Array<{ label?: string; items: NavItem[] }> = [
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

/** Pages whose content sits in a left-aligned 768 px column inside the default PageContainer. */
const NARROW_PAGES = ['/billing', '/settings']

interface DashboardShellProps {
  children: React.ReactNode
  org: Organization
  agent: Agent | null
  userEmail: string
  hasPhoneNumber: boolean
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="mt-1 flex-1 overflow-y-auto px-3 pb-3">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label ?? i}>
          {group.label && (
            <p className="px-2.5 pt-5 pb-1.5 text-[11px] leading-4 text-muted-foreground">{group.label}</p>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] transition-[background-color,color] duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring',
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
    </nav>
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
              <span className="capitalize">{org.plan}</span> plan
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
  const tone = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'default'
  return (
    <div className="rounded-2xl bg-secondary p-3">
      <div className="flex items-center justify-between gap-2 text-xs leading-4">
        <span className="min-w-0 truncate text-muted-foreground">
          Minutes · <span className="capitalize">{org.plan}</span>
        </span>
        <span className="shrink-0 text-foreground tabular-nums">
          {org.minutes_used.toLocaleString('en-US')} / {org.minutes_limit.toLocaleString('en-US')}
        </span>
      </div>
      <Progress
        value={Math.min(pct, 100)}
        tone={tone}
        surface="tinted"
        aria-label="Minutes used this period"
        className="mt-2"
      />
    </div>
  )
}

export function DashboardShell({ children, org, agent, userEmail, hasPhoneNumber }: DashboardShellProps) {
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

      <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />

      <div className="p-3">
        <UsageTile org={org} />
      </div>
    </div>
  )

  const showNumberBanner = !hasPhoneNumber && !pathname.startsWith('/phone')
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
          {showNumberBanner && (
            <div className="px-4 pt-4 sm:px-6 lg:px-10 lg:pt-6">
              <div className="mx-auto w-full max-w-[1176px]">
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
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
