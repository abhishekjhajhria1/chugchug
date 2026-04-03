import { type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { Beer } from "lucide-react"
import { useChug } from "../context/ChugContext"

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { profile } = useChug()

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg-deep)' }}>
      {/* Ambient warm blobs */}
      <div className="bubbles-layer">
        <div className="bubble" style={{ width: 320, height: 320, top: '-5%', left: '-5%', '--dur': '26s', '--del': '0s', background: 'radial-gradient(circle at 40% 40%, rgba(245,166,35,0.07), transparent 65%)' } as React.CSSProperties} />
        <div className="bubble" style={{ width: 240, height: 240, bottom: '10%', right: '-5%', '--dur': '22s', '--del': '-8s', background: 'radial-gradient(circle at 60% 60%, rgba(76,175,125,0.06), transparent 65%)' } as React.CSSProperties} />
        <div className="bubble" style={{ width: 180, height: 180, top: '55%', left: '10%', '--dur': '30s', '--del': '-15s', background: 'radial-gradient(circle at 50% 50%, rgba(244,132,95,0.04), transparent 65%)' } as React.CSSProperties} />
      </div>

      {/* Top bar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: 56,
          background: 'rgba(14,11,8,0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 active:scale-95 transition-transform"
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #F5A623, #E8880A)',
              boxShadow: '0 2px 10px rgba(245,166,35,0.4)',
            }}
          >
            <Beer size={16} className="text-black" strokeWidth={2.5} />
          </div>
          <span
            className="font-black text-base tracking-tight"
            style={{ fontFamily: 'Nunito, sans-serif', color: 'var(--text-primary)' }}
          >
            ChugChug
          </span>
        </button>

        {/* XP chip */}
        {profile && (
          <div
            className="flex items-center gap-2 px-3 py-1 rounded-full"
            style={{
              background: 'rgba(245,166,35,0.1)',
              border: '1px solid rgba(245,166,35,0.2)',
            }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{ background: 'linear-gradient(135deg,#F5A623,#E8880A)', color: '#1A1208' }}>
              {profile.username?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-xs font-bold" style={{ color: 'var(--amber)', fontFamily: 'Nunito, sans-serif' }}>
              {profile.xp} XP
            </span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Lv.{profile.level}
            </span>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="relative z-10 max-w-lg mx-auto px-4 pt-[72px] pb-28">
        {children}
      </main>
    </div>
  )
}