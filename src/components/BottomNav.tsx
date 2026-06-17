import { useNavigate, useLocation } from "react-router-dom"
import { Home, Users, Globe, User } from "lucide-react"

const tabs = [
  { path: "/",        icon: Home,  label: "Home" },
  { path: "/groups",  icon: Users, label: "Crew" },
  { path: "/world",   icon: Globe, label: "Explore" },
  { path: "/profile", icon: User,  label: "Me" },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav
      className="desktop-bottom-nav fixed bottom-0 left-0 right-0 z-50 safe-bottom"
      style={{
        background: 'var(--bg-overlay)',
        backdropFilter: 'blur(24px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
      }}
    >
      <div className="flex items-stretch justify-around px-3 pt-2 pb-1">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = path === "/" ? pathname === "/" : pathname.startsWith(path)
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center gap-1 py-1.5 active:scale-90 transition-transform"
              aria-label={label}
              style={{ minWidth: 60 }}
            >
              <span
                className="flex items-center justify-center transition-all"
                style={{
                  width: 44, height: 30, borderRadius: 999,
                  background: isActive ? 'var(--amber-dim)' : 'transparent',
                }}
              >
                <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} style={{ color: isActive ? 'var(--amber)' : 'var(--text-muted)' }} />
              </span>
              <span
                className="text-[10px] font-bold"
                style={{ color: isActive ? 'var(--amber)' : 'var(--text-muted)' }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
