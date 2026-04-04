import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { ArrowLeft, Receipt, Handshake, Loader2 } from "lucide-react"



interface SimplifiedDebt {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
}

export default function GroupBalances() {
  const { id: groupId } = useParams()
  const navigate = useNavigate()
  const { user } = useChug()

  const [groupName, setGroupName] = useState("")
  const [debts, setDebts] = useState<SimplifiedDebt[]>([])
  const [loading, setLoading] = useState(true)
  const [settlingWith, setSettlingWith] = useState<string | null>(null)

  const fetchBalances = useCallback(async () => {
    if (!groupId || !user) return
    setLoading(true)

    try {
      // 1. Fetch Group Name
      const { data: gData } = await supabase.from("groups").select("name").eq("id", groupId).single()
      if (gData) setGroupName(gData.name)

      // 2. Fetch all members and their usernames to map IDs
      const { data: mData } = await supabase.from("group_members").select("profiles(id, username)").eq("group_id", groupId)
      const usersMap: Record<string, string> = {}
      if (mData) {
        mData.forEach((m: any) => {
          usersMap[m.profiles.id] = m.profiles.username
        })
      }

      // 3. Calculate internal balances
      // Map: userId -> netBalance (positive = they paid, we owe them. negative = they consumed, they owe)
      const balances: Record<string, number> = {}
      Object.keys(usersMap).forEach(id => balances[id] = 0)

      // 3a. Add everything people Paid
      const { data: expenses } = await supabase.from("group_expenses").select("id, payer_id, amount").eq("group_id", groupId)
      if (expenses) {
        expenses.forEach(exp => {
          if (balances[exp.payer_id] !== undefined) {
            balances[exp.payer_id] += Number(exp.amount)
          }
        })
      }

      // 3b. Subtract everything people Owe (their splits)
      if (expenses && expenses.length > 0) {
        const expenseIds = expenses.map(e => e.id)
        const { data: splits } = await supabase.from("expense_splits").select("user_id, amount_owed").in("expense_id", expenseIds)
        if (splits) {
          splits.forEach(split => {
            if (balances[split.user_id] !== undefined) {
              balances[split.user_id] -= Number(split.amount_owed)
            }
          })
        }
      }

      // 3c. Adjust for Settlements (If A paid B, A's balance goes up, B's goes down)
      const { data: settlements } = await supabase.from("expense_settlements").select("payer_id, receiver_id, amount").eq("group_id", groupId)
      if (settlements) {
        settlements.forEach(settle => {
          if (balances[settle.payer_id] !== undefined) balances[settle.payer_id] += Number(settle.amount)
          if (balances[settle.receiver_id] !== undefined) balances[settle.receiver_id] -= Number(settle.amount)
        })
      }

      // 4. Simplify Debts (Greedy approach)
      let debtors = Object.keys(balances).filter(id => balances[id] < -0.01).map(id => ({ id, amount: Math.abs(balances[id]) }))
      let creditors = Object.keys(balances).filter(id => balances[id] > 0.01).map(id => ({ id, amount: balances[id] }))

      // Sort debtors and creditors descending by amount to minimize transactions
      debtors.sort((a, b) => b.amount - a.amount)
      creditors.sort((a, b) => b.amount - a.amount)

      const simplified: SimplifiedDebt[] = []

      let d = 0, c = 0
      while (d < debtors.length && c < creditors.length) {
        const debtor = debtors[d]
        const creditor = creditors[c]

        const amountToSettle = Math.min(debtor.amount, creditor.amount)
        simplified.push({
          fromId: debtor.id,
          fromName: usersMap[debtor.id] || "Unknown",
          toId: creditor.id,
          toName: usersMap[creditor.id] || "Unknown",
          amount: parseFloat(amountToSettle.toFixed(2))
        })

        debtor.amount -= amountToSettle
        creditor.amount -= amountToSettle

        if (debtor.amount < 0.01) d++
        if (creditor.amount < 0.01) c++
      }

      setDebts(simplified)

    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [groupId, user])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  const handleSettleUp = async (receiverId: string, amount: number) => {
    if (!user || !groupId) return
    setSettlingWith(receiverId)
    
    try {
      const { error } = await supabase.from("expense_settlements").insert({
        group_id: groupId,
        payer_id: user.id,
        receiver_id: receiverId,
        amount: amount
      })

      if (error) throw error
      
      // Refresh the balances
      await fetchBalances()
      alert("Settled successfully! You're square.")
    } catch (err: any) {
      alert("Error settling up: " + err.message)
    } finally {
      setSettlingWith(null)
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/group/${groupId}/chat`)} className="p-2 rounded-xl transition-transform active:scale-95" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="page-title truncate flex-1">Balances</h1>
      </div>

      <div className="glass-card">
        <h2 className="text-lg font-black flex items-center gap-2 mb-2" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
          <Receipt strokeWidth={2} style={{ color: 'var(--amber)' }} /> Who Owes Who
        </h2>
        <p className="font-bold text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{groupName}</p>

        {loading ? (
          <div className="text-center font-bold py-10" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin mx-auto mb-2" size={32} />
            Crunching the numbers...
          </div>
        ) : debts.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3" style={{ background: 'var(--acid-dim)', border: '1px solid rgba(204,255,0,0.15)' }}>
              <span className="text-2xl">🤝</span>
            </div>
            <p className="font-black text-xl" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>You are all settled up!</p>
            <p className="font-bold text-sm mt-1" style={{ color: 'var(--text-muted)' }}>No outstanding balances in this group.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {debts.map((debt, index) => {
              const iAmDebtor = debt.fromId === user?.id
              const iAmCreditor = debt.toId === user?.id

              return (
                <div key={index} className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{
                  background: iAmDebtor ? 'var(--coral-dim)' : iAmCreditor ? 'var(--acid-dim)' : 'var(--bg-raised)',
                  border: `1px solid ${iAmDebtor ? 'rgba(255,107,107,0.2)' : iAmCreditor ? 'rgba(204,255,0,0.15)' : 'var(--border)'}`,
                }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                    <p className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>
                        {iAmDebtor ? "You" : debt.fromName}
                      </p>
                      <span className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>owes</span>
                      <p className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>
                        {iAmCreditor ? "You" : debt.toName}
                      </p>
                    </div>
                    <p className="font-black text-2xl" style={{ fontFamily: 'Syne, sans-serif', color: iAmDebtor ? 'var(--coral)' : 'var(--acid)' }}>
                      ${debt.amount.toFixed(2)}
                    </p>
                  </div>

                  {iAmDebtor && (
                    <button 
                      onClick={() => handleSettleUp(debt.toId, debt.amount)}
                      disabled={settlingWith === debt.toId}
                      className="glass-btn-secondary py-2 flex items-center justify-center gap-2 shrink-0" style={{ background: 'var(--acid-dim)', color: 'var(--acid)', borderColor: 'rgba(204,255,0,0.15)' }}
                    >
                      {settlingWith === debt.toId ? <Loader2 size={16} className="animate-spin" /> : <Handshake size={16} strokeWidth={2} />}
                      Settle Up
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
