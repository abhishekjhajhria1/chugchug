import { createClient } from "@supabase/supabase-js"

// ── Validate env vars at startup ──────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env"
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Disable navigator.locks — prevents "Lock was not released within 5000ms" in
    // single-tab mobile-style apps like ChugChug. Falls back to in-process lock.
    lock: 'no-op' as any,
  },
})
