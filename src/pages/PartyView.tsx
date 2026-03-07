import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { PartyPopper, Calendar, MapPin, Beer, ArrowLeft, Loader2, XCircle } from "lucide-react"
import { useChug } from "../context/ChugContext"

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
            <div className="flex flex-col items-center justify-center h-64 text-[#FF7B9C]">
                <Loader2 className="animate-spin w-12 h-12 mb-4" />
                <p className="font-bold">Locating Event...</p>
            </div>
        )
    }

    if (!party) {
        return (
            <div className="space-y-6 text-center pt-10">
                <h1 className="text-3xl font-black text-[#3D2C24]">Party Not Found</h1>
                <p className="font-bold opacity-70">This event may have been cancelled or the link is invalid.</p>
                <button onClick={() => navigate('/party')} className="cartoon-btn-secondary mx-auto block mt-8">
                    Back to Party Hub
                </button>
            </div>
        )
    }

    if (party?.status === 'ended' || party?.status === 'cancelled') {
        return (
            <div className="space-y-6 pb-24 text-center mt-10">
                <div className="w-20 h-20 bg-gray-200 rounded-full border-[3px] border-[#3D2C24] mx-auto flex items-center justify-center text-gray-500 mb-4 shadow-[4px_4px_0px_#3D2C24]">
                    <XCircle size={40} strokeWidth={2} />
                </div>
                <h1 className="text-3xl font-black text-[#3D2C24]">Event {party.status}</h1>
                <p className="font-bold text-[#3D2C24] opacity-70">This party has concluded and is no longer accepting RSVPs.</p>
                <div className="mt-8 flex justify-center">
                    <button onClick={() => navigate('/party')} className="cartoon-btn-secondary text-[#3D2C24] border-[#3D2C24]">
                        Return to Hub
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-24 max-w-lg mx-auto">
            <button onClick={() => navigate('/party')} className="flex items-center gap-2 font-bold text-sm text-[#3D2C24] opacity-70 hover:opacity-100 transition-opacity">
                <ArrowLeft size={16} strokeWidth={3} /> Back to Parties
            </button>

            <div className="cartoon-card bg-white border-[3px] border-[#3D2C24] shadow-[6px_6px_0px_#3D2C24] p-6 relative overflow-hidden">
                {/* Decorative corner element */}
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#FFD166] rounded-full flex items-end justify-start p-4 border-[3px] border-[#3D2C24]">
                    <PartyPopper size={24} className="text-[#3D2C24] transform rotate-12" strokeWidth={3} />
                </div>

                <div className="pr-12">
                    <span className={`inline-block px-3 py-1 bg-gray-100 text-xs font-black uppercase tracking-widest rounded-full border-2 border-[#3D2C24] mb-3 ${party.privacy_level === 'hidden' ? 'bg-[#FF7B9C] text-white' : 'bg-[#A0E8AF]'}`}>
                        {party.privacy_level}
                    </span>
                    <h1 className="text-4xl font-black text-[#3D2C24] leading-tight mb-2">{party.title}</h1>
                    <p className="font-bold text-lg text-[#3D2C24] opacity-80">Hosted by <span className="text-[#FF7B9C]">{party.profiles?.username}</span></p>
                </div>

                {party.description && (
                    <div className="mt-6 p-4 bg-[#A0E8AF]/20 rounded-xl border-2 border-[#A0E8AF]">
                        <p className="font-bold text-[#3D2C24] leading-relaxed">"{party.description}"</p>
                    </div>
                )}

                <div className="mt-8 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#FF7B9C]/20 border-2 border-[#FF7B9C] flex items-center justify-center shrink-0">
                            <Calendar size={20} className="text-[#FF7B9C]" strokeWidth={3} />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-[#3D2C24] opacity-50 mb-1">When</p>
                            <p className="font-black text-lg text-[#3D2C24]">{new Date(party.event_date).toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#FFD166]/20 border-2 border-[#FFD166] flex items-center justify-center shrink-0">
                            <MapPin size={20} className="text-[#cd7f32]" strokeWidth={3} />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-[#3D2C24] opacity-50 mb-1">Where</p>
                            <p className="font-black text-lg text-[#3D2C24]">{party.address}</p>
                        </div>
                    </div>

                    {(party.booze_details || party.snacks_details) && (
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-[#A0E8AF]/20 border-2 border-[#A0E8AF] flex items-center justify-center shrink-0">
                                <Beer size={20} className="text-[#60D394]" strokeWidth={3} />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-[#3D2C24] opacity-50 mb-1">Menu</p>
                                <div className="space-y-1">
                                    {party.booze_details && <p className="font-black text-[#3D2C24]">🥃 {party.booze_details}</p>}
                                    {party.snacks_details && <p className="font-black text-[#3D2C24]">🍕 {party.snacks_details}</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t-4 border-dashed border-[#3D2C24]/10">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-bold uppercase tracking-widest text-sm text-[#3D2C24] opacity-50">Entry Fee</span>
                        <span className="font-black text-2xl text-[#3D2C24]">{party.entry_fee}</span>
                    </div>

                    {user?.id !== party.host_id ? (
                        <div className="mt-6">
                            {!rsvpStatus ? (
                                <button
                                    onClick={handleRSVP}
                                    disabled={actionLoading}
                                    className="cartoon-btn w-full bg-[#FF7B9C]! text-white py-4! text-xl flex justify-center items-center gap-2"
                                >
                                    {actionLoading ? <Loader2 className="animate-spin" /> : "I'm Interested!"}
                                </button>
                            ) : (
                                <div className={`p-4 rounded-xl border-[3px] border-[#3D2C24] text-center font-black text-lg ${rsvpStatus === 'accepted' ? 'bg-[#A0E8AF] text-[#3D2C24]' :
                                    rsvpStatus === 'rejected' ? 'bg-[#FF7B9C] text-white' :
                                        'bg-[#FFD166] text-[#3D2C24]'
                                    }`}>
                                    Status: {rsvpStatus.toUpperCase()}
                                    {rsvpStatus === 'interested' && <p className="text-sm font-bold opacity-70 mt-1 uppercase">Waiting for Host Approval</p>}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="mt-6 p-4 bg-gray-100 rounded-xl border-2 border-dashed border-[#3D2C24]/20 text-center font-bold text-[#3D2C24]/50">
                            You are the host of this event. Manage guests in the Party Hub.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
