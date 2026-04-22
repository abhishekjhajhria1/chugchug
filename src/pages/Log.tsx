import { useState, useRef, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { evaluateAndAwardBadges, updateStreak, updateCrewStreaks, getDailyBounties, checkDailyBountyCompletion } from "../lib/progression"
import { Camera, ChevronDown } from "lucide-react"
import { extractPhotoMetadata } from "../components/PhotoMetadata"

type ActivityCategory = 'drink' | 'cigarette' | 'snack' | 'gym' | 'detox' | 'water'

const CATEGORIES: { id: ActivityCategory; label: string; icon: string; color: string; bg: string }[] = [
  { id: 'drink',     label: 'Drink',  icon: '🍻', color: 'var(--amber)', bg: 'var(--amber-dim)' },
  { id: 'water',     label: 'Water',  icon: '💧', color: 'var(--blue)',  bg: 'var(--indigo-dim)' },
  { id: 'snack',     label: 'Snack',  icon: '🍟', color: 'var(--coral)', bg: 'var(--coral-dim)' },
  { id: 'cigarette', label: 'Smoke',  icon: '🚬', color: 'var(--sage)',  bg: 'var(--sage-dim)'  },
  { id: 'gym',       label: 'Gym',    icon: '💪', color: 'var(--indigo)', bg: 'var(--indigo-dim)' },
  { id: 'detox',     label: 'Detox',  icon: '🧘', color: 'var(--sage)',  bg: 'var(--sage-dim)'  },
]

const MOOD_TAGS = [
  { emoji: '😄', label: 'Social' },
  { emoji: '😌', label: 'Chill' },
  { emoji: '😤', label: 'Stress' },
  { emoji: '🎉', label: 'Party' },
  { emoji: '😴', label: 'Tired' },
]

export default function Log() {
  const { user, refreshProfile } = useChug()
  const BARTENDER_API = import.meta.env.VITE_BARTENDER_API?.trim() || ''

  const [category, setCategory] = useState<ActivityCategory>('drink')
  const [itemName, setItemName] = useState("")
  const [quantity, setQuantity] = useState<number>(1)
  const [privacy, setPrivacy] = useState<'public' | 'groups' | 'private' | 'hidden'>('public')

  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string>('')

  const [isRecipe, setIsRecipe] = useState(false)
  const [consumedMyself, setConsumedMyself] = useState(true)
  const [recipeDetails, setRecipeDetails] = useState("")
  const [detoxNotes, setDetoxNotes] = useState("")
  const [moodTag, setMoodTag] = useState<string | null>(null)
  const [streakResult, setStreakResult] = useState<{ currentStreak: number; isNewDay: boolean } | null>(null)
  const [completedBounties, setCompletedBounties] = useState<string[]>([])

  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoMetadata, setPhotoMetadata] = useState<Record<string, any> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchGroups = async () => {
      if (!user) return
      const { data } = await supabase.from("group_members").select(`groups (id, name)`).eq("user_id", user.id)
      if (data) {
        const gList = data.map(m => Array.isArray(m.groups) ? m.groups[0] : m.groups) as any as { id: string; name: string }[]
        setGroups(gList)
        if (gList.length > 0) setSelectedGroup(gList[0].id)
      }
    }
    fetchGroups()
  }, [user])

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
      const meta = await extractPhotoMetadata(file)
      setPhotoMetadata(meta)
    }
  }

  const handleSubmit = async () => {
    if (!itemName || !user) return
    setLoading(true)
    try {
      let photoUrl = null
      let uploadedPhotoMetadata: Record<string, unknown> | null = null

      if (photo) {
        uploadedPhotoMetadata = photoMetadata || {}
        const fileExt = photo.name.split('.').pop()
        const fileName = `${user.id}-${Math.random()}.${fileExt}`
        const filePath = `activity_logs/${fileName}`
        const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, photo)
        if (uploadError) throw uploadError
        photoUrl = filePath
      }

      const xpMultiplier = category === 'gym' || category === 'detox' ? 10 : 5
      const xpEarned = quantity * xpMultiplier

      const mergedMetadata = {
        ...(uploadedPhotoMetadata || {}),
        is_recipe: (category === 'drink' || category === 'snack') ? isRecipe : undefined,
        consumed_myself: (category === 'drink' || category === 'snack') ? consumedMyself : undefined,
        recipe_details: isRecipe ? recipeDetails : undefined,
        detox_notes: category === 'detox' ? detoxNotes : undefined,
        mood_tag: moodTag || undefined,
      }

      const finalPrivacy = (privacy === 'groups' && !selectedGroup) ? 'private' : privacy

      const { error } = await supabase.from("activity_logs").insert({
        user_id: user.id, category, item_name: itemName, quantity,
        xp_earned: xpEarned, photo_url: photoUrl,
        photo_metadata: mergedMetadata, privacy_level: finalPrivacy,
        group_id: finalPrivacy === 'groups' ? selectedGroup : null
      })
      if (error) throw error

      supabase.rpc('add_xp', { user_id_param: user.id, xp_to_add: xpEarned }).then(res => { if (res.error) console.error(res.error) })

      if (isRecipe && recipeDetails && BARTENDER_API) {
        fetch(`${BARTENDER_API}/embed_recipe`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_name: itemName, category,
            ingredients: recipeDetails.split('\n').filter(s => s.trim()),
            instructions: recipeDetails, flavor_profile: itemName
          })
        }).catch(console.error)
      }

      await refreshProfile()
      await evaluateAndAwardBadges(user.id)

      // Update streak
      const streakData = await updateStreak(user.id)
      setStreakResult(streakData)

      // Update crew streaks for all groups
      updateCrewStreaks(user.id).catch(console.error)

      // Check bounty completions
      const bountyResults = await checkDailyBountyCompletion(user.id)
      const completed = Object.entries(bountyResults)
        .filter(([, v]) => v.completed)
        .map(([k]) => {
          const bounty = getDailyBounties().find(b => b.id === k)
          return bounty ? bounty.title : k
        })
      setCompletedBounties(completed)

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false); setItemName(""); setQuantity(1);
        setIsRecipe(false); setConsumedMyself(true); setRecipeDetails("");
        setDetoxNotes(""); setPhoto(null); setPhotoPreview(null); setPhotoMetadata(null);
        setMoodTag(null);
      }, 2200)

    } catch (error: unknown) {
      alert("Something went wrong: " + (error as Error).message)
    } finally { setLoading(false) }
  }

  if (success) {
    const confetti = ['🎉', '✨', '🍻', '🎊', '⚡', '🏆', '🌟', '🔥']
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 relative overflow-hidden">
        {/* Scattered confetti */}
        {confetti.map((emoji, i) => (
          <div
            key={i}
            className="absolute text-2xl"
            style={{
              left: `${15 + (i * 10)}%`,
              top: `${20 + (i % 3) * 20}%`,
              animation: `confettiBurst 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.08}s both`,
              opacity: 0.8,
            }}
          >
            {emoji}
          </div>
        ))}

        <div className="anim-burst">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
            style={{ background: 'var(--acid-dim)', border: '3px solid var(--acid)', boxShadow: 'var(--acid-glow)' }}
          >
            ✅
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black mb-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
            Logged! 🎉
          </h2>
          <p className="text-sm font-bold" style={{ color: 'var(--acid)' }}>
            +{quantity * (category === 'gym' || category === 'detox' ? 10 : 5)} XP earned
          </p>
          {streakResult && streakResult.isNewDay && (
            <p className="text-sm font-black mt-2" style={{ color: streakResult.currentStreak >= 7 ? 'var(--amber)' : 'var(--text-secondary)' }}>
              🔥 Day {streakResult.currentStreak} of your flame!
            </p>
          )}
          {completedBounties.length > 0 && (
            <div className="mt-3 space-y-1">
              {completedBounties.map((name) => (
                <p key={name} className="text-xs font-bold" style={{ color: 'var(--amber)' }}>
                  ⚡ Bounty complete: {name}
                </p>
              ))}
            </div>
          )}
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Check your challenges for new progress
          </p>
        </div>
      </div>
    )
  }

  const selectedCat = CATEGORIES.find(c => c.id === category)!

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="page-title">Log Activity</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>What are we logging today?</p>
      </div>

      {/* ─── Category Picker ─── */}
      <div className="grid grid-cols-6 gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-sm transition-all active:scale-95"
            style={{
              background: category === cat.id ? cat.bg : 'var(--bg-surface)',
              border: `2px solid ${category === cat.id ? cat.color + '50' : 'var(--border)'}`,
            }}
          >
            <span className="text-2xl">{cat.icon}</span>
            <span className="text-[10px] font-bold" style={{ color: category === cat.id ? cat.color : 'var(--text-muted)', fontFamily: 'Syne, sans-serif' }}>
              {cat.label}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Form Card ─── */}
      <div className="glass-card space-y-5">

        {/* Item name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            {category === 'snack' ? 'Recipe Name' : category === 'detox' ? 'Detox Goal' : 'What exactly?'}
          </label>
          <input
            type="text"
            placeholder={
              category === 'gym' ? "e.g. Leg Day, 1 hour" :
              category === 'detox' ? "e.g. 7 Days No Sugar" :
              category === 'snack' ? "e.g. Spicy Peanuts" : "e.g. Jager Bomb"
            }
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="glass-input"
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            {category === 'gym' || category === 'detox' ? 'Hours / Days' : category === 'snack' ? 'Prep Time (mins)' : 'Quantity'}
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-sm font-black text-xl flex items-center justify-center transition-colors"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)' }}
            >
              −
            </button>
            <div
              className="flex-1 text-center font-black text-3xl"
              style={{ color: selectedCat.color, fontFamily: 'Syne, sans-serif' }}
            >
              {quantity}
            </div>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-sm font-black text-xl flex items-center justify-center transition-colors"
              style={{ background: selectedCat.bg, border: `1px solid ${selectedCat.color}40`, color: selectedCat.color }}
            >
              +
            </button>
          </div>
        </div>

        {/* Mood tag (optional) */}
        {(category === 'drink' || category === 'snack') && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              How are you feeling? (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {MOOD_TAGS.map(m => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => setMoodTag(moodTag === `${m.emoji} ${m.label}` ? null : `${m.emoji} ${m.label}`)}
                  className="text-xs font-bold px-3 py-2 rounded-sm transition-all active:scale-95"
                  style={{
                    background: moodTag === `${m.emoji} ${m.label}` ? 'var(--amber-dim)' : 'var(--bg-raised)',
                    border: moodTag === `${m.emoji} ${m.label}` ? '2px solid var(--amber)' : '1px solid var(--border)',
                    color: moodTag === `${m.emoji} ${m.label}` ? 'var(--amber)' : 'var(--text-secondary)',
                    borderRadius: 'var(--card-radius)',
                  }}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recipe toggle (drink/snack) */}
        {(category === 'drink' || category === 'snack') && (
          <div className="rounded-sm p-3 space-y-3" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 rounded"
                style={{ accentColor: 'var(--coral)' }}
                checked={isRecipe}
                onChange={e => setIsRecipe(e.target.checked)}
              />
              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Share this as a Recipe?</span>
            </label>
            {isRecipe && (
              <div className="space-y-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--coral)' }}
                    checked={consumedMyself}
                    onChange={e => setConsumedMyself(e.target.checked)}
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>I'm also consuming this right now</span>
                </label>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Ingredients / Instructions
                  </label>
                  <textarea
                    placeholder="What makes this a banger? (e.g. 2oz Whiskey, 1oz Sour, shake with ice...)"
                    value={recipeDetails}
                    onChange={e => setRecipeDetails(e.target.value)}
                    className="glass-input min-h-[80px]"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detox notes */}
        {category === 'detox' && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Notes &amp; Feelings
            </label>
            <textarea
              placeholder="How are you holding up?"
              value={detoxNotes}
              onChange={e => setDetoxNotes(e.target.value)}
              className="glass-input min-h-[80px]"
              style={{ resize: 'vertical' }}
            />
          </div>
        )}

        {/* Photo upload */}
        <div>
          <label className="flex justify-between items-center text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            <span>Photo Proof</span>
            {photo && <span className="font-bold text-[10px]" style={{ color: 'var(--sage)' }}>✅ EXIF Captured</span>}
          </label>
          <input type="file" accept="image/*" capture="environment" hidden ref={fileInputRef} onChange={handlePhotoSelect} />

          {photoPreview ? (
            <div className="relative w-full h-40 rounded-sm overflow-hidden" style={{ border: '1px solid var(--border-mid)' }}>
              <img src={photoPreview} alt="Proof" className="w-full h-full object-cover" />
              <button
                onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                className="absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: 'rgba(229,83,75,0.85)', color: '#fff', backdropFilter: 'blur(8px)' }}
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 rounded-sm flex flex-col items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'var(--bg-raised)', border: '2px dashed var(--border-mid)', color: 'var(--text-muted)' }}
            >
              <Camera size={24} strokeWidth={1.5} />
              <span className="text-sm font-medium">Tap to add a photo</span>
            </button>
          )}
        </div>

        {/* Visibility */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Who can see this?
          </label>
          <div className="relative">
            <select
              value={privacy}
              onChange={e => setPrivacy(e.target.value as any)}
              className="glass-input pr-10 appearance-none"
            >
              <option value="public">🌍 Public — Everyone can see</option>
              <option value="groups">👥 Groups Only — Get appraisals</option>
              <option value="private">🔒 Just Me — Private log</option>
              <option value="hidden">🥷 Stealth — Doesn't affect streaks</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          </div>

          {privacy === 'groups' && groups.length > 0 && (
            <div className="mt-3">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--coral)' }}>
                Post to Group
              </label>
              <div className="relative">
                <select
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                  className="glass-input appearance-none pr-10"
                  style={{ borderColor: 'rgba(244,132,95,0.3)' }}
                >
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          )}
          {privacy === 'groups' && groups.length === 0 && (
            <p className="text-xs font-medium mt-2" style={{ color: 'var(--danger)' }}>
              ⚠️ You're not in any groups. This will be private.
            </p>
          )}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !itemName}
        className="glass-btn w-full"
        style={{ fontSize: 16, padding: '16px 24px' }}
      >
        {loading ? "Saving..." : `Log ${selectedCat.icon} ${selectedCat.label}`}
      </button>
    </div>
  )
}