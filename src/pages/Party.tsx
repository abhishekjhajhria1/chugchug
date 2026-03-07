import { useState, useEffect, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { PartyPopper, Calendar, MapPin, Beer, CheckCircle2, XCircle } from "lucide-react"
import { Link } from "react-router-dom"

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

interface Guest {
  user_id: string
  status: string
  profiles: { username: string }
}

interface HostedParty extends Party {
  party_guests?: Guest[]
}

export default function Party() {
  const { user } = useChug()
  const [view, setView] = useState<'feed' | 'create' | 'manage' | 'history'>('feed')

  const [parties, setParties] = useState<Party[]>([])

  const [form, setForm] = useState({
    title: "", description: "", entry_fee: "Free", booze_details: "", snacks_details: "", address: "", privacy: "invite_only", date: ""
  })

  const [hostedParties, setHostedParties] = useState<HostedParty[]>([])

  const [pastParties, setPastParties] = useState<HostedParty[]>([])
  const [loading, setLoading] = useState(false)

  const fetchFeed = useCallback(async () => {
    const { data } = await supabase
      .from("parties")
      .select('*, profiles:host_id(username)')
      .neq('privacy_level', 'hidden')
      .in('status', ['upcoming', 'active'])
      .order('event_date', { ascending: true })
    if (data) setParties(data as Party[])
  }, [])

  const fetchHosted = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from("parties")
      .select('*, party_guests(user_id, status, profiles(username))')
      .eq('host_id', user.id)
      .in('status', ['upcoming', 'active'])
      .order('event_date', { ascending: true })
    if (data) setHostedParties(data as HostedParty[])
  }, [user])

  const fetchHistory = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from("parties")
      .select('*, party_guests(user_id, status, profiles(username))')
      .eq('host_id', user.id)
      .in('status', ['ended', 'cancelled'])
      .order('event_date', { ascending: false })
    if (data) setPastParties(data as HostedParty[])
  }, [user])

  useEffect(() => {
    const loadData = async () => {
      await fetchFeed()
      await fetchHosted()
      await fetchHistory()
    }
    loadData()
  }, [fetchFeed, fetchHosted, fetchHistory])


  const handleCreate = async () => {
    if (!user || !form.title || !form.address || !form.date) return alert("Fill required fields (Title, Address, Date)")
    setLoading(true)
    const { error } = await supabase.from("parties").insert({
      host_id: user.id,
      title: form.title,
      description: form.description,
      entry_fee: form.entry_fee,
      booze_details: form.booze_details,
      snacks_details: form.snacks_details,
      address: form.address,
      privacy_level: form.privacy,
      event_date: new Date(form.date).toISOString()
    })

    if (!error) {
      setView('feed')
      fetchFeed()
      fetchHosted()
    } else {
      alert(error.message)
    }
    setLoading(false)
  }

  const handleInterest = async (partyId: string) => {
    if (!user) return
    const { error } = await supabase.from("party_guests").insert({
      party_id: partyId,
      user_id: user.id,
      status: 'interested'
    })
    if (!error) alert("Host notified of your interest!")
  }

  const updateGuestStatus = async (partyId: string, guestId: string, status: 'accepted' | 'rejected') => {
    await supabase.from("party_guests").update({ status }).eq('party_id', partyId).eq('user_id', guestId)
    fetchHosted() // Refresh list entirely to update UI
  }

  const handleEndParty = async (partyId: string) => {
    if (window.confirm("Are you sure you want to end this party? It will be moved to history.")) {
      await supabase.from("parties").update({ status: 'ended' }).eq('id', partyId)
      fetchHosted()
      fetchHistory()
    }
  }

  const copyInviteLink = (partyId: string) => {
    const link = `${window.location.origin}/party/${partyId}`
    navigator.clipboard.writeText(link)
    alert("Invite link copied to clipboard!")
  }

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-3xl font-black mb-2 flex items-center gap-3 text-[#3D2C24]">
        <PartyPopper size={32} strokeWidth={3} className="text-[#FF7B9C]" /> Party Hub
      </h1>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl border-[3px] border-[#3D2C24] overflow-hidden shadow-[2px_2px_0px_#3D2C24] mb-6 font-bold text-xs">
        <button onClick={() => setView('feed')} className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap py-2 ${view === 'feed' ? 'bg-[#FFD166] text-[#3D2C24]' : 'text-[#3D2C24]/50'}`}>Discover</button>
        <div className="w-0.75 bg-[#3D2C24]" />
        <button onClick={() => setView('create')} className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap py-2 ${view === 'create' ? 'bg-[#FF7B9C] text-white' : 'text-[#3D2C24]/50'}`}>Host</button>
        <div className="w-0.75 bg-[#3D2C24]" />
        <button onClick={() => setView('manage')} className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap py-2 ${view === 'manage' ? 'bg-[#A0E8AF] text-[#3D2C24]' : 'text-[#3D2C24]/50'}`}>Manage</button>
        <div className="w-0.75 bg-[#3D2C24]" />
        <button onClick={() => setView('history')} className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap py-2 ${view === 'history' ? 'bg-[#118AB2] text-white' : 'text-[#3D2C24]/50'}`}>History</button>
      </div>

      {/* DISCOVER VIEW */}
      {view === 'feed' && (
        <div className="space-y-4">
          {parties.length === 0 && <p className="text-center font-bold opacity-50 mt-10">No upcoming parties found.</p>}
          {parties.map(p => (
            <div key={p.id} className="cartoon-card bg-white border-[#FF7B9C]">
              <div className="flex justify-between items-start mb-2">
                <h2 className="font-black text-xl text-[#3D2C24]">{p.title}</h2>
                <span className="bg-[#FFD166] px-2 py-0.5 rounded-full border-2 border-[#3D2C24] font-black text-xs transform rotate-3">
                  {p.entry_fee}
                </span>
              </div>
              <p className="text-sm font-bold text-[#3D2C24] opacity-70 mb-3">Host: <Link to={`/profile/${p.host_id}`} className="hover:text-[#FF7B9C] hover:opacity-100 transition-colors">{p.profiles?.username}</Link></p>

              <div className="space-y-1 mb-4">
                <p className="text-sm font-bold flex items-center gap-2"><Calendar size={16} className="text-[#A0E8AF]" /> {new Date(p.event_date).toLocaleDateString()}</p>
                <p className="text-sm font-bold flex items-center gap-2"><MapPin size={16} className="text-[#FF7B9C]" /> {p.address}</p>
                {(p.booze_details || p.snacks_details) && (
                  <p className="text-sm font-bold flex items-center gap-2"><Beer size={16} className="text-[#FFD166]" /> {p.booze_details} | {p.snacks_details}</p>
                )}
              </div>

              <button onClick={() => handleInterest(p.id)} className="cartoon-btn-secondary w-full border-[#A0E8AF] text-[#60D394]">
                I'm Interested
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CREATE VIEW */}
      {view === 'create' && (
        <div className="cartoon-card bg-[#FF7B9C]/10 border-[#FF7B9C] space-y-4">
          <h2 className="text-2xl font-black text-[#3D2C24] mb-4">Plan a Rager</h2>

          <div className="space-y-3">
            <input type="text" placeholder="Party Title (e.g. Summer Smash)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="cartoon-input w-full" />
            <textarea placeholder="Description / Theme" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="cartoon-input w-full min-h-20" />
            <input type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="cartoon-input w-full" />
            <input type="text" placeholder="Address / Location" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="cartoon-input w-full" />

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="font-bold text-xs uppercase tracking-widest opacity-70 ml-1">Entry Fee</label>
                <input type="text" placeholder="Free, $10, BYOB" value={form.entry_fee} onChange={e => setForm({ ...form, entry_fee: e.target.value })} className="cartoon-input w-full" />
              </div>
              <div className="flex-1">
                <label className="font-bold text-xs uppercase tracking-widest opacity-70 ml-1">Privacy</label>
                <select value={form.privacy} onChange={e => setForm({ ...form, privacy: e.target.value })} className="cartoon-input w-full">
                  <option value="public">🌍 Public Route</option>
                  <option value="invite_only">✉️ Invite/Approve</option>
                  <option value="hidden">🥷 Hidden (Link only)</option>
                </select>
              </div>
            </div>

            <input type="text" placeholder="Booze Details (What are we drinking?)" value={form.booze_details} onChange={e => setForm({ ...form, booze_details: e.target.value })} className="cartoon-input w-full" />
            <input type="text" placeholder="Snacks Details (Pizza, Chips?)" value={form.snacks_details} onChange={e => setForm({ ...form, snacks_details: e.target.value })} className="cartoon-input w-full" />
          </div>

          <button onClick={handleCreate} disabled={loading} className="cartoon-btn w-full bg-[#FF7B9C]! text-white mt-4">
            {loading ? "Creating..." : "Publish Event"}
          </button>
        </div>
      )}

      {/* MANAGE VIEW */}
      {view === 'manage' && (
        <div className="space-y-6">
          <h2 className="text-xl font-black text-[#3D2C24]">Your Hosted Events</h2>
          {hostedParties.length === 0 && <p className="text-center font-bold opacity-50 mt-10">You haven't hosted any parties yet.</p>}
          {hostedParties.map(p => (
            <div key={p.id} className="cartoon-card bg-[#A0E8AF]/20 border-[#60D394]">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-black text-xl text-[#3D2C24]">{p.title}</h3>
                <span className={`text-xs font-black uppercase px-2 py-1 rounded-full border-2 border-[#3D2C24] ${p.privacy_level === 'hidden' ? 'bg-[#FF7B9C] text-white' : 'bg-white text-[#3D2C24]'}`}>
                  {p.privacy_level}
                </span>
              </div>

              <div className="flex gap-2 mb-4">
                <button onClick={() => copyInviteLink(p.id)} className="cartoon-btn-secondary flex-1 text-xs py-2 bg-white flex items-center justify-center gap-1">
                  🔗 Copy Invite Link
                </button>
                <button onClick={() => handleEndParty(p.id)} className="cartoon-btn-secondary flex-1 text-xs py-2 bg-[#FF7B9C] text-white border-[#FF7B9C] flex items-center justify-center gap-1">
                  ✖ End Party
                </button>
              </div>

              {/* Guest List Render */}
              <div className="bg-white rounded-xl border-[3px] border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24] p-3 space-y-2">
                <h4 className="font-bold text-sm tracking-widest text-[#3D2C24] uppercase mb-2 border-b-2 border-dashed border-[#3D2C24]/20 pb-1">Gest List ({p.party_guests?.length || 0})</h4>

                {(!p.party_guests || p.party_guests.length === 0) ? (
                  <p className="text-xs font-bold opacity-50 text-center py-2">No RSVPs yet.</p>
                ) : (
                  p.party_guests.map(g => (
                    <div key={g.user_id} className="flex justify-between items-center pb-2 border-b-2 border-dashed border-[#3D2C24]/10 last:border-0">
                      <div>
                        <Link to={`/profile/${g.user_id}`} className="font-bold text-[#3D2C24] hover:text-[#FF7B9C] transition-colors">{g.profiles?.username}</Link>
                        <span className={`ml-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border-2 border-[#3D2C24] ${g.status === 'accepted' ? 'bg-[#A0E8AF]' : g.status === 'rejected' ? 'bg-[#FF7B9C] text-white' : 'bg-[#FFD166]'}`}>
                          {g.status}
                        </span>
                      </div>
                      {g.status === 'interested' && (
                        <div className="flex gap-2">
                          <button onClick={() => updateGuestStatus(p.id, g.user_id, 'accepted')} className="p-1.5 bg-[#A0E8AF] rounded border-2 border-[#3D2C24] shadow-[1px_1px_0px_#3D2C24] hover:-translate-y-0.5 transition-transform"><CheckCircle2 size={16} /></button>
                          <button onClick={() => updateGuestStatus(p.id, g.user_id, 'rejected')} className="p-1.5 bg-[#FF7B9C] text-white rounded border-2 border-[#3D2C24] shadow-[1px_1px_0px_#3D2C24] hover:-translate-y-0.5 transition-transform"><XCircle size={16} /></button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HISTORY VIEW */}
      {view === 'history' && (
        <div className="space-y-6">
          <h2 className="text-xl font-black text-[#3D2C24]">Your Past Events</h2>
          {pastParties.length === 0 && <p className="text-center font-bold opacity-50 mt-10">No past parties saved in history.</p>}
          {pastParties.map(p => (
            <div key={p.id} className="cartoon-card bg-gray-100 border-gray-300 opacity-80">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-black text-xl text-[#3D2C24] line-through">{p.title}</h3>
                <span className="text-xs font-black uppercase px-2 py-1 rounded-full border-2 border-gray-400 bg-gray-300 text-gray-700">
                  {p.status}
                </span>
              </div>
              <p className="text-sm font-bold text-[#3D2C24] opacity-70 mb-2 border-b-2 border-dashed border-gray-300 pb-2">
                <Calendar size={14} className="inline mr-1" /> {new Date(p.event_date).toLocaleDateString()}
              </p>

              <div className="space-y-1 mt-2">
                <p className="text-xs font-bold text-gray-600">Total RSVPs: {p.party_guests?.length || 0}</p>
                <p className="text-xs font-bold text-gray-600">Location: {p.address}</p>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}