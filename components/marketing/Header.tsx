'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import { Logo } from '@/components/shared/Logo'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#benefits', label: 'Benefits' },
  { href: '#faq', label: 'FAQ' },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Neuro Tech Voice home">
          <Logo size="sm" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: 'outline' }), 'rounded-full px-5')}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants(), 'purple-glow rounded-full px-5')}
          >
            Start free
          </Link>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-72">
          <SheetHeader>
            <SheetTitle>
              <Logo size="sm" />
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <SheetFooter>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className={cn(buttonVariants(), 'purple-glow w-full rounded-full')}
            >
              Start free
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full rounded-full')}
            >
              Sign in
            </Link>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </header>
  )
}
