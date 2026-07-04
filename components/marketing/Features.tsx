import { Sparkles } from 'lucide-react'
import { Reveal } from '@/components/marketing/Reveal'
import { FeatureRow } from '@/components/marketing/FeatureRow'
import {
  AvailabilityVisual, VoiceVisual, SchedulingVisual, AnalyticsVisual,
} from '@/components/marketing/FeatureVisuals'

const FEATURE_ROWS = [
  {
    eyebrow: 'Always on',
    title: 'Never let a call go to voicemail again',
    description:
      'Your AI agent picks up instantly, any hour, any day, so every customer gets a real conversation instead of an answering machine.',
    points: [
      'No missed calls, ever',
      'Handles nights, weekends, and holidays',
      'Instant pickup, zero hold time',
    ],
    visual: <AvailabilityVisual />,
  },
  {
    eyebrow: 'Sounds human',
    title: 'A voice callers actually enjoy talking to',
    description:
      "Built on ElevenLabs' most realistic voice models, your agent speaks naturally, understands context, and responds like a real team member would.",
    points: [
      'Lifelike, natural-sounding voice',
      'Understands context mid-conversation',
      'Multiple languages and accents',
    ],
    visual: <VoiceVisual />,
  },
  {
    eyebrow: 'Automatic booking',
    title: 'Meetings booked before you even wake up',
    description:
      'The agent checks your real availability and books directly into Google Calendar during the call, no forms, no follow-up emails, no double-booking.',
    points: [
      'Syncs live with Google Calendar',
      'Confirms instantly, no back-and-forth',
      'Zero double-bookings',
    ],
    visual: <SchedulingVisual />,
  },
  {
    eyebrow: 'Full visibility',
    title: 'Every call, transcribed and analyzed instantly',
    description:
      'Full transcripts, sentiment scoring, and call trends land in your dashboard the moment a call ends, so you always know how your business sounds.',
    points: [
      'Full transcripts for every call',
      'Sentiment analysis built in',
      'Live dashboard, updated in real time',
    ],
    visual: <AnalyticsVisual />,
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

        <div className="mt-20 flex flex-col gap-20 md:mt-28 md:gap-28">
          {FEATURE_ROWS.map((row, i) => (
            <FeatureRow key={row.title} {...row} reverse={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  )
}
