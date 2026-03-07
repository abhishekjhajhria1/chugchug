import { useEffect, useState, useRef, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { generateInviteCode } from "../utils/InviteCode"
import { useNavigate } from "react-router-dom"
import { Plus, Users, PartyPopper, Calendar, MapPin, X } from "lucide-react"
import { useChug } from "../context/ChugContext"
import type { ActivityLog } from "./GroupFeed"

interface Group {
  id: string
  name: string
  invite_code: string
}

interface PartyPreview {
  id: string
  title: string
  event_date: string
  address: string
  profiles?: { username: string }
}

interface FeedItem {
  type: 'log' | 'party'
  date: string
  data: ActivityLog | PartyPreview
}

export default function Groups() {
  const { user } = useChug()
  const navigate = useNavigate()

  const [groups, setGroups] = useState<Group[]>([])
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  const [showDropdown, setShowDropdown] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'join' | null>(null)

  const [groupName, setGroupName] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [newInviteCode, setNewInviteCode] = useState("")

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchData = useCallback(async () => {
    if (!user) return

    const { data: memberData } = await supabase
      .from("group_members")
      .select(`groups (id, name, invite_code)`)
      .eq("user_id", user.id)

    if (memberData) {
      setGroups(memberData.map((m) => (Array.isArray(m.groups) ? m.groups[0] : m.groups) as unknown as Group))
    }

    const { data: logsData } = await supabase
      .from("activity_logs")
      .select(`*, profiles:user_id(username), log_appraisals(vote_type, appraiser_id)`)
      .in('privacy_level', ['public', 'groups'])
      .order("created_at", { ascending: false })
      .limit(20)

    const { data: partiesData } = await supabase
      .from("parties")
      .select(`*, profiles:host_id(username)`)
      .neq('privacy_level', 'hidden')
      .order("created_at", { ascending: false })
      .limit(10)

    const combined: FeedItem[] = [
      ...(logsData || []).map(l => ({ type: 'log' as const, date: l.created_at, data: l })),
      ...(partiesData || []).map(p => ({ type: 'party' as const, date: p.created_at, data: p }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    setFeed(combined)
    setLoading(false)
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line
    fetchData()
  }, [fetchData])

  const handleCreateGroup = async () => {
    if (!user || !groupName) return
    const code = generateInviteCode()

    const { data, error } = await supabase.from("groups").insert({
      name: groupName, created_by: user.id, invite_code: code
    }).select().single()

    if (data) {
      await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id })
      setNewInviteCode(code)
      fetchData()
    } else if (error) {
      alert(error.message)
    }
  }

  const handleJoinGroup = async () => {
    if (!user || !joinCode) return
    const { data } = await supabase.from("groups").select("id").eq("invite_code", joinCode).single()
    if (!data) return alert("Invalid invite code")

    await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id })
    setModalMode(null)
    setJoinCode("")
    fetchData()
  }

  const renderLog = (log: ActivityLog) => {
    const catColors: Record<string, string> = { drink: '#FFD166', snack: '#FF9F1C', cigarette: '#A0E8AF', gym: '#118AB2', detox: '#06D6A0' }
    const badgeColor = catColors[log.category] || '#CCC'

    return (
      <div key={`log-${log.id}`} className="cartoon-card bg-white fade-in">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24]" style={{ backgroundColor: badgeColor }} />
          <div>
            <p className="text-sm font-bold text-[#3D2C24] leading-none">{log.profiles?.username}</p>
            <p className="text-[10px] uppercase font-black tracking-widest opacity-50">{log.category}</p>
          </div>
        </div>
        <h3 className="font-black text-xl text-[#3D2C24] leading-none mb-1">{log.item_name}</h3>
        <p className="font-bold text-[#FF7B9C] text-sm">Amount: {log.quantity}</p>
      </div>
    )
  }

  const renderParty = (party: PartyPreview) => {
    return (
      <div key={`party-${party.id}`} className="cartoon-card bg-[#FF7B9C]/10 border-[#FF7B9C] fade-in cursor-pointer" onClick={() => navigate('/party')}>
        <div className="flex items-center gap-2 mb-2">
          <PartyPopper size={24} className="text-[#FF7B9C]" />
          <div>
            <p className="font-black text-lg text-[#3D2C24] leading-none">{party.title}</p>
            <p className="text-xs font-bold opacity-60">Host: {party.profiles?.username}</p>
          </div>
        </div>
        <div className="space-y-1 mt-3">
          <p className="text-sm font-bold flex items-center gap-2"><Calendar size={14} className="text-[#A0E8AF]" /> {new Date(party.event_date).toLocaleDateString()}</p>
          <p className="text-sm font-bold flex items-center gap-2"><MapPin size={14} className="text-[#FF7B9C]" /> {party.address}</p>
        </div>
        <button className="w-full mt-3 cartoon-btn-secondary text-xs! border-[#FF7B9C] text-[#FF7B9C]">View Party Details</button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header with Top-Left + Dropdown */}
      <div className="flex items-center justify-between mb-4 relative">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-10 h-10 bg-[#FFD166] rounded-full border-[3px] border-[#3D2C24] shadow-[3px_3px_0px_#3D2C24] flex items-center justify-center text-[#3D2C24] transition-transform active:scale-95"
          >
            <Plus size={24} strokeWidth={3} />
          </button>

          {showDropdown && (
            <div className="absolute top-12 left-0 w-48 bg-white border-[3px] border-[#3D2C24] rounded-xl shadow-[4px_4px_0px_#3D2C24] overflow-hidden z-50">
              <button
                onClick={() => { setModalMode('create'); setShowDropdown(false) }}
                className="w-full text-left px-4 py-3 font-black text-[#3D2C24] hover:bg-[#FFD166]/20 border-b-[3px] border-[#3D2C24] transition-colors"
              >
                Create Group
              </button>
              <button
                onClick={() => { setModalMode('join'); setShowDropdown(false) }}
                className="w-full text-left px-4 py-3 font-black text-[#3D2C24] hover:bg-[#A0E8AF]/20 transition-colors"
              >
                Join Group
              </button>
            </div>
          )}
        </div>

        <h1 className="text-3xl font-black text-[#3D2C24]">Community</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Modals for Create/Join */}
      {modalMode === 'create' && (
        <div className="cartoon-card bg-[#FFD166]/20 border-[#FFD166] relative mb-6">
          <button onClick={() => { setModalMode(null); setNewInviteCode("") }} className="absolute top-2 right-2 p-1 text-[#3D2C24]/50 hover:text-[#3D2C24]"><X size={20} strokeWidth={3} /></button>
          <h2 className="text-xl font-black mb-4">Create a Group</h2>
          {!newInviteCode ? (
            <div className="space-y-3">
              <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Awesome Crew" className="cartoon-input w-full" />
              <button onClick={handleCreateGroup} className="cartoon-btn w-full">Create</button>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-bold mb-2">Share this code with friends:</p>
              <p className="font-black text-3xl text-[#FF7B9C] tracking-widest bg-white rounded-xl border-2 border-[#3D2C24] py-3 mb-4 select-all">{newInviteCode}</p>
              <button onClick={() => { setModalMode(null); setNewInviteCode("") }} className="cartoon-btn-secondary w-full">Done</button>
            </div>
          )}
        </div>
      )}

      {modalMode === 'join' && (
        <div className="cartoon-card bg-[#A0E8AF]/20 border-[#60D394] relative mb-6">
          <button onClick={() => setModalMode(null)} className="absolute top-2 right-2 p-1 text-[#3D2C24]/50 hover:text-[#3D2C24]"><X size={20} strokeWidth={3} /></button>
          <h2 className="text-xl font-black mb-4">Join a Group</h2>
          <div className="space-y-3">
            <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter 6-char code" className="cartoon-input w-full uppercase" maxLength={6} />
            <button onClick={handleJoinGroup} className="cartoon-btn w-full bg-[#60D394]!">Join</button>
          </div>
        </div>
      )}

      {/* Your Groups Horizontal Scroller */}
      {groups.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-black text-[#3D2C24] mb-3 px-1">Your Groups</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none snap-x px-1">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => navigate(`/group/${g.id}`)}
                className="snap-start shrink-0 bg-white border-[3px] border-[#3D2C24] shadow-[3px_3px_0px_#3D2C24] px-5 py-3 rounded-2xl font-black text-[#3D2C24] transition-transform active:scale-95 flex items-center gap-2"
              >
                <Users size={18} className="text-[#A0E8AF]" strokeWidth={3} /> {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The Social Feed: Logs + Parties */}
      <div>
        <h2 className="text-lg font-black text-[#3D2C24] mb-4 px-1">Recent Activity</h2>
        {loading ? (
          <div className="text-center font-bold opacity-50 py-8">Loading feed...</div>
        ) : feed.length === 0 ? (
          <div className="text-center cartoon-card bg-gray-100 border-dashed opacity-70">
            <p className="font-bold">No recent activities.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {feed.map(item => item.type === 'log' ? renderLog(item.data as ActivityLog) : renderParty(item.data as PartyPreview))}
          </div>
        )}
      </div>

    </div>
  )
}