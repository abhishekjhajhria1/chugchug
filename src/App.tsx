import { lazy, Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { useChug } from "./context/ChugContext"
import Layout from "./components/Layout"
import ErrorBoundary from "./components/ErrorBoundary"
import ManaByteOverlay from "./components/ManaByteOverlay"

// ── Lazy-loaded pages (code splitting) ──────────────────────────
const Home = lazy(() => import("./pages/Home"))
const Log = lazy(() => import("./pages/Log"))
const Party = lazy(() => import("./pages/Party"))
const Profile = lazy(() => import("./pages/Profile"))
const Auth = lazy(() => import("./pages/Auth"))
const Groups = lazy(() => import("./pages/Groups"))
const GroupFeed = lazy(() => import("./pages/GroupFeed"))
const GroupChat = lazy(() => import("./pages/GroupChat"))
const PartyView = lazy(() => import("./pages/PartyView"))
const PublicProfile = lazy(() => import("./pages/PublicProfile"))
const World = lazy(() => import("./pages/World"))
const GroupBalances = lazy(() => import("./pages/GroupBalances"))
const ConnectPage = lazy(() => import("./pages/ConnectPage"))
const Rank = lazy(() => import("./pages/Rank"))
const SessionView = lazy(() => import("./pages/SessionView"))
const Calendar = lazy(() => import("./pages/Calendar"))
const Challenges = lazy(() => import("./pages/Challenges"))
const Landing = lazy(() => import("./pages/Landing"))
const Tavern = lazy(() => import("./pages/Tavern"))
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"))
const Events = lazy(() => import("./pages/Events"))

// ── Loading skeleton ────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
      <div className="text-center relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div style={{
            width: 120, height: 120,
            borderRadius: '50%',
            border: '2px solid var(--amber)',
            opacity: 0.2,
            animation: 'loaderRing 2s ease-out infinite',
          }} />
        </div>
        <div className="text-6xl mb-4" style={{ animation: 'loaderPulse 1.5s ease-in-out infinite' }}>⛩️</div>
        <p className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif' }}>ChugChug</p>
      </div>
    </div>
  )
}

// ── Route-level error boundary ──────────────────────────────────
function RouteGuard({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

function App() {
  // Single auth source — from ChugContext (no duplicate onAuthStateChange here)
  const { user, loading } = useChug()

  // Show loader until auth state is resolved
  if (loading) {
    return <PageLoader />
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <Layout>
      <ManaByteOverlay />
      <Routes>
        <Route path="/"                    element={<RouteGuard><Home /></RouteGuard>} />
        <Route path="/log"                 element={<RouteGuard><Log /></RouteGuard>} />
        <Route path="/party"               element={<RouteGuard><Party /></RouteGuard>} />
        <Route path="/party/:id"           element={<RouteGuard><PartyView /></RouteGuard>} />
        <Route path="/world"               element={<RouteGuard><World /></RouteGuard>} />
        <Route path="/profile"             element={<RouteGuard><Profile /></RouteGuard>} />
        <Route path="/profile/:id"         element={<RouteGuard><PublicProfile /></RouteGuard>} />
        <Route path="/groups"              element={<RouteGuard><Groups /></RouteGuard>} />
        <Route path="/group/:id"           element={<RouteGuard><GroupFeed /></RouteGuard>} />
        <Route path="/group/:id/chat"      element={<RouteGuard><GroupChat /></RouteGuard>} />
        <Route path="/group/:id/balances"  element={<RouteGuard><GroupBalances /></RouteGuard>} />
        <Route path="/connect/:id"         element={<RouteGuard><ConnectPage /></RouteGuard>} />
        <Route path="/rank"                element={<RouteGuard><Rank /></RouteGuard>} />
        <Route path="/session/:id"         element={<RouteGuard><SessionView /></RouteGuard>} />
        <Route path="/calendar"            element={<RouteGuard><Calendar /></RouteGuard>} />
        <Route path="/challenges"          element={<RouteGuard><Challenges /></RouteGuard>} />
        <Route path="/tavern"              element={<RouteGuard><Tavern /></RouteGuard>} />
        <Route path="/events"              element={<RouteGuard><Events /></RouteGuard>} />
        <Route path="/admin"               element={<RouteGuard><AdminDashboard /></RouteGuard>} />
        {/* Redirect old routes */}
        <Route path="/live-party/:partyId?"element={<Navigate to="/" replace />} />
        <Route path="/social"              element={<Navigate to="/groups" replace />} />
        <Route path="/auth"                element={<Navigate to="/" replace />} />
        <Route path="*"                    element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App