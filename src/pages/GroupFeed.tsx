import React, { useCallback, useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { Users, ArrowLeft, ThumbsUp, ThumbsDown, Crown, MessageCircle, X, HandCoins, Loader2, PartyPopper, Beer, ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import LiveCounter from "../components/LiveCounter"
import PhotoMetadata from "../components/PhotoMetadata"

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
        level?: number
    }
    log_appraisals?: {
        vote_type: string
        appraiser_id: string
    }[]
    photo_metadata?: any | null
    photo_verifications?: {
        verifier_id: string
        profiles?: { username: string }
    }[]
}



export default function GroupFeed() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useChug()

    const [group, setGroup] = useState<{ name: string, invite_code: string } | null>(null)
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(true)

    // Splitwise State
    const [showSplitModal, setShowSplitModal] = useState(false)
    const [splitTitle, setSplitTitle] = useState("")
    const [splitAmount, setSplitAmount] = useState("")
    const [groupMembers, setGroupMembers] = useState<{ id: string, username: string }[]>([])

    // Session State
    const [activeGroupSession, setActiveGroupSession] = useState<{ id: string; join_code: string } | null>(null)
    const [startingSession, setStartingSession] = useState(false)
    const [selectedSplitters, setSelectedSplitters] = useState<string[]>([])
    const [submittingSplit, setSubmittingSplit] = useState(false)
    const [splitMode, setSplitMode] = useState<'equal' | 'drink'>('equal')
    const [todayCounts, setTodayCounts] = useState<Record<string, number>>({})
    const [showSessionModal, setShowSessionModal] = useState(false)

    const fetchGroupData = useCallback(async () => {
        if (!id) return

        const { data: groupData } = await supabase
            .from("groups")
            .select("name, invite_code")
            .eq("id", id)
            .single()

        if (groupData) setGroup(groupData)

        const { data: membersData } = await supabase
            .from("group_members")
            .select("profiles(id, username)")
            .eq("group_id", id)

        let memberIds: string[] = []
        if (membersData) {
            const parsedMembers = membersData.map((m: any) => ({
                id: m.profiles.id,
                username: m.profiles.username
            }))
            setGroupMembers(parsedMembers)
            setSelectedSplitters(parsedMembers.map((m: any) => m.id))
            memberIds = parsedMembers.map((m: any) => m.id)
        }

        if (memberIds.length > 0) {
            const { data: logsData, error } = await supabase
                .from("activity_logs")
                .select(`
                    *,
                    profiles ( username, level ),
                    log_appraisals ( vote_type, appraiser_id )
                `)
                .in("user_id", memberIds)
                .order("created_at", { ascending: false })
                .limit(50)

            if (!error && logsData) {
                setLogs(logsData as any)
            }
        } else {
            setLogs([])
        }

        setLoading(false)
    }, [id])

    useEffect(() => {
        fetchGroupData()

        if (id) {
            const channel = supabase
                .channel(`group:${id}:activities`)
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `group_id=eq.${id}` },
                    () => fetchGroupData()
                )
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'activity_logs', filter: `group_id=eq.${id}` },
                    () => fetchGroupData()
                )
                .on(
                    'postgres_changes',
                    { event: 'DELETE', schema: 'public', table: 'activity_logs', filter: `group_id=eq.${id}` },
                    () => fetchGroupData()
                )
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'log_appraisals' },
                    () => fetchGroupData()
                )
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'log_appraisals' },
                    () => fetchGroupData()
                )
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'photo_verifications' },
                    () => fetchGroupData()
                )
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'photos', filter: `group_id=eq.${id}` },
                    () => fetchGroupData()
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [id, fetchGroupData])

    useEffect(() => {
        if (!showSplitModal || !id) return
        const fetchCounts = async () => {
            const today = new Date().toISOString().split('T')[0]
            const { data } = await supabase
                .from('beer_counts')
                .select('user_id, count')
                .in('user_id', groupMembers.map(m => m.id))
                .eq('date', today)

            if (data) {
                const counts: Record<string, number> = {}
                data.forEach(d => counts[d.user_id] = d.count)
                setTodayCounts(counts)
            }
        }
        fetchCounts()
    }, [showSplitModal, id, groupMembers])

    const handleAppraisal = async (logId: string, voteType: 'legit' | 'fake' | 'legendary') => {
        if (!user) return

        const targetLog = logs.find(l => l.id === logId)
        if (!targetLog) return
        if (targetLog.user_id === user.id) {
            alert("You cannot appraise your own activity.")
            return
        }

        const xpByVote: Record<'legit' | 'fake' | 'legendary', number> = {
            legit: 2,
            fake: -5,
            legendary: 10,
        }

        const previousVote = targetLog.log_appraisals?.find(a => a.appraiser_id === user.id)?.vote_type as 'legit' | 'fake' | 'legendary' | undefined
        const previousXp = previousVote ? xpByVote[previousVote] : 0
        const newXp = xpByVote[voteType]
        const xpDelta = newXp - previousXp

        const { error } = await supabase.from('log_appraisals').upsert({
            log_id: logId,
            appraiser_id: user.id,
            vote_type: voteType,
            xp_awarded: newXp
        }, { onConflict: 'log_id, appraiser_id' })

        if (!error) {
            if (targetLog.user_id && xpDelta !== 0) {
                await supabase.rpc('add_xp', { user_id_param: targetLog.user_id, xp_to_add: xpDelta })
            }
            fetchGroupData()
        } else {
            alert("Error appraising: " + error.message)
        }
    }

    const handleSplitSubmit = async () => {
        if (!user || !id || !splitTitle.trim() || !splitAmount || isNaN(Number(splitAmount))) return
        if (selectedSplitters.length === 0) return alert("Select at least one person to split with.")
        if (Number(splitAmount) <= 0) return alert("Amount must be greater than 0.")

        setSubmittingSplit(true)
        try {
            const amountNum = Number(splitAmount)
            // 1. Create Expense
            const { data: expData, error: expErr } = await supabase.from('group_expenses').insert({
                group_id: id,
                payer_id: user.id,
                description: splitTitle,
                amount: amountNum
            }).select().single()

            if (expErr) throw expErr

            // 2. Create Splits
            let splitsToInsert: any[] = []

            if (splitMode === 'equal') {
                const perPerson = Number((amountNum / selectedSplitters.length).toFixed(2))
                splitsToInsert = selectedSplitters.map(memberId => ({
                    expense_id: expData.id,
                    user_id: memberId,
                    amount_owed: perPerson
                }))
            } else {
                let totalDrinks = 0
                selectedSplitters.forEach(memberId => totalDrinks += (todayCounts[memberId] || 0))

                splitsToInsert = selectedSplitters.map(memberId => {
                    const userDrinks = todayCounts[memberId] || 0
                    const shareRatio = totalDrinks > 0 ? (userDrinks / totalDrinks) : (1 / selectedSplitters.length)
                    return {
                        expense_id: expData.id,
                        user_id: memberId,
                        amount_owed: Number((amountNum * shareRatio).toFixed(2))
                    }
                })
            }

            const { error: splitErr } = await supabase.from('expense_splits').insert(splitsToInsert)
            if (splitErr) throw splitErr

            alert("Expense added successfully!")
            setShowSplitModal(false)
            setSplitTitle("")
            setSplitAmount("")

            // Note: Since Splitwise just creates DB records, we just redirect to Balances if they want
        } catch (err: any) {
            alert("Error creating split: " + err.message)
        } finally {
            setSubmittingSplit(false)
        }
    }

    // Check for active drinking session for this group
    useEffect(() => {
        if (!id) return
        const checkSession = async () => {
            const { data } = await supabase
                .from('drinking_sessions')
                .select('id, join_code')
                .eq('group_id', id)
                .eq('status', 'active')
                .order('started_at', { ascending: false })
                .limit(1)
                .single()
            if (data) setActiveGroupSession(data)
            else setActiveGroupSession(null)
        }
        checkSession()
    }, [id])

    const handleStartGroupSession = async () => {
        if (!user || !id) return
        setStartingSession(true)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let code = ''
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
        const { data, error } = await supabase.from('drinking_sessions').insert({
            creator_id: user.id, group_id: id, join_code: code, status: 'active'
        }).select('id, join_code').single()
        if (data && !error) {
            await supabase.from('session_participants').insert({ session_id: data.id, user_id: user.id })
            navigate(`/session/${data.id}`)
        } else {
            alert('Failed to start session')
        }
        setStartingSession(false)
    }

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <button onClick={() => navigate('/groups')} className="p-2 rounded-full transition-transform active:scale-95" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    <ArrowLeft size={20} strokeWidth={2} />
                </button>
                <h1 className="text-2xl font-black truncate flex-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{group?.name || "Group"}</h1>
                <button
                    onClick={() => navigate(`/group/${id}/chat`)}
                    className="flex px-3 py-1.5 rounded-full font-black text-xs items-center gap-1 transition-transform active:scale-95 hover:scale-105"
                    style={{ background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid rgba(255,107,107,0.2)' }}
                >
                    <MessageCircle size={14} strokeWidth={2} /> Chat
                </button>
            </div>

            {/* Quick Actions / Info Row */}
            <div className="grid grid-cols-2 gap-2 my-4">
                {/* Invite Code */}
                <div onClick={() => { navigator.clipboard.writeText(group?.invite_code || ''); alert('Code Copied!') }} className="p-4 rounded-[4px] flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 cursor-pointer relative overflow-hidden group/tile" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)' }}>
                    <span className="text-[10px] uppercase font-bold tracking-widest leading-none z-10" style={{ color: 'var(--text-muted)' }}>Invite Code</span>
                    <span className="text-xl font-black tracking-widest mt-1 z-10" style={{ color: 'var(--amber)', fontFamily: 'Syne, sans-serif' }}>{group?.invite_code || "---"}</span>
                    <div className="absolute top-0 right-0 p-1 opacity-5 group-hover/tile:opacity-10 transition-opacity"><Users size={60} /></div>
                </div>

                {/* Start Party */}
                <button onClick={async () => {
                    if (!user || !id) return;
                    const { data, error } = await supabase.from('parties').insert({
                        host_id: user.id, title: `${group?.name || 'Group'} Party`, description: 'Group party!',
                        address: 'TBD', privacy_level: 'invite_only', group_id: id,
                        event_date: new Date().toISOString(), status: 'active'
                    }).select().single();
                    if (data) navigate(`/party/${data.id}`);
                    if (error) alert(error.message);
                }}
                    className="p-4 rounded-[4px] flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 relative overflow-hidden group/tile"
                    style={{ background: 'var(--coral-dim)', border: '1px solid rgba(209,32,32,0.3)' }}>
                    <PartyPopper size={24} style={{ color: 'var(--coral)' }} className="z-10" />
                    <span className="text-[10px] font-black uppercase tracking-widest z-10" style={{ color: 'var(--coral)' }}>Start Party</span>
                    <div className="absolute bottom-0 left-0 p-1 opacity-10 group-hover/tile:opacity-20 transition-opacity"><PartyPopper size={60} /></div>
                </button>

                {/* Add Split */}
                <button
                    onClick={() => setShowSplitModal(true)}
                    className="p-4 rounded-[4px] flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 relative overflow-hidden group/tile"
                    style={{ background: 'var(--amber-dim)', border: '1px solid rgba(216,162,94,0.3)' }}>
                    <HandCoins size={24} style={{ color: 'var(--amber)' }} className="z-10" />
                    <span className="text-[10px] font-black uppercase tracking-widest z-10" style={{ color: 'var(--amber)' }}>Add Split</span>
                    <div className="absolute bottom-0 right-0 p-1 opacity-10 group-hover/tile:opacity-20 transition-opacity"><HandCoins size={60} /></div>
                </button>

                {/* View Balances */}
                <button
                    onClick={() => navigate(`/group/${id}/balances`)}
                    className="p-4 rounded-[4px] flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 relative overflow-hidden group/tile"
                    style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)' }}>
                    <Crown size={24} style={{ color: 'var(--text-secondary)' }} className="z-10" />
                    <span className="text-[10px] font-black uppercase tracking-widest z-10" style={{ color: 'var(--text-secondary)' }}>Balances</span>
                    <div className="absolute top-0 left-0 p-1 opacity-5 group-hover/tile:opacity-10 transition-opacity"><Crown size={60} /></div>
                </button>
            </div>

            {/* Live Drinking Session */}
            {activeGroupSession ? (
                <button
                    onClick={() => navigate(`/session/${activeGroupSession.id}`)}
                    className="w-full flex items-center justify-between p-4 rounded-[4px] my-4 transition-transform active:scale-95 relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, rgba(209,32,32,0.15), rgba(216,162,94,0.1))', border: '1px solid rgba(209,32,32,0.3)', borderLeft: '4px solid var(--coral)' }}
                >
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--coral)', boxShadow: '0 0 12px rgba(209,32,32,0.5)' }} />
                        <div className="text-left">
                            <h2 className="font-black text-sm uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--coral)' }}>Crew is Drinking!</h2>
                            <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Code: {activeGroupSession.join_code} · Tap to join</span>
                        </div>
                    </div>
                    <ArrowRight size={18} style={{ color: 'var(--coral)' }} className="relative z-10" />
                </button>
            ) : (
                <button
                    onClick={handleStartGroupSession}
                    disabled={startingSession}
                    className="w-full flex items-center justify-between p-4 rounded-[4px] my-4 transition-transform active:scale-95 relative overflow-hidden"
                    style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)', borderLeft: '4px solid var(--amber)' }}
                >
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-10 h-10 rounded-[2px] flex items-center justify-center" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(216,162,94,0.3)', color: 'var(--amber)' }}>
                            <Beer size={20} />
                        </div>
                        <div className="text-left">
                            <h2 className="font-black text-sm uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
                                {startingSession ? 'Starting...' : 'Start Crew Session'}
                            </h2>
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Everyone in {group?.name || 'group'} can see</span>
                        </div>
                    </div>
                    <ArrowRight size={18} style={{ color: 'var(--amber)' }} className="relative z-10" />
                    <div className="absolute right-0 top-0 opacity-5 pointer-events-none -mr-4"><Beer size={80} /></div>
                </button>
            )}

            {/* Solo Live Leaderboard tile (auto-hides when empty) */}
            <LiveCounter groupId={id} showLeaderboard />

            {/* Splitwise Modal */}
            {showSplitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-sm relative">
                        <button onClick={() => setShowSplitModal(false)} className="absolute top-3 right-3 p-1" style={{ color: 'var(--text-muted)' }}>
                            <X size={20} strokeWidth={2} />
                        </button>

                        <h2 className="text-xl font-black mb-4 flex items-center gap-2" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
                            <HandCoins style={{ color: 'var(--acid)' }} size={24} strokeWidth={2} /> Add an Expense
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>What for?</label>
                                <input
                                    value={splitTitle}
                                    onChange={e => setSplitTitle(e.target.value)}
                                    placeholder="Dinner, Uber, Drinks..."
                                    className="glass-input w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>Amount Paid ($)</label>
                                <input
                                    type="number"
                                    value={splitAmount}
                                    onChange={e => setSplitAmount(e.target.value)}
                                    placeholder="0.00"
                                    step="0.01"
                                    className="glass-input w-full text-xl font-black" style={{ color: 'var(--amber)' }}
                                />
                                <p className="text-[10px] font-bold mt-1 uppercase" style={{ color: 'var(--text-muted)' }}>You paid this amount</p>
                            </div>

                            <div className="bg-white/3 p-3 rounded-xl border border-white/15/10">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="font-bold text-xs uppercase tracking-widest block" style={{ color: 'var(--text-secondary)' }}>Split Method</label>
                                    <div className="flex bg-black/20 rounded-lg p-1 border border-white/10">
                                        <button onClick={() => setSplitMode('equal')} className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${splitMode === 'equal' ? 'bg-white/10 text-white' : 'text-white/40'}`}>Equally</button>
                                        <button onClick={() => setSplitMode('drink')} className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${splitMode === 'drink' ? 'bg-amber-500/20 text-amber-500' : 'text-white/40'}`}>DrinkSplit</button>
                                    </div>
                                </div>

                                <div className="max-h-32 overflow-y-auto space-y-1 scrollbar-none pr-1">
                                    {groupMembers.map(member => (
                                        <label key={member.id} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors" style={{ border: '1px solid transparent' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedSplitters.includes(member.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedSplitters([...selectedSplitters, member.id])
                                                    else setSelectedSplitters(selectedSplitters.filter(id => id !== member.id))
                                                }}
                                                className="w-4 h-4 rounded" style={{ accentColor: 'var(--acid)' }}
                                            />
                                            <div className="flex-1 flex justify-between items-center">
                                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{member.id === user?.id ? "You" : member.username}</span>
                                                {splitMode === 'drink' && (
                                                    <span className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                                                        {todayCounts[member.id] || 0} drinks
                                                    </span>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleSplitSubmit}
                                disabled={submittingSplit}
                                className="glass-btn w-full flex items-center justify-center gap-2"
                            >
                                {submittingSplit ? <Loader2 size={20} className="animate-spin" /> : "Save Expense"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Navigation Buttons (Replacing Tabs) */}
            <div className="flex gap-3">
                <button
                    onClick={() => navigate(`/group/${id}/chat`)}
                    className="flex-1 py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-transform active:scale-95"
                    style={{ background: 'var(--acid-dim)', color: 'var(--acid)', border: '1px solid rgba(204,255,0,0.15)' }}
                >
                    <MessageCircle size={18} strokeWidth={2} style={{ color: 'var(--acid)' }} /> Group Chat
                </button>
            </div>

            {/* FEED SECTION */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                    <Users style={{ color: 'var(--amber)' }} size={24} strokeWidth={2} />
                    <h2 className="text-xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Activity Feed</h2>
                </div>

                <div className="glass-card text-center mb-6" style={{ borderColor: 'rgba(245,166,35,0.15)' }}>
                    <p className="font-bold" style={{ color: 'var(--text-secondary)' }}>To post to this group, use the main <span className="font-black" style={{ color: 'var(--amber)' }}>Log Activity</span> button (+) and ensure your visibility includes Groups.</p>
                </div>

                <div className="space-y-6">
                    {loading && logs.length === 0 && (
                        <div className="flex justify-center py-10 opacity-50">Fetching Scrolls...</div>
                    )}
                    {!loading && logs.length === 0 && (
                        <div className="text-center font-bold py-10" style={{ color: 'var(--text-muted)' }}>No activities shared with this group yet!</div>
                    )}
                    {logs.map((log) => {
                        const legitVotes = log.log_appraisals?.filter(a => a.vote_type === 'legit').length || 0
                        const fakeVotes = log.log_appraisals?.filter(a => a.vote_type === 'fake').length || 0
                        const legendaryVotes = log.log_appraisals?.filter(a => a.vote_type === 'legendary').length || 0
                        const userVote = log.log_appraisals?.find(a => a.appraiser_id === user?.id)?.vote_type

                        const catColors: Record<string, string> = { drink: 'var(--amber)', snack: 'var(--coral)', cigarette: 'var(--acid)', gym: 'var(--amber)', detox: 'var(--acid)' }
                        const badgeColor = catColors[log.category] || '#CCC'

                        const userLevel = log.profiles?.level || 1

                        let auraClass = ""
                        let auraStyle: React.CSSProperties = { border: '1px solid var(--border)' }
                        if (userLevel >= 25) { auraStyle = { border: '2px solid var(--acid)', boxShadow: 'var(--acid-glow)' } }
                        else if (userLevel >= 10) { auraStyle = { border: '2px solid var(--amber)', boxShadow: 'var(--amber-glow)' } }

                        return (
                            <div key={log.id} className="glass-card flex flex-col gap-3 anim-enter">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-8 h-8 rounded-full ${auraClass}`} style={{ ...auraStyle, backgroundColor: badgeColor }} />
                                        <div>
                                            <Link to={`/profile/${log.user_id}`} className="text-sm font-bold leading-none transition-colors" style={{ color: 'var(--text-secondary)' }}>
                                                {log.profiles?.username || "Unknown"}
                                            </Link>
                                            <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>{log.category}</p>
                                        </div>
                                    </div>
                                    <span className="font-black px-3 py-1 rounded-full text-xs" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                <h2 className="font-black text-2xl leading-none mb-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{log.item_name}</h2>
                                <p className="font-bold text-sm" style={{ color: 'var(--amber)' }}>Quantity/Duration: {log.quantity}</p>

                                {log.photo_url && (
                                    <div className="mt-2 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
                                        <img
                                            src={`${supabase.storage.from('photos').getPublicUrl(log.photo_url).data.publicUrl}`}
                                            alt={log.item_name}
                                            className="w-full h-auto object-cover max-h-64"
                                        />
                                        {log.photo_metadata && (
                                            <PhotoMetadata
                                                logId={log.id}
                                                metadata={log.photo_metadata}
                                                verifications={log.photo_verifications}
                                                onVerify={() => fetchGroupData()}
                                            />
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-dashed border-white/15/10">
                                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Appraise:</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleAppraisal(log.id, 'legit')}
                                            className="flex items-center gap-1 px-3 py-1 rounded-full font-black text-xs transition-transform hover:scale-105 active:scale-95"
                                            style={{ background: userVote === 'legit' ? 'var(--acid-dim)' : 'var(--bg-raised)', border: '1px solid var(--border)', color: userVote === 'legit' ? 'var(--acid)' : 'var(--text-secondary)' }}
                                        >
                                            <ThumbsUp size={14} strokeWidth={2} /> {legitVotes} Legit
                                        </button>

                                        <button
                                            onClick={() => handleAppraisal(log.id, 'fake')}
                                            className="flex items-center gap-1 px-3 py-1 rounded-full font-black text-xs transition-transform hover:scale-105 active:scale-95"
                                            style={{ background: userVote === 'fake' ? 'var(--coral-dim)' : 'var(--bg-raised)', border: '1px solid var(--border)', color: userVote === 'fake' ? 'var(--coral)' : 'var(--text-secondary)' }}
                                        >
                                            <ThumbsDown size={14} strokeWidth={2} /> {fakeVotes} Fake
                                        </button>

                                        <button
                                            onClick={() => handleAppraisal(log.id, 'legendary')}
                                            className="flex items-center gap-1 px-3 py-1 rounded-full font-black text-xs transition-transform hover:scale-105 active:scale-95"
                                            style={{ background: userVote === 'legendary' ? 'var(--amber-dim)' : 'var(--bg-raised)', border: '1px solid var(--border)', color: userVote === 'legendary' ? 'var(--amber)' : 'var(--text-secondary)' }}
                                        >
                                            <Crown size={14} strokeWidth={2} /> {legendaryVotes}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {loading && logs.length > 0 && (
                        <div className="text-center py-4 text-[10px] tracking-widest uppercase font-bold opacity-50" style={{ color: 'var(--amber)' }}>Updating...</div>
                    )}
                </div>
            </div>
        </div>
    )
}
