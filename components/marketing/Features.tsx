import { Mic, PhoneCall, CalendarCheck2, ChartColumn, BookOpen, Plug, Sparkles } from 'lucide-react'
import { Reveal } from '@/components/marketing/Reveal'

const FEATURES = [
  {
    icon: PhoneCall,
    title: '24/7 Availability',
    description:
      'Your AI agent answers every single call, day or night, weekends included. No more missed opportunities.',
  },
  {
    icon: Mic,
    title: 'Natural Voice',
    description:
      "Powered by ElevenLabs' most realistic voices. Callers talk to it like a real person, not a robot.",
  },
  {
    icon: CalendarCheck2,
    title: 'Smart Scheduling',
    description:
      'Books meetings directly into Google Calendar mid-call, no back-and-forth emails required.',
  },
  {
    icon: ChartColumn,
    title: 'Real-Time Analytics',
    description:
      'Full transcripts, sentiment analysis, and call history in a live dashboard.',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    description:
      'Upload your docs, FAQs, and policies. Your agent learns your business in minutes.',
  },
  {
    icon: Plug,
    title: 'Native Integrations',
    description:
      'Google Calendar, Gmail, Sheets, and Docs, connected out of the box.',
  },
]

export function Features() {
  return (
    <section id="features" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Features
          </div>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
            Everything your AI agent handles for you
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From the first ring to the calendar invite, Neuro Tech Voice covers the whole conversation.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 80}>
              <div className="group h-full rounded-3xl border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-muted-foreground">{feature.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
