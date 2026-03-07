import { NavLink } from "react-router-dom"
import { Home, Plus, PartyPopper, Trophy, User, Users } from "lucide-react"

export default function BottomNav() {
  const base = "flex flex-col items-center text-[10px] font-black uppercase tracking-wider text-[#3D2C24] transition-transform hover:scale-110 active:scale-95 gap-1 opacity-70 hover:opacity-100"

  return (
    <div className="fixed bottom-0 w-full bg-white border-t-[3px] border-[#3D2C24] rounded-t-3xl flex justify-around py-3 z-50 shadow-[0px_-4px_0px_rgba(0,0,0,0.05)]">
      <NavLink to="/" className={({ isActive }) => `${base} ${isActive ? 'text-[#FF7B9C] opacity-100' : ''}`}>
        <Home size={24} strokeWidth={2.5} />
        <span className="mt-1">Home</span>
      </NavLink>

      <NavLink
        to="/log"
        className="relative -top-8 cartoon-btn bg-[#60D394]! hover:bg-[#A0E8AF]! p-0! border-[3px] border-[#3D2C24] flex items-center justify-center text-white"
        style={{ borderRadius: '50%', width: '60px', height: '60px' }}
      >
        <Plus size={32} strokeWidth={3} />
      </NavLink>

      <NavLink to="/groups" className={({ isActive }) => `${base} ${isActive ? 'text-[#FF7B9C] opacity-100' : ''}`}>
        <Users size={24} strokeWidth={2.5} />
        <span className="mt-1">Groups</span>
      </NavLink>
      <NavLink to="/party" className={({ isActive }) => `${base} ${isActive ? 'text-[#FF7B9C] opacity-100' : ''}`}>
        <PartyPopper size={24} strokeWidth={2.5} />
        <span className="mt-1">Party</span>
      </NavLink>
      <NavLink to="/rank" className={({ isActive }) => `${base} ${isActive ? 'text-[#FF7B9C] opacity-100' : ''}`}>
        <Trophy size={24} strokeWidth={2.5} />
        <span className="mt-1">Rank</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => `${base} ${isActive ? 'text-[#FF7B9C] opacity-100' : ''}`}>
        <User size={24} strokeWidth={2.5} />
        <span className="mt-1">Profile</span>
      </NavLink>
    </div>
  )
}