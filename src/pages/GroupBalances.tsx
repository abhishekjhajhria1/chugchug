import { useState, useEffect } from "react"
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

  const fetchBalances = async () => {
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
  }

  useEffect(() => {
    fetchBalances()
  }, [groupId, user])

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
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/group/${groupId}/chat`)} className="p-2 bg-white rounded-full border-[3px] border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24] text-[#3D2C24] transition-transform active:scale-95">
          <ArrowLeft size={20} strokeWidth={3} />
        </button>
        <h1 className="text-2xl font-black text-[#3D2C24] truncate flex-1">Balances</h1>
      </div>

      <div className="cartoon-card bg-[#FFD166]/20 border-[#FFD166]">
        <h2 className="text-xl font-black text-[#3D2C24] flex items-center gap-2 mb-2">
          <Receipt strokeWidth={3} className="text-[#FFD166]" /> Who owes Who
        </h2>
        <p className="font-bold text-sm text-[#3D2C24]/60 mb-6">{groupName}</p>

        {loading ? (
          <div className="text-center font-bold text-[#3D2C24]/50 py-10">
            <Loader2 className="animate-spin mx-auto mb-2" size={32} />
            Crunching the numbers...
          </div>
        ) : debts.length === 0 ? (
          <div className="bg-white rounded-2xl border-[3px] border-[#3D2C24] p-6 text-center shadow-[4px_4px_0px_#3D2C24]">
            <div className="w-16 h-16 bg-[#A0E8AF] rounded-full mx-auto flex items-center justify-center border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24] mb-3">
              <span className="text-2xl">🤝</span>
            </div>
            <p className="font-black text-xl text-[#3D2C24]">You are all settled up!</p>
            <p className="font-bold text-sm text-[#3D2C24]/60 mt-1">No outstanding balances in this group.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {debts.map((debt, index) => {
              const iAmDebtor = debt.fromId === user?.id
              const iAmCreditor = debt.toId === user?.id
              
              const isMeInvolved = iAmDebtor || iAmCreditor
              const bgColor = iAmDebtor ? "bg-[#FF7B9C]/10 border-[#FF7B9C]" : iAmCreditor ? "bg-[#A0E8AF]/20 border-[#A0E8AF]" : "bg-white border-[#3D2C24]/20"

              return (
                <div key={index} className={`rounded-xl border-[3px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${bgColor} ${isMeInvolved ? 'shadow-[4px_4px_0px_#3D2C24] border-[#3D2C24]' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-black text-lg text-[#3D2C24]">
                        {iAmDebtor ? "You" : debt.fromName}
                      </p>
                      <span className="font-bold text-xs text-[#3D2C24]/50 uppercase tracking-widest">owes</span>
                      <p className="font-black text-lg text-[#3D2C24]">
                        {iAmCreditor ? "You" : debt.toName}
                      </p>
                    </div>
                    <p className={`font-black text-2xl ${iAmDebtor ? 'text-[#FF7B9C]' : 'text-[#60D394]'}`}>
                      ${debt.amount.toFixed(2)}
                    </p>
                  </div>

                  {iAmDebtor && (
                    <button 
                      onClick={() => handleSettleUp(debt.toId, debt.amount)}
                      disabled={settlingWith === debt.toId}
                      className="cartoon-btn-secondary py-2! bg-[#60D394] text-white border-[#3D2C24] flex items-center justify-center gap-2 shrink-0"
                    >
                      {settlingWith === debt.toId ? <Loader2 size={16} className="animate-spin" /> : <Handshake size={16} strokeWidth={3} />}
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
