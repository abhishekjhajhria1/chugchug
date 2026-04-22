import { useState, useEffect, useRef } from "react"
import { useChug } from "../context/ChugContext"
import { supabase } from "../lib/supabase"
import { firebaseDb } from "../lib/firebase"
import { ref, get, remove } from "firebase/database"
import { evaluateAndAwardBadges, getRankInfo } from "../lib/progression"
import { Camera, Loader2, X, Eye, Users, Globe, Lock } from "lucide-react"
import SessionRecapCard from "./SessionRecapCard"

interface EndSessionModalProps {
  sessionId: string
  groupId?: string | null
  onClose: () => void
  onDone: () => void
}

interface ParticipantSummary {
  userId: string
  username: string
  count: number
}

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', icon: Globe, desc: 'Everyone can see' },
  { value: 'groups', label: 'Groups', icon: Users, desc: 'Selected groups only' },
  { value: 'private', label: 'Private', icon: Lock, desc: 'Only you' },
] as const

export default function EndSessionModal({ sessionId, groupId, onClose, onDone }: EndSessionModalProps) {
  const { user, profile } = useChug()
  const [participants, setParticipants] = useState<ParticipantSummary[]>([])
  const [visibility, setVisibility] = useState<'public' | 'groups' | 'private'>(groupId ? 'groups' : 'public')
  const [userGroups, setUserGroups] = useState<{ id: string; name: string }[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>(groupId ? [groupId] : [])
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showRecap, setShowRecap] = useState(false)
  const [sessionStartTime] = useState(() => Date.now())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load participant data from Firebase
  useEffect(() => {
    const loadData = async () => {
      const snapshot = await get(ref(firebaseDb, `sessions/${sessionId}/participants`))
      if (snapshot.exists()) {
        const data = snapshot.val()
        const list: ParticipantSummary[] = Object.entries(data).map(([userId, val]: any) => ({
          userId,
          username: val.username,
          count: val.count || 0,
        }))
        list.sort((a, b) => b.count - a.count)
        setParticipants(list)
      }
    }
    loadData()
  }, [sessionId])

  // Load user's groups
  useEffect(() => {
    if (!user) return
    const loadGroups = async () => {
      const { data } = await supabase
        .from("group_members")
        .select("groups(id, name)")
        .eq("user_id", user.id)
      if (data) {
        const g = data.map((m: any) => Array.isArray(m.groups) ? m.groups[0] : m.groups).filter(Boolean)
        setUserGroups(g)
      }
    }
    loadGroups()
  }, [user])

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const toggleGroup = (gId: string) => {
    setSelectedGroups(prev => prev.includes(gId) ? prev.filter(id => id !== gId) : [...prev, gId])
  }

  const handleConfirm = async () => {
    if (!user || !profile) return
    setSaving(true)

    try {
      const myData = participants.find(p => p.userId === user.id)
      const myCount = myData?.count || 0
      const totalParticipants = participants.length

      // 1. Upload photo if provided
      let photoUrl: string | null = null
      if (photo) {
        const fileExt = photo.name.split('.').pop()
        const fileName = `${user.id}-session-${Date.now()}.${fileExt}`
        const filePath = `activity_logs/${fileName}`
        const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, photo)
        if (!uploadError) photoUrl = filePath
      }

      // 2. Create activity log(s) based on visibility
      const xpEarned = Math.max(myCount * 5, 5) * Math.min(totalParticipants, 5) // Scale with party size, cap at 5x

      if (visibility === 'public' || visibility === 'private') {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          category: 'drink',
          item_name: `Drinking Session${totalParticipants > 1 ? ` (${totalParticipants} people)` : ''}`,
          quantity: myCount,
          xp_earned: xpEarned,
          photo_url: photoUrl,
          privacy_level: visibility,
          group_id: null,
        })
      } else if (visibility === 'groups' && selectedGroups.length > 0) {
        // Create one log per selected group
        for (const gId of selectedGroups) {
          await supabase.from('activity_logs').insert({
            user_id: user.id,
            category: 'drink',
            item_name: `Drinking Session${totalParticipants > 1 ? ` (${totalParticipants} people)` : ''}`,
            quantity: myCount,
            xp_earned: xpEarned,
            photo_url: photoUrl,
            privacy_level: 'groups',
            group_id: gId,
          })
        }
      }

      // 3. Update beer_counts for the day
      const today = new Date().toISOString().split('T')[0]
      await supabase.from("beer_counts").upsert({
        user_id: user.id, date: today, count: myCount, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,date' })

      // 4. Add XP
      await supabase.rpc('add_xp', { user_id_param: user.id, xp_to_add: xpEarned })
      await evaluateAndAwardBadges(user.id)

      // 5. End session in Supabase
      await supabase.from('drinking_sessions').update({
        status: 'ended', ended_at: new Date().toISOString()
      }).eq('id', sessionId)

      // 6. Finalize participant count in Supabase
      await supabase.from('session_participants').upsert({
        session_id: sessionId, user_id: user.id, drink_count: myCount
      }, { onConflict: 'session_id,user_id' })

      // 7. Clean up Firebase session data (after a delay so others can see the end)
      setTimeout(() => {
        remove(ref(firebaseDb, `sessions/${sessionId}`))
      }, 5000)

      // Show recap card instead of immediately navigating home
      setShowRecap(true)
    } catch (e: any) {
      alert("Error ending session: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  const myCount = participants.find(p => p.userId === user?.id)?.count || 0
  const totalDrinks = participants.reduce((sum, p) => sum + p.count, 0)

  // Recap card data
  const rankInfo = getRankInfo(profile?.level ?? 1, profile?.xp ?? 0)
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000))

  if (showRecap) {
    return (
      <SessionRecapCard
        participants={participants}
        sessionDate={new Date()}
        elapsedMinutes={elapsedMinutes}
        currentUserStreak={profile?.current_streak ?? 0}
        currentUserRank={rankInfo.current.title}
        currentUserRankEmoji={rankInfo.current.emoji}
        onClose={onDone}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end p-4 anim-fade" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-lg mx-auto space-y-5 anim-enter overflow-y-auto max-h-[85vh] p-6 rounded-[4px]" style={{ background: 'var(--bg-mid)', border: '1px solid var(--border)', boxShadow: '0 -16px 64px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Session Complete</h2>
          <button onClick={onClose} className="p-2 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-[4px] text-center" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(216,162,94,0.3)' }}>
            <p className="text-2xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>{myCount}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Your Drinks</p>
          </div>
          <div className="p-3 rounded-[4px] text-center" style={{ background: 'var(--acid-dim)', border: '1px solid rgba(204,255,0,0.3)' }}>
            <p className="text-2xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--acid)' }}>{totalDrinks}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Total</p>
          </div>
          <div className="p-3 rounded-[4px] text-center" style={{ background: 'var(--coral-dim)', border: '1px solid rgba(209,32,32,0.3)' }}>
            <p className="text-2xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--coral)' }}>{participants.length}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>People</p>
          </div>
        </div>

        {/* Participants Breakdown */}
        {participants.length > 1 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Final Scores</p>
            {participants.map((p, i) => (
              <div key={p.userId} className="flex items-center justify-between p-2.5 rounded-[4px]" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black" style={{ color: i === 0 ? 'var(--amber)' : 'var(--text-muted)' }}>#{i + 1}</span>
                  <span className="text-sm font-bold" style={{ color: p.userId === user?.id ? 'var(--amber)' : 'var(--text-primary)' }}>
                    {p.userId === user?.id ? 'You' : p.username}
                  </span>
                </div>
                <span className="font-black" style={{ color: 'var(--amber)' }}>{p.count} 🍺</span>
              </div>
            ))}
          </div>
        )}

        {/* Photo Upload (Optional) */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
            <Camera size={10} className="inline mr-1" /> Photo Proof (Optional)
          </p>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 rounded-[4px] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 overflow-hidden relative"
            style={{
              background: photoPreview ? `url(${photoPreview}) center/cover` : 'var(--bg-deep)',
              border: `1px ${photoPreview ? 'solid' : 'dashed'} var(--border-mid)`,
            }}
          >
            {photoPreview && <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />}
            {!photoPreview && <><Camera size={24} style={{ color: 'var(--text-muted)' }} /><span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Tap to add</span></>}
            {photoPreview && <span className="absolute bottom-3 text-[10px] font-bold text-white bg-black/50 px-3 py-1 rounded-full z-10">Retake</span>}
          </div>
          <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handlePhotoSelect} />
        </div>

        {/* Visibility Picker */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <Eye size={10} /> Visibility
          </p>
          <div className="grid grid-cols-3 gap-2">
            {VISIBILITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setVisibility(opt.value)}
                className="p-3 rounded-[4px] text-center transition-all active:scale-95"
                style={{
                  background: visibility === opt.value ? 'var(--amber-dim)' : 'var(--bg-deep)',
                  border: `1px solid ${visibility === opt.value ? 'rgba(216,162,94,0.4)' : 'var(--border-mid)'}`,
                  color: visibility === opt.value ? 'var(--amber)' : 'var(--text-muted)',
                }}
              >
                <opt.icon size={16} className="mx-auto mb-1" />
                <p className="text-[10px] font-black uppercase tracking-widest">{opt.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Group Selector (only if 'groups' visibility) */}
        {visibility === 'groups' && userGroups.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Share to Groups</p>
            {userGroups.map(g => (
              <button
                key={g.id}
                onClick={() => toggleGroup(g.id)}
                className="w-full flex items-center gap-3 p-3 rounded-[4px] transition-all active:scale-[0.98]"
                style={{
                  background: selectedGroups.includes(g.id) ? 'var(--acid-dim)' : 'var(--bg-deep)',
                  border: `1px solid ${selectedGroups.includes(g.id) ? 'rgba(204,255,0,0.3)' : 'var(--border-mid)'}`,
                }}
              >
                <div className="w-5 h-5 rounded-[2px] flex items-center justify-center" style={{
                  background: selectedGroups.includes(g.id) ? 'var(--acid)' : 'transparent',
                  border: selectedGroups.includes(g.id) ? 'none' : '2px solid var(--border-mid)',
                }}>
                  {selectedGroups.includes(g.id) && <span className="text-black text-[10px] font-black">✓</span>}
                </div>
                <span className="font-bold text-sm" style={{ color: selectedGroups.includes(g.id) ? 'var(--acid)' : 'var(--text-secondary)' }}>{g.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          disabled={saving || (visibility === 'groups' && selectedGroups.length === 0)}
          className="w-full py-4 rounded-[4px] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, var(--amber), #E8880A)', color: '#1A1208' }}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : "Confirm & Log Session"}
        </button>
      </div>
    </div>
  )
}
