import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { Trophy, Flame, Sparkles, BookHeart, Compass, Share2, ArrowRight, Check } from "lucide-react"

export default function Landing() {
  const navigate = useNavigate()
  const [entered, setEntered] = useState(false)
  useEffect(() => { const t = setTimeout(() => setEntered(true), 60); return () => clearTimeout(t) }, [])

  const go = () => navigate("/auth")
  const rise = (delay: number) => ({
    opacity: entered ? 1 : 0,
    transform: entered ? "none" : "translateY(18px)",
    transition: `all 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
  })

  const features = [
    { icon: Trophy, color: "var(--amber)", title: "Weekly friends league", desc: "Out-rank your crew every week. Climb tiers and chase your rivals." },
    { icon: Flame, color: "var(--coral)", title: "Streaks & daily rewards", desc: "Show up, claim your reward, keep the chain alive. Miss a day? Use a freeze." },
    { icon: Sparkles, color: "var(--amber)", title: "Ninkasi, your AI bartender", desc: "Recipes, pairings and recommendations — right when you need them." },
    { icon: BookHeart, color: "var(--coral)", title: "Track every night", desc: "Every drink and session, logged into your own story and calendar." },
    { icon: Compass, color: "var(--acid)", title: "Find your bar", desc: "A built-in compass points you to the nearest bar and loyalty perks." },
    { icon: Share2, color: "var(--blue)", title: "Flex your stats", desc: "Share clean stat cards of your streaks and wins. Bring your friends in." },
  ]

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: "var(--bg-deep)" }}>
      {/* Ambient backdrop */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute" style={{ top: "-15%", right: "-12%", width: "60%", height: "55%", borderRadius: "50%", background: "radial-gradient(circle, color-mix(in srgb, var(--amber) 14%, transparent), transparent 65%)", filter: "blur(60px)" }} />
        <div className="absolute" style={{ bottom: "-5%", left: "-15%", width: "55%", height: "55%", borderRadius: "50%", background: "radial-gradient(circle, color-mix(in srgb, var(--coral) 10%, transparent), transparent 62%)", filter: "blur(60px)" }} />
      </div>

      {/* Top bar */}
      <header className="relative z-20 flex items-center justify-between px-5 py-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍻</span>
          <span className="font-extrabold tracking-tight" style={{ fontFamily: "Syne, sans-serif", fontSize: 19, color: "var(--text-primary)" }}>ChugChug</span>
        </div>
        <button onClick={go} className="text-sm font-bold px-4 py-2 rounded-full active:scale-95 transition-transform" style={{ color: "var(--text-secondary)" }}>
          Sign in
        </button>
      </header>

      <main className="relative z-10 px-5 pb-16 max-w-2xl mx-auto">
        {/* ── HERO ── */}
        <section className="pt-8 sm:pt-14 text-center">
          <div style={rise(0)} className="mb-6">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full" style={{ background: "var(--amber-dim)", border: "1px solid color-mix(in srgb, var(--amber) 22%, transparent)" }}>
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "var(--coral)" }} /><span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--coral)" }} /></span>
              <span className="text-xs font-bold" style={{ color: "var(--amber)" }}>Free to start · 18+</span>
            </span>
          </div>

          <h1 style={{ ...rise(0.08), fontFamily: "Syne, sans-serif", fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.04em", color: "var(--text-primary)" }} className="text-4xl sm:text-6xl mb-4">
            Your drinks.<br />Your crew.<br /><span style={{ color: "var(--amber)" }}>Your leaderboard.</span>
          </h1>

          <p style={{ ...rise(0.16), color: "var(--text-secondary)" }} className="text-base sm:text-lg leading-relaxed max-w-md mx-auto mb-8">
            Track every round, keep your streak alive, and out-rank your friends every week — with Ninkasi, your AI bartender, in your pocket.
          </p>

          <div style={rise(0.24)} className="flex flex-col items-center gap-3">
            <button onClick={go} className="glass-btn w-full sm:w-auto" style={{ fontSize: 16, padding: "16px 40px" }}>
              Get started <ArrowRight size={18} />
            </button>
            <div className="flex items-center gap-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1"><Check size={13} style={{ color: "var(--acid)" }} /> No card needed</span>
              <span className="flex items-center gap-1"><Check size={13} style={{ color: "var(--acid)" }} /> Light & dark</span>
            </div>
          </div>
        </section>

        {/* ── LEADERBOARD PEEK ── */}
        <section style={rise(0.32)} className="mt-12">
          <div className="relative mx-auto max-w-xs">
            <div className="glass-card" style={{ padding: 18 }}>
              <p className="section-label flex items-center gap-1.5 mb-3"><Trophy size={13} style={{ color: "var(--amber)" }} /> Friends league · this week</p>
              {[
                { r: "🥇", n: "You", xp: 480, me: true },
                { r: "🥈", n: "Rohan", xp: 440, me: false },
                { r: "🥉", n: "Aisha", xp: 395, me: false },
              ].map(p => (
                <div key={p.n} className="flex items-center gap-2 px-3 py-2 mb-1 rounded-xl" style={{ background: p.me ? "var(--amber-dim)" : "transparent" }}>
                  <span className="text-sm w-5 text-center">{p.r}</span>
                  <span className="text-sm font-bold flex-1" style={{ color: p.me ? "var(--amber)" : "var(--text-primary)" }}>{p.n}</span>
                  <span className="text-sm font-extrabold" style={{ color: "var(--text-secondary)" }}>{p.xp} XP</span>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <Flame size={15} style={{ color: "var(--coral)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>12-day streak · keep it alive</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="mt-16">
          <p className="text-center section-label mb-5">Everything for the night out</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {features.map((f, i) => (
              <div key={f.title} style={{ ...rise(0.36 + i * 0.05) }} className="glass-card flex items-start gap-3.5 text-left" >
                <div className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${f.color} 14%, transparent)` }}>
                  <f.icon size={19} style={{ color: f.color }} />
                </div>
                <div>
                  <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)", fontFamily: "Syne, sans-serif" }}>{f.title}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
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
              { t: "Sign up free", e: "🍻" },
              { t: "Log your night", e: "📲" },
              { t: "Climb the ranks", e: "🏆" },
            ].map(s => (
              <div key={s.t} className="glass-card" style={{ padding: 16 }}>
                <div className="text-2xl mb-1.5">{s.e}</div>
                <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{s.t}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="mt-16">
          <div className="text-center p-8 rounded-[20px]" style={{ background: "linear-gradient(135deg, var(--amber-dim), color-mix(in srgb, var(--coral) 8%, transparent))", border: "1px solid color-mix(in srgb, var(--amber) 20%, transparent)" }}>
            <h2 className="text-2xl sm:text-3xl mb-2" style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, color: "var(--text-primary)" }}>
              Ready to top the board?
            </h2>
            <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
              Your friends are already logging. Don't fall behind this week.
            </p>
            <button onClick={go} className="glass-btn w-full sm:w-auto" style={{ fontSize: 16, padding: "16px 44px" }}>
              Create your account <ArrowRight size={18} />
            </button>
          </div>
        </section>

        <footer className="mt-12 text-center">
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Please drink responsibly. You must be 18+ to use ChugChug.</p>
          <p className="text-[11px] mt-2" style={{ color: "var(--text-ghost)" }}>🍻 ChugChug — track · compete · party</p>
        </footer>
      </main>
    </div>
  )
}
