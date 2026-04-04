import { useState } from "react"
import { supabase } from "../lib/supabase"

export default function Auth() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleAuth = async () => {
    setLoading(true)
    setError("")

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      if (!username.trim()) { setError("Pick a username to get started!"); setLoading(false); return }
      if (password.length < 6) { setError("Password must be at least 6 characters."); setLoading(false); return }
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message) }
      else if (data.user) {
        await supabase.from("profiles").upsert({ id: data.user.id, username, xp: 0, level: 1 })
      }
    }

    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center p-5"
      style={{ background: 'var(--bg-deep)' }}
    >
      {/* Background glow — amber */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse 60% 50% at 50% 0%, rgba(245,166,35,0.07) 0%, transparent 70%),
          radial-gradient(ellipse 40% 40% at 20% 100%, rgba(204,255,0,0.04) 0%, transparent 70%)
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
          borderTopColor: 'rgba(245,166,35,0.25)',
          borderRadius: 24,
          padding: '36px 28px 32px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
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
                className="glass-input"
              />
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
              className="rounded-xl px-4 py-3 anim-slide"
              style={{
                background: 'var(--coral-dim)',
                border: '1px solid rgba(255,107,107,0.25)',
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
