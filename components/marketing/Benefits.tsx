import { PhoneMissed, Hourglass, Repeat, TrendingUp, PiggyBank, Sparkles } from 'lucide-react'
import { Reveal } from '@/components/marketing/Reveal'
import { cn } from '@/lib/utils'

const SMALL_BENEFITS = [
  {
    icon: Hourglass,
    title: 'Hours back every week',
    description: 'No more sitting by the phone between meetings. Let the agent handle it while you focus on the work that grows the business.',
  },
  {
    icon: Repeat,
    title: 'Consistent every time',
    description: 'No bad days, no forgotten scripts, no attitude. Every caller gets the same professional experience.',
  },
  {
    icon: TrendingUp,
    title: 'Scales with you',
    description: 'Handle a busy Monday or a quiet Tuesday with the same agent. No extra hiring, no training, no onboarding.',
  },
  {
    icon: PiggyBank,
    title: 'Costs less than a hire',
    description: "A fraction of a receptionist's salary, running around the clock, with no sick days or turnover.",
  },
]

function BentoCard({
  icon: Icon, title, description, large, className,
}: {
  icon: React.ElementType
  title: string
  description: string
  large?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'group flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-8 shadow-lg shadow-primary/5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10',
        large && 'sm:p-10',
        className
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground',
          large ? 'h-14 w-14' : 'h-12 w-12'
        )}
      >
        <Icon className={large ? 'h-7 w-7' : 'h-6 w-6'} />
      </span>
      <div className="mt-6">
        <h3 className={cn('font-semibold text-foreground', large ? 'text-2xl md:text-3xl' : 'text-lg')}>
          {title}
        </h3>
        <p className={cn('mt-3 text-muted-foreground', large ? 'max-w-md text-lg' : 'text-sm')}>
          {description}
        </p>
      </div>
    </div>
  )
}

export function Benefits() {
  return (
    <section id="benefits" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Benefits
          </div>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
            What it actually means for your business
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Less about what the agent does, more about what changes for you once it&apos;s live.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          <Reveal className="lg:col-span-2 lg:row-span-2">
            <BentoCard
              icon={PhoneMissed}
              title="Never lose a lead again"
              description="Every unanswered call is a potential customer talking to your competitor instead. Your AI agent picks up in under a second, every single time, so no opportunity slips through."
              large
              className="h-full"
            />
          </Reveal>
          {SMALL_BENEFITS.map((benefit, i) => (
            <Reveal key={benefit.title} delay={(i + 1) * 100}>
              <BentoCard {...benefit} className="h-full" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
