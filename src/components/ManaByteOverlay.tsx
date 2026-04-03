import { useEffect, useState } from "react"

interface XpEvent {
    id: number
    amount: number
}

// Global hook registry for our animations
export default function ManaByteOverlay() {
    const [xpEvents, setXpEvents] = useState<XpEvent[]>([])
    const [levelUpTrigger, setLevelUpTrigger] = useState(false)

    useEffect(() => {
        let idCounter = 0
        ;(window as any).triggerXpAnimation = (amount: number) => {
            const id = ++idCounter
            setXpEvents(prev => [...prev, { id, amount }])
            // Remove the particle text after it finishes animating
            setTimeout(() => {
                setXpEvents(prev => prev.filter(e => e.id !== id))
            }, 3000)
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
            {/* CRT Level-Up Glitch Overlay */}
            {levelUpTrigger && (
                <div className="absolute inset-0 z-50 mix-blend-screen bg-black pointer-events-none">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,95,0,0.5)_0%,transparent_100%)] animate-pulse" />
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIi8+CjxyZWN0IHdpZHRoPSIzIiBoZWlnaHQ9IjEiIGZpbGw9IiMzMzMiLz4KPC9zdmc+')] opacity-20" />
                    <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex flex-col items-center">
                        <h1 className="text-6xl md:text-8xl font-black text-white mix-blend-difference uppercase tracking-[0.2em] transform scale-y-150 skew-x-12 animate-[glitch_0.2s_ease-in-out_infinite_alternate]" style={{ textShadow: '-4px 0 #FF5F00, 4px 0 #00F0FF' }}>
                            LEVEL UP
                        </h1>
                        <p className="font-bold text-white/80 mt-4 tracking-widest uppercase bg-black/60 px-4 py-1 border border-white/20">
                            Neural Link Upgraded
                        </p>
                    </div>
                </div>
            )}

            {/* Floating Mana-Bytes */}
            {xpEvents.map(ev => (
                <div 
                    key={ev.id} 
                    className="absolute animate-floatUpAndFade flex flex-col items-center"
                    style={{
                        bottom: '20%',
                        left: `${50 + (Math.random() * 40 - 20)}%`, // Randomize horizontal pop slightly around center
                    }}
                >
                    <span className="text-2xl font-black glow-text" style={{ color: '#FF5F00', textShadow: '0 0 10px #FF5F00, 0 0 20px #FF5F00' }}>
                        +{ev.amount} XP
                    </span>
                    <span className="text-[10px] uppercase font-bold text-white/50 tracking-widest mt-1">Mana-Byte</span>
                </div>
            ))}
            
            {/* Adding the keyframes dynamically so we don't need to rebuild index.css for just these */}
            <style>{`
                @keyframes floatUpAndFade {
                    0% { transform: translateY(0) scale(0.5); opacity: 0; }
                    20% { transform: translateY(-20px) scale(1.2); opacity: 1; }
                    50% { transform: translateY(-50px) scale(1); opacity: 1; }
                    100% { transform: translateY(-100px) scale(0.8); opacity: 0; }
                }
                .animate-floatUpAndFade {
                    animation: floatUpAndFade 3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                }
                @keyframes glitch {
                    0% { transform: skew(0deg); }
                    20% { transform: skew(-10deg); }
                    40% { transform: skew(10deg); }
                    60% { transform: skew(-5deg) translate(5px, -5px); }
                    80% { transform: skew(5deg) translate(-5px, 5px); }
                    100% { transform: skew(0deg); }
                }
            `}</style>
        </div>
    )
}
