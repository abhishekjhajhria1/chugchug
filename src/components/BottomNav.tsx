import { useState, useRef, useEffect } from "react"
import { NavLink, Link, useLocation } from "react-router-dom"
import { Home, Plus, PartyPopper, Users, Menu, Globe, User, X } from "lucide-react"

export default function BottomNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  const baseNavItem = "flex flex-col items-center text-[10px] font-black uppercase tracking-wider text-[#3D2C24] transition-transform hover:scale-110 active:scale-95 gap-1 opacity-70 hover:opacity-100"

  return (
    <>
      {/* Dimmed Background Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/20 z-[40] slide-in-from-bottom animate-in fade-in duration-200" />
      )}

      <div className="fixed bottom-0 w-full bg-white border-t-[3px] border-[#3D2C24] rounded-t-3xl flex justify-around py-3 z-50 shadow-[0px_-4px_0px_rgba(0,0,0,0.05)]">

        <NavLink to="/" className={({ isActive }) => `${baseNavItem} ${isActive ? 'text-[#FF7B9C] opacity-100' : ''}`}>
          <Home size={24} strokeWidth={2.5} />
          <span className="mt-1">Home</span>
        </NavLink>

        <NavLink to="/groups" className={({ isActive }) => `${baseNavItem} ${isActive ? 'text-[#FF7B9C] opacity-100' : ''}`}>
          <Users size={24} strokeWidth={2.5} />
          <span className="mt-1">Groups</span>
        </NavLink>

        <NavLink
          to="/log"
          className="relative -top-8 cartoon-btn bg-[#60D394]! hover:bg-[#A0E8AF]! p-0! border-[3px] border-[#3D2C24] flex items-center justify-center text-white"
          style={{ borderRadius: '50%', width: '60px', height: '60px' }}
        >
          <Plus size={32} strokeWidth={3} />
        </NavLink>

        <NavLink to="/party" className={({ isActive }) => `${baseNavItem} ${isActive ? 'text-[#FF7B9C] opacity-100' : ''}`}>
          <PartyPopper size={24} strokeWidth={2.5} />
          <span className="mt-1">Party</span>
        </NavLink>

        {/* Drop-up Menu Trigger */}
        <div className="relative flex flex-col items-center" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`${baseNavItem} ${isMenuOpen ? 'text-[#FF7B9C] opacity-100 scale-110' : ''} bg-transparent border-none p-0 cursor-pointer h-full relative z-[60]`}
          >
            {isMenuOpen ? <X size={24} strokeWidth={2.5} /> : <Menu size={24} strokeWidth={2.5} />}
            <span className="mt-1">Menu</span>
          </button>

          {/* Drop-up Content */}
          {isMenuOpen && (
            <div className="absolute bottom-[calc(100%+20px)] right-0 w-48 bg-white border-[3px] border-[#3D2C24] rounded-2xl shadow-[6px_6px_0px_rgba(61,44,36,1)] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200 z-[50]">
              <Link
                to="/world"
                className="flex items-center gap-3 px-4 py-3 font-black text-[#3D2C24] hover:bg-[#FFD166]/20 transition-colors border-b-[3px] border-[#3D2C24]"
              >
                <Globe size={20} strokeWidth={3} className="text-[#FFD166]" />
                World
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-3 px-4 py-3 font-black text-[#3D2C24] hover:bg-[#A0E8AF]/20 transition-colors"
              >
                <User size={20} strokeWidth={3} className="text-[#A0E8AF]" />
                Profile
              </Link>
            </div>
          )}
        </div>

      </div>
    </>
  )
}