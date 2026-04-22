import { type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { Moon, Sun } from "lucide-react"

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="relative min-h-dvh transition-colors duration-300" style={{ background: 'var(--bg-deep)' }}>
      {/* Subtle ambient blooms — Wano Sakura and Kozuki Gold */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute rounded-full" style={{ width: 250, height: 250, top: '-8%', left: '-5%', background: 'radial-gradient(circle, rgba(216,142,48,0.06), transparent 60%)' }} />
        <div className="absolute rounded-full" style={{ width: 200, height: 200, bottom: '5%', right: '-8%', background: 'radial-gradient(circle, rgba(216,60,60,0.04), transparent 60%)' }} />
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

      {/* Top header bar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 transition-colors duration-300"
        style={{
          height: 60,
          background: 'var(--bg-overlay)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
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
            title="Toggle Wano Theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="relative z-10 max-w-lg mx-auto px-4 pt-[68px] pb-28">
        {children}
      </main>
    </div>
  )
}