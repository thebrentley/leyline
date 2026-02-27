import Hero from '@/components/Hero'
import Features from '@/components/Features'
import Footer from '@/components/Footer'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'MTG Leyline',
  applicationCategory: 'GameApplication',
  operatingSystem: 'iOS',
  description:
    'All-in-one Magic: The Gathering companion app. MTG deck builder, Commander pod manager, life counter, card scanner, and collection tracker.',
  url: 'https://mtgleyline.com',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <Features />
      <Footer />
    </main>
  )
}
