import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { Trophy, Flame, Sparkles, BookHeart, Compass, Share2, ArrowRight, Check } from "lucide-react"

export default function Landing() {
  const navigate = useNavigate()
  const [entered, setEntered] = useState(false)
  useEffect(() => { const t = setTimeout(() => setEntered(true), 80); return () => clearTimeout(t) }, [])

  const go = () => navigate("/auth")
  const rise = (delay: number) => ({
    opacity: entered ? 1 : 0,
    transform: entered ? "none" : "translateY(20px)",
    transition: `all 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
  })

  const features = [
    { icon: Trophy, color: "var(--amber)", title: "Weekly Friends League", desc: "Out-rank your crew every week. Climb tiers, chase rivals, win the week." },
    { icon: Flame, color: "var(--coral)", title: "Streaks & daily rewards", desc: "Show up, claim your reward, keep the chain alive. Miss a day? Use a freeze." },
    { icon: Sparkles, color: "var(--amber)", title: "Ninkasi, your AI bartender", desc: "Recipes, recommendations and a cheeky chat that actually gets you." },
    { icon: BookHeart, color: "var(--coral)", title: "Track & remember", desc: "Every drink, session and night out — logged into your own story." },
    { icon: Compass, color: "var(--acid)", title: "Find your tavern", desc: "A built-in compass points you to the nearest bar. Earn loyalty perks." },
    { icon: Share2, color: "var(--amber)", title: "Flex your stats", desc: "Share Strava-style cards of your streaks and wins. Bring your friends in." },
  ]

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: "var(--bg-deep)" }}>
      {/* Ambient backdrop */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute" style={{ top: "-15%", right: "-10%", width: "55%", height: "55%", borderRadius: "50%", background: "radial-gradient(circle, color-mix(in srgb, var(--amber) 8%, transparent), transparent 65%)", filter: "blur(50px)" }} />
        <div className="absolute" style={{ bottom: "0%", left: "-15%", width: "55%", height: "55%", borderRadius: "50%", background: "radial-gradient(circle, color-mix(in srgb, var(--coral) 6%, transparent), transparent 60%)", filter: "blur(50px)" }} />
      </div>

      {/* Top bar */}
      <header className="relative z-20 flex items-center justify-between px-5 py-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⛩️</span>
          <span className="font-black tracking-tight" style={{ fontFamily: "Syne, sans-serif", fontSize: 18, color: "var(--text-primary)" }}>ChugChug</span>
        </div>
        <button onClick={go} className="text-sm font-bold px-4 py-2 active:scale-95 transition-transform" style={{ color: "var(--text-secondary)" }}>
          Sign in
        </button>
      </header>

      <main className="relative z-10 px-5 pb-16 max-w-2xl mx-auto">
        {/* ── HERO ── */}
        <section className="pt-8 sm:pt-14 text-center">
          <div style={rise(0)} className="mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5" style={{ background: "var(--amber-dim)", borderRadius: "var(--pill-radius)", border: "1px solid color-mix(in srgb, var(--amber) 25%, transparent)" }}>
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "var(--coral)" }} /><span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--coral)" }} /></span>
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--amber)" }}>Free to start · 18+</span>
            </span>
          </div>

          <h1 style={{ ...rise(0.08), fontFamily: "Syne, sans-serif", fontWeight: 900, lineHeight: 1.05, color: "var(--text-primary)" }} className="text-4xl sm:text-6xl tracking-tighter mb-4">
            Your drinks.<br />Your crew.<br /><span style={{ color: "var(--amber)" }}>Your leaderboard.</span>
          </h1>

          <p style={{ ...rise(0.16), color: "var(--text-secondary)" }} className="text-base sm:text-lg font-medium leading-relaxed max-w-md mx-auto mb-8">
            Track every round, keep your streak alive, and out-rank your friends every week — with Ninkasi, your AI bartender, in your pocket.
          </p>

          <div style={rise(0.24)} className="flex flex-col items-center gap-3">
            <button onClick={go} className="glass-btn w-full sm:w-auto" style={{ fontSize: 17, padding: "16px 40px" }}>
              Start free <ArrowRight size={18} />
            </button>
            <div className="flex items-center gap-4 text-[11px] font-bold" style={{ color: "var(--text-ghost)" }}>
              <span className="flex items-center gap-1"><Check size={12} style={{ color: "var(--acid)" }} /> No card needed</span>
              <span className="flex items-center gap-1"><Check size={12} style={{ color: "var(--acid)" }} /> 6 themes</span>
            </div>
          </div>
        </section>

        {/* ── HERO VISUAL: a peek at the leaderboard ── */}
        <section style={rise(0.32)} className="mt-12">
          <div className="relative mx-auto max-w-xs">
            <div className="glass-card" style={{ borderLeft: "4px solid var(--amber)" }}>
              <p className="section-label flex items-center gap-1.5 mb-3"><Trophy size={12} /> Friends League · this week</p>
              {[
                { r: "🥇", n: "You", xp: 480, me: true },
                { r: "🥈", n: "Rohan", xp: 440, me: false },
                { r: "🥉", n: "Aisha", xp: 395, me: false },
              ].map(p => (
                <div key={p.n} className="flex items-center gap-2 px-2.5 py-1.5 mb-1" style={{ background: p.me ? "var(--amber-dim)" : "transparent", borderRadius: "calc(var(--card-radius) * 0.6)" }}>
                  <span className="text-xs w-5 text-center">{p.r}</span>
                  <span className="text-sm font-bold flex-1" style={{ color: p.me ? "var(--amber)" : "var(--text-primary)" }}>{p.n}</span>
                  <span className="text-xs font-black" style={{ color: "var(--text-secondary)" }}>{p.xp} XP</span>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                <Flame size={14} style={{ color: "var(--coral)" }} />
                <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>🔥 12-day streak · keep it alive</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="mt-16">
          <p className="text-center section-label mb-5">Everything for the night out</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                style={{ ...rise(0.4 + i * 0.06), background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--card-radius)" }}
                className="flex items-start gap-3.5 p-4 text-left"
              >
                <div className="w-10 h-10 shrink-0 flex items-center justify-center" style={{ background: `color-mix(in srgb, ${f.color} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${f.color} 25%, transparent)`, borderRadius: "var(--card-radius)" }}>
                  <f.icon size={18} style={{ color: f.color }} />
                </div>
                <div>
                  <p className="text-sm font-black" style={{ color: "var(--text-primary)", fontFamily: "Syne, sans-serif" }}>{f.title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="mt-16">
          <p className="text-center section-label mb-5">Up and running in seconds</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { n: "1", t: "Sign up free", e: "🍻" },
              { n: "2", t: "Log your night", e: "📲" },
              { n: "3", t: "Climb the ranks", e: "🏆" },
            ].map(s => (
              <div key={s.n} className="p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--card-radius)" }}>
                <div className="text-2xl mb-1.5">{s.e}</div>
                <p className="text-[11px] font-black" style={{ color: "var(--text-primary)" }}>{s.t}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="mt-16">
          <div className="relative overflow-hidden text-center p-8" style={{ background: "linear-gradient(135deg, var(--amber-dim), color-mix(in srgb, var(--coral) 8%, transparent))", border: "1px solid color-mix(in srgb, var(--amber) 25%, transparent)", borderRadius: "var(--card-radius)" }}>
            <h2 className="text-2xl sm:text-3xl tracking-tight mb-2" style={{ fontFamily: "Syne, sans-serif", fontWeight: 900, color: "var(--text-primary)" }}>
              Ready to top the board?
            </h2>
            <p className="text-sm font-medium mb-6 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
              Your friends are already logging. Don't fall behind this week.
            </p>
            <button onClick={go} className="glass-btn w-full sm:w-auto" style={{ fontSize: 17, padding: "16px 44px" }}>
              Create your account <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="text-[11px] font-bold" style={{ color: "var(--text-ghost)" }}>
            Please drink responsibly. You must be 18+ to use ChugChug.
          </p>
          <p className="text-[10px] mt-2" style={{ color: "var(--text-ghost)", opacity: 0.7 }}>
            ⛩️ ChugChug — track · compete · party
          </p>
        </footer>
      </main>
    </div>
  )
}
