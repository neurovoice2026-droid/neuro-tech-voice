import { ScrollProgress } from '@/components/site/reveal'
import { Navbar } from '@/components/site/navbar'
import { Hero } from '@/components/site/hero'
import { Marquee } from '@/components/site/marquee'
import { CoverSpread } from '@/components/site/cover-spread'
import { Features } from '@/components/site/features'
import { LiveDemo } from '@/components/site/live-demo'
import { UseCases } from '@/components/site/use-cases'
import { HowItWorks } from '@/components/site/how-it-works'
import { Stats } from '@/components/site/stats'
import { Comparison } from '@/components/site/comparison'
import { Pricing } from '@/components/site/pricing'
import { Faq } from '@/components/site/faq'
import { CTA } from '@/components/site/cta'
import { Footer } from '@/components/site/footer'

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <Navbar />
      <main className="relative">
        <Hero />
        <Marquee />
        {/* One field behind both, so the interior reads as a single spread
            rather than as two sections that happen to share a palette. */}
        <CoverSpread>
          <Features />
          <LiveDemo />
          <UseCases />
          {/* Last turn of the spread: what it does, seeing it work, who it's
              for, and then how you get it. */}
          <HowItWorks />
          <Stats />
          <Comparison />
          <Pricing />
          {/* The spread runs to the end now. Faq and CTA were the last two
              sections on the old white stock, and they were the last two a
              reader saw before deciding — the page stopped being itself at
              exactly the wrong moment. */}
          <Faq />
          <CTA />
        </CoverSpread>
      </main>
      <Footer />
    </>
  )
}
