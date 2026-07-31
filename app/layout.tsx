import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Inter_Tight } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
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
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
