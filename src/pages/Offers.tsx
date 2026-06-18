import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { MapPin, Star, Megaphone, ArrowRight, Ticket, Sparkles, Navigation } from "lucide-react"

interface Bar {
  id: string; name: string; city: string | null; address: string | null
  is_partner: boolean; partner_tier: string | null; rating: number | null
  photo_url: string | null; description: string | null; tags: string[] | null
  latitude: number | null; longitude: number | null
}
interface EventRow {
  id: string; title: string; description: string | null; emoji: string | null
  starts_at: string; ends_at: string; bonus_xp_multiplier: number | null
}

const TIER: Record<string, { label: string; color: string }> = {
  gold:   { label: 'Gold partner',   color: 'var(--amber)' },
  silver: { label: 'Silver partner', color: 'var(--text-secondary)' },
  basic:  { label: 'Partner',        color: 'var(--acid)' },
}

export default function Offers() {
  const navigate = useNavigate()
  const [bars, setBars] = useState<Bar[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [barsRes, evRes] = await Promise.allSettled([
        supabase.from("bars").select("id,name,city,address,is_partner,partner_tier,rating,photo_url,description,tags,latitude,longitude").eq("is_partner", true).limit(20),
        supabase.from("events").select("id,title,description,emoji,starts_at,ends_at,bonus_xp_multiplier").eq("is_active", true).order("starts_at", { ascending: true }).limit(6),
      ])
      if (barsRes.status === 'fulfilled' && barsRes.value.data) {
        const order: Record<string, number> = { gold: 0, silver: 1, basic: 2 }
        setBars((barsRes.value.data as Bar[]).sort((a, b) => (order[a.partner_tier || 'basic'] ?? 3) - (order[b.partner_tier || 'basic'] ?? 3)))
      }
      if (evRes.status === 'fulfilled' && evRes.value.data) setEvents(evRes.value.data as EventRow[])
      setLoading(false)
    }
    load()
  }, [])

  const openMaps = (b: Bar) => {
    const q = b.latitude && b.longitude ? `${b.latitude},${b.longitude}` : encodeURIComponent(`${b.name} ${b.city || ''}`)
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank')
  }

  return (
    <div className="space-y-6 pb-24 wano-fade">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2"><Ticket size={22} style={{ color: 'var(--amber)' }} /> Offers &amp; Deals</h1>
        <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-muted)' }}>Featured bars, happy hours and live events near you.</p>
      </div>

      {/* Hero promo */}
      <div className="relative overflow-hidden p-6" style={{ borderRadius: 'var(--card-radius)', background: 'linear-gradient(135deg, var(--amber-dim), color-mix(in srgb, var(--coral) 10%, transparent))', border: '1px solid color-mix(in srgb, var(--amber) 22%, transparent)' }}>
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full" style={{ background: 'color-mix(in srgb, var(--amber) 18%, transparent)', filter: 'blur(28px)' }} />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full mb-3" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
            <Sparkles size={12} /> This week
          </span>
          <h2 className="text-xl font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>Drink smarter, pay less</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Partner bars give ChugChug users exclusive perks — happy hours, free entry and loyalty points.</p>
        </div>
      </div>

      {/* Live events */}
      {events.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Live &amp; upcoming events</p>
            <button onClick={() => navigate('/events')} className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--amber)' }}>See all <ArrowRight size={12} /></button>
          </div>
          <div className="space-y-2.5">
            {events.map(ev => (
              <button key={ev.id} onClick={() => navigate('/events')} className="w-full flex items-center gap-3.5 p-4 text-left active:scale-[0.99] transition-transform" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)' }}>
                <div className="w-12 h-12 shrink-0 flex items-center justify-center text-2xl rounded-xl" style={{ background: 'var(--amber-dim)' }}>{ev.emoji || '✨'}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{ev.title}</p>
                  {ev.description && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{ev.description}</p>}
                </div>
                {(ev.bonus_xp_multiplier ?? 1) > 1 && (
                  <span className="text-xs font-extrabold px-2 py-1 rounded-full shrink-0" style={{ background: 'var(--acid-dim)', color: 'var(--acid)' }}>{ev.bonus_xp_multiplier}× XP</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Partner bars */}
      <section>
        <p className="section-label mb-3">Featured spots</p>
        {loading ? (
          <div className="glass-card text-center py-8"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading deals…</p></div>
        ) : bars.length === 0 ? (
          <div className="glass-card text-center py-8">
            <div className="text-4xl mb-2">🍸</div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>No partner spots yet</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>We're onboarding bars near you — check back soon.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bars.map(b => {
              const tier = TIER[b.partner_tier || 'basic'] || TIER.basic
              return (
                <div key={b.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                  {b.photo_url && <img src={b.photo_url} alt={b.name} className="w-full h-28 object-cover" />}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-base font-extrabold" style={{ color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>{b.name}</h3>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: `color-mix(in srgb, ${tier.color} 14%, transparent)`, color: tier.color }}>{tier.label}</span>
                    </div>
                    {(b.city || b.address) && (
                      <p className="text-xs font-medium flex items-center gap-1 mb-2" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={12} /> {[b.address, b.city].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {b.description && <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{b.description}</p>}
                    <div className="flex items-center gap-2">
                      {(b.rating ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--amber)' }}><Star size={13} fill="currentColor" /> {b.rating}</span>
                      )}
                      <button onClick={() => openMaps(b)} className="ml-auto flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                        <Navigation size={13} /> Directions
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Promote your business CTA (monetization) */}
      <section className="p-6 text-center" style={{ borderRadius: 'var(--card-radius)', background: 'var(--bg-mid)', border: '1px dashed var(--border-mid)' }}>
        <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-2xl" style={{ background: 'var(--amber-dim)' }}>
          <Megaphone size={22} style={{ color: 'var(--amber)' }} />
        </div>
        <h3 className="text-lg font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>Own a bar or brand?</h3>
        <p className="text-sm mb-4 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>Get featured here and reach thirsty locals. Promote happy hours, events and offers right where they decide where to drink.</p>
        <a href="mailto:partners@chugchug.app?subject=Promote%20my%20business%20on%20ChugChug" className="glass-btn inline-flex">
          Promote with us <ArrowRight size={16} />
        </a>
      </section>
    </div>
  )
}
