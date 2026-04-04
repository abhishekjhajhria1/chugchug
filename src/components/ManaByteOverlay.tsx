import { useEffect, useState } from "react"

interface XpEvent {
    id: number
    amount: number
}

export default function ManaByteOverlay() {
    const [xpEvents, setXpEvents] = useState<XpEvent[]>([])
    const [levelUpTrigger, setLevelUpTrigger] = useState(false)

    useEffect(() => {
        let idCounter = 0
        ;(window as any).triggerXpAnimation = (amount: number) => {
            const id = ++idCounter
            setXpEvents(prev => [...prev, { id, amount }])
            setTimeout(() => {
                setXpEvents(prev => prev.filter(e => e.id !== id))
            }, 2500)
        }

        ;(window as any).triggerLevelUpAnimation = () => {
            setLevelUpTrigger(true)
            setTimeout(() => setLevelUpTrigger(false), 2500)
        }

        return () => {
            delete (window as any).triggerXpAnimation
            delete (window as any).triggerLevelUpAnimation
        }
    }, [])

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

            <style>{`
                @keyframes floatUpAndFade {
                    0% { transform: translateY(0) scale(0.7); opacity: 0; }
                    15% { transform: translateY(-15px) scale(1.1); opacity: 1; }
                    60% { transform: translateY(-40px) scale(1); opacity: 1; }
                    100% { transform: translateY(-80px) scale(0.9); opacity: 0; }
                }
                .animate-floatUpAndFade {
                    animation: floatUpAndFade 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                }
            `}</style>
        </div>
    )
}
