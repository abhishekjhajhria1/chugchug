import { useState, useEffect, useRef } from "react"
import { useChug } from "../context/ChugContext"
import { supabase } from "../lib/supabase"
import { firebaseDb } from "../lib/firebase"
import { ref, onValue, set, serverTimestamp } from "firebase/database"
import { QRCodeSVG } from "qrcode.react"
import { Zap, Clock, Timer, ScanLine } from "lucide-react"
import BeerCounter from "../components/BeerCounter"
import QRScanner from "../components/QRScanner"

const CHUG_SOUND = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTv9T19Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Q"

export default function SessionPage() {
    const { user, profile } = useChug()
    const [partyId, setPartyId] = useState<string>("")
    const [startTime] = useState(Date.now())
    const [elapsed, setElapsed] = useState("0:00")
    const [pace, setPace] = useState("-")
    const [currentCount, setCurrentCount] = useState(0)
    const [lastBuzz, setLastBuzz] = useState<{ userId: string; username: string; time: number } | null>(null)
    const [showBlast, setShowBlast] = useState(false)
    const [isScanning, setIsScanning] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        if (!user) return
        const pid = "SESS_" + user.id.substring(0, 8).toUpperCase()
        setPartyId(pid)
        audioRef.current = new Audio(CHUG_SOUND)

        // Find initial count to calculate pace
        const fetchCount = async () => {
            const today = new Date().toISOString().split('T')[0]
            const { data } = await supabase.from("beer_counts").select("count").eq("user_id", user.id).eq("date", today).single()
            if (data) setCurrentCount(data.count)
        }
        fetchCount()
    }, [user])

    useEffect(() => {
        if (!partyId) return
        
        // Listen for Buzz
        const partyRef = ref(firebaseDb, `parties/${partyId}/last_buzz`)
        const unsubscribe = onValue(partyRef, (snapshot) => {
            const data = snapshot.val()
            if (data && data.time > Date.now() - 5000 && data.userId !== user?.id) {
                setLastBuzz(data)
                setShowBlast(true)
                audioRef.current?.play().catch(() => {})
                setTimeout(() => setShowBlast(false), 3000)
            }
        })

        // Setup live sync for count
        const countRef = ref(firebaseDb, `parties/${partyId}/counters/${user?.id}`)
        const unsubCount = onValue(countRef, (snap) => {
             if (snap.exists()) setCurrentCount(snap.val().count)
        })

        const timer = setInterval(() => {
            const seconds = Math.floor((Date.now() - startTime) / 1000)
            const m = Math.floor(seconds / 60)
            const s = seconds % 60
            setElapsed(`${m}:${s.toString().padStart(2, '0')}`)

            // Pace calculation
            if (currentCount > 0) {
                const minsPerBeer = (seconds / 60) / currentCount
                setPace(minsPerBeer < 1 ? "< 1 min/beer" : `${minsPerBeer.toFixed(1)} mins/beer`)
            } else {
                setPace("-")
            }
        }, 1000)

        return () => {
            unsubscribe()
            unsubCount()
            clearInterval(timer)
        }
    }, [partyId, user, startTime, currentCount])

    const handleBuzz = () => {
        if (!partyId || !user) return
        set(ref(firebaseDb, `parties/${partyId}/last_buzz`), {
            userId: user.id,
            username: profile?.username || "Someone",
            time: serverTimestamp()
        })
    }

    const joinUrl = `${window.location.origin}/live-party/${partyId}`

    const handleQRScan = (decodedText: string) => {
        setIsScanning(false)
        if (decodedText && decodedText.includes('/live-party/')) {
            window.location.href = decodedText
        } else {
            alert("Invalid party QR code.")
        }
    }

    return (
        <div className="max-w-md mx-auto space-y-6 pb-24 font-sans px-4 pt-6 relative overflow-hidden">
            {/* Visual Blast */}
            {showBlast && (
                <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center anim-pop">
                    <div className="absolute inset-0 bg-amber-400/20 backdrop-blur-sm animate-pulse" />
                    <div className="relative text-center">
                        <div className="text-6xl mb-4 animate-bounce">🍺💨</div>
                        <h2 className="text-3xl font-black text-white drop-shadow-[0_0_20px_rgba(251,191,36,0.8)] uppercase">
                            {lastBuzz?.username} FINISHED!
                        </h2>
                    </div>
                </div>
            )}

            {/* Interactive Stats */}
            <h1 className="page-title text-center mb-4">Command Center</h1>
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="glass-card p-4 flex flex-col items-center justify-center" style={{ borderColor: 'rgba(245,166,35,0.15)' }}>
                    <Clock size={16} style={{ color: 'var(--amber)' }} className="mb-2" />
                    <span className="text-[10px] font-bold uppercase tracking-widest leading-tight" style={{ color: 'var(--text-muted)' }}>Session Timer</span>
                    <span className="text-lg font-black font-mono" style={{ color: 'var(--text-primary)' }}>{elapsed}</span>
                </div>
                <div className="glass-card p-4 flex flex-col items-center justify-center" style={{ borderColor: 'rgba(123,143,245,0.15)' }}>
                    <Timer size={16} style={{ color: 'var(--indigo)' }} className="mb-2" />
                    <span className="text-[10px] font-bold uppercase tracking-widest leading-tight" style={{ color: 'var(--text-muted)' }}>Pace Monitor</span>
                    <span className="text-sm mt-1 font-black" style={{ color: 'var(--indigo)' }}>{pace}</span>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center mt-6 w-full gap-6">
                <div className="w-full">
                    <BeerCounter partyId={partyId} />
                </div>
                
                {/* I'm Done Alert Button */}
                <button 
                    onClick={handleBuzz}
                    className="w-full max-w-[280px] py-4 rounded-3xl bg-linear-to-r from-rose-500 to-rose-600 text-white font-black text-sm uppercase tracking-widest shadow-[0_0_30px_rgba(244,63,94,0.4)] hover:shadow-[0_0_40px_rgba(244,63,94,0.6)] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Zap size={20} fill="currentColor" /> I'm Done! (Broadcast)
                </button>
            </div>
            
            {/* Join/Invite QR */}
            <div className="glass-card glow-violet border-white/5 bg-black/20 mt-8 p-6 text-center">
                <h3 className="text-xs font-black text-white/60 uppercase tracking-widest mb-4">Invite to Session</h3>
                <div className="bg-white p-3 rounded-2xl inline-block shadow-2xl mb-4 transform transition-transform hover:scale-105 duration-300">
                    <QRCodeSVG value={joinUrl} size={140} fgColor="#1a1530" bgColor="transparent" />
                </div>
                <p className="text-[10px] font-bold text-white/30 uppercase max-w-[200px] mx-auto leading-relaxed mb-4">
                    Friends scanning this will instantly join your Live Party dashboard.
                </p>
                <button 
                  onClick={() => setIsScanning(true)}
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors border border-white/10"
                >
                    <ScanLine size={16} /> Scan to Join
                </button>
            </div>

            {isScanning && (
                <QRScanner 
                    title="Scan Party Code"
                    onScan={handleQRScan} 
                    onClose={() => setIsScanning(false)} 
                />
            )}
        </div>
    )
}
