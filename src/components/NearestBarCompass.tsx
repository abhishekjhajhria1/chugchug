import { useEffect, useRef, useState } from "react"
import { Navigation2, Compass, MapPin, Loader2 } from "lucide-react"
import { supabase } from "../lib/supabase"

// ── geo helpers ────────────────────────────────────────────────────
const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

/** Great-circle distance in metres. */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Initial bearing (degrees clockwise from north) from point 1 → point 2. */
function bearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lon2 - lon1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function fmtDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}

interface NearBar {
  id: string
  name: string
  latitude: number
  longitude: number
  address: string | null
  distance: number
  bearing: number
  isPartner: boolean
  tier: string | null
}

const TIER_COLOR: Record<string, string> = { gold: "#F59E0B", silver: "#9CA3AF", basic: "var(--amber)" }

type Status = "idle" | "locating" | "ready" | "denied" | "none" | "error"

export default function NearestBarCompass() {
  const [status, setStatus] = useState<Status>("idle")
  const [bar, setBar] = useState<NearBar | null>(null)
  const [heading, setHeading] = useState<number | null>(null)
  const coords = useRef<{ lat: number; lng: number } | null>(null)
  const orientBound = useRef(false)

  // Find the nearest bar once we have a fix.
  const findNearest = async (lat: number, lng: number) => {
    const { data, error } = await supabase
      .from("bars")
      .select("id, name, latitude, longitude, address, is_partner, partner_tier")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(500)
    if (error) { setStatus("error"); return }
    if (!data || data.length === 0) { setStatus("none"); return }

    const candidates: NearBar[] = data
      .filter((b: any) => b.latitude != null && b.longitude != null)
      .map((b: any) => ({
        id: b.id, name: b.name, latitude: b.latitude, longitude: b.longitude,
        address: b.address, distance: haversine(lat, lng, b.latitude, b.longitude),
        bearing: bearing(lat, lng, b.latitude, b.longitude),
        isPartner: !!b.is_partner, tier: b.partner_tier ?? null,
      }))
      .sort((a, b) => a.distance - b.distance)

    if (candidates.length === 0) { setStatus("none"); return }

    // Monetization: spotlight the nearest PARTNER if it's reasonably close
    // (within 5km, or within 1.5× the nearest bar's distance). Else nearest.
    const nearest = candidates[0]
    const nearestPartner = candidates.find(c => c.isPartner)
    const featured = nearestPartner && nearestPartner.distance <= Math.max(5000, nearest.distance * 1.5)
      ? nearestPartner
      : nearest

    setBar(featured)
    setStatus("ready")
  }

  const onOrient = (e: DeviceOrientationEvent) => {
    let h: number | null = null
    const webkitHeading = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading
    if (typeof webkitHeading === "number") h = webkitHeading
    else if (e.absolute && e.alpha != null) h = (360 - e.alpha) % 360
    if (h != null && !Number.isNaN(h)) setHeading(h)
  }

  const bindOrientation = async () => {
    if (orientBound.current) return
    try {
      const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      if (DOE && typeof DOE.requestPermission === "function") {
        const res = await DOE.requestPermission()
        if (res !== "granted") return
      }
    } catch { /* non-iOS — no permission gate */ }
    window.addEventListener("deviceorientationabsolute", onOrient as EventListener)
    window.addEventListener("deviceorientation", onOrient as EventListener)
    orientBound.current = true
  }

  const enable = () => {
    if (!("geolocation" in navigator)) { setStatus("error"); return }
    setStatus("locating")
    navigator.geolocation.getCurrentPosition(
      pos => {
        coords.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        findNearest(pos.coords.latitude, pos.coords.longitude)
        bindOrientation()
      },
      err => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrient as EventListener)
      window.removeEventListener("deviceorientation", onOrient as EventListener)
    }
  }, [])

  const openDirections = () => {
    if (!bar) return
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${bar.latitude},${bar.longitude}`,
      "_blank", "noopener,noreferrer"
    )
  }

  // Needle points to the bar relative to where the phone faces.
  // No heading yet → point relative to true north (dial "N" is up).
  const needleRot = bar ? (heading != null ? (bar.bearing - heading + 360) % 360 : bar.bearing) : 0

  // ── shared shell ──
  const Shell = ({ children, onClick, clickable }: { children: React.ReactNode; onClick?: () => void; clickable?: boolean }) => (
    <button
      onClick={onClick}
      disabled={!clickable}
      className={`w-full p-4 flex items-center gap-4 transition-transform ${clickable ? "active:scale-[0.98]" : "cursor-default"}`}
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderLeft: "4px solid var(--amber)",
        borderRadius: "var(--card-radius)",
        backdropFilter: "blur(var(--card-blur))",
        WebkitBackdropFilter: "blur(var(--card-blur))",
      }}
    >
      {children}
    </button>
  )

  if (status === "ready" && bar) {
    return (
      <Shell clickable onClick={openDirections}>
        {/* Compass dial */}
        <div className="relative shrink-0" style={{ width: 60, height: 60 }}>
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center"
            style={{ background: "var(--bg-deep)", border: "1px solid var(--border-mid)", boxShadow: "inset 0 0 10px rgba(0,0,0,0.25)" }}
          >
            {(["N", "E", "S", "W"] as const).map((d, i) => (
              <span key={d} className="absolute text-[7px] font-black" style={{
                color: d === "N" ? "var(--coral)" : "var(--text-ghost)",
                top: i === 0 ? 3 : i === 2 ? "auto" : "50%",
                bottom: i === 2 ? 3 : "auto",
                left: i === 3 ? 3 : i === 1 ? "auto" : "50%",
                right: i === 1 ? 3 : "auto",
                transform: i === 0 || i === 2 ? "translateX(-50%)" : "translateY(-50%)",
              }}>{d}</span>
            ))}
            <Navigation2
              size={26}
              style={{
                color: "var(--amber)",
                fill: "var(--amber)",
                transform: `rotate(${needleRot}deg)`,
                transition: "transform 0.3s ease-out",
                filter: "drop-shadow(0 0 4px var(--amber))",
              }}
            />
          </div>
        </div>

        <div className="flex-1 text-left min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest mb-0.5 flex items-center gap-1" style={{ color: bar.isPartner ? (TIER_COLOR[bar.tier ?? "basic"] ?? "var(--amber)") : "var(--amber)" }}>
            {bar.isPartner ? `⭐ ${(bar.tier ?? "partner").toUpperCase()} PARTNER` : "Nearest Tavern"}
          </p>
          <p className="text-sm font-black truncate" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>
            {bar.name}
          </p>
          <p className="text-[10px] font-bold flex items-center gap-1 truncate" style={{ color: "var(--text-muted)" }}>
            <MapPin size={10} /> {fmtDistance(bar.distance)}
            {bar.address ? ` · ${bar.address}` : ""}
            {heading == null ? " · N up" : ""}
          </p>
        </div>
        <Navigation2 size={16} style={{ color: "var(--amber)" }} />
      </Shell>
    )
  }

  // Non-ready states
  let icon = <Compass size={26} style={{ color: "var(--amber)" }} />
  let title = "Find the nearest tavern"
  let sub = "Tap to point your compass at the closest bar"
  let clickable = true
  let action = enable

  if (status === "locating") { icon = <Loader2 size={26} className="animate-spin" style={{ color: "var(--amber)" }} />; title = "Locating you…"; sub = "Reading your position"; clickable = false }
  else if (status === "denied") { title = "Location blocked"; sub = "Enable location access, then tap to retry" }
  else if (status === "none") { title = "No taverns mapped yet"; sub = "Add bars with coordinates to use the compass"; clickable = false; action = () => {} }
  else if (status === "error") { title = "Compass unavailable"; sub = "Tap to try again" }

  return (
    <Shell clickable={clickable} onClick={clickable ? action : undefined}>
      <div className="relative shrink-0 flex items-center justify-center rounded-full" style={{ width: 60, height: 60, background: "var(--bg-deep)", border: "1px solid var(--border-mid)" }}>
        {icon}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: "var(--amber)" }}>Tavern Compass</p>
        <p className="text-sm font-black truncate" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>{title}</p>
        <p className="text-[10px] font-bold truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>
      </div>
    </Shell>
  )
}
