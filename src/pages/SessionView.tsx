import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useChug } from "../context/ChugContext"
import { supabase } from "../lib/supabase"
import { firebaseDb } from "../lib/firebase"
import { ref, set } from "firebase/database"
import DrinkingSession from "../components/DrinkingSession"
import EndSessionModal from "../components/EndSessionModal"
import { Loader2, ArrowLeft } from "lucide-react"

export default function SessionView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useChug()

  const [sessionData, setSessionData] = useState<{
    id: string; joinCode: string; groupId: string | null; creatorId: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEnd, setShowEnd] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id || !user) return
    const loadSession = async () => {
      setLoading(true)

      // Try loading by session ID
      const { data, error: fetchError } = await supabase
        .from("drinking_sessions")
        .select("id, join_code, group_id, creator_id, status")
        .eq("id", id)
        .single()

      if (fetchError || !data) {
        // Maybe it's a join code?
        const { data: byCode } = await supabase
          .from("drinking_sessions")
          .select("id, join_code, group_id, creator_id, status")
          .eq("join_code", id.toUpperCase())
          .eq("status", "active")
          .single()

        if (!byCode) {
          setError("Session not found or has ended.")
          setLoading(false)
          return
        }

        setSessionData({ id: byCode.id, joinCode: byCode.join_code, groupId: byCode.group_id, creatorId: byCode.creator_id })
        await joinSession(byCode.id)
        setLoading(false)
        return
      }

      if (data.status === 'ended') {
        setError("This session has already ended.")
        setLoading(false)
        return
      }

      setSessionData({ id: data.id, joinCode: data.join_code, groupId: data.group_id, creatorId: data.creator_id })
      await joinSession(data.id)
      setLoading(false)
    }

    loadSession()
  }, [id, user])

  const joinSession = async (sessionId: string) => {
    if (!user || !profile) return

    // Add participant to Supabase
    await supabase.from("session_participants").upsert({
      session_id: sessionId,
      user_id: user.id,
      drink_count: 0,
    }, { onConflict: 'session_id,user_id' })

    // Register in Firebase
    set(ref(firebaseDb, `sessions/${sessionId}/participants/${user.id}`), {
      count: 0,
      username: profile.username,
      updatedAt: Date.now(),
    })
  }

  const handleEndSession = () => {
    setShowEnd(true)
  }

  const handleSessionDone = () => {
    setShowEnd(false)
    navigate('/')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--amber)' }} />
        <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Connecting to session...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 text-center pt-16">
        <div className="text-6xl mb-4">🍺</div>
        <h1 className="text-2xl font-black uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Session Over</h1>
        <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button onClick={() => navigate('/')} className="mx-auto flex items-center gap-2 px-6 py-3 rounded-[4px] font-bold text-sm" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-mid)' }}>
          <ArrowLeft size={16} /> Go Home
        </button>
      </div>
    )
  }

  if (!sessionData) return null

  return (
    <div className="max-w-lg mx-auto pb-24 space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={16} /> Back
      </button>

      <DrinkingSession
        sessionId={sessionData.id}
        joinCode={sessionData.joinCode}
        groupId={sessionData.groupId}
        onEnd={handleEndSession}
      />

      {showEnd && (
        <EndSessionModal
          sessionId={sessionData.id}
          groupId={sessionData.groupId}
          onClose={() => setShowEnd(false)}
          onDone={handleSessionDone}
        />
      )}
    </div>
  )
}
