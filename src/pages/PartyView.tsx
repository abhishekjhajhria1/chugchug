import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { PartyPopper, Calendar, MapPin, Beer, ArrowLeft, Loader2, XCircle } from "lucide-react"
import { useChug } from "../context/ChugContext"
import LiveCounter from "../components/LiveCounter"
import { firebaseDb } from "../lib/firebase"
import { ref, push, onChildAdded } from "firebase/database"

interface Party {
    id: string
    host_id: string
    title: string
    description: string
    entry_fee: string
    booze_details: string
    snacks_details: string
    address: string
    privacy_level: string
    event_date: string
    status: string
    profiles?: { username: string }
}

export default function PartyView() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user } = useChug()

    const [party, setParty] = useState<Party | null>(null)
    const [loading, setLoading] = useState(true)
    const [rsvpStatus, setRsvpStatus] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState(false)
    const [reactions, setReactions] = useState<{ id: string, emoji: string, leftPct: number }[]>([])

    // Load reactions from Firebase
    useEffect(() => {
        if (!id) return
        const reactionsRef = ref(firebaseDb, `parties/${id}/reactions`)
        
        const unsubscribe = onChildAdded(reactionsRef, (snapshot) => {
            const reaction = snapshot.val()
            const key = snapshot.key || Date.now().toString()
            const leftPct = 60 + Math.random() * 30
            setReactions(prev => [...prev.slice(-15), { id: key, emoji: reaction.emoji, leftPct }])
            // Auto remove reaction after 3s
            setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== key))
            }, 3000)
        })

        return () => unsubscribe()
    }, [id])

    const sendReaction = (emoji: string) => {
        if (!id || !user) return
        push(ref(firebaseDb, `parties/${id}/reactions`), {
            emoji,
            userId: user.id,
            timestamp: Date.now()
        })
    }

    useEffect(() => {
        const fetchEvent = async () => {
            if (!id || !user) return

            const { data: partyData, error: partyError } = await supabase
                .from("parties")
                .select("*, profiles:host_id(username)")
                .eq("id", id)
                .single()

            if (partyError || !partyData) {
                setLoading(false)
                return
            }
            setParty(partyData as Party)

            const { data: guestData } = await supabase
                .from("party_guests")
                .select("status")
                .eq("party_id", id)
                .eq("user_id", user.id)
                .single()

            if (guestData) {
                setRsvpStatus(guestData.status)
            }

            setLoading(false)
        }

        fetchEvent()
    }, [id, user])

    const handleRSVP = async () => {
        if (!user || !party) return
        setActionLoading(true)

        const { error } = await supabase
            .from("party_guests")
            .upsert({
                party_id: party.id,
                user_id: user.id,
                status: 'interested'
            })

        if (!error) {
            setRsvpStatus('interested')
        } else {
            alert("Failed to RSVP. " + error.message)
        }
        setActionLoading(false)
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 neon-pink">
                <Loader2 className="animate-spin w-12 h-12 mb-4" />
                <p className="font-bold">Locating Event...</p>
            </div>
        )
    }

    if (!party) {
        return (
            <div className="space-y-6 text-center pt-10">
                <h1 className="text-3xl font-black text-white/90">Party Not Found</h1>
                <p className="font-bold opacity-70">This event may have been cancelled or the link is invalid.</p>
                <button onClick={() => navigate('/party')} className="glass-btn-secondary mx-auto block mt-8">
                    Back to Party Hub
                </button>
            </div>
        )
    }

    if (party?.status === 'ended' || party?.status === 'cancelled') {
        return (
            <div className="space-y-6 pb-24 text-center mt-10">
                <div className="w-20 h-20 bg-white/8 rounded-full border border-white/15 mx-auto flex items-center justify-center text-white/40 mb-4 shadow-lg shadow-black/20">
                    <XCircle size={40} strokeWidth={2} />
                </div>
                <h1 className="text-3xl font-black text-white/90">Event {party.status}</h1>
                <p className="font-bold text-white/90 opacity-70">This party has concluded and is no longer accepting RSVPs.</p>
                <div className="mt-8 flex justify-center">
                    <button onClick={() => navigate('/party')} className="glass-btn-secondary text-white/90 border-white/15">
                        Return to Hub
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-24 max-w-lg mx-auto">
            <button onClick={() => navigate('/party')} className="flex items-center gap-2 font-bold text-sm text-white/90 opacity-70 hover:opacity-100 transition-opacity">
                <ArrowLeft size={16} strokeWidth={2} /> Back to Parties
            </button>

            <div className="glass-card bg-white/5 border border-white/15 shadow-lg shadow-black/20 p-6 relative overflow-hidden">
                {/* Decorative corner element */}
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-400/30 rounded-full flex items-end justify-start p-4 border border-white/15">
                    <PartyPopper size={24} className="text-white/90 transform rotate-12" strokeWidth={2} />
                </div>

                <div className="pr-12">
                    <span className={`inline-block px-3 py-1 bg-white/5 text-xs font-black uppercase tracking-widest rounded-full border border-white/15 mb-3 ${party.privacy_level === 'hidden' ? 'bg-pink-500/30 text-white' : 'bg-green-300/20'}`}>
                        {party.privacy_level}
                    </span>
                    <h1 className="text-4xl font-black text-white/90 leading-tight mb-2">{party.title}</h1>
                    <p className="font-bold text-lg text-white/90 opacity-80">Hosted by <span className="neon-pink">{party.profiles?.username}</span></p>
                </div>

                {/* Floating Reactions Container */}
                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                    {reactions.map(r => (
                        <div key={r.id} className="absolute bottom-0 left-[80%] text-4xl anim-float-up opacity-0" style={{
                            animationDuration: '3s',
                            left: `${r.leftPct}%`
                        }}>
                            {r.emoji}
                        </div>
                    ))}
                </div>

                {party.description && (
                    <div className="mt-6 p-4 bg-green-300/20/20 rounded-xl border border-green-400/30">
                        <p className="font-bold text-white/90 leading-relaxed">"{party.description}"</p>
                    </div>
                )}

                <div className="mt-8 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-pink-500/30/20 border border-pink-500/30 flex items-center justify-center shrink-0">
                            <Calendar size={20} className="neon-pink" strokeWidth={2} />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-white/90 opacity-50 mb-1">When</p>
                            <p className="font-black text-lg text-white/90">{new Date(party.event_date).toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-400/30/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                            <MapPin size={20} className="text-[#cd7f32]" strokeWidth={2} />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-white/90 opacity-50 mb-1">Where</p>
                            <p className="font-black text-lg text-white/90">{party.address}</p>
                        </div>
                    </div>

                    {(party.booze_details || party.snacks_details) && (
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-green-300/20/20 border border-green-400/30 flex items-center justify-center shrink-0">
                                <Beer size={20} className="neon-lime" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-white/90 opacity-50 mb-1">Menu</p>
                                <div className="space-y-1">
                                    {party.booze_details && <p className="font-black text-white/90">🥃 {party.booze_details}</p>}
                                    {party.snacks_details && <p className="font-black text-white/90">🍕 {party.snacks_details}</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t-4 border-dashed border-white/15/10">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-bold uppercase tracking-widest text-sm text-white/90 opacity-50">Entry Fee</span>
                        <span className="font-black text-2xl text-white/90">{party.entry_fee}</span>
                    </div>

                    {user?.id !== party.host_id ? (
                        <div className="mt-6">
                            {!rsvpStatus ? (
                                <button
                                    onClick={handleRSVP}
                                    disabled={actionLoading}
                                    className="glass-btn w-full bg-pink-500/30! text-white py-4! text-xl flex justify-center items-center gap-2"
                                >
                                    {actionLoading ? <Loader2 className="animate-spin" /> : "I'm Interested!"}
                                </button>
                            ) : (
                                <div className={`p-4 rounded-xl border border-white/15 text-center font-black text-lg ${rsvpStatus === 'accepted' ? 'bg-green-300/20 text-white/90' :
                                    rsvpStatus === 'rejected' ? 'bg-pink-500/30 text-white' :
                                        'bg-amber-400/30 text-white/90'
                                    }`}>
                                    Status: {rsvpStatus.toUpperCase()}
                                    {rsvpStatus === 'interested' && <p className="text-sm font-bold opacity-70 mt-1 uppercase">Waiting for Host Approval</p>}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="mt-6 p-4 bg-white/5 rounded-xl border border-dashed border-white/15/20 text-center font-bold text-white/90/50">
                            You are the host of this event. Manage guests in the Party Hub.
                        </div>
                    )}
                </div>

                {/* LIVE DASHBOARD - Visible to attendees and host */}
                {(rsvpStatus === 'interested' || rsvpStatus === 'accepted' || rsvpStatus === 'checked_in' || user?.id === party.host_id) && (
                    <div className="mt-8 pt-8 space-y-6" style={{ borderTop: '1px solid var(--glass-edge)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            <h2 className="text-xl font-black uppercase tracking-wider">Live Dashboard</h2>
                        </div>
                        
                        <LiveCounter partyId={party.id} showLeaderboard />

                        <div className="glass-card bg-white/5 border border-white/10 p-4 mt-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3 text-center">Send Live Reaction</p>
                            <div className="flex justify-center gap-4">
                                <button onClick={() => sendReaction('🔥')} className="text-2xl hover:scale-125 transition-transform active:scale-90 bg-white/5 p-3 rounded-full hover:bg-white/10">🔥</button>
                                <button onClick={() => sendReaction('🍻')} className="text-2xl hover:scale-125 transition-transform active:scale-90 bg-white/5 p-3 rounded-full hover:bg-white/10">🍻</button>
                                <button onClick={() => sendReaction('💖')} className="text-2xl hover:scale-125 transition-transform active:scale-90 bg-white/5 p-3 rounded-full hover:bg-white/10">💖</button>
                                <button onClick={() => sendReaction('💯')} className="text-2xl hover:scale-125 transition-transform active:scale-90 bg-white/5 p-3 rounded-full hover:bg-white/10">💯</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
