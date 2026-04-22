import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"

export default function Landing() {
  const navigate = useNavigate()
  const [entered, setEntered] = useState(false)

  // Stagger entrance
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 100)
    return () => clearTimeout(t)
  }, [])

  const features = [
    { emoji: "📜", title: "Log Everything", desc: "Drinks, meals, gym, detox — track it all and watch the XP stack up" },
    { emoji: "⚔️", title: "Challenges & Badges", desc: "24 unique challenges across drinking, wellness, social, and milestones" },
    { emoji: "🏮", title: "Crew Up", desc: "Build your squad, start live drinking sessions, split expenses" },
    { emoji: "🗺️", title: "Explore the World", desc: "See what everyone's drinking around the globe in real time" },
  ]

  const quotes = [
    { text: "I don't have a drinking problem. I have a drinking solution.", author: "Someone wise" },
    { text: "In wine there is wisdom, in beer there is freedom.", author: "Benjamin Franklin" },
    { text: "Here's to alcohol, the cause of — and solution to — all life's problems.", author: "Homer Simpson" },
  ]

  const [quoteIdx, setQuoteIdx] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setQuoteIdx(i => (i + 1) % quotes.length), 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: 'var(--bg-deep)' }}>
      {/* Background atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Warm ambient blobs */}
        <div className="absolute" style={{ top: '-15%', right: '-10%', width: '55%', height: '55%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(216,142,48,0.06), transparent 65%)', filter: 'blur(40px)' }} />
        <div className="absolute" style={{ bottom: '5%', left: '-15%', width: '50%', height: '50%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(209,32,32,0.04), transparent 60%)', filter: 'blur(40px)' }} />

        {/* Floating decorative elements */}
        <div className="absolute text-4xl opacity-[0.06]" style={{ top: '12%', left: '8%', animation: 'floatY 6s ease-in-out infinite' }}>⛩️</div>
        <div className="absolute text-3xl opacity-[0.05]" style={{ top: '35%', right: '12%', animation: 'floatY 8s ease-in-out 1s infinite' }}>🍶</div>
        <div className="absolute text-2xl opacity-[0.04]" style={{ bottom: '25%', left: '15%', animation: 'floatY 7s ease-in-out 2s infinite' }}>⚔️</div>
        <div className="absolute text-3xl opacity-[0.05]" style={{ top: '55%', right: '6%', animation: 'floatY 9s ease-in-out 0.5s infinite' }}>🌸</div>
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-dvh px-6 py-16 text-center max-w-lg mx-auto">

        {/* Emblem */}
        <div
          className="mb-10 relative"
          style={{
            opacity: entered ? 1 : 0,
            transform: entered ? 'none' : 'translateY(20px) scale(0.9)',
            transition: 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div className="text-8xl drop-shadow-2xl anim-float">⛩️</div>
          {/* Dashed orbit ring */}
          <div className="absolute -inset-5" style={{
            border: '1.5px dashed var(--amber)',
            borderRadius: '50%',
            opacity: 0.15,
            animation: 'spin 20s linear infinite',
          }} />
        </div>

        {/* Hero copy */}
        <div
          style={{
            opacity: entered ? 1 : 0,
            transform: entered ? 'none' : 'translateY(24px)',
            transition: 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.15s',
          }}
        >
          <h1
            className="text-5xl sm:text-6xl tracking-tighter mb-4"
            style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}
          >
            CONQUER THE <br /> <span style={{ color: 'var(--amber)' }}>GRAND LINE.</span>
          </h1>

          <p className="text-base sm:text-lg mb-10 max-w-md mx-auto font-medium leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            The ultimate drinking companion for true warriors. Track feasts, gather your crew, earn badges, and rise to the rank of Shogun.
          </p>
        </div>

        {/* CTA */}
        <div
          style={{
            opacity: entered ? 1 : 0,
            transform: entered ? 'none' : 'translateY(20px)',
            transition: 'all 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.3s',
          }}
        >
          <button
            onClick={() => navigate('/auth')}
            className="w-full sm:w-auto text-lg uppercase tracking-widest font-black py-4 px-12 shadow-2xl active:scale-95 transition-transform relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--coral), var(--coral-light, #F3485E))',
              color: '#FFFFFF',
              borderRadius: 'var(--card-radius)',
              border: 'none',
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              <span className="text-xl">🎌</span> JOIN THE CREW
            </span>
          </button>
        </div>

        {/* Feature cards */}
        <div className="w-full mt-14 space-y-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="flex items-start gap-3.5 p-4 text-left"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--card-radius)',
                opacity: entered ? 1 : 0,
                transform: entered ? 'none' : 'translateY(16px)',
                transition: `all 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${0.45 + i * 0.1}s`,
              }}
            >
              <div
                className="w-10 h-10 shrink-0 flex items-center justify-center text-xl"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-mid)', borderRadius: 'var(--card-radius)' }}
              >
                {f.emoji}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{f.title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Rotating quote */}
        <div
          className="mt-12 w-full pt-6"
          style={{
            borderTop: '1px solid var(--border-mid)',
            opacity: entered ? 1 : 0,
            transition: 'opacity 0.8s ease 0.9s',
          }}
        >
          <p className="text-sm font-bold italic" style={{ color: 'var(--text-muted)', transition: 'opacity 0.5s ease' }}>
            "{quotes[quoteIdx].text}"
          </p>
          <p className="text-[10px] uppercase tracking-widest mt-2 font-bold" style={{ color: 'var(--amber)' }}>
            — {quotes[quoteIdx].author}
          </p>
        </div>
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
