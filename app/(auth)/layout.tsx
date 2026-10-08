import Image from 'next/image'
import Link from 'next/link'
import { CornerDot } from '@/components/site/corner-dot'
import { AuthSwitchLink } from '@/components/auth/AuthSwitchLink'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { Logo } from '@/components/shared/Logo'

const facts = [
  'Live on your number in minutes',
  'Natural voices in 14 languages',
  'Every call transcribed and summarised',
]

const quietLink =
  'rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

/*
 * Auth shell: a white form column (wordmark row with the Sign in / Create an
 * account switch, the page's form centred from sm, a quiet legal row) and,
 * from lg, the site's dark cover as an inset panel with the hero portrait.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ── Form column ─────────────────────────────────────────────────── */}
      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Link
            href="/"
            aria-label="NeuroVoice home"
            className="-mx-1 rounded-md px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Logo size="sm" />
          </Link>
          <AuthSwitchLink />
        </header>

        <main className="flex flex-1 flex-col sm:justify-center">
          <div className="mx-auto w-full max-w-[432px] px-4 pt-8 pb-14 lg:py-12">
            {children}
          </div>
        </main>

        <footer className="flex shrink-0 items-center justify-between gap-4 px-4 pb-6 text-xs leading-4 text-muted-foreground sm:px-6 lg:px-10">
          <span>Neuro Tech Voice</span>
          <nav aria-label="Legal" className="flex items-center gap-4">
            <Link href="/privacy" className={quietLink}>
              Privacy
            </Link>
            <Link href="/terms" className={quietLink}>
              Terms
            </Link>
          </nav>
        </footer>
      </div>

      {/* ── Cover panel (lg+) ───────────────────────────────────────────────
          Sticky on the outer box: `.app-cover` is an unlayered rule that sets
          `position: relative`, which would beat a `sticky` utility. */}
      <aside
        aria-label="About Neuro Tech Voice"
        className="hidden lg:sticky lg:top-3 lg:m-3 lg:block lg:h-[calc(100dvh-1.5rem)] lg:self-start"
      >
        <div className="app-cover h-full overflow-hidden rounded-[28px]">
          {/* The site hero's own portrait, graded like the cover's and mostly
              desaturated, so its coloured stripe light reads mauve-grey here
              (the app keeps the brand hue to small accents). Its box is 117 % of
              the panel, anchored to the bottom: the render's scan band (the top
              13.75 % of the art) then always sits above the clip, for any
              object-position y ≥ 20 %, at every panel aspect. It fades into the
              cover field at the top and under the copy. Eager: it is the LCP
              from lg; below lg `sizes` resolves to 0px, so a phone fetches only
              the smallest candidate (384 w, about 8 KB, cached across the auth
              pages). */}
          <div className="absolute inset-x-0 bottom-0 h-[117%]">
            <Image
              src="/hero-robot-portrait.webp"
              alt=""
              fill
              sizes="(min-width: 1024px) 50vw, 0px"
              loading="eager"
              className="object-cover object-[50%_25%] opacity-80 brightness-[0.78] saturate-[0.4] mask-t-from-72% mask-t-to-90% mask-b-from-42% mask-b-to-76%"
            />
          </div>
          <div aria-hidden className="cover-grain absolute inset-0" />

          {/* Masthead label, like the site cover's wordmark row. It sits on a
              translucent cover plate so it stays legible (≥ 4.5:1) over any
              crop of the portrait's backlight. */}
          <div className="absolute top-6 left-6 rounded-full bg-[#171520]/75 px-3 py-1.5 backdrop-blur-sm xl:top-8 xl:left-8">
            <Eyebrow tone="cover">Neuro Tech Voice</Eyebrow>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-8 xl:p-10">
            <p className="max-w-[30ch] text-[28px] leading-[32px] font-normal tracking-[-0.03em] text-balance text-[#dedce0] [font-family:var(--font-display),var(--font-header),ui-sans-serif,system-ui,sans-serif] xl:text-[34px] xl:leading-[38px]">
              An AI that answers every call for those who refuse to miss one.
            </p>

            <ul className="mt-6 space-y-2.5">
              {facts.map((fact) => (
                <li
                  key={fact}
                  className="flex items-center gap-3 text-sm leading-5 text-[#dedce0]/80"
                >
                  <CornerDot className="size-2 shrink-0 text-[#c0ace0]" />
                  {fact}
                </li>
              ))}
            </ul>

            <figure className="mt-8 hidden max-w-[440px] rounded-2xl bg-[#24212c] p-4 [@media(min-height:880px)]:block">
              <figcaption className="text-[11px] leading-4 font-medium tracking-[0.12em] text-[#dedce0]/60 uppercase">
                Sample greeting
              </figcaption>
              <blockquote className="mt-2 text-sm leading-[21px] text-[#dedce0]">
                &ldquo;Thank you for calling Northside Studio. This is Ava, an AI assistant.&rdquo;
              </blockquote>
            </figure>
          </div>
        </div>
      </aside>
    </div>
  )
}
