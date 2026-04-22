import { useState } from "react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { ArrowRight, RotateCcw } from "lucide-react"

// ── Archetype Definitions ──
const ARCHETYPES = {
  ronin: {
    id: 'ronin',
    title: 'Ronin',
    emoji: '⚔️',
    subtitle: 'The Lone Wolf',
    color: '#D12020',
    description: 'You follow your own path. Whether it\'s solo sessions at a dive bar or dominating the leaderboard alone — you don\'t need a crew to have a legendary night.',
    trait: 'Independent • Bold • Unpredictable',
    lore: 'A masterless warrior, the Ronin walks their own path. They drink when they want, fight when they must, and answer to no one.',
  },
  shogun: {
    id: 'shogun',
    title: 'Shogun',
    emoji: '👑',
    subtitle: 'The Natural Leader',
    color: '#D8A25E',
    description: 'You\'re the one who organizes the night, picks the spot, and makes sure everyone\'s having a great time. The crew follows you.',
    trait: 'Commanding • Social • Strategic',
    lore: 'Born to lead, the Shogun rallies warriors and commands respect. They set the pace, choose the tavern, and everyone follows.',
  },
  sage: {
    id: 'sage',
    title: 'Sage',
    emoji: '🧘',
    subtitle: 'The Balanced Mind',
    color: '#7C9A74',
    description: 'You know your limits. You balance gym days with drinking nights, and your greatest weapon is discipline. You play the long game.',
    trait: 'Disciplined • Wise • Consistent',
    lore: 'The Sage understands that true strength comes from balance. They master both the art of living and the art of letting go.',
  },
  berserker: {
    id: 'berserker',
    title: 'Berserker',
    emoji: '💀',
    subtitle: 'The Party Animal',
    color: '#9B59B6',
    description: 'When you go out, you GO OUT. You\'re the last one standing, the first one on the dance floor, and the one everyone talks about the next day.',
    trait: 'Chaotic • Legendary • Fearless',
    lore: 'The Berserker knows no limits. When the battle begins, they charge headfirst and don\'t stop until the sun rises.',
  },
}

type ArchetypeId = keyof typeof ARCHETYPES

// ── Quiz Questions ──
interface QuizQuestion {
  question: string
  emoji: string
  options: {
    text: string
    archetype: ArchetypeId
  }[]
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: "It's Friday night. What's the move?",
    emoji: "🌙",
    options: [
      { text: "Hit up the crew group chat and plan something epic", archetype: "shogun" },
      { text: "Solo mission to my favorite spot, no agenda needed", archetype: "ronin" },
      { text: "Gym first, then I'll see how I feel", archetype: "sage" },
      { text: "Pre-game starts at 6. I'm already committed.", archetype: "berserker" },
    ]
  },
  {
    question: "Your friend orders another round at 2 AM. You:",
    emoji: "🕐",
    options: [
      { text: "LET'S GO. One more won't hurt (it always does)", archetype: "berserker" },
      { text: "Nah I'm good. Switch to water.", archetype: "sage" },
      { text: "Depends on if the next bar is worth it", archetype: "ronin" },
      { text: "I'm buying the round. Everyone's staying.", archetype: "shogun" },
    ]
  },
  {
    question: "What's your hangover protocol?",
    emoji: "☀️",
    options: [
      { text: "What hangover? I don't stop.", archetype: "berserker" },
      { text: "Already planned for it — hydration pack, electrolytes, sleep mask", archetype: "sage" },
      { text: "Suffer in silence, tell no one", archetype: "ronin" },
      { text: "Rally the crew for a recovery brunch", archetype: "shogun" },
    ]
  },
  {
    question: "Someone challenges you to a chugging contest. You:",
    emoji: "🏆",
    options: [
      { text: "Accept immediately. No hesitation.", archetype: "berserker" },
      { text: "Set the terms first. I don't play unless I can win.", archetype: "shogun" },
      { text: "Politely decline. I don't need to prove anything.", archetype: "sage" },
      { text: "Only if it's 1v1. No audience needed.", archetype: "ronin" },
    ]
  },
  {
    question: "Your ideal drinking buddy is someone who:",
    emoji: "🤝",
    options: [
      { text: "Can keep up with me, no questions asked", archetype: "berserker" },
      { text: "Brings good conversation and knows when to call it", archetype: "sage" },
      { text: "I don't need one. My own company is enough.", archetype: "ronin" },
      { text: "Has a car, knows every spot in town, and handles logistics", archetype: "shogun" },
    ]
  },
]

interface ArchetypeQuizProps {
  onComplete: (archetype: string) => void
  onSkip?: () => void
}

export default function ArchetypeQuiz({ onComplete, onSkip }: ArchetypeQuizProps) {
  const { user, refreshProfile } = useChug()
  const [step, setStep] = useState(0) // 0 = intro, 1-5 = questions, 6 = result
  const [answers, setAnswers] = useState<ArchetypeId[]>([])
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [result, setResult] = useState<ArchetypeId | null>(null)
  const [saving, setSaving] = useState(false)

  const handleAnswer = (archetypeId: ArchetypeId, optionIndex: number) => {
    setSelectedOption(optionIndex)
    const newAnswers = [...answers, archetypeId]
    setAnswers(newAnswers)

    setTimeout(() => {
      setSelectedOption(null)
      if (step < QUIZ_QUESTIONS.length) {
        setStep(step + 1)
      }

      // After last question — calculate result
      if (step === QUIZ_QUESTIONS.length) {
        const counts: Record<string, number> = {}
        newAnswers.forEach(a => { counts[a] = (counts[a] || 0) + 1 })
        const winner = Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0] as ArchetypeId
        setResult(winner)
        setStep(QUIZ_QUESTIONS.length + 1)
      }
    }, 400)
  }

  const handleSave = async () => {
    if (!user || !result) return
    setSaving(true)
    await supabase.from('profiles').update({ archetype: result }).eq('id', user.id)
    await refreshProfile()
    setSaving(false)
    onComplete(result)
  }

  const handleRetake = () => {
    setStep(0)
    setAnswers([])
    setSelectedOption(null)
    setResult(null)
  }

  // ── INTRO SCREEN ──
  if (step === 0) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-5 anim-fade" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}>
        <div className="w-full max-w-md text-center space-y-6 anim-enter">
          <div className="text-7xl mb-4">⛩️</div>
          <h1 className="text-2xl font-black uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>
            What Kind of Drinker Are You?
          </h1>
          <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            5 questions to discover your drinking archetype.
            Your identity shapes your profile, badges, and how the crew sees you.
          </p>

          <div className="grid grid-cols-4 gap-2">
            {Object.values(ARCHETYPES).map(a => (
              <div key={a.id} className="p-3 rounded-[4px] text-center" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)' }}>
                <div className="text-2xl mb-1">{a.emoji}</div>
                <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: a.color }}>{a.title}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full py-4 rounded-[4px] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, var(--amber), #E8880A)', color: '#1A1208' }}
          >
            Begin <ArrowRight size={18} />
          </button>

          {onSkip && (
            <button onClick={onSkip} className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
              Skip for now
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── RESULT SCREEN ──
  if (step === QUIZ_QUESTIONS.length + 1 && result) {
    const archetype = ARCHETYPES[result]
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-5 anim-fade" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}>
        <div className="w-full max-w-md text-center space-y-5 anim-enter">
          {/* Big reveal */}
          <div className="relative inline-block">
            <div
              className="w-32 h-32 mx-auto rounded-full flex items-center justify-center text-6xl"
              style={{
                background: `${archetype.color}15`,
                border: `3px solid ${archetype.color}`,
                boxShadow: `0 0 40px ${archetype.color}30`,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            >
              {archetype.emoji}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Your Archetype Is</p>
            <h1 className="text-3xl font-black uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: archetype.color }}>
              {archetype.title}
            </h1>
            <p className="text-sm font-bold mt-1" style={{ color: archetype.color + 'CC' }}>{archetype.subtitle}</p>
          </div>

          <div className="p-4 rounded-[4px] text-left" style={{ background: 'var(--bg-deep)', border: `1px solid ${archetype.color}30` }}>
            <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: archetype.color }}>
              {archetype.trait}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {archetype.description}
            </p>
            <p className="text-xs italic mt-3" style={{ color: 'var(--text-ghost)' }}>
              "{archetype.lore}"
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-[4px] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
            style={{ background: `linear-gradient(135deg, ${archetype.color}, ${archetype.color}DD)`, color: '#fff' }}
          >
            {saving ? 'Saving...' : `Claim ${archetype.title} Identity`}
          </button>

          <button onClick={handleRetake} className="flex items-center justify-center gap-1.5 mx-auto text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
            <RotateCcw size={12} /> Retake Quiz
          </button>
        </div>
      </div>
    )
  }

  // ── QUESTION SCREEN ──
  const currentQuestion = QUIZ_QUESTIONS[step - 1]
  if (!currentQuestion) return null

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center p-5 anim-fade" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}>
      <div className="w-full max-w-md space-y-6 anim-enter">
        {/* Progress */}
        <div className="flex items-center gap-2">
          {QUIZ_QUESTIONS.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-all duration-300"
              style={{
                background: i < step ? 'var(--amber)' : i === step - 1 ? 'var(--amber)' : 'var(--border-mid)',
                boxShadow: i < step ? '0 0 6px rgba(216,162,94,0.4)' : 'none',
              }}
            />
          ))}
          <span className="text-[10px] font-black ml-1" style={{ color: 'var(--text-ghost)' }}>
            {step}/{QUIZ_QUESTIONS.length}
          </span>
        </div>

        {/* Question */}
        <div className="text-center">
          <div className="text-5xl mb-4">{currentQuestion.emoji}</div>
          <h2 className="text-lg font-black uppercase tracking-wide" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
            {currentQuestion.question}
          </h2>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(opt.archetype, i)}
              disabled={selectedOption !== null}
              className="w-full p-4 rounded-[4px] text-left text-sm font-bold transition-all active:scale-[0.98]"
              style={{
                background: selectedOption === i ? 'var(--amber-dim)' : 'var(--bg-deep)',
                border: selectedOption === i ? '2px solid var(--amber)' : '1px solid var(--border-mid)',
                color: selectedOption === i ? 'var(--amber)' : 'var(--text-secondary)',
                transform: selectedOption === i ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export { ARCHETYPES }
export type { ArchetypeId }
