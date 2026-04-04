import { useState, useEffect, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { PartyPopper, Calendar, MapPin, Beer, CheckCircle2, XCircle, QrCode, Scan } from "lucide-react"
import { Link } from "react-router-dom"
import QRCodeModal from "../components/QRCodeModal"
import LiveCounter from "../components/LiveCounter"

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
  const [qrModal, setQrModal] = useState<{ open: boolean; mode: 'display' | 'scan'; data?: string; title?: string }>({ open: false, mode: 'display' })


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

  const showPartyQR = (partyId: string, title: string) => {
    setQrModal({
      open: true,
      mode: 'display',
      data: `${window.location.origin}/party/${partyId}?join=qr`,
      title: `Join: ${title}`,
    })
  }

  const handleQRScan = (result: string) => {
    if (result.includes('/party/')) {
      window.location.href = result
    } else {
      alert('Invalid party QR code')
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <h1 className="page-title flex items-center gap-2">
        <PartyPopper size={26} style={{ color: 'var(--coral)' }} /> Party Hub
      </h1>

      {/* QR Modal */}
      <QRCodeModal
        isOpen={qrModal.open}
        onClose={() => setQrModal({ ...qrModal, open: false })}
        mode={qrModal.mode}
        data={qrModal.data}
        title={qrModal.title}
        onScanResult={handleQRScan}
      />

      {/* Tabs */}
      <div className="flex rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)' }}>
        {([
          { id: 'feed' as const,    label: 'Discover' },
          { id: 'create' as const,  label: 'Host' },
          { id: 'manage' as const,  label: 'Manage' },
          { id: 'history' as const, label: 'History' },
        ]).map(({ id, label }, i) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className="flex-1 py-2.5 font-bold text-xs transition-all"
            style={{
              background: view === id ? 'var(--amber-dim)' : 'transparent',
              color: view === id ? 'var(--amber)' : 'var(--text-muted)',
              fontFamily: 'Syne, sans-serif',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Scan QR Button */}
      <button onClick={() => setQrModal({ open: true, mode: 'scan', title: 'Scan Party QR' })}
        className="glass-btn-secondary w-full flex items-center justify-center gap-2 text-sm">
        <Scan size={16} style={{ color: 'var(--indigo)' }} /> Scan QR to Join
      </button>

      {/* DISCOVER VIEW */}
      {view === 'feed' && (
        <div className="space-y-4">
          {parties.length === 0 && <p className="text-center font-bold opacity-50 mt-10">No upcoming parties found.</p>}
          {parties.map(p => (
            <div key={p.id} className="glass-card" style={{ borderColor: 'rgba(255,107,107,0.15)' }}>
              <div className="flex justify-between items-start mb-2">
                <h2 className="font-black text-xl" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{p.title}</h2>
                <span className="px-2 py-0.5 rounded-full font-black text-xs transform rotate-3" style={{ background: 'var(--amber-dim)', border: '1px solid var(--border)', color: 'var(--amber)' }}>
                  {p.entry_fee}
                </span>
              </div>
              <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-muted)' }}>Host: <Link to={`/profile/${p.host_id}`} className="transition-colors" style={{ color: 'var(--amber)' }}>{p.profiles?.username}</Link></p>

              <div className="space-y-1 mb-4">
                <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}><Calendar size={16} style={{ color: 'var(--acid)' }} /> {new Date(p.event_date).toLocaleDateString()}</p>
                <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}><MapPin size={16} style={{ color: 'var(--coral)' }} /> {p.address}</p>
                {(p.booze_details || p.snacks_details) && (
                  <p className="text-sm font-bold flex items-center gap-2"><Beer size={16} className="neon-amber" /> {p.booze_details} | {p.snacks_details}</p>
                )}
              </div>

              <button onClick={() => handleInterest(p.id)} className="glass-btn w-full" style={{ fontSize: 13 }}>
                I'm Interested
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CREATE VIEW */}
      {view === 'create' && (
        <div className="glass-card space-y-4" style={{ borderColor: 'rgba(255,107,107,0.15)' }}>
          <h2 className="text-2xl font-black mb-4" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Plan a Rager</h2>

          <div className="space-y-3">
            <input type="text" placeholder="Party Title (e.g. Summer Smash)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="glass-input w-full" />
            <textarea placeholder="Description / Theme" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="glass-input w-full min-h-20" />
            <input type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="glass-input w-full" />
            <input type="text" placeholder="Address / Location" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="glass-input w-full" />

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="font-bold text-xs uppercase tracking-widest opacity-70 ml-1">Entry Fee</label>
                <input type="text" placeholder="Free, $10, BYOB" value={form.entry_fee} onChange={e => setForm({ ...form, entry_fee: e.target.value })} className="glass-input w-full" />
              </div>
              <div className="flex-1">
                <label className="font-bold text-xs uppercase tracking-widest opacity-70 ml-1">Privacy</label>
                <select value={form.privacy} onChange={e => setForm({ ...form, privacy: e.target.value })} className="glass-input w-full">
                  <option value="public">🌍 Public Route</option>
                  <option value="invite_only">✉️ Invite/Approve</option>
                  <option value="hidden">🥷 Hidden (Link only)</option>
                </select>
              </div>
            </div>

            <input type="text" placeholder="Booze Details (What are we drinking?)" value={form.booze_details} onChange={e => setForm({ ...form, booze_details: e.target.value })} className="glass-input w-full" />
            <input type="text" placeholder="Snacks Details (Pizza, Chips?)" value={form.snacks_details} onChange={e => setForm({ ...form, snacks_details: e.target.value })} className="glass-input w-full" />
          </div>

          <button onClick={handleCreate} disabled={loading} className="glass-btn w-full mt-4">
            {loading ? "Creating..." : "Publish Event"}
          </button>
        </div>
      )}

      {/* MANAGE VIEW */}
      {view === 'manage' && (
        <div className="space-y-6">
          <h2 className="text-xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Your Hosted Events</h2>
          {hostedParties.length === 0 && <p className="text-center font-bold opacity-50 mt-10">You haven't hosted any parties yet.</p>}
          {hostedParties.map(p => (
            <div key={p.id} className="glass-card" style={{ borderColor: 'rgba(204,255,0,0.15)' }}>
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-black text-xl" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{p.title}</h3>
                <span className="text-xs font-black uppercase px-2 py-1 rounded-full" style={{ background: p.privacy_level === 'hidden' ? 'var(--coral-dim)' : 'var(--bg-raised)', border: '1px solid var(--border)', color: p.privacy_level === 'hidden' ? 'var(--coral)' : 'var(--text-secondary)' }}>
                  {p.privacy_level}
                </span>
              </div>

              <div className="flex gap-2 mb-4">
                <button onClick={() => showPartyQR(p.id, p.title)} className="glass-btn-secondary flex-1 text-xs py-2 flex items-center justify-center gap-1">
                  <QrCode size={14} className="accent-violet" /> Show QR
                </button>
                <button onClick={() => copyInviteLink(p.id)} className="glass-btn-secondary flex-1 text-xs py-2 bg-white/5 flex items-center justify-center gap-1">
                  🔗 Copy Link
                </button>
                <button onClick={() => handleEndParty(p.id)} className="glass-btn-secondary flex-1 text-xs py-2 flex items-center justify-center gap-1" style={{ background: 'var(--coral-dim)', color: 'var(--coral)', borderColor: 'rgba(255,107,107,0.2)' }}>
                  ✖ End
                </button>
              </div>

              {/* Live Beer Counter for this party */}
              <div className="mb-4">
                <LiveCounter partyId={p.id} showLeaderboard compact />
              </div>

              {/* Guest List Render */}
              <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                <h4 className="font-bold text-sm tracking-widest uppercase mb-2 pb-1" style={{ color: 'var(--text-muted)', borderBottom: '1px dashed var(--border)' }}>Guest List ({p.party_guests?.length || 0})</h4>

                {(!p.party_guests || p.party_guests.length === 0) ? (
                  <p className="text-xs font-bold opacity-50 text-center py-2">No RSVPs yet.</p>
                ) : (
                  p.party_guests.map(g => (
                    <div key={g.user_id} className="flex justify-between items-center pb-2 last:border-0" style={{ borderBottom: '1px dashed var(--border)' }}>
                      <div>
                        <Link to={`/profile/${g.user_id}`} className="font-bold transition-colors" style={{ color: 'var(--text-primary)' }}>{g.profiles?.username}</Link>
                        <span className="ml-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-full" style={{ background: g.status === 'accepted' ? 'var(--acid-dim)' : g.status === 'rejected' ? 'var(--coral-dim)' : 'var(--amber-dim)', color: g.status === 'accepted' ? 'var(--acid)' : g.status === 'rejected' ? 'var(--coral)' : 'var(--amber)', border: '1px solid var(--border)' }}>
                          {g.status}
                        </span>
                      </div>
                      {g.status === 'interested' && (
                        <div className="flex gap-2">
                          <button onClick={() => updateGuestStatus(p.id, g.user_id, 'accepted')} className="p-1.5 rounded transition-transform active:scale-90" style={{ background: 'var(--acid-dim)', border: '1px solid var(--border)' }}><CheckCircle2 size={16} style={{ color: 'var(--acid)' }} /></button>
                          <button onClick={() => updateGuestStatus(p.id, g.user_id, 'rejected')} className="p-1.5 rounded transition-transform active:scale-90" style={{ background: 'var(--coral-dim)', border: '1px solid var(--border)' }}><XCircle size={16} style={{ color: 'var(--coral)' }} /></button>
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
          <h2 className="text-xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Your Past Events</h2>
          {pastParties.length === 0 && <p className="text-center font-bold opacity-50 mt-10">No past parties saved in history.</p>}
          {pastParties.map(p => (
            <div key={p.id} className="glass-card" style={{ opacity: 0.7 }}>
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-black text-xl line-through" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{p.title}</h3>
                <span className="text-xs font-black uppercase px-2 py-1 rounded-full" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {p.status}
                </span>
              </div>
              <p className="text-sm font-bold mb-2 pb-2" style={{ color: 'var(--text-muted)', borderBottom: '1px dashed var(--border)' }}>
                <Calendar size={14} className="inline mr-1" /> {new Date(p.event_date).toLocaleDateString()}
              </p>

              <div className="space-y-1 mt-2">
                <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Total RSVPs: {p.party_guests?.length || 0}</p>
                <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Location: {p.address}</p>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}