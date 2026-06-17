import { type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import BottomNav from "./BottomNav"
import { Sun, Moon } from "lucide-react"

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="desktop-outer">
      {/* Ambient orbs — desktop only (hidden on mobile via CSS) */}
      <div className="desktop-orbs">
        <div className="desktop-orb" />
        <div className="desktop-orb" />
        <div className="desktop-orb" />
        <div className="desktop-orb" />
      </div>

      <div className="desktop-shell relative min-h-dvh" style={{ background: 'var(--bg-deep)' }}>
        {/* Header */}
        <header
          className="desktop-header fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 safe-top"
          style={{
            height: 'var(--header-height, 60px)',
            background: 'var(--bg-overlay)',
            backdropFilter: 'blur(20px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <button onClick={() => navigate("/")} className="flex items-center gap-2 active:scale-95 transition-transform">
            <span className="text-2xl">🍻</span>
            <span className="font-extrabold text-lg tracking-tight" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
              ChugChug
            </span>
          </button>

          <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center active:scale-90 transition-all rounded-full"
            style={{ background: 'var(--glass-fill-inset)', color: 'var(--text-secondary)' }}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </header>

        {/* Page content */}
        <main className="relative z-10 px-4 pb-28" style={{ paddingTop: 'calc(var(--header-height, 60px) + 10px)' }}>
          {children}
        </main>

        <BottomNav />
      </div>
    </div>
  )
}
