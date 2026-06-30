'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, PhoneCall, Bot, Phone, Plug, CreditCard,
  LogOut, Menu, X, ChevronRight, GitBranch,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Logo } from '@/components/shared/Logo'
import { signOut } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'
import type { Organization, Agent } from '@/types'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calls', label: 'Calls', icon: PhoneCall },
  { href: '/agent', label: 'Agent', icon: Bot },
  { href: '/phone', label: 'Phone Numbers', icon: Phone },
  { href: '/integrations', label: 'Integrations', icon: Plug },
  { href: '/workflows', label: 'Workflows', icon: GitBranch },
  { href: '/billing', label: 'Billing', icon: CreditCard },
]

interface DashboardShellProps {
  children: React.ReactNode
  org: Organization
  agent: Agent | null
  userEmail: string
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
            {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
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
      <DropdownMenuTrigger
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted transition-colors text-left outline-none"
      >
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{org.name ?? 'My Company'}</p>
          <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{org.name ?? 'My Company'}</p>
          <p className="text-xs text-muted-foreground">{userEmail}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <a href="/billing" className="flex items-center w-full">
            <CreditCard className="mr-2 h-4 w-4" />
            Billing
            <Badge variant="outline" className="ml-auto text-xs capitalize">{org.plan}</Badge>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => { await signOut() }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DashboardShell({ children, org, userEmail }: DashboardShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebar = (
    <div className="flex h-full flex-col gap-2">
      {/* Logo */}
      <div className="flex items-center px-4 py-4">
        <Logo size="sm" showText />
      </div>

      {/* Plan badge */}
      <div className="px-4 mb-2">
        <Badge
          variant="outline"
          className={cn(
            'text-xs capitalize w-full justify-center py-1',
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

      {/* Nav */}
      <div className="flex-1 overflow-y-auto">
        <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
      </div>

      {/* Usage bar */}
      <div className="px-4 py-2">
        <div className="rounded-lg bg-muted/60 px-3 py-2.5">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Minutes used</span>
            <span>{org.minutes_used} / {org.minutes_limit}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min((org.minutes_used / org.minutes_limit) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* User menu */}
      <div className="border-t px-1 py-2">
        <UserMenu org={org} userEmail={userEmail} />
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col border-r bg-card/50">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0">
          {sidebar}
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center justify-between border-b bg-card/50 px-4 lg:hidden">
          <Logo size="sm" showText />
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
