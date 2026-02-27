'use client'

import Link from 'next/link'
import { Sparkles, Users, TrendingUp } from 'lucide-react'
import LeylineLogo from './LeylineLogo'

export default function Hero() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8081'

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-purple-950/40 to-gray-950">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-4 md:px-8 md:py-6">
        <div className="flex items-center gap-2 md:gap-3">
          <LeylineLogo className="h-8 w-8 md:h-10 md:w-10" />
          <div>
            <div className="text-base font-light tracking-wider text-white md:text-xl">
              LEYLINE
            </div>
            <div className="hidden text-[10px] font-light tracking-[0.3em] text-gray-400 sm:block">
              EVERYTHING. CONNECTED.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <a
            href={`${appUrl}/login`}
            className="hidden rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm transition-all hover:border-purple-600/50 hover:bg-gray-800/50 sm:inline-block md:px-5 md:py-2.5 md:text-sm"
          >
            Log In
          </a>
          <a
            href={`${appUrl}/signup`}
            className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm transition-all hover:border-purple-600/50 hover:bg-gray-800/50 md:px-5 md:py-2.5 md:text-sm"
          >
            Sign Up
          </a>
          <Link
            href="/get-the-app"
            className="rounded-lg border border-purple-600/50 bg-purple-600 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-purple-500 md:px-5 md:py-2.5 md:text-sm"
          >
            Get the App
          </Link>
        </div>
      </header>

      {/* Alpha Badge */}
      <div className="absolute right-4 top-20 z-20 md:right-8 md:top-28">
        <div className="flex items-center gap-2 rounded-full border border-purple-700/30 bg-gradient-to-r from-purple-900/50 to-gray-900/50 px-3 py-1.5 backdrop-blur-sm md:px-4 md:py-2">
          <Sparkles className="h-3 w-3 text-purple-400 md:h-4 md:w-4" />
          <span className="text-xs font-medium tracking-wider text-purple-300 md:text-sm">
            ALPHA
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-12 pb-16 md:px-8 md:pt-20 md:pb-12">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left Column - Text */}
          <div className="space-y-6 md:space-y-8">
            {/* Hero Text */}
            <div className="space-y-4 md:space-y-6">
              <div className="text-base font-medium tracking-wide text-purple-400 md:text-lg">
                Begin with an edge
              </div>
              <h1 className="text-5xl font-light leading-tight tracking-tight text-white md:text-6xl lg:text-8xl">
                The line
                <br />
                between you
                <br />
                and{' '}
                <span className="bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent">
                  better Magic
                </span>
              </h1>
            </div>

            {/* Feature Callouts */}
            <div className="space-y-3 pt-2 md:space-y-4 md:pt-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-purple-900/30 p-2">
                  <TrendingUp className="h-4 w-4 text-purple-400 md:h-5 md:w-5" />
                </div>
                <p className="text-base text-gray-300 md:text-lg">
                  Tough matchups? We'll make your deck unstoppable.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-purple-900/30 p-2">
                  <Sparkles className="h-4 w-4 text-purple-400 md:h-5 md:w-5" />
                </div>
                <p className="text-base text-gray-300 md:text-lg">
                  We'll Handle Any Meta — AI-Powered Insights
                </p>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-6 md:pt-8">
              <a
                href={`${appUrl}/signup`}
                className="inline-block rounded-lg bg-purple-600 px-6 py-3 text-base font-medium text-white transition-all hover:bg-purple-500 md:px-8 md:py-4 md:text-lg"
              >
                Tap into more →
              </a>
            </div>
          </div>

          {/* Right Column - MTG Board Visual */}
          <div className="relative hidden lg:block">
            {/* MTG 1v1 Board Space */}
            <div className="relative rounded-3xl border border-purple-800/30 bg-gradient-to-br from-gray-900 via-purple-950/20 to-gray-900 p-8 backdrop-blur-sm">
              {/* Player 1 (Top) */}
              <div className="space-y-3">
                <div className="text-center text-sm font-medium text-purple-300">
                  OPPONENT
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[2.5/3.5] rounded-lg border border-purple-700/40 bg-gradient-to-br from-purple-900/40 to-purple-950/40"
                    />
                  ))}
                </div>
              </div>

              {/* Battlefield Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-purple-700/30" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-gray-900 px-4 text-xs font-medium tracking-wider text-purple-400">
                    BATTLEFIELD
                  </span>
                </div>
              </div>

              {/* Player 2 (Bottom - You) */}
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[2.5/3.5] rounded-lg border border-purple-600/50 bg-gradient-to-br from-purple-600/30 to-purple-500/30 shadow-lg shadow-purple-900/50"
                    />
                  ))}
                </div>
                <div className="text-center text-sm font-medium text-purple-400">
                  YOU
                </div>
              </div>

              {/* Glow Effect */}
              <div className="absolute inset-0 -z-10 rounded-3xl bg-purple-600/10 blur-3xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
