import { useState } from "react"
import { supabase } from "../lib/supabase"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { validateUsername } from "../utils/validation"
import { useToast } from "../components/Toast"

export default function Auth() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [dob, setDob] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()
  const toast = useToast()

  const LEGAL_AGE = 18 // bump to 21 for markets that require it
  const ageFrom = (d: string) => {
    const b = new Date(d), t = new Date()
    let a = t.getFullYear() - b.getFullYear()
    const m = t.getMonth() - b.getMonth()
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--
    return a
  }

  const handleAuth = async () => {
    setLoading(true)
    setError("")

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      // Validate username
      const usernameError = validateUsername(username)
      if (usernameError) { setError(usernameError); setLoading(false); return }
      if (password.length < 6) { setError("Password must be at least 6 characters."); setLoading(false); return }

      // ── Age gate (this is an alcohol app) ──
      if (!dob) { setError("Please enter your date of birth."); setLoading(false); return }
      const age = ageFrom(dob)
      if (Number.isNaN(age) || age < LEGAL_AGE) {
        setError(`You must be at least ${LEGAL_AGE} to use ChugChug.`)
        setLoading(false)
        return
      }

      // Username uniqueness is enforced server-side: the handle_new_user trigger
      // inserts the profile using this metadata username, and the profiles.username
      // UNIQUE constraint rejects duplicates (rolling back the whole signup). We
      // can't reliably pre-check from the client because RLS hides profiles from
      // the anon role — so we let the DB decide and map the error to a clear msg.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username.trim() } },
      })
      if (error) {
        const m = (error.message || "").toLowerCase()
        if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already"))
          setError("That email is already registered — try signing in instead.")
        else if (m.includes("database error") || m.includes("duplicate") || m.includes("unique") || m.includes("violates"))
          setError("That username is already taken. Pick another one!")
        else setError(error.message)
      } else if (data.user) {
        // Fill in the rest of the profile (the trigger only set id + username).
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ birth_date: dob, age_verified: true })
          .eq("id", data.user.id)
        if (profileError) toast.error("Account created — finish setting up your profile from the Me tab.")
      }
    }

    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center p-5 transition-colors duration-500"
      style={{ background: 'var(--bg-deep)' }}
    >
      <button 
        onClick={() => navigate('/')} 
        className="absolute top-6 left-6 p-2 rounded-full active:scale-95 transition-all outline-none"
        style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        aria-label="Go back"
      >
        <ArrowLeft size={20} />
      </button>

      {/* Background glow — amber */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse 60% 50% at 50% 0%, var(--amber-dim) 0%, transparent 70%),
          radial-gradient(ellipse 40% 40% at 20% 100%, var(--acid-dim) 0%, transparent 70%)
        `,
      }} />

      {/* Card */}
      <div
        className="relative w-full max-w-sm anim-enter"
        style={{
          background: 'var(--card-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border-mid)',
          borderTopColor: 'var(--amber-dim)',
          borderRadius: 'var(--card-radius)',
          padding: '36px 28px 32px',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-3">
            <span className="text-5xl">🍻</span>
          </div>
          <h1
            className="text-3xl tracking-tight mb-1"
            style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, color: 'var(--text-primary)' }}
          >
            ChugChug
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {isLogin ? "Welcome back! 🙌" : "Join the party — it's free 🎉"}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {!isLogin && (
            <div className="anim-slide">
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Username
              </label>
              <input
                type="text"
                placeholder="Pick something legendary"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                className="glass-input"
              />
              <p className="text-[10px] mt-1 font-bold" style={{ color: 'var(--text-ghost)' }}>3-20 chars, letters/numbers/underscores only</p>
            </div>
          )}

          {!isLogin && (
            <div className="anim-slide">
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Date of Birth
              </label>
              <input
                type="date"
                value={dob}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDob(e.target.value)}
                className="glass-input"
                style={{ colorScheme: 'inherit' }}
              />
              <p className="text-[10px] mt-1 font-bold" style={{ color: 'var(--text-ghost)' }}>🔞 You must be {LEGAL_AGE}+ to drink — and to use ChugChug</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              className="glass-input"
            />
          </div>

          {error && (
            <div
              className="px-4 py-3 anim-slide"
              style={{
                background: 'var(--coral-dim)',
                border: '1px solid rgba(255,107,107,0.25)',
                borderRadius: 'var(--card-radius)',
              }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--coral)' }}>
                ⚠️ {error}
              </p>
            </div>
          )}

          <button
            onClick={handleAuth}
            disabled={loading}
            className="glass-btn w-full mt-2"
            style={{ fontSize: 16, padding: '14px 24px' }}
          >
            {loading ? "Loading..." : isLogin ? "Sign In 🍺" : "Create Account 🎉"}
          </button>

          <button
            onClick={() => { setIsLogin(!isLogin); setError("") }}
            className="w-full py-3 text-sm font-bold transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--amber-light)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            {isLogin ? "Don't have an account? Sign up →" : "Already have one? Sign in →"}
          </button>
        </div>

        <p className="text-center text-xs mt-6 font-medium" style={{ color: 'var(--text-ghost)' }}>
          Track drinks · Compete · Discover · Party 🎊
        </p>
      </div>
    </div>
  )
}
