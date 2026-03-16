import { useState, useEffect, useRef } from "react"
import { Trophy, Medal, UtensilsCrossed, Globe, Users, MapPin, Plus, Send, Loader2, Sparkles, Wine, Beer, Coffee } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { useNavigate } from "react-router-dom"

interface RankUser {
  id: string
  username: string
  xp: number
}

interface Badge {
  id: string
  name: string
  icon_text: string
}

interface Recipe {
  id: string
  item_name: string
  category: string
  xp_earned: number
}

export default function Home() {
  const { user } = useChug()
  const navigate = useNavigate()

  const [rankScope, setRankScope] = useState<'global' | 'group' | 'regional'>('global')
  const [ranks, setRanks] = useState<RankUser[]>([])
  const [badges, setBadges] = useState<Badge[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

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

    setChatLoading(true)
    setChatReply('')
    setChatError('')
    setReferencedRecipes([])

    try {
      const res = await fetch(`${BARTENDER_API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || `Server error (${res.status}). The AI model may still be loading — try again in a minute.`)
      }

      const data = await res.json()
      setChatReply(data.reply || 'Hmm, I got nothing. Try asking differently!')
      setReferencedRecipes(data.recipes_referenced || [])
      setChatPrompt('')

      setTimeout(() => {
        responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setChatError('Cannot connect to the bartender server. Make sure uvicorn is running on port 8000.')
      } else {
        setChatError(
          err instanceof Error ? err.message : 'Something went wrong. Try again!'
        )
      }
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        const [
          { data: rankData },
          { data: badgeData },
          { data: routeData }
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, xp")
            .order("xp", { ascending: false })
            .limit(5),
          supabase
            .from("user_badges")
            .select(`
              badges ( id, name, icon_text )
            `)
            .eq("user_id", user.id),
          supabase
            .from("activity_logs")
            .select("id, item_name, category, xp_earned, photo_metadata")
            .in('category', ['snack', 'drink'])
            .order("xp_earned", { ascending: false })
            .limit(20)
        ])

        if (rankData) setRanks(rankData as RankUser[])

        if (badgeData) {
          const userBadges = badgeData.flatMap((b: { badges: Badge | Badge[] | null }) => b.badges).filter(Boolean) as Badge[]
          setBadges(userBadges)
        }

        if (routeData) {
          const uniqueRecipes: Recipe[] = []
          const names = new Set<string>()
          for (const r of routeData) {
            if (r.photo_metadata?.is_recipe && !names.has(r.item_name)) {
              names.add(r.item_name)
              uniqueRecipes.push(r as Recipe)
            }
          }
          setRecipes(uniqueRecipes.slice(0, 5))
        }

      } catch (error) {
        console.error("Error fetching dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  if (loading) {
    return <div className="p-8 text-center font-bold opacity-50 text-[#3D2C24]">Loading Dashboard...</div>
  }

  return (
    <div className="space-y-8 pb-24">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-black text-[#3D2C24]">Dashboard</h1>
      </div>

      {/* QUICK ACTIONS ROW */}
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => {
            const el = document.getElementById("badges-section")
            if (el) {
              const yOffset = -80
              const y = el.getBoundingClientRect().top + window.scrollY + yOffset
              window.scrollTo({ top: y, behavior: 'smooth' })
            } else {
              navigate('/profile')
            }
          }}
          className="snap-start shrink-0 bg-white border-[3px] border-[#3D2C24] shadow-[3px_3px_0px_#3D2C24] px-5 py-3 rounded-2xl font-black text-[#3D2C24] transition-transform active:scale-95 flex items-center gap-2 hover:bg-[#A0E8AF]/10"
        >
          <Medal size={20} className="text-[#60D394]" strokeWidth={3} /> My Badges
        </button>
        <button
          onClick={() => navigate('/groups')}
          className="snap-start shrink-0 bg-white border-[3px] border-[#3D2C24] shadow-[3px_3px_0px_#3D2C24] px-5 py-3 rounded-2xl font-black text-[#3D2C24] transition-transform active:scale-95 flex items-center gap-2 hover:bg-[#FFD166]/10"
        >
          <Trophy size={20} className="text-[#FFD166]" strokeWidth={3} /> Splitwise Balances
        </button>
        <button
          onClick={() => navigate('/party')}
          className="snap-start shrink-0 bg-white border-[3px] border-[#3D2C24] shadow-[3px_3px_0px_#3D2C24] px-5 py-3 rounded-2xl font-black text-[#3D2C24] transition-transform active:scale-95 flex items-center gap-2 hover:bg-[#FF7B9C]/10"
        >
          <Globe size={20} className="text-[#FF7B9C]" strokeWidth={3} /> Party Maker
        </button>
        <button
          onClick={() => alert("Mixology Course is coming soon! Stay tuned.")}
          className="snap-start shrink-0 bg-gray-100 border-[3px] border-dashed border-[#3D2C24]/30 px-5 py-3 rounded-2xl font-black text-[#3D2C24]/60 transition-transform active:scale-95 flex items-center gap-2"
        >
          <UtensilsCrossed size={20} className="text-[#3D2C24]/40" strokeWidth={3} /> Mixology Course
        </button>
        <button
          onClick={() => alert("Merch Shop is coming soon! Stay tuned.")}
          className="snap-start shrink-0 bg-gray-100 border-[3px] border-dashed border-[#3D2C24]/30 px-5 py-3 rounded-2xl font-black text-[#3D2C24]/60 transition-transform active:scale-95 flex items-center gap-2"
        >
          <MapPin size={20} className="text-[#3D2C24]/40" strokeWidth={3} /> Merch Shop
        </button>
      </div>

      {/* TILE 1: DYNAMIC RANKINGS */}
      <div className="cartoon-card bg-[#FFD166]/20 border-[#FFD166]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-black text-[#3D2C24] flex items-center gap-2">
            <Trophy className="text-[#FF7B9C]" size={28} strokeWidth={3} /> Rankings
          </h2>
          <div className="flex bg-white rounded-xl border-2 border-[#3D2C24] overflow-hidden shadow-[2px_2px_0px_#3D2C24]">
            <button
              onClick={() => setRankScope('global')}
              className={`p-2 transition-colors ${rankScope === 'global' ? 'bg-[#FFD166] text-[#3D2C24]' : 'text-[#3D2C24]/50'}`}
            >
              <Globe size={18} strokeWidth={3} />
            </button>
            <div className="w-0.5 bg-[#3D2C24]" />
            <button
              onClick={() => setRankScope('group')}
              className={`p-2 transition-colors ${rankScope === 'group' ? 'bg-[#A0E8AF] text-[#3D2C24]' : 'text-[#3D2C24]/50'}`}
            >
              <Users size={18} strokeWidth={3} />
            </button>
            <div className="w-0.5 bg-[#3D2C24]" />
            <button
              onClick={() => setRankScope('regional')}
              className={`p-2 transition-colors ${rankScope === 'regional' ? 'bg-[#FF7B9C] text-white' : 'text-[#3D2C24]/50'}`}
            >
              <MapPin size={18} strokeWidth={3} />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {ranks.length === 0 ? (
            <div className="text-center p-4">
              <p className="font-bold opacity-50 mb-4">No rankings yet.</p>
              <button onClick={() => navigate('/log')} className="cartoon-btn-secondary text-sm! flex items-center justify-center gap-2 w-full">
                <Plus size={16} /> Log XP
              </button>
            </div>
          ) : (
            ranks.map((rankedUser, index) => (
              <div key={rankedUser.id} className="flex items-center justify-between bg-white rounded-xl p-3 border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24]">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${index === 0 ? 'bg-[#FFD166]' : index === 1 ? 'bg-gray-300' : index === 2 ? 'bg-[#cd7f32]' : 'bg-[#A0E8AF]'}`}>
                    #{index + 1}
                  </div>
                  <span className="font-bold text-lg">{rankedUser.username}</span>
                </div>
                <span className="font-black text-[#FF7B9C]">{rankedUser.xp} XP</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* TILE 2: EARNED BADGES */}
      <div id="badges-section" className="cartoon-card bg-[#A0E8AF]/20 border-[#60D394]">
        <h2 className="text-2xl font-black text-[#3D2C24] flex items-center gap-2 mb-4">
          <Medal className="text-[#60D394]" size={28} strokeWidth={3} /> Your Badges
        </h2>

        {badges.length === 0 ? (
          <div className="text-center p-4 bg-white/50 rounded-xl border-2 border-dashed border-[#3D2C24]/30">
            <p className="font-bold opacity-60 mb-3">You haven't earned any badges yet!</p>
            <button onClick={() => navigate('/log')} className="cartoon-btn-secondary text-sm! border-[#60D394]! text-[#60D394] w-full flex justify-center gap-2">
              <Plus size={16} /> Complete Activities
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {badges.map(badge => (
              <div key={badge.id} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-white rounded-full border-[3px] border-[#3D2C24] shadow-[3px_3px_0px_#3D2C24] flex items-center justify-center text-3xl transition-transform hover:-translate-y-1">
                  {badge.icon_text}
                </div>
                <span className="text-xs font-bold text-center leading-tight">{badge.name}</span>
              </div>
            ))}

            <div className="flex flex-col items-center gap-2 opacity-50">
              <div className="w-16 h-16 bg-white/50 rounded-full border-[3px] border-dashed border-[#3D2C24] flex items-center justify-center text-[#3D2C24]">
                ?
              </div>
              <span className="text-xs font-bold text-center leading-tight">More Soon</span>
            </div>
          </div>
        )}
      </div>

      {/* TILE 3: TOP RECIPES */}
      <div className="cartoon-card bg-[#FF7B9C]/10 border-[#FF7B9C]">
        <h2 className="text-2xl font-black text-[#3D2C24] flex items-center gap-2 mb-4">
          <UtensilsCrossed className="text-[#FF7B9C]" size={28} strokeWidth={3} /> Top Recipes
        </h2>

        {recipes.length === 0 ? (
          <div className="text-center p-4">
            <p className="font-bold opacity-50 mb-3">No top recipes/snacks logged yet.</p>
            <button onClick={() => navigate('/log')} className="cartoon-btn w-full text-sm! flex justify-center gap-2 bg-[#FF7B9C]! text-white">
              <Plus size={16} /> Log a Snack or Drink
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {recipes.map(recipe => (
              <div key={recipe.id} className="bg-white rounded-xl p-3 border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24] flex justify-between items-center cursor-pointer hover:-translate-y-1 transition-transform">
                <div>
                  <p className="font-black text-lg leading-none mb-1">{recipe.item_name}</p>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60 text-[#3D2C24]">{recipe.category}</p>
                </div>
                <div className="bg-[#60D394] px-3 py-1 rounded-full border-2 border-[#3D2C24] font-black text-sm shadow-[2px_2px_0px_#3D2C24]">
                  ⭐ {recipe.xp_earned}
                </div>
              </div>
            ))}
            <button className="cartoon-btn-secondary w-full mt-4 text-sm! py-2! border-[#FF7B9C] text-[#FF7B9C]">View All</button>
          </div>
        )}
      </div>

      {/* TILE 4: AI BARTENDER CHATBOT */}
      <div className="cartoon-card border-[#8B5CF6] relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #8B5CF620 0%, #EC489920 50%, #FFD16620 100%)' }}>
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10" style={{ fontSize: '120px', lineHeight: 1, pointerEvents: 'none' }}>🍹</div>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full border-[3px] border-[#3D2C24] shadow-[3px_3px_0px_#3D2C24] flex items-center justify-center text-2xl bg-gradient-to-br from-[#8B5CF6] to-[#EC4899]" style={{ animation: 'float 3s ease-in-out infinite' }}>
            🍸
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#3D2C24] flex items-center gap-2">
              God of Tits and Wine
              <Sparkles className="text-[#FFD166]" size={20} strokeWidth={3} style={{ animation: 'pulse-glow 2s ease-in-out infinite' }} />
            </h2>
            <p className="text-xs font-bold text-[#3D2C24]/60 uppercase tracking-widest">Tell me what you have, I'll mix magic</p>
          </div>
        </div>

        {/* Quick Prompt Chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {quickPrompts.map((qp) => (
            <button
              key={qp.label}
              onClick={() => { setChatPrompt(qp.prompt); handleChatSend(qp.prompt) }}
              disabled={chatLoading}
              className="px-3 py-1.5 bg-white/80 hover:bg-white rounded-full border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24] text-xs font-black text-[#3D2C24] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#3D2C24] active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Chat Input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={chatPrompt}
            onChange={(e) => setChatPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !chatLoading && handleChatSend()}
            placeholder='"I have rum and lime..." or "Make me something strong"'
            className="cartoon-input flex-1 text-sm! py-3! pr-4!"
            disabled={chatLoading}
          />
          <button
            onClick={() => handleChatSend()}
            disabled={chatLoading || !chatPrompt.trim()}
            className="cartoon-btn bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] border-[#3D2C24] px-4! min-w-[52px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {chatLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>

        {/* Loading Animation */}
        {chatLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="relative">
              <div className="text-5xl" style={{ animation: 'shaker 0.6s ease-in-out infinite' }}>🍹</div>
              <div className="absolute -top-1 -right-1">
                <Sparkles size={16} className="text-[#FFD166]" style={{ animation: 'pulse-glow 0.8s ease-in-out infinite' }} />
              </div>
            </div>
            <p className="font-black text-sm text-[#3D2C24]/70 uppercase tracking-widest" style={{ animation: 'pulse-glow 1.5s ease-in-out infinite' }}>
              Mixing your drink...
            </p>
          </div>
        )}

        {/* Error State */}
        {chatError && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-2">
            <p className="font-bold text-red-600 text-sm">⚠️ {chatError}</p>
          </div>
        )}

        {/* AI Response */}
        {chatReply && !chatLoading && (
          <div ref={responseRef} className="relative" style={{ animation: 'slide-up 0.4s ease-out' }}>
            <div className="bg-white rounded-2xl border-[3px] border-[#3D2C24] shadow-[4px_4px_0px_#3D2C24] p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🍸</span>
                <span className="font-black text-[#8B5CF6] uppercase text-xs tracking-widest">Bartender Says</span>
              </div>
              <div className="text-[#3D2C24] text-sm leading-relaxed whitespace-pre-wrap font-semibold">
                {chatReply}
              </div>

              {/* Referenced Recipes Chips */}
              {referencedRecipes.length > 0 && (
                <div className="mt-4 pt-3 border-t-2 border-dashed border-[#3D2C24]/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#3D2C24]/40 mb-2 flex items-center gap-1">
                    <Wine size={12} /> Based on these recipes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {referencedRecipes.map((name) => (
                      <span
                        key={name}
                        className="px-3 py-1 bg-gradient-to-r from-[#8B5CF6]/10 to-[#EC4899]/10 rounded-full border-2 border-[#8B5CF6]/30 text-xs font-black text-[#8B5CF6] flex items-center gap-1"
                      >
                        <Coffee size={10} /> {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!chatReply && !chatLoading && !chatError && (
          <div className="text-center py-6 opacity-60">
            <div className="flex justify-center gap-3 mb-3 text-3xl">
              <span style={{ animation: 'float 2s ease-in-out infinite' }}>🥃</span>
              <span style={{ animation: 'float 2s ease-in-out 0.3s infinite' }}>🍷</span>
              <span style={{ animation: 'float 2s ease-in-out 0.6s infinite' }}>🍺</span>
              <span style={{ animation: 'float 2s ease-in-out 0.9s infinite' }}>☕</span>
            </div>
            <p className="font-bold text-sm text-[#3D2C24]">
              Tell me what bottles you have, and I'll craft the perfect recipe!
            </p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <Beer size={12} className="text-[#FFD166]" />
              <p className="text-xs font-bold text-[#3D2C24]/50">Powered by AI · No chat history saved</p>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}