'use client'

import Link from 'next/link'
import { Smartphone, ArrowLeft } from 'lucide-react'
import LeylineLogo from '../../components/LeylineLogo'

export default function GetTheApp() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-gray-950 via-purple-950/40 to-gray-950">
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

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16">
        {/* Phone Icon with Glow */}
        <div className="relative mb-8">
          <div className="rounded-full border border-purple-600/50 bg-purple-900/30 p-6 md:p-8">
            <Smartphone className="h-12 w-12 text-purple-400 md:h-16 md:w-16" />
          </div>
          <div className="absolute inset-0 -z-10 rounded-full bg-purple-600/20 blur-2xl" />
        </div>

        {/* Coming Soon Text */}
        <div className="space-y-4 text-center md:space-y-6">
          <h1 className="text-4xl font-light tracking-tight text-white md:text-6xl lg:text-7xl">
            Coming Soon
          </h1>
          <p className="max-w-md text-base text-gray-400 md:text-lg">
            The Leyline mobile app is in development. Stay tuned for updates.
          </p>
        </div>

        {/* Back to Home CTA */}
        <div className="mt-10 md:mt-12">
          <Link
            href="/"
            className="inline-block rounded-lg border border-purple-600/50 bg-purple-600 px-6 py-3 text-base font-medium text-white transition-all hover:bg-purple-500 md:px-8 md:py-4 md:text-lg"
          >
            Back to Home
          </Link>
        </div>
      </div>

      {/* Background Glow Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-3xl" />
      </div>
    </div>
  )
}
