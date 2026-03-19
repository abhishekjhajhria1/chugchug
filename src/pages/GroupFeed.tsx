import { useCallback, useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { Users, ArrowLeft, ThumbsUp, ThumbsDown, Crown, MessageCircle, Camera, X, HandCoins, Loader2, PartyPopper } from "lucide-react"
import { Link } from "react-router-dom"
import PhotoUpload from "../components/PhotoUpload"
import BeerCounter from "../components/BeerCounter"
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

interface GroupPhoto {
    id: string
    url: string
    caption: string | null
    created_at: string
    profiles?: { username: string }
}

export default function GroupFeed() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useChug()

    const [group, setGroup] = useState<{ name: string, invite_code: string } | null>(null)
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [photos, setPhotos] = useState<GroupPhoto[]>([])
    const [loading, setLoading] = useState(true)
    const [showPhotoUpload, setShowPhotoUpload] = useState(false)
    const [lightboxPhoto, setLightboxPhoto] = useState<GroupPhoto | null>(null)

    // Splitwise State
    const [showSplitModal, setShowSplitModal] = useState(false)
    const [splitTitle, setSplitTitle] = useState("")
    const [splitAmount, setSplitAmount] = useState("")
    const [groupMembers, setGroupMembers] = useState<{ id: string, username: string }[]>([])
    const [selectedSplitters, setSelectedSplitters] = useState<string[]>([])
    const [submittingSplit, setSubmittingSplit] = useState(false)

    const fetchGroupData = useCallback(async () => {
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
                log_appraisals ( vote_type, appraiser_id ),
                photo_verifications ( verifier_id, profiles:verifier_id ( username ) )
            `)
            .eq('group_id', id)
            .order("created_at", { ascending: false })
            .limit(50)

        if (!error && logsData) {
            setLogs(logsData as any)
        }

        const { data: photosData } = await supabase
            .from("photos")
            .select("id, url, caption, created_at, profiles:user_id(username)")
            .eq("group_id", id)
            .order("created_at", { ascending: false })
            .limit(30)

        if (photosData) {
            setPhotos(photosData as any)
        }

        const { data: membersData } = await supabase
            .from("group_members")
            .select("profiles(id, username)")
            .eq("group_id", id)

        if (membersData) {
            const parsedMembers = membersData.map((m: any) => ({
                id: m.profiles.id,
                username: m.profiles.username
            }))
            setGroupMembers(parsedMembers)
            // Default to everyone selected
            setSelectedSplitters(parsedMembers.map((m: any) => m.id))
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
                    { event: 'INSERT', schema: 'public', table: 'activity_logs' },
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
                    { event: 'INSERT', schema: 'public', table: 'photos' },
                    () => fetchGroupData()
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [id, fetchGroupData])

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
            const perPerson = amountNum / selectedSplitters.length

            // 1. Create Expense
            const { data: expData, error: expErr } = await supabase.from('group_expenses').insert({
                group_id: id,
                payer_id: user.id,
                description: splitTitle,
                amount: amountNum
            }).select().single()

            if (expErr) throw expErr

            // 2. Create Splits
            const splitsToInsert = selectedSplitters.map(memberId => ({
                expense_id: expData.id,
                user_id: memberId,
                amount_owed: perPerson
            }))

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

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <button onClick={() => navigate('/groups')} className="p-2 bg-white/5 rounded-full border border-white/15 shadow-lg shadow-black/20 text-white/90 transition-transform active:scale-95">
                    <ArrowLeft size={20} strokeWidth={2} />
                </button>
                <h1 className="text-2xl font-black text-white/90 truncate flex-1">{group?.name || "Group"}</h1>
                <button
                    onClick={() => navigate(`/group/${id}/chat`)}
                    className="flex bg-pink-500/30 text-white px-3 py-1.5 rounded-full border border-white/15 shadow-lg shadow-black/20 font-black text-xs items-center gap-1 transition-transform active:scale-95 hover:scale-105"
                >
                    <MessageCircle size={14} strokeWidth={2} /> Chat
                </button>
            </div>

            {/* Quick Actions / Info Row */}
            <div className="flex gap-4">
               {/* Invite Code */}
               <div className="flex-1 bg-white/50 border border-white/15 border-dashed rounded-xl p-3 text-center text-sm font-bold text-white/90 opacity-80 flex flex-col justify-center">
                   <span className="mb-1 uppercase tracking-widest text-[10px]">Invite Code</span>
                   <span className="neon-pink select-all cursor-pointer text-xl tracking-widest bg-white/5 rounded border border-white/15 inline-block mx-auto px-4 py-1">{group?.invite_code || "..."}</span>
               </div>

                {/* Balances Quick Action */}
               <div className="flex-1 flex flex-col gap-2 justify-center">
                   <button 
                       onClick={() => setShowSplitModal(true)}
                       className="glass-btn-secondary text-xs! py-2! bg-amber-400/30 text-white/90 border-white/15 flex items-center justify-center gap-1 shadow-lg shadow-black/20"
                   >
                       <HandCoins size={14} strokeWidth={2} /> Add Split
                   </button>
                   <button 
                       onClick={() => navigate(`/group/${id}/balances`)}
                       className="glass-btn-secondary text-xs! py-2! bg-white/5 text-white/90 border-white/15 flex items-center justify-center gap-1 shadow-lg shadow-black/20"
                   >
                       <Crown size={14} strokeWidth={2} /> View Balances
                   </button>
                   <button 
                       onClick={async () => {
                           if (!user || !id) return
                           const { data, error } = await supabase.from('parties').insert({
                               host_id: user.id, title: `${group?.name || 'Group'} Party`, description: 'Group party!',
                               address: 'TBD', privacy_level: 'invite_only', group_id: id,
                               event_date: new Date().toISOString(), status: 'active'
                           }).select().single()
                           if (data) navigate(`/party/${data.id}`)
                           if (error) alert(error.message)
                       }}
                       className="glass-btn-secondary text-xs! py-2! bg-pink-500/30 text-white border-pink-500/30 flex items-center justify-center gap-1 shadow-lg shadow-black/20"
                   >
                       <PartyPopper size={14} strokeWidth={2} /> Start Party
                   </button>
               </div>
            </div>

            {/* Live Beer Counter for this Group */}
            <BeerCounter groupId={id} compact />
            <LiveCounter groupId={id} showLeaderboard />

            {/* Splitwise Modal */}
            {showSplitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="glass-card bg-white/5 w-full max-w-sm relative">
                        <button onClick={() => setShowSplitModal(false)} className="absolute top-3 right-3 p-1 text-white/90/50 hover:text-white/90">
                            <X size={20} strokeWidth={2} />
                        </button>
                        
                        <h2 className="text-xl font-black text-white/90 mb-4 flex items-center gap-2">
                            <HandCoins className="neon-lime" size={24} strokeWidth={2} /> Add an Expense
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-white/90 mb-1">What for?</label>
                                <input 
                                    value={splitTitle} 
                                    onChange={e => setSplitTitle(e.target.value)} 
                                    placeholder="Dinner, Uber, Drinks..." 
                                    className="glass-input w-full"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-white/90 mb-1">Amount Paid ($)</label>
                                <input 
                                    type="number"
                                    value={splitAmount} 
                                    onChange={e => setSplitAmount(e.target.value)} 
                                    placeholder="0.00" 
                                    step="0.01"
                                    className="glass-input w-full text-xl font-black neon-pink"
                                />
                                <p className="text-[10px] font-bold text-white/90/50 mt-1 uppercase">You paid this amount</p>
                            </div>

                            <div className="bg-white/3 p-3 rounded-xl border border-white/15/10">
                                <label className="flex items-center justify-between text-xs font-bold text-white/90 mb-2">
                                    <span className="uppercase tracking-widest">Split equally with:</span>
                                    <span className="text-white/90/50">{selectedSplitters.length} selected</span>
                                </label>
                                
                                <div className="max-h-32 overflow-y-auto space-y-1 scrollbar-none pr-1">
                                    {groupMembers.map(member => (
                                        <label key={member.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/15/10">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedSplitters.includes(member.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedSplitters([...selectedSplitters, member.id])
                                                    else setSelectedSplitters(selectedSplitters.filter(id => id !== member.id))
                                                }}
                                                className="w-4 h-4 rounded border border-white/15 neon-lime focus:ring-0"
                                            />
                                            <span className="font-bold text-sm text-white/90 flex-1 truncate">{member.id === user?.id ? "You" : member.username}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button 
                                onClick={handleSplitSubmit} 
                                disabled={submittingSplit}
                                className="glass-btn w-full bg-green-400/30! flex items-center justify-center gap-2"
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
                    className="flex-1 bg-green-300/20 py-3 rounded-xl border border-white/15 font-black text-white/90 shadow-lg shadow-black/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                    <MessageCircle size={18} strokeWidth={2} /> Group Chat
                </button>
                <button
                    onClick={() => {
                        document.getElementById('group-photos-section')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="flex-1 bg-amber-400/30 py-3 rounded-xl border border-white/15 font-black text-white/90 shadow-lg shadow-black/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                    <Camera size={18} strokeWidth={2} /> Jump to Photos {photos.length > 0 && <span className="bg-pink-500/30 text-white text-[10px] px-1.5 py-0.5 rounded-full">{photos.length}</span>}
                </button>
            </div>

            {/* FEED SECTION */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="neon-purple" size={24} strokeWidth={2} />
                    <h2 className="text-xl font-black text-white/90">Activity Feed</h2>
                </div>

                <div className="glass-card bg-amber-400/30/20 border-amber-400/30 text-center mb-6">
                    <p className="font-bold text-white/90">To post to this group, use the main <span className="neon-pink font-black">Log Activity</span> button (+) and ensure your visibility includes Groups.</p>
                </div>

                {loading ? (
                    <div className="text-center font-bold text-white/90 opacity-50 py-10">Loading activities...</div>
                ) : (
                    <div className="space-y-6">
                        {logs.length === 0 ? (
                            <div className="text-center font-bold text-white/90 opacity-50 py-10">No activities shared with this group yet!</div>
                        ) : (
                            logs.map((log) => {
                                const legitVotes = log.log_appraisals?.filter(a => a.vote_type === 'legit').length || 0
                                const fakeVotes = log.log_appraisals?.filter(a => a.vote_type === 'fake').length || 0
                                const legendaryVotes = log.log_appraisals?.filter(a => a.vote_type === 'legendary').length || 0
                                const userVote = log.log_appraisals?.find(a => a.appraiser_id === user?.id)?.vote_type

                                const catColors: Record<string, string> = { drink: '#FFD166', snack: '#FF9F1C', cigarette: '#A0E8AF', gym: '#118AB2', detox: '#06D6A0' }
                                const badgeColor = catColors[log.category] || '#CCC'

                                return (
                                    <div key={log.id} className="glass-card flex flex-col gap-3 animate-fadeInScale bg-white/5">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-8 h-8 rounded-full border border-white/15 shadow-lg shadow-black/20" style={{ backgroundColor: badgeColor }} />
                                                <div>
                                                    <Link to={`/profile/${log.user_id}`} className="text-sm font-bold text-white/90 opacity-70 leading-none hover:neon-pink hover:opacity-100 transition-colors">
                                                        {log.profiles?.username || "Unknown"}
                                                    </Link>
                                                    <p className="text-[10px] uppercase font-black tracking-widest opacity-50">{log.category}</p>
                                                </div>
                                            </div>
                                            <span className="bg-white/5 text-white/90 font-black px-3 py-1 rounded-full border border-white/15 text-xs">
                                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <h2 className="font-black text-2xl text-white/90 leading-none mb-1">{log.item_name}</h2>
                                        <p className="font-bold neon-pink text-sm">Quantity/Duration: {log.quantity}</p>

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
                                            <p className="text-xs font-bold text-white/90 uppercase tracking-widest opacity-60">Appraise:</p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleAppraisal(log.id, 'legit')}
                                                    className={`flex items-center gap-1 px-3 py-1 rounded-full border border-white/15 font-black text-xs transition-transform hover:scale-105 active:scale-95 ${userVote === 'legit' ? 'bg-green-300/20 shadow-lg shadow-black/20' : 'bg-white/5'}`}
                                                >
                                                    <ThumbsUp size={14} strokeWidth={2} /> {legitVotes} Legit
                                                </button>

                                                <button
                                                    onClick={() => handleAppraisal(log.id, 'fake')}
                                                    className={`flex items-center gap-1 px-3 py-1 rounded-full border border-white/15 font-black text-xs transition-transform hover:scale-105 active:scale-95 ${userVote === 'fake' ? 'bg-pink-500/30 text-white shadow-lg shadow-black/20' : 'bg-white/5'}`}
                                                >
                                                    <ThumbsDown size={14} strokeWidth={2} /> {fakeVotes} Fake
                                                </button>

                                                <button
                                                    onClick={() => handleAppraisal(log.id, 'legendary')}
                                                    className={`flex items-center gap-1 px-3 py-1 rounded-full border border-white/15 font-black text-xs transition-transform hover:scale-105 active:scale-95 ${userVote === 'legendary' ? 'bg-amber-400/30 shadow-lg shadow-black/20' : 'bg-white/5'}`}
                                                >
                                                    <Crown size={14} strokeWidth={2} /> {legendaryVotes}
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

            {/* PHOTOS SECTION */}
            <div id="group-photos-section" className="mt-12 pt-8 border-t-[3px] border-dashed border-white/15/20 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Camera className="neon-pink" size={24} strokeWidth={2} />
                    <h2 className="text-xl font-black text-white/90">Group Photos</h2>
                </div>

                {/* Upload Toggle */}
                {!showPhotoUpload ? (
                    <button
                        onClick={() => setShowPhotoUpload(true)}
                        className="glass-btn w-full bg-green-300/20! flex items-center justify-center gap-2"
                    >
                        <Camera size={18} strokeWidth={2} /> Share a Photo
                    </button>
                ) : (
                    <div className="relative">
                        <button onClick={() => setShowPhotoUpload(false)} className="absolute top-2 right-2 z-10 p-1 text-white/90/50 hover:text-white/90">
                            <X size={20} strokeWidth={2} />
                        </button>
                        {user && id && (
                            <PhotoUpload
                                groupId={id}
                                userId={user.id}
                                onUploadComplete={() => {
                                    setShowPhotoUpload(false)
                                    fetchGroupData()
                                }}
                            />
                        )}
                    </div>
                )}

                {/* Photo Grid */}
                {photos.length === 0 ? (
                    <div className="text-center glass-card bg-white/5 border-dashed opacity-70">
                        <p className="font-bold">No photos shared yet. Be the first! 📸</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {photos.map(photo => (
                            <div
                                key={photo.id}
                                className="relative rounded-xl overflow-hidden border border-white/15 shadow-lg shadow-black/20 cursor-pointer hover:-translate-y-1 transition-transform"
                                onClick={() => setLightboxPhoto(photo)}
                            >
                                <img src={photo.url} alt={photo.caption || "Group photo"} className="w-full h-40 object-cover" />
                                <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-2">
                                    <p className="text-white font-bold text-xs truncate">{photo.profiles?.username}</p>
                                    {photo.caption && <p className="text-white/80 text-[10px] truncate">{photo.caption}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                    {/* Lightbox */}
                    {lightboxPhoto && (
                        <div className="fixed inset-0 z-100 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxPhoto(null)}>
                            <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setLightboxPhoto(null)} className="absolute -top-3 -right-3 p-2 bg-white/5 rounded-full border border-white/15 shadow-lg shadow-black/20 z-10">
                                    <X size={16} strokeWidth={2} />
                                </button>
                                <img src={lightboxPhoto.url} alt={lightboxPhoto.caption || ""} className="w-full rounded-2xl border border-white/15" />
                                <div className="bg-white/5 rounded-b-2xl border-x-[3px] border-b-[3px] border-white/15 p-4 -mt-2">
                                    <p className="font-black text-white/90">{lightboxPhoto.profiles?.username}</p>
                                    {lightboxPhoto.caption && <p className="font-bold text-sm text-white/90/70 mt-1">{lightboxPhoto.caption}</p>}
                                    <p className="text-[10px] font-bold text-white/90/40 mt-2">{new Date(lightboxPhoto.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
        </div>
    )
}
