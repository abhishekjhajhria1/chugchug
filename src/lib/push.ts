// Web-push client helpers. Subscribing stores the subscription in Supabase;
// a backend (gotw-backend) sends notifications using the VAPID private key.
// Requires VITE_VAPID_PUBLIC_KEY to be set.
import { supabase } from "./supabase"

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() || ""

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window

export const pushConfigured = () => !!VAPID_PUBLIC

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function getPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return !!sub && Notification.permission === "granted"
  } catch { return false }
}

export async function enablePush(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: "Notifications aren't supported on this device" }
  if (!VAPID_PUBLIC) return { ok: false, error: "Push isn't configured yet (missing VAPID key)" }
  try {
    const perm = await Notification.requestPermission()
    if (perm !== "granted") return { ok: false, error: "Permission denied" }

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
    }
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
    }, { onConflict: "endpoint" })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to enable" }
  }
}

export async function disablePush(userId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const endpoint = sub.endpoint
      await sub.unsubscribe()
      await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint)
    }
  } catch { /* ignore */ }
}
