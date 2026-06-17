import { useEffect, useRef, useState } from "react"
import html2canvas from "html2canvas"
import { X, Share2, Download, Loader2 } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { useToast } from "./Toast"
import { getRankInfo } from "../lib/progression"

// NOTE: the captured card uses ONLY literal colors (no CSS vars / color-mix),
// because html2canvas can't parse modern color functions. Keep it that way.
const INK = "#0B0F1A"
const INK2 = "#161226"
const GOLD = "#E8B45E"
const MUTE = "rgba(255,255,255,0.55)"
const FAINT = "rgba(255,255,255,0.10)"

interface Stats { drinks: number; sessions: number; spent: number; topDrink: string }

export default function StatShareCard({ onClose }: { onClose: () => void }) {
  const { user, profile } = useChug()
  const toast = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [{ data: drinks }, { data: sess }, { data: splits }] = await Promise.all([
        supabase.from("activity_logs").select("item_name, quantity").eq("user_id", user.id).eq("category", "drink"),
        supabase.from("session_participants").select("id").eq("user_id", user.id),
        supabase.from("expense_splits").select("amount_owed").eq("user_id", user.id),
      ])
      const totalDrinks = (drinks ?? []).reduce((s, d: any) => s + (d.quantity || 1), 0)
      const spent = (splits ?? []).reduce((s, x: any) => s + Number(x.amount_owed || 0), 0)
      const counts = new Map<string, number>()
      for (const d of drinks ?? []) {
        const n = (d as any).item_name
        if (!n || n === "Drinking Session" || n === "Live Party") continue
        counts.set(n, (counts.get(n) ?? 0) + 1)
      }
      const topDrink = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"
      setStats({ drinks: totalDrinks, sessions: (sess ?? []).length, spent: Math.round(spent), topDrink })
    }
    load()
  }, [user])

  const exportCard = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null
    const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2, useCORS: true, logging: false })
    return await new Promise(res => canvas.toBlob(b => res(b), "image/png"))
  }

  const share = async () => {
    setBusy(true)
    try {
      const blob = await exportCard()
      if (!blob) throw new Error("render failed")
      const file = new File([blob], "chugchug-stats.png", { type: "image/png" })
      const navAny = navigator as any
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navAny.share({ files: [file], title: "My ChugChug stats", text: "My drinking stats on ChugChug 🍻" })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a"); a.href = url; a.download = "chugchug-stats.png"; a.click()
        URL.revokeObjectURL(url)
        toast.success("Saved — go flex 💪")
      }
    } catch {
      toast.error("Couldn't generate the card")
    } finally { setBusy(false) }
  }

  const ri = getRankInfo(profile?.level ?? 1, profile?.xp ?? 0)
  const stat = (emoji: string, value: string | number, label: string) => (
    <div style={{ flex: 1, background: FAINT, borderRadius: 16, padding: "14px 10px", textAlign: "center" as const }}>
      <div style={{ fontSize: 22 }}>{emoji}</div>
      <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: MUTE, marginTop: 3 }}>{label}</div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-sm">
        {/* The exportable card */}
        <div ref={cardRef} style={{ background: `linear-gradient(160deg, ${INK} 0%, ${INK2} 100%)`, borderRadius: 24, padding: 24, position: "relative", overflow: "hidden", border: `1px solid ${FAINT}` }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(232,180,94,0.14)", filter: "blur(20px)" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
            <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: "0.04em" }}>⛩️ ChugChug</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{ri.current.emoji} {ri.current.title}</span>
          </div>

          <div style={{ marginTop: 18, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTE, textTransform: "uppercase" as const, letterSpacing: "0.14em" }}>The legend of</div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 30, color: "#fff", lineHeight: 1.05 }}>{profile?.username || "Traveler"}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginTop: 4 }}>Level {profile?.level ?? 1} · {profile?.xp ?? 0} XP</div>
          </div>

          {!stats ? (
            <div style={{ height: 96, display: "flex", alignItems: "center", justifyContent: "center", color: MUTE }}>…</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                {stat("🍻", stats.drinks, "Drinks")}
                {stat("🔥", profile?.current_streak ?? 0, "Streak")}
                {stat("🎉", stats.sessions, "Sessions")}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {stat("💸", `₹${stats.spent}`, "Spent")}
                {stat("🏆", `#${profile?.level ?? 1}`, "Rank")}
                {stat("⭐", stats.topDrink.length > 8 ? stats.topDrink.slice(0, 7) + "…" : stats.topDrink, "Go-to")}
              </div>
            </>
          )}

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${FAINT}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: MUTE }}>track · compete · party</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: GOLD }}>chugchug.app</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button onClick={share} disabled={busy || !stats} className="glass-btn flex-1 flex items-center justify-center gap-2">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} Share
          </button>
          <button onClick={share} disabled={busy || !stats} className="glass-btn-secondary flex items-center justify-center gap-2" style={{ padding: "0 16px" }}>
            <Download size={16} />
          </button>
          <button onClick={onClose} className="glass-btn-secondary flex items-center justify-center" style={{ padding: "0 14px" }}>
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
