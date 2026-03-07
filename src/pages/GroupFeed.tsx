import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { Users, ArrowLeft, ThumbsUp, ThumbsDown, Crown } from "lucide-react"
import { Link } from "react-router-dom"

export interface ActivityLog {
    id: string
    user_id: string
    category: string
    item_name: string
    quantity: number
    xp_earned: number
    photo_url: string | null
    created_at: string
    profiles?: {
        username: string
    }
    log_appraisals?: {
        vote_type: string
        appraiser_id: string
    }[]
}

export default function GroupFeed() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useChug()

    const [group, setGroup] = useState<{ name: string, invite_code: string } | null>(null)
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(true)

    const fetchGroupData = async () => {
        if (!id) return

        const { data: groupData } = await supabase
            .from("groups")
            .select("name, invite_code")
            .eq("id", id)
            .single()

        if (groupData) setGroup(groupData)

        const { data: logsData, error } = await supabase
            .from("activity_logs")
            .select(`
                *,
                profiles:user_id ( username ),
                log_appraisals ( vote_type, appraiser_id )
            `)
            .in('privacy_level', ['public', 'groups'])
            .order("created_at", { ascending: false })
            .limit(50)

        if (!error && logsData) {
            setLogs(logsData as any)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchGroupData()

        if (id) {
            const channel = supabase
                .channel(`group:${id}:activities`)
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'activity_logs' },
                    () => fetchGroupData()
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [id])

    const handleAppraisal = async (logId: string, voteType: 'legit' | 'fake' | 'legendary') => {
        if (!user) return

        let bonusXp = 0
        if (voteType === 'legit') bonusXp = 2
        if (voteType === 'legendary') bonusXp = 10
        if (voteType === 'fake') bonusXp = -5

        const { error } = await supabase.from('log_appraisals').upsert({
            log_id: logId,
            appraiser_id: user.id,
            vote_type: voteType,
            xp_awarded: bonusXp
        }, { onConflict: 'log_id, appraiser_id' })

        if (!error) {
            const targetLog = logs.find(l => l.id === logId)
            if (targetLog && targetLog.user_id && bonusXp !== 0) {
                await supabase.rpc('add_xp', { user_id_param: targetLog.user_id, xp_to_add: bonusXp })
            }
            fetchGroupData() // Refresh to show new votes
        } else {
            alert("Error appraising: " + error.message)
        }
    }

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-center gap-4 mb-2">
                <button onClick={() => navigate('/groups')} className="p-2 bg-white rounded-full border-[3px] border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24] text-[#3D2C24]">
                    <ArrowLeft size={20} strokeWidth={3} />
                </button>
                <h1 className="text-2xl font-black text-[#3D2C24] truncate flex-1">{group?.name || "Group"}</h1>
                <div className="flex bg-[#A0E8AF] text-[#3D2C24] px-3 py-1.5 rounded-full border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24] font-black text-xs items-center gap-1">
                    <Users size={14} strokeWidth={3} /> Feed
                </div>
            </div>

            <div className="bg-white/50 border-[3px] border-[#3D2C24] border-dashed rounded-xl p-3 text-center mb-6 text-sm font-bold text-[#3D2C24] opacity-80">
                Invite Code: <span className="text-[#FF7B9C] select-all cursor-pointer text-lg tracking-widest bg-white px-2 py-0.5 rounded ml-1 border-2 border-[#3D2C24]">{group?.invite_code || "..."}</span>
            </div>

            <div className="cartoon-card bg-[#FFD166]/20 border-[#FFD166] text-center mb-6">
                <p className="font-bold text-[#3D2C24]">To post to this group, use the main <span className="text-[#FF7B9C] font-black">Log Activity</span> button (+) and ensure your visibility includes Groups.</p>
            </div>

            {loading ? (
                <div className="text-center font-bold text-[#3D2C24] opacity-50 py-10">Loading activities...</div>
            ) : (
                <div className="space-y-6">
                    {logs.length === 0 ? (
                        <div className="text-center font-bold text-[#3D2C24] opacity-50 py-10">No activities shared with this group yet!</div>
                    ) : (
                        logs.map((log) => {
                            const legitVotes = log.log_appraisals?.filter(a => a.vote_type === 'legit').length || 0
                            const fakeVotes = log.log_appraisals?.filter(a => a.vote_type === 'fake').length || 0
                            const legendaryVotes = log.log_appraisals?.filter(a => a.vote_type === 'legendary').length || 0
                            const userVote = log.log_appraisals?.find(a => a.appraiser_id === user?.id)?.vote_type

                            const catColors: Record<string, string> = { drink: '#FFD166', snack: '#FF9F1C', cigarette: '#A0E8AF', gym: '#118AB2', detox: '#06D6A0' }
                            const badgeColor = catColors[log.category] || '#CCC'

                            return (
                                <div key={log.id} className="cartoon-card flex flex-col gap-3 fade-in bg-white">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-full border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24]" style={{ backgroundColor: badgeColor }} />
                                            <div>
                                                <Link to={`/profile/${log.user_id}`} className="text-sm font-bold text-[#3D2C24] opacity-70 leading-none hover:text-[#FF7B9C] hover:opacity-100 transition-colors">
                                                    {log.profiles?.username || "Unknown"}
                                                </Link>
                                                <p className="text-[10px] uppercase font-black tracking-widest opacity-50">{log.category}</p>
                                            </div>
                                        </div>
                                        <span className="bg-gray-100 text-[#3D2C24] font-black px-3 py-1 rounded-full border-2 border-[#3D2C24] text-xs">
                                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <h2 className="font-black text-2xl text-[#3D2C24] leading-none mb-1">{log.item_name}</h2>
                                    <p className="font-bold text-[#FF7B9C] text-sm">Quantity/Duration: {log.quantity}</p>

                                    {/* Appraisals (Voting UI) */}
                                    <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-dashed border-[#3D2C24]/10">
                                        <p className="text-xs font-bold text-[#3D2C24] uppercase tracking-widest opacity-60">Appraise:</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAppraisal(log.id, 'legit')}
                                                className={`flex items-center gap-1 px-3 py-1 rounded-full border-2 border-[#3D2C24] font-black text-xs transition-transform hover:scale-105 active:scale-95 ${userVote === 'legit' ? 'bg-[#A0E8AF] shadow-[2px_2px_0px_#3D2C24]' : 'bg-gray-100'}`}
                                            >
                                                <ThumbsUp size={14} strokeWidth={3} /> {legitVotes} Legit
                                            </button>

                                            <button
                                                onClick={() => handleAppraisal(log.id, 'fake')}
                                                className={`flex items-center gap-1 px-3 py-1 rounded-full border-2 border-[#3D2C24] font-black text-xs transition-transform hover:scale-105 active:scale-95 ${userVote === 'fake' ? 'bg-[#FF7B9C] text-white shadow-[2px_2px_0px_#3D2C24]' : 'bg-gray-100'}`}
                                            >
                                                <ThumbsDown size={14} strokeWidth={3} /> {fakeVotes} Fake
                                            </button>

                                            <button
                                                onClick={() => handleAppraisal(log.id, 'legendary')}
                                                className={`flex items-center gap-1 px-3 py-1 rounded-full border-2 border-[#3D2C24] font-black text-xs transition-transform hover:scale-105 active:scale-95 ${userVote === 'legendary' ? 'bg-[#FFD166] shadow-[2px_2px_0px_#3D2C24]' : 'bg-gray-100'}`}
                                            >
                                                <Crown size={14} strokeWidth={3} /> {legendaryVotes}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
}
