import { useEffect, useState } from "react"
import { Routes, Route } from "react-router-dom"
import { supabase } from "./lib/supabase"
import type { Session } from "@supabase/supabase-js"
import Layout from "./components/Layout"
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

function App() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  if (!session) {
    return <Auth />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/log" element={<Log />} />
        <Route path="/party" element={<Party />} />
        <Route path="/party/:id" element={<PartyView />} />
        <Route path="/world" element={<World />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:id" element={<PublicProfile />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/group/:id" element={<GroupFeed />} />
        <Route path="/group/:id/chat" element={<GroupChat />} />
        <Route path="/group/:id/balances" element={<GroupBalances />} />
      </Routes>
    </Layout>
  )
}

export default App