import { useState, useEffect, useCallback } from "react"
import { useChug } from "../context/ChugContext"
import { supabase } from "../lib/supabase"
import { AlertTriangle, Phone, MessageCircle, MapPin, X, Loader2, Shield } from "lucide-react"
import { useToast } from "./Toast"

// ─── Env placeholders for messaging APIs ───────────────────────
// const TWILIO_API = import.meta.env.VITE_TWILIO_API || ""
// const WHATSAPP_API = import.meta.env.VITE_WHATSAPP_API || ""

interface EmergencySOSProps {
  groupId?: string
  crewMembers?: { id: string; username: string; phone?: string }[]
}

export default function EmergencySOS({ groupId, crewMembers = [] }: EmergencySOSProps) {
  const { user, profile } = useChug()
  const toast = useToast()

  const [showModal, setShowModal] = useState(false)
  const [sending, setSending] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null)
  const [customMessage, setCustomMessage] = useState("")

  // Get location when modal opens
  useEffect(() => {
    if (!showModal) return
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => toast.warning("Location unavailable — alert will be sent without coordinates")
      )
    }
  }, [showModal, toast])

  const sendSOS = useCallback(async () => {
    if (!user || !profile) return
    setSending(true)

    const message = customMessage.trim() || "I need help!"
    const mapsLink = location ? `https://www.google.com/maps?q=${location.lat},${location.lng}` : ""
    const fullMessage = `🚨 SOS from ${profile.username}: ${message}${mapsLink ? `\n📍 Location: ${mapsLink}` : ""}`

    try {
      // 1. Store in Supabase
      await supabase.from("emergency_alerts").insert({
        sender_id: user.id,
        group_id: groupId || null,
        message,
        latitude: location?.lat || null,
        longitude: location?.lng || null,
      })

      // 2. Send via available channels
      let sentCount = 0

      // WhatsApp deep links (works on mobile)
      for (const member of crewMembers.filter(m => m.id !== user.id)) {
        // Try WhatsApp first
        if (member.phone) {
          const phone = member.phone.replace(/[^0-9]/g, "")
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(fullMessage)}`, "_blank")
          sentCount++
        }
      }

      // 3. SMS fallback — open native SMS
      if (sentCount === 0 && crewMembers.length > 0) {
        const smsBody = encodeURIComponent(fullMessage)
        window.open(`sms:?body=${smsBody}`, "_self")
      }

      // 4. Clipboard fallback
      try {
        await navigator.clipboard.writeText(fullMessage)
      } catch { /* ignore clipboard errors */ }

      toast.success(`SOS sent! ${sentCount > 0 ? `Opened ${sentCount} chat(s)` : "Message copied to clipboard — share with your crew"}`)
      setShowModal(false)
      setCustomMessage("")
    } catch (err) {
      toast.error("Failed to send SOS. Try calling emergency services directly.")
    } finally {
      setSending(false)
    }
  }, [user, profile, groupId, crewMembers, customMessage, location, toast])

  return (
    <>
      {/* SOS Button */}
      <button
        onClick={() => setShowModal(true)}
        className="p-2.5 rounded-full active:scale-90 transition-all"
        style={{
          background: 'linear-gradient(135deg, rgba(232,58,58,0.2), rgba(232,58,58,0.05))',
          border: '2px solid var(--coral)',
          color: 'var(--coral)',
        }}
        title="Emergency SOS"
      >
        <Shield size={18} />
      </button>

      {/* SOS Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }} />
          <div
            className="relative w-full max-w-sm p-6 space-y-5"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-mid)',
              border: '2px solid var(--coral)',
              borderRadius: 'var(--card-radius)',
              boxShadow: '0 0 40px rgba(232,58,58,0.2)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={22} style={{ color: 'var(--coral)' }} />
                <h2 className="text-lg font-black uppercase tracking-wider" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--coral)' }}>
                  Emergency SOS
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1" style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              This will alert your crew members with your location. Use in emergencies only.
            </p>

            {/* Location status */}
            <div className="flex items-center gap-2 p-3" style={{ background: 'var(--bg-deep)', borderRadius: 'var(--card-radius)' }}>
              <MapPin size={14} style={{ color: location ? 'var(--acid)' : 'var(--text-ghost)' }} />
              <span className="text-xs font-bold" style={{ color: location ? 'var(--acid)' : 'var(--text-ghost)' }}>
                {location ? 'Location acquired ✓' : 'Acquiring location...'}
              </span>
            </div>

            {/* Custom message */}
            <textarea
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              placeholder="Optional: Add details (e.g., 'need a ride home')"
              className="glass-input w-full"
              rows={2}
              maxLength={200}
              style={{ resize: 'none' }}
            />

            {/* Crew members who will be alerted */}
            {crewMembers.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-ghost)' }}>
                  Will alert {crewMembers.filter(m => m.id !== user?.id).length} crew members
                </p>
              </div>
            )}

            {/* Send button */}
            <button
              onClick={sendSOS}
              disabled={sending}
              className="w-full py-4 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(135deg, var(--coral), #D94242)',
                color: '#fff',
                borderRadius: 'var(--card-radius)',
                boxShadow: '0 4px 20px color-mix(in srgb, var(--coral) 30%, transparent)',
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <AlertTriangle size={18} />}
              {sending ? 'Sending...' : 'Send SOS Alert'}
            </button>

            {/* Direct call buttons */}
            <div className="flex gap-2">
              <a
                href="tel:112"
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)', borderRadius: 'var(--card-radius)' }}
              >
                <Phone size={12} /> Call 112
              </a>
              <a
                href="tel:100"
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)', borderRadius: 'var(--card-radius)' }}
              >
                <Phone size={12} /> Police 100
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
