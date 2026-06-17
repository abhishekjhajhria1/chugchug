import { useEffect, useState } from "react"
import { Bell, BellOff, BellRing } from "lucide-react"
import { useChug } from "../context/ChugContext"
import { useToast } from "./Toast"
import { pushSupported, pushConfigured, getPushEnabled, enablePush, disablePush } from "../lib/push"

export default function NotificationToggle() {
  const { user } = useChug()
  const toast = useToast()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const supported = pushSupported()

  useEffect(() => { getPushEnabled().then(setEnabled) }, [])

  const toggle = async () => {
    if (!user || busy) return
    setBusy(true)
    if (enabled) {
      await disablePush(user.id)
      setEnabled(false)
      toast.success("Reminders off")
    } else {
      const res = await enablePush(user.id)
      if (res.ok) { setEnabled(true); toast.success("Reminders on — we'll nudge you before your streak ends 🔥") }
      else toast.error(res.error || "Couldn't enable")
    }
    setBusy(false)
  }

  if (!supported) return null

  const Icon = enabled ? BellRing : pushConfigured() ? Bell : BellOff
  return (
    <button
      onClick={toggle}
      disabled={busy || !pushConfigured()}
      className="glass-btn-secondary w-full py-3 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
      style={{ borderColor: enabled ? "color-mix(in srgb, var(--amber) 30%, transparent)" : "var(--border-mid)", color: enabled ? "var(--amber)" : "var(--text-secondary)" }}
    >
      <Icon size={18} />
      {enabled ? "Reminders On" : pushConfigured() ? "Enable Reminders" : "Reminders (setup pending)"}
    </button>
  )
}
