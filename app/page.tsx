import { Header } from '@/components/marketing/Header'
import { Hero } from '@/components/marketing/Hero'
import { Features } from '@/components/marketing/Features'
import { Pricing } from '@/components/marketing/Pricing'
import { Faq } from '@/components/marketing/Faq'
import { Footer } from '@/components/marketing/Footer'

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </>
  )
}
