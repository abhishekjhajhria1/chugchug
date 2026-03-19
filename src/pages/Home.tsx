import { useState, useEffect, useRef } from "react"
import { Trophy, Medal, UtensilsCrossed, Globe, Users, MapPin, Plus, Send, Loader2, Sparkles, Wine, Beer, Coffee, QrCode } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { useNavigate } from "react-router-dom"
import BeerCounter from "../components/BeerCounter"
import QRCodeModal from "../components/QRCodeModal"

interface RankUser { id: string; username: string; xp: number }
interface Badge { id: string; name: string; icon_text: string }
interface Recipe { id: string; item_name: string; category: string; xp_earned: number }

export default function Home() {
  const { user } = useChug()
  const navigate = useNavigate()

  const [rankScope, setRankScope] = useState<'global' | 'group' | 'regional'>('global')
  const [ranks, setRanks] = useState<RankUser[]>([])
  const [badges, setBadges] = useState<Badge[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)

  const [chatPrompt, setChatPrompt] = useState('')
  const [chatReply, setChatReply] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [referencedRecipes, setReferencedRecipes] = useState<string[]>([])
  const [chatError, setChatError] = useState('')
  const responseRef = useRef<HTMLDivElement>(null)
  const BARTENDER_API = 'http://127.0.0.1:8001'

  const quickPrompts = [
    { label: '🥃 Whiskey', prompt: 'What can I make with whiskey?' },
    { label: '🍸 Gin', prompt: 'Recommend me a gin cocktail' },
    { label: '🥂 Rum', prompt: 'I have rum, what should I make?' },
    { label: '☕ Coffee', prompt: 'Any coffee-based drink recipes?' },
    { label: '🍺 Beer', prompt: 'What beer cocktails can I make?' },
    { label: '🍋 Citrus', prompt: 'I have lime and lemon, suggest a drink' },
  ]

  const handleChatSend = async (prompt?: string) => {
    const finalPrompt = prompt || chatPrompt
    if (!finalPrompt.trim()) return
    setChatLoading(true); setChatReply(''); setChatError(''); setReferencedRecipes([])
    try {
      const res = await fetch(`${BARTENDER_API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: finalPrompt }) })
      if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.detail || `Server error (${res.status})`) }
      const data = await res.json()
      setChatReply(data.reply || 'Hmm, I got nothing.'); setReferencedRecipes(data.recipes_referenced || []); setChatPrompt('')
      setTimeout(() => responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    } catch (err) {
      setChatError(err instanceof TypeError && err.message === 'Failed to fetch'
        ? 'Cannot connect to the bartender server.'
        : err instanceof Error ? err.message : 'Something went wrong.')
    } finally { setChatLoading(false) }
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      try {
        const [{ data: rk }, { data: bd }, { data: rd }] = await Promise.all([
          supabase.from("profiles").select("id, username, xp").order("xp", { ascending: false }).limit(5),
          supabase.from("user_badges").select("badges ( id, name, icon_text )").eq("user_id", user.id),
          supabase.from("activity_logs").select("id, item_name, category, xp_earned, photo_metadata").in('category', ['snack', 'drink']).order("xp_earned", { ascending: false }).limit(20)
        ])
        if (rk) setRanks(rk as RankUser[])
        if (bd) { setBadges(bd.flatMap((b: any) => b.badges).filter(Boolean) as Badge[]) }
        if (rd) {
          const uniq: Recipe[] = []; const names = new Set<string>()
          for (const r of rd) { if (r.photo_metadata?.is_recipe && !names.has(r.item_name)) { names.add(r.item_name); uniq.push(r as Recipe) } }
          setRecipes(uniq.slice(0, 5))
        }
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    fetchData()
  }, [user])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
        <div className="text-4xl anim-float">🧊</div>
        <p className="font-semibold text-sm" style={{ color: 'var(--text-dim)' }}>Loading Dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <h1 className="text-3xl font-black anim-enter" style={{ fontFamily: 'Outfit, sans-serif' }}>
        Dashboard
      </h1>

      {/* Beer Counter Widget */}
      <BeerCounter />

      {/* Connect QR Modal */}
      {showQR && (
        <QRCodeModal
          isOpen={showQR}
          onClose={() => setShowQR(false)}
          mode="display"
          data={`${window.location.origin}/connect/${user?.id}`}
          title="Your ChugCode"
          subtitle="Let someone scan this to become session friends"
        />
      )}

      {/* Quick Actions */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x -mx-5 px-5">
        {[
          { label: 'Connect', icon: <QrCode size={16} />, accent: 'var(--accent-violet)', onClick: () => setShowQR(true) },
          { label: 'My Badges', icon: <Medal size={16} />, accent: 'var(--accent-mint)', onClick: () => { const el = document.getElementById("badges-section"); if (el) el.scrollIntoView({ behavior: 'smooth' }); else navigate('/profile') } },
          { label: 'Balances', icon: <Trophy size={16} />, accent: 'var(--accent-gold)', onClick: () => navigate('/groups') },
          { label: 'Party Hub', icon: <Globe size={16} />, accent: 'var(--accent-rose)', onClick: () => navigate('/party') },
        ].map((a, i) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="snap-start shrink-0 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2 active:scale-95 anim-enter"
            style={{
              background: 'var(--glass-fill)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--glass-edge)',
              borderTopColor: 'var(--glass-edge-lit)',
              color: 'var(--text-normal)',
              animationDelay: `${i * 0.05}s`,
            }}
          >
            <span style={{ color: a.accent }}>{a.icon}</span> {a.label}
          </button>
        ))}
      </div>

      {/* Rankings */}
      <section className="glass-card glow-gold">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy size={20} className="accent-gold" /> Rankings
          </h2>
          <div className="flex rounded-lg overflow-hidden" style={{ background: 'var(--glass-fill-inset)', border: '1px solid var(--glass-edge)' }}>
            {([['global', Globe, 'var(--accent-gold)'], ['group', Users, 'var(--accent-mint)'], ['regional', MapPin, 'var(--accent-rose)']] as const).map(([scope, Icon, color]) => (
              <button
                key={scope}
                onClick={() => setRankScope(scope)}
                className="p-2 transition-all duration-200"
                style={{
                  background: rankScope === scope ? `color-mix(in srgb, ${color} 15%, transparent)` : 'transparent',
                  color: rankScope === scope ? color : 'var(--text-ghost)',
                }}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {ranks.length === 0 ? (
            <p className="text-center py-6 font-medium" style={{ color: 'var(--text-ghost)' }}>No rankings yet.</p>
          ) : ranks.map((r, i) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-xl p-3 transition-all duration-200 hover:bg-white/5 anim-slide"
              style={{
                background: 'var(--glass-fill)',
                border: '1px solid var(--glass-edge)',
                animationDelay: `${i * 0.05}s`,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
                  style={{
                    background: i === 0 ? 'rgba(251,191,36,0.25)' : i === 1 ? 'rgba(200,200,200,0.15)' : i === 2 ? 'rgba(205,127,50,0.20)' : 'rgba(110,231,183,0.12)',
                    border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-bright)',
                  }}
                >
                  {i + 1}
                </div>
                <span className="font-semibold">{r.username}</span>
              </div>
              <span className="font-bold accent-rose">{r.xp} XP</span>
            </div>
          ))}
        </div>
      </section>

      {/* Badges */}
      <section id="badges-section" className="glass-card glow-mint">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Medal size={20} className="accent-mint" /> Your Badges
        </h2>
        {badges.length === 0 ? (
          <div className="text-center py-6 rounded-xl" style={{ background: 'var(--glass-fill-inset)', border: '1px dashed var(--glass-edge)' }}>
            <p className="font-medium mb-3" style={{ color: 'var(--text-dim)' }}>No badges earned yet</p>
            <button onClick={() => navigate('/log')} className="glass-btn-secondary text-sm"><Plus size={14} /> Complete Activities</button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {badges.map((b, i) => (
              <div key={b.id} className="flex flex-col items-center gap-2 anim-pop" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                  style={{
                    background: 'var(--glass-fill-elevated)',
                    border: '1px solid var(--glass-edge-lit)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.20)',
                    animation: `float ${3 + i * 0.4}s ease-in-out infinite`,
                  }}
                >{b.icon_text}</div>
                <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: 'var(--text-dim)' }}>{b.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recipes */}
      <section className="glass-card glow-rose">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <UtensilsCrossed size={20} className="accent-rose" /> Top Recipes
        </h2>
        {recipes.length === 0 ? (
          <div className="text-center py-6"><p className="font-medium" style={{ color: 'var(--text-dim)' }}>No recipes logged yet.</p></div>
        ) : (
          <div className="space-y-2">
            {recipes.map((r, i) => (
              <div key={r.id} className="rounded-xl p-3 flex justify-between items-center transition-all duration-200 hover:bg-white/5 anim-slide"
                style={{ background: 'var(--glass-fill)', border: '1px solid var(--glass-edge)', animationDelay: `${i * 0.05}s` }}
              >
                <div>
                  <p className="font-bold leading-none mb-0.5">{r.item_name}</p>
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>{r.category}</p>
                </div>
                <span className="px-3 py-1 rounded-full font-bold text-xs"
                  style={{ background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.25)', color: 'var(--accent-mint)' }}
                >⭐ {r.xp_earned}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* AI Bartender */}
      <section className="glass-card glow-violet relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(244,114,182,0.04), rgba(93,228,255,0.03))' }}
      >
        <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.04] text-[90px] leading-none pointer-events-none select-none anim-float">🍹</div>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(167,139,250,0.20), rgba(244,114,182,0.15))',
              border: '1px solid rgba(167,139,250,0.25)',
              boxShadow: '0 0 16px rgba(167,139,250,0.12)',
            }}>🍸</div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              God of Tits and Wine <Sparkles size={14} className="accent-gold anim-glow" />
            </h2>
            <p className="text-xs font-medium" style={{ color: 'var(--text-ghost)' }}>Tell me what you have, I'll mix magic</p>
          </div>
        </div>

        {/* Quick Prompts */}
        <div className="flex flex-wrap gap-2 mb-4">
          {quickPrompts.map((qp) => (
            <button key={qp.label} onClick={() => { setChatPrompt(qp.prompt); handleChatSend(qp.prompt) }}
              disabled={chatLoading} className="glass-chip disabled:opacity-30 disabled:cursor-not-allowed text-[11px]">{qp.label}</button>
          ))}
        </div>

        {/* Chat Input */}
        <div className="flex gap-2 mb-4">
          <input type="text" value={chatPrompt} onChange={(e) => setChatPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !chatLoading && handleChatSend()}
            placeholder='"I have rum and lime..." or "Make me something strong"'
            className="glass-input flex-1 text-sm py-3" disabled={chatLoading} />
          <button onClick={() => handleChatSend()} disabled={chatLoading || !chatPrompt.trim()}
            className="glass-btn px-4 min-w-[48px] disabled:opacity-30 disabled:cursor-not-allowed" style={{ padding: '12px 16px' }}>
            {chatLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>

        {/* Loading */}
        {chatLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="text-4xl" style={{ animation: 'shaker 0.5s ease-in-out infinite' }}>🍹</div>
            <p className="font-semibold text-xs uppercase tracking-wider anim-glow" style={{ color: 'var(--text-dim)' }}>Mixing your drink...</p>
          </div>
        )}

        {/* Error */}
        {chatError && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.20)' }}>
            <p className="font-medium text-sm accent-rose">⚠️ {chatError}</p>
          </div>
        )}

        {/* Response */}
        {chatReply && !chatLoading && (
          <div ref={responseRef} className="anim-slide">
            <div className="rounded-2xl p-5" style={{
              background: 'var(--glass-fill-elevated)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(167,139,250,0.20)', boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🍸</span>
                <span className="font-bold uppercase text-[10px] tracking-widest accent-violet">Bartender Says</span>
              </div>
              <div className="text-sm leading-relaxed font-medium whitespace-pre-wrap">{chatReply}</div>
              {referencedRecipes.length > 0 && (
                <div className="mt-4 pt-3" style={{ borderTop: '1px dashed var(--glass-edge)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: 'var(--text-ghost)' }}>
                    <Wine size={10} /> Based on
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {referencedRecipes.map(name => (
                      <span key={name} className="glass-chip text-[10px]" style={{ color: 'var(--accent-violet)', borderColor: 'rgba(167,139,250,0.25)' }}>
                        <Coffee size={10} /> {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!chatReply && !chatLoading && !chatError && (
          <div className="text-center py-6">
            <div className="flex justify-center gap-3 mb-3 text-2xl">
              {['🥃', '🍷', '🍺', '☕'].map((e, i) => (
                <span key={e} className="anim-float" style={{ animationDelay: `${i * 0.3}s` }}>{e}</span>
              ))}
            </div>
            <p className="font-medium text-sm" style={{ color: 'var(--text-dim)' }}>
              Long Live Lord Tyrion Lannister, the God of Tits and Wine
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Beer size={11} className="accent-gold" />
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-ghost)' }}>Powered by AI · No chat history saved</p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}