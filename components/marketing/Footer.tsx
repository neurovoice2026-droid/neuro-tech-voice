import Link from 'next/link'
import { Phone, MapPin } from 'lucide-react'
import { Logo } from '@/components/shared/Logo'

const PRODUCT_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
]

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/cookies', label: 'Cookie Policy' },
  { href: '/refund-policy', label: 'Refund & Cancellation Policy' },
]

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <Logo size="sm" />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              AI voice agents that answer, qualify, and book your customers, 24/7.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Product</h3>
            <ul className="mt-4 space-y-3">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Legal</h3>
            <ul className="mt-4 space-y-3">
              {LEGAL_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">NEURO TECH VOICE S.R.L.</p>
            <p>CUI: 53666540</p>
            <p className="flex items-start gap-1.5 max-w-sm">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Bulevardul Revoluția Din Decembrie, Nr. 12, Ap. 2, Reșița, Județ Caraș-Severin, România
            </p>
            <a href="tel:+40774566367" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              +40 774 566 367
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Neuro Tech Voice S.R.L. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
