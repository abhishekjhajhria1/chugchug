import { useState, useEffect, useRef } from "react"
import { supabase } from "../lib/supabase"
import { firebaseDb } from "../lib/firebase"
import { ref, set } from "firebase/database"
import { useChug } from "../context/ChugContext"
import { Beer, Share2, Users, Globe, Minus, RotateCcw, Camera, Loader2 } from "lucide-react"

interface BeerCounterProps {
  compact?: boolean
  partyId?: string
  groupId?: string
}

export default function BeerCounter({ compact, partyId, groupId }: BeerCounterProps) {
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
    }
  }

  const updateCount = async (delta: number) => {
    if (!user) return
    hasInteractedRef.current = true
    const newCount = Math.max(0, countRef.current + delta)
    setCount(newCount)
    setAnimating(true)
    setTimeout(() => setAnimating(false), 300)

    const { error } = await supabase.from("beer_counts").upsert({
      user_id: user.id, date: today, count: newCount, updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,date' })

    if (!error) syncToFirebase(newCount)
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
    if (!confirm("Are you sure you want to end this session and reset your counter to 0?")) return
    
    setCount(0)
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

      // 4. Reset counter
      setCount(0)
      await supabase.from("beer_counts").upsert({
        user_id: user.id, date: today, count: 0, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,date' })
      syncToFirebase(0)

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
      <div className="flex flex-col gap-2 p-3 glass-card glow-gold w-full transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             <Beer size={18} className="accent-gold" />
             <span className="font-black text-lg">{count}</span>
          </div>
          <div className="flex gap-1 bg-black/20 rounded-full p-1 border border-white/5">
            <button onClick={() => updateCount(-1)} aria-label="Decrease beer count" disabled={count === 0} className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:bg-white/10 transition-colors disabled:opacity-20 active:scale-95"><Minus size={14}/></button>
            <button onClick={() => updateCount(1)} aria-label="Increase beer count" className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 transition-all active:scale-90 hover:bg-amber-500/30 shadow-[0_0_10px_rgba(251,191,36,0.2)]">+</button>
          </div>
        </div>
        <div className="flex gap-2 mt-1">
          <button onClick={() => setShowLogModal(true)} aria-label="Log session" disabled={count === 0} className="flex-1 glass-btn-secondary py-1.5 text-xs flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 disabled:opacity-30">
            <Camera size={12} className="accent-mint"/> Log Session
          </button>
          <button onClick={handleReset} aria-label="End session and reset" disabled={count === 0} className="flex-1 glass-btn-secondary py-1.5 text-xs flex items-center justify-center gap-1 bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20 hover:text-white disabled:opacity-30">
            <RotateCcw size={12}/> Reset
          </button>
        </div>

        {/* Log Session Modal (Compact) */}
        {showLogModal && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end p-4 bg-black/60 backdrop-blur-sm anim-fade-in touch-none" role="dialog" aria-modal="true" aria-label="Log drinking session">
            <div className="glass-card glow-mint w-full space-y-4 anim-slide-up relative overflow-hidden" style={{ padding: '24px', borderRadius: '24px' }}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black">Log Drinking Session</h3>
                <button onClick={() => setShowLogModal(false)} aria-label="Close log session modal" className="p-2 bg-white/5 rounded-full"><Minus size={16} /></button>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>
                You're logging <strong className="accent-gold text-lg">{count}</strong> beers. Snap a pic for proof!
              </p>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-48 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all active:scale-95"
                style={{
                  background: photoPreview ? `linear-gradient(to top, rgba(0,0,0,0.8), transparent), url(${photoPreview}) center/cover` : 'var(--glass-fill)',
                  border: photoPreview ? '1px solid var(--accent-mint)' : '1px dashed var(--glass-edge-lit)',
                  boxShadow: photoPreview ? '0 0 20px rgba(110,231,183,0.1)' : 'none'
                }}>
                {!photoPreview && <><Camera size={32} className="accent-mint" /><span className="text-sm font-bold">Tap to add photo</span></>}
                {photoPreview && <span className="absolute bottom-6 text-sm font-bold text-white bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">Tap to retake</span>}
              </div>
              <input type="file" accept="image/*" capture="environment" className="hidden" aria-label="Upload session photo" ref={fileInputRef} onChange={handlePhotoSelect} />

              <button onClick={handleLogSession} disabled={logging || !photo} className="w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_20px_rgba(110,231,183,0.3)] disabled:opacity-50 disabled:shadow-none" style={{ background: 'var(--accent-mint)', color: 'black' }}>
                {logging ? <Loader2 size={18} className="animate-spin" /> : "Log Session & Broadcast"}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="glass-card glow-gold relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-2 right-3 text-6xl opacity-[0.04] pointer-events-none select-none">🍺</div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Beer size={20} className="accent-gold" />
          <h2 className="text-lg font-bold">Today's Count</h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleReset} disabled={count === 0}
            aria-label="End session and reset"
            className="p-2 rounded-xl transition-all duration-200 hover:bg-pink-500/20 text-white/40 hover:text-pink-400 disabled:opacity-20"
            title="End Session & Reset">
            <RotateCcw size={18} strokeWidth={2.5} />
          </button>
          <button onClick={() => setShowShare(!showShare)}
            aria-label="Toggle share menu"
            className="p-2 rounded-xl transition-all duration-200 hover:bg-white/10"
            style={{ color: 'var(--text-dim)' }}>
            <Share2 size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Counter display */}
      <div className="flex items-center justify-center gap-4 py-4">
        <button onClick={() => updateCount(-1)} disabled={count === 0}
          aria-label="Decrease beer count"
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-20"
          style={{ background: 'var(--glass-fill)', border: '1px solid var(--glass-edge)' }}>
          <Minus size={18} style={{ color: 'var(--text-dim)' }} />
        </button>

        <div ref={pulseRef} className="relative flex items-center justify-center"
          style={{ transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)', transform: animating ? 'scale(1.15) rotate(2deg)' : 'scale(1) rotate(0deg)' }}>
          <div className="w-28 h-28 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(217,119,6,0.10))',
              border: '2px solid rgba(251,191,36,0.4)',
              boxShadow: animating ? '0 0 40px rgba(251,191,36,0.3), inset 0 0 20px rgba(251,191,36,0.2)' : '0 10px 30px -10px rgba(251,191,36,0.15), inset 0 4px 10px rgba(251,191,36,0.1)',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
            <span className="text-5xl font-black tracking-tighter" style={{ 
              color: '#FDE68A', 
              textShadow: '0 2px 10px rgba(251,191,36,0.5)',
              fontFamily: 'Outfit, sans-serif' 
            }}>
              {count}
            </span>
          </div>
          {animating && (
            <div className="absolute inset-0 rounded-full" style={{
              border: '2px solid rgba(251,191,36,0.5)',
              animation: 'ringPulse 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
            }} />
          )}
        </div>

        <button onClick={() => updateCount(1)}
          aria-label="Increase beer count"
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,0.30), rgba(251,191,36,0.15))',
            border: '1px solid rgba(251,191,36,0.35)',
            color: 'var(--text-bright)',
            boxShadow: '0 4px 12px rgba(251,191,36,0.15)',
          }}>
          <span className="text-xl font-bold">+</span>
        </button>
      </div>

      {/* Log Session Button */}
      <div className="mt-4">
        <button 
          onClick={() => setShowLogModal(true)} 
          aria-label="Log session and upload photo"
          disabled={count === 0}
          className="w-full glass-btn-secondary py-3 flex items-center justify-center gap-2 bg-linear-to-r from-amber-500/10 to-orange-500/5 hover:from-amber-500/20 hover:to-orange-500/10 border-amber-500/20 text-amber-200 transition-all font-bold disabled:opacity-30 disabled:grayscale"
        >
          <Camera size={16} /> Log Session & Upload Photo
        </button>
      </div>

      {/* Share menu */}
      {showShare && (
        <div className="mt-4 pt-4 space-y-2 anim-slide" style={{ borderTop: '1px dashed var(--glass-edge)' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>Broadcast Display</p>

          {groups.map(g => (
            <button key={g.id} onClick={() => shareToGroup(g.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl transition-all bg-white/5 hover:bg-white/10 active:scale-95"
              style={{ border: '1px solid var(--glass-edge-lit)' }}>
              <Users size={16} className="accent-mint" />
              <div className="flex flex-col items-start">
                <span className="font-semibold text-sm">{g.name}</span>
                <span className="text-[10px] text-white/50">Sync counter live to group display</span>
              </div>
            </button>
          ))}

          <button onClick={sharePublicly}
            className="w-full flex items-center gap-3 p-3 rounded-xl transition-all bg-white/5 hover:bg-white/10 active:scale-95"
            style={{ border: '1px solid var(--glass-edge-lit)' }}>
            <Globe size={16} className="accent-aqua" />
            <div className="flex flex-col items-start">
              <span className="font-semibold text-sm">World Feed</span>
              <span className="text-[10px] text-white/50">Sync counter live publicly</span>
            </div>
          </button>

          <button onClick={() => setShowShare(false)}
            className="w-full text-center py-2 text-xs font-semibold" style={{ color: 'var(--text-ghost)' }}>
            Cancel
          </button>
        </div>
      )}

      {/* Log Session Modal (Full) */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end p-4 bg-black/60 backdrop-blur-md anim-fade-in touch-none" role="dialog" aria-modal="true" aria-label="Log drinking session">
          <div className="glass-card glow-gold w-full space-y-4 anim-slide-up relative overflow-hidden shadow-2xl" style={{ padding: '24px', borderRadius: '24px', border: '1px solid rgba(251,191,36,0.3)' }}>
            <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-amber-400 to-orange-500"></div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-black">Log Drinking Session</h3>
              <button onClick={() => setShowLogModal(false)} aria-label="Close log session modal" className="p-2 hover:bg-white/10 rounded-full transition-colors"><Minus size={16} /></button>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>
              You're logging <strong className="text-amber-400 text-lg">{count}</strong> beers. Snap a pic to prove it and broadcast to the feed!
            </p>
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-56 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all active:scale-95 group overflow-hidden relative"
              style={{
                background: photoPreview ? `url(${photoPreview}) center/cover` : 'rgba(251,191,36,0.05)',
                border: photoPreview ? 'none' : '1px dashed rgba(251,191,36,0.3)',
                boxShadow: photoPreview ? '0 10px 30px rgba(0,0,0,0.5)' : 'none'
              }}>
              {photoPreview && <div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent"></div>}
              {!photoPreview && <><Camera size={36} className="text-amber-400 opacity-80 group-hover:scale-110 transition-transform" /><span className="text-sm font-bold text-amber-200">Tap to add photo</span></>}
              {photoPreview && <span className="absolute bottom-6 text-sm font-bold text-white bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">Tap to retake</span>}
            </div>
            <input type="file" accept="image/*" capture="environment" className="hidden" aria-label="Upload session photo" ref={fileInputRef} onChange={handlePhotoSelect} />

            <button onClick={handleLogSession} disabled={logging || !photo} className="w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:shadow-[0_4px_25px_rgba(251,191,36,0.4)] disabled:opacity-50 disabled:shadow-none bg-linear-to-r from-amber-400 to-amber-500 text-black">
              {logging ? <Loader2 size={18} className="animate-spin" /> : "Log Session & Broadcast"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
