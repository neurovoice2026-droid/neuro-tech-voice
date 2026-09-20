import { SiteHeader } from '@/components/site/header'
import { Hero } from '@/components/site/hero'
import { Colophon } from '@/components/site/colophon'
import { CoverSpread } from '@/components/site/cover-spread'
import { Anatomy } from '@/components/site/anatomy'
import { Demo } from '@/components/site/demo'
import { Shelf } from '@/components/site/shelf'
import { UseCases } from '@/components/site/use-cases'
import { Comparison } from '@/components/site/comparison'
import { Solutions } from '@/components/site/solutions'
import { Register } from '@/components/site/register'
import { PricingPlans } from '@/components/site/pricing-plans'
import { Bill } from '@/components/site/bill'
import { Faq } from '@/components/site/faq'
import { Trust } from '@/components/site/trust'
import { Close } from '@/components/site/close'
import { Footer } from '@/components/site/footer'
import { siteFontVariables } from '@/components/site/fonts'

/**
 * The homepage, as one argument.
 *
 * The order is not a feature list. It is the sequence of questions a
 * business owner actually asks, and each section answers exactly one of
 * them before the next is allowed to be asked:
 *
 *   what is this · let me see it · why should I care · does it know my
 *   trade · why not one of the others · who are you · can I shape it ·
 *   what does it cost · what will *I* pay · what still worries me · can I
 *   trust you with my phone number · fine, then answer it
 *
 * Two structural rules hold the spread together, and both are worth
 * stating because a later edit will want to break them:
 *
 *  · **There is one panel on the page and it is the price list.** The
 *    bordered, shadowed card was byte-identical in six sections, which is
 *    what made a carefully-written page read as a brochure. Every other
 *    section now sits on the open field and groups with rules and space.
 *    `PricingPlans` keeps the panel, so the heaviest object on the spread
 *    is the moment a reader decides — which is where weight belongs.
 *  · **`ScrollProgress` is gone.** A bar tracking how much of a marketing
 *    page is left tells a reader the page is long. The page should not
 *    need a progress meter; if it does, the fix is upstream of the meter.
 */
export default function Home() {
  return (
    <>
      <SiteHeader />
      {/* Named and focusable so the header's skip link has somewhere to
          land, and so a hash jump out of the mega menu can move focus as
          well as the viewport. */}
      <main id="content" tabIndex={-1} className={`relative ${siteFontVariables}`}>
        <Hero />
        {/* Outside the spread on purpose: the colophon stands on the
            hero's own ink and its own gutter, and is the seam the field
            bridges up from. */}
        <Colophon />
        {/* One field behind all of it, so the interior reads as a single
            spread rather than as eleven sections sharing a palette. */}
        <CoverSpread>
          <Anatomy />
          <Demo />
          <Shelf />
          <UseCases />
          <Comparison />
          {/* The second business. A company that builds CRMs is more
              credible selling a phone agent, not less — and this is the
              only place on the page that says there is a company behind
              the product at all. */}
          <Solutions />
          <Register />
          <PricingPlans />
          <Bill />
          <Faq />
          {/* The last four doubts, answered immediately before the ask
              rather than left for the footer to imply. */}
          <Trust />
          <Close />
        </CoverSpread>
      </main>
      <Footer />
    </>
  )
}
