import { useState, useRef, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { Plus, Camera, Image as ImageIcon, CheckCircle2 } from "lucide-react"
import { extractPhotoMetadata } from "../components/PhotoMetadata"

type ActivityCategory = 'drink' | 'cigarette' | 'snack' | 'gym' | 'detox' | 'other'

const CATEGORIES: { id: ActivityCategory, label: string, icon: string, color: string }[] = [
  { id: 'drink', label: 'Drink', icon: '🍻', color: 'var(--neon-amber)' },
  { id: 'snack', label: 'Snack', icon: '🍟', color: 'var(--neon-pink)' },
  { id: 'cigarette', label: 'Smoke', icon: '🚬', color: 'var(--neon-lime)' },
  { id: 'gym', label: 'Gym', icon: '💪', color: 'var(--neon-cyan)' },
  { id: 'detox', label: 'Detox', icon: '🧘', color: 'var(--neon-purple)' },
]

export default function Log() {
  const { user, refreshProfile } = useChug()

  const [category, setCategory] = useState<ActivityCategory>('drink')
  const [itemName, setItemName] = useState("")
  const [quantity, setQuantity] = useState<number | string>(1)
  const [privacy, setPrivacy] = useState<'public' | 'groups' | 'private' | 'hidden'>('groups')

  const [groups, setGroups] = useState<{ id: string, name: string }[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string>('')

  useEffect(() => {
    const fetchGroups = async () => {
      if (!user) return
      const { data } = await supabase
        .from("group_members")
        .select(`groups (id, name)`)
        .eq("user_id", user.id)

      if (data) {
        const gList = data.map(m => Array.isArray(m.groups) ? m.groups[0] : m.groups) as any as { id: string, name: string }[]
        setGroups(gList)
        if (gList.length > 0) setSelectedGroup(gList[0].id)
      }
    }
    fetchGroups()
  }, [user])

  const [isRecipe, setIsRecipe] = useState(false)
  const [consumedMyself, setConsumedMyself] = useState(true)
  const [recipeDetails, setRecipeDetails] = useState("")
  const [detoxNotes, setDetoxNotes] = useState("")

  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
      
      // Extract real metadata
      const meta = await extractPhotoMetadata(file)
      setPhotoMetadata(meta)
    }
  }

  const [photoMetadata, setPhotoMetadata] = useState<Record<string, any> | null>(null)



  const handleSubmit = async () => {
    if (!itemName || !user) return
    setLoading(true)

    try {
      let photoUrl = null
      let uploadedPhotoMetadata: Record<string, unknown> | null = null

      if (photo) {
        // Use extracted metadata
        uploadedPhotoMetadata = photoMetadata || {}

        const fileExt = photo.name.split('.').pop()
        const fileName = `${user.id}-${Math.random()}.${fileExt}`
        const filePath = `activity_logs/${fileName}`


        photoUrl = filePath
      }

      const numQuantity = typeof quantity === 'string' ? parseInt(quantity) || 1 : quantity
      const xpMultiplier = category === 'gym' || category === 'detox' ? 10 : 5
      const xpEarned = numQuantity * xpMultiplier

      const mergedMetadata = {
        ...(uploadedPhotoMetadata || {}),
        is_recipe: (category === 'drink' || category === 'snack') ? isRecipe : undefined,
        consumed_myself: (category === 'drink' || category === 'snack') ? consumedMyself : undefined,
        recipe_details: isRecipe ? recipeDetails : undefined,
        detox_notes: category === 'detox' ? detoxNotes : undefined
      }

      const { error } = await supabase.from("activity_logs").insert({
        user_id: user.id,
        category,
        item_name: itemName,
        quantity: numQuantity,
        xp_earned: xpEarned,
        photo_url: photoUrl,
        photo_metadata: mergedMetadata,
        privacy_level: privacy,
        group_id: privacy === 'groups' ? (selectedGroup || null) : null
      })

      if (error) throw error

      console.log(`Calling add_xp RPC with userId: ${user.id}, xpToAdd: ${xpEarned}`)
      const { data: rpcData, error: rpcError } = await supabase.rpc('add_xp', { user_id_param: user.id, xp_to_add: xpEarned })
      if (rpcError) {
        console.error("RPC Error:", rpcError)
        throw rpcError
      }
      console.log("RPC Data returned:", rpcData)

      if (isRecipe && recipeDetails) {
         try {
            await fetch('http://127.0.0.1:8001/embed_recipe', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                  item_name: itemName,
                  category: category,
                  ingredients: recipeDetails.split('\n').filter(s => s.trim()), 
                  instructions: recipeDetails,
                  flavor_profile: itemName
               })
            })
            console.log("Embedded recipe to AI Bartender RAG.")
         } catch(e) {
            console.error("Failed to embed recipe to AI Bartender:", e)
         }
      }

      await refreshProfile()

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setItemName("")
        setQuantity(1)
        setIsRecipe(false)
        setConsumedMyself(true)
        setRecipeDetails("")
        setDetoxNotes("")
        setPhoto(null)
        setPhotoPreview(null)
      }, 2000)

    } catch (error: unknown) {
      alert("Error logging activity: " + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 animate-fadeInScale">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center animate-jelly"
          style={{
            background: 'linear-gradient(135deg, rgba(125, 255, 106, 0.3), rgba(0, 240, 255, 0.2))',
            border: '2px solid rgba(125, 255, 106, 0.4)',
            boxShadow: '0 0 40px rgba(125, 255, 106, 0.3)',
            color: 'var(--neon-lime)',
          }}
        >
          <CheckCircle2 size={56} strokeWidth={2} />
        </div>
        <h2 className="text-3xl font-black neon-lime" style={{ fontFamily: 'Outfit, sans-serif' }}>Logged Successfully!</h2>
        <p className="font-bold" style={{ color: 'var(--text-muted)' }}>Waiting for group appraisals to earn bonus XP...</p>
      </div>
    )
  }

  const selectedCat = CATEGORIES.find(c => c.id === category)

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-3xl font-black flex items-center gap-3 animate-slideInUp" style={{ fontFamily: 'Outfit, sans-serif' }}>
        <span
          className="p-1.5 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 45, 255, 0.3), rgba(0, 240, 255, 0.2))',
            border: '1px solid rgba(255, 45, 255, 0.3)',
            boxShadow: '0 0 15px rgba(255, 45, 255, 0.2)',
          }}
        >
          <Plus size={22} strokeWidth={2.5} className="text-white" />
        </span>
        Log Activity
      </h1>

      <div className="glass-card space-y-6">

        {/* Category Selector */}
        <div className="space-y-2">
          <label className="font-bold text-sm uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Category</label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`snap-start shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all duration-300 active:scale-95 animate-fadeInScale stagger-${i + 1}`}
                style={{
                  background: category === cat.id ? `${cat.color}20` : 'var(--glass-bg)',
                  border: category === cat.id ? `1px solid ${cat.color}60` : '1px solid var(--glass-border)',
                  color: category === cat.id ? cat.color : 'var(--text-secondary)',
                  boxShadow: category === cat.id ? `0 0 15px ${cat.color}20` : 'none',
                  transform: category === cat.id ? 'translateY(-2px)' : 'none',
                }}
              >
                <span className="text-xl">{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Item Name */}
        <div className="space-y-2">
          <label className="font-bold text-sm uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            {category === 'snack' ? 'Recipe Name' : category === 'detox' ? 'Detox Goal' : 'What exactly?'}
          </label>
          <input
            type="text"
            placeholder={category === 'gym' ? "e.g. Leg Day" : category === 'detox' ? "e.g. 7 Days No Sugar" : category === 'snack' ? "e.g. Spicy Peanuts" : "e.g. Jager Bomb"}
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="glass-input w-full"
          />
        </div>

        {/* Custom Field: Recipes (For Drink or Snack) */}
        {(category === 'drink' || category === 'snack') && (
          <div
            className="space-y-3 p-3 rounded-xl animate-fadeInScale"
            style={{
              background: 'rgba(255, 107, 172, 0.06)',
              border: '1px solid rgba(255, 107, 172, 0.2)',
            }}
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 accent-pink-400"
                checked={isRecipe}
                onChange={e => setIsRecipe(e.target.checked)}
              />
              <span className="font-bold">Share this as a Recipe?</span>
            </label>

            {isRecipe && (
              <div className="space-y-4 pt-3 animate-fadeInScale" style={{ borderTop: '1px solid rgba(255, 107, 172, 0.15)' }}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-pink-400"
                    checked={consumedMyself}
                    onChange={e => setConsumedMyself(e.target.checked)}
                  />
                  <span className="font-bold text-sm">I'm also consuming this right now</span>
                </label>

                <div className="space-y-2">
                  <label className="font-bold text-sm uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Ingredients / Instructions</label>
                  <textarea
                    placeholder="What makes this a banger? (e.g. 2oz Whiskey, 1oz Sour...)"
                    value={recipeDetails}
                    onChange={(e) => setRecipeDetails(e.target.value)}
                    className="glass-input w-full min-h-20"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom Field: Detox */}
        {category === 'detox' && (
          <div className="space-y-2 animate-fadeInScale">
            <label className="font-bold text-sm uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Notes & Feelings</label>
            <textarea
              placeholder="How are you holding up?"
              value={detoxNotes}
              onChange={(e) => setDetoxNotes(e.target.value)}
              className="glass-input w-full min-h-20"
            />
          </div>
        )}

        {/* Quantity (Slider + Direct Input) */}
        <div className="space-y-2">
          <label className="font-bold text-sm uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            {category === 'gym' || category === 'detox' ? 'Hours / Days' : category === 'snack' ? 'Prep Time (mins)' : 'Quantity'}
          </label>
          <div
            className="flex items-center gap-4 p-3 rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed var(--glass-border)',
            }}
          >
            <input
              type="range"
              min="1"
              max={category === 'snack' ? "120" : "20"}
              value={Number(quantity) || 1}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: selectedCat?.color || 'var(--neon-cyan)' }}
            />
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-16 text-center font-black text-2xl neon-pink rounded-xl outline-none py-2 px-2"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}
            />
          </div>
        </div>

        {/* Photo Upload */}
        <div className="space-y-2">
          <label className="font-bold text-sm uppercase tracking-widest flex justify-between items-center" style={{ color: 'var(--text-secondary)' }}>
            <span>Proof (Required for Appraisals)</span>
            {photo && <span className="neon-lime text-xs">EXIF Captured ✅</span>}
          </label>

          <input type="file" accept="image/*" capture="environment" hidden ref={fileInputRef} onChange={handlePhotoSelect} />

          {photoPreview ? (
            <div className="relative w-full h-40 rounded-xl overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
              <img src={photoPreview} alt="Proof" className="w-full h-full object-cover" />
              <button
                onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                className="absolute top-2 right-2 font-black px-3 py-1 rounded-full text-sm"
                style={{
                  background: 'rgba(255, 80, 80, 0.8)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 80, 80, 0.6)',
                  color: 'white',
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:bg-white/5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed var(--glass-border)',
                color: 'var(--text-muted)',
              }}
            >
              <Camera size={28} strokeWidth={1.5} className="mb-1" />
              <span className="font-bold text-sm">Tap to snap a photo</span>
            </div>
          )}
        </div>

        {/* Visibility / Privacy */}
        <div className="space-y-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <label className="font-bold text-sm uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Visibility</label>
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as 'public' | 'groups' | 'private' | 'hidden')}
            className="glass-input w-full mb-3"
          >
            <option value="public">🌍 Public (Global Feed)</option>
            <option value="groups">👥 Groups Only (Appraisals On)</option>
            <option value="private">🔒 Private (Just me)</option>
            <option value="hidden">🥷 Stealth Mode (Doesn't affect streaks)</option>
          </select>

          {privacy === 'groups' && groups.length > 0 && (
            <div className="space-y-2 mt-2 animate-fadeInScale">
              <label className="font-bold text-sm uppercase tracking-widest neon-pink">Post to Group</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="glass-input w-full"
                style={{ borderColor: 'rgba(255, 107, 172, 0.3)' }}
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
          {privacy === 'groups' && groups.length === 0 && (
            <p className="text-xs font-bold mt-1" style={{ color: '#ff6b6b' }}>You are not in any groups. This will act like a private post.</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !itemName}
          className="glass-btn w-full mt-4 flex justify-center items-center gap-2"
        >
          {loading ? "Verifying EXIF..." : <><ImageIcon size={20} /> Log & Share</>}
        </button>
      </div>
    </div>
  )
}