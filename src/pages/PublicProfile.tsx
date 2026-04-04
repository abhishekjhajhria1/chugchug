import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { UserCircle, ArrowLeft, UserPlus, Check } from "lucide-react"
import { useChug } from "../context/ChugContext"

interface PublicProfileData {
    id: string; username: string; bio: string; college: string; city: string; country: string
    stealth_mode: boolean; level: number; xp: number; created_at: string
}

export default function PublicProfile() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user } = useChug()
    const [profile, setProfile] = useState<PublicProfileData | null>(null)
    const [activities, setActivities] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted'>('none')

    useEffect(() => {
        const fetchUser = async () => {
            if (!id) return
            const { data: profileData, error: profileError } = await supabase.from("profiles").select("*").eq("id", id).single()
            if (profileError || !profileData) { setLoading(false); return }
            setProfile(profileData as PublicProfileData)

            if (!profileData.stealth_mode) {
                const { data: acts } = await supabase.from("activity_logs").select("*").eq("user_id", id).in("privacy_level", ["public", "groups"]).order("created_at", { ascending: false }).limit(20)
                if (acts) setActivities(acts)
            }

            if (user && id && user.id !== id) {
                const u1 = user.id < id ? user.id : id
                const u2 = user.id < id ? id : user.id
                const { data: fData } = await supabase.from('friendships').select('status').eq('user_1', u1).eq('user_2', u2).single()
                if (fData) setFriendStatus(fData.status)
            }
            setLoading(false)
        }
        fetchUser()
    }, [id, user])

    const handleAddFriend = async () => {
        if (!user || !id) return
        const u1 = user.id < id ? user.id : id
        const u2 = user.id < id ? id : user.id
        setFriendStatus('pending')
        await supabase.from('friendships').insert({ user_1: u1, user_2: u2, status: 'pending', action_user_id: user.id })
    }

    if (loading) return <div className="p-8 text-center font-bold" style={{ color: 'var(--text-muted)' }}>Loading Profile...</div>

    if (!profile) {
        return (
            <div className="space-y-6 text-center pt-10 pb-24">
                <h1 className="text-3xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>User Not Found</h1>
                <p className="font-bold" style={{ color: 'var(--text-muted)' }}>This profile does not exist.</p>
                <button onClick={() => navigate(-1)} className="glass-btn-secondary mx-auto block mt-8">Go Back</button>
            </div>
        )
    }

    return (
        <div className="space-y-6 flex flex-col items-center pb-24 max-w-lg mx-auto">
            <div className="w-full flex items-center mb-2">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full mr-4 transition-transform active:scale-90" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    <ArrowLeft size={20} strokeWidth={2} />
                </button>
                <h1 className="text-2xl font-black text-left flex-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{profile.username}'s Profile</h1>
            </div>

            <div className="glass-card w-full text-center py-8" style={{ borderColor: 'rgba(245,166,35,0.15)' }}>
                <div className="mb-4 rounded-full h-32 w-32 mx-auto flex items-center justify-center" style={{ background: 'var(--bg-raised)', border: '2px solid var(--amber)', color: 'var(--amber)' }}>
                    <UserCircle size={80} strokeWidth={1.5} />
                </div>
                <h2 className="text-3xl font-black tracking-wide mb-2" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)', textShadow: '0 0 20px rgba(245,166,35,0.3)' }}>
                    {profile.username}
                </h2>

                {profile.stealth_mode && <p className="font-black text-sm mt-2 flex items-center justify-center gap-2" style={{ color: 'var(--coral)' }}>🥷 Stealth Mode Active</p>}

                <div className="mt-4 px-4 space-y-2">
                    {profile.bio && !profile.stealth_mode && <p className="font-bold text-lg mb-4 leading-snug" style={{ color: 'var(--text-primary)' }}>"{profile.bio}"</p>}

                    {(profile.college || profile.city || profile.country) && !profile.stealth_mode && (
                        <div className="flex flex-col gap-2 rounded-xl p-4 text-left mt-4 mx-auto min-w-[200px]" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                            {profile.college && <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}><span className="uppercase tracking-widest text-xs block" style={{ color: 'var(--text-muted)' }}>College</span> {profile.college}</p>}
                            {profile.city && <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}><span className="uppercase tracking-widest text-xs block" style={{ color: 'var(--text-muted)' }}>City</span> {profile.city}</p>}
                            {profile.country && <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}><span className="uppercase tracking-widest text-xs block" style={{ color: 'var(--text-muted)' }}>Country</span> {profile.country}</p>}
                        </div>
                    )}
                </div>

                <div className="flex justify-center gap-4 mt-8">
                    <div className="rounded-xl px-6 py-3" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Level</p>
                        <p className="font-black text-2xl" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>{profile.level ?? "-"}</p>
                    </div>
                    <div className="rounded-xl px-6 py-3" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Total XP</p>
                        <p className="font-black text-2xl" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--acid)' }}>{profile.xp ?? "-"}</p>
                    </div>
                </div>

                {user && user.id !== id && (
                    <div className="mt-6 flex justify-center">
                        {friendStatus === 'accepted' ? (
                            <div className="px-6 py-3 rounded-xl flex items-center gap-2 font-black text-sm uppercase tracking-widest" style={{ background: 'var(--acid-dim)', color: 'var(--acid)', border: '1px solid rgba(204,255,0,0.2)' }}>
                                <Check size={18} /> Friends
                            </div>
                        ) : friendStatus === 'pending' ? (
                            <div className="px-6 py-3 rounded-xl flex items-center gap-2 font-black text-sm uppercase tracking-widest" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                Request Sent
                            </div>
                        ) : (
                            <button
                                onClick={handleAddFriend}
                                className="px-6 py-3 rounded-xl flex items-center gap-2 font-black text-sm uppercase tracking-widest transition-all active:scale-95"
                                style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(245,166,35,0.2)', boxShadow: 'var(--amber-glow)' }}
                            >
                                <UserPlus size={18} /> Add Friend
                            </button>
                        )}
                    </div>
                )}
            </div>

            {!profile.stealth_mode ? (
                <div className="w-full mt-6 space-y-4">
                    <h3 className="text-xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Public Log</h3>
                    {activities.length === 0 ? (
                        <div className="text-center font-bold py-4 glass-card" style={{ color: 'var(--text-muted)', borderStyle: 'dashed' }}>
                            No recent public activities.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activities.map(act => (
                                <div key={act.id} className="glass-card flex justify-between items-center p-4">
                                    <div>
                                        <p className="font-black text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>{act.item_name}</p>
                                        <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>
                                            {act.category} • Qty: {act.quantity}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-lg" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--acid)' }}>+{act.xp_earned} XP</p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-ghost)' }}>
                                            {new Date(act.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-full mt-6 space-y-4 text-center">
                    <div className="glass-card" style={{ borderStyle: 'dashed' }}>
                        <p className="font-black" style={{ color: 'var(--text-ghost)' }}>History Hidden by Stealth Mode</p>
                    </div>
                </div>
            )}
        </div>
    )
}
