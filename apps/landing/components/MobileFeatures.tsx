'use client'

import { Heart, ScanLine, Minus, Plus, Camera, Zap, Bell, Calendar, Users, Clock } from 'lucide-react'

export default function MobileFeatures() {
  return (
    <section className="relative overflow-hidden bg-gray-950">
      {/* Subtle divider glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-600/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        {/* Section Header */}
        <div className="mb-16 text-center md:mb-24">
          <div className="mb-4 text-sm font-medium tracking-[0.3em] text-purple-400">
            ON YOUR PHONE
          </div>
          <h2 className="text-3xl font-light tracking-tight text-white md:text-5xl">
            Your game,{' '}
            <span className="bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent">
              in your pocket
            </span>
          </h2>
        </div>

        {/* Feature 1 — Life Counter */}
        <div className="mb-24 grid items-center gap-12 md:mb-32 lg:grid-cols-2 lg:gap-20">
          {/* Text */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-900/40 p-2.5">
                <Heart className="h-5 w-5 text-purple-400" />
              </div>
              <span className="text-sm font-medium tracking-wider text-purple-400">
                LIFE COUNTER
              </span>
            </div>
            <h3 className="text-2xl font-light tracking-tight text-white md:text-4xl">
              Track every point.
              <br />
              <span className="text-gray-400">Never lose count again.</span>
            </h3>
            <p className="max-w-md text-base leading-relaxed text-gray-400 md:text-lg">
              Elegant, distraction-free life tracking for any format. Tap to
              adjust, swipe to reset. Built for the speed of real games.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {['Commander', '1v1', 'Multiplayer'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-purple-800/40 bg-purple-900/20 px-4 py-1.5 text-xs font-medium tracking-wide text-purple-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Visual — Life Counter Mockup */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-72 md:w-80">
              {/* Phone frame */}
              <div className="rounded-[2.5rem] border border-gray-700/60 bg-gradient-to-b from-gray-900 to-gray-950 p-3 shadow-2xl shadow-purple-900/20">
                <div className="overflow-hidden rounded-[2rem] bg-gray-950">
                  {/* Screen content */}
                  <div className="flex flex-col">
                    {/* Opponent half — rotated */}
                    <div className="relative flex h-48 rotate-180 flex-col items-center justify-center bg-gradient-to-b from-red-950/30 to-gray-950 p-4">
                      <div className="mb-1 text-xs font-medium tracking-wider text-gray-500">
                        OPPONENT
                      </div>
                      <div className="text-7xl font-extralight tabular-nums text-red-400">
                        37
                      </div>
                      <div className="mt-3 flex gap-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-red-800/40 bg-red-950/40">
                          <Minus className="h-4 w-4 text-red-400" />
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-red-800/40 bg-red-950/40">
                          <Plus className="h-4 w-4 text-red-400" />
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="relative z-10 flex items-center justify-center">
                      <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-600/50 to-transparent" />
                      <div className="relative rounded-full border border-purple-700/50 bg-gray-900 px-3 py-1">
                        <Zap className="h-3 w-3 text-purple-400" />
                      </div>
                    </div>

                    {/* Player half */}
                    <div className="relative flex h-48 flex-col items-center justify-center bg-gradient-to-b from-gray-950 to-purple-950/30 p-4">
                      <div className="mt-3 flex gap-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-700/40 bg-purple-950/40">
                          <Minus className="h-4 w-4 text-purple-400" />
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-700/40 bg-purple-950/40">
                          <Plus className="h-4 w-4 text-purple-400" />
                        </div>
                      </div>
                      <div className="mt-2 text-7xl font-extralight tabular-nums text-purple-300">
                        40
                      </div>
                      <div className="mt-1 text-xs font-medium tracking-wider text-gray-500">
                        YOU
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Ambient glow */}
              <div className="absolute -inset-8 -z-10 rounded-full bg-purple-600/8 blur-3xl" />
            </div>
          </div>
        </div>

        {/* Feature 2 — Card Scanning */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Visual — Scanner Mockup (left on desktop) */}
          <div className="relative order-2 flex justify-center lg:order-1 lg:justify-start">
            <div className="relative w-72 md:w-80">
              {/* Phone frame */}
              <div className="rounded-[2.5rem] border border-gray-700/60 bg-gradient-to-b from-gray-900 to-gray-950 p-3 shadow-2xl shadow-purple-900/20">
                <div className="overflow-hidden rounded-[2rem] bg-gray-950">
                  {/* Camera viewfinder */}
                  <div className="relative flex h-[26rem] flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-900/95 to-gray-950 p-6">
                    {/* Viewfinder corners */}
                    <div className="relative flex h-56 w-40 items-center justify-center">
                      {/* Top-left corner */}
                      <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-purple-400 rounded-tl-lg" />
                      {/* Top-right corner */}
                      <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-purple-400 rounded-tr-lg" />
                      {/* Bottom-left corner */}
                      <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-purple-400 rounded-bl-lg" />
                      {/* Bottom-right corner */}
                      <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-purple-400 rounded-br-lg" />

                      {/* Scan line effect */}
                      <div className="absolute inset-x-2 top-1/3 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />

                      {/* Card placeholder */}
                      <div className="h-48 w-34 rounded-xl border border-dashed border-gray-600/50 bg-gray-800/20 flex flex-col items-center justify-center gap-2">
                        <div className="rounded-lg bg-purple-900/30 p-2">
                          <Camera className="h-5 w-5 text-purple-400/60" />
                        </div>
                        <span className="text-[10px] font-medium tracking-wider text-gray-500">
                          ALIGN CARD
                        </span>
                      </div>
                    </div>

                    {/* Recognition result preview */}
                    <div className="mt-6 w-full rounded-xl border border-purple-800/30 bg-purple-950/30 p-3 backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-7 rounded bg-gradient-to-br from-purple-600/40 to-purple-800/40 border border-purple-700/30" />
                        <div className="flex-1">
                          <div className="text-xs font-medium text-white">
                            Sheoldred, the Apocalypse
                          </div>
                          <div className="mt-0.5 text-[10px] text-gray-400">
                            Legendary Creature — Phyrexian Praetor
                          </div>
                        </div>
                        <div className="text-[10px] font-medium text-green-400">
                          ✓ Found
                        </div>
                      </div>
                    </div>

                    {/* Bottom action */}
                    <div className="mt-4 flex items-center gap-2 rounded-full border border-gray-700/50 bg-gray-800/50 px-4 py-2">
                      <ScanLine className="h-3.5 w-3.5 text-purple-400" />
                      <span className="text-xs font-medium text-gray-300">
                        Scan another
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Ambient glow */}
              <div className="absolute -inset-8 -z-10 rounded-full bg-purple-600/8 blur-3xl" />
            </div>
          </div>

          {/* Text */}
          <div className="order-1 space-y-6 lg:order-2">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-900/40 p-2.5">
                <ScanLine className="h-5 w-5 text-purple-400" />
              </div>
              <span className="text-sm font-medium tracking-wider text-purple-400">
                CARD SCANNER
              </span>
            </div>
            <h3 className="text-2xl font-light tracking-tight text-white md:text-4xl">
              Point. Scan. Know.
              <br />
              <span className="text-gray-400">Instant card recognition.</span>
            </h3>
            <p className="max-w-md text-base leading-relaxed text-gray-400 md:text-lg">
              Identify any card in seconds. Get prices, rulings, and
              legality — all from your camera. Build or catalog your
              collection on the fly.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {['Prices', 'Rulings', 'Legality', 'Collection'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-purple-800/40 bg-purple-900/20 px-4 py-1.5 text-xs font-medium tracking-wide text-purple-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Feature 3 — Notifications */}
        <div className="mt-24 grid items-center gap-12 md:mt-32 lg:grid-cols-2 lg:gap-20">
          {/* Text */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-900/40 p-2.5">
                <Bell className="h-5 w-5 text-purple-400" />
              </div>
              <span className="text-sm font-medium tracking-wider text-purple-400">
                NOTIFICATIONS
              </span>
            </div>
            <h3 className="text-2xl font-light tracking-tight text-white md:text-4xl">
              Never miss a game night.
              <br />
              <span className="text-gray-400">Stay in the loop, effortlessly.</span>
            </h3>
            <p className="max-w-md text-base leading-relaxed text-gray-400 md:text-lg">
              Get notified when your pod schedules an event, when players RSVP,
              and when game night is about to start. No more missed messages in
              the group chat.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {['Events', 'RSVPs', 'Reminders', 'Pod Updates'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-purple-800/40 bg-purple-900/20 px-4 py-1.5 text-xs font-medium tracking-wide text-purple-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Visual — Notifications Mockup */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-72 md:w-80">
              {/* Phone frame */}
              <div className="rounded-[2.5rem] border border-gray-700/60 bg-gradient-to-b from-gray-900 to-gray-950 p-3 shadow-2xl shadow-purple-900/20">
                <div className="overflow-hidden rounded-[2rem] bg-gray-950">
                  {/* Screen content */}
                  <div className="flex flex-col p-5">
                    {/* Status bar */}
                    <div className="mb-5 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-gray-500">
                        9:41
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-3 rounded-full bg-gray-600" />
                        <div className="h-1 w-3 rounded-full bg-gray-600" />
                        <div className="h-2.5 w-5 rounded-sm border border-gray-600 p-px">
                          <div className="h-full w-3/4 rounded-sm bg-green-500" />
                        </div>
                      </div>
                    </div>

                    {/* Notification 1 */}
                    <div className="mb-3 rounded-2xl border border-purple-800/30 bg-purple-950/30 p-4">
                      <div className="mb-2 flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-900/60">
                          <Calendar className="h-3.5 w-3.5 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[11px] font-semibold text-white">
                            New Event
                          </div>
                          <div className="text-[10px] text-gray-500">
                            2m ago
                          </div>
                        </div>
                      </div>
                      <div className="text-xs leading-relaxed text-gray-300">
                        <span className="font-medium text-purple-300">
                          Friday Night Commander
                        </span>{' '}
                        scheduled for Feb 21 at 7 PM
                      </div>
                    </div>

                    {/* Notification 2 */}
                    <div className="mb-3 rounded-2xl border border-gray-800/50 bg-gray-900/50 p-4">
                      <div className="mb-2 flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800/80">
                          <Users className="h-3.5 w-3.5 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[11px] font-semibold text-white">
                            RSVP Update
                          </div>
                          <div className="text-[10px] text-gray-500">
                            15m ago
                          </div>
                        </div>
                      </div>
                      <div className="text-xs leading-relaxed text-gray-300">
                        3 of 4 players confirmed for{' '}
                        <span className="font-medium text-purple-300">
                          Friday Night Commander
                        </span>
                      </div>
                    </div>

                    {/* Notification 3 */}
                    <div className="rounded-2xl border border-gray-800/50 bg-gray-900/50 p-4">
                      <div className="mb-2 flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800/80">
                          <Clock className="h-3.5 w-3.5 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[11px] font-semibold text-white">
                            Starting Soon
                          </div>
                          <div className="text-[10px] text-gray-500">
                            1h ago
                          </div>
                        </div>
                      </div>
                      <div className="text-xs leading-relaxed text-gray-300">
                        Game night starts in 30 minutes — don&apos;t forget
                        your deck!
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Ambient glow */}
              <div className="absolute -inset-8 -z-10 rounded-full bg-purple-600/8 blur-3xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
