import { useState, useRef, useEffect, useCallback } from "react"
import { Send, ArrowLeft, Sparkles } from "lucide-react"
import { useChug } from "../context/ChugContext"

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
  { label: '💧 Pace myself', prompt: 'How do I pace my drinking tonight?' },
  { label: '🍹 Easy cocktail', prompt: "A cocktail I can make with basic ingredients?" },
  { label: '🥃 Whiskey 101', prompt: 'Walk me through types of whiskey' },
]

const WELCOME = "Hey, welcome in 🍷 I'm Ninkasi — your bartender, mixologist and drinking buddy. Ask me for a recipe, a pairing, what to drink tonight, or just vent about your day."

export default function NinkasiChat({ onBack }: { onBack: () => void }) {
  const { profile } = useChug()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ninkasi', content: WELCOME, timestamp: new Date() },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const BARTENDER_API = import.meta.env.VITE_BARTENDER_API?.trim() || import.meta.env.VITE_NINKASI_API_URL?.trim() || 'http://127.0.0.1:8001'

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])
  useEffect(() => { scrollToBottom() }, [messages, isLoading, scrollToBottom])

  const handleSend = async (messageText?: string) => {
    const text = (messageText || input).trim()
    if (!text || isLoading) return

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date() }])
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch(`${BARTENDER_API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          mode: 'chat',
          user_context: {
            history,                       // real multi-turn context window
            username: profile?.username ?? null,
            level: profile?.level ?? null,
            city: profile?.city ?? null,
            country: profile?.country ?? null,
          },
        }),
      })
      if (!res.ok) throw new Error("API failed")
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'ninkasi',
        content: data.response || data.reply || "My mind wandered to the vineyards 🍇 — say that again?",
        recipes: data.referenced_recipes || data.recipes_referenced,
        timestamp: new Date(),
      }])
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, {
        role: 'ninkasi',
        content: "The bar's a bit loud right now 🔊 — couldn't reach me. Check your connection and try again.",
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const formatTime = (d?: Date) => d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  const showSuggestions = messages.length <= 1

  return (
    <div className="flex flex-col h-full min-h-[70vh]" style={{ background: 'var(--bg-deep)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-overlay)' }}>
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition-transform" style={{ background: 'var(--glass-fill-inset)', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="relative">
          <div className="w-11 h-11 flex items-center justify-center rounded-full text-xl" style={{ background: 'var(--amber-dim)' }}>🍸</div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center" style={{ background: 'var(--bg-deep)', borderColor: 'var(--bg-deep)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--acid)' }} />
          </span>
        </div>
        <div className="flex-1">
          <h3 className="text-base font-extrabold flex items-center gap-1.5" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
            Ninkasi <Sparkles size={13} style={{ color: 'var(--amber)' }} />
          </h3>
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>AI bartender · online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-none">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user'
          return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} anim-enter`}>
              {!isUser && <div className="w-8 h-8 shrink-0 mr-2 flex items-center justify-center text-base rounded-full" style={{ background: 'var(--amber-dim)' }}>🍸</div>}
              <div className="max-w-[82%]">
                <div
                  className="px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: isUser ? 'var(--btn-bg)' : 'var(--bg-surface)',
                    color: isUser ? 'var(--btn-color)' : 'var(--text-primary)',
                    border: isUser ? 'none' : '1px solid var(--border)',
                    borderRadius: isUser ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.recipes && msg.recipes.length > 0 && (
                    <div className="mt-3 pt-3 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                      {msg.recipes.map((r, i) => (
                        <span key={i} className="text-[11px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                          <Sparkles size={9} /> {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p className={`text-[10px] font-medium mt-1 ${isUser ? 'text-right mr-1' : 'ml-1'}`} style={{ color: 'var(--text-ghost)' }}>{formatTime(msg.timestamp)}</p>
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex justify-start anim-enter">
            <div className="w-8 h-8 shrink-0 mr-2 flex items-center justify-center text-base rounded-full" style={{ background: 'var(--amber-dim)' }}>🍸</div>
            <div className="px-4 py-3.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '18px 18px 18px 6px' }}>
              <div className="flex gap-1.5 items-center h-3">
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--amber)' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--amber)', animationDelay: '0.15s' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--amber)', animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {showSuggestions && (
        <div className="px-4 pb-3 shrink-0">
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Try asking…</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {QUICK_SUGGESTIONS.map(s => (
              <button
                key={s.label}
                onClick={() => handleSend(s.prompt)}
                className="shrink-0 px-3.5 py-2 text-xs font-semibold whitespace-nowrap active:scale-95 transition-transform rounded-full"
                style={{ background: 'var(--glass-fill-inset)', color: 'var(--text-secondary)' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 shrink-0 safe-bottom" style={{ background: 'var(--bg-overlay)', borderTop: '1px solid var(--border)' }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Ninkasi anything…"
            className="glass-input flex-1"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl transition-all active:scale-90 disabled:opacity-30"
            style={{ background: 'var(--btn-bg)', color: 'var(--btn-color)' }}
          >
            <Send size={17} />
          </button>
        </form>
      </div>
    </div>
  )
}
