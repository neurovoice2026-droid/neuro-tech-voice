import { Header } from '@/components/marketing/Header'
import { Hero } from '@/components/marketing/Hero'
import { Features } from '@/components/marketing/Features'
import { Benefits } from '@/components/marketing/Benefits'
import { Pricing } from '@/components/marketing/Pricing'
import { Faq } from '@/components/marketing/Faq'

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <Benefits />
        <Pricing />
        <Faq />
      </main>
    </>
  )
}
