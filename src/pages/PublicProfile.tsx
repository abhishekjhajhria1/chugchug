import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { UserCircle, ArrowLeft } from "lucide-react"

interface PublicProfileData {
    id: string
    username: string
    bio: string
    college: string
    city: string
    country: string
    stealth_mode: boolean
    level: number
    xp: number
    created_at: string
}

export default function PublicProfile() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [profile, setProfile] = useState<PublicProfileData | null>(null)
    const [activities, setActivities] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchUser = async () => {
            if (!id) return

            const { data: profileData, error: profileError } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", id)
                .single()

            if (profileError || !profileData) {
                setLoading(false)
                return
            }
            setProfile(profileData as PublicProfileData)

            if (!profileData.stealth_mode) {
                const { data: acts } = await supabase
                    .from("activity_logs")
                    .select("*")
                    .eq("user_id", id)
                    .in("privacy_level", ["public", "groups"]) // Only public/visible
                    .order("created_at", { ascending: false })
                    .limit(20)

                if (acts) setActivities(acts)
            }

            setLoading(false)
        }

        fetchUser()
    }, [id])

    if (loading) {
        return <div className="p-8 text-center font-bold">Loading Profile...</div>
    }

    if (!profile) {
        return (
            <div className="space-y-6 text-center pt-10 pb-24">
                <h1 className="text-3xl font-black text-[#3D2C24]">User Not Found</h1>
                <p className="font-bold opacity-70">This profile does not exist.</p>
                <button onClick={() => navigate(-1)} className="cartoon-btn-secondary mx-auto block mt-8">
                    Go Back
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6 flex flex-col items-center pb-24 max-w-lg mx-auto">
            <div className="w-full flex items-center mb-2">
                <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full border-[3px] border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24] text-[#3D2C24] mr-4 hover:-translate-y-0.5 transition-transform active:translate-y-0">
                    <ArrowLeft size={20} strokeWidth={3} />
                </button>
                <h1 className="text-2xl font-black text-left flex-1">{profile.username}'s Profile</h1>
            </div>

            <div className="cartoon-card bg-[#A0E8AF]/30 w-full text-center py-8">
                <div className="mb-4 bg-white rounded-full h-32 w-32 mx-auto flex items-center justify-center border-[3px] border-[#3D2C24] shadow-[4px_4px_0px_#3D2C24] text-[#A0E8AF]">
                    <UserCircle size={80} strokeWidth={2} />
                </div>
                <h2 className="text-3xl font-black text-[#FF7B9C] tracking-wide mb-2" style={{ textShadow: "1px 1px 0px #3D2C24" }}>
                    {profile.username}
                </h2>

                {profile.stealth_mode && <p className="font-black text-sm text-[#FF7B9C] mt-2 flex items-center justify-center gap-2">🥷 Stealth Mode Active</p>}

                <div className="mt-4 px-4 space-y-2">
                    {profile.bio && !profile.stealth_mode && <p className="font-bold text-[#3D2C24] text-lg mb-4 leading-snug">"{profile.bio}"</p>}

                    {(profile.college || profile.city || profile.country) && !profile.stealth_mode && (
                        <div className="flex flex-col gap-2 bg-white/50 rounded-xl p-4 border-[3px] border-[#3D2C24] text-left mt-4 inline-block mx-auto min-w-[200px]">
                            {profile.college && <p className="font-bold text-sm text-[#3D2C24]"><span className="opacity-70 uppercase tracking-widest text-xs block">College</span> {profile.college}</p>}
                            {profile.city && <p className="font-bold text-sm text-[#3D2C24]"><span className="opacity-70 uppercase tracking-widest text-xs block">City</span> {profile.city}</p>}
                            {profile.country && <p className="font-bold text-sm text-[#3D2C24]"><span className="opacity-70 uppercase tracking-widest text-xs block">Country</span> {profile.country}</p>}
                        </div>
                    )}
                </div>

                <div className="flex justify-center gap-4 mt-8">
                    <div className="bg-white border-[3px] border-[#3D2C24] rounded-xl px-6 py-3 shadow-[3px_3px_0px_#3D2C24]">
                        <p className="text-sm font-bold text-[#3D2C24] opacity-80 uppercase tracking-widest">Level</p>
                        <p className="font-black text-2xl text-[#FFD166]">{profile.level ?? "-"}</p>
                    </div>
                    <div className="bg-white border-[3px] border-[#3D2C24] rounded-xl px-6 py-3 shadow-[3px_3px_0px_#3D2C24]">
                        <p className="text-sm font-bold text-[#3D2C24] opacity-80 uppercase tracking-widest">Total XP</p>
                        <p className="font-black text-2xl text-[#60D394]">{profile.xp ?? "-"}</p>
                    </div>
                </div>
            </div>

            {/* ACTIVITY FEED */}
            {!profile.stealth_mode ? (
                <div className="w-full mt-6 space-y-4">
                    <h3 className="text-xl font-black text-[#3D2C24]">Public Log</h3>
                    {activities.length === 0 ? (
                        <div className="text-center font-bold opacity-50 py-4 cartoon-card bg-gray-100 border-dashed">
                            No recent public activities.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activities.map(act => (
                                <div key={act.id} className="cartoon-card bg-white flex justify-between items-center p-4">
                                    <div>
                                        <p className="font-black text-lg leading-tight text-[#3D2C24]">{act.item_name}</p>
                                        <p className="text-xs font-bold uppercase tracking-widest opacity-50 mt-1">
                                            {act.category} • Qty: {act.quantity}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-lg text-[#60D394]">+{act.xp_earned} XP</p>
                                        <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">
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
                    <div className="cartoon-card bg-gray-100 border-dashed border-gray-300 opacity-60">
                        <p className="font-black text-gray-500">History Hidden by Stealth Mode</p>
                    </div>
                </div>
            )}
        </div>
    )
}
