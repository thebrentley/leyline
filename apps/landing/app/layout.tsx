import type { Metadata } from 'next'
import './globals.css'

const siteUrl = 'https://mtgleyline.com'
const title = 'Leyline | MTG Deck Builder, Pod Manager & Collection Tracker'
const description =
  'Leyline is the all-in-one Magic: The Gathering companion app. Build and optimize Commander decks with AI-powered insights, manage your MTG playgroup pods, track life totals, scan cards instantly, and organize your collection. EDH deck builder, mana curve analysis, card price tracker, MTG life counter, play group scheduler, and more — everything connected.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    'MTG',
    'Magic: The Gathering',
    'MTG deck builder',
    'Commander deck builder',
    'EDH deck builder',
    'MTG companion app',
    'MTG pod manager',
    'MTG playgroup',
    'Magic the Gathering app',
    'MTG life counter',
    'Commander life counter',
    'EDH life counter',
    'MTG card scanner',
    'Magic card scanner',
    'MTG collection tracker',
    'Magic collection manager',
    'MTG deck optimizer',
    'Commander deck optimizer',
    'EDH deck tech',
    'MTG mana curve',
    'MTG card prices',
    'MTG price tracker',
    'Commander pods',
    'MTG game night',
    'MTG play group organizer',
    'Magic the Gathering tools',
    'MTG AI deck building',
    'EDH staples',
    'Commander staples',
    'MTG deck analysis',
    'MTG meta analysis',
    'Commander meta',
    'EDH power level',
    'MTG deck ranking',
    'cEDH',
    'casual Commander',
    'MTG event scheduler',
    'MTG RSVP',
    'Magic the Gathering life tracker',
    'MTG multiplayer',
    'MTG 1v1',
  ],
  openGraph: {
    type: 'website',
    url: siteUrl,
    title,
    description,
    siteName: 'Leyline',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Leyline — MTG Deck Builder, Pod Manager & Collection Tracker',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
