import { useEffect, useState, useRef } from "react"
import { useChug } from "../context/ChugContext"
import { firebaseDb } from "../lib/firebase"
import { ref, onValue, remove, set } from "firebase/database"
import { Sparkles, Zap } from "lucide-react"

// A generic magic sound effect
const CLINK_SOUND = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTv9T19Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Qf1B/UH9Q"

export default function ClinkOverlay() {
    const { user } = useChug()
    const [clinkData, setClinkData] = useState<{ senderId: string, timestamp: number } | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        if (!user) return
        
        audioRef.current = new Audio(CLINK_SOUND)

        const clinkRef = ref(firebaseDb, `clinks/${user.id}`)
        const unsubscribe = onValue(clinkRef, (snapshot) => {
            const data = snapshot.val()
            if (data && data.timestamp > Date.now() - 10000) {
                // A new clink within the last 10 seconds!
                setClinkData(data)
                audioRef.current?.play().catch(() => {})
                
                // Once played, remove from FB to prevent loops
                remove(clinkRef)

                // Hide overlay after 4 seconds
                setTimeout(() => {
                    setClinkData(null)
                }, 4000)
            }
        })

        return () => unsubscribe()
    }, [user])

    // Global trigger function to initiate a clink on someone else's screen (and our own)
    // We attach this to the window object so any component can fire it easily
    useEffect(() => {
        if (!user) return
        ;(window as any).triggerClink = (targetUserId: string) => {
            // Trigger their screen
            set(ref(firebaseDb, `clinks/${targetUserId}`), {
                senderId: user.id,
                timestamp: Date.now()
            })
            // Trigger our own screen immediately
            setClinkData({ senderId: user.id, timestamp: Date.now() })
            audioRef.current?.play().catch(() => {})
            setTimeout(() => setClinkData(null), 4000)
        }
        return () => {
            delete (window as any).triggerClink
        }
    }, [user])


    if (!clinkData) return null

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none flex flex-col items-center justify-center overflow-hidden">
            {/* Dark glass backdrop flash */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-[pulse_1s_ease-in-out_3]" />
            
            {/* Orange Neon Flash */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,95,0,0.4)_0%,transparent_70%)] animate-ping opacity-50" />

            {/* The Raven / Potion / Magic Drop Animation */}
            <div className="relative z-10 flex flex-col items-center justify-center animate-bounce">
                <div className="relative">
                    <Zap className="text-[#FF5F00] drop-shadow-[0_0_30px_#FF5F00] mix-blend-screen" size={120} strokeWidth={1} style={{ filter: 'drop-shadow(0 0 20px #FF5F00)'}} />
                    <Sparkles className="text-purple-400 absolute -top-4 -right-4 animate-spin-slow drop-shadow-[0_0_15px_#A855F7]" size={48} />
                </div>
                
                <h1 className="mt-8 text-5xl font-black text-white uppercase tracking-[0.2em] drop-shadow-[0_0_20px_#FF5F00] animate-pulse glow-text" style={{ textShadow: '0 0 20px #ff5f00, 0 0 40px #ff5f00' }}>
                    THE CLINK!
                </h1>
                <p className="mt-2 text-white/80 font-bold uppercase tracking-widest text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
                    Connection Established
                </p>
            </div>
        </div>
    )
}
