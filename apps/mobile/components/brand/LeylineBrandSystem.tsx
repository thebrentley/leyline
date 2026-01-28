import { useState } from 'react';

export default function LeylineBrandSystem() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = ['Primary Logo', 'Marketing', 'In-App'];

  const GlowingLogo = ({ size = 'large', showTagline = true, tagline = 'EVERYTHING. CONNECTED.' }) => {
    const scale = size === 'large' ? 1 : size === 'medium' ? 0.7 : 0.5;
    return (
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 300 80" style={{ width: 280 * scale }} className="mb-2">
          <defs>
            <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="50%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#C4B5FD" />
            </linearGradient>
            <filter id="glowFx">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <path
            d="M30 60 L30 25 Q30 15 40 15 L55 15"
            stroke="url(#glowGrad)"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            filter="url(#glowFx)"
          />
          <text x="68" y="52" fontFamily="system-ui" fontSize="38" fontWeight="300" fill="white" letterSpacing="3">
            LEYLINE
          </text>
        </svg>
        {showTagline && (
          <p className="text-purple-300 text-xs tracking-widest" style={{ fontSize: 11 * scale }}>{tagline}</p>
        )}
      </div>
    );
  };

  const AppIcon = ({ size = 64 }) => (
    <div
      className="bg-gradient-to-br from-purple-900 to-gray-900 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-900/30"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 50 50" style={{ width: size * 0.6, height: size * 0.6 }}>
        <defs>
          <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#C4B5FD" />
          </linearGradient>
          <filter id="iconGlow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path
          d="M15 38 L15 15 Q15 10 22 10 L35 10"
          stroke="url(#iconGrad)"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          filter="url(#iconGlow)"
        />
      </svg>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto">

        {/* Tab Navigation */}
        <div className="flex justify-center gap-2 mb-10">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                activeTab === i
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Primary Logo Tab */}
        {activeTab === 0 && (
          <div className="space-y-10">
            {/* Main Logo */}
            <div className="flex flex-col items-center py-8">
              <GlowingLogo />
            </div>

            {/* Logo Variations */}
            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-800">
              <div className="flex flex-col items-center">
                <p className="text-gray-500 text-xs mb-4">APP ICON</p>
                <AppIcon size={72} />
              </div>
              <div className="flex flex-col items-center">
                <p className="text-gray-500 text-xs mb-4">FAVICON</p>
                <AppIcon size={32} />
              </div>
            </div>

            {/* Horizontal Lockup */}
            <div className="pt-6 border-t border-gray-800">
              <p className="text-gray-500 text-xs mb-4 text-center">HORIZONTAL LOCKUP</p>
              <div className="bg-gray-900 rounded-xl p-6 flex items-center justify-center gap-4">
                <AppIcon size={48} />
                <div>
                  <div className="text-xl font-light tracking-wider">LEYLINE</div>
                  <div className="text-purple-400 text-xs tracking-widest">EVERYTHING. CONNECTED.</div>
                </div>
              </div>
            </div>

            {/* Dark/Light */}
            <div className="pt-6 border-t border-gray-800">
              <p className="text-gray-500 text-xs mb-4 text-center">ON DARK / ON LIGHT</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 rounded-xl p-6 flex justify-center">
                  <GlowingLogo size="small" showTagline={false} />
                </div>
                <div className="bg-gray-100 rounded-xl p-6 flex flex-col items-center justify-center">
                  <svg viewBox="0 0 300 80" className="w-36">
                    <path
                      d="M30 60 L30 25 Q30 15 40 15 L55 15"
                      stroke="#7C3AED"
                      strokeWidth="5"
                      fill="none"
                      strokeLinecap="round"
                    />
                    <text x="68" y="52" fontFamily="system-ui" fontSize="38" fontWeight="300" fill="#1f2937" letterSpacing="3">
                      LEYLINE
                    </text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Marketing Tab */}
        {activeTab === 1 && (
          <div className="space-y-8">
            {/* Social Ad - "Begin with an edge" */}
            <div>
              <p className="text-gray-500 text-xs mb-3">SOCIAL AD / CAMPAIGN</p>
              <div className="bg-gradient-to-br from-gray-900 via-purple-950 to-gray-900 rounded-xl p-8 border border-purple-800/30">
                <div className="flex items-center gap-3 mb-6">
                  <AppIcon size={40} />
                  <span className="text-lg font-light tracking-wider">LEYLINE</span>
                </div>
                <h2 className="text-3xl font-light mb-2">Begin with an edge.</h2>
                <p className="text-gray-400 mb-6">AI-powered deck building. Smarter playtesting. Know your meta before game night.</p>
                <div className="inline-block bg-purple-600 hover:bg-purple-500 px-5 py-2 rounded-lg text-sm font-medium">
                  Get Started Free
                </div>
              </div>
            </div>

            {/* App Store */}
            <div>
              <p className="text-gray-500 text-xs mb-3">APP STORE BANNER</p>
              <div className="bg-gradient-to-r from-purple-900 to-gray-900 rounded-xl p-6 flex items-center gap-6">
                <AppIcon size={80} />
                <div>
                  <div className="text-2xl font-light tracking-wide mb-1">Leyline</div>
                  <div className="text-purple-300 text-sm mb-2">Everything. Connected.</div>
                  <div className="text-gray-400 text-xs">Collection • Decks • Pod • Deals</div>
                </div>
              </div>
            </div>

            {/* Feature Announcement */}
            <div>
              <p className="text-gray-500 text-xs mb-3">FEATURE ANNOUNCEMENT</p>
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <div className="flex items-center gap-2 text-purple-400 text-xs mb-3">
                  <span className="inline-block w-2 h-2 bg-purple-500 rounded-full"></span>
                  NEW FEATURE
                </div>
                <h3 className="text-xl font-light mb-2">Pod Analytics is here</h3>
                <p className="text-gray-400 text-sm mb-4">See win rates, matchup data, and deck performance across your playgroup.</p>
                <div className="text-purple-400 text-sm font-medium">Tap into more →</div>
              </div>
            </div>

            {/* Twitter/X Post */}
            <div>
              <p className="text-gray-500 text-xs mb-3">SOCIAL POST</p>
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="flex items-center gap-3 mb-3">
                  <AppIcon size={36} />
                  <div>
                    <div className="font-medium text-sm">Leyline</div>
                    <div className="text-gray-500 text-xs">@mtgleyline</div>
                  </div>
                </div>
                <p className="text-sm leading-relaxed">Your deck has 47 cards over $5 that dropped in price this month. 📉<br/><br/>We added them to your watchlist.<br/><br/>Tap into more.</p>
              </div>
            </div>
          </div>
        )}

        {/* In-App Tab */}
        {activeTab === 2 && (
          <div className="space-y-8">
            {/* Splash Screen */}
            <div>
              <p className="text-gray-500 text-xs mb-3">SPLASH / LOADING</p>
              <div className="bg-gray-900 rounded-xl p-12 flex flex-col items-center justify-center border border-gray-800">
                <AppIcon size={64} />
                <div className="mt-4 text-xl font-light tracking-widest">LEYLINE</div>
                <div className="mt-6 w-32 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className="w-1/2 h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Empty State */}
            <div>
              <p className="text-gray-500 text-xs mb-3">EMPTY STATE</p>
              <div className="bg-gray-900 rounded-xl p-8 flex flex-col items-center text-center border border-gray-800">
                <div className="w-16 h-16 rounded-full bg-purple-900/30 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-light mb-2">No decks yet</h3>
                <p className="text-gray-500 text-sm mb-4">Build your first deck to begin tracking, testing, and improving.</p>
                <div className="text-purple-400 text-sm">Begin with an edge →</div>
              </div>
            </div>

            {/* Upgrade Prompt */}
            <div>
              <p className="text-gray-500 text-xs mb-3">UPGRADE PROMPT</p>
              <div className="bg-gradient-to-r from-purple-900/50 to-gray-900 rounded-xl p-5 border border-purple-700/30">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Unlock AI Playtesting</h4>
                    <p className="text-gray-400 text-sm mb-3">Run simulations, analyze matchups, and get tuning suggestions.</p>
                    <div className="text-purple-400 text-sm font-medium">Tap into more →</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nav Bar */}
            <div>
              <p className="text-gray-500 text-xs mb-3">MOBILE NAV</p>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className="flex justify-around">
                  {['Collection', 'Decks', 'Pod', 'Deals'].map((item, i) => (
                    <div key={item} className={`flex flex-col items-center gap-1 ${i === 1 ? 'text-purple-400' : 'text-gray-500'}`}>
                      <div className={`w-6 h-6 rounded ${i === 1 ? 'bg-purple-600/20' : ''}`}></div>
                      <span className="text-xs">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
