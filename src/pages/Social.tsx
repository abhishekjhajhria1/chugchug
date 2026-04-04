import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useChug } from "../context/ChugContext"
import { supabase } from "../lib/supabase"
import { Users, UserPlus, UserCheck, Flame, Zap, ArrowRight, UserX, X, QrCode, ScanLine } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import QRScanner from "../components/QRScanner"

interface Friend { friend_id: string; username: string; avatar_url: string; level: number; xp: number }
interface PastPartier { suggested_id: string; username: string; avatar_url: string; interaction_count: number }
interface FriendRequest { id: string; user_1: string; user_2: string; status: string; profiles: { id: string; username: string; avatar_url: string } }

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

  useEffect(() => { if (!user) return; fetchSocialData() }, [user, activeTab])

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
        const { data } = await supabase
          .from('friendships')
          .select('id, user_1, user_2, status, profiles!friendships_action_user_id_fkey(id, username, avatar_url)')
          .or(`user_1.eq.${user.id},user_2.eq.${user.id}`)
          .eq('status', 'pending')
          .neq('action_user_id', user.id)
        if (data) {
          setRequests(data.map(r => ({
            id: r.id, user_1: r.user_1, user_2: r.user_2, status: r.status,
            profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
          })) as FriendRequest[])
        }
      }
    } catch (error) { console.error(error) }
    finally { setLoading(false) }
  }

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

  const handleQRScan = async (decodedText: string) => {
    setIsScanning(false)
    if (decodedText && decodedText.length === 36) {
      await handleSendRequest(decodedText)
      if ((window as any).triggerClink) (window as any).triggerClink(decodedText)
    } else { alert("Invalid user QR code.") }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto flex flex-col font-sans mb-12">
      <div className="flex items-center justify-between">
        <h1 className="page-title flex items-center gap-2">
          <Users size={22} style={{ color: 'var(--amber)' }}/> Social Hub
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
          { id: 'friends' as const,  label: 'Friends',  icon: UserCheck, color: 'var(--acid)',  bg: 'var(--acid-dim)' },
          { id: 'requests' as const, label: 'Requests', icon: UserPlus,  color: 'var(--coral)', bg: 'var(--coral-dim)' },
          { id: 'discover' as const, label: 'Discover', icon: Flame,     color: 'var(--amber)', bg: 'var(--amber-dim)' },
        ]).map(({ id, label, icon: Icon, color, bg }, i) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-all relative"
            style={{
              background: activeTab === id ? bg : 'transparent',
              color: activeTab === id ? color : 'var(--text-muted)',
              fontFamily: 'Syne, sans-serif',
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
            {/* FRIENDS TAB */}
            {activeTab === 'friends' && (
              <div className="space-y-3">
                {friends.length === 0 && !loading ? (
                  <div className="text-center py-16 font-bold uppercase tracking-widest text-sm" style={{ color: 'var(--text-muted)' }}>
                    No accepted friends yet. <br/>
                    <button onClick={() => setActiveTab('discover')} className="mt-4 underline underline-offset-4" style={{ color: 'var(--amber)' }}>Find People</button>
                  </div>
                ) : (
                  friends.map(f => (
                    <div key={f.friend_id} className="flex items-center justify-between p-3 rounded-2xl transition-colors" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${f.friend_id}`)}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,166,35,0.2)' }}>
                          {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" /> : <UserCheck size={20} style={{ color: 'var(--amber)' }} />}
                        </div>
                        <div>
                          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{f.username}</p>
                          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--acid)' }}>Lvl {f.level} • {f.xp} XP</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFriend(f.friend_id)}
                        className="p-2.5 rounded-xl transition-colors"
                        style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
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
                {requests.length === 0 && !loading ? (
                  <div className="text-center py-16 font-bold uppercase tracking-widest text-sm" style={{ color: 'var(--text-muted)' }}>No pending requests.</div>
                ) : (
                  requests.map(r => (
                    <div key={r.id} className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, var(--coral-dim), transparent)', border: '1px solid rgba(255,107,107,0.2)' }}>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: 'var(--coral-dim)', border: '1px solid rgba(255,107,107,0.2)' }}>
                          {r.profiles.avatar_url ? <img src={r.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserPlus size={20} style={{ color: 'var(--coral)' }} />}
                        </div>
                        <div>
                          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{r.profiles.username}</p>
                          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--coral)' }}>Wants to connect</p>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => handleAccept(r.id)} className="flex-1 px-4 py-2 text-[10px] uppercase tracking-widest font-black rounded-xl transition-colors" style={{ background: 'var(--acid-dim)', color: 'var(--acid)', border: '1px solid rgba(204,255,0,0.2)' }}>Accept</button>
                        <button onClick={() => handleDecline(r.id)} className="flex-1 px-4 py-2 text-[10px] uppercase tracking-widest font-black rounded-xl transition-colors" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>Decline</button>
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
                  <span className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,166,35,0.2)', color: 'var(--amber)' }}>
                    <Flame size={12}/> Based on Past Parties
                  </span>
                </div>
                {suggestions.length === 0 && !loading ? (
                  <div className="text-center py-10 font-bold uppercase tracking-widest text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    No suggestions right now. <br/>
                    <span className="text-[10px]" style={{ color: 'var(--amber)' }}>Host more Live Parties to meet people!</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {suggestions.map(s => (
                      <div key={s.suggested_id} className="flex flex-col p-4 rounded-2xl group" style={{ background: 'var(--bg-mid)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'var(--bg-surface)' }}>
                            {s.avatar_url ? <img src={s.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}><UserCheck size={16}/></div>}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold truncate text-sm" style={{ color: 'var(--text-primary)' }}>{s.username}</p>
                            <p className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1" style={{ color: 'var(--amber)' }}>
                              <Zap size={10}/> Partied {s.interaction_count} times
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSendRequest(s.suggested_id)}
                          className="w-full py-2.5 text-[10px] uppercase tracking-widest font-black rounded-xl transition-colors flex items-center justify-center gap-2"
                          style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                        >
                          Send Request <ArrowRight size={14}/>
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

      </div>

      {/* QR Modals */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="p-8 rounded-[32px] max-w-sm w-full relative flex flex-col items-center gap-6 anim-enter" style={{ background: 'var(--bg-mid)', border: '1px solid var(--border)', boxShadow: '0 16px 64px rgba(0,0,0,0.6)' }}>
            <button onClick={() => setShowQR(false)} className="absolute top-4 right-4 p-2 rounded-full transition-colors" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
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
