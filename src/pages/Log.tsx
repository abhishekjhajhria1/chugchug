import { useState, useRef, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { evaluateAndAwardBadges } from "../lib/progression"
import { Camera, CheckCircle2, ChevronDown } from "lucide-react"
import { extractPhotoMetadata } from "../components/PhotoMetadata"

type ActivityCategory = 'drink' | 'cigarette' | 'snack' | 'gym' | 'detox'

const CATEGORIES: { id: ActivityCategory; label: string; icon: string; color: string; bg: string }[] = [
  { id: 'drink',     label: 'Drink',  icon: '🍻', color: 'var(--amber)', bg: 'var(--amber-dim)' },
  { id: 'snack',     label: 'Snack',  icon: '🍟', color: 'var(--coral)', bg: 'var(--coral-dim)' },
  { id: 'cigarette', label: 'Smoke',  icon: '🚬', color: 'var(--sage)',  bg: 'var(--sage-dim)'  },
  { id: 'gym',       label: 'Gym',    icon: '💪', color: 'var(--indigo)', bg: 'var(--indigo-dim)' },
  { id: 'detox',     label: 'Detox',  icon: '🧘', color: 'var(--sage)',  bg: 'var(--sage-dim)'  },
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
        detox_notes: category === 'detox' ? detoxNotes : undefined
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

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false); setItemName(""); setQuantity(1);
        setIsRecipe(false); setConsumedMyself(true); setRecipeDetails("");
        setDetoxNotes(""); setPhoto(null); setPhotoPreview(null); setPhotoMetadata(null);
      }, 2200)

    } catch (error: unknown) {
      alert("Something went wrong: " + (error as Error).message)
    } finally { setLoading(false) }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 anim-pop">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'var(--sage-dim)', border: '2px solid rgba(76,175,125,0.4)' }}
        >
          <CheckCircle2 size={44} style={{ color: 'var(--sage)' }} strokeWidth={2} />
        </div>
        <h2 className="text-2xl font-black" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
          Logged! 🎉
        </h2>
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          XP added. Waiting for group appraisals...
        </p>
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
      <div className="grid grid-cols-5 gap-2">
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