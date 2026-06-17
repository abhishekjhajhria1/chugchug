import { type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import BottomNav from "./BottomNav"
import { Palette } from "lucide-react"



export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { toggleTheme } = useTheme()

  return (
    <div className="desktop-outer">
      {/* Floating orbs — visible on desktop only, hidden on mobile via CSS */}
      <div className="desktop-orbs">
        <div className="desktop-orb" />
        <div className="desktop-orb" />
        <div className="desktop-orb" />
        <div className="desktop-orb" />
      </div>


      <div className="desktop-shell relative min-h-dvh transition-colors duration-300" style={{ background: 'var(--bg-deep)' }}>
        {/* Subtle ambient blooms — Wano Sakura and Kozuki Gold */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute rounded-full" style={{ width: 250, height: 250, top: '-8%', left: '-5%', background: 'radial-gradient(circle, var(--amber-dim), transparent 60%)' }} />
          <div className="absolute rounded-full" style={{ width: 200, height: 200, bottom: '5%', right: '-8%', background: 'radial-gradient(circle, var(--coral-dim), transparent 60%)' }} />
        </div>

        {/* Sakura petals — hidden in verdant mode via CSS */}
        <div className="sakura-layer">
          {[
            { left: '8%',  dur: '18s', del: '0s',   size: 8  },
            { left: '25%', dur: '22s', del: '3s',   size: 10 },
            { left: '42%', dur: '16s', del: '7s',   size: 7  },
            { left: '58%', dur: '25s', del: '2s',   size: 9  },
            { left: '72%', dur: '19s', del: '10s',  size: 11 },
            { left: '88%', dur: '21s', del: '5s',   size: 8  },
            { left: '15%', dur: '24s', del: '12s',  size: 6  },
            { left: '65%', dur: '17s', del: '8s',   size: 10 },
          ].map((p, i) => (
            <div
              key={i}
              className="sakura-petal"
              style={{
                '--left': p.left,
                '--dur': p.dur,
                '--del': p.del,
                width: p.size,
                height: p.size,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Top header bar — scoped to the shell on desktop */}
        <header
          className="desktop-header fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 safe-top transition-colors duration-300"
          style={{
            height: 'var(--header-height, 60px)',
            background: 'var(--bg-overlay)',
            backdropFilter: 'blur(20px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 active:scale-95 transition-transform"
          >
            <span className="text-2xl drop-shadow-sm">⛩️</span>
            <span
              className="font-extrabold text-lg tracking-tight uppercase"
              style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', letterSpacing: '0.05em' }}
            >
              ChugChug
            </span>
          </button>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center active:scale-90 transition-all rounded-full border"
              style={{
                background: 'var(--glass-fill-inset)',
                borderColor: 'var(--border-mid)',
                color: 'var(--text-primary)',
              }}
              title="Switch theme"
            >
              <Palette size={16} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="relative z-10 px-4 pb-28" style={{ paddingTop: 'calc(var(--header-height, 60px) + 8px)' }}>
          {children}
        </main>

        {/* Bottom navigation — direct child of shell for sticky positioning */}
        <BottomNav />
      </div>
    </div>
  )
}