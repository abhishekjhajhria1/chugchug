import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { useParams, useNavigate } from "react-router-dom"
import { UserPlus, X, User } from "lucide-react"

export default function ConnectPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useChug()
  const navigate = useNavigate()
  const [targetUser, setTargetUser] = useState<{ username: string; xp: number; level: number } | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'connected' | 'error' | 'self'>('loading')
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id || !user) return

    if (id === user.id) {
      setStatus('self')
      return
    }

    const load = async () => {
      const { data } = await supabase.from("profiles").select("username, xp, level").eq("id", id).single()
      if (data) {
        setTargetUser(data)
        setStatus('ready')
      } else {
        setError("User not found")
        setStatus('error')
      }
    }
    load()
  }, [id, user])

  const handleConnect = async () => {
    if (!user || !id) return
    setStatus('loading')

    const { error: err } = await supabase.from("session_friends").insert({
      user_a: user.id,
      user_b: id,
    })

    if (err) {
      if (err.message.includes('duplicate') || err.message.includes('unique')) {
        setStatus('connected')
      } else {
        setError(err.message)
        setStatus('error')
      }
    } else {
      setStatus('connected')
    }
  }

  return (
    <main role="main" className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      {status === 'loading' && (
        <div className="text-center" aria-live="polite">
          <div className="text-4xl mb-3 anim-float">🤝</div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-dim)' }}>Loading...</p>
        </div>
      )}

      {status === 'self' && (
        <div className="glass-card text-center max-w-sm w-full anim-pop">
          <div className="text-5xl mb-4">🪞</div>
          <h2 className="text-xl font-bold mb-2">That's you!</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>You can't connect with yourself. Share your QR with someone else!</p>
          <button onClick={() => navigate('/')} className="glass-btn w-full">Back to Home</button>
        </div>
      )}

      {status === 'ready' && targetUser && (
        <div className="glass-card glow-violet text-center max-w-sm w-full anim-pop">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.20), rgba(93,228,255,0.10))', border: '1px solid rgba(167,139,250,0.25)' }}>
            <User size={28} className="accent-violet" />
          </div>

          <h2 className="text-2xl font-bold mb-1">{targetUser.username}</h2>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-dim)' }}>
            Level {targetUser.level} · {targetUser.xp} XP
          </p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-ghost)' }}>
            Wants to be your session friend for 24 hours
          </p>

          <div className="flex gap-3">
            <button onClick={handleConnect} className="glass-btn flex-1 flex items-center justify-center gap-2">
              <UserPlus size={16} /> Connect
            </button>
            <button onClick={() => navigate('/')} className="glass-btn-secondary flex-1 flex items-center justify-center gap-2">
              <X size={16} /> Decline
            </button>
          </div>
        </div>
      )}

      {status === 'connected' && (
        <div className="glass-card glow-mint text-center max-w-sm w-full anim-pop" aria-live="polite">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold mb-2 accent-mint">Connected!</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>
            You and {targetUser?.username || 'them'} are now session friends for 24 hours.
          </p>
          <button onClick={() => navigate('/')} className="glass-btn w-full">Go to Dashboard</button>
        </div>
      )}

      {status === 'error' && (
        <div className="glass-card text-center max-w-sm w-full anim-pop" aria-live="assertive">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold mb-2 accent-rose">Oops</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>{error}</p>
          <button onClick={() => navigate('/')} className="glass-btn w-full">Back to Home</button>
        </div>
      )}
    </main>
  )
}
