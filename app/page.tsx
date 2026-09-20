import { ScrollProgress } from '@/components/site/reveal'
import { SiteHeader } from '@/components/site/header'
import { Hero } from '@/components/site/hero'
import { Marquee } from '@/components/site/marquee'
import { CoverSpread } from '@/components/site/cover-spread'
import { Features } from '@/components/site/features'
import { LiveDemo } from '@/components/site/live-demo'
import { UseCases } from '@/components/site/use-cases'
import { HowItWorks } from '@/components/site/how-it-works'
import { Stats } from '@/components/site/stats'
import { Comparison } from '@/components/site/comparison'
import { PricingPlans } from '@/components/site/pricing-plans'
import { Pricing } from '@/components/site/pricing'
import { Faq } from '@/components/site/faq'
import { CTA } from '@/components/site/cta'
import { Footer } from '@/components/site/footer'
import { siteFontVariables } from '@/components/site/fonts'

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <SiteHeader />
      {/* Named and focusable so the header's skip link has somewhere to
          land, and so a hash jump out of the mega menu can move focus as
          well as the viewport. */}
      <main id="content" tabIndex={-1} className={`relative ${siteFontVariables}`}>
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
          {/* The price list answers "what do I get, and is that good"; the
              receipt below answers "what will I actually pay". In that
              order — the second question is only worth asking once the
              first one has a good answer. */}
          <PricingPlans />
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
