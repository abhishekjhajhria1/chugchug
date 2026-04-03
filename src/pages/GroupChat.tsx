import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Send, Loader2, X, Image as ImageIcon, Receipt } from "lucide-react"
import { useChug } from "../context/ChugContext"
import { supabase } from "../lib/supabase"
import { firebaseDb } from "../lib/firebase"
import { ref, push, onChildAdded, query, orderByChild, limitToLast, off, serverTimestamp } from "firebase/database"

interface ChatMessage {
  id: string
  userId: string
  username: string
  content: string
  imageUrl?: string
  type?: 'text' | 'expense'
  expenseId?: string
  expenseAmount?: number
  expenseDescription?: string
  timestamp: number
}

export default function GroupChat() {
  const { id: groupId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useChug()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [groupName, setGroupName] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Expense Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState("")
  const [expenseDesc, setExpenseDesc] = useState("")
  const [submittingExpense, setSubmittingExpense] = useState(false)
  const [groupMembers, setGroupMembers] = useState<{id: string, username: string}[]>([])
  const [selectedSplits, setSelectedSplits] = useState<Set<string>>(new Set())

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    if (!groupId) return

    const fetchGroupData = async () => {
      const { data } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single()
      if (data) setGroupName(data.name)

      // Fetch members for expense splitting
      const { data: members } = await supabase
        .from("group_members")
        .select("profiles(id, username)")
        .eq("group_id", groupId)
      
      if (members) {
        const parsed = members.map((m: any) => m.profiles)
        setGroupMembers(parsed)
        // Default select everyone
        setSelectedSplits(new Set(parsed.map(m => m.id)))
      }
    }
    fetchGroupData()
  }, [groupId])

  useEffect(() => {
    if (!groupId) return

    const messagesRef = ref(firebaseDb, `chats/${groupId}/messages`)
    const messagesQuery = query(messagesRef, orderByChild("timestamp"), limitToLast(100))

    setLoading(true)
    let initialLoad = true

    const handleNewMessage = (snapshot: any) => {
      const data = snapshot.val()
      if (!data) return

      const msg: ChatMessage = {
        id: snapshot.key!,
        userId: data.userId,
        username: data.username,
        content: data.content || "",
        imageUrl: data.imageUrl,
        type: data.type || 'text',
        expenseId: data.expenseId,
        expenseAmount: data.expenseAmount,
        expenseDescription: data.expenseDescription,
        timestamp: data.timestamp || Date.now(),
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp)
      })

      if (initialLoad) {
        initialLoad = false
        setLoading(false)
      }

      setTimeout(scrollToBottom, 100)
    }

    onChildAdded(messagesQuery, handleNewMessage)

    const loadingTimeout = setTimeout(() => setLoading(false), 2000)

    return () => {
      off(messagesRef)
      clearTimeout(loadingTimeout)
    }
  }, [groupId, scrollToBottom])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (selected.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB")
      return
    }
    if (!selected.type.startsWith("image/")) {
      alert("Only images allowed")
      return
    }

    setImageFile(selected)
    setImagePreview(URL.createObjectURL(selected))
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !groupId || !user) return null

    setUploadingImage(true)
    try {
      const ext = imageFile.name.split(".").pop()
      const fileName = `${user.id}/chat_${groupId}_${Date.now()}.${ext}`

      const { error } = await supabase.storage
        .from("photos")
        .upload(fileName, imageFile, { upsert: false })

      if (error) throw error

      const { data } = supabase.storage.from("photos").getPublicUrl(fileName)
      return data.publicUrl
    } catch (err: any) {
      alert("Image upload failed: " + err.message)
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const submitExpense = async () => {
    if (!expenseAmount || !expenseDesc || !groupId || !user || !profile || selectedSplits.size === 0) return
    
    setSubmittingExpense(true)
    const amountNum = parseFloat(expenseAmount)
    
    try {
      // 1. Insert Master Expense
      const { data: expenseData, error: expenseError } = await supabase
        .from("group_expenses")
        .insert({
          group_id: groupId,
          payer_id: user.id,
          amount: amountNum,
          description: expenseDesc
        })
        .select("id")
        .single()

      if (expenseError) throw expenseError

      // 2. Insert Splits (Split evenly among selected)
      const splitAmount = parseFloat((amountNum / selectedSplits.size).toFixed(2))
      const splitInserts = Array.from(selectedSplits).map(memberId => ({
        expense_id: expenseData.id,
        user_id: memberId,
        amount_owed: splitAmount,
        is_settled: memberId === user.id // Payer is already settled with themselves
      }))

      const { error: splitError } = await supabase.from("expense_splits").insert(splitInserts)
      if (splitError) throw splitError

      // 3. Broadcast to Chat
      const messagesRef = ref(firebaseDb, `chats/${groupId}/messages`)
      await push(messagesRef, {
        userId: user.id,
        username: profile.username,
        type: 'expense',
        expenseId: expenseData.id,
        expenseAmount: amountNum,
        expenseDescription: expenseDesc,
        timestamp: serverTimestamp(),
      })

      setShowExpenseModal(false)
      setExpenseAmount("")
      setExpenseDesc("")
    } catch (err: any) {
      alert("Failed to log expense: " + err.message)
    } finally {
      setSubmittingExpense(false)
    }
  }

  const sendMessage = async () => {
    if ((!newMessage.trim() && !imageFile) || !groupId || !user || !profile) return

    setSending(true)

    try {
      let imageUrl: string | undefined
      if (imageFile) {
        const url = await uploadImage()
        if (url) imageUrl = url
        clearImage()
      }

      const messagesRef = ref(firebaseDb, `chats/${groupId}/messages`)
      await push(messagesRef, {
        userId: user.id,
        username: profile.username,
        content: newMessage.trim(),
        imageUrl: imageUrl || null,
        type: 'text',
        timestamp: serverTimestamp(),
      })

      setNewMessage("")
      inputRef.current?.focus()
    } catch (err: any) {
      alert("Failed to send message: " + (err?.message || "Unknown error"))
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (ts: number) => {
    if (!ts) return ""
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()

    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="p-2 rounded-xl transition-transform active:scale-95"
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black truncate" style={{ fontFamily: 'Nunito, sans-serif', color: 'var(--text-primary)' }}>{groupName || "Chat"}</h1>
          <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Group Chat</p>
        </div>
        <div className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1" style={{ background: 'var(--coral-dim)', border: '1px solid rgba(244,132,95,0.25)', color: 'var(--coral)' }}>
          💬 Live
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 pb-4 scrollbar-none">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full opacity-50">
            <Loader2 className="animate-spin mb-3 neon-amber" size={32} />
            <p className="font-bold text-white/90">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-50 text-center">
            <div className="w-20 h-20 bg-amber-400/30/30 rounded-full border border-white/15 flex items-center justify-center mb-4">
              <span className="text-3xl">💬</span>
            </div>
            <p className="font-black text-white/90 text-lg">No messages yet!</p>
            <p className="font-bold text-sm text-white/90/60 mt-1">Be the first to say something 🎉</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.userId === user?.id
            const showAvatar = idx === 0 || messages[idx - 1]?.userId !== msg.userId

            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${showAvatar ? "mt-3" : "mt-1"}`}>
                <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                  {showAvatar && !isMe && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/90/50 mb-1 ml-3">
                      {msg.username}
                    </p>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 border border-white/15 shadow-lg shadow-black/20 ${
                      isMe
                        ? "bg-amber-400/30 text-white/90 rounded-br-sm"
                        : "bg-white/5 text-white/90 rounded-bl-sm"
                    }`}
                  >
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="Shared"
                        className="w-full max-h-48 object-cover rounded-lg border border-white/15 mb-2 cursor-pointer"
                        onClick={() => window.open(msg.imageUrl, "_blank")}
                      />
                    )}
                    
                    {msg.type === 'expense' ? (
                      <div className="bg-white/90 rounded-xl p-3 border border-white/15">
                        <div className="flex items-center gap-2 mb-1">
                          <Receipt size={16} className="neon-lime" strokeWidth={2} />
                          <span className="font-black text-sm text-white/90">Paid ${msg.expenseAmount}</span>
                        </div>
                        <p className="font-bold text-sm text-white/90/80 leading-snug">{msg.expenseDescription}</p>
                        {!isMe && (
                          <button 
                            onClick={() => navigate(`/group/${groupId}/balances`)}
                            className="mt-2 w-full text-[10px] font-black uppercase bg-green-400/30 text-white py-1 rounded-lg border border-white/15 active:scale-95 transition-transform hover:-translate-y-0.5 shadow-lg shadow-black/20"
                          >
                            View Balances
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="font-bold text-sm leading-snug wrap-break-word">{msg.content}</p>
                    )}
                  </div>
                  <p className={`text-[10px] font-bold opacity-40 mt-1 ${isMe ? "mr-2 text-right" : "ml-3"}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="shrink-0 px-2 pb-2">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Attach" className="h-20 rounded-xl border border-white/15 object-cover" />
            <button
              onClick={clearImage}
              className="absolute -top-2 -right-2 p-1 bg-white/5 rounded-full border border-white/15 shadow-lg shadow-black/20"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="shrink-0 flex items-center gap-2 pt-3 border-t-2 border-white/15/10">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 bg-green-300/20 rounded-full border border-white/15 shadow-lg shadow-black/20 text-white/90 shrink-0 transition-transform active:scale-95 hover:scale-105"
        >
          {uploadingImage ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} strokeWidth={2} />}
        </button>

        <button
          onClick={() => setShowExpenseModal(true)}
          className="p-2.5 bg-green-400/30 rounded-full border border-white/15 shadow-lg shadow-black/20 text-white/90 shrink-0 transition-transform active:scale-95 hover:scale-105"
          title="Log Expense"
        >
          <Receipt size={18} strokeWidth={2} />
        </button>

        <input
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 glass-input py-2.5!"
          maxLength={1000}
          disabled={sending}
        />

        <button
          onClick={sendMessage}
          disabled={(!newMessage.trim() && !imageFile) || sending}
          className="p-2.5 bg-amber-400/30 rounded-full border border-white/15 shadow-lg shadow-black/20 text-white/90 shrink-0 transition-transform active:scale-95 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={2} />}
        </button>
      </div>

      {/* EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-100 bg-black/60 flex items-center justify-center p-4 animate-fadeInScale" onClick={() => setShowExpenseModal(false)}>
          <div className="bg-white/5 rounded-3xl border border-white/15 shadow-lg shadow-black/20 p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-black text-xl text-white/90 flex items-center gap-2"><Receipt className="neon-lime" /> Add Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-white/90/50 hover:text-white/90">
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-xs text-white/90 uppercase tracking-widest mb-1 block">Total Amount ($)</label>
                <input type="number" min="0" step="0.01" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="0.00" className="glass-input w-full text-xl font-black neon-lime" />
              </div>

              <div>
                <label className="font-bold text-xs text-white/90 uppercase tracking-widest mb-1 block">Description</label>
                <input type="text" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="Uber, Drinks, Pizza..." className="glass-input w-full" maxLength={100} />
              </div>

              <div>
                <label className="font-bold text-xs text-white/90 uppercase tracking-widest mb-2 block">Split With (Equally)</label>
                <div className="max-h-40 overflow-y-auto space-y-2 border border-white/15/10 rounded-xl p-2 bg-white/3">
                  {groupMembers.map(member => (
                    <label key={member.id} className="flex items-center gap-3 cursor-pointer p-1">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-[#60D394]"
                        checked={selectedSplits.has(member.id)}
                        onChange={(e) => {
                          const newSplits = new Set(selectedSplits)
                          if (e.target.checked) newSplits.add(member.id)
                          else newSplits.delete(member.id)
                          setSelectedSplits(newSplits)
                        }}
                      />
                      <span className="font-bold text-sm text-white/90">{member.id === user?.id ? "You" : member.username}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button 
                onClick={submitExpense}
                disabled={submittingExpense || !expenseAmount || !expenseDesc || selectedSplits.size === 0}
                className="glass-btn w-full bg-green-400/30! flex items-center justify-center gap-2 mt-2"
              >
                {submittingExpense ? <Loader2 className="animate-spin" size={20} /> : <Receipt size={20} />}
                Split It Let's Go
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
