import type { ReactNode } from "react"
import BottomNav from "./BottomNav"

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen" style={{ background: 'var(--scene-bg)' }}>
      {/* Background orbs — large, soft, limited */}
      <div className="bubbles-layer">
        <div className="bubble" style={{ width: 280, height: 280, top: '5%', left: '8%',  '--dur': '24s', '--del': '0s' } as React.CSSProperties} />
        <div className="bubble" style={{ width: 200, height: 200, top: '55%', right: '5%', '--dur': '20s', '--del': '-7s' } as React.CSSProperties} />
        <div className="bubble" style={{ width: 160, height: 160, top: '80%', left: '25%', '--dur': '22s', '--del': '-12s' } as React.CSSProperties} />
        <div className="bubble" style={{ width: 120, height: 120, top: '30%', right: '15%', '--dur': '26s', '--del': '-4s' } as React.CSSProperties} />
      </div>

      {/* Page content */}
      <main className="relative z-10 max-w-lg mx-auto px-5 pt-6 pb-24">
        {children}
      </main>

      <BottomNav />
    </div>
  )
}