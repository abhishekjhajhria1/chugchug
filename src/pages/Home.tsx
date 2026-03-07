import { useState, useEffect } from "react"
import { Trophy, Medal, UtensilsCrossed, Globe, Users, MapPin, Plus } from "lucide-react"
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

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        const { data: rankData } = await supabase
          .from("profiles")
          .select("id, username, xp")
          .order("xp", { ascending: false })
          .limit(5)
        if (rankData) setRanks(rankData as RankUser[])

        const { data: badgeData } = await supabase
          .from("user_badges")
          .select(`
            badges ( id, name, icon_text )
          `)
          .eq("user_id", user.id)

        if (badgeData) {
          const userBadges = badgeData.flatMap((b: { badges: Badge | Badge[] | null }) => b.badges).filter(Boolean) as Badge[]
          setBadges(userBadges)
        }

        const { data: routeData } = await supabase
          .from("activity_logs")
          .select("id, item_name, category, xp_earned, photo_metadata")
          .in('category', ['snack', 'drink'])
          .order("xp_earned", { ascending: false })
          .limit(20)

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
      <div className="cartoon-card bg-[#A0E8AF]/20 border-[#60D394]">
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

    </div>
  )
}