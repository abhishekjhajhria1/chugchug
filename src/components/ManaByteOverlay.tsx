import { useEffect, useState } from "react"
import { useChug } from "../context/ChugContext"

interface XpEvent {
    id: number
    amount: number
}

export default function ManaByteOverlay() {
    const [xpEvents, setXpEvents] = useState<XpEvent[]>([])
    const [levelUpTrigger, setLevelUpTrigger] = useState(false)
    const { onXpGain, onLevelUp } = useChug()

    useEffect(() => {
        let idCounter = 0

        const unsubXp = onXpGain((amount: number) => {
            const id = ++idCounter
            setXpEvents(prev => [...prev, { id, amount }])
            setTimeout(() => {
                setXpEvents(prev => prev.filter(e => e.id !== id))
            }, 2500)
        })

        const unsubLevel = onLevelUp(() => {
            setLevelUpTrigger(true)
            setTimeout(() => setLevelUpTrigger(false), 2500)
        })

        return () => {
            unsubXp()
            unsubLevel()
        }
    }, [onXpGain, onLevelUp])

    return (
        <div className="fixed inset-0 z-[110] pointer-events-none overflow-hidden">
            {/* Level Up Celebration */}
            {levelUpTrigger && (
                <div className="absolute inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, rgba(245,166,35,0.15), transparent 70%)' }} />
                    <div className="relative text-center anim-pop">
                        <div className="text-7xl mb-3">🎉</div>
                        <h1 className="text-4xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber-light)', textShadow: '0 0 30px rgba(245,166,35,0.5)' }}>
                            Level Up!
                        </h1>
                        <p className="text-sm font-bold mt-2" style={{ color: 'var(--text-muted)' }}>
                            You're on fire! Keep going 🔥
                        </p>
                    </div>
                </div>
            )}

            {/* Floating XP popups */}
            {xpEvents.map(ev => (
                <div
                    key={ev.id}
                    className="absolute animate-floatUpAndFade flex flex-col items-center"
                    style={{
                        bottom: '25%',
                        left: `${45 + (Math.random() * 30 - 15)}%`,
                    }}
                >
                    <span className="text-xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)', textShadow: '0 0 12px rgba(245,166,35,0.5)' }}>
                        +{ev.amount} XP
                    </span>
                    <span className="text-[10px] font-bold mt-0.5" style={{ color: 'var(--text-muted)' }}>✨ nice!</span>
                </div>
            ))}
        </div>
    )
}
