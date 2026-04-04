import { useState, useEffect, useMemo } from "react"
import { Globe, Trophy, UtensilsCrossed, Star, Flame, TrendingUp, Zap, Award, BarChart3, Sparkles, MessageSquareText, Plus, Loader2 } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { Link } from "react-router-dom"

interface WorldExperience {
    id: string; user_id: string; title: string; content: string; likes_count: number; created_at: string
    profiles: { username: string; avatar_url: string }
    reactions?: Record<string, string[]>
    comments?: { id: string; user_id: string; content: string; created_at: string; profiles?: { username: string; avatar_url?: string } }[]
}
interface Activity {
    id: string; user_id: string; item_name: string; category: string; xp_earned: number; photo_metadata?: any; created_at: string
    profiles: { username: string; avatar_url: string }
}
interface RankedUser { id: string; username: string; xp: number; level: number; city?: string; country?: string; top_recipe?: string }
interface TrendingItem { item_name: string; category: string; count: number }
interface Challenge { id: string; title: string; description: string; target: number; current: number; icon: string }

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
    const [activeCommentExp, setActiveCommentExp] = useState<string | null>(null)
    const [commentText, setCommentText] = useState("")

    const [challenges, setChallenges] = useState<Challenge[]>([
        { id: '1', title: 'Weekly Warrior', description: 'Log 10 activities this week', target: 10, current: 0, icon: '⚔️' },
        { id: '2', title: 'Social Butterfly', description: 'Join 3 groups', target: 3, current: 0, icon: '🦋' },
        { id: '3', title: 'Recipe Master', description: 'Log 5 recipes', target: 5, current: 0, icon: '👨‍🍳' },
    ])

    const [tickerIndex, setTickerIndex] = useState(0)

    useEffect(() => {
        const fetchWorldData = async () => {
            if (!user) return
            try {
                const [activityRes, recipeRes, rankRes, recentRes, countRes, logCountRes] = await Promise.all([
                    supabase.from("activity_logs").select("*, profiles(username, avatar_url)").order("xp_earned", { ascending: false }).limit(1),
                    supabase.from("activity_logs").select("*, profiles(username)").in('category', ['snack', 'drink']).order("xp_earned", { ascending: false }).limit(50),
                    supabase.from("profiles").select("id, username, xp, level, city, country").order("xp", { ascending: false }).limit(20),
                    supabase.from("activity_logs").select("*, profiles(username, avatar_url)").order("created_at", { ascending: false }).limit(15),
                    supabase.from("profiles").select("id", { count: "exact", head: true }),
                    supabase.from("activity_logs").select("id", { count: "exact", head: true }),
                    supabase.from("world_experiences").select("*, profiles(username, avatar_url)").order("created_at", { ascending: false }).limit(5),
                ])

                try {
                    const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); startOfWeek.setHours(0,0,0,0)
                    const [{ data: weekLogs }, { count: grps }] = await Promise.all([
                        supabase.from("activity_logs").select("id, photo_metadata").eq("user_id", user.id).gte("created_at", startOfWeek.toISOString()),
                        supabase.from("group_members").select("group_id", { count: "exact", head: true }).eq("user_id", user.id)
                    ])
                    const wLogs = weekLogs || []
                    setChallenges(prev => prev.map(c => {
                        if (c.id === '1') return { ...c, current: wLogs.length }
                        if (c.id === '2') return { ...c, current: grps || 0 }
                        if (c.id === '3') return { ...c, current: wLogs.filter(l => l.photo_metadata?.is_recipe).length }
                        return c
                    }))
                } catch(e) { console.error("Could not load challenges", e) }

                if (activityRes.data?.[0]) setTopActivity(activityRes.data[0] as Activity)

                if (recipeRes.data) {
                    const uniqueRecipes: Activity[] = []; const names = new Set<string>()
                    for (const r of recipeRes.data as Activity[]) {
                        if ((r.photo_metadata?.is_recipe || r.photo_metadata?.recipe_details) && !names.has(r.item_name)) {
                            names.add(r.item_name); uniqueRecipes.push(r)
                        }
                    }
                    setTopRecipes(uniqueRecipes.slice(0, 3))

                    const itemCounts: Record<string, { count: number; category: string }> = {}
                    for (const r of recipeRes.data) {
                        const key = r.item_name
                        if (!itemCounts[key]) itemCounts[key] = { count: 0, category: r.category }
                        itemCounts[key].count++
                    }
                    setTrending(Object.entries(itemCounts).map(([name, v]) => ({ item_name: name, category: v.category, count: v.count })).sort((a, b) => b.count - a.count).slice(0, 5))

                    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
                    const todayLogs = (recipeRes.data as Activity[]).filter(r => new Date(r.created_at) >= todayStart)
                    if (todayLogs.length > 0) setDrinkOfDay(todayLogs[0])
                    else if (recipeRes.data.length > 0) setDrinkOfDay(recipeRes.data[Math.floor(Math.random() * Math.min(5, recipeRes.data.length))] as Activity)
                }

                if (rankRes.data) {
                    const userIds = rankRes.data.map(r => r.id)
                    if (userIds.length > 0) {
                        const { data: favoriteData } = await supabase.from("activity_logs").select("user_id, item_name, xp_earned, category").in("user_id", userIds).in("category", ["drink", "snack"]).order("xp_earned", { ascending: false })
                        setTopRankers(rankRes.data.map(r => {
                            const userFavs = favoriteData?.filter(f => f.user_id === r.id) || []
                            return { ...r, top_recipe: userFavs.length > 0 ? userFavs[0].item_name : undefined }
                        }) as RankedUser[])
                    }
                    const idx = rankRes.data.findIndex(r => r.id === user.id)
                    if (idx !== -1) setUserRank(idx + 1)
                    else {
                        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).gt("xp", profile?.xp || 0)
                        setUserRank((count || 0) + 1)
                    }
                }

                if (recentRes.data) setRecentActivities(recentRes.data as Activity[])

                const { data: expData } = await supabase.from("world_experiences").select("*, profiles(username, avatar_url)").order("created_at", { ascending: false }).limit(5)
                if (expData) {
                    let finalExps = expData as WorldExperience[]
                    try {
                        const expIds = finalExps.map(e => e.id)
                        const { data: reactData } = await supabase.from("world_experience_reactions").select("*").in("experience_id", expIds)
                        const { data: commData } = await supabase.from("world_experience_comments").select("*, profiles(username, avatar_url)").in("experience_id", expIds).order("created_at", { ascending: true })
                        
                        const reactMap: Record<string, Record<string, string[]>> = {}
                        if (reactData) {
                            reactData.forEach(r => {
                                if(!reactMap[r.experience_id]) reactMap[r.experience_id] = {}
                                if(!reactMap[r.experience_id][r.emoji]) reactMap[r.experience_id][r.emoji] = []
                                reactMap[r.experience_id][r.emoji].push(r.user_id)
                            })
                        }
                        const commMap: Record<string, any[]> = {}
                        if (commData) {
                            commData.forEach(c => {
                                if(!commMap[c.experience_id]) commMap[c.experience_id] = []
                                commMap[c.experience_id].push(c)
                            })
                        }
                        finalExps = finalExps.map(e => ({ ...e, reactions: reactMap[e.id] || {}, comments: commMap[e.id] || [] }))
                    } catch(e) { console.error("Could not fetch tales interactions", e) }
                    setExperiences(finalExps)
                }

                setTotalUsers(countRes.count || 0)
                setTotalLogs(logCountRes.count || 0)
            } catch (error) { console.error("Error fetching world data", error) }
        }
        fetchWorldData()
    }, [user, profile])

    useEffect(() => {
        if (recentActivities.length === 0) return
        const interval = setInterval(() => setTickerIndex(prev => (prev + 1) % recentActivities.length), 3000)
        return () => clearInterval(interval)
    }, [recentActivities])

    const handleSubmitExp = async () => {
        if (!user || !newExpTitle.trim() || !newExpContent.trim()) return
        setSubmittingExp(true)
        const { data, error } = await supabase.from('world_experiences').insert({ user_id: user.id, title: newExpTitle, content: newExpContent }).select('*, profiles(username, avatar_url)').single()
        if (data) { setExperiences([data as WorldExperience, ...experiences]); setShowExpForm(false); setNewExpTitle(""); setNewExpContent("") }
        if (error) alert("Error sharing tale: " + error.message)
        setSubmittingExp(false)
    }

    const handleReact = async (expId: string, emoji: string) => {
        if(!user) return
        const exp = experiences.find(e => e.id === expId)
        if(!exp) return
        
        const hasReacted = exp.reactions?.[emoji]?.includes(user.id)
        const updatedReactions = { ...(exp.reactions || {}) }
        
        if(hasReacted) {
            updatedReactions[emoji] = updatedReactions[emoji].filter(id => id !== user.id)
            if(updatedReactions[emoji].length === 0) delete updatedReactions[emoji]
        } else {
            if(!updatedReactions[emoji]) updatedReactions[emoji] = []
            updatedReactions[emoji].push(user.id)
        }
        setExperiences(experiences.map(e => e.id === expId ? { ...e, reactions: updatedReactions } : e))

        if(hasReacted) {
            await supabase.from('world_experience_reactions').delete().match({ experience_id: expId, user_id: user.id, emoji })
        } else {
            await supabase.from('world_experience_reactions').insert({ experience_id: expId, user_id: user.id, emoji })
        }
    }

    const handleComment = async (expId: string) => {
        if(!user || !profile || !commentText.trim()) return
        const newComment = { id: Date.now().toString(), user_id: user.id, content: commentText, created_at: new Date().toISOString(), profiles: { username: profile.username || 'You', avatar_url: profile.avatar_url || '' } }
        setExperiences(experiences.map(e => e.id === expId ? { ...e, comments: [...(e.comments || []), newComment as any] } : e))
        
        const textToSave = commentText
        setCommentText('')
        await supabase.from('world_experience_comments').insert({ experience_id: expId, user_id: user.id, content: textToSave })
    }

    const countryGroups = useMemo(() => topRankers.reduce((acc, r) => {
        const country = r.country || r.city || 'Global'
        if (!acc[country]) acc[country] = { users: [], totalXp: 0 }
        acc[country].users.push(r); acc[country].totalXp += r.xp
        return acc
    }, {} as Record<string, { users: RankedUser[]; totalXp: number }>), [topRankers])

    const sortedCountries = useMemo(() => Object.entries(countryGroups).sort(([, a], [, b]) => b.totalXp - a.totalXp), [countryGroups])

    const userPercentile = useMemo(() => {
        if (!userRank || !totalUsers || totalUsers === 0) return null
        return Math.round(((totalUsers - userRank) / totalUsers) * 100)
    }, [userRank, totalUsers])



    return (
        <div className="space-y-6 pb-32">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <Globe size={36} strokeWidth={2} style={{ color: 'var(--text-primary)' }} />
                    <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.75rem', color: 'var(--text-primary)' }}>World</h1>
                </div>
                <div className="flex gap-2">
                    <div className="px-3 py-1 rounded-full text-xs font-black" style={{ background: 'var(--amber-dim)', border: '1px solid var(--border)', color: 'var(--amber)' }}>{totalUsers} Players</div>
                    <div className="px-3 py-1 rounded-full text-xs font-black" style={{ background: 'var(--acid-dim)', border: '1px solid var(--border)', color: 'var(--acid)' }}>{totalLogs} Logs</div>
                </div>
            </div>

            {/* LIVE TICKER */}
            {recentActivities.length > 0 && (
                <div className="rounded-sm px-4 py-3 flex items-center gap-3 overflow-hidden" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                    <div className="shrink-0 px-2 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider animate-pulse" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>Live</div>
                    <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm truncate transition-all duration-500" style={{ color: 'var(--text-primary)' }}>
                            <span style={{ color: 'var(--amber)' }}>{recentActivities[tickerIndex]?.profiles?.username}</span>
                            {' '}logged{' '}
                            <span style={{ color: 'var(--acid)' }}>{recentActivities[tickerIndex]?.item_name}</span>
                            {' '}<span className="text-xs" style={{ color: 'var(--text-muted)' }}>({recentActivities[tickerIndex]?.category})</span>
                        </p>
                    </div>
                    <Zap size={16} className="shrink-0 animate-pulse" style={{ color: 'var(--amber)' }} />
                </div>
            )}

            {/* PERSONAL STATS CARD */}
            {userPercentile !== null && (
                <div className="glass-card" style={{ background: 'linear-gradient(135deg, var(--amber-dim), rgba(204,255,0,0.08), rgba(255,107,107,0.06))', borderColor: 'rgba(245,166,35,0.2)' }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--amber-dim)', border: '1px solid var(--border)' }}>
                                <BarChart3 size={24} strokeWidth={2} style={{ color: 'var(--amber)' }} />
                            </div>
                            <div>
                                <p className="font-black text-lg leading-tight" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>You're Top {100 - userPercentile}%</p>
                                <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Rank #{userRank} of {totalUsers} players worldwide</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-black text-2xl" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>{profile?.xp || 0}</p>
                            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total XP</p>
                        </div>
                    </div>
                    <div className="mt-3 rounded-full h-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(userPercentile, 100)}%`, background: 'linear-gradient(90deg, var(--amber), var(--coral))' }} />
                    </div>
                </div>
            )}

            {/* 🌌 TALES FROM THE VOID */}
            <section className="glass-card" style={{ borderColor: 'rgba(245,166,35,0.15)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="flex items-center gap-2" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                        <MessageSquareText size={24} strokeWidth={2} style={{ color: 'var(--amber)' }} /> Tales from the Void
                    </h2>
                    {(profile?.xp ?? 0) > 50 && !showExpForm && (
                        <button onClick={() => setShowExpForm(true)} className="glass-btn-secondary py-1.5 px-3 text-xs">
                            <Plus size={14} /> Share Tale
                        </button>
                    )}
                </div>

                {showExpForm && (
                    <div className="rounded-sm p-4 mb-4 anim-slide" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                        <input value={newExpTitle} onChange={e => setNewExpTitle(e.target.value)} placeholder="A wild night at..." className="glass-input mb-3" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.1rem' }} />
                        <textarea value={newExpContent} onChange={e => setNewExpContent(e.target.value)} placeholder="Share your experience with the world..." className="glass-input mb-3" style={{ height: 96, resize: 'none' }} />
                        <div className="flex gap-2">
                            <button onClick={() => setShowExpForm(false)} className="glass-btn-secondary flex-1">Cancel</button>
                            <button onClick={handleSubmitExp} disabled={submittingExp} className="glass-btn flex-1">
                                {submittingExp ? <Loader2 className="animate-spin" size={16}/> : 'Post to Void'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {experiences.length === 0 ? (
                        <p className="text-center font-bold py-4" style={{ color: 'var(--text-muted)' }}>The void is silent. No tales yet.</p>
                    ) : (
                        experiences.map(exp => (
                            <div key={exp.id} className="rounded-sm p-4" style={{ background: 'var(--bg-mid)', border: '1px solid var(--border)' }}>
                                <h3 className="font-black text-lg mb-1 leading-tight" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>{exp.title}</h3>
                                <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>{exp.content}</p>
                                <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full overflow-hidden" style={{ background: 'var(--coral-dim)' }}>
                                           {exp.profiles?.avatar_url && <img src={exp.profiles.avatar_url} className="w-full h-full object-cover"/>}
                                        </div>
                                        <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>@{exp.profiles?.username}</span>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                                        {new Date(exp.created_at).toLocaleDateString()}
                                    </span>
                                </div>

                                {/* Reactions & Comments Bar */}
                                <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none pr-2">
                                        {['🔥', '💀', '🍻', '💯'].map(emoji => {
                                            const reacted = exp.reactions?.[emoji]?.includes(user?.id || '')
                                            const count = exp.reactions?.[emoji]?.length || 0
                                            return (
                                                <button key={emoji} onClick={() => handleReact(exp.id, emoji)} 
                                                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-transform active:scale-95 shrink-0"
                                                    style={{ 
                                                        background: reacted ? 'var(--amber-dim)' : 'var(--bg-deep)', 
                                                        border: `1px solid ${reacted ? 'rgba(245,166,35,0.3)' : 'var(--border)'}`,
                                                        color: reacted ? 'var(--amber)' : 'var(--text-muted)'
                                                    }}>
                                                    <span className="text-sm">{emoji}</span>
                                                    {count > 0 && <span className="font-bold">{count}</span>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <button onClick={() => setActiveCommentExp(activeCommentExp === exp.id ? null : exp.id)} 
                                        className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ml-auto transition-transform active:scale-95 shrink-0"
                                        style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                        <MessageSquareText size={14} /> 
                                        <span className="font-bold">{exp.comments?.length || 0}</span>
                                    </button>
                                </div>

                                {/* Comments Section */}
                                {activeCommentExp === exp.id && (
                                    <div className="mt-3 p-3 rounded-sm anim-slide" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}>
                                        <div className="space-y-3 mb-3 max-h-40 overflow-y-auto scrollbar-none">
                                            {(!exp.comments || exp.comments.length === 0) ? (
                                                <p className="text-center font-bold text-xs py-2" style={{ color: 'var(--text-ghost)' }}>No comments yet. Be the first!</p>
                                            ) : (
                                                exp.comments.map(c => (
                                                    <div key={c.id} className="text-sm leading-snug">
                                                        <span className="font-black mr-2" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--coral)' }}>@{c.profiles?.username || 'user'}</span>
                                                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.content}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <input 
                                                value={commentText} 
                                                onChange={e => setCommentText(e.target.value)} 
                                                onKeyDown={e => e.key === 'Enter' && handleComment(exp.id)}
                                                placeholder="Add a comment..." 
                                                className="glass-input flex-1 py-1.5 px-3 text-sm" 
                                            />
                                            <button 
                                                onClick={() => handleComment(exp.id)} 
                                                disabled={!commentText.trim()} 
                                                className="font-black text-xs uppercase tracking-widest px-3 rounded-lg disabled:opacity-30 transition-transform active:scale-95"
                                                style={{ background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid rgba(255,107,107,0.2)' }}>
                                                Post
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* 🔥 TRENDING NOW */}
            {trending.length > 0 && (
                <section className="glass-card" style={{ borderColor: 'rgba(255,107,107,0.15)' }}>
                    <h2 className="flex items-center gap-2 mb-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                        <Flame size={24} strokeWidth={2} style={{ color: 'var(--coral)' }} /> Trending Now
                    </h2>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
                        {trending.map((item, i) => (
                            <div key={item.item_name} className="snap-start shrink-0 rounded-sm px-4 py-3 min-w-[140px]" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-black text-lg" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--coral)' }}>#{i + 1}</span>
                                    <Flame size={14} style={{ color: 'var(--coral)' }} />
                                </div>
                                <p className="font-black leading-tight" style={{ color: 'var(--text-primary)' }}>{item.item_name}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>{item.count} logs • {item.category}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 🎯 DRINK OF THE DAY */}
            {drinkOfDay && (
                <section className="glass-card relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--amber-dim), rgba(255,107,107,0.08))', borderColor: 'rgba(245,166,35,0.2)' }}>
                    <div className="absolute top-2 right-2"><Sparkles className="animate-pulse" size={20} style={{ color: 'var(--amber)' }} /></div>
                    <h2 className="flex items-center gap-2 mb-3" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                        <span className="text-2xl">🎯</span> Drink of the Day
                    </h2>
                    <div className="rounded-sm p-4" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-black text-2xl leading-tight" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{drinkOfDay.item_name}</h3>
                                <p className="text-xs font-bold mt-1" style={{ color: 'var(--text-muted)' }}>by {drinkOfDay.profiles?.username} • {drinkOfDay.category}</p>
                            </div>
                            <div className="px-3 py-1 rounded-full font-black" style={{ background: 'var(--acid-dim)', border: '1px solid var(--border)', color: 'var(--acid)' }}>⭐ {drinkOfDay.xp_earned}</div>
                        </div>
                    </div>
                </section>
            )}

            {/* 🏆 WEEKLY CHALLENGES */}
            <section className="glass-card" style={{ borderColor: 'rgba(204,255,0,0.15)' }}>
                <h2 className="flex items-center gap-2 mb-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                    <Award size={24} strokeWidth={2} style={{ color: 'var(--acid)' }} /> Weekly Challenges
                </h2>
                <div className="space-y-3">
                    {challenges.map(c => {
                        const progress = Math.min((c.current / c.target) * 100, 100)
                        return (
                            <div key={c.id} className="rounded-sm p-4" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{c.icon}</span>
                                        <div>
                                            <p className="font-black leading-tight" style={{ color: 'var(--text-primary)' }}>{c.title}</p>
                                            <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{c.description}</p>
                                        </div>
                                    </div>
                                    <span className="font-black text-sm" style={{ color: 'var(--acid)' }}>{c.current}/{c.target}</span>
                                </div>
                                <div className="rounded-full h-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: 'var(--acid)' }} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* ⭐ TOP WORLD ACTIVITY */}
            <section className="glass-card" style={{ borderColor: 'rgba(245,166,35,0.15)' }}>
                <h2 className="flex items-center gap-2 mb-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                    <Star fill="var(--amber)" size={24} style={{ color: 'var(--amber)' }} /> Top World Activity
                </h2>
                {topActivity ? (
                    <div className="rounded-sm p-4 cursor-pointer hover:-translate-y-1 transition-transform" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                    {topActivity.profiles?.avatar_url ? (
                                        <img src={topActivity.profiles.avatar_url} alt={topActivity.profiles.username} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center font-black text-xs uppercase" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                                            {topActivity.profiles?.username?.substring(0, 2)}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <Link to={`/profile/${topActivity.user_id}`} className="font-bold transition-colors" style={{ color: 'var(--text-primary)' }}>{topActivity.profiles?.username}</Link>
                                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{topActivity.category}</p>
                                </div>
                            </div>
                            <div className="px-3 py-1 rounded-full font-black" style={{ background: 'var(--acid-dim)', border: '1px solid var(--border)', color: 'var(--acid)' }}>⭐ {topActivity.xp_earned}</div>
                        </div>
                        <h3 className="text-xl font-black mt-3 leading-tight" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{topActivity.item_name}</h3>
                    </div>
                ) : (
                    <p className="font-bold text-center py-4" style={{ color: 'var(--text-muted)' }}>No activity found.</p>
                )}
            </section>

            {/* 🍳 TOP RECIPES */}
            <section className="glass-card" style={{ borderColor: 'rgba(255,107,107,0.15)' }}>
                <h2 className="flex items-center gap-2 mb-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                    <UtensilsCrossed size={24} strokeWidth={2} style={{ color: 'var(--coral)' }} /> Top Recipes & Snacks
                </h2>
                {topRecipes.length > 0 ? (
                    <div className="space-y-4">
                        {topRecipes.map((recipe, index) => (
                            <div key={recipe.id} className="flex rounded-sm overflow-hidden" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                                <div className="font-black flex items-center justify-center w-12" style={{ background: 'var(--coral-dim)', color: 'var(--coral)', borderRight: '1px solid var(--border)' }}>#{index + 1}</div>
                                <div className="p-4 flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-black text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>{recipe.item_name}</h3>
                                            <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>by {recipe.profiles?.username}</p>
                                        </div>
                                        <span className="font-black" style={{ color: 'var(--coral)' }}>⭐ {recipe.xp_earned}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="font-bold text-center py-4" style={{ color: 'var(--text-muted)' }}>No top recipes logged yet.</p>
                )}
            </section>

            {/* 🌍 COUNTRY LEADERBOARDS */}
            <section className="glass-card" style={{ borderColor: 'rgba(204,255,0,0.15)' }}>
                <h2 className="flex items-center gap-2 mb-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                    <Trophy size={24} strokeWidth={2} style={{ color: 'var(--acid)' }} /> Country Leaderboards
                </h2>
                {sortedCountries.length > 0 ? (
                    <div className="space-y-4">
                        {sortedCountries.map(([country, data], countryIdx) => (
                            <div key={country} className="rounded-sm overflow-hidden" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                                <div className="flex items-center justify-between px-4 py-3" style={{ background: countryIdx === 0 ? 'var(--amber-dim)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{getFlag(country)}</span>
                                        <span className="font-black uppercase tracking-wide text-sm" style={{ color: 'var(--text-primary)' }}>{country}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-sm" style={{ color: 'var(--amber)' }}>{data.totalXp} XP</span>
                                        <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>({data.users.length} players)</span>
                                    </div>
                                </div>
                                <div className="px-4 py-2 space-y-2">
                                    {data.users.slice(0, 3).map((ranker, index) => (
                                        <div key={ranker.id} className="flex items-center justify-between py-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-xs" style={{ background: index === 0 ? 'var(--amber-dim)' : 'var(--bg-surface)', border: '1px solid var(--border)', color: index === 0 ? 'var(--amber)' : 'var(--text-muted)' }}>{index + 1}</div>
                                                <Link to={`/profile/${ranker.id}`} className="font-bold text-sm transition-colors" style={{ color: 'var(--text-primary)' }}>{ranker.username}</Link>
                                                {ranker.top_recipe && (
                                                    <span className="text-[10px] font-bold flex items-center gap-0.5" style={{ color: 'var(--text-ghost)' }}>
                                                        <UtensilsCrossed size={10} /> {ranker.top_recipe}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="font-black text-sm" style={{ color: 'var(--amber)' }}>{ranker.xp} XP</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="font-bold text-center py-4" style={{ color: 'var(--text-muted)' }}>No players found.</p>
                )}
            </section>

            {/* 📊 GLOBAL STATS */}
            <section className="glass-card" style={{ borderColor: 'rgba(245,166,35,0.15)' }}>
                <h2 className="flex items-center gap-2 mb-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                    <TrendingUp size={24} strokeWidth={2} style={{ color: 'var(--amber)' }} /> Global Stats
                </h2>
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-sm p-3 text-center" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                        <p className="font-black text-2xl" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>{totalUsers}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Players</p>
                    </div>
                    <div className="rounded-sm p-3 text-center" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                        <p className="font-black text-2xl" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--acid)' }}>{totalLogs}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Activities</p>
                    </div>
                    <div className="rounded-sm p-3 text-center" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                        <p className="font-black text-2xl" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--coral)' }}>{sortedCountries.length}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Regions</p>
                    </div>
                </div>
            </section>
        </div>
    )
}
