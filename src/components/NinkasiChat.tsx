import { useState, useRef, useEffect, useCallback } from "react"
import { Send, ArrowLeft, Wine, Sparkles, ChevronRight } from "lucide-react"

interface Message {
  role: 'user' | 'ninkasi'
  content: string
  recipes?: string[]
  timestamp?: Date
}

const QUICK_SUGGESTIONS = [
  { label: '🍺 Beer recs', prompt: 'What beer should I try tonight?' },
  { label: '🍸 Cocktail ideas', prompt: 'Give me a cocktail idea for a party' },
  { label: '🍷 Wine pairing', prompt: 'What wine pairs with pasta?' },
  { label: '💧 Pace myself', prompt: 'How do I pace my drinking at a party?' },
  { label: '🍹 Easy cocktail', prompt: 'What\'s a cocktail I can make with basic ingredients?' },
  { label: '🥃 Whiskey guide', prompt: 'Guide me through different types of whiskey' },
]

const WELCOME_MESSAGES = [
  "Welcome to the tavern, Warrior! 🍷 I am Ninkasi, goddess of beer and your personal bartender. Ask me anything — drinks, recipes, pairings, or just stories from the bar.",
  "Step right up! 🍺 Ninkasi here — your AI bartender, mixologist, and drinking companion. What's your poison tonight?",
  "Ah, a thirsty soul enters! 🏯 I'm Ninkasi, and I know every drink in the realm. What shall we explore today?",
]

export default function NinkasiChat({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ninkasi', content: WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)], timestamp: new Date() }
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const BARTENDER_API = import.meta.env.VITE_BARTENDER_API?.trim() || import.meta.env.VITE_NINKASI_API_URL?.trim() || 'http://127.0.0.1:8001'

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  const handleSend = async (messageText?: string) => {
    const text = (messageText || input).trim()
    if (!text) return

    const userMessage: Message = { role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setShowSuggestions(false)

    try {
      const res = await fetch(`${BARTENDER_API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          mode: 'chat',
          user_context: {
            conversation_history: messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Ninkasi'}: ${m.content}`).join('\n')
          }
        })
      })

      if (!res.ok) throw new Error("API failed")

      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'ninkasi',
        content: data.response || data.reply || "My apologies, my mind wandered off to the vineyards. 🍇",
        recipes: data.referenced_recipes || data.recipes_referenced,
        timestamp: new Date(),
      }])
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, {
        role: 'ninkasi',
        content: "Hmm, the bar seems a bit loud right now. 🔊 Let me pour another glass and try again. Check your connection!",
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const formatTime = (d?: Date) => d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className="flex flex-col h-[68vh] overflow-hidden" style={{ border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', background: 'var(--bg-deep)' }}>
      {/* Header — premium bartender aesthetic */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 shrink-0"
        style={{
          background: 'linear-gradient(135deg, rgba(200,80,192,0.08), color-mix(in srgb, var(--coral) 6%, transparent), transparent)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button onClick={onBack} className="p-2 -ml-1 active:scale-90 transition-transform" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="relative">
          <div className="w-11 h-11 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(200,80,192,0.2), color-mix(in srgb, var(--coral) 15%, transparent))', border: '2px solid rgba(200,80,192,0.4)', borderRadius: 'var(--card-radius)' }}>
            <Wine size={22} style={{ color: '#c850c0' }} />
          </div>
          {/* Online indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-deep)', border: '2px solid var(--bg-deep)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--acid)' }} />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Mistress Ninkasi</h3>
          <p className="text-[9px] uppercase tracking-[0.15em] font-bold" style={{ color: '#c850c0' }}>AI Bartender · Online</p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1" style={{ background: 'rgba(200,80,192,0.1)', borderRadius: 'var(--card-radius)' }}>
          <Sparkles size={10} style={{ color: '#c850c0' }} />
          <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: '#c850c0' }}>AI</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-none flex flex-col">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} anim-enter`}>
            {msg.role === 'ninkasi' && (
              <div className="w-7 h-7 shrink-0 mr-2 mt-1 flex items-center justify-center text-sm" style={{ background: 'rgba(200,80,192,0.15)', borderRadius: 'var(--card-radius)' }}>
                🍷
              </div>
            )}
            <div className="max-w-[80%]">
              <div
                className="px-4 py-3 text-[13px] font-medium leading-[1.6]"
                style={{
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, var(--amber-dim), color-mix(in srgb, var(--amber) 8%, transparent))'
                    : 'var(--bg-raised)',
                  color: msg.role === 'user' ? 'var(--amber)' : 'var(--text-primary)',
                  border: msg.role === 'user'
                    ? '1px solid color-mix(in srgb, var(--amber) 25%, transparent)'
                    : '1px solid var(--border)',
                  borderRadius: msg.role === 'user'
                    ? 'var(--card-radius) var(--card-radius) 2px var(--card-radius)'
                    : 'var(--card-radius) var(--card-radius) var(--card-radius) 2px',
                }}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {/* Referenced recipes */}
                {msg.recipes && msg.recipes.length > 0 && (
                  <div className="mt-3 pt-3 flex flex-wrap gap-1.5" style={{ borderTop: '1px dashed var(--border)' }}>
                    {msg.recipes.map((r, i) => (
                      <span key={i} className="text-[9px] font-bold px-2 py-1 flex items-center gap-1" style={{ background: 'rgba(200,80,192,0.1)', color: '#c850c0', border: '1px solid rgba(200,80,192,0.2)', borderRadius: '10px' }}>
                        <Sparkles size={8} /> {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Timestamp */}
              <p className={`text-[8px] font-bold mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-ghost)' }}>
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start anim-enter">
            <div className="w-7 h-7 shrink-0 mr-2 mt-1 flex items-center justify-center text-sm" style={{ background: 'rgba(200,80,192,0.15)', borderRadius: 'var(--card-radius)' }}>
              🍷
            </div>
            <div className="px-4 py-3" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius) var(--card-radius) var(--card-radius) 2px' }}>
              <div className="flex gap-1.5 items-center h-5">
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#c850c0' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#c850c0', animationDelay: '0.15s' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#c850c0', animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestion chips */}
      {showSuggestions && messages.length <= 1 && (
        <div className="px-4 pb-2 shrink-0">
          <p className="text-[8px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-ghost)' }}>Try asking...</p>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {QUICK_SUGGESTIONS.map(s => (
              <button
                key={s.label}
                onClick={() => handleSend(s.prompt)}
                className="shrink-0 px-3 py-2 text-[10px] font-bold whitespace-nowrap active:scale-95 transition-all flex items-center gap-1"
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--card-radius)',
                }}
              >
                {s.label} <ChevronRight size={10} style={{ color: 'var(--text-ghost)' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2.5 shrink-0" style={{ background: 'var(--bg-raised)', borderTop: '1px solid var(--border)' }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Ninkasi anything..."
            className="flex-1 px-4 py-3 bg-transparent text-[13px] font-medium"
            style={{ borderRadius: 'var(--card-radius)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-11 h-11 flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
            style={{
              background: input.trim() ? 'linear-gradient(135deg, #c850c0, #9B59B6)' : 'var(--bg-surface)',
              color: input.trim() ? '#fff' : 'var(--text-ghost)',
              borderRadius: 'var(--card-radius)',
              border: input.trim() ? 'none' : '1px solid var(--border)',
            }}
          >
            <Send size={16} className="translate-x-0.5" />
          </button>
        </form>
      </div>
    </div>
  )
}
