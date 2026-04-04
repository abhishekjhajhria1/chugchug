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
      className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
      style={{
        background: 'rgba(11, 17, 31, 0.95)', // Deep Wano Navy
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderTop: '2px solid var(--coral)', // Katana Edge - Torii Red
        boxShadow: '0 -4px 30px rgba(209, 32, 32, 0.1)',
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
                className="flex flex-col items-center -mt-5 active:scale-90 transition-transform"
                aria-label={label}
              >
                <div
                  className="w-16 h-16 flex items-center justify-center shadow-lg relative group active:scale-95 transition-transform"
                  style={{
                    background: 'linear-gradient(135deg, var(--amber), #8C5C21)',
                    border: '2px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 0 20px rgba(216, 162, 94, 0.6), inset 0 0 10px rgba(0,0,0,0.5)',
                    borderRadius: '4px', // Samurai Crest style
                    transform: 'rotate(45deg) translateY(-10px)'
                  }}
                >
                  <Plus size={28} color="#111A2C" strokeWidth={3.5} style={{ transform: 'rotate(-45deg)' }} className="group-active:scale-110 transition-transform" />
                </div>
                <span className="text-[10px] uppercase font-black tracking-widest mt-2" style={{ color: 'var(--text-muted)' }}>Log</span>
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
                background: (isActive || isHome) ? 'linear-gradient(180deg, var(--coral-dim), transparent)' : 'transparent',
                borderTop: (isActive || isHome) ? '2px solid var(--coral)' : '2px solid transparent',
                borderRadius: '0 0 4px 4px', // Hanging scroll style
              }}
            >
              <Icon
                size={22}
                strokeWidth={isActive || isHome ? 2.5 : 1.8}
                style={{ 
                  color: isActive || isHome ? 'var(--text-primary)' : 'var(--text-muted)',
                  filter: isActive || isHome ? 'drop-shadow(0 0 8px rgba(209, 32, 32, 0.5))' : 'none',
                }}
              />
              <span
                className="text-[9px] uppercase font-black tracking-widest mt-1.5"
                style={{
                  color: isActive || isHome ? 'var(--coral-light)' : 'var(--text-muted)',
                  letterSpacing: '0.1em'
                }}
              >
                {label}
              </span>
              {(isActive || isHome) && (
                <div
                  className="w-1 h-1 mt-1 rounded-full"
                  style={{ background: 'var(--coral)', boxShadow: '0 0 5px var(--coral)' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}