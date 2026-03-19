import { useEffect, useState, useRef, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { generateInviteCode } from "../utils/InviteCode"
import { useNavigate } from "react-router-dom"
import { Plus, Users, PartyPopper, Calendar, MapPin, X, Activity } from "lucide-react"
import { useChug } from "../context/ChugContext"
import LiveCounter from "../components/LiveCounter"
import PhotoMetadata from "../components/PhotoMetadata"
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
  host_id: string
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
  const [groupFeed, setGroupFeed] = useState<FeedItem[]>([])
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
    if (!user) {
      setGroups([])
      setGroupFeed([])
      setLoading(false)
      return
    }

    setLoading(true)

    const { data: memberData } = await supabase
      .from("group_members")
      .select(`groups (id, name, invite_code)`)
      .eq("user_id", user.id)

    const groupIds: string[] = []
    let groupUserIds: string[] = []
    if (memberData && memberData.length > 0) {
      const gList = memberData.map(m => Array.isArray(m.groups) ? m.groups[0] : m.groups) as unknown as Group[]
      setGroups(gList)

      groupIds.push(...gList.map(g => g.id))
      const { data: groupMembers } = await supabase
        .from('group_members')
        .select('user_id')
        .in('group_id', groupIds)

      if (groupMembers) {
        groupUserIds = [...new Set(groupMembers.map(m => m.user_id))]
      }
    } else {
      setGroups([])
      setGroupFeed([])
      setLoading(false)
      return
    }

    const [
      { data: logsData },
      { data: partiesData }
    ] = await Promise.all([
      supabase
        .from("activity_logs")
        .select(`*, profiles:user_id(username), log_appraisals(vote_type, appraiser_id), photo_verifications(verifier_id, profiles:verifier_id(username))`)
        .in('privacy_level', ['public', 'groups'])
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("parties")
        .select(`*, profiles:host_id(username)`)
        .in('group_id', groupIds)
        .neq('privacy_level', 'hidden')
        .order("created_at", { ascending: false })
        .limit(10)
    ])

    const combined: FeedItem[] = [
      ...(logsData || []).map(l => ({ type: 'log' as const, date: l.created_at, data: l })),
      ...(partiesData || []).map(p => ({ type: 'party' as const, date: p.created_at, data: p }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Filter feed to only group members
    const gFeed: FeedItem[] = []

    for (const item of combined) {
      const authorId = item.type === 'log' ? (item.data as ActivityLog).user_id : (item.data as PartyPreview).host_id
      if (!groupUserIds.includes(authorId) || authorId === user.id) continue

      if (item.type === 'log') {
        const log = item.data as ActivityLog & { privacy_level?: string; group_id?: string | null }
        if (log.privacy_level === 'groups' && (!log.group_id || !groupIds.includes(log.group_id))) {
          continue
        }
      }

      if (item.type === 'party') {
        const party = item.data as PartyPreview & { group_id?: string | null }
        if (!party.group_id || !groupIds.includes(party.group_id)) continue
      }

      if (groupUserIds.includes(authorId)) {
        gFeed.push(item)
      }
    }

    setGroupFeed(gFeed)
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateGroup = async () => {
    if (!user || !groupName.trim()) return
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
    if (!user || !joinCode.trim()) return
    const normalizedCode = joinCode.trim().toUpperCase()
    const { data } = await supabase.from("groups").select("id").eq("invite_code", normalizedCode).single()
    if (!data) return alert("Invalid invite code")

    const { error } = await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id })
    if (error && !error.message.toLowerCase().includes("duplicate") && !error.message.toLowerCase().includes("unique")) {
      alert(error.message)
      return
    }

    setModalMode(null)
    setJoinCode("")
    fetchData()
  }

  const renderLog = (log: ActivityLog) => {
    const catColors: Record<string, string> = { drink: '#FFD166', snack: '#FF9F1C', cigarette: '#A0E8AF', gym: '#118AB2', detox: '#06D6A0' }
    const badgeColor = catColors[log.category] || '#CCC'

    return (
      <div key={`log-${log.id}`} className="glass-card bg-white/5 animate-fadeInScale">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full border border-white/15 shadow-lg shadow-black/20" style={{ backgroundColor: badgeColor }} />
          <div>
            <p className="text-sm font-bold text-white/90 leading-none">{log.profiles?.username}</p>
            <p className="text-[10px] uppercase font-black tracking-widest opacity-50">{log.category}</p>
          </div>
        </div>
        <h3 className="font-black text-xl text-white/90 leading-none mb-1">{log.item_name}</h3>
        <p className="font-bold neon-pink text-sm">Amount: {log.quantity}</p>

        {log.photo_url && (
          <div className="mt-2 rounded-xl overflow-hidden border border-white/10">
            <img src={supabase.storage.from('photos').getPublicUrl(log.photo_url).data.publicUrl} className="w-full h-32 object-cover" />
            {log.photo_metadata && (
                <PhotoMetadata 
                    logId={log.id} 
                    metadata={log.photo_metadata} 
                    verifications={log.photo_verifications} 
                    onVerify={fetchData} 
                />
            )}
          </div>
        )}
      </div>
    )
  }

  const renderParty = (party: PartyPreview) => {
    return (
      <div key={`party-${party.id}`} className="glass-card bg-pink-500/30/10 border-pink-500/30 animate-fadeInScale cursor-pointer" onClick={() => navigate(`/party/${party.id}`)}>
        <div className="flex items-center gap-2 mb-2">
          <PartyPopper size={24} className="neon-pink" />
          <div>
            <p className="font-black text-lg text-white/90 leading-none">{party.title}</p>
            <p className="text-xs font-bold opacity-60">Host: {party.profiles?.username}</p>
          </div>
        </div>
        <div className="space-y-1 mt-3">
          <p className="text-sm font-bold flex items-center gap-2"><Calendar size={14} className="neon-lime" /> {new Date(party.event_date).toLocaleDateString()}</p>
          <p className="text-sm font-bold flex items-center gap-2"><MapPin size={14} className="neon-pink" /> {party.address}</p>
        </div>
        <button className="w-full mt-3 glass-btn-secondary text-xs! border-pink-500/30 neon-pink">View Party Details</button>
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
            className="w-10 h-10 bg-amber-400/30 rounded-full border border-white/15 shadow-lg shadow-black/20 flex items-center justify-center text-white/90 transition-transform active:scale-95"
          >
            <Plus size={24} strokeWidth={2} />
          </button>

          {showDropdown && (
            <div className="absolute top-12 left-0 w-48 bg-white/5 border border-white/15 rounded-xl shadow-lg shadow-black/20 overflow-hidden z-50">
              <button
                onClick={() => { setModalMode('create'); setShowDropdown(false) }}
                className="w-full text-left px-4 py-3 font-black text-white/90 hover:bg-amber-400/30/20 border-b-[3px] border-white/15 transition-colors"
              >
                Create Group
              </button>
              <button
                onClick={() => { setModalMode('join'); setShowDropdown(false) }}
                className="w-full text-left px-4 py-3 font-black text-white/90 hover:bg-green-300/20/20 transition-colors"
              >
                Join Group
              </button>
            </div>
          )}
        </div>

        <h1 className="text-3xl font-black text-white/90">Community</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Modals for Create/Join */}
      {modalMode === 'create' && (
        <div className="glass-card bg-amber-400/30/20 border-amber-400/30 relative mb-6">
          <button onClick={() => { setModalMode(null); setNewInviteCode("") }} className="absolute top-2 right-2 p-1 text-white/90/50 hover:text-white/90"><X size={20} strokeWidth={2} /></button>
          <h2 className="text-xl font-black mb-4">Create a Group</h2>
          {!newInviteCode ? (
            <div className="space-y-3">
              <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Awesome Crew" className="glass-input w-full" />
              <button onClick={handleCreateGroup} className="glass-btn w-full">Create</button>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-bold mb-2">Share this code with friends:</p>
              <p className="font-black text-3xl neon-pink tracking-widest bg-white/5 rounded-xl border border-white/15 py-3 mb-4 select-all">{newInviteCode}</p>
              <button onClick={() => { setModalMode(null); setNewInviteCode("") }} className="glass-btn-secondary w-full">Done</button>
            </div>
          )}
        </div>
      )}

      {modalMode === 'join' && (
        <div className="glass-card bg-green-300/20/20 border-green-400/30 relative mb-6">
          <button onClick={() => setModalMode(null)} className="absolute top-2 right-2 p-1 text-white/90/50 hover:text-white/90"><X size={20} strokeWidth={2} /></button>
          <h2 className="text-xl font-black mb-4">Join a Group</h2>
          <div className="space-y-3">
            <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter 7-char code" className="glass-input w-full uppercase" maxLength={7} />
            <button onClick={handleJoinGroup} className="glass-btn w-full bg-green-400/30!">Join</button>
          </div>
        </div>
      )}

      {/* Your Groups Horizontal Scroller */}
      {groups.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-black text-white/90 mb-3 px-1">Your Groups</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none snap-x px-1">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => navigate(`/group/${g.id}`)}
                className="snap-start shrink-0 bg-white/5 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:bg-white/10 px-5 py-4 rounded-3xl transition-all active:scale-95 flex flex-col items-start gap-3 min-w-40 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-400/20 rounded-xl border border-green-400/30">
                    <Users size={18} className="text-green-300" strokeWidth={2.5} />
                  </div>
                  <span className="font-black text-white/90 text-sm tracking-wide">{g.name}</span>
                </div>
                {/* Embedded compact live counter */}
                <div className="w-full pt-3 border-t border-white/5 mt-auto">
                    <LiveCounter groupId={g.id} compact />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The Social Feed: Logs + Parties */}
      <div>
        {loading ? (
          <div className="text-center font-bold opacity-50 py-8">Loading feed...</div>
        ) : (
          <>
            {/* Group Activity Section */}
            <h2 className="text-lg font-black text-white/90 mb-4 px-1">Activity From Your Groups</h2>
            {groupFeed.length === 0 ? (
              <div className="text-center glass-card bg-white/5 border-dashed border-white/10 mb-8 py-10 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent"></div>
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.05)] anim-float relative z-10">
                  <Activity size={28} className="text-white/40" />
                </div>
                <p className="font-bold text-white/50 relative z-10">No recent activities from your groups.</p>
              </div>
            ) : (
              <div className="space-y-4 mb-8">
                {groupFeed.map(item => item.type === 'log' ? renderLog(item.data as ActivityLog) : renderParty(item.data as PartyPreview))}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  )
}