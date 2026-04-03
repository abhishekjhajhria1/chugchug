import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useChug } from "../context/ChugContext"
import { supabase } from "../lib/supabase"
import { Users, UserPlus, UserCheck, Flame, Zap, ArrowRight, UserX, X, QrCode, ScanLine } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import QRScanner from "../components/QRScanner"

// Types matching the RPCs we created
interface Friend {
  friend_id: string
  username: string
  avatar_url: string
  level: number
  xp: number
}

interface PastPartier {
  suggested_id: string
  username: string
  avatar_url: string
  interaction_count: number
}

interface FriendRequest {
  id: string
  user_1: string
  user_2: string
  status: string
  profiles: {
    id: string
    username: string
    avatar_url: string
  }
}

export default function Social() {
  const { user } = useChug()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'discover'>('friends')
  const [showQR, setShowQR] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  
  const [friends, setFriends] = useState<Friend[]>([])
  const [suggestions, setSuggestions] = useState<PastPartier[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchSocialData()
  }, [user, activeTab])

  const fetchSocialData = async () => {
    if (!user) return
    setLoading(true)
    try {
      if (activeTab === 'friends') {
        const { data } = await supabase.rpc('get_friends', { user_uuid: user.id })
        if (data) setFriends(data)
      } else if (activeTab === 'discover') {
        const { data } = await supabase.rpc('get_past_partiers', { user_uuid: user.id })
        if (data) setSuggestions(data)
      } else if (activeTab === 'requests') {
        // Get requests where user is the recipient (user_2 or user_1 depending on insertion logic)
        // Since we enforced user_1 < user_2, we must look at where user is involved, but action_user_id IS NOT user
        const { data } = await supabase
          .from('friendships')
          .select('id, user_1, user_2, status, profiles!friendships_action_user_id_fkey(id, username, avatar_url)')
          .or(`user_1.eq.${user.id},user_2.eq.${user.id}`)
          .eq('status', 'pending')
          .neq('action_user_id', user.id) // It's a request to us if we didn't initiate it
        
        if (data) {
          // Flatten the structure for easier rendering
          const formatted = data.map(r => ({
            id: r.id,
            user_1: r.user_1,
            user_2: r.user_2,
            status: r.status,
            profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
          })) as FriendRequest[]
          setRequests(formatted)
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendRequest = async (targetId: string) => {
    if (!user) return
    const u1 = user.id < targetId ? user.id : targetId
    const u2 = user.id < targetId ? targetId : user.id
    
    // Optimistically remove from suggestions
    setSuggestions(prev => prev.filter(s => s.suggested_id !== targetId))
    
    await supabase.from('friendships').insert({
      user_1: u1,
      user_2: u2,
      status: 'pending',
      action_user_id: user.id
    })
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

  const handleQRScan = async (decodedText: string) => {
    setIsScanning(false)
    if (decodedText && decodedText.length === 36) { // naive UUID check
       await handleSendRequest(decodedText)
       // FIRE THE CLINK ANIMATION ON BOTH DEVICES!
       if ((window as any).triggerClink) {
           (window as any).triggerClink(decodedText)
       }
    } else {
       alert("Invalid user QR code.")
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto flex flex-col font-sans mb-12">
      <div className="flex items-center justify-between">
        <h1 className="page-title flex items-center gap-2">
            <Users size={22} style={{ color: 'var(--indigo)' }}/> Social Hub
        </h1>
        <div className="flex items-center gap-2">
            <button onClick={() => setShowQR(true)} className="p-2 rounded-full transition-colors" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <QrCode size={18} />
            </button>
            <button onClick={() => setIsScanning(true)} className="p-2 rounded-full transition-colors" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <ScanLine size={18} />
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)' }}>
        {([
          { id: 'friends' as const,  label: 'Friends',  icon: UserCheck },
          { id: 'requests' as const, label: 'Requests', icon: UserPlus },
          { id: 'discover' as const, label: 'Discover', icon: Flame },
        ]).map(({ id, label, icon: Icon }, i) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-all relative"
            style={{
              background: activeTab === id ? 'var(--indigo-dim)' : 'transparent',
              color: activeTab === id ? 'var(--indigo)' : 'var(--text-muted)',
              fontFamily: 'Nunito, sans-serif',
              borderRight: i < 2 ? '1px solid var(--border)' : 'none',
            }}
          >
            <Icon size={14} /> {label}
            {id === 'requests' && activeTab !== 'requests' && requests.length > 0 && (
              <span className="absolute top-2 right-3 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--coral)' }}></span>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--coral)' }}></span>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="glass-card" style={{ padding: 20, minHeight: '50vh' }}>
        {loading ? (
            <div className="flex justify-center py-20">
                <div className="animate-spin text-indigo-400 opacity-50"><Zap size={32}/></div>
            </div>
        ) : (
            <>
              {/* FRIENDS TAB */}
              {activeTab === 'friends' && (
                <div className="space-y-3">
                  {friends.length === 0 ? (
                      <div className="text-center py-16 text-white/30 font-bold uppercase tracking-widest text-sm">
                          No accepted friends yet. <br/>
                          <button onClick={() => setActiveTab('discover')} className="text-indigo-400 mt-4 underline decoration-indigo-400/30 underline-offset-4">Find People</button>
                      </div>
                  ) : (
                      friends.map(f => (
                          <div key={f.friend_id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${f.friend_id}`)}>
                                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center overflow-hidden">
                                    {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" /> : <UserCheck size={20} className="text-indigo-400" />}
                                  </div>
                                  <div>
                                      <p className="font-bold text-white/90">{f.username}</p>
                                      <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Lvl {f.level} • {f.xp} XP</p>
                                  </div>
                              </div>
                              <button 
                                onClick={() => handleRemoveFriend(f.friend_id)}
                                className="p-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/30 hover:text-rose-400 transition-colors"
                              >
                                  <UserX size={16} />
                              </button>
                          </div>
                      ))
                  )}
                </div>
              )}

              {/* REQUESTS TAB */}
              {activeTab === 'requests' && (
                <div className="space-y-3">
                  {requests.length === 0 ? (
                      <div className="text-center py-16 text-white/30 font-bold uppercase tracking-widest text-sm">
                          No pending requests.
                      </div>
                  ) : (
                      requests.map(r => (
                          <div key={r.id} className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 to-transparent border border-rose-500/20">
                              <div className="flex items-center gap-3 w-full sm:w-auto">
                                  <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center overflow-hidden">
                                    {r.profiles.avatar_url ? <img src={r.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserPlus size={20} className="text-rose-400" />}
                                  </div>
                                  <div>
                                      <p className="font-bold text-white/90">{r.profiles.username}</p>
                                      <p className="text-[10px] uppercase tracking-wider text-rose-400/80 font-bold">Wants to connect</p>
                                  </div>
                              </div>
                              <div className="flex gap-2 w-full sm:w-auto">
                                  <button onClick={() => handleAccept(r.id)} className="flex-1 px-4 py-2 bg-emerald-500/20 text-emerald-400 text-[10px] uppercase tracking-widest font-black rounded-xl hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors">Accept</button>
                                  <button onClick={() => handleDecline(r.id)} className="flex-1 px-4 py-2 bg-white/5 text-white/50 text-[10px] uppercase tracking-widest font-black rounded-xl hover:bg-white/10 hover:text-white transition-colors">Decline</button>
                              </div>
                          </div>
                      ))
                  )}
                </div>
              )}

              {/* DISCOVER TAB */}
              {activeTab === 'discover' && (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                      <span className="inline-flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full text-[10px] font-black text-amber-400 uppercase tracking-widest">
                          <Flame size={12}/> Based on Past Parties
                      </span>
                  </div>
                  {suggestions.length === 0 ? (
                      <div className="text-center py-10 text-white/30 font-bold uppercase tracking-widest text-sm leading-relaxed">
                          No suggestions right now. <br/> 
                          <span className="text-amber-400/50 text-[10px]">Host more Live Parties to meet people!</span>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {suggestions.map(s => (
                              <div key={s.suggested_id} className="flex flex-col p-4 rounded-2xl bg-black/60 border border-white/5 hover:border-amber-500/30 transition-colors group">
                                  <div className="flex items-center gap-3 mb-4">
                                      <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                                          {s.avatar_url ? <img src={s.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-white/30"><UserCheck size={16}/></div>}
                                      </div>
                                      <div className="min-w-0">
                                          <p className="font-bold text-white/90 truncate text-sm">{s.username}</p>
                                          <p className="text-[10px] uppercase tracking-wider text-amber-400/70 font-bold flex items-center gap-1">
                                              <Zap size={10}/> Partied {s.interaction_count} times
                                          </p>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => handleSendRequest(s.suggested_id)}
                                    className="w-full py-2.5 bg-white/5 text-white/60 text-[10px] uppercase tracking-widest font-black rounded-xl group-hover:bg-amber-500/20 group-hover:text-amber-400 transition-colors flex items-center justify-center gap-2"
                                  >
                                      Send Request <ArrowRight size={14}/>
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}
                </div>
              )}
            </>
        )}
      </div>

      {/* QR Modals */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md anim-fade-in touch-none">
            <div className="bg-[#111] p-8 rounded-[32px] border border-white/10 max-w-sm w-full shadow-2xl relative flex flex-col items-center gap-6 anim-scale-in">
                <button onClick={() => setShowQR(false)} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
                    <X size={16} />
                </button>
                <div className="text-center">
                    <h3 className="text-2xl font-black text-white">Your Profile Code</h3>
                    <p className="text-white/50 text-sm mt-1">Let someone scan this to add you instantly.</p>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                    <QRCodeSVG value={user?.id || ""} size={200} />
                </div>
            </div>
        </div>
      )}

      {isScanning && (
          <QRScanner 
            title="Scan Friend Code"
            onScan={handleQRScan} 
            onClose={() => setIsScanning(false)} 
          />
      )}
    </div>
  )
}
