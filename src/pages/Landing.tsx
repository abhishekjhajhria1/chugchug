import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"

export default function Landing() {
  const navigate = useNavigate()
  const { theme } = useTheme()

  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col justify-between transition-colors duration-500" style={{ background: 'var(--bg-deep)' }}>
      {/* Dynamic Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full mix-blend-screen opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle, var(--amber-dim), transparent 70%)' }}></div>
        <div className="absolute bottom-[10%] left-[-10%] w-[60%] h-[60%] rounded-full mix-blend-screen opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, var(--coral-dim), transparent 70%)' }}></div>
        
        {/* Simple drifting sakura / stars depending on theme */}
        <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: theme === 'light' ? 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M54.627 0l.83.83v58.34h-58.34l-.83-.83v-58.34h58.34zm-52.515 2.486v55.028h55.028v-55.028h-55.028z\' fill=\'%23d83c3c\' fill-opacity=\'0.4\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' : 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M54.627 0l.83.83v58.34h-58.34l-.83-.83v-58.34h58.34zm-52.515 2.486v55.028h55.028v-55.028h-55.028z\' fill=\'%23f4c47a\' fill-opacity=\'0.2\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")'
        }}></div>
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center max-w-2xl mx-auto w-full">
        
        {/* Emblem */}
        <div className="mb-8 relative anim-float">
          <div className="text-8xl drop-shadow-2xl">⛩️</div>
          <div className="absolute -inset-4 border border-dashed rounded-full animate-[spin_10s_linear_infinite]" style={{ borderColor: 'var(--amber)', opacity: 0.3 }} />
        </div>

        {/* Hero Copy */}
        <h1 className="text-5xl sm:text-6xl tracking-tighter mb-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
          CONQUER THE <br /> <span style={{ color: 'var(--amber)' }}>GRAND LINE.</span>
        </h1>
        
        <p className="text-base sm:text-lg mb-10 max-w-md font-medium leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          The ultimate companion for true warriors. Track your legendary feasts, gather your pirate crew, split expenses without bloodshed, and rise to the rank of Shogun.
        </p>

        {/* Action Button */}
        <button 
          onClick={() => navigate('/auth')}
          className="w-full sm:w-auto text-lg uppercase tracking-widest font-black py-4 px-10 rounded-lg shadow-2xl transition-all active:scale-95 group overflow-hidden relative"
          style={{ 
            background: 'linear-gradient(135deg, var(--coral), var(--coral-light))', 
            color: '#FFFFFF'
          }}
        >
           <span className="relative z-10 flex items-center justify-center gap-3">
             <span className="text-xl">🎌</span> JOIN THE CREW
           </span>
           <div className="absolute inset-0 bg-white/20 transform skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
        </button>

        {/* Quotes block */}
        <div className="mt-16 w-full opacity-80">
          <div className="flex gap-4 overflow-hidden border-t py-6" style={{ borderColor: 'var(--border-mid)' }}>
             <p className="text-xs sm:text-sm font-bold italic w-full text-center" style={{ color: 'var(--text-muted)' }}>
               "A man's dream will never die!" <br />
               <span className="text-[10px] uppercase not-italic tracking-widest" style={{ color: 'var(--amber)' }}>— The Golden Era</span>
             </p>
          </div>
        </div>
      </main>

    </div>
  )
}
