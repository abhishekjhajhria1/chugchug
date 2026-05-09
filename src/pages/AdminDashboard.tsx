import { useState, useCallback } from "react"
import { useChug } from "../context/ChugContext"
import { supabase } from "../lib/supabase"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, QrCode, ScanLine, Gift, Minus, MapPin, Users, Loader2, Shield, Check } from "lucide-react"
import { useToast } from "../components/Toast"
import QRScanner from "../components/QRScanner"

interface ScannedUser {
  id: string
  username: string
  avatar_url: string | null
  level: number
  xp: number
  loyalty_points: number
}

export default function AdminDashboard() {
  const { user, profile } = useChug()
  const navigate = useNavigate()
  const toast = useToast()

  const [isScanning, setIsScanning] = useState(false)
  const [scannedUser, setScannedUser] = useState<ScannedUser | null>(null)
  const [deductAmount, setDeductAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [actionLog, setActionLog] = useState<string[]>([])

  // Check if current user is admin
  const isAdmin = profile?.role === 'bar_admin' || profile?.role === 'super_admin'

  // Handle QR scan — extract user ID from QR code
  const handleQRScan = useCallback(async (data: string) => {
    setIsScanning(false)
    setLoading(true)

    // QR data format: chugchug://profile/{userId} or just the userId
    const userId = data.includes('/') ? data.split('/').pop() : data

    if (!userId) {
      toast.error("Invalid QR code")
      setLoading(false)
      return
    }

    // Fetch user profile + loyalty points for this bar
    const { data: userData, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, level, xp")
      .eq("id", userId)
      .single()

    if (!userData || error) {
      toast.error("User not found")
      setLoading(false)
      return
    }

    // Get loyalty points for managed bar
    let loyaltyPoints = 0
    if (profile?.managed_bar_id) {
      const { data: loyaltyData } = await supabase
        .from("loyalty_points")
        .select("points")
        .eq("user_id", userId)
        .eq("bar_id", profile.managed_bar_id)
        .single()
      loyaltyPoints = loyaltyData?.points || 0
    }

    setScannedUser({
      ...userData,
      loyalty_points: loyaltyPoints,
    })
    setLoading(false)
  }, [profile, toast])

  // Deduct points
  const handleDeductPoints = async () => {
    if (!scannedUser || !profile?.managed_bar_id || !user) return
    const amount = parseInt(deductAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    if (amount > scannedUser.loyalty_points) {
      toast.error("Insufficient points")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("redeem_loyalty_points", {
        p_user_id: scannedUser.id,
        p_bar_id: profile.managed_bar_id,
        p_points: amount,
        p_admin_id: user.id,
      })

      if (error) throw error

      toast.success(`Deducted ${amount} points from ${scannedUser.username}`)
      setActionLog(prev => [`-${amount} pts from ${scannedUser.username} @ ${new Date().toLocaleTimeString()}`, ...prev])
      setScannedUser(prev => prev ? { ...prev, loyalty_points: data } : null)
      setDeductAmount("")
    } catch (err: any) {
      toast.error(err.message || "Failed to deduct points")
    } finally {
      setLoading(false)
    }
  }

  // Grant points
  const handleGrantPoints = async () => {
    if (!scannedUser || !profile?.managed_bar_id || !user) return
    const amount = parseInt(deductAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("earn_loyalty_points", {
        p_user_id: scannedUser.id,
        p_bar_id: profile.managed_bar_id,
        p_points: amount,
        p_reason: "admin_grant",
      })

      if (error) throw error

      toast.success(`Granted ${amount} points to ${scannedUser.username}`)
      setActionLog(prev => [`+${amount} pts to ${scannedUser.username} @ ${new Date().toLocaleTimeString()}`, ...prev])
      setScannedUser(prev => prev ? { ...prev, loyalty_points: data } : null)
      setDeductAmount("")
    } catch (err: any) {
      toast.error(err.message || "Failed to grant points")
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 px-6">
        <Shield size={48} className="opacity-30" style={{ color: 'var(--text-ghost)' }} />
        <p className="text-sm font-bold text-center" style={{ color: 'var(--text-muted)' }}>Admin access required</p>
        <p className="text-xs text-center" style={{ color: 'var(--text-ghost)' }}>
          This dashboard is for partner bar admins. Contact ChugChug team to get admin access.
        </p>
        <button onClick={() => navigate(-1)} className="glass-btn-secondary px-6 py-2 text-xs">Go Back</button>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 active:scale-90 transition-transform" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title">🛡️ Admin Dashboard</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Scan QR · Manage Points · Track Activity</p>
        </div>
      </div>

      {/* Scan Button */}
      <button
        onClick={() => setIsScanning(true)}
        className="w-full p-5 flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
        style={{
          background: 'linear-gradient(135deg, var(--amber-dim), rgba(216,162,94,0.05))',
          border: '2px dashed var(--amber)',
          borderRadius: 'var(--card-radius)',
        }}
      >
        <ScanLine size={24} style={{ color: 'var(--amber)' }} />
        <span className="text-sm font-black uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>
          Scan User QR
        </span>
      </button>

      {/* QR Scanner */}
      {isScanning && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setIsScanning(false)}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--amber)' }} />
        </div>
      )}

      {/* Scanned User Card */}
      {scannedUser && !loading && (
        <div className="p-5 space-y-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)' }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ background: 'var(--bg-deep)', border: '2px solid var(--amber)' }}>
              {scannedUser.avatar_url ? (
                <img src={scannedUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : '👤'}
            </div>
            <div>
              <p className="text-lg font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{scannedUser.username}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Level {scannedUser.level} · {scannedUser.xp} XP</p>
            </div>
          </div>

          {/* Current points */}
          <div className="flex items-center justify-between p-4" style={{ background: 'var(--amber-dim)', borderRadius: 'var(--card-radius)' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Loyalty Points</span>
            <span className="text-2xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>{scannedUser.loyalty_points}</span>
          </div>

          {/* Points input */}
          <div className="flex gap-2">
            <input
              type="number"
              value={deductAmount}
              onChange={e => setDeductAmount(e.target.value)}
              placeholder="Amount"
              className="glass-input flex-1 text-center font-black text-lg"
              min={1}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleGrantPoints}
              disabled={!deductAmount || loading}
              className="flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-30"
              style={{ background: 'var(--acid-dim)', border: '1px solid rgba(124,154,116,0.3)', color: 'var(--acid)', borderRadius: 'var(--card-radius)' }}
            >
              <Gift size={14} /> Grant
            </button>
            <button
              onClick={handleDeductPoints}
              disabled={!deductAmount || loading}
              className="flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-30"
              style={{ background: 'var(--coral-dim)', border: '1px solid rgba(209,32,32,0.3)', color: 'var(--coral)', borderRadius: 'var(--card-radius)' }}
            >
              <Minus size={14} /> Deduct
            </button>
          </div>

          <button
            onClick={() => { setScannedUser(null); setDeductAmount("") }}
            className="w-full py-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-ghost)' }}
          >
            Scan Another User
          </button>
        </div>
      )}

      {/* Action Log */}
      {actionLog.length > 0 && (
        <div>
          <p className="section-label mb-2 border-l-2 pl-2" style={{ borderColor: 'var(--text-muted)' }}>Recent Actions</p>
          <div className="space-y-1">
            {actionLog.slice(0, 10).map((log, i) => (
              <div key={i} className="text-xs py-1.5 px-3" style={{ background: 'var(--bg-deep)', borderRadius: '2px', color: 'var(--text-muted)' }}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
