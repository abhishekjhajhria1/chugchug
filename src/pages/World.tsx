import { useState, useEffect, useMemo } from "react"
import { Globe, Trophy, UtensilsCrossed, Star, Flame, TrendingUp, Zap, Award, BarChart3, Sparkles, MessageSquareText, Plus, Loader2 } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { Link } from "react-router-dom"

interface WorldExperience {
    id: string
    user_id: string
    title: string
    content: string
    likes_count: number
    created_at: string
    profiles: {
        username: string
        avatar_url: string
    }
}

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
    const [experiences, setExperiences] = useState<WorldExperience[]>([])
    const [showExpForm, setShowExpForm] = useState(false)
    const [newExpTitle, setNewExpTitle] = useState("")
    const [newExpContent, setNewExpContent] = useState("")
    const [submittingExp, setSubmittingExp] = useState(false)

    const [challenges, setChallenges] = useState<Challenge[]>([
        { id: '1', title: 'Weekly Warrior', description: 'Log 10 activities this week', target: 10, current: 0, icon: '⚔️', color: '#FFD166' },
        { id: '2', title: 'Social Butterfly', description: 'Join 3 groups', target: 3, current: 0, icon: '🦋', color: '#A0E8AF' },
        { id: '3', title: 'Recipe Master', description: 'Log 5 recipes', target: 5, current: 0, icon: '👨‍🍳', color: '#FF7B9C' },
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
                    supabase
                        .from("world_experiences")
                        .select("*, profiles(username, avatar_url)")
                        .order("created_at", { ascending: false })
                        .limit(5),
                ])

                // Calculate Challenges dynamically
                try {
                    const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); startOfWeek.setHours(0,0,0,0)
                    const [ { data: weekLogs }, { count: grps } ] = await Promise.all([
                        supabase.from("activity_logs").select("id, photo_metadata").eq("user_id", user.id).gte("created_at", startOfWeek.toISOString()),
                        supabase.from("group_members").select("group_id", { count: "exact", head: true }).eq("user_id", user.id)
                    ])
                    
                    const wLogs = weekLogs || []
                    const currentActivityCount = wLogs.length
                    const recipeLogs = wLogs.filter(l => l.photo_metadata?.is_recipe).length
                    
                    setChallenges(prev => prev.map(c => {
                        if (c.id === '1') return { ...c, current: currentActivityCount }
                        if (c.id === '2') return { ...c, current: grps || 0 }
                        if (c.id === '3') return { ...c, current: recipeLogs }
                        return c
                    }))
                } catch(e) { console.error("Could not load challenges", e) }

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

                // Experiences are fetched below separately

                const { data: expData } = await supabase
                    .from("world_experiences")
                    .select("*, profiles(username, avatar_url)")
                    .order("created_at", { ascending: false })
                    .limit(5)
                
                if (expData) setExperiences(expData as WorldExperience[])

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

    const handleSubmitExp = async () => {
        if (!user || !newExpTitle.trim() || !newExpContent.trim()) return
        setSubmittingExp(true)
        const { data, error } = await supabase.from('world_experiences').insert({
            user_id: user.id,
            title: newExpTitle,
            content: newExpContent
        }).select('*, profiles(username, avatar_url)').single()
        
        if (data) {
            setExperiences([data as WorldExperience, ...experiences])
            setShowExpForm(false)
            setNewExpTitle("")
            setNewExpContent("")
        }
        if (error) alert("Error sharing tale: " + error.message)
        setSubmittingExp(false)
    }

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
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-white/90">
                <Globe className="animate-spin neon-amber mb-4" size={48} />
                <p className="font-bold opacity-50">Loading World...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-32">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <Globe className="text-white/90" size={36} strokeWidth={2} />
                    <h1 className="text-3xl font-black text-white/90">World</h1>
                </div>
                <div className="flex gap-2">
                    <div className="bg-amber-400/30 px-3 py-1 rounded-full border border-white/15 shadow-lg shadow-black/20 font-black text-xs">
                        {totalUsers} Players
                    </div>
                    <div className="bg-green-300/20 px-3 py-1 rounded-full border border-white/15 shadow-lg shadow-black/20 font-black text-xs">
                        {totalLogs} Logs
                    </div>
                </div>
            </div>

            {/* LIVE TICKER */}
            {recentActivities.length > 0 && (
                <div className="bg-[#3D2C24] rounded-xl px-4 py-3 flex items-center gap-3 overflow-hidden">
                    <div className="shrink-0 bg-pink-500/30 px-2 py-0.5 rounded-full font-black text-[10px] text-white uppercase tracking-wider animate-pulse">
                        Live
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-white font-bold text-sm truncate transition-all duration-500">
                            <span className="neon-amber">{recentActivities[tickerIndex]?.profiles?.username}</span>
                            {' '}logged{' '}
                            <span className="neon-lime">{recentActivities[tickerIndex]?.item_name}</span>
                            {' '}
                            <span className="opacity-50 text-xs">({recentActivities[tickerIndex]?.category})</span>
                        </p>
                    </div>
                    <Zap size={16} className="neon-amber shrink-0 animate-pulse" />
                </div>
            )}

            {/* PERSONAL STATS CARD */}
            {userPercentile !== null && (
                <div className="glass-card bg-gradient-to-r from-[#FFD166]/30 via-[#FF7B9C]/20 to-[#A0E8AF]/30 border-amber-400/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-amber-400/30 rounded-full border border-white/15 shadow-lg shadow-black/20 flex items-center justify-center">
                                <BarChart3 size={24} strokeWidth={2} className="text-white/90" />
                            </div>
                            <div>
                                <p className="font-black text-lg text-white/90 leading-tight">You're Top {100 - userPercentile}%</p>
                                <p className="text-xs font-bold text-white/90/60">Rank #{userRank} of {totalUsers} players worldwide</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-black text-2xl neon-pink">{profile?.xp || 0}</p>
                            <p className="text-[10px] font-black uppercase tracking-wider opacity-50">Total XP</p>
                        </div>
                    </div>
                    {/* XP Bar */}
                    <div className="mt-3 bg-white/5 rounded-full h-3 border border-white/15 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#FFD166] to-[#FF7B9C] rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(userPercentile, 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* 🌌 TALES FROM THE VOID (FORUM) */}
            <section className="glass-card bg-violet-500/20 border-violet-500/30 glow-violet">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-white/90 flex items-center gap-2">
                        <MessageSquareText className="neon-purple" size={24} strokeWidth={2} /> Tales from the Void
                    </h2>
                    {(profile?.xp ?? 0) > 50 && !showExpForm && (
                        <button onClick={() => setShowExpForm(true)} className="glass-btn-secondary py-1.5 px-3 text-xs">
                            <Plus size={14} /> Share Tale
                        </button>
                    )}
                </div>

                {showExpForm && (
                    <div className="bg-white/5 rounded-xl p-4 border border-white/15 mb-4 anim-slide">
                        <input 
                            value={newExpTitle} onChange={e => setNewExpTitle(e.target.value)}
                            placeholder="A wild night at..." 
                            className="glass-input mb-3 font-black text-lg" 
                        />
                        <textarea 
                            value={newExpContent} onChange={e => setNewExpContent(e.target.value)}
                            placeholder="Share your experience with the world (it was legendary, right?)" 
                            className="glass-input mb-3 h-24 resize-none"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setShowExpForm(false)} className="glass-btn-secondary flex-1">Cancel</button>
                            <button onClick={handleSubmitExp} disabled={submittingExp} className="glass-btn flex-1 bg-violet-500/30!">
                                {submittingExp ? <Loader2 className="animate-spin" size={16}/> : 'Post to Void'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {experiences.length === 0 ? (
                        <p className="text-center font-bold text-white/50 py-4">The void is silent. No tales yet.</p>
                    ) : (
                        experiences.map(exp => (
                            <div key={exp.id} className="bg-black/40 rounded-xl p-4 border border-white/5 shadow-inner">
                                <h3 className="font-black text-lg neon-amber mb-1 leading-tight">{exp.title}</h3>
                                <p className="text-sm font-medium text-white/80 mb-3">{exp.content}</p>
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-pink-500/30 overflow-hidden">
                                           {exp.profiles?.avatar_url && <img src={exp.profiles.avatar_url} className="w-full h-full object-cover"/>}
                                        </div>
                                        <span className="text-xs font-bold opacity-60">@{exp.profiles?.username}</span>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                                        {new Date(exp.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* 🔥 TRENDING NOW */}
            {trending.length > 0 && (
                <section className="glass-card bg-pink-500/30/10 border-pink-500/30">
                    <h2 className="text-xl font-black text-white/90 flex items-center gap-2 mb-4">
                        <Flame className="neon-pink" size={24} strokeWidth={2} /> Trending Now
                    </h2>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
                        {trending.map((item, i) => (
                            <div key={item.item_name} className="snap-start shrink-0 bg-white/5 rounded-xl px-4 py-3 border border-white/15 shadow-lg shadow-black/20 min-w-[140px]">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-black neon-pink text-lg">#{i + 1}</span>
                                    <Flame size={14} className="neon-pink" />
                                </div>
                                <p className="font-black text-white/90 leading-tight">{item.item_name}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mt-1">{item.count} logs • {item.category}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 🎯 DRINK OF THE DAY */}
            {drinkOfDay && (
                <section className="glass-card bg-gradient-to-br from-[#FFD166]/20 to-[#FF7B9C]/20 border-amber-400/30 relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                        <Sparkles className="neon-amber animate-pulse" size={20} />
                    </div>
                    <h2 className="text-xl font-black text-white/90 flex items-center gap-2 mb-3">
                        <span className="text-2xl">🎯</span> Drink of the Day
                    </h2>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/15 shadow-lg shadow-black/20">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-black text-2xl text-white/90 leading-tight">{drinkOfDay.item_name}</h3>
                                <p className="text-xs font-bold opacity-60 mt-1">by {drinkOfDay.profiles?.username} • {drinkOfDay.category}</p>
                            </div>
                            <div className="bg-green-400/30 px-3 py-1 rounded-full border border-white/15 font-black shadow-lg shadow-black/20">
                                ⭐ {drinkOfDay.xp_earned}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* 🏆 WEEKLY CHALLENGES */}
            <section className="glass-card bg-green-300/20/10 border-green-400/30">
                <h2 className="text-xl font-black text-white/90 flex items-center gap-2 mb-4">
                    <Award className="neon-lime" size={24} strokeWidth={2} /> Weekly Challenges
                </h2>
                <div className="space-y-3">
                    {challenges.map(c => {
                        const progress = Math.min((c.current / c.target) * 100, 100)
                        return (
                            <div key={c.id} className="bg-white/5 rounded-xl p-4 border border-white/15 shadow-lg shadow-black/20">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{c.icon}</span>
                                        <div>
                                            <p className="font-black text-white/90 leading-tight">{c.title}</p>
                                            <p className="text-[10px] font-bold opacity-50">{c.description}</p>
                                        </div>
                                    </div>
                                    <span className="font-black text-sm" style={{ color: c.color }}>
                                        {c.current}/{c.target}
                                    </span>
                                </div>
                                <div className="bg-white/8 rounded-full h-2 border border-white/15/20 overflow-hidden">
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
            <section className="glass-card bg-amber-400/30/20 border-amber-400/30">
                <h2 className="text-xl font-black text-white/90 flex items-center gap-2 mb-4">
                    <Star className="neon-amber" fill="#FFD166" size={24} /> Top World Activity
                </h2>

                {topActivity ? (
                    <div className="bg-white/5 rounded-xl p-4 border border-white/15 shadow-lg shadow-black/20 cursor-pointer hover:-translate-y-1 transition-transform">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/8 border border-white/15 overflow-hidden shrink-0">
                                    {topActivity.profiles?.avatar_url ? (
                                        <img src={topActivity.profiles.avatar_url} alt={topActivity.profiles.username} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-pink-500/30 text-white font-black text-xs uppercase">
                                            {topActivity.profiles?.username?.substring(0, 2)}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <Link to={`/profile/${topActivity.user_id}`} className="font-bold hover:neon-pink transition-colors">{topActivity.profiles?.username}</Link>
                                    <p className="text-xs font-bold opacity-50 uppercase tracking-widest">{topActivity.category}</p>
                                </div>
                            </div>
                            <div className="bg-green-400/30 px-3 py-1 rounded-full border border-white/15 font-black shadow-lg shadow-black/20">
                                ⭐ {topActivity.xp_earned}
                            </div>
                        </div>
                        <h3 className="text-xl font-black mt-3 leading-tight text-white/90">{topActivity.item_name}</h3>
                    </div>
                ) : (
                    <p className="font-bold opacity-50 text-center py-4">No activity found.</p>
                )}
            </section>

            {/* 🍳 TOP RECIPES */}
            <section className="glass-card bg-pink-500/30/10 border-pink-500/30">
                <h2 className="text-xl font-black text-white/90 flex items-center gap-2 mb-4">
                    <UtensilsCrossed className="neon-pink" size={24} strokeWidth={2} /> Top Recipes & Snacks
                </h2>

                {topRecipes.length > 0 ? (
                    <div className="space-y-4">
                        {topRecipes.map((recipe, index) => (
                            <div key={recipe.id} className="flex bg-white/5 rounded-xl border border-white/15 shadow-lg shadow-black/20 overflow-hidden">
                                <div className="bg-pink-500/30 text-white font-black flex items-center justify-center w-12 border-r-2 border-white/15">
                                    #{index + 1}
                                </div>
                                <div className="p-4 flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-black text-lg leading-tight">{recipe.item_name}</h3>
                                            <p className="text-xs font-bold opacity-60">by {recipe.profiles?.username}</p>
                                        </div>
                                        <span className="font-black neon-pink">⭐ {recipe.xp_earned}</span>
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
            <section className="glass-card bg-green-300/20/20 border-green-400/30">
                <h2 className="text-xl font-black text-white/90 flex items-center gap-2 mb-4">
                    <Trophy className="neon-lime" size={24} strokeWidth={2} /> Country Leaderboards
                </h2>

                {sortedCountries.length > 0 ? (
                    <div className="space-y-4">
                        {sortedCountries.map(([country, data], countryIdx) => (
                            <div key={country} className="bg-white/5 rounded-xl border border-white/15 shadow-lg shadow-black/20 overflow-hidden">
                                {/* Country Header */}
                                <div className={`flex items-center justify-between px-4 py-3 border-b-2 border-white/15 ${countryIdx === 0 ? 'bg-amber-400/30/30' : countryIdx === 1 ? 'bg-white/5' : 'bg-white/5'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{getFlag(country)}</span>
                                        <span className="font-black text-white/90 uppercase tracking-wide text-sm">{country}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black neon-pink text-sm">{data.totalXp} XP</span>
                                        <span className="text-[10px] font-bold opacity-40">({data.users.length} players)</span>
                                    </div>
                                </div>
                                {/* Players */}
                                <div className="px-4 py-2 space-y-2">
                                    {data.users.slice(0, 3).map((ranker, index) => (
                                        <div key={ranker.id} className="flex items-center justify-between py-1">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs border border-white/15 ${index === 0 ? 'bg-amber-400/30' : 'bg-white/5'}`}>
                                                    {index + 1}
                                                </div>
                                                <Link to={`/profile/${ranker.id}`} className="font-bold text-sm hover:neon-pink transition-colors">
                                                    {ranker.username}
                                                </Link>
                                                {ranker.top_recipe && (
                                                    <span className="text-[10px] font-bold opacity-40 flex items-center gap-0.5">
                                                        <UtensilsCrossed size={10} /> {ranker.top_recipe}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className="font-black text-sm neon-pink">{ranker.xp} XP</span>
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
            <section className="glass-card bg-[#3D2C24] text-white">
                <h2 className="text-xl font-black flex items-center gap-2 mb-4">
                    <TrendingUp size={24} strokeWidth={2} className="neon-amber" /> Global Stats
                </h2>
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/10 rounded-xl p-3 text-center border border-white/20">
                        <p className="font-black text-2xl neon-amber">{totalUsers}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Players</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center border border-white/20">
                        <p className="font-black text-2xl neon-lime">{totalLogs}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Activities</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center border border-white/20">
                        <p className="font-black text-2xl neon-pink">{sortedCountries.length}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Regions</p>
                    </div>
                </div>
            </section>
        </div>
    )
}
