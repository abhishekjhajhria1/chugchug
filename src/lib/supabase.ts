import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

// ──────────────────────────────────────────────────────────────
// FIX: Disable navigator.locks for Supabase Auth.
//
// Supabase GoTrue-JS uses navigator.locks.request() to serialize
// auth token refreshes across tabs. In development (HMR reloads,
// multiple rapid page transitions) this frequently causes:
//   "Lock was not released within 5000ms"
// which makes ALL supabase database operations hang forever.
//
// Removing navigator.locks forces the library to fall back to a
// simple in-process lock, which is perfectly fine for a single-tab
// mobile-style app like ChugChug.
// ──────────────────────────────────────────────────────────────
try {
  if (typeof globalThis.navigator !== 'undefined' && globalThis.navigator.locks) {
    Object.defineProperty(globalThis.navigator, 'locks', {
      value: undefined,
      writable: true,
      configurable: true,
    })
  }
} catch {
  // If the browser won't let us override, that's fine — fallback path
  console.warn('Could not override navigator.locks — Supabase will use navigator locks.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
