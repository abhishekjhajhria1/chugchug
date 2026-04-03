import { Home, Users, Plus, Globe, User } from "lucide-react"
import { NavLink, useNavigate, useLocation } from "react-router-dom"

const NAV_ITEMS = [
  { to: "/",       icon: Home,  label: "Home"      },
  { to: "/groups", icon: Users, label: "Community" },
  null, // FAB slot
  { to: "/world",  icon: Globe, label: "World"     },
  { to: "/profile",icon: User,  label: "Me"        },
] as const

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)

  return (
    <>
      <style>{`
        @keyframes navIn {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <nav
        className="fixed z-[95]"
        style={{
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(94vw, 420px)",
          animation: "navIn 0.4s cubic-bezier(0.34,1.4,0.64,1) both",
        }}
      >
        <div
          style={{
            background: "rgba(20,16,10,0.88)",
            backdropFilter: "blur(32px) saturate(1.6)",
            WebkitBackdropFilter: "blur(32px) saturate(1.6)",
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.08)",
            borderTopColor: "rgba(255,255,255,0.12)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
            padding: "4px 6px",
          }}
        >
          <div className="flex items-center justify-around" style={{ height: 58 }}>
            {NAV_ITEMS.map((item, idx) => {
              if (item === null) {
                return (
                  <button
                    key="fab-log"
                    onClick={() => navigate("/log")}
                    aria-label="Log activity"
                    className="active:scale-90 transition-transform"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      background: "linear-gradient(135deg, #F5A623, #E8880A)",
                      boxShadow: "0 4px 16px rgba(245,166,35,0.45)",
                      border: "1px solid rgba(255,200,80,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#1A1208",
                    }}
                  >
                    <Plus size={22} strokeWidth={2.5} />
                  </button>
                )
              }

              const active = isActive(item.to)
              const Icon = item.icon

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className="flex flex-col items-center justify-center relative"
                  style={{ width: 60, height: 54, borderRadius: 16, transition: "all 0.2s ease" }}
                >
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.2 : 1.6}
                    style={{
                      color: active ? "var(--amber)" : "rgba(255,255,255,0.3)",
                      transition: "all 0.2s ease",
                      transform: active ? "scale(1.05)" : "scale(1)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: active ? 800 : 500,
                      fontFamily: "Nunito, sans-serif",
                      marginTop: 2,
                      color: active ? "var(--amber)" : "rgba(255,255,255,0.25)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {item.label}
                  </span>
                  {/* Active dot indicator */}
                  {active && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 2,
                        width: 4, height: 4,
                        borderRadius: "50%",
                        background: "var(--amber)",
                        boxShadow: "0 0 6px rgba(245,166,35,0.8)",
                      }}
                    />
                  )}
                </NavLink>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}