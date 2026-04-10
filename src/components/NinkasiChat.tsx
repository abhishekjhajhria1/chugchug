import { useState, useRef, useEffect } from "react"
import { Send, ArrowLeft, Wine, Sparkles } from "lucide-react"

interface Message {
  role: 'user' | 'ninkasi'
  content: string
  recipes?: string[]
}

export default function NinkasiChat({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ninkasi', content: "Welcome to the tavern, Warrior! I am Ninkasi, Mistress of Beer. What can I get you?" }
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const BARTENDER_API = import.meta.env.VITE_BARTENDER_API?.trim() || 'http://127.0.0.1:8001'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return
    
    const userMessage: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch(`${BARTENDER_API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage.content })
      })

      if (!res.ok) throw new Error("API failed")
      
      const data = await res.json()
      setMessages(prev => [...prev, { 
        role: 'ninkasi', 
        content: data.response || data.reply || "My apologies, my mind wandered off to the vineyards.",
        recipes: data.referenced_recipes || data.recipes_referenced 
      }])
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { 
        role: 'ninkasi', 
        content: "Oof, the bar is a bit loud right now. Let me pour another glass and try again later." 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[65vh] rounded-[4px] overflow-hidden wano-fade p-0" style={{ border: '1px solid var(--border)', background: 'var(--bg-deep)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)', background: 'linear-gradient(to right, rgba(209,32,32,0.05), transparent)' }}>
        <button onClick={onBack} className="p-2 -ml-2 rounded-[2px] transition-colors active:scale-95" style={{ color: 'var(--text-muted)', background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="w-10 h-10 rounded-[2px] flex items-center justify-center shadow-lg" style={{ background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid rgba(209,32,32,0.3)' }}>
          <Wine size={20} />
        </div>
        <div>
          <h3 className="font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Mistress Ninkasi</h3>
          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--coral)' }}>AI Supervisor & Bartender</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none flex flex-col" style={{ background: 'var(--bg-deep)' }}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-[2px] px-4 py-3 text-sm font-medium leading-relaxed`}
              style={{
                background: msg.role === 'user' ? 'var(--amber-dim)' : 'var(--bg-raised)',
                color: msg.role === 'user' ? 'var(--amber)' : 'var(--text-primary)',
                border: msg.role === 'user' ? '1px solid rgba(245,166,35,0.2)' : '1px solid var(--border)'
              }}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.recipes && msg.recipes.length > 0 && (
                <div className="mt-3 pt-3 flex flex-wrap gap-2" style={{ borderTop: '1px dashed var(--border)' }}>
                  {msg.recipes.map((r, i) => (
                    <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-[2px] flex items-center gap-1" style={{ background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid rgba(209,32,32,0.3)' }}>
                      <Sparkles size={10} /> {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-[2px] px-4 py-3" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <div className="flex gap-1.5 items-center h-5">
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--coral)' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--coral)', animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--coral)', animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3" style={{ background: 'var(--bg-raised)', borderTop: '1px solid var(--border)' }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Speak with Ninkasi..."
            className="flex-1 px-4 py-3 bg-transparent text-sm"
            style={{ borderRadius: '2px', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()} className="w-12 h-12 rounded-[2px] flex items-center justify-center transition-transform active:scale-90 disabled:opacity-50" style={{ background: 'var(--coral)', color: 'white', fontWeight: '900' }}>
            <Send size={18} className="translate-x-0.5" />
          </button>
        </form>
      </div>
    </div>
  )
}
