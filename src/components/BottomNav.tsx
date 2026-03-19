import { useState } from "react"
import { Home, Users, Globe, User, Plus, Trophy, PartyPopper, X } from "lucide-react"
import { NavLink, useNavigate } from "react-router-dom"

const NAV_ITEMS = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/groups", icon: Users, label: "Groups" },
  null, // fab placeholder
  { to: "/world", icon: Globe, label: "World" },
  { to: "/profile", icon: User, label: "Profile" },
] as const

const MENU_ACTIONS = [
  { to: "/log", icon: Plus, label: "Log Activity", accent: "var(--accent-mint)" },
  { to: "/rank", icon: Trophy, label: "Leaderboard", accent: "var(--accent-gold)" },
  { to: "/party", icon: PartyPopper, label: "Party Hub", accent: "var(--accent-rose)" },
]

export default function BottomNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      {/* Backdrop overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* FAB Menu */}
      {menuOpen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3"
          style={{ animation: 'slideUp 0.3s cubic-bezier(0.22,0.68,0,1.1) both' }}
        >
          {MENU_ACTIONS.map((action, i) => (
            <button
              key={action.to}
              onClick={() => { navigate(action.to); setMenuOpen(false) }}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl font-semibold text-sm"
              style={{
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderTopColor: 'rgba(255,255,255,0.20)',
                color: 'var(--text-bright)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
                animation: `slideUp 0.3s ease both`,
                animationDelay: `${i * 0.06}s`,
                minWidth: 180,
              }}
            >
              <action.icon size={18} strokeWidth={2} style={{ color: action.accent }} />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: 'rgba(8,6,18,0.75)',
          backdropFilter: 'blur(24px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-around py-2 relative">
          {NAV_ITEMS.map((item) => {
            if (item === null) {
              // FAB
              return (
                <button
                  key="fab"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label={menuOpen ? "Close quick actions menu" : "Open quick actions menu"}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="relative -mt-6 transition-all duration-300"
                  style={{
                    width: 52, height: 52,
                    borderRadius: '50%',
                    background: menuOpen
                      ? 'rgba(255,255,255,0.12)'
                      : 'linear-gradient(135deg, rgba(167,139,250,0.55), rgba(93,228,255,0.40))',
                    border: '1px solid rgba(255,255,255,0.18)',
                    boxShadow: menuOpen
                      ? '0 2px 12px rgba(0,0,0,0.30)'
                      : '0 4px 20px rgba(167,139,250,0.25), 0 0 0 4px rgba(167,139,250,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-bright)',
                    transform: menuOpen ? 'rotate(45deg)' : 'none',
                    transition: 'transform 0.3s ease, background 0.3s ease, box-shadow 0.3s ease',
                  }}
                >
                  {menuOpen ? <X size={22} strokeWidth={2} /> : <Plus size={22} strokeWidth={2.5} />}
                </button>
              )
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className="flex flex-col items-center px-3 py-1 transition-all duration-200"
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      size={22}
                      strokeWidth={isActive ? 2.2 : 1.6}
                      style={{
                        color: isActive ? 'var(--accent-aqua)' : 'var(--text-ghost)',
                        filter: isActive ? 'drop-shadow(0 0 6px rgba(93,228,255,0.35))' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    />
                    <span
                      className="text-[10px] font-semibold mt-0.5"
                      style={{
                        color: isActive ? 'var(--accent-aqua)' : 'var(--text-ghost)',
                        transition: 'color 0.2s ease',
                      }}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <div
                        className="w-1 h-1 rounded-full mt-0.5"
                        style={{
                          background: 'var(--accent-aqua)',
                          boxShadow: '0 0 6px var(--accent-aqua)',
                        }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </>
  )
}