import { useEffect, useState, useRef, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { generateInviteCode } from "../utils/InviteCode"
import { useNavigate } from "react-router-dom"
import { Plus, Users, PartyPopper, Calendar, MapPin, X, Activity, UserPlus, UserCheck, Flame, Zap, ArrowRight, UserX, QrCode, ScanLine, GlassWater, Wine, Smartphone, Loader2 } from "lucide-react"
import { useChug } from "../context/ChugContext"
import LiveCounter from "../components/LiveCounter"
import PhotoMetadata from "../components/PhotoMetadata"
import NinkasiChat from "../components/NinkasiChat"
import type { ActivityLog } from "./GroupFeed"
import { QRCodeSVG } from "qrcode.react"
import QRScanner from "../components/QRScanner"

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

interface Friend { friend_id: string; username: string; avatar_url: string; level: number; xp: number }
interface PastPartier { suggested_id: string; username: string; avatar_url: string; interaction_count: number }
interface FriendRequest { id: string; user_1: string; user_2: string; status: string; profiles: { id: string; username: string; avatar_url: string } }

export default function Groups() {
  const { user } = useChug()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'crews' | 'buddies' | 'requests' | 'discover' | 'ninkasi'>('crews')

  // --- CREWS STATE ---
  const [groups, setGroups] = useState<Group[]>([])
  const [groupFeed, setGroupFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'join' | null>(null)
  const [groupName, setGroupName] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [newInviteCode, setNewInviteCode] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // --- BUDDIES STATE ---
  const [friends, setFriends] = useState<Friend[]>([])
  const [suggestions, setSuggestions] = useState<PastPartier[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [showQR, setShowQR] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  // --- NFC STATE ---
  const [hasNfc] = useState(() => typeof window !== 'undefined' && 'NDEFReader' in window)
  const [nfcMode, setNfcMode] = useState<'idle' | 'writing' | 'scanning' | 'success' | 'error'>('idle')
  const [nfcMessage, setNfcMessage] = useState('')
  const [showNfcModal, setShowNfcModal] = useState(false)
  const nfcAbortRef = useRef<AbortController | null>(null)

  // --- FETCH CREWS ---
  const fetchCrewsData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data: memberData } = await supabase
      .from("group_members")
      .select(`groups (id, name, invite_code)`)
      .eq("user_id", user.id)

    const groupIds: string[] = []
    let groupUserIds: string[] = []

    if (memberData && memberData.length > 0) {
      const gList = memberData.map(m => Array.isArray(m.groups) ? m.groups[0] : m.groups).filter(Boolean) as unknown as Group[]
      setGroups(gList)

      groupIds.push(...gList.map(g => g.id))
      const { data: groupMembers } = await supabase.from('group_members').select('user_id').in('group_id', groupIds)
      if (groupMembers) groupUserIds = [...new Set(groupMembers.map(m => m.user_id))]
    } else {
      setGroups([])
      setGroupFeed([])
      setLoading(false)
      return
    }

    try {
      const [groupLogsResponse, memberPublicLogsResponse, partiesResponse] = await Promise.all([
        supabase.from("activity_logs").select(`*, profiles(username), log_appraisals(vote_type, appraiser_id)`).in('group_id', groupIds).in('privacy_level', ['public', 'groups']).order("created_at", { ascending: false }).limit(30),
        supabase.from("activity_logs").select(`*, profiles(username), log_appraisals(vote_type, appraiser_id)`).in('user_id', groupUserIds).eq('privacy_level', 'public').order("created_at", { ascending: false }).limit(20),
        supabase.from("parties").select(`*, profiles:host_id(username)`).in('group_id', groupIds).neq('privacy_level', 'hidden').order("created_at", { ascending: false }).limit(10)
      ])

      const mergedLogs = new Map<string, ActivityLog>()
      for (const log of [...(groupLogsResponse.data || []), ...(memberPublicLogsResponse.data || [])]) {
        mergedLogs.set(log.id, log as ActivityLog)
      }

      const combined: FeedItem[] = [
        ...Array.from(mergedLogs.values()).map(l => ({ type: 'log' as const, date: l.created_at, data: l })),
        ...(partiesResponse.data || []).map(p => ({ type: 'party' as const, date: p.created_at, data: p }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      const gFeed: FeedItem[] = []
      const groupUserIdSet = new Set(groupUserIds)
      const groupIdSet = new Set(groupIds)

      for (const item of combined) {
        const authorId = item.type === 'log' ? (item.data as ActivityLog).user_id : (item.data as PartyPreview).host_id
        if (!groupUserIdSet.has(authorId)) continue

        if (item.type === 'log') {
          const log = item.data as ActivityLog & { privacy_level?: string; group_id?: string | null }
          if (log.group_id && !groupIdSet.has(log.group_id)) continue
          if (log.privacy_level === 'groups' && (!log.group_id || !groupIdSet.has(log.group_id))) continue
        }

        if (item.type === 'party') {
          const party = item.data as PartyPreview & { group_id?: string | null }
          if (!party.group_id || !groupIdSet.has(party.group_id)) continue
        }
        gFeed.push(item)
      }
      setGroupFeed(gFeed)
    } catch (err) {
      console.error("Groups fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [user])

  // --- FETCH BUDDIES ---
  const fetchSocialData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      if (activeTab === 'buddies') {
        const { data: friendsData } = await supabase.rpc('get_friends', { user_uuid: user.id })
        if (friendsData) setFriends(friendsData)
        
        const { data: requestsData } = await supabase
          .from('friendships')
          .select('id, user_1, user_2, status, profiles!friendships_action_user_id_fkey(id, username, avatar_url)')
          .or(`user_1.eq.${user.id},user_2.eq.${user.id}`)
          .eq('status', 'pending')
          .neq('action_user_id', user.id)
        if (requestsData) {
          setRequests(requestsData.map(r => ({
            id: r.id, user_1: r.user_1, user_2: r.user_2, status: r.status,
            profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
          })) as FriendRequest[])
        }
      } else if (activeTab === 'discover') {
        const { data } = await supabase.rpc('get_past_partiers', { user_uuid: user.id })
        if (data) setSuggestions(data)
      }
    } catch (error) { console.error(error) }
    finally { setLoading(false) }
  }, [user, activeTab])

  useEffect(() => {
    if (activeTab === 'crews') fetchCrewsData()
    else fetchSocialData()
  }, [activeTab, fetchCrewsData, fetchSocialData])

  // --- CREW HANDLERS ---
  const handleCreateGroup = async () => {
    if (!user || !groupName.trim()) return
    const code = generateInviteCode()
    const { data, error } = await supabase.from("groups").insert({ name: groupName, created_by: user.id, invite_code: code }).select().single()
    if (data) {
      await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id })
      setNewInviteCode(code)
      fetchCrewsData()
    } else if (error) alert(error.message)
  }

  const handleJoinGroup = async () => {
    if (!user || !joinCode.trim()) return
    const normalizedCode = joinCode.trim().toUpperCase()
    const { data } = await supabase.from("groups").select("id").eq("invite_code", normalizedCode).single()
    if (!data) return alert("Invalid invite code")
    const { error } = await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id })
    if (error && !error.message.toLowerCase().includes("duplicate")) return alert(error.message)
    setModalMode(null)
    setJoinCode("")
    fetchCrewsData()
  }

  // --- BUDDY HANDLERS ---
  const handleSendRequest = async (targetId: string) => {
    if (!user) return
    const u1 = user.id < targetId ? user.id : targetId
    const u2 = user.id < targetId ? targetId : user.id
    setSuggestions(prev => prev.filter(s => s.suggested_id !== targetId))
    await supabase.from('friendships').insert({ user_1: u1, user_2: u2, status: 'pending', action_user_id: user.id })
  }

  const handleAccept = async (friendshipId: string) => {
    setRequests(prev => prev.filter(r => r.id !== friendshipId))
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
  }

  const handleDecline = async (friendshipId: string) => {
    setRequests(prev => prev.filter(r => r.id !== friendshipId))
    await supabase.from('friendships').delete().eq('id', friendshipId)
  }

  const handleRemoveFriend = async (targetId: string) => {
    if (!user) return
    if (!confirm("Remove this friend?")) return
    const u1 = user.id < targetId ? user.id : targetId
    const u2 = user.id < targetId ? targetId : user.id
    setFriends(prev => prev.filter(f => f.friend_id !== targetId))
    await supabase.from('friendships').delete().eq('user_1', u1).eq('user_2', u2)
  }

  const handlePingDrink = async (targetId: string, username: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('drink_invites').insert({
        sender_id: user.id,
        receiver_id: targetId,
        status: 'sent'
      });
      if (error) alert(error.message);
      else alert(`Sent a drink ping to ${username}! 🍻`);
    } catch (e) {
      console.error(e)
    }
  }

  const handleQRScan = async (decodedText: string) => {
    setIsScanning(false)
    if (decodedText && decodedText.length === 36) {
      await handleSendRequest(decodedText)
      alert("Friend request sent!")
    } else if (decodedText.includes('/connect/')) {
      window.location.href = decodedText;
    } else { alert("Invalid user QR code.") }
  }

  // --- NFC HANDLERS ---
  const stopNfc = () => {
    if (nfcAbortRef.current) {
      nfcAbortRef.current.abort()
      nfcAbortRef.current = null
    }
  }

  const handleNfcWrite = async () => {
    if (!user || !hasNfc) return
    stopNfc()
    setNfcMode('writing')
    setNfcMessage('Hold your phone against your friend\'s...')
    setShowNfcModal(true)

    try {
      const ndef = new (window as any).NDEFReader()
      const controller = new AbortController()
      nfcAbortRef.current = controller

      const profileUrl = `${window.location.origin}/connect/${user.id}`
      await ndef.write(
        { records: [{ recordType: 'url', data: profileUrl }] },
        { signal: controller.signal }
      )
      setNfcMode('success')
      setNfcMessage('Profile shared! \uD83C\uDF89')
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setNfcMode('error')
      setNfcMessage(err.message || 'NFC write failed')
    }
  }

  const handleNfcScan = async () => {
    if (!hasNfc) return
    stopNfc()
    setNfcMode('scanning')
    setNfcMessage('Tap an NFC tag or your friend\'s phone...')
    setShowNfcModal(true)

    try {
      const ndef = new (window as any).NDEFReader()
      const controller = new AbortController()
      nfcAbortRef.current = controller

      await ndef.scan({ signal: controller.signal })

      ndef.addEventListener('reading', ({ message }: any) => {
        for (const record of message.records) {
          if (record.recordType === 'url') {
            const decoder = new TextDecoder()
            const url = decoder.decode(record.data)
            if (url.includes('/connect/')) {
              stopNfc()
              setNfcMode('success')
              setNfcMessage('Friend found! Redirecting...')
              setTimeout(() => {
                setShowNfcModal(false)
                window.location.href = url
              }, 800)
              return
            }
          }
          // Also check text records for raw user IDs
          if (record.recordType === 'text') {
            const decoder = new TextDecoder()
            const text = decoder.decode(record.data)
            if (text.length === 36 && text.includes('-')) {
              stopNfc()
              setNfcMode('success')
              setNfcMessage('Friend found! Sending request...')
              handleSendRequest(text).then(() => {
                setNfcMessage('Request sent! \uD83C\uDF89')
                setTimeout(() => setShowNfcModal(false), 1200)
              })
              return
            }
          }
        }
        setNfcMode('error')
        setNfcMessage('Not a ChugChug profile tag.')
      }, { signal: controller.signal })
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setNfcMode('error')
      setNfcMessage(err.message || 'NFC scan failed')
    }
  }

  const closeNfcModal = () => {
    stopNfc()
    setShowNfcModal(false)
    setNfcMode('idle')
    setNfcMessage('')
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowDropdown(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const renderLog = (log: ActivityLog) => {
    const catColors: Record<string, string> = { drink: 'var(--amber)', snack: 'var(--coral)', cigarette: 'var(--acid)', gym: 'var(--amber)', detox: 'var(--acid)' }
    const badgeColor = catColors[log.category] || '#CCC'

    return (
      <div key={`log-${log.id}`} className="glass-card anim-enter">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full" style={{ backgroundColor: badgeColor, border: '1px solid var(--border)' }} />
          <div>
            <p className="text-sm font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{log.profiles?.username}</p>
            <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>{log.category}</p>
          </div>
        </div>
        <h3 className="font-black text-xl leading-none mb-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{log.item_name}</h3>
        <p className="font-bold text-sm" style={{ color: 'var(--amber)' }}>Amount: {log.quantity}</p>

        {log.photo_url && (
          <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <img src={supabase.storage.from('photos').getPublicUrl(log.photo_url).data.publicUrl} className="w-full h-32 object-cover" />
            {log.photo_metadata && <PhotoMetadata logId={log.id} metadata={log.photo_metadata} verifications={log.photo_verifications} onVerify={fetchCrewsData} />}
          </div>
        )}
      </div>
    )
  }

  const renderParty = (party: PartyPreview) => (
    <div key={`party-${party.id}`} className="glass-card anim-enter cursor-pointer" style={{ borderColor: 'rgba(255,107,107,0.15)' }} onClick={() => navigate(`/party/${party.id}`)}>
      <div className="flex items-center gap-2 mb-2">
        <PartyPopper size={24} style={{ color: 'var(--coral)' }} />
        <div>
          <p className="font-black text-lg leading-none" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{party.title}</p>
          <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Host: {party.profiles?.username}</p>
        </div>
      </div>
      <div className="space-y-1 mt-3">
        <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}><Calendar size={14} style={{ color: 'var(--acid)' }} /> {new Date(party.event_date).toLocaleDateString()}</p>
        <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}><MapPin size={14} style={{ color: 'var(--coral)' }} /> {party.address}</p>
      </div>
      <button className="w-full mt-3 glass-btn-secondary text-xs" style={{ borderColor: 'rgba(255,107,107,0.2)', color: 'var(--coral)' }}>View Party Details</button>
    </div>
  )

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title flex items-center gap-2">
          <Users size={22} style={{ color: 'var(--amber)' }} /> The Crew
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQR(true)} className="p-2 rounded-full transition-colors" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }} title="Show QR">
            <QrCode size={18} />
          </button>
          <button onClick={() => setIsScanning(true)} className="p-2 rounded-full transition-colors" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }} title="Scan QR">
            <ScanLine size={18} />
          </button>
          {hasNfc && (
            <button onClick={handleNfcWrite} className="p-2 rounded-full transition-colors" style={{ background: 'var(--acid-dim)', border: '1px solid rgba(204,255,0,0.3)', color: 'var(--acid)' }} title="Share via NFC">
              <Smartphone size={18} />
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)' }}>
        {([
          { id: 'crews' as const, label: 'Crews', icon: Users, color: 'var(--amber)' },
          { id: 'buddies' as const, label: 'Buddies', icon: UserCheck, color: 'var(--acid)' },
          { id: 'discover' as const, label: 'Discover', icon: Flame, color: 'var(--coral-light)' },
          { id: 'ninkasi' as const, label: 'Ninkasi', icon: Wine, color: '#c850c0' },
        ]).map(({ id, label, icon: Icon, color }, i) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition-all relative"
            style={{
              background: activeTab === id ? 'var(--bg-raised)' : 'transparent',
              color: activeTab === id ? color : 'var(--text-muted)',
              fontFamily: 'Syne, sans-serif',
              borderBottom: activeTab === id ? `2px solid ${color}` : '2px solid transparent',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none',
            }}
          >
            <Icon size={16} /> {label}
            {id === 'buddies' && requests.length > 0 && activeTab !== 'buddies' && (
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--coral)' }}></span>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--coral)' }}></span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* --- CREWS TAB CONTENT --- */}
      {activeTab === 'crews' && (
        <div className="anim-enter space-y-6">
          <div className="flex justify-end mb-2 relative" ref={dropdownRef}>
            <button onClick={() => setShowDropdown(!showDropdown)} className="glass-btn flex items-center gap-2 text-sm" style={{ padding: '9px 16px', fontSize: 13 }}>
              <Plus size={16} strokeWidth={2.5} /> New Crew
            </button>
            {showDropdown && (
              <div className="absolute top-12 right-0 w-48 rounded-2xl overflow-hidden z-50" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-mid)' }}>
                <button onClick={() => { setModalMode('create'); setShowDropdown(false) }} className="w-full text-left px-4 py-3 font-bold text-sm" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>✨ Create New Group</button>
                <button onClick={() => { setModalMode('join'); setShowDropdown(false) }} className="w-full text-left px-4 py-3 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>🔗 Join with Code</button>
              </div>
            )}
          </div>

          {/* Modals for Create/Join */}
          {modalMode === 'create' && (
            <div className="glass-card relative mb-6" style={{ borderColor: 'rgba(245,166,35,0.2)' }}>
              <button onClick={() => { setModalMode(null); setNewInviteCode("") }} className="absolute top-2 right-2 p-1" style={{ color: 'var(--text-muted)' }}><X size={20} strokeWidth={2} /></button>
              <h2 className="text-xl font-black mb-4" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Create a Group</h2>
              {!newInviteCode ? (
                <div className="space-y-3">
                  <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Awesome Crew" className="glass-input w-full" />
                  <button onClick={handleCreateGroup} className="glass-btn w-full">Create</button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-bold mb-2">Share this code with friends:</p>
                  <p className="font-black text-3xl tracking-widest py-3 mb-4 select-all rounded-xl" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)', background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>{newInviteCode}</p>
                  <button onClick={() => { setModalMode(null); setNewInviteCode("") }} className="glass-btn-secondary w-full">Done</button>
                </div>
              )}
            </div>
          )}

          {modalMode === 'join' && (
            <div className="glass-card relative mb-6" style={{ borderColor: 'rgba(204,255,0,0.15)' }}>
              <button onClick={() => setModalMode(null)} className="absolute top-2 right-2 p-1" style={{ color: 'var(--text-muted)' }}><X size={20} strokeWidth={2} /></button>
              <h2 className="text-xl font-black mb-4" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Join a Group</h2>
              <div className="space-y-3">
                <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter 7-char code" className="glass-input w-full uppercase" maxLength={7} />
                <button onClick={handleJoinGroup} className="glass-btn w-full bg-green-400/30!">Join</button>
              </div>
            </div>
          )}

          {groups.length > 0 && (
            <div>
              <p className="section-label mb-3">Your Groups ({groups.length})</p>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => navigate(`/group/${g.id}`)}
                    className="snap-start shrink-0 rounded-2xl px-4 py-3 transition-all active:scale-95 flex flex-col gap-3 min-w-[160px] text-left"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border-warm)', minWidth: 160 }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--amber-dim)' }}>
                        <Users size={16} strokeWidth={2} style={{ color: 'var(--amber)' }} />
                      </div>
                      <span className="font-black text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>{g.name}</span>
                    </div>
                    <div className="w-full pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                      <LiveCounter groupId={g.id} compact />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {groups.length === 0 && !loading && (
            <div className="text-center py-8 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-mid)' }}>
              <p className="font-bold text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>You're not in any groups yet</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Create or join one above!</p>
            </div>
          )}

          <div>
            <p className="section-label mb-3">Group Activity Feed</p>
            {groupFeed.length === 0 && !loading ? (
              <div className="text-center rounded-2xl py-10" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-mid)' }}>
                <Activity size={28} className="mx-auto mb-3" style={{ color: 'var(--text-ghost)' }} />
                <p className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>No group activity yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupFeed.map(item => item.type === 'log' ? renderLog(item.data as ActivityLog) : renderParty(item.data as PartyPreview))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- BUDDIES & REQUESTS TAB CONTENT --- */}
      {activeTab === 'buddies' && (
        <div className="anim-enter space-y-6">
          
          {/* Pending Requests (pinned to top) */}
          {requests.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--coral)' }} />
                <h2 className="text-xs uppercase font-black tracking-widest" style={{ color: 'var(--coral)' }}>Pending Requests</h2>
              </div>
              {requests.map(r => (
                <div key={r.id} className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-[4px]" style={{ background: 'var(--coral-dim)', border: '1px solid rgba(209,32,32,0.3)' }}>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-12 h-12 rounded-[4px] flex items-center justify-center overflow-hidden" style={{ background: 'var(--coral-dim)', border: '1px solid rgba(209,32,32,0.3)' }}>
                      {r.profiles.avatar_url ? <img src={r.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserPlus size={20} style={{ color: 'var(--coral)' }} />}
                    </div>
                    <div>
                      <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{r.profiles.username}</p>
                      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--coral)' }}>Wants to connect</p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => handleAccept(r.id)} className="flex-1 px-4 py-2 text-[10px] uppercase tracking-widest font-black rounded-[4px]" style={{ background: 'var(--acid-dim)', color: 'var(--acid)', border: '1px solid rgba(204,255,0,0.3)' }}>Accept</button>
                    <button onClick={() => handleDecline(r.id)} className="flex-1 px-4 py-2 text-[10px] uppercase tracking-widest font-black rounded-[4px]" style={{ background: 'var(--bg-deep)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Your Crew */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <UserCheck size={14} style={{ color: 'var(--acid)' }} />
              <h2 className="text-xs uppercase font-black tracking-widest" style={{ color: 'var(--text-primary)' }}>Your Crew</h2>
            </div>
            {friends.length === 0 && !loading ? (
              <div className="text-center py-16 font-bold uppercase tracking-widest text-sm" style={{ color: 'var(--text-muted)' }}>
                No accepted friends yet. <br />
                <button onClick={() => setActiveTab('discover')} className="mt-4 underline underline-offset-4" style={{ color: 'var(--amber)' }}>Find People</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {friends.map(f => (
                  <div key={f.friend_id} className="flex flex-col p-4 rounded-[4px] transition-colors gap-3" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${f.friend_id}`)}>
                        <div className="w-12 h-12 rounded-[4px] flex items-center justify-center overflow-hidden" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(216,162,94,0.3)' }}>
                          {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" /> : <UserCheck size={20} style={{ color: 'var(--amber)' }} />}
                        </div>
                        <div>
                          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{f.username}</p>
                          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--acid)' }}>Lvl {f.level} • {f.xp} XP</p>
                        </div>
                      </div>
                      <button onClick={() => handleRemoveFriend(f.friend_id)} className="p-2.5 rounded-[4px] transition-colors" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-mid)' }}>
                        <UserX size={16} />
                      </button>
                    </div>
                    <button onClick={() => handlePingDrink(f.friend_id, f.username)} className="w-full py-2.5 rounded-[4px] text-[10px] uppercase font-black tracking-widest flex justify-center items-center gap-2 active:scale-95 transition-transform" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(216,162,94,0.3)', color: 'var(--amber)' }}>
                      <GlassWater size={14} /> Ping for a Drink!
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- DISCOVER TAB CONTENT --- */}
      {activeTab === 'discover' && (
        <div className="anim-enter space-y-4">
          <div className="text-center mb-6">
            <span className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,166,35,0.2)', color: 'var(--amber)' }}>
              <Flame size={12} /> Based on Past Parties
            </span>
          </div>
          {suggestions.length === 0 && !loading ? (
            <div className="text-center py-10 font-bold uppercase tracking-widest text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              No suggestions right now. <br />
              <span className="text-[10px]" style={{ color: 'var(--amber)' }}>Host more Live Parties to meet people!</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suggestions.map(s => (
                <div key={s.suggested_id} className="flex flex-col p-4 rounded-2xl group" style={{ background: 'var(--bg-mid)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'var(--bg-surface)' }}>
                      {s.avatar_url ? <img src={s.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}><UserCheck size={16} /></div>}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate text-sm" style={{ color: 'var(--text-primary)' }}>{s.username}</p>
                      <p className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1" style={{ color: 'var(--amber)' }}><Zap size={10} /> Partied {s.interaction_count} times</p>
                    </div>
                  </div>
                  <button onClick={() => handleSendRequest(s.suggested_id)} className="w-full py-2.5 text-[10px] uppercase tracking-widest font-black rounded-xl flex items-center justify-center gap-2" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    Send Request <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-6">
          <Zap size={24} className="animate-spin" style={{ color: 'var(--amber)', opacity: 0.5 }} />
        </div>
      )}

      {/* QR Modals */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="p-8 rounded-[32px] max-w-sm w-full relative flex flex-col items-center gap-6 anim-enter" style={{ background: 'var(--bg-mid)', border: '1px solid var(--border)', boxShadow: '0 16px 64px rgba(0,0,0,0.6)' }}>
            <button onClick={() => setShowQR(false)} className="absolute top-4 right-4 p-2 rounded-full transition-colors" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}><X size={16} /></button>
            <div className="text-center">
              <h3 className="text-2xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Your Profile Code</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Let someone scan this to add you instantly.</p>
            </div>
            <div className="p-4 bg-white rounded-2xl" style={{ boxShadow: 'var(--amber-glow)' }}>
              <QRCodeSVG value={user?.id || ""} size={200} />
            </div>
          </div>
        </div>
      )}

      {/* --- NINKASI TAB --- */}
      {activeTab === 'ninkasi' && (
        <div className="anim-enter">
          <NinkasiChat onBack={() => setActiveTab('crews')} />
        </div>
      )}

      {isScanning && <QRScanner title="Scan Friend Code" onScan={handleQRScan} onClose={() => setIsScanning(false)} />}

      {/* --- NFC MODAL --- */}
      {showNfcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="p-8 rounded-[4px] max-w-sm w-full relative flex flex-col items-center gap-6 anim-enter" style={{ background: 'var(--bg-mid)', border: '1px solid var(--border)', boxShadow: '0 16px 64px rgba(0,0,0,0.6)' }}>
            <button onClick={closeNfcModal} className="absolute top-4 right-4 p-2 rounded-full transition-colors" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>

            <div className="text-center space-y-4">
              {/* Animated icon */}
              <div className="w-20 h-20 mx-auto rounded-[4px] flex items-center justify-center relative" style={{
                background: nfcMode === 'success' ? 'var(--acid-dim)' : nfcMode === 'error' ? 'var(--coral-dim)' : 'var(--amber-dim)',
                border: `1px solid ${nfcMode === 'success' ? 'rgba(204,255,0,0.3)' : nfcMode === 'error' ? 'rgba(209,32,32,0.3)' : 'rgba(216,162,94,0.3)'}`,
              }}>
                {(nfcMode === 'writing' || nfcMode === 'scanning') && (
                  <Loader2 size={36} className="animate-spin" style={{ color: 'var(--amber)' }} />
                )}
                {nfcMode === 'success' && (
                  <span className="text-4xl">✅</span>
                )}
                {nfcMode === 'error' && (
                  <span className="text-4xl">❌</span>
                )}
              </div>

              <h3 className="text-xl font-black uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
                {nfcMode === 'writing' ? 'NFC Share' : nfcMode === 'scanning' ? 'NFC Scan' : nfcMode === 'success' ? 'Done!' : 'Error'}
              </h3>
              <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>{nfcMessage}</p>

              {/* Action buttons */}
              {nfcMode !== 'writing' && nfcMode !== 'scanning' && (
                <div className="flex gap-3 w-full pt-2">
                  <button onClick={handleNfcWrite} className="flex-1 py-3 rounded-[4px] text-[10px] uppercase font-black tracking-widest active:scale-95 transition-transform" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(216,162,94,0.3)', color: 'var(--amber)' }}>
                    Share My Profile
                  </button>
                  <button onClick={handleNfcScan} className="flex-1 py-3 rounded-[4px] text-[10px] uppercase font-black tracking-widest active:scale-95 transition-transform" style={{ background: 'var(--acid-dim)', border: '1px solid rgba(204,255,0,0.3)', color: 'var(--acid)' }}>
                    Scan a Friend
                  </button>
                </div>
              )}

              {(nfcMode === 'writing' || nfcMode === 'scanning') && (
                <button onClick={closeNfcModal} className="w-full py-3 rounded-[4px] text-[10px] uppercase font-black tracking-widest active:scale-95 transition-transform" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)', color: 'var(--text-muted)' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}