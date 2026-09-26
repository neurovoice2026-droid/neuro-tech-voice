import { SiteHeader } from '@/components/site/header'
import { Hero } from '@/components/site/hero'
import { Footer } from '@/components/site/footer'
import { siteFontVariables } from '@/components/site/fonts'
import { homeCinema, homeDisplay } from '@/components/site/home/fonts'
import { Gap } from '@/components/site/product/primitives'
import { HomeDeferred } from '@/components/site/home/deferred'
import { Demo } from '@/components/site/home/demo'
import { Trades } from '@/components/site/home/trades'
import { Voice } from '@/components/site/home/voice'
import { Knowledge } from '@/components/site/home/knowledge'
import { AfterCall } from '@/components/site/home/after-call'
import { Pricing } from '@/components/site/home/pricing'
import { Trust } from '@/components/site/home/trust'
import { Doubts } from '@/components/site/home/doubts'
import { Start } from '@/components/site/home/start'
import { buildGreetingTable, buildHomeCalls, buildHomeTrades } from '@/lib/pages/home.server'
import '@/components/site/home/home.css'

/**
 * The homepage: one made-up business, shown working.
 *
 * Every sample below the hero belongs to the same business, Northside
 * Studio, and each section answers one question an owner asks before the
 * next is allowed to be asked:
 *
 *   will it pick up when I can't · does it know my trade · will it
 *   sound right, and will it pretend to be human · will it know my prices,
 *   and what if it doesn't · does anything happen after the call · what
 *   will I pay · can I trust you · what still worries me · how do I begin
 *
 * **The body is in the light `pp` system, like every other marketing page
 * on this site,** so the spread reads dark → white → dark: the frozen hero
 * carries its own `.cover`, everything from the call down sits on white
 * stock, and the footer carries `.cover` again.
 *
 * The calls, the trades and the greetings are built here, on the server,
 * and handed down as plain props: the voice library, the prompt templates
 * and the scene the trade window opens on never reach a client chunk, and
 * the opening poster is in the HTML. Everything else reads `HOME`
 * directly.
 *
 * The calls are not deferred: their stage is the first thing under the
 * hero, and its poster (3 a.m., booked) belongs in the first paint.
 * Every other section sits in a `HomeDeferred` box holding its measured
 * height at 375, 768, 1024 and 1440: `.pp` turns scroll anchoring off, so
 * a reserve that is far out moves the page under the reader when the box
 * renders, and sends an anchor jump to the wrong place on a phone.
 *
 * `#features` is where the legal pages' header and footer send
 * "Features", so it wraps the three sections about what the agent does
 * rather than naming any one of them. home.css is imported here, once, so
 * its rules ship with this route only.
 *
 * The header keeps its `cover` tone. Its tone is a static prop with no
 * scroll switch, and it has to be legible over the dark hero it sits on at
 * rest; a dark floating pill over white content is the lesser cost.
 */
export default async function Home() {
  const calls = buildHomeCalls()
  const trades = await buildHomeTrades()
  const greetings = buildGreetingTable()

  return (
    <>
      <SiteHeader />
      {/* Named and focusable so the header's skip link has somewhere to
          land, and so a hash jump out of the mega menu can move focus as
          well as the viewport. */}
      <main id="content" tabIndex={-1} className={`relative ${siteFontVariables}`}>
        <Hero />
        {/* `.pp` owns the white stock, the tokens and the body face, and
            `home-body` retunes them for the landing (home.css). The two
            font variables are declared here rather than in the root layout
            so the app and the dashboard never download Instrument Sans or
            Cormorant, and "/" never downloads the product pages' Onest. */}
        <div className={`pp home-body ${homeDisplay.variable} ${homeCinema.variable} relative overflow-x-clip`}>
          <Demo calls={calls} />
          <Gap />
          <HomeDeferred size={[1565, 1393, 1099, 1061]}>
            <Trades data={trades} />
          </HomeDeferred>
          <Gap />
          <div id="features" className="scroll-mt-28">
            <HomeDeferred size={[1069, 1085, 961, 899]}>
              <Voice table={greetings} />
            </HomeDeferred>
            <Gap />
            <HomeDeferred size={[1604, 1259, 1099, 1099]}>
              <Knowledge />
            </HomeDeferred>
            <Gap />
            <HomeDeferred size={[1781, 1352, 1057, 971]}>
              <AfterCall />
            </HomeDeferred>
          </div>
          <Gap />
          <HomeDeferred size={[2834, 2462, 2701, 2097]}>
            <Pricing />
          </HomeDeferred>
          <Gap />
          <HomeDeferred size={[1333, 869, 797, 598]}>
            <Trust />
          </HomeDeferred>
          <Gap />
          <HomeDeferred size={[745, 579, 429, 401]}>
            <Doubts />
          </HomeDeferred>
          <Gap />
          <HomeDeferred size={[1501, 1079, 953, 949]}>
            <Start />
          </HomeDeferred>
          <Gap className="h-16 md:h-24" />
        </div>
      </main>
      <Footer />
    </>
  )
}
