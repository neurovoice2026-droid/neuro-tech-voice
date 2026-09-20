import { SiteHeader } from '@/components/site/header'
import { Hero } from '@/components/site/hero'
import { Colophon } from '@/components/site/colophon'
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
import { ppCinema, ppDisplay } from '@/components/site/product/fonts'

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
 * **The page is in the light `pp` system, like every other marketing page
 * on this site.** It was briefly built in the dark `cover` system on the
 * reasoning that the hero is dark and the hero is the style contract.
 * That was backwards: the hero is one fixed object, while `pp` is the
 * language of twenty-one other routes, and a homepage that does not look
 * like the pages it sends people to is the one page that is wrong.
 *
 * So the spread reads dark → white → dark: the frozen hero carries its own
 * `.cover`, the body below is `.pp` on white stock, and the footer carries
 * `.cover` again. That is not a compromise — it is exactly how every
 * product and industry page is already built, white body under a dark
 * imprint, and the hero simply extends that sandwich upward.
 *
 * The header keeps its `cover` tone. Its tone is a static prop with no
 * scroll switch, and it has to be legible over the dark hero it sits on at
 * rest; a dark floating pill over white content is the lesser cost.
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
        {/* `.pp` owns the white stock, the tokens and the body face; the two
            font variables are declared here rather than in the root layout
            so the app and the dashboard never download Onest or Cormorant. */}
        <div className={`pp ${ppDisplay.variable} ${ppCinema.variable} relative overflow-x-clip`}>
          <Colophon />
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
        </div>
      </main>
      <Footer />
    </>
  )
}
