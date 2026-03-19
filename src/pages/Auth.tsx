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
      if (!username.trim()) { setError("Username is required"); setLoading(false); return }
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
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ background: 'var(--scene-bg)' }}
    >
      {/* Ambient light mesh */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse 60% 40% at 20% 15%, rgba(93,228,255,0.07) 0%, transparent 70%),
          radial-gradient(ellipse 50% 45% at 80% 80%, rgba(167,139,250,0.06) 0%, transparent 70%),
          radial-gradient(ellipse 30% 30% at 60% 50%, rgba(244,114,182,0.04) 0%, transparent 70%)
        `,
        animation: 'sceneDrift 25s ease-in-out infinite alternate',
      }} />

      {/* Floating orbs — only 3, tasteful */}
      {[
        { w: 200, top: '8%', left: '10%', dur: '22s', del: '0s', bg: 'rgba(93,228,255,0.05)' },
        { w: 140, top: '70%', right: '5%', dur: '18s', del: '-5s', bg: 'rgba(167,139,250,0.04)' },
        { w: 100, top: '85%', left: '30%', dur: '20s', del: '-10s', bg: 'rgba(244,114,182,0.03)' },
      ].map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.w, height: orb.w,
            top: orb.top, left: orb.left, right: (orb as any).right,
            background: `radial-gradient(circle at 30% 30%, ${orb.bg}, transparent 70%)`,
            border: '1px solid rgba(255,255,255,0.02)',
            animation: `orbFloat ${orb.dur} ease-in-out infinite`,
            animationDelay: orb.del,
          }}
        />
      ))}

      {/* Noise overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        opacity: 0.02,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '256px 256px',
      }} />

      {/* Login Card */}
      <div
        className="relative w-full max-w-sm anim-enter"
        style={{
          background: 'rgba(255,255,255,0.035)',
          backdropFilter: 'blur(24px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderTopColor: 'rgba(255,255,255,0.18)',
          borderLeftColor: 'rgba(255,255,255,0.14)',
          borderRadius: '28px',
          padding: '44px 32px 36px',
          boxShadow: `
            0 8px 40px rgba(0,0,0,0.45),
            0 2px 8px rgba(0,0,0,0.30),
            inset 0 1px 0 rgba(255,255,255,0.07),
            inset 0 -1px 0 rgba(0,0,0,0.10)
          `,
        }}
      >
        {/* Caustic shimmer */}
        <div className="absolute inset-0 rounded-[28px] overflow-hidden pointer-events-none">
          <div style={{
            position: 'absolute', top: 0, left: '-120%', width: '60%', height: '100%',
            background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.04) 42%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 58%, transparent 80%)',
            animation: 'caustic 10s ease-in-out infinite',
          }} />
        </div>

        {/* Condensation drops — subtle, at top edge */}
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[28px] overflow-hidden pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent 10%, rgba(93,228,255,0.15) 30%, rgba(167,139,250,0.12) 60%, transparent 90%)' }}
        />

        {/* Title */}
        <div className="relative text-center mb-8">
          <h1
            className="text-4xl font-black tracking-tight mb-2"
            style={{
              fontFamily: 'Outfit, sans-serif',
              background: 'linear-gradient(135deg, var(--accent-aqua) 0%, var(--accent-violet) 45%, var(--accent-rose) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 2px 8px rgba(167,139,250,0.25))',
            }}
          >
            CHUGCHUG
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>
            Pour yourself in
          </p>
        </div>

        {/* Form */}
        <div className="relative space-y-4">
          {!isLogin && (
            <div className="anim-slide">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
                Username
              </label>
              <input
                type="text"
                placeholder="Pick a name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="glass-input"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
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
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
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
            <div className="anim-slide rounded-xl px-4 py-3" style={{
              background: 'rgba(244,114,182,0.08)',
              border: '1px solid rgba(244,114,182,0.20)',
            }}>
              <p className="text-sm font-medium" style={{ color: 'var(--accent-rose)' }}>
                {error}
              </p>
            </div>
          )}

          <button
            onClick={handleAuth}
            disabled={loading}
            className="glass-btn w-full mt-2"
          >
            {loading ? "Verifying..." : isLogin ? "Sign in" : "Create account"}
          </button>

          <button
            onClick={() => { setIsLogin(!isLogin); setError("") }}
            className="glass-btn-secondary w-full"
          >
            {isLogin ? "Create an account" : "I already have an account"}
          </button>
        </div>

        {/* Bottom brand line */}
        <p className="text-center text-xs mt-8 font-medium" style={{ color: 'var(--text-ghost)' }}>
          Built different. 🧊
        </p>
      </div>
    </div>
  )
}
