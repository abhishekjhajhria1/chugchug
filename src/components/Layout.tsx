import { type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import BottomNav from "./BottomNav"
import { Ticket } from "lucide-react"

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

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
          className="desktop-header fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 safe-top"
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

          {/* Offers / Deals — promo + monetization entry point */}
          <button
            onClick={() => navigate("/offers")}
            className="relative flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-full active:scale-95 transition-all"
            style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid color-mix(in srgb, var(--amber) 22%, transparent)' }}
            aria-label="Offers and deals"
          >
            <Ticket size={15} />
            <span className="text-xs font-extrabold">Deals</span>
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full animate-ping opacity-60" style={{ background: 'var(--coral)' }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: 'var(--coral)' }} />
            </span>
          </button>
        </header>

        {/* Page content */}
        <main className="relative z-10 px-5 pb-28" style={{ paddingTop: 'calc(var(--header-height, 60px) + 12px)' }}>
          {children}
        </main>

        <BottomNav />
      </div>
    </div>
  )
}
