'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AudioLines, Bot, ChevronRight, CreditCard, GitBranch, Inbox, LayoutDashboard, LogOut, Menu,
  Phone, PhoneCall, Plug, Settings, TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Logo } from '@/components/shared/Logo'
import { useUnreadMessages } from '@/components/inbox/unread'
import { signOut } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'
import type { Organization } from '@/types'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calls', label: 'Calls', icon: PhoneCall },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/agent', label: 'Agent', icon: Bot },
  { href: '/voice-lab', label: 'Voice Lab', icon: AudioLines },
  { href: '/phone', label: 'Phone Numbers', icon: Phone },
  { href: '/integrations', label: 'Integrations', icon: Plug },
  { href: '/workflows', label: 'Workflows', icon: GitBranch },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

interface DashboardShellProps {
  children: React.ReactNode
  org: Organization
  userEmail: string
  hasPhoneNumber: boolean
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))
}

function NavLinks({ pathname, unread, onNavigate }: { pathname: string; unread: number; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActivePath(pathname, href)
        const badge = href === '/inbox' && unread > 0 ? (unread > 99 ? '99+' : String(unread)) : null
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {badge && (
              <span
                className={cn(
                  'min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5',
                  active ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'
                )}
              >
                {badge}
                <span className="sr-only"> unread messages</span>
              </span>
            )}
            {active && !badge && <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />}
          </Link>
        )
      })}
    </nav>
  )
}

function UserMenu({ org, userEmail }: { org: Organization; userEmail: string }) {
  const initials = (org.name ?? userEmail).slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{org.name ?? 'My Company'}</p>
          <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <div className="min-w-0 px-2 py-1.5">
          <p className="text-sm font-medium [overflow-wrap:anywhere]">{org.name ?? 'My Company'}</p>
          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{userEmail}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/billing" />}>
          <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
          Billing
          <Badge variant="outline" className="ml-auto text-xs capitalize">
            {org.plan}
          </Badge>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            await signOut()
          }}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DashboardShell({ children, org, userEmail, hasPhoneNumber }: DashboardShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const unread = useUnreadMessages(pathname)
  const usagePercent = org.minutes_limit > 0 ? Math.min((org.minutes_used / org.minutes_limit) * 100, 100) : 0

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center px-4 py-4">
        <Logo size="sm" showText />
      </div>

      <div className="mb-2 px-4">
        <Badge
          variant="outline"
          className={cn(
            'w-full justify-center py-1 text-xs capitalize',
            org.plan === 'custom' && 'border-purple-300 bg-purple-50 text-purple-700',
            org.plan === 'business' && 'border-indigo-200 bg-indigo-50 text-indigo-700',
            org.plan === 'pro' && 'border-blue-200 bg-blue-50 text-blue-700',
            org.plan === 'starter' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
            org.plan === 'trial' && 'border-gray-200 bg-gray-50 text-gray-500'
          )}
        >
          {org.plan} plan
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto">
        <NavLinks pathname={pathname} unread={unread} onNavigate={onNavigate} />
      </div>

      <div className="px-4 py-2">
        <div className="rounded-lg bg-muted/60 px-3 py-2.5">
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>Minutes used</span>
            <span>
              {org.minutes_used} / {org.minutes_limit}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Minutes used this period"
            aria-valuemin={0}
            aria-valuemax={org.minutes_limit}
            aria-valuenow={org.minutes_used}
          >
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usagePercent}%` }} />
          </div>
        </div>
      </div>

      <div className="border-t px-1 py-2">
        <UserMenu org={org} userEmail={userEmail} />
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden border-r bg-card/50 lg:flex lg:w-60 lg:flex-col">{sidebar()}</aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="max-w-[85vw] p-0 data-[side=left]:w-64" showCloseButton>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Pages of your dashboard</SheetDescription>
          {sidebar(() => setMobileOpen(false))}
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b bg-card/50 px-4 lg:hidden">
          <Logo size="xs" showText />
          <Button
            variant="ghost"
            size="icon"
            className="relative -mr-2"
            onClick={() => setMobileOpen(true)}
            aria-label={unread > 0 ? `Open menu, ${unread} unread messages` : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" aria-hidden="true" />}
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto">
          {!hasPhoneNumber && (
            <div className="flex flex-col gap-3 bg-red-600 px-4 py-3 text-sm text-white sm:flex-row sm:items-center">
              <div className="flex flex-1 items-start gap-3 sm:items-center">
                <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="flex-1">
                  <strong className="font-semibold">Your agent can&apos;t take calls yet.</strong> Add a phone number to start
                  answering and making calls.
                </p>
              </div>
              <Link
                href="/phone"
                className="shrink-0 self-start rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 sm:self-auto"
              >
                Add a number
              </Link>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
