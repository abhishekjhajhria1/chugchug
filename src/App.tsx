import { useEffect, useState } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { supabase } from "./lib/supabase"
import type { Session } from "@supabase/supabase-js"
import Layout from "./components/Layout"
import BottomNav from "./components/BottomNav"
import Home from "./pages/Home"
import Log from "./pages/Log"
import Party from "./pages/Party"
import Profile from "./pages/Profile"
import Auth from "./pages/Auth"
import Groups from "./pages/Groups"
import GroupFeed from "./pages/GroupFeed"
import GroupChat from "./pages/GroupChat"
import PartyView from "./pages/PartyView"
import PublicProfile from "./pages/PublicProfile"
import World from "./pages/World"
import GroupBalances from "./pages/GroupBalances"
import ConnectPage from "./pages/ConnectPage"
import Rank from "./pages/Rank"
import SessionView from "./pages/SessionView"
import Calendar from "./pages/Calendar"

import ManaByteOverlay from "./components/ManaByteOverlay"
import Landing from "./pages/Landing"

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Single auth listener — no parallel getSession() call to avoid lock contention
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setReady(true)
    })

    // Fallback: if no event fires within 2 seconds, consider auth resolved (no session)
    const timeout = setTimeout(() => {
      setReady(true)
    }, 2000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  // Show nothing until auth state is resolved — prevents flash
  if (!ready) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
        <div className="text-center">
          <div className="text-5xl mb-3">🍻</div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif' }}>Loading ChugChug...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <ManaByteOverlay />
      <Routes>
        <Route path="/"                    element={<Home />} />
        <Route path="/log"                 element={<Log />} />
        <Route path="/party"               element={<Party />} />
        <Route path="/party/:id"           element={<PartyView />} />
        <Route path="/world"               element={<World />} />
        <Route path="/profile"             element={<Profile />} />
        <Route path="/profile/:id"         element={<PublicProfile />} />
        <Route path="/groups"              element={<Groups />} />
        <Route path="/group/:id"           element={<GroupFeed />} />
        <Route path="/group/:id/chat"      element={<GroupChat />} />
        <Route path="/group/:id/balances"  element={<GroupBalances />} />
        <Route path="/connect/:id"         element={<ConnectPage />} />
        <Route path="/rank"                element={<Rank />} />
        <Route path="/session/:id"         element={<SessionView />} />
        <Route path="/calendar"             element={<Calendar />} />
        {/* Redirect old routes */}
        <Route path="/live-party/:partyId?"element={<Navigate to="/" replace />} />
        <Route path="/social"              element={<Navigate to="/groups" replace />} />
        <Route path="/auth"                element={<Navigate to="/" replace />} />
        <Route path="*"                    element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </Layout>
  )
}

export default App