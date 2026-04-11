import { useNavigate, useLocation } from "react-router-dom"
import { Home, Users, Globe, User, Plus } from "lucide-react"

const tabs = [
  { path: "/",       icon: Home,   label: "Home" },
  { path: "/groups", icon: Users,  label: "Crew" },
  { path: "/log",    icon: Plus,   label: "Log",  isFab: true },
  { path: "/world",  icon: Globe,  label: "Explore" },
  { path: "/profile",icon: User,   label: "Me" },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-bottom pb-2"
      style={{
        background: 'var(--bg-overlay, rgba(11, 17, 31, 0.95))',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderTop: '1px solid var(--border-mid)',
        boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.15)',
      }}
    >
      <div className="max-w-lg mx-auto flex items-end justify-around px-2 pt-1 pb-2">
        {tabs.map(({ path, icon: Icon, label, isFab }) => {
          const isActive = pathname === path || (path !== "/" && pathname.startsWith(path))
          const isHome = path === "/" && pathname === "/"

          if (isFab) {
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="relative flex flex-col items-center justify-center -mt-8 active:scale-95 transition-transform"
                aria-label={label}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                  style={{
                    background: 'linear-gradient(180deg, var(--amber), var(--amber-light, #8C5C21))',
                    border: '4px solid var(--bg-deep)',
                    boxShadow: 'var(--amber-glow)',
                    borderRadius: '50%',
                  }}
                >
                  <Plus size={28} style={{ color: 'var(--bg-deep)' }} strokeWidth={3} />
                </div>
              </button>
            )
          }

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center py-2 px-3 transition-all active:scale-90 ${isActive || isHome ? 'anim-pop' : ''}`}
              aria-label={label}
              style={{
                minWidth: 58,
                background: (isActive || isHome) ? 'var(--amber-dim)' : 'transparent',
                borderTop: (isActive || isHome) ? '2px solid var(--amber)' : '2px solid transparent',
                borderBottom: '2px solid transparent',
                borderRadius: '0 0 var(--card-radius) var(--card-radius)',
              }}
            >
              <Icon
                size={22}
                strokeWidth={isActive || isHome ? 2.5 : 1.8}
                style={{ 
                  color: isActive || isHome ? 'var(--amber)' : 'var(--text-muted)',
                  filter: isActive || isHome ? 'drop-shadow(0 0 6px var(--amber))' : 'none',
                  transition: 'all 0.2s ease',
                }}
              />
              <span
                className="text-[9px] uppercase font-black tracking-widest mt-1.5"
                style={{
                  color: isActive || isHome ? 'var(--amber)' : 'var(--text-muted)',
                  letterSpacing: '0.1em',
                  transition: 'color 0.2s ease',
                }}
              >
                {label}
              </span>
              {(isActive || isHome) && (
                <div
                  className="w-1 h-1 mt-1 rounded-full"
                  style={{ background: 'var(--amber)', boxShadow: '0 0 5px var(--amber)' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}