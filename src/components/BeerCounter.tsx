import { useState, useEffect, useRef } from "react"
import { supabase } from "../lib/supabase"
import { firebaseDb } from "../lib/firebase"
import { ref, set } from "firebase/database"
import { useChug } from "../context/ChugContext"
import { evaluateAndAwardBadges } from "../lib/progression"
import { Beer, Share2, Users, Globe, Minus, RotateCcw, Camera, Loader2, X } from "lucide-react"

interface BeerCounterProps {
  compact?: boolean
  partyId?: string
  groupId?: string
  onSessionLogged?: () => void
}

export default function BeerCounter({ compact, partyId, groupId, onSessionLogged }: BeerCounterProps) {
  const { user, profile } = useChug()
  const [count, setCount] = useState(0)
  const [showShare, setShowShare] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const pulseRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const countRef = useRef(0)
  const hasInteractedRef = useRef(false)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    countRef.current = count
  }, [count])

  useEffect(() => {
    if (!showLogModal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLogModal(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showLogModal])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    hasInteractedRef.current = false

    const loadCount = async () => {
      const { data, error } = await supabase
        .from("beer_counts")
        .select("count")
        .eq("user_id", user.id)
        .eq("date", today)
        .single()

      // Prevent late network responses from overwriting a user tap.
      if (cancelled || hasInteractedRef.current) return

      if (error) {
        setCount(0)
        return
      }

      setCount(data?.count ?? 0)
    }
    loadCount()

    const loadGroups = async () => {
      const { data } = await supabase
        .from("group_members")
        .select("groups(id, name)")
        .eq("user_id", user.id)
      if (data) {
        const g = data.map((m: any) => Array.isArray(m.groups) ? m.groups[0] : m.groups).filter(Boolean)
        setGroups(g)
      }
    }
    loadGroups()

    return () => {
      cancelled = true
    }
  }, [user, today])

  const syncToFirebase = (newCount: number) => {
    if (!user) return
    if (partyId) {
      set(ref(firebaseDb, `parties/${partyId}/counters/${user.id}`), {
        count: newCount, username: profile?.username || 'Anonymous', updatedAt: Date.now()
      })
    }
    if (groupId) {
      set(ref(firebaseDb, `live_counters/groups/${groupId}/${user.id}`), {
        count: newCount, username: profile?.username || 'Anonymous', updatedAt: Date.now()
      })
    } else {
      groups.forEach(g => {
        set(ref(firebaseDb, `live_counters/groups/${g.id}/${user.id}`), {
          count: newCount, username: profile?.username || 'Anonymous', updatedAt: Date.now()
        })
      })
    }
  }

  const updateCount = async (delta: number) => {
    if (!user) return
    hasInteractedRef.current = true
    const previousCount = countRef.current
    const newCount = Math.max(0, previousCount + delta)
    countRef.current = newCount
    setCount(newCount)
    setAnimating(true)
    setTimeout(() => setAnimating(false), 300)

    const { error } = await supabase.from("beer_counts").upsert({
      user_id: user.id, date: today, count: newCount, updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,date' })

    if (!error) {
      syncToFirebase(newCount)
      return
    }

    // Roll back optimistic update if persistence fails.
    countRef.current = previousCount
    setCount(previousCount)
  }

  const shareToGroup = async (gId: string) => {
    await supabase.from("beer_counts").update({ shared_to_group_id: gId }).eq("user_id", user!.id).eq("date", today)
    set(ref(firebaseDb, `live_counters/groups/${gId}/${user!.id}`), {
      count, username: profile?.username || 'Anonymous', updatedAt: Date.now()
    })
    setShowShare(false)
  }

  const sharePublicly = async () => {
    await supabase.from("beer_counts").update({ shared_publicly: true }).eq("user_id", user!.id).eq("date", today)
    setShowShare(false)
  }

  const handleReset = async () => {
    if (!user) return
    hasInteractedRef.current = true
    
    setCount(0)
    countRef.current = 0
    await supabase.from("beer_counts").upsert({
      user_id: user.id, date: today, count: 0, updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,date' })
    syncToFirebase(0)
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleLogSession = async () => {
    if (!user || count === 0) return alert("You need at least 1 count to log a session!")
    if (!photo) return alert("Please upload a photograph of your drinking session!")
    setLogging(true)

    try {
      // 1. Upload Photo
      const fileExt = photo.name.split('.').pop()
      const fileName = `${user.id}-session-${Date.now()}.${fileExt}`
      const filePath = `activity_logs/${fileName}`

      const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, photo)
      if (uploadError) throw uploadError

      // 2. Create Activity Log
      const { error: logError } = await supabase.from('activity_logs').insert({
        user_id: user.id,
        category: 'drink',
        item_name: 'Drinking Session',
        quantity: count,
        xp_earned: count * 5,
        photo_url: filePath,
        privacy_level: groupId ? 'groups' : 'public',
        group_id: groupId || null
      })
      if (logError) throw logError

      // 3. Add XP
      await supabase.rpc('add_xp', { user_id_param: user.id, xp_to_add: count * 5 })

      // Removed reset logic: Daily cumulative count should persist so the Live Leaderboard remains populated.
      await evaluateAndAwardBadges(user.id)
      
      onSessionLogged?.()

      setShowLogModal(false)
      setPhoto(null)
      setPhotoPreview(null)
      alert("Session logged successfully!")

    } catch (e: any) {
      alert("Error logging session: " + e.message)
    } finally {
      setLogging(false)
    }
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-2 p-3 rounded-2xl w-full transition-all" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             <Beer size={18} style={{ color: 'var(--amber)' }} />
             <span className="font-black text-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>{count}</span>
          </div>
          <div className="flex gap-1 rounded-full p-1" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <button onClick={() => updateCount(-1)} aria-label="Decrease beer count" disabled={count === 0} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-20 active:scale-95" style={{ color: 'var(--text-muted)' }}><Minus size={18}/></button>
            <button onClick={() => updateCount(1)} aria-label="Increase beer count" className="w-16 h-10 rounded-full flex items-center justify-center font-black text-lg transition-all active:scale-90 tracking-tighter" style={{ background: 'linear-gradient(135deg, #F5A623, #E8880A)', color: '#1A1208', boxShadow: '0 2px 8px rgba(245,166,35,0.4)' }}>
              +1
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={() => setShowLogModal(true)} aria-label="Log session" disabled={count === 0} className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,166,35,0.2)', color: 'var(--amber)' }}>
            <Camera size={14}/> Log
          </button>
          <button onClick={handleReset} aria-label="End session and reset" disabled={count === 0} className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30" style={{ background: 'var(--danger-dim)', border: '1px solid rgba(229,83,75,0.2)', color: 'var(--danger)' }}>
            <RotateCcw size={14}/> Reset
          </button>
        </div>

        {/* Log Session Modal (Compact) */}
        {showLogModal && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end p-4 bg-black/80 backdrop-blur-md anim-fade-in touch-none" role="dialog" aria-modal="true" aria-label="Log drinking session">
            <div className="bg-[#121212] border border-white/10 w-full space-y-4 anim-slide-up relative overflow-hidden shadow-2xl" style={{ padding: '24px', borderRadius: '32px' }}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black text-white">Log Session</h3>
                <button onClick={() => setShowLogModal(false)} aria-label="Close modal" className="p-2 bg-white/5 rounded-full text-white/60 hover:text-white"><X size={16} /></button>
              </div>
              <p className="text-sm font-medium text-white/50">
                Logging <strong className="text-white text-lg">{count}</strong> drinks. Snap proof to log your XP.
              </p>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-48 rounded-[24px] flex flex-col items-center justify-center gap-3 cursor-pointer transition-all active:scale-95 bg-black/50 border border-white/10"
                style={{
                  background: photoPreview ? `linear-gradient(to top, rgba(0,0,0,0.8), transparent), url(${photoPreview}) center/cover` : '',
                }}>
                {!photoPreview && <><Camera size={32} className="text-white/40" /><span className="text-sm font-bold text-white/50">Tap to Camera</span></>}
                {photoPreview && <span className="absolute bottom-6 text-sm font-bold text-white bg-black/50 px-4 py-1.5 rounded-full backdrop-blur-md">Retake</span>}
              </div>
              <input type="file" accept="image/*" capture="environment" className="hidden" aria-label="Upload session photo" ref={fileInputRef} onChange={handlePhotoSelect} />

              <button onClick={handleLogSession} disabled={logging || !photo} className="w-full py-4 rounded-full font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 bg-white text-black disabled:opacity-50 mt-4">
                {logging ? <Loader2 size={18} className="animate-spin" /> : "Confirm & Broadcast"}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-[32px] p-6 relative overflow-hidden shadow-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black tracking-tight text-white">Live Session</h2>
          <span className="text-xs font-bold text-white/40 uppercase tracking-widest">{today}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} disabled={count === 0}
            aria-label="End session and reset"
            className="p-3 bg-white/5 rounded-full transition-all duration-200 hover:bg-rose-500/20 text-white/60 hover:text-rose-400 disabled:opacity-20">
            <RotateCcw size={18} strokeWidth={2.5} />
          </button>
          <button onClick={() => setShowShare(!showShare)}
            aria-label="Toggle share menu"
            className="p-3 bg-white/5 rounded-full transition-all duration-200 hover:bg-white/10 text-white/60 hover:text-white">
            <Share2 size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Sleek Counter display */}
      <div className="flex flex-col items-center justify-center py-6">
        <div ref={pulseRef} className="relative flex flex-col items-center justify-center cursor-pointer group select-none"
          onClick={() => updateCount(1)}
          style={{ transition: 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)', transform: animating ? 'scale(0.92)' : 'scale(1)' }}>
          
          <div className="relative w-56 h-56 rounded-full flex flex-col items-center justify-center transition-all duration-300"
            style={{
              border: count > 0 ? '6px solid var(--amber)' : '6px solid var(--border)',
              background: count > 0 ? 'var(--amber-dim)' : 'transparent',
              boxShadow: count > 0 ? '0 0 40px rgba(245,166,35,0.15), inset 0 0 30px rgba(245,166,35,0.05)' : 'none',
            }}>
            <span className="text-[80px] font-black tracking-tighter leading-none" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
              {count}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest mt-2" style={{ color: 'var(--text-muted)' }}>TAP TO CHUG</span>
          </div>
        </div>
        
        {count > 0 && (
          <button onClick={(e) => { e.stopPropagation(); updateCount(-1); }}
            aria-label="Decrease beer count"
            className="mt-8 px-6 py-2.5 rounded-full flex items-center justify-center gap-2 transition-all font-bold text-sm"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)' }}>
            <Minus size={14} /> Remove One
          </button>
        )}
      </div>

      {/* Action Button */}
      <div className="mt-6 flex flex-col gap-3">
        <button 
          onClick={() => setShowLogModal(true)} 
          disabled={count === 0}
          className="glass-btn w-full text-lg disabled:opacity-20"
          style={{ padding: '16px 24px' }}
        >
          <Camera size={20} /> Snapshot & Sync
        </button>
      </div>

      {/* Share menu */}
      {showShare && (
        <div className="mt-6 pt-6 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2 text-white/50">Display Terminal</p>

          {groups.map(g => (
            <button key={g.id} onClick={() => shareToGroup(g.id)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95">
              <div className="p-2 bg-white/10 rounded-full"><Users size={18} className="text-white" /></div>
              <div className="flex flex-col items-start gap-1">
                <span className="font-bold text-white text-base">{g.name}</span>
                <span className="text-xs text-white/40 font-medium">Sync counter live to group display</span>
              </div>
            </button>
          ))}

          <button onClick={sharePublicly}
            className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95">
            <div className="p-2 bg-white/10 rounded-full"><Globe size={18} className="text-white" /></div>
            <div className="flex flex-col items-start gap-1">
              <span className="font-bold text-white text-base">World Feed</span>
              <span className="text-xs text-white/40 font-medium">Sync counter publicly</span>
            </div>
          </button>

          <button onClick={() => setShowShare(false)}
            className="w-full text-center py-4 text-sm font-bold text-white/50 hover:text-white/80 transition-colors">
            Cancel
          </button>
        </div>
      )}

      {/* Log Session Modal (Full) */}
      {showLogModal && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end p-4 bg-black/80 backdrop-blur-xl anim-fade-in touch-none">
          <div className="bg-[#111] border border-white/10 w-full space-y-6 anim-slide-up relative overflow-hidden shadow-2xl" style={{ padding: '32px 24px', borderRadius: '40px' }}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-2xl font-black text-white tracking-tight">Sync To Cloud</h3>
              <button onClick={() => setShowLogModal(false)} className="p-3 hover:bg-white/10 bg-white/5 rounded-full transition-colors text-white/60 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-base font-medium text-white/50">
              Locking in <span className="text-white font-black px-1">{count}</span> rounds. Attach photo evidence.
            </p>
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-64 rounded-[32px] flex flex-col items-center justify-center gap-4 cursor-pointer transition-all active:scale-95 group overflow-hidden relative bg-black/40 border-2 border-dashed border-white/20 mt-4"
              style={{
                background: photoPreview ? `url(${photoPreview}) center/cover` : '',
                borderStyle: photoPreview ? 'solid' : 'dashed',
                borderColor: photoPreview ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)'
              }}>
              {photoPreview && <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>}
              {!photoPreview && <><div className="bg-white/10 p-4 rounded-full group-hover:scale-110 transition-transform"><Camera size={32} className="text-white" /></div><span className="text-sm font-bold text-white/60">Tap to Camera</span></>}
              {photoPreview && <span className="absolute bottom-6 text-sm font-bold text-white bg-black/40 px-6 py-2.5 rounded-full backdrop-blur-md border border-white/10 flex items-center gap-2"><Camera size={16}/> Retake</span>}
            </div>
            <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handlePhotoSelect} />

            <button onClick={handleLogSession} disabled={logging || !photo} className="w-full py-5 rounded-full font-black text-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 bg-white text-black mt-4">
              {logging ? <Loader2 size={24} className="animate-spin" /> : "Authorize & Sync"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
