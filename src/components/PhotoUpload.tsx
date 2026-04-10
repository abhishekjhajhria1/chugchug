import { useState, useRef } from "react"
import { supabase } from "../lib/supabase"
import { Camera, X, Upload, Loader2 } from "lucide-react"

interface PhotoUploadProps {
  groupId: string
  userId: string
  onUploadComplete: (url: string) => void
  compact?: boolean
}

export default function PhotoUpload({ groupId, userId, onUploadComplete, compact }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState("")
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return }
    if (!selected.type.startsWith("image/")) { alert("Only image files are allowed"); return }
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split(".").pop()
      const fileName = `${userId}/group_${groupId}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from("photos").upload(fileName, file, { upsert: false })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from("photos").getPublicUrl(fileName)
      await supabase.from("photos").insert({ group_id: groupId, user_id: userId, url: urlData.publicUrl, caption: caption || null })
      onUploadComplete(urlData.publicUrl)
      setPreview(null); setFile(null); setCaption("")
    } catch (err: any) {
      alert("Upload failed: " + (err.message || "Unknown error"))
    } finally { setUploading(false) }
  }

  const clearSelection = () => { setFile(null); setPreview(null); setCaption(""); if (inputRef.current) inputRef.current.value = "" }

  if (compact) {
    return (
      <>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        <button
          onClick={() => inputRef.current?.click()}
          aria-label="Attach photo"
          className="p-2 rounded-full transition-transform active:scale-95 hover:scale-105"
          style={{ background: 'rgba(110,231,183,0.20)', border: '1px solid rgba(110,231,183,0.30)', color: 'var(--accent-mint)' }}
          title="Attach photo"
        >
          <Camera size={18} strokeWidth={2} />
        </button>

        {preview && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(8px)' }}>
            <div className="glass-card w-full max-w-sm space-y-4 anim-pop">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">Share Photo</h3>
                <button onClick={clearSelection} aria-label="Close photo preview" style={{ color: 'var(--text-ghost)' }}><X size={20} strokeWidth={2} /></button>
              </div>
              <img src={preview} alt="Preview" className="w-full rounded-xl object-cover max-h-64" style={{ border: '1px solid var(--glass-edge)' }} />
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption..." className="glass-input w-full" maxLength={200} />
              <button onClick={handleUpload} disabled={uploading} className="glass-btn w-full flex items-center justify-center gap-2">
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} strokeWidth={2} />}
                {uploading ? "Uploading..." : "Share Photo"}
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="glass-card glow-mint">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          aria-label="Select photo to upload"
          className="w-full flex flex-col items-center gap-3 py-6 opacity-70 hover:opacity-100 transition-opacity"
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(110,231,183,0.15)', border: '1px solid rgba(110,231,183,0.25)', boxShadow: '0 4px 16px rgba(0,0,0,0.20)' }}
          >
            <Camera size={24} strokeWidth={2} className="accent-mint" />
          </div>
          <p className="font-bold">Tap to share a photo</p>
          <p className="text-xs font-medium" style={{ color: 'var(--text-ghost)' }}>Max 5MB · JPG, PNG, WEBP</p>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <img src={preview} alt="Preview" className="w-full rounded-xl object-cover max-h-72" style={{ border: '1px solid var(--glass-edge)' }} />
            <button onClick={clearSelection} aria-label="Remove selected photo" className="absolute top-2 right-2 p-1.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-bright)' }}
            ><X size={14} strokeWidth={2} /></button>
          </div>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption..." className="glass-input w-full" maxLength={200} />
          <button onClick={handleUpload} disabled={uploading} className="glass-btn w-full flex items-center justify-center gap-2">
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} strokeWidth={2} />}
            {uploading ? "Uploading..." : "Share Photo"}
          </button>
        </div>
      )}
    </div>
  )
}
