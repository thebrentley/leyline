'use client'

import {
  Layers,
  Users,
  Library,
  TrendingUp,
  ArrowUpDown,
  CalendarDays,
  FolderOpen,
  DollarSign,
  Share2,
  BarChart3,
  Import,
  Star,
} from 'lucide-react'

function SectionLabel({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-full bg-purple-900/40 p-2.5">
        <Icon className="h-5 w-5 text-purple-400" />
      </div>
      <span className="text-sm font-medium tracking-wider text-purple-400">
        {label}
      </span>
    </div>
  )
}

function FeatureTag({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-purple-800/40 bg-purple-900/20 px-4 py-1.5 text-xs font-medium tracking-wide text-purple-300">
      {label}
    </span>
  )
}

/* ─── Deck Management Visual ─── */
function DeckVisual() {
  const deckCards = [
    { name: 'Atraxa, Grand Unifier', type: 'Commander', colors: ['W', 'U', 'B', 'G'] },
    { name: 'Swords to Plowshares', type: 'Instant', colors: ['W'] },
    { name: 'Rhystic Study', type: 'Enchantment', colors: ['U'] },
    { name: 'Demonic Tutor', type: 'Sorcery', colors: ['B'] },
  ]

  const colorMap: Record<string, string> = {
    W: 'bg-amber-300',
    U: 'bg-blue-400',
    B: 'bg-violet-400',
    R: 'bg-red-400',
    G: 'bg-emerald-400',
  }

  return (
    <div className="relative flex justify-center lg:justify-end">
      <div className="w-full max-w-sm">
        {/* Deck panel */}
        <div className="rounded-2xl border border-purple-800/30 bg-gradient-to-br from-gray-900 via-gray-900 to-purple-950/20 p-5 shadow-2xl shadow-purple-900/10">
          {/* Deck header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">
                Atraxa Value Pile
              </div>
              <div className="mt-0.5 text-[10px] text-gray-500">
                Commander · 100 cards
              </div>
            </div>
            <div className="flex gap-1">
              {['W', 'U', 'B', 'G'].map((c) => (
                <div key={c} className={`h-3 w-3 rounded-full ${colorMap[c]} opacity-80`} />
              ))}
            </div>
          </div>

          {/* Score bar */}
          <div className="mb-4 grid grid-cols-4 gap-2 rounded-xl border border-gray-800/60 bg-gray-950/60 p-3">
            {[
              { label: 'Power', val: 82, color: 'text-purple-400' },
              { label: 'Salt', val: 65, color: 'text-red-400' },
              { label: 'Fear', val: 71, color: 'text-amber-400' },
              { label: 'Airtime', val: 88, color: 'text-emerald-400' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className={`text-lg font-light tabular-nums ${s.color}`}>
                  {s.val}
                </div>
                <div className="text-[9px] font-medium tracking-wider text-gray-500">
                  {s.label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>

          {/* Card list */}
          <div className="space-y-2">
            {deckCards.map((card) => (
              <div
                key={card.name}
                className="flex items-center gap-3 rounded-lg border border-gray-800/40 bg-gray-950/40 px-3 py-2"
              >
                <div className="flex gap-0.5">
                  {card.colors.map((c) => (
                    <div key={c} className={`h-2 w-2 rounded-full ${colorMap[c]} opacity-70`} />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs font-medium text-gray-200">
                    {card.name}
                  </div>
                  <div className="text-[10px] text-gray-500">{card.type}</div>
                </div>
                {card.type === 'Commander' && (
                  <Star className="h-3 w-3 flex-shrink-0 text-amber-400/60" />
                )}
              </div>
            ))}
          </div>

          {/* Action bar */}
          <div className="mt-4 flex gap-2">
            <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-700/40 bg-gray-800/30 py-2 text-[10px] font-medium text-gray-400">
              <Import className="h-3 w-3" />
              Archidekt Sync
            </div>
            <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-700/40 bg-gray-800/30 py-2 text-[10px] font-medium text-gray-400">
              <Share2 className="h-3 w-3" />
              Share
            </div>
            <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-700/40 bg-gray-800/30 py-2 text-[10px] font-medium text-gray-400">
              <ArrowUpDown className="h-3 w-3" />
              Export
            </div>
          </div>
        </div>

        {/* Ambient glow */}
        <div className="absolute -inset-8 -z-10 rounded-full bg-purple-600/[0.06] blur-3xl" />
      </div>
    </div>
  )
}

/* ─── Pod Management Visual ─── */
function PodVisual() {
  const members = [
    { name: 'Alex', role: 'Owner', wins: 12, color: 'from-purple-500 to-purple-700' },
    { name: 'Jamie', role: 'Admin', wins: 9, color: 'from-blue-500 to-blue-700' },
    { name: 'Sam', role: 'Member', wins: 7, color: 'from-emerald-500 to-emerald-700' },
    { name: 'Riley', role: 'Member', wins: 11, color: 'from-amber-500 to-amber-700' },
  ]

  return (
    <div className="relative flex justify-center lg:justify-start">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-purple-800/30 bg-gradient-to-br from-gray-900 via-gray-900 to-purple-950/20 p-5 shadow-2xl shadow-purple-900/10">
          {/* Pod header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">
                Friday Night Crew
              </div>
              <div className="mt-0.5 text-[10px] text-gray-500">
                4 members · 8 events
              </div>
            </div>
            <div className="rounded-full border border-purple-700/30 bg-purple-900/30 px-2.5 py-1 text-[10px] font-medium text-purple-300">
              xK7m2pQ1
            </div>
          </div>

          {/* Upcoming event */}
          <div className="mb-4 rounded-xl border border-purple-700/20 bg-purple-950/20 p-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-[10px] font-medium tracking-wider text-purple-400">
                NEXT EVENT
              </span>
            </div>
            <div className="mt-2 text-xs font-medium text-white">
              EDH Night — Round Robin
            </div>
            <div className="mt-1 text-[10px] text-gray-400">
              Fri, Feb 21 · 7:00 PM · Alex&apos;s Place
            </div>
            <div className="mt-2 flex gap-3">
              <span className="text-[10px] text-emerald-400">3 accepted</span>
              <span className="text-[10px] text-gray-500">1 pending</span>
            </div>
          </div>

          {/* Member win rates */}
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.name}
                className="flex items-center gap-3 rounded-lg border border-gray-800/40 bg-gray-950/40 px-3 py-2"
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${m.color} text-[10px] font-bold text-white`}
                >
                  {m.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-200">
                      {m.name}
                    </span>
                    <span className="text-[9px] text-gray-600">{m.role}</span>
                  </div>
                  {/* Win bar */}
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-gray-800">
                      <div
                        className="h-1 rounded-full bg-gradient-to-r from-purple-500 to-purple-400"
                        style={{ width: `${(m.wins / 12) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-gray-500">
                      {m.wins}W
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="mt-4 flex gap-2">
            <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-700/40 bg-gray-800/30 py-2 text-[10px] font-medium text-gray-400">
              <Users className="h-3 w-3" />
              Invite
            </div>
            <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-700/40 bg-gray-800/30 py-2 text-[10px] font-medium text-gray-400">
              <CalendarDays className="h-3 w-3" />
              New Event
            </div>
            <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-700/40 bg-gray-800/30 py-2 text-[10px] font-medium text-gray-400">
              <BarChart3 className="h-3 w-3" />
              Stats
            </div>
          </div>
        </div>

        {/* Ambient glow */}
        <div className="absolute -inset-8 -z-10 rounded-full bg-purple-600/[0.06] blur-3xl" />
      </div>
    </div>
  )
}

/* ─── Collection Visual ─── */
function CollectionVisual() {
  const cards = [
    { name: 'Sheoldred, the Apocalypse', set: 'DMU', price: 64.99, original: 42.5, foil: false },
    { name: 'The One Ring', set: 'LTR', price: 52.0, original: 68.0, foil: false },
    { name: 'Mana Crypt', set: '2XM', price: 145.0, original: 120.0, foil: true },
    { name: 'Dockside Extortionist', set: '2X2', price: 62.5, original: 48.0, foil: false },
  ]

  return (
    <div className="relative flex justify-center lg:justify-end">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-purple-800/30 bg-gradient-to-br from-gray-900 via-gray-900 to-purple-950/20 p-5 shadow-2xl shadow-purple-900/10">
          {/* Portfolio header */}
          <div className="mb-4 rounded-xl border border-purple-700/20 bg-gradient-to-r from-purple-950/40 to-gray-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-medium tracking-wider text-gray-500">
                  TOTAL VALUE
                </div>
                <div className="mt-1 text-2xl font-light tabular-nums text-white">
                  $4,287<span className="text-base text-gray-400">.50</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-medium tracking-wider text-gray-500">
                  GAIN / LOSS
                </div>
                <div className="mt-1 flex items-center gap-1 text-lg font-light tabular-nums text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                  +$623
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-4">
              <div>
                <div className="text-[9px] text-gray-500">482 cards</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500">3 folders</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500">Cost $3,664.50</div>
              </div>
            </div>
          </div>

          {/* Folder tabs */}
          <div className="mb-3 flex gap-1.5">
            {[
              { name: 'All', active: true },
              { name: 'EDH Staples', active: false },
              { name: 'Trade Binder', active: false },
            ].map((f) => (
              <div
                key={f.name}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-medium ${
                  f.active
                    ? 'border border-purple-700/40 bg-purple-900/30 text-purple-300'
                    : 'text-gray-500'
                }`}
              >
                {f.name}
              </div>
            ))}
          </div>

          {/* Card list */}
          <div className="space-y-2">
            {cards.map((card) => {
              const gain = card.price - card.original
              const isUp = gain >= 0
              return (
                <div
                  key={card.name}
                  className="flex items-center gap-3 rounded-lg border border-gray-800/40 bg-gray-950/40 px-3 py-2"
                >
                  {/* Mini card art placeholder */}
                  <div className="h-9 w-6 flex-shrink-0 rounded bg-gradient-to-br from-gray-700/40 to-gray-800/40 border border-gray-700/30" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-gray-200">
                        {card.name}
                      </span>
                      {card.foil && (
                        <span className="rounded bg-amber-900/30 px-1 text-[8px] font-bold text-amber-400">
                          FOIL
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-500">{card.set}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs tabular-nums text-purple-300">
                      ${card.price.toFixed(2)}
                    </div>
                    <div
                      className={`text-[10px] tabular-nums ${isUp ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {isUp ? '+' : ''}${gain.toFixed(2)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Action bar */}
          <div className="mt-4 flex gap-2">
            <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-700/40 bg-gray-800/30 py-2 text-[10px] font-medium text-gray-400">
              <FolderOpen className="h-3 w-3" />
              Folders
            </div>
            <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-700/40 bg-gray-800/30 py-2 text-[10px] font-medium text-gray-400">
              <Import className="h-3 w-3" />
              Import
            </div>
            <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-700/40 bg-gray-800/30 py-2 text-[10px] font-medium text-gray-400">
              <DollarSign className="h-3 w-3" />
              Prices
            </div>
          </div>
        </div>

        {/* Ambient glow */}
        <div className="absolute -inset-8 -z-10 rounded-full bg-purple-600/[0.06] blur-3xl" />
      </div>
    </div>
  )
}

/* ─── Main Features Section ─── */
export default function Features() {
  return (
    <section className="relative overflow-hidden bg-gray-950">
      {/* Top divider */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-600/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        {/* Section Header */}
        <div className="mb-16 text-center md:mb-24">
          <div className="mb-4 text-sm font-medium tracking-[0.3em] text-purple-400">
            EVERYTHING YOU NEED
          </div>
          <h2 className="text-3xl font-light tracking-tight text-white md:text-5xl">
            One platform,{' '}
            <span className="bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent">
              every edge
            </span>
          </h2>
        </div>

        {/* ── Feature 1: Decks ── */}
        <div className="mb-24 grid items-center gap-12 md:mb-32 lg:grid-cols-2 lg:gap-20">
          <div className="space-y-6">
            <SectionLabel icon={Layers} label="DECK MANAGEMENT" />
            <h3 className="text-2xl font-light tracking-tight text-white md:text-4xl">
              Build. Score. Dominate.
              <br />
              <span className="text-gray-400">Your decks, perfected.</span>
            </h3>
            <p className="max-w-md text-base leading-relaxed text-gray-400 md:text-lg">
              Import from Archidekt in one tap, track every version, and see
              exactly how your build stacks up with AI-powered scoring across
              Power, Salt, Fear, and Airtime.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {[
                'Archidekt Sync',
                'Version History',
                'Deck Scores',
                'Export',
              ].map((tag) => (
                <FeatureTag key={tag} label={tag} />
              ))}
            </div>
          </div>
          <DeckVisual />
        </div>

        {/* ── Feature 2: Pods ── */}
        <div className="mb-24 grid items-center gap-12 md:mb-32 lg:grid-cols-2 lg:gap-20">
          <div className="order-2 lg:order-1">
            <PodVisual />
          </div>
          <div className="order-1 space-y-6 lg:order-2">
            <SectionLabel icon={Users} label="POD MANAGEMENT" />
            <h3 className="text-2xl font-light tracking-tight text-white md:text-4xl">
              Your playgroup, organized.
              <br />
              <span className="text-gray-400">From invite to game night.</span>
            </h3>
            <p className="max-w-md text-base leading-relaxed text-gray-400 md:text-lg">
              Create pods for your local group, schedule events, RSVP, and
              record game results. Track who&apos;s on top with built-in win
              rate stats — even for friends without an account.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {[
                'Invite Codes',
                'Events & RSVPs',
                'Game Results',
                'Win Stats',
              ].map((tag) => (
                <FeatureTag key={tag} label={tag} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Feature 3: Collection ── */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="space-y-6">
            <SectionLabel icon={Library} label="COLLECTION & VALUE" />
            <h3 className="text-2xl font-light tracking-tight text-white md:text-4xl">
              Know what you own.
              <br />
              <span className="text-gray-400">Know what it&apos;s worth.</span>
            </h3>
            <p className="max-w-md text-base leading-relaxed text-gray-400 md:text-lg">
              Track every card in your collection with real-time market
              prices. Organize into folders, link cards to decks, and see
              your portfolio&apos;s gain or loss at a glance. Bulk import to
              get started fast.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {[
                'Price Tracking',
                'Gain / Loss',
                'Folders',
                'Bulk Import',
              ].map((tag) => (
                <FeatureTag key={tag} label={tag} />
              ))}
            </div>
          </div>
          <CollectionVisual />
        </div>
      </div>
    </section>
  )
}
