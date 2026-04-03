import { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useChug } from "../context/ChugContext"
import { QRCodeSVG } from "qrcode.react"
import { supabase } from "../lib/supabase"
import { firebaseDb } from "../lib/firebase"
import { ref, get, set, serverTimestamp, onValue } from "firebase/database"
import LiveCounter from "../components/LiveCounter"
import BeerCounter from "../components/BeerCounter"
import { Share2, Users, Globe, PartyPopper, Zap, Clock } from "lucide-react"

// Base64 for a short "ding" sound
const CHUG_SOUND = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTv9T19Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Q"

export default function LiveParty() {
    const { partyId } = useParams()
    const navigate = useNavigate()
    const { user, profile } = useChug()
    const [sharing, setSharing] = useState(false)
    const [startTime] = useState(Date.now())
    const [elapsed, setElapsed] = useState("0:00")
    
    // Buzz state
    const [lastBuzz, setLastBuzz] = useState<{ userId: string; username: string; time: number } | null>(null)
    const [showBlast, setShowBlast] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    
    useEffect(() => {
        // Setup audio
        audioRef.current = new Audio(CHUG_SOUND)
    }, [])

    useEffect(() => {
        if (!partyId) {
            // Generate a random 6-character party ID
            const newPartyId = Math.random().toString(36).substring(2, 8).toUpperCase()
            navigate(`/live-party/${newPartyId}`, { replace: true })
            return
        }

        // Listen for Buzz (I'm Done) events in Firebase
        const buzzRef = ref(firebaseDb, `parties/${partyId}/last_buzz`)
        const unsubscribe = onValue(buzzRef, (snapshot) => {
            const data = snapshot.val()
            if (data && data.time > Date.now() - 5000) {
                if (data.userId !== user?.id) {
                    setLastBuzz(data)
                    setShowBlast(true)
                    audioRef.current?.play().catch(() => {})
                    setTimeout(() => setShowBlast(false), 3000)
                }
            }
        })

        // Timer
        const timer = setInterval(() => {
            const seconds = Math.floor((Date.now() - startTime) / 1000)
            const m = Math.floor(seconds / 60)
            const s = seconds % 60
            setElapsed(`${m}:${s.toString().padStart(2, '0')}`)
        }, 1000)

        return () => {
            unsubscribe()
            clearInterval(timer)
        }
    }, [partyId, navigate, user, startTime])

    const handleBuzz = () => {
        if (!partyId || !user) return
        set(ref(firebaseDb, `parties/${partyId}/last_buzz`), {
            userId: user.id,
            username: profile?.username || "Someone",
            time: serverTimestamp()
        })
    }

    const handleShareIndividually = async () => {
        if (!user) return
        setSharing(true)
        try {
            // Get party size quickly
            const snapshot = await get(ref(firebaseDb, `parties/${partyId}/counters`))
            const partySize = snapshot.exists() ? Object.keys(snapshot.val()).length : 1

            // Call the scaled RPC
            const { data: scaledXp, error: rpcError } = await supabase.rpc('add_party_xp', { 
                user_id_param: user.id, 
                base_xp: 5, 
                party_size: partySize 
            })

            const finalXp = (!rpcError && scaledXp) ? scaledXp : (5 * partySize)

            await supabase.from('activity_logs').insert({
                user_id: user.id,
                category: 'drink',
                item_name: 'Live Party',
                quantity: 1,
                xp_earned: finalXp,
                privacy_level: 'public'
            })
            alert("Shared to your individual Activity Feed!")
        } catch(e) {}
        setSharing(false)
    }

    const handleShareGroup = async () => {
        if (!user || !profile) return
        setSharing(true)
        try {
            await supabase.from('world_experiences').insert({
                user_id: user.id,
                title: `Live Party: ${partyId}`,
                content: `We're currently tearing it up at party ${partyId}! Such an epic session.`,
            })

            try {
                const snapshot = await get(ref(firebaseDb, `parties/${partyId}/counters`))
                let partySize = 1
                if (snapshot.exists()) {
                    const counters = snapshot.val()
                    const partyUserIds = Object.keys(counters)
                    partySize = partyUserIds.length
                }

                // 2. Add XP using the new Party size scaling RPC
                const { data: scaledXp, error: rpcError } = await supabase.rpc('add_party_xp', { 
                    user_id_param: user.id, 
                    base_xp: 5, 
                    party_size: partySize 
                })
                
                const finalXp = (!rpcError && scaledXp) ? scaledXp : (5 * partySize)

                if (partySize > 1 && snapshot.exists()) {
                    const counters = snapshot.val()
                    const partyUserIds = Object.keys(counters)
                    const { data } = await supabase.rpc('get_common_party_groups', { p_user_ids: partyUserIds })
                    if (data && data.length > 0) {
                        for (const group of data) {
                            await supabase.from('activity_logs').insert({
                                user_id: user.id,
                                category: 'drink',
                                item_name: 'Live Party',
                                quantity: 1,
                                xp_earned: finalXp,
                                privacy_level: 'groups',
                                group_id: group.group_id
                            })
                        }
                    }
                }
            } catch (e) {
                console.warn("Could not share to common groups", e)
            }

            alert("Shared the party to the World Forum and any Common Groups!")
        } catch(e) {}
        setSharing(false)
    }

    if (!partyId) return null

    const joinUrl = `${window.location.origin}/live-party/${partyId}`

    return (
        <div className="max-w-md mx-auto space-y-6 pb-24 font-sans px-4 pt-6 relative overflow-hidden">
            {/* Visual Blast Animation */}
            {showBlast && (
                <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center anim-pop">
                    <div className="absolute inset-0 bg-amber-400/20 backdrop-blur-sm animate-pulse" />
                    <div className="relative text-center">
                        <div className="text-6xl mb-4 animate-bounce">🍺💨</div>
                        <h2 className="text-3xl font-black text-white drop-shadow-[0_0_20px_rgba(251,191,36,0.8)] uppercase">
                            {lastBuzz?.username} FINISHED!
                        </h2>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6 px-1">
                <h1 className="page-title flex items-center gap-2">
                    <PartyPopper size={20} style={{ color: 'var(--coral)' }}/> Live Party
                </h1>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,166,35,0.2)' }}>
                    <Clock size={14} style={{ color: 'var(--amber)' }} />
                    <span className="text-xs font-black font-mono" style={{ color: 'var(--amber)' }}>{elapsed}</span>
                </div>
            </div>

            <div className="glass-card glow-rose border-rose-500/30 text-center p-8 flex flex-col items-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-rose-500/10 to-transparent pointer-events-none"></div>
                
                <h2 className="text-2xl font-black mb-1 relative z-10 text-white/90">
                    CODE: <span className="text-rose-400 tracking-wider">{partyId}</span>
                </h2>
                <p className="text-sm font-bold text-rose-200/60 mb-8 relative z-10 uppercase tracking-widest">
                    Scan to join session
                </p>
                
                <div className="bg-white p-4 rounded-3xl border border-white/20 shadow-[0_0_40px_rgba(244,63,94,0.3)] relative z-10 transform transition-transform hover:scale-105 duration-300">
                    <QRCodeSVG value={joinUrl} size={200} level="H" fgColor="#1a1530" bgColor="transparent" />
                </div>
            </div>

            <div className="glass-card glow-gold border-amber-500/20 bg-black/40 backdrop-blur-xl">
                <BeerCounter compact partyId={partyId} />
                
                {/* I'm Done Broadcast Button */}
                <div className="px-3 pb-2 pt-1">
                    <button 
                        onClick={handleBuzz}
                        className="w-full py-4 rounded-xl bg-linear-to-r from-rose-500 to-rose-600 text-white font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:shadow-[0_0_30px_rgba(244,63,94,0.5)] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Zap size={18} fill="currentColor" /> I'm Done! (Broadcast)
                    </button>
                </div>
                
                <div className="mt-4 pt-4 border-t border-white/10 px-2 pb-2">
                    <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                        <PartyPopper size={12} className="text-pink-400" /> Session Leaderboard
                    </h3>
                    <LiveCounter partyId={partyId} showLeaderboard />
                </div>
            </div>

            <div className="glass-card bg-white/5 border-white/10 mt-6 p-4">
               <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                   <Share2 size={12}/> Broadcast Party Stats
               </h3>
               <div className="flex flex-col gap-3">
                   <button onClick={handleShareGroup} disabled={sharing} className="w-full glass-btn bg-violet-500/20 text-violet-300 border-violet-500/30 py-3.5 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                       <Globe size={18} /> Share as Group (World Forum)
                   </button>
                   <button onClick={handleShareIndividually} disabled={sharing} className="w-full glass-btn-secondary bg-emerald-500/10 text-emerald-400 border-emerald-500/20 py-3 flex justify-center items-center gap-2">
                       <Users size={18} /> Share Individually (Activity Feed)
                   </button>
               </div>
            </div>
        </div>
    )
}
