import { useState } from "react"
import { useChug } from "../context/ChugContext"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Crown, Sparkles, Star, Shield, Palette, Gift, Zap, Check } from "lucide-react"
import { useToast } from "../components/Toast"

// ─── Env placeholders for payment ──────────────────────────────
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY || ""
const JUSPAY_KEY = import.meta.env.VITE_JUSPAY_KEY || ""
// const CRYPTO_WALLET = import.meta.env.VITE_CRYPTO_WALLET || ""

const PREMIUM_PERKS = [
  { icon: Star,     label: 'Priority Bar Suggestions',  desc: 'See partner bar menus & exclusive deals first', emoji: '⭐' },
  { icon: Sparkles, label: 'Unlimited Share Cards',     desc: 'Create unlimited Strava-style session cards',  emoji: '📸' },
  { icon: Palette,  label: 'Exclusive Themes',          desc: '2 premium-only themes + early access to new ones', emoji: '🎨' },
  { icon: Gift,     label: '2x Loyalty Points',         desc: 'Earn double points at partner bars',            emoji: '🎁' },
  { icon: Shield,   label: 'Priority Support',          desc: 'Direct chat with ChugChug team',                emoji: '🛡️' },
  { icon: Crown,    label: 'Premium Badge',             desc: 'Golden crown next to your username',            emoji: '👑' },
]

const PLANS = [
  { id: 'monthly', label: 'Monthly', price: '₹199', period: '/month', savings: '', popular: false },
  { id: 'yearly',  label: 'Yearly',  price: '₹1499', period: '/year',  savings: 'Save 37%', popular: true },
  { id: 'lifetime',label: 'Lifetime',price: '₹4999', period: 'one-time',savings: 'Best Value', popular: false },
]

export default function Premium() {
  const { profile } = useChug()
  const navigate = useNavigate()
  const toast = useToast()
  const [selectedPlan, setSelectedPlan] = useState('yearly')
  const [processing, setProcessing] = useState(false)

  const isPremium = profile?.is_premium

  const handleSubscribe = async () => {
    setProcessing(true)
    if (RAZORPAY_KEY) {
      // TODO: Initialize Razorpay checkout
      // const rzp = new (window as any).Razorpay({ key: RAZORPAY_KEY, amount, ... })
      toast.info("Razorpay integration will be activated with your API key")
    } else if (JUSPAY_KEY) {
      // TODO: Initialize JusPay checkout
      toast.info("JusPay integration will be activated with your API key")
    } else {
      toast.info("Payment integration coming soon — configure VITE_RAZORPAY_KEY or VITE_JUSPAY_KEY in .env")
    }
    setProcessing(false)
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 active:scale-90 transition-transform" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title">👑 Premium</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {isPremium ? 'You are a Premium member' : 'Unlock the full ChugChug experience'}
          </p>
        </div>
      </div>

      {isPremium ? (
        /* Already premium */
        <div className="p-6 text-center" style={{ background: 'linear-gradient(135deg, var(--amber-dim), color-mix(in srgb, var(--amber) 5%, transparent))', border: '2px solid var(--amber)', borderRadius: 'var(--card-radius)' }}>
          <Crown size={48} className="mx-auto mb-3" style={{ color: 'var(--amber)' }} />
          <p className="text-lg font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>You're Premium!</p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>All perks are active. Thank you for supporting ChugChug.</p>
        </div>
      ) : (
        <>
          {/* Hero */}
          <div
            className="p-6 text-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(232,196,74,0.15), color-mix(in srgb, var(--amber) 5%, transparent))',
              border: '1px solid rgba(232,196,74,0.3)',
              borderRadius: 'var(--card-radius)',
            }}
          >
            <div className="absolute top-2 right-3 text-4xl opacity-20">👑</div>
            <Crown size={40} className="mx-auto mb-2" style={{ color: 'var(--amber)' }} />
            <h2 className="text-xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
              Go Premium
            </h2>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Exclusive perks, unlimited features, premium recognition
            </p>
          </div>

          {/* Perks */}
          <div className="space-y-2">
            {PREMIUM_PERKS.map(perk => (
              <div
                key={perk.label}
                className="flex items-start gap-3 p-4"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)' }}
              >
                <span className="text-xl mt-0.5">{perk.emoji}</span>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{perk.label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{perk.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Plans */}
          <div className="space-y-2">
            <p className="section-label border-l-2 pl-2" style={{ borderColor: 'var(--amber)' }}>Choose Plan</p>
            {PLANS.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className="w-full flex items-center justify-between p-4 transition-all active:scale-[0.98]"
                style={{
                  background: selectedPlan === plan.id ? 'var(--amber-dim)' : 'var(--card-bg)',
                  border: selectedPlan === plan.id ? '2px solid var(--amber)' : '1px solid var(--border)',
                  borderRadius: 'var(--card-radius)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      border: selectedPlan === plan.id ? '2px solid var(--amber)' : '2px solid var(--border-mid)',
                      background: selectedPlan === plan.id ? 'var(--amber)' : 'transparent',
                    }}
                  >
                    {selectedPlan === plan.id && <Check size={12} style={{ color: '#000' }} />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{plan.label}</p>
                    {plan.savings && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 mt-0.5 inline-block" style={{ background: 'var(--acid-dim)', color: 'var(--acid)', borderRadius: '2px' }}>
                        {plan.savings}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black" style={{ fontFamily: 'Syne, sans-serif', color: selectedPlan === plan.id ? 'var(--amber)' : 'var(--text-primary)' }}>
                    {plan.price}
                  </span>
                  <span className="text-[10px] ml-0.5" style={{ color: 'var(--text-muted)' }}>{plan.period}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Subscribe button */}
          <button
            onClick={handleSubscribe}
            disabled={processing}
            className="glass-btn w-full flex items-center justify-center gap-2"
          >
            <Zap size={18} />
            {processing ? 'Processing...' : 'Subscribe Now'}
          </button>

          <p className="text-[9px] text-center" style={{ color: 'var(--text-ghost)' }}>
            Cancel anytime. Crypto payments coming soon.
          </p>
        </>
      )}
    </div>
  )
}
