import { Check } from 'lucide-react'
import { Reveal } from '@/components/marketing/Reveal'
import { cn } from '@/lib/utils'

interface FeatureRowProps {
  eyebrow: string
  title: string
  description: string
  points: string[]
  visual: React.ReactNode
  reverse?: boolean
}

export function FeatureRow({ eyebrow, title, description, points, visual, reverse }: FeatureRowProps) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className={cn(reverse && 'lg:order-2')}>
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </span>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
        </h3>
        <p className="mt-4 text-lg text-muted-foreground">{description}</p>
        <ul className="mt-6 space-y-3">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="text-foreground/90">{point}</span>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={150} className={cn(reverse && 'lg:order-1')}>
        {visual}
      </Reveal>
    </div>
  )
}
