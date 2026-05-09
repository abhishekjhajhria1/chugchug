import { useState, useEffect, useCallback } from "react"
import { useChug } from "../context/ChugContext"
import { supabase } from "../lib/supabase"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, MapPin, Star, Navigation, Clock, Phone, ExternalLink, Search, Filter, Crown, Gift, Loader2 } from "lucide-react"
import { useToast } from "../components/Toast"

// ─── Env placeholders ──────────────────────────────────────────
const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY || ""

interface Bar {
  id: string
  name: string
  address: string
  city: string
  latitude: number
  longitude: number
  is_partner: boolean
  partner_tier: string
  menu: MenuItem[]
  rating: number
  photo_url: string | null
  description: string | null
  operating_hours: Record<string, string>
  tags: string[]
  distance?: number // calculated client-side
}

interface MenuItem {
  name: string
  price: number
  currency: string
  category: string
  description?: string
  is_featured?: boolean
}

interface UserLoyalty {
  bar_id: string
  points: number
  lifetime_points: number
}

type TabId = 'nearby' | 'partner' | 'loyalty'

const PARTNER_BADGE: Record<string, { emoji: string; label: string; color: string }> = {
  basic:  { emoji: '⭐',  label: 'Partner',        color: 'var(--amber)' },
  silver: { emoji: '🥈', label: 'Silver Partner', color: 'var(--text-secondary)' },
  gold:   { emoji: '👑',  label: 'Gold Partner',   color: 'var(--amber)' },
}

export default function Tavern() {
  const { user, profile } = useChug()
  const navigate = useNavigate()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<TabId>('nearby')
  const [bars, setBars] = useState<Bar[]>([])
  const [loyalty, setLoyalty] = useState<UserLoyalty[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBar, setSelectedBar] = useState<Bar | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { /* location denied — continue without distance */ }
      )
    }
  }, [])

  // Calculate distance between two points (Haversine formula)
  const calcDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }, [])

  // Fetch bars from Supabase
  const fetchBars = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("bars")
      .select("*")
      .order("is_partner", { ascending: false })
      .order("rating", { ascending: false })
      .limit(50)

    if (data && !error) {
      const withDistance = data.map((bar: Bar) => ({
        ...bar,
        menu: bar.menu || [],
        distance: userLocation
          ? calcDistance(userLocation.lat, userLocation.lng, bar.latitude, bar.longitude)
          : undefined,
      }))
      setBars(withDistance)
    }
    setLoading(false)
  }, [userLocation, calcDistance])

  // Fetch loyalty points
  const fetchLoyalty = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from("loyalty_points")
      .select("bar_id, points, lifetime_points")
      .eq("user_id", user.id)
    if (data) setLoyalty(data)
  }, [user])

  useEffect(() => { fetchBars() }, [fetchBars])
  useEffect(() => { fetchLoyalty() }, [fetchLoyalty])

  // Google Places fallback (when API key is available)
  const searchGooglePlaces = async (query: string) => {
    if (!GOOGLE_PLACES_API_KEY || !userLocation) {
      toast.info("Configure VITE_GOOGLE_PLACES_KEY in .env for live bar search")
      return
    }
    // TODO: Implement Google Places API call when key is configured
    // const res = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${userLocation.lat},${userLocation.lng}&radius=5000&type=bar&keyword=${query}&key=${GOOGLE_PLACES_API_KEY}`)
    toast.info("Google Places integration will be configured with your API key")
  }

  const filteredBars = bars.filter(bar => {
    const q = searchQuery.toLowerCase()
    if (!q) return true
    return bar.name.toLowerCase().includes(q) || bar.address?.toLowerCase().includes(q) || bar.tags?.some(t => t.toLowerCase().includes(q))
  })

  const partnerBars = filteredBars.filter(b => b.is_partner)
  const nearbyBars = [...filteredBars].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))

  const getLoyaltyForBar = (barId: string) => loyalty.find(l => l.bar_id === barId)
  const totalLoyalty = loyalty.reduce((sum, l) => sum + l.points, 0)

  const tabs = [
    { id: 'nearby' as const, label: 'Nearby', emoji: '📍', color: 'var(--amber)', bg: 'var(--amber-dim)' },
    { id: 'partner' as const, label: 'Partners', emoji: '⭐', color: 'var(--acid)', bg: 'var(--acid-dim)' },
    { id: 'loyalty' as const, label: 'My Points', emoji: '🎁', color: 'var(--coral)', bg: 'var(--coral-dim)' },
  ]

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--amber)' }} />
        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Discovering taverns...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 active:scale-90 transition-transform" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="page-title">⛩️ Tavern</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Discover bars, earn points, redeem rewards
          </p>
        </div>
        {totalLoyalty > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(216,162,94,0.3)', borderRadius: 'var(--card-radius)' }}>
            <Gift size={14} style={{ color: 'var(--amber)' }} />
            <span className="text-xs font-black" style={{ color: 'var(--amber)' }}>{totalLoyalty}</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-ghost)' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search bars, neighborhoods, tags..."
          className="glass-input w-full pl-10 pr-12"
        />
        {GOOGLE_PLACES_API_KEY && (
          <button
            onClick={() => searchGooglePlaces(searchQuery)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded active:scale-90 transition-transform"
            style={{ color: 'var(--amber)' }}
            title="Search Google Maps"
          >
            <ExternalLink size={16} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(({ id, label, emoji, color, bg }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
            style={{
              background: activeTab === id ? bg : 'var(--bg-surface)',
              border: activeTab === id ? `2px solid ${color}` : '1px solid var(--border)',
              color: activeTab === id ? color : 'var(--text-muted)',
              borderRadius: 'var(--card-radius)',
            }}
          >
            <span>{emoji}</span> {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'nearby' && (
        <div className="space-y-3">
          {nearbyBars.length === 0 ? (
            <div className="text-center py-12" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-mid)', borderRadius: 'var(--card-radius)' }}>
              <MapPin size={32} className="mx-auto mb-3 opacity-40" style={{ color: 'var(--text-ghost)' }} />
              <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>No bars found nearby</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>Bars will appear here as they're added to the network</p>
            </div>
          ) : nearbyBars.map(bar => (
            <BarCard key={bar.id} bar={bar} loyalty={getLoyaltyForBar(bar.id)} onSelect={() => setSelectedBar(bar)} />
          ))}
        </div>
      )}

      {activeTab === 'partner' && (
        <div className="space-y-3">
          <div className="p-4" style={{ background: 'linear-gradient(135deg, var(--acid-dim), rgba(124,154,116,0.05))', border: '1px solid var(--border)', borderLeft: '4px solid var(--acid)', borderRadius: 'var(--card-radius)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--acid)' }}>🤝 Partner bars give you bonus loyalty points</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Log sessions at partner bars → earn 2x-5x points → redeem for drinks & perks</p>
          </div>
          {partnerBars.length === 0 ? (
            <div className="text-center py-12" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-mid)', borderRadius: 'var(--card-radius)' }}>
              <Star size={32} className="mx-auto mb-3 opacity-40" style={{ color: 'var(--text-ghost)' }} />
              <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>No partner bars yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>Partner bars will appear here soon</p>
            </div>
          ) : partnerBars.map(bar => (
            <BarCard key={bar.id} bar={bar} loyalty={getLoyaltyForBar(bar.id)} onSelect={() => setSelectedBar(bar)} />
          ))}
        </div>
      )}

      {activeTab === 'loyalty' && (
        <div className="space-y-3">
          {/* Total points card */}
          <div className="p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--amber-dim), rgba(216,162,94,0.05))', border: '1px solid var(--border)', borderLeft: '5px solid var(--amber)', borderRadius: 'var(--card-radius)' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Total Loyalty Points</p>
            <p className="text-4xl font-black mt-2" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>{totalLoyalty}</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-ghost)' }}>Earn points by logging sessions at partner bars</p>
          </div>

          {/* Per-bar breakdown */}
          {loyalty.length === 0 ? (
            <div className="text-center py-8" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-mid)', borderRadius: 'var(--card-radius)' }}>
              <Gift size={28} className="mx-auto mb-2 opacity-40" style={{ color: 'var(--text-ghost)' }} />
              <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>No points earned yet</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-ghost)' }}>Visit partner bars and log sessions to earn</p>
            </div>
          ) : loyalty.map(l => {
            const bar = bars.find(b => b.id === l.bar_id)
            return (
              <div
                key={l.bar_id}
                className="flex items-center justify-between p-4"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)' }}
              >
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{bar?.name || 'Unknown Bar'}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>Lifetime: {l.lifetime_points} pts</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: 'var(--amber-dim)', borderRadius: 'var(--card-radius)' }}>
                  <Gift size={12} style={{ color: 'var(--amber)' }} />
                  <span className="text-sm font-black" style={{ color: 'var(--amber)' }}>{l.points}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bar Detail Modal */}
      {selectedBar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSelectedBar(null)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
          <div
            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto p-5 space-y-4"
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-mid)', borderTop: '2px solid var(--amber)', borderRadius: 'var(--card-radius) var(--card-radius) 0 0' }}
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{selectedBar.name}</h2>
                  {selectedBar.is_partner && (
                    <span className="text-xs font-bold px-2 py-0.5" style={{ background: 'var(--amber-dim)', color: 'var(--amber)', borderRadius: '2px' }}>
                      {PARTNER_BADGE[selectedBar.partner_tier]?.emoji} {PARTNER_BADGE[selectedBar.partner_tier]?.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    <Star size={12} style={{ color: 'var(--amber)', fill: 'var(--amber)' }} />
                    <span className="text-xs font-bold" style={{ color: 'var(--amber)' }}>{selectedBar.rating}</span>
                  </div>
                  {selectedBar.distance !== undefined && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Navigation size={10} className="inline mr-1" />
                      {selectedBar.distance < 1 ? `${Math.round(selectedBar.distance * 1000)}m` : `${selectedBar.distance.toFixed(1)}km`}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedBar(null)} className="p-1" style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            {/* Address */}
            <div className="flex items-start gap-2 p-3" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--card-radius)' }}>
              <MapPin size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--amber)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selectedBar.address}</span>
            </div>

            {/* Description */}
            {selectedBar.description && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedBar.description}</p>
            )}

            {/* Menu */}
            {selectedBar.menu && selectedBar.menu.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>🍹 Menu</p>
                <div className="space-y-1.5">
                  {selectedBar.menu.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--card-radius)' }}>
                      <div>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                          {item.is_featured && '⭐ '}{item.name}
                        </span>
                        {item.description && (
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>{item.description}</p>
                        )}
                      </div>
                      <span className="text-xs font-black" style={{ color: 'var(--amber)' }}>
                        {item.currency === 'INR' ? '₹' : '$'}{item.price}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loyalty points for this bar */}
            {(() => {
              const l = getLoyaltyForBar(selectedBar.id)
              return l ? (
                <div className="flex items-center justify-between p-3" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(216,162,94,0.3)', borderRadius: 'var(--card-radius)' }}>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Your Points</span>
                  <span className="text-lg font-black" style={{ color: 'var(--amber)' }}>{l.points}</span>
                </div>
              ) : null
            })()}

            {/* Open in Maps */}
            {selectedBar.latitude && selectedBar.longitude && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedBar.latitude},${selectedBar.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-btn w-full flex items-center justify-center gap-2 text-center"
              >
                <Navigation size={16} /> Get Directions
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Bar Card Component ──────────────────────────────────────────
function BarCard({ bar, loyalty, onSelect }: { bar: Bar; loyalty?: UserLoyalty; onSelect: () => void }) {
  const badge = bar.is_partner ? PARTNER_BADGE[bar.partner_tier] || PARTNER_BADGE.basic : null

  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-4 transition-all active:scale-[0.98]"
      style={{
        background: bar.is_partner
          ? 'linear-gradient(135deg, var(--amber-dim), rgba(216,162,94,0.03))'
          : 'var(--card-bg)',
        border: bar.is_partner
          ? '1px solid rgba(216,162,94,0.25)'
          : '1px solid var(--border)',
        borderLeft: bar.is_partner ? '4px solid var(--amber)' : undefined,
        borderRadius: 'var(--card-radius)',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{bar.name}</span>
            {badge && (
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 shrink-0" style={{ background: 'var(--amber-dim)', color: badge.color, borderRadius: '2px' }}>
                {badge.emoji} {badge.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-1">
              <Star size={10} style={{ color: 'var(--amber)', fill: 'var(--amber)' }} />
              <span className="text-[10px] font-bold" style={{ color: 'var(--amber)' }}>{bar.rating}</span>
            </div>
            {bar.address && (
              <span className="text-[10px] truncate" style={{ color: 'var(--text-ghost)' }}>
                <MapPin size={9} className="inline mr-0.5" />{bar.address}
              </span>
            )}
          </div>
          {bar.tags && bar.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {bar.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)', borderRadius: '2px' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
          {bar.distance !== undefined && (
            <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
              {bar.distance < 1 ? `${Math.round(bar.distance * 1000)}m` : `${bar.distance.toFixed(1)}km`}
            </span>
          )}
          {loyalty && loyalty.points > 0 && (
            <span className="text-[9px] font-black px-1.5 py-0.5" style={{ background: 'var(--amber-dim)', color: 'var(--amber)', borderRadius: '2px' }}>
              {loyalty.points} pts
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
