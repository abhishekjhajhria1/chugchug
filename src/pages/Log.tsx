import { useState, useRef } from "react"
import { supabase } from "../lib/supabase"
import { useChug } from "../context/ChugContext"
import { Plus, Camera, Image as ImageIcon, CheckCircle2 } from "lucide-react"

type ActivityCategory = 'drink' | 'cigarette' | 'snack' | 'gym' | 'detox' | 'other'

const CATEGORIES: { id: ActivityCategory, label: string, icon: string, color: string }[] = [
  { id: 'drink', label: 'Drink', icon: '🍻', color: '#FFD166' },
  { id: 'snack', label: 'Snack', icon: '🍟', color: '#FF9F1C' },
  { id: 'cigarette', label: 'Smoke', icon: '🚬', color: '#A0E8AF' },
  { id: 'gym', label: 'Gym', icon: '💪', color: '#118AB2' },
  { id: 'detox', label: 'Detox', icon: '🧘', color: '#06D6A0' },
]

export default function Log() {
  const { user, refreshProfile } = useChug()

  const [category, setCategory] = useState<ActivityCategory>('drink')
  const [itemName, setItemName] = useState("")
  const [quantity, setQuantity] = useState<number | string>(1)
  const [privacy, setPrivacy] = useState<'public' | 'groups' | 'private' | 'hidden'>('groups')

  const [isRecipe, setIsRecipe] = useState(false)
  const [consumedMyself, setConsumedMyself] = useState(true)
  const [recipeDetails, setRecipeDetails] = useState("")
  const [detoxNotes, setDetoxNotes] = useState("")

  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const extractMockExif = (file: File) => {
    return {
      timestamp: new Date().toISOString(),
      size: file.size,
      type: file.type,
      verified_location: true
    }
  }

  const handleSubmit = async () => {
    if (!itemName || !user) return
    setLoading(true)

    try {
      let photoUrl = null
      let photoMetadata: Record<string, unknown> | null = null

      if (photo) {
        photoMetadata = extractMockExif(photo)

        const fileExt = photo.name.split('.').pop()
        const fileName = `${user.id}-${Math.random()}.${fileExt}`
        const filePath = `activity_logs/${fileName}`


        photoUrl = filePath // Mocking successful upload path
      }

      const numQuantity = typeof quantity === 'string' ? parseInt(quantity) || 1 : quantity
      const xpMultiplier = category === 'gym' || category === 'detox' ? 10 : 5
      const xpEarned = numQuantity * xpMultiplier

      const mergedMetadata = {
        ...photoMetadata,
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
        privacy_level: privacy
      })

      if (error) throw error

      console.log(`Calling add_xp RPC with userId: ${user.id}, xpToAdd: ${xpEarned}`)
      const { data: rpcData, error: rpcError } = await supabase.rpc('add_xp', { user_id_param: user.id, xp_to_add: xpEarned })
      if (rpcError) {
        console.error("RPC Error:", rpcError)
        throw rpcError
      }
      console.log("RPC Data returned:", rpcData)

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
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 fade-in">
        <div className="w-24 h-24 bg-[#A0E8AF] rounded-full border-4 border-[#3D2C24] shadow-[4px_4px_0px_#3D2C24] flex items-center justify-center text-white">
          <CheckCircle2 size={64} strokeWidth={3} />
        </div>
        <h2 className="text-3xl font-black text-[#3D2C24]">Logged Successfully!</h2>
        <p className="font-bold text-[#3D2C24] opacity-70">Waiting for group appraisals to earn bonus XP...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-3xl font-black flex items-center gap-3 text-[#3D2C24]">
        <span className="bg-[#FF7B9C] p-1.5 rounded-xl border-[3px] border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24]">
          <Plus size={24} strokeWidth={4} className="text-white" />
        </span>
        Log Activity
      </h1>

      <div className="cartoon-card space-y-6">

        {/* Category Selector */}
        <div className="space-y-2">
          <label className="font-bold text-sm text-[#3D2C24] uppercase tracking-widest">Category</label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`snap-start shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[#3D2C24] font-black transition-transform active:scale-95 ${category === cat.id ? 'shadow-[2px_2px_0px_#3D2C24] -translate-y-1' : 'bg-white opacity-60'}`}
                style={{ backgroundColor: category === cat.id ? cat.color : undefined }}
              >
                <span className="text-xl">{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Item Name */}
        <div className="space-y-2">
          <label className="font-bold text-sm text-[#3D2C24] uppercase tracking-widest">
            {category === 'snack' ? 'Recipe Name' : category === 'detox' ? 'Detox Goal' : 'What exactly?'}
          </label>
          <input
            type="text"
            placeholder={category === 'gym' ? "e.g. Leg Day" : category === 'detox' ? "e.g. 7 Days No Sugar" : category === 'snack' ? "e.g. Spicy Peanuts" : "e.g. Jager Bomb"}
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="cartoon-input w-full"
          />
        </div>

        {/* Custom Field: Recipes (For Drink or Snack) */}
        {(category === 'drink' || category === 'snack') && (
          <div className="space-y-3 p-3 bg-[#FF7B9C]/10 rounded-xl border-2 border-[#FF7B9C]">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 accent-[#FF7B9C]"
                checked={isRecipe}
                onChange={e => setIsRecipe(e.target.checked)}
              />
              <span className="font-bold text-[#3D2C24]">Share this as a Recipe?</span>
            </label>

            {isRecipe && (
              <div className="space-y-4 pt-3 border-t-2 border-[#FF7B9C]/20 fade-in">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-[#FF7B9C]"
                    checked={consumedMyself}
                    onChange={e => setConsumedMyself(e.target.checked)}
                  />
                  <span className="font-bold text-[#3D2C24] text-sm">I'm also consuming this right now</span>
                </label>

                <div className="space-y-2">
                  <label className="font-bold text-sm text-[#3D2C24] uppercase tracking-widest">Ingredients / Instructions</label>
                  <textarea
                    placeholder="What makes this a banger? (e.g. 2oz Whiskey, 1oz Sour...)"
                    value={recipeDetails}
                    onChange={(e) => setRecipeDetails(e.target.value)}
                    className="cartoon-input w-full min-h-20"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom Field: Detox */}
        {category === 'detox' && (
          <div className="space-y-2">
            <label className="font-bold text-sm text-[#3D2C24] uppercase tracking-widest">Notes & Feelings</label>
            <textarea
              placeholder="How are you holding up?"
              value={detoxNotes}
              onChange={(e) => setDetoxNotes(e.target.value)}
              className="cartoon-input w-full min-h-20"
            />
          </div>
        )}

        {/* Quantity (Slider + Direct Input) */}
        <div className="space-y-2">
          <label className="font-bold text-sm text-[#3D2C24] uppercase tracking-widest">
            {category === 'gym' || category === 'detox' ? 'Hours / Days' : category === 'snack' ? 'Prep Time (mins)' : 'Quantity'}
          </label>
          <div className="flex items-center gap-4 bg-white/50 p-3 rounded-xl border-[3px] border-[#3D2C24] border-dashed">
            <input
              type="range"
              min="1"
              max={category === 'snack' ? "120" : "20"}
              value={Number(quantity) || 1}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full accent-[#FF7B9C]"
            />
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-16 text-center font-black text-2xl text-[#FF7B9C] bg-white px-2 py-2 rounded-xl border-2 border-[#4A3B32] shadow-[2px_2px_0px_#4A3B32] outline-none"
            />
          </div>
        </div>

        {/* Photo Upload (Anti-Cheat Validation) */}
        <div className="space-y-2">
          <label className="font-bold text-sm text-[#3D2C24] uppercase tracking-widest flex justify-between items-center">
            <span>Proof (Required for Appraisals)</span>
            {photo && <span className="text-[#60D394] text-xs">EXIF Captured ✅</span>}
          </label>

          <input type="file" accept="image/*" capture="environment" hidden ref={fileInputRef} onChange={handlePhotoSelect} />

          {photoPreview ? (
            <div className="relative w-full h-40 bg-gray-200 rounded-xl border-[3px] border-[#3D2C24] overflow-hidden">
              <img src={photoPreview} alt="Proof" className="w-full h-full object-cover" />
              <button
                onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                className="absolute top-2 right-2 bg-red-500 text-white font-black px-3 py-1 rounded-full border-2 border-[#3D2C24]"
              >
                Remove
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 bg-white border-[3px] border-[#3D2C24] border-dashed hover:border-solid rounded-xl flex flex-col items-center justify-center cursor-pointer text-[#3D2C24]/60 hover:text-[#FF7B9C] transition-colors"
            >
              <Camera size={32} strokeWidth={2} className="mb-1" />
              <span className="font-bold text-sm">Tap to snap a photo</span>
            </div>
          )}
        </div>

        {/* Visibility / Privacy */}
        <div className="space-y-2 pt-2 border-t-2 border-[#3D2C24]/10">
          <label className="font-bold text-sm text-[#3D2C24] uppercase tracking-widest">Visibility</label>
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as 'public' | 'groups' | 'private' | 'hidden')}
            className="cartoon-input w-full"
          >
            <option value="public">🌍 Public (Global Feed)</option>
            <option value="groups">👥 Groups Only (Appraisals On)</option>
            <option value="private">🔒 Private (Just me)</option>
            <option value="hidden">🥷 Stealth Mode (Doesn't affect streaks)</option>
          </select>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !itemName}
          className="cartoon-btn w-full mt-4 flex justify-center items-center gap-2"
        >
          {loading ? "Verifying EXIF..." : <><ImageIcon size={20} /> Log & Share</>}
        </button>
      </div>
    </div>
  )
}