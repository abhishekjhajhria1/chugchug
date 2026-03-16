import { useState, useEffect, useMemo } from "react"
import { Globe, Trophy, UtensilsCrossed, Star, Flame, TrendingUp, Zap, Award, BarChart3, Sparkles } from "lucide-react"
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
    country?: string
    top_recipe?: string
}

interface TrendingItem {
    item_name: string
    category: string
    count: number
}

interface Challenge {
    id: string
    title: string
    description: string
    target: number
    current: number
    icon: string
    color: string
}

const COUNTRY_FLAGS: Record<string, string> = {
    'india': '🇮🇳', 'usa': '🇺🇸', 'united states': '🇺🇸', 'uk': '🇬🇧', 'united kingdom': '🇬🇧',
    'canada': '🇨🇦', 'australia': '🇦🇺', 'germany': '🇩🇪', 'france': '🇫🇷', 'japan': '🇯🇵',
    'brazil': '🇧🇷', 'mexico': '🇲🇽', 'spain': '🇪🇸', 'italy': '🇮🇹', 'south korea': '🇰🇷',
    'china': '🇨🇳', 'russia': '🇷🇺', 'netherlands': '🇳🇱', 'sweden': '🇸🇪', 'norway': '🇳🇴',
    'denmark': '🇩🇰', 'finland': '🇫🇮', 'switzerland': '🇨🇭', 'portugal': '🇵🇹', 'ireland': '🇮🇪',
    'new zealand': '🇳🇿', 'singapore': '🇸🇬', 'thailand': '🇹🇭', 'philippines': '🇵🇭',
    'indonesia': '🇮🇩', 'malaysia': '🇲🇾', 'vietnam': '🇻🇳', 'argentina': '🇦🇷', 'colombia': '🇨🇴',
    'chile': '🇨🇱', 'peru': '🇵🇪', 'egypt': '🇪🇬', 'nigeria': '🇳🇬', 'south africa': '🇿🇦',
    'turkey': '🇹🇷', 'pakistan': '🇵🇰', 'bangladesh': '🇧🇩', 'sri lanka': '🇱🇰', 'nepal': '🇳🇵',
    'uae': '🇦🇪', 'saudi arabia': '🇸🇦', 'poland': '🇵🇱', 'austria': '🇦🇹', 'belgium': '🇧🇪',
    'czech republic': '🇨🇿', 'greece': '🇬🇷', 'romania': '🇷🇴', 'hungary': '🇭🇺', 'ukraine': '🇺🇦',
}

function getFlag(country?: string): string {
    if (!country) return '🌍'
    return COUNTRY_FLAGS[country.toLowerCase().trim()] || '🌍'
}

export default function World() {
    const { user, profile } = useChug()
    const [loading, setLoading] = useState(true)

    const [topActivity, setTopActivity] = useState<Activity | null>(null)
    const [topRecipes, setTopRecipes] = useState<Activity[]>([])
    const [topRankers, setTopRankers] = useState<RankedUser[]>([])
    const [trending, setTrending] = useState<TrendingItem[]>([])
    const [drinkOfDay, setDrinkOfDay] = useState<Activity | null>(null)
    const [totalUsers, setTotalUsers] = useState(0)
    const [totalLogs, setTotalLogs] = useState(0)
    const [userRank, setUserRank] = useState<number | null>(null)
    const [recentActivities, setRecentActivities] = useState<Activity[]>([])
    const [challenges] = useState<Challenge[]>([
        { id: '1', title: 'Weekend Warrior', description: 'Log 10 activities this week', target: 10, current: 0, icon: '⚔️', color: '#FFD166' },
        { id: '2', title: 'Social Butterfly', description: 'Join 3 groups', target: 3, current: 0, icon: '🦋', color: '#A0E8AF' },
        { id: '3', title: 'Recipe Master', description: 'Log 5 unique recipes', target: 5, current: 0, icon: '👨‍🍳', color: '#FF7B9C' },
    ])

    const [tickerIndex, setTickerIndex] = useState(0)

    useEffect(() => {
        const fetchWorldData = async () => {
            if (!user) return
            setLoading(true)

            try {
                const [
                    activityRes,
                    recipeRes,
                    rankRes,
                    recentRes,
                    countRes,
                    logCountRes,
                ] = await Promise.all([
                    supabase
                        .from("activity_logs")
                        .select("*, profiles(username, avatar_url)")
                        .order("xp_earned", { ascending: false })
                        .limit(1),
                    supabase
                        .from("activity_logs")
                        .select("*, profiles(username)")
                        .in('category', ['snack', 'drink'])
                        .order("xp_earned", { ascending: false })
                        .limit(50),
                    supabase
                        .from("profiles")
                        .select("id, username, xp, level, city, country")
                        .order("xp", { ascending: false })
                        .limit(20),
                    supabase
                        .from("activity_logs")
                        .select("*, profiles(username, avatar_url)")
                        .order("created_at", { ascending: false })
                        .limit(15),
                    supabase
                        .from("profiles")
                        .select("id", { count: "exact", head: true }),
                    supabase
                        .from("activity_logs")
                        .select("id", { count: "exact", head: true }),
                ])

                if (activityRes.data?.[0]) {
                    setTopActivity(activityRes.data[0] as Activity)
                }

                if (recipeRes.data) {
                    const uniqueRecipes: Activity[] = []
                    const names = new Set<string>()
                    for (const r of recipeRes.data as Activity[]) {
                        if (r.photo_metadata?.is_recipe || r.photo_metadata?.recipe_details) {
                            if (!names.has(r.item_name)) {
                                names.add(r.item_name)
                                uniqueRecipes.push(r)
                            }
                        }
                    }
                    setTopRecipes(uniqueRecipes.slice(0, 3))

                    const itemCounts: Record<string, { count: number; category: string }> = {}
                    for (const r of recipeRes.data) {
                        const key = r.item_name
                        if (!itemCounts[key]) itemCounts[key] = { count: 0, category: r.category }
                        itemCounts[key].count++
                    }
                    const trendingItems = Object.entries(itemCounts)
                        .map(([name, v]) => ({ item_name: name, category: v.category, count: v.count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5)
                    setTrending(trendingItems)

                    const todayStart = new Date()
                    todayStart.setHours(0, 0, 0, 0)
                    const todayLogs = (recipeRes.data as Activity[]).filter(r => new Date(r.created_at) >= todayStart)
                    if (todayLogs.length > 0) {
                        setDrinkOfDay(todayLogs[0])
                    } else if (recipeRes.data.length > 0) {
                        const randomIdx = Math.floor(Math.random() * Math.min(5, recipeRes.data.length))
                        setDrinkOfDay(recipeRes.data[randomIdx] as Activity)
                    }
                }

                if (rankRes.data) {
                    const userIds = rankRes.data.map(r => r.id)

                    if (userIds.length > 0) {
                        const { data: favoriteData } = await supabase
                            .from("activity_logs")
                            .select("user_id, item_name, xp_earned, category")
                            .in("user_id", userIds)
                            .in("category", ["drink", "snack"])
                            .order("xp_earned", { ascending: false })

                        const rankersWithFavorites = rankRes.data.map(r => {
                            const userFavs = favoriteData?.filter(f => f.user_id === r.id) || []
                            const topFav = userFavs.length > 0 ? userFavs[0].item_name : undefined
                            return { ...r, top_recipe: topFav }
                        })

                        setTopRankers(rankersWithFavorites as RankedUser[])
                    }

                    const idx = rankRes.data.findIndex(r => r.id === user.id)
                    if (idx !== -1) {
                        setUserRank(idx + 1)
                    } else {
                        const { count } = await supabase
                            .from("profiles")
                            .select("id", { count: "exact", head: true })
                            .gt("xp", profile?.xp || 0)
                        setUserRank((count || 0) + 1)
                    }
                }

                if (recentRes.data) {
                    setRecentActivities(recentRes.data as Activity[])
                }

                setTotalUsers(countRes.count || 0)
                setTotalLogs(logCountRes.count || 0)

            } catch (error) {
                console.error("Error fetching world data", error)
            } finally {
                setLoading(false)
            }
        }

        fetchWorldData()
    }, [user, profile])

    useEffect(() => {
        if (recentActivities.length === 0) return
        const interval = setInterval(() => {
            setTickerIndex(prev => (prev + 1) % recentActivities.length)
        }, 3000)
        return () => clearInterval(interval)
    }, [recentActivities])

    const countryGroups = useMemo(() => {
        return topRankers.reduce((acc, r) => {
            const country = r.country || r.city || 'Global'
            if (!acc[country]) acc[country] = { users: [], totalXp: 0 }
            acc[country].users.push(r)
            acc[country].totalXp += r.xp
            return acc
        }, {} as Record<string, { users: RankedUser[]; totalXp: number }>)
    }, [topRankers])

    const sortedCountries = useMemo(() => {
        return Object.entries(countryGroups)
            .sort(([, a], [, b]) => b.totalXp - a.totalXp)
    }, [countryGroups])

    const userPercentile = useMemo(() => {
        if (!userRank || !totalUsers || totalUsers === 0) return null
        return Math.round(((totalUsers - userRank) / totalUsers) * 100)
    }, [userRank, totalUsers])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-[#3D2C24]">
                <Globe className="animate-spin text-[#FFD166] mb-4" size={48} />
                <p className="font-bold opacity-50">Loading World...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-32">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <Globe className="text-[#3D2C24]" size={36} strokeWidth={3} />
                    <h1 className="text-3xl font-black text-[#3D2C24]">World</h1>
                </div>
                <div className="flex gap-2">
                    <div className="bg-[#FFD166] px-3 py-1 rounded-full border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24] font-black text-xs">
                        {totalUsers} Players
                    </div>
                    <div className="bg-[#A0E8AF] px-3 py-1 rounded-full border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24] font-black text-xs">
                        {totalLogs} Logs
                    </div>
                </div>
            </div>

            {/* LIVE TICKER */}
            {recentActivities.length > 0 && (
                <div className="bg-[#3D2C24] rounded-xl px-4 py-3 flex items-center gap-3 overflow-hidden">
                    <div className="shrink-0 bg-[#FF7B9C] px-2 py-0.5 rounded-full font-black text-[10px] text-white uppercase tracking-wider animate-pulse">
                        Live
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-white font-bold text-sm truncate transition-all duration-500">
                            <span className="text-[#FFD166]">{recentActivities[tickerIndex]?.profiles?.username}</span>
                            {' '}logged{' '}
                            <span className="text-[#A0E8AF]">{recentActivities[tickerIndex]?.item_name}</span>
                            {' '}
                            <span className="opacity-50 text-xs">({recentActivities[tickerIndex]?.category})</span>
                        </p>
                    </div>
                    <Zap size={16} className="text-[#FFD166] shrink-0 animate-pulse" />
                </div>
            )}

            {/* PERSONAL STATS CARD */}
            {userPercentile !== null && (
                <div className="cartoon-card bg-gradient-to-r from-[#FFD166]/30 via-[#FF7B9C]/20 to-[#A0E8AF]/30 border-[#FFD166]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-[#FFD166] rounded-full border-[3px] border-[#3D2C24] shadow-[3px_3px_0px_#3D2C24] flex items-center justify-center">
                                <BarChart3 size={24} strokeWidth={3} className="text-[#3D2C24]" />
                            </div>
                            <div>
                                <p className="font-black text-lg text-[#3D2C24] leading-tight">You're Top {100 - userPercentile}%</p>
                                <p className="text-xs font-bold text-[#3D2C24]/60">Rank #{userRank} of {totalUsers} players worldwide</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-black text-2xl text-[#FF7B9C]">{profile?.xp || 0}</p>
                            <p className="text-[10px] font-black uppercase tracking-wider opacity-50">Total XP</p>
                        </div>
                    </div>
                    {/* XP Bar */}
                    <div className="mt-3 bg-white rounded-full h-3 border-2 border-[#3D2C24] overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#FFD166] to-[#FF7B9C] rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(userPercentile, 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* 🔥 TRENDING NOW */}
            {trending.length > 0 && (
                <section className="cartoon-card bg-[#FF7B9C]/10 border-[#FF7B9C]">
                    <h2 className="text-xl font-black text-[#3D2C24] flex items-center gap-2 mb-4">
                        <Flame className="text-[#FF7B9C]" size={24} strokeWidth={3} /> Trending Now
                    </h2>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
                        {trending.map((item, i) => (
                            <div key={item.item_name} className="snap-start shrink-0 bg-white rounded-xl px-4 py-3 border-2 border-[#3D2C24] shadow-[3px_3px_0px_#3D2C24] min-w-[140px]">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-black text-[#FF7B9C] text-lg">#{i + 1}</span>
                                    <Flame size={14} className="text-[#FF7B9C]" />
                                </div>
                                <p className="font-black text-[#3D2C24] leading-tight">{item.item_name}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mt-1">{item.count} logs • {item.category}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 🎯 DRINK OF THE DAY */}
            {drinkOfDay && (
                <section className="cartoon-card bg-gradient-to-br from-[#FFD166]/20 to-[#FF7B9C]/20 border-[#FFD166] relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                        <Sparkles className="text-[#FFD166] animate-pulse" size={20} />
                    </div>
                    <h2 className="text-xl font-black text-[#3D2C24] flex items-center gap-2 mb-3">
                        <span className="text-2xl">🎯</span> Drink of the Day
                    </h2>
                    <div className="bg-white rounded-xl p-4 border-2 border-[#3D2C24] shadow-[4px_4px_0px_#3D2C24]">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-black text-2xl text-[#3D2C24] leading-tight">{drinkOfDay.item_name}</h3>
                                <p className="text-xs font-bold opacity-60 mt-1">by {drinkOfDay.profiles?.username} • {drinkOfDay.category}</p>
                            </div>
                            <div className="bg-[#60D394] px-3 py-1 rounded-full border-2 border-[#3D2C24] font-black shadow-[2px_2px_0px_#3D2C24]">
                                ⭐ {drinkOfDay.xp_earned}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* 🏆 WEEKLY CHALLENGES */}
            <section className="cartoon-card bg-[#A0E8AF]/10 border-[#60D394]">
                <h2 className="text-xl font-black text-[#3D2C24] flex items-center gap-2 mb-4">
                    <Award className="text-[#60D394]" size={24} strokeWidth={3} /> Weekly Challenges
                </h2>
                <div className="space-y-3">
                    {challenges.map(c => {
                        const progress = Math.min((c.current / c.target) * 100, 100)
                        return (
                            <div key={c.id} className="bg-white rounded-xl p-4 border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24]">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{c.icon}</span>
                                        <div>
                                            <p className="font-black text-[#3D2C24] leading-tight">{c.title}</p>
                                            <p className="text-[10px] font-bold opacity-50">{c.description}</p>
                                        </div>
                                    </div>
                                    <span className="font-black text-sm" style={{ color: c.color }}>
                                        {c.current}/{c.target}
                                    </span>
                                </div>
                                <div className="bg-gray-200 rounded-full h-2 border border-[#3D2C24]/20 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${progress}%`, backgroundColor: c.color }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* ⭐ TOP WORLD ACTIVITY */}
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

            {/* 🍳 TOP RECIPES */}
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

            {/* 🌍 COUNTRY LEADERBOARDS */}
            <section className="cartoon-card bg-[#A0E8AF]/20 border-[#60D394]">
                <h2 className="text-xl font-black text-[#3D2C24] flex items-center gap-2 mb-4">
                    <Trophy className="text-[#60D394]" size={24} strokeWidth={3} /> Country Leaderboards
                </h2>

                {sortedCountries.length > 0 ? (
                    <div className="space-y-4">
                        {sortedCountries.map(([country, data], countryIdx) => (
                            <div key={country} className="bg-white rounded-xl border-2 border-[#3D2C24] shadow-[3px_3px_0px_#3D2C24] overflow-hidden">
                                {/* Country Header */}
                                <div className={`flex items-center justify-between px-4 py-3 border-b-2 border-[#3D2C24] ${countryIdx === 0 ? 'bg-[#FFD166]/30' : countryIdx === 1 ? 'bg-gray-100' : 'bg-white'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{getFlag(country)}</span>
                                        <span className="font-black text-[#3D2C24] uppercase tracking-wide text-sm">{country}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-[#FF7B9C] text-sm">{data.totalXp} XP</span>
                                        <span className="text-[10px] font-bold opacity-40">({data.users.length} players)</span>
                                    </div>
                                </div>
                                {/* Players */}
                                <div className="px-4 py-2 space-y-2">
                                    {data.users.slice(0, 3).map((ranker, index) => (
                                        <div key={ranker.id} className="flex items-center justify-between py-1">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs border border-[#3D2C24] ${index === 0 ? 'bg-[#FFD166]' : 'bg-gray-100'}`}>
                                                    {index + 1}
                                                </div>
                                                <Link to={`/profile/${ranker.id}`} className="font-bold text-sm hover:text-[#FF7B9C] transition-colors">
                                                    {ranker.username}
                                                </Link>
                                                {ranker.top_recipe && (
                                                    <span className="text-[10px] font-bold opacity-40 flex items-center gap-0.5">
                                                        <UtensilsCrossed size={10} /> {ranker.top_recipe}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className="font-black text-sm text-[#FF7B9C]">{ranker.xp} XP</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="font-bold opacity-50 text-center py-4">No players found.</p>
                )}
            </section>

            {/* 📊 GLOBAL STATS */}
            <section className="cartoon-card bg-[#3D2C24] text-white">
                <h2 className="text-xl font-black flex items-center gap-2 mb-4">
                    <TrendingUp size={24} strokeWidth={3} className="text-[#FFD166]" /> Global Stats
                </h2>
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/10 rounded-xl p-3 text-center border border-white/20">
                        <p className="font-black text-2xl text-[#FFD166]">{totalUsers}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Players</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center border border-white/20">
                        <p className="font-black text-2xl text-[#A0E8AF]">{totalLogs}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Activities</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center border border-white/20">
                        <p className="font-black text-2xl text-[#FF7B9C]">{sortedCountries.length}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Regions</p>
                    </div>
                </div>
            </section>
        </div>
    )
}
