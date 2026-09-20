import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Inter, Inter_Tight } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { HEADER_BOOT } from '@/lib/header-dock'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  // Never part of a first screen; not worth a preload on every route.
  preload: false,
})

/**
 * Display face for the marketing site's editorial cover. The reference sets
 * its headlines in ReplicaLL — a licensed grotesque — so this is the closest
 * free substitute: same tight, slightly condensed neo-grotesque colour at the
 * −0.04em tracking the design depends on.
 */
const display = Inter_Tight({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
  // Preloaded by the marketing pages that paint it (components/site/fonts.ts), not on every route.
  preload: false,
})

/**
 * The site header's face: Inter, the variable build Google Fonts serves —
 * the same files the reference's nav and mega menus are painted with.
 */
const header = Inter({
  variable: '--font-header',
  subsets: ['latin'],
  display: 'swap',
  // Preloaded by the marketing pages that paint it (components/site/fonts.ts), not on every route.
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.neurotechvoice.com'),
  title: {
    default: 'Neuro Tech Voice — Your AI agent turns missed calls into booked meetings',
    template: '%s — Neuro Tech Voice',
  },
  description:
    'Neuro Tech Voice answers, qualifies, and books your customers automatically with a natural-sounding AI voice agent, live on your business number in minutes.',
  applicationName: 'Neuro Tech Voice',
  keywords: [
    'AI voice agent',
    'AI receptionist',
    'answering service',
    'missed call',
    'appointment booking',
    'Neuro Tech Voice',
  ],
  authors: [{ name: 'NEURO TECH VOICE S.R.L.' }],
  openGraph: {
    type: 'website',
    title: 'Neuro Tech Voice — AI voice agents that book your customers 24/7',
    description:
      'Answer, qualify, and book every caller automatically with a natural-sounding AI voice agent.',
    siteName: 'Neuro Tech Voice',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Neuro Tech Voice',
    description:
      'AI voice agents that answer, qualify, and book your customers, 24/7.',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${header.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        {/*
          The header's phase, decided during HTML parsing.

          A raw inline script rather than next/script: `beforeInteractive`
          does not execute inline content during parsing, it queues it on
          `self.__next_s` for the Next runtime to run, which is after the
          first paint — and the first paint is the entire point. Reloading
          halfway down the page has to paint the detached pill on frame
          one rather than paint the docked bar and correct it.

          Inert on every route but the homepage; <html> already carries
          suppressHydrationWarning, so the attribute it writes is fine.

          Content-Security-Policy: prerendered pages allow it through
          'unsafe-inline'; per-request pages (nonce policy) allow it by its
          sha256, which lib/security/csp.ts computes from HEADER_BOOT itself.
          Render it verbatim and never read headers() here for a nonce: that
          would make every route dynamic.
        */}
        <script id="ntv-nav-boot" dangerouslySetInnerHTML={{ __html: HEADER_BOOT }} />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
