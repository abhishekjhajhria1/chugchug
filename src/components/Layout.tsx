import { type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useChug } from "../context/ChugContext"
import { useTheme } from "../context/ThemeContext"
import { Moon, Sun } from "lucide-react"

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { profile } = useChug()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="relative min-h-dvh transition-colors duration-300" style={{ background: 'var(--bg-deep)' }}>
      {/* Subtle ambient blooms — Wano Sakura and Kozuki Gold */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute rounded-full" style={{ width: 250, height: 250, top: '-8%', left: '-5%', background: 'radial-gradient(circle, rgba(216,142,48,0.06), transparent 60%)' }} />
        <div className="absolute rounded-full" style={{ width: 200, height: 200, bottom: '5%', right: '-8%', background: 'radial-gradient(circle, rgba(216,60,60,0.04), transparent 60%)' }} />
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

          {/* XP chip */}
          {profile && (
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 px-3 py-1.5 active:scale-95 transition-transform"
              style={{
                background: 'var(--amber-dim)',
                border: '1px solid rgba(216,142,48,0.3)',
                borderRadius: '4px', // Slightly softer cut for Wano unified aesthetic
              }}
            >
              <div className="w-5 h-5 flex items-center justify-center text-[10px] font-black" style={{ background: 'var(--amber)', color: '#FFFFFF', borderRadius: '2px' }}>
                {profile.username?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline" style={{ color: 'var(--amber)' }}>
                Lv.{profile.level}
              </span>
              <span className="text-[10px] font-black tracking-wider" style={{ color: 'var(--text-primary)' }}>
                {profile.xp} XP
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="relative z-10 max-w-lg mx-auto px-4 pt-[68px] pb-28">
        {children}
      </main>
    </div>
  )
}