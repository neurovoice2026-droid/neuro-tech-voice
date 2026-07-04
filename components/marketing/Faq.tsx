import { Sparkles } from 'lucide-react'
import { Reveal } from '@/components/marketing/Reveal'
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion'
import { PLANS } from '@/types'

const FAQS = [
  {
    question: 'Do I need a credit card to start?',
    answer: `No. Every plan starts with a 14-day free trial and ${PLANS.trial.minutes_limit} minutes included, no credit card required.`,
  },
  {
    question: 'How long does it take to set up my AI agent?',
    answer: "Most businesses are live in under 10 minutes: pick a personality and voice, connect a phone number, and your agent starts answering calls immediately.",
  },
  {
    question: 'What languages does the agent support?',
    answer: "Your agent can speak in multiple languages and accents, powered by ElevenLabs' multilingual voice models.",
  },
  {
    question: 'What happens if I go over my included minutes?',
    answer: "You're never cut off. Extra minutes are billed per minute at your plan's overage rate (as low as $0.18/min on higher tiers), and you can upgrade anytime.",
  },
  {
    question: 'Which tools does it integrate with?',
    answer: 'Google Calendar, Gmail, Sheets, Docs, and Drive are connected natively. Your agent can book meetings, send emails, log calls, and more, automatically.',
  },
  {
    question: 'Can I cancel or change my plan anytime?',
    answer: 'Yes. Upgrade, downgrade, or cancel anytime from your billing settings. No long-term contract.',
  },
  {
    question: 'Do I need a new phone number, or can I use my existing one?',
    answer: "You'll get a dedicated business number in seconds as part of setup. Porting in an existing number isn't supported yet.",
  },
]

export function Faq() {
  return (
    <section id="faq" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            FAQ
          </div>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
            Questions you might have
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Can&apos;t find what you&apos;re looking for? Sign up and ask your agent directly, it&apos;s the fastest way to see it in action.
          </p>
        </Reveal>

        <Reveal delay={100} className="mt-12">
          <Accordion className="rounded-3xl border border-border bg-card px-6 shadow-sm sm:px-8">
            {FAQS.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  )
}
