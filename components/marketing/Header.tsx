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
  { href: '/#features', label: 'Features' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-4 z-40 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="flex h-16 items-center justify-between rounded-full border border-white/60 bg-white/50 px-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8),0_8px_30px_-8px_rgba(88,28,135,0.3)] backdrop-blur-2xl sm:px-6">
        <Link href="/" aria-label="Neuro Tech Voice home">
          <Logo size="xs" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'rounded-full border-white/70 bg-white/40 px-5 backdrop-blur-xl hover:bg-white/70'
            )}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className={cn(
              buttonVariants(),
              'purple-glow rounded-full px-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)]'
            )}
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
              <Logo size="xs" />
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {link.label}
              </Link>
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
