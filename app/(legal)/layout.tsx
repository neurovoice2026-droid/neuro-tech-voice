import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        {children}
      </main>
      <Footer />
    </>
  )
}
