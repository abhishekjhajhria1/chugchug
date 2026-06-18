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
    // Disable the navigator LockManager (avoids "Lock was not released within
    // 5000ms" warnings in single-tab, mobile-style PWAs). NOTE: this MUST be a
    // function matching auth-js's LockFunc signature — the previous value was the
    // string 'no-op', which auth-js then tried to CALL as a function, throwing on
    // every getSession()/token refresh. That stripped the Authorization header
    // from requests, so they ran as the `anon` role and RLS blocked everything
    // (logging drinks, starting sessions, etc. all failed silently).
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn(),
  },
})
