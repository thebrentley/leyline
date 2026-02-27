import type { Metadata } from 'next'
import Link from 'next/link'
import { Smartphone, ArrowLeft } from 'lucide-react'

const pageTitle =
  'Get the App | Leyline — MTG Companion for Magic: The Gathering'
const pageDescription =
  'Download the Leyline MTG app for iOS. Magic: The Gathering life counter, card scanner, pod management, and Commander game night tools — all in your pocket.'

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: '/get-the-app',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: pageTitle,
    description: pageDescription,
    images: ['/og-image.png'],
  },
}
import LeylineLogo from '../../components/LeylineLogo'
import MobileFeatures from '../../components/MobileFeatures'
import Footer from '../../components/Footer'

function AppStoreBadge() {
  return (
    <a
      href="https://apps.apple.com/us/app/mtg-leyline/id6758968219"
      className="inline-flex items-center gap-3 rounded-xl border border-gray-600 bg-black px-5 py-3 transition-all hover:border-purple-500/60 hover:bg-gray-900"
    >
      <svg viewBox="0 0 24 24" className="h-8 w-8 fill-white" aria-hidden>
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      <div className="flex flex-col">
        <span className="text-[10px] font-medium leading-none text-gray-300">
          Download on the
        </span>
        <span className="text-lg font-semibold leading-tight text-white">
          App Store
        </span>
      </div>
    </a>
  )
}

function GooglePlayBadge() {
  return (
    <div className="group relative inline-flex items-center gap-3 rounded-xl border border-gray-700/50 bg-black/50 px-5 py-3 opacity-50">
      <svg viewBox="0 0 24 24" className="h-8 w-8 fill-gray-400" aria-hidden>
        <path d="M3.18 23.67c-.19-.2-.18-.42-.18-.64V1c0-.26-.01-.52.21-.74L13.33 12 3.18 23.67zm1.4.74l11.24-6.49-2.46-2.48L3.58 24.4l1 .01zM20.16 13.16l-3.28 1.88-2.72-2.73 2.65-2.65 3.35 1.94c.78.45.79 1.12 0 1.56zM4.58-.41l9.79 8.91-2.46 2.46L4.58-.41z" />
      </svg>
      <div className="flex flex-col">
        <span className="text-[10px] font-medium leading-none text-gray-500">
          GET IT ON
        </span>
        <span className="text-lg font-semibold leading-tight text-gray-400">
          Google Play
        </span>
      </div>
      <span className="absolute -right-2 -top-2 rounded-full border border-purple-700/50 bg-purple-900/80 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-purple-300">
        SOON
      </span>
    </div>
  )
}

export default function GetTheApp() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-purple-950/40 to-gray-950">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-4 md:px-8 md:py-6">
        <Link href="/" className="flex items-center gap-2 md:gap-3">
          <LeylineLogo className="h-8 w-8 md:h-10 md:w-10" />
          <div>
            <div className="text-base font-light tracking-wider text-white md:text-xl">
              LEYLINE
            </div>
            <div className="hidden text-[10px] font-light tracking-[0.3em] text-gray-400 sm:block">
              EVERYTHING. CONNECTED.
            </div>
          </div>
        </Link>

        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm transition-all hover:border-purple-600/50 hover:bg-gray-800/50 md:px-5 md:py-2.5 md:text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </header>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 pb-8 pt-12 md:pt-20">
        {/* Phone Icon with Glow */}
        <div className="relative mb-8">
          <div className="rounded-full border border-purple-600/50 bg-purple-900/30 p-6 md:p-8">
            <Smartphone className="h-12 w-12 text-purple-400 md:h-16 md:w-16" />
          </div>
          <div className="absolute inset-0 -z-10 rounded-full bg-purple-600/20 blur-2xl" />
        </div>

        <div className="space-y-4 text-center md:space-y-6">
          <h1 className="text-4xl font-light tracking-tight text-white md:text-6xl lg:text-7xl">
            Get the App
          </h1>
          <p className="max-w-lg text-base text-gray-400 md:text-lg">
            Your pods, life counter, and card scanner — all in your pocket.
          </p>
        </div>

        {/* Store Badges */}
        <div className="mt-10 flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
          <AppStoreBadge />
          <GooglePlayBadge />
        </div>

        {/* Background Glow Effects */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-3xl" />
        </div>
      </div>

      {/* Mobile Features */}
      <MobileFeatures />

      {/* Footer */}
      <Footer />
    </div>
  )
}
