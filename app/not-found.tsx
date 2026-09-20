import Link from 'next/link'
import { ArrowLeft, Compass, LayoutDashboard } from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Shown for any URL the app doesn't have and for notFound() calls. Kept free
// of request data so it stays prerendered.
export default function NotFound() {
  return (
    <main
      id="content"
      className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background px-4 py-16"
    >
      <Link href="/" aria-label="Neuro Tech Voice home" className="mb-10">
        <Logo size="sm" />
      </Link>

      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Compass className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Error 404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The link may be old, or the page may have moved. Everything else is right where you left it.
        </p>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'h-10 px-4')}>
            <ArrowLeft aria-hidden="true" />
            Back to the homepage
          </Link>
          <Link href="/dashboard" className={cn(buttonVariants(), 'h-10 px-4')}>
            <LayoutDashboard aria-hidden="true" />
            Go to your dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
