import { useState, useEffect } from "react"
import { Globe, Trophy, UtensilsCrossed, Star } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { Link } from "react-router-dom"

interface Activity {
    id: string
    user_id: string
    item_name: string
    category: string
    xp_earned: number
    photo_metadata?: any
    created_at: string
    profiles: {
        username: string
        avatar_url: string
    }
}

interface RankedUser {
    id: string
    username: string
    xp: number
    level: number
    city?: string
    top_recipe?: string
}

export default function World() {
    const { user } = useChug()
    const [loading, setLoading] = useState(true)

    const [topActivity, setTopActivity] = useState<Activity | null>(null)
    const [topRecipes, setTopRecipes] = useState<Activity[]>([])
    const [topRankers, setTopRankers] = useState<RankedUser[]>([])

    useEffect(() => {
        const fetchWorldData = async () => {
            if (!user) return
            setLoading(true)

            try {
                // 1. Fetch Top World Activity (highest XP overall recently)
                const { data: activityData } = await supabase
                    .from("activity_logs")
                    .select(`
            *,
            profiles(username, avatar_url)
          `)
                    .order("xp_earned", { ascending: false })
                    .limit(1)

                if (activityData && activityData.length > 0) {
                    setTopActivity(activityData[0] as Activity)
                }

                // 2. Fetch Most Liked/Highest XP Drink & Snack Recipes
                const { data: recipeData } = await supabase
                    .from("activity_logs")
                    .select(`
            *,
            profiles(username)
          `)
                    .in('category', ['snack', 'drink'])
                    .order("xp_earned", { ascending: false })
                    .limit(50) // fetch a pool to find unique recipes

                if (recipeData) {
                    const uniqueRecipes: Activity[] = []
                    const names = new Set<string>()
                    for (const r of recipeData as Activity[]) {
                        // Check if it's explicitly marked as a recipe or has recipe details
                        if (r.photo_metadata?.is_recipe || r.photo_metadata?.recipe_details) {
                            if (!names.has(r.item_name)) {
                                names.add(r.item_name)
                                uniqueRecipes.push(r)
                            }
                        }
                    }
                    setTopRecipes(uniqueRecipes.slice(0, 3)) // Take top 3
                }

                // 3. Fetch Nation/City wise ranking and their favorite drinks
                const { data: rankData } = await supabase
                    .from("profiles")
                    .select("id, username, xp, level, city")
                    .order("xp", { ascending: false })
                    .limit(10)

                if (rankData) {
                    // Now fetch the top logged item for each top ranker
                    const userIds = rankData.map(r => r.id)

                    if (userIds.length > 0) {
                        const { data: favoriteData } = await supabase
                            .from("activity_logs")
                            .select("user_id, item_name, xp_earned, category")
                            .in("user_id", userIds)
                            .in("category", ["drink", "snack"])
                            .order("xp_earned", { ascending: false })

                        const rankersWithFavorites = rankData.map(r => {
                            const userFavs = favoriteData?.filter(f => f.user_id === r.id) || []
                            // simple heuristic: first one represents their top XP item
                            const topFav = userFavs.length > 0 ? userFavs[0].item_name : undefined
                            return { ...r, top_recipe: topFav }
                        })

                        // Group by city to show regional ranking
                        setTopRankers(rankersWithFavorites as RankedUser[])
                    }
                }

            } catch (error) {
                console.error("Error fetching world data", error)
            } finally {
                setLoading(false)
            }
        }

        fetchWorldData()
    }, [user])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-[#3D2C24]">
                <Globe className="animate-spin text-[#FFD166] mb-4" size={48} />
                <p className="font-bold opacity-50">Loading World...</p>
            </div>
        )
    }

    // Group top rankers by city
    const regionalGroups = topRankers.reduce((acc, current) => {
        const city = current.city || 'Global Nomads'
        if (!acc[city]) {
            acc[city] = []
        }
        acc[city].push(current)
        return acc
    }, {} as Record<string, RankedUser[]>)


    return (
        <div className="space-y-8 pb-32">
            <div className="flex items-center gap-3 mb-6">
                <Globe className="text-[#3D2C24]" size={36} strokeWidth={3} />
                <h1 className="text-3xl font-black text-[#3D2C24]">World</h1>
            </div>

            {/* TOP WORLD ACTIVITY */}
            <section className="cartoon-card bg-[#FFD166]/20 border-[#FFD166]">
                <h2 className="text-xl font-black text-[#3D2C24] flex items-center gap-2 mb-4">
                    <Star className="text-[#FFD166]" fill="#FFD166" size={24} /> Top World Activity
                </h2>

                {topActivity ? (
                    <div className="bg-white rounded-xl p-4 border-2 border-[#3D2C24] shadow-[4px_4px_0px_#3D2C24] cursor-pointer hover:-translate-y-1 transition-transform">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-[#3D2C24] overflow-hidden shrink-0">
                                    {topActivity.profiles?.avatar_url ? (
                                        <img src={topActivity.profiles.avatar_url} alt={topActivity.profiles.username} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#FF7B9C] text-white font-black text-xs uppercase">
                                            {topActivity.profiles?.username?.substring(0, 2)}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <Link to={`/profile/${topActivity.user_id}`} className="font-bold hover:text-[#FF7B9C] transition-colors">{topActivity.profiles?.username}</Link>
                                    <p className="text-xs font-bold opacity-50 uppercase tracking-widest">{topActivity.category}</p>
                                </div>
                            </div>
                            <div className="bg-[#60D394] px-3 py-1 rounded-full border-2 border-[#3D2C24] font-black shadow-[2px_2px_0px_#3D2C24]">
                                ⭐ {topActivity.xp_earned}
                            </div>
                        </div>

                        <h3 className="text-xl font-black mt-3 leading-tight text-[#3D2C24]">{topActivity.item_name}</h3>
                    </div>
                ) : (
                    <p className="font-bold opacity-50 text-center py-4">No activity found.</p>
                )}
            </section>

            {/* TOP RECIPES */}
            <section className="cartoon-card bg-[#FF7B9C]/10 border-[#FF7B9C]">
                <h2 className="text-xl font-black text-[#3D2C24] flex items-center gap-2 mb-4">
                    <UtensilsCrossed className="text-[#FF7B9C]" size={24} strokeWidth={3} /> Top Recipes & Snacks
                </h2>

                {topRecipes.length > 0 ? (
                    <div className="space-y-4">
                        {topRecipes.map((recipe, index) => (
                            <div key={recipe.id} className="flex bg-white rounded-xl border-2 border-[#3D2C24] shadow-[4px_4px_0px_#3D2C24] overflow-hidden">
                                <div className="bg-[#FF7B9C] text-white font-black flex items-center justify-center w-12 border-r-2 border-[#3D2C24]">
                                    #{index + 1}
                                </div>
                                <div className="p-4 flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-black text-lg leading-tight">{recipe.item_name}</h3>
                                            <p className="text-xs font-bold opacity-60">by {recipe.profiles?.username}</p>
                                        </div>
                                        <span className="font-black text-[#FF7B9C]">⭐ {recipe.xp_earned}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="font-bold opacity-50 text-center py-4">No top recipes logged yet.</p>
                )}
            </section>

            {/* REGIONAL CHAMPIONS */}
            <section className="cartoon-card bg-[#A0E8AF]/20 border-[#60D394]">
                <h2 className="text-xl font-black text-[#3D2C24] flex items-center gap-2 mb-4">
                    <Trophy className="text-[#60D394]" size={24} strokeWidth={3} /> Regional Champions
                </h2>

                {Object.keys(regionalGroups).length > 0 ? (
                    <div className="space-y-6">
                        {Object.entries(regionalGroups).map(([city, rankers]) => (
                            <div key={city} className="space-y-3">
                                <h3 className="font-black uppercase tracking-wider text-sm text-[#3D2C24]/70 border-b-2 border-[#3D2C24]/20 pb-1">{city}</h3>
                                {rankers.map((ranker, index) => (
                                    <div key={ranker.id} className="flex items-center justify-between bg-white rounded-xl p-3 border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24]">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black border-2 border-[#3D2C24] shadow-[1px_1px_0px_#3D2C24] ${index === 0 ? 'bg-[#FFD166]' : index === 1 ? 'bg-gray-300' : index === 2 ? 'bg-[#cd7f32]' : 'bg-[#A0E8AF]'}`}>
                                                {index + 1}
                                            </div>
                                            <div>
                                                <Link to={`/profile/${ranker.id}`} className="font-bold text-lg block hover:text-[#FF7B9C] transition-colors leading-none mb-1">{ranker.username}</Link>
                                                {ranker.top_recipe && (
                                                    <span className="text-xs font-bold opacity-60 flex items-center gap-1">
                                                        <UtensilsCrossed size={12} /> Fav: {ranker.top_recipe}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end justify-center">
                                            <span className="font-black text-[#FF7B9C] block leading-none">{ranker.xp} XP</span>
                                            <span className="font-bold text-[10px] uppercase opacity-50 mt-1 block leading-none">Lvl {ranker.level}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="font-bold opacity-50 text-center py-4">No players found.</p>
                )}
            </section>

        </div>
    )
}
