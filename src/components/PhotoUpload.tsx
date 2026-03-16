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

    if (selected.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB")
      return
    }

    if (!selected.type.startsWith("image/")) {
      alert("Only image files are allowed")
      return
    }

    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)

    try {
      const ext = file.name.split(".").pop()
      const fileName = `${groupId}/${userId}_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("group-photos")
        .upload(fileName, file, { upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from("group-photos")
        .getPublicUrl(fileName)

      const publicUrl = urlData.publicUrl

      await supabase.from("photos").insert({
        group_id: groupId,
        user_id: userId,
        url: publicUrl,
        caption: caption || null,
      })

      onUploadComplete(publicUrl)
      setPreview(null)
      setFile(null)
      setCaption("")
    } catch (err: any) {
      alert("Upload failed: " + (err.message || "Unknown error"))
    } finally {
      setUploading(false)
    }
  }

  const clearSelection = () => {
    setFile(null)
    setPreview(null)
    setCaption("")
    if (inputRef.current) inputRef.current.value = ""
  }

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="p-2 bg-[#A0E8AF] rounded-full border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24] text-[#3D2C24] transition-transform active:scale-95 hover:scale-105"
          title="Attach photo"
        >
          <Camera size={18} strokeWidth={3} />
        </button>

        {preview && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border-[3px] border-[#3D2C24] shadow-[6px_6px_0px_#3D2C24] p-6 w-full max-w-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-lg text-[#3D2C24]">Share Photo</h3>
                <button onClick={clearSelection} className="text-[#3D2C24]/50 hover:text-[#3D2C24]">
                  <X size={20} strokeWidth={3} />
                </button>
              </div>
              <img src={preview} alt="Preview" className="w-full rounded-xl border-2 border-[#3D2C24] object-cover max-h-64" />
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption..."
                className="cartoon-input w-full"
                maxLength={200}
              />
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="cartoon-btn w-full flex items-center justify-center gap-2"
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} strokeWidth={3} />}
                {uploading ? "Uploading..." : "Share Photo"}
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="cartoon-card bg-[#A0E8AF]/10 border-[#60D394]">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center gap-3 py-6 opacity-70 hover:opacity-100 transition-opacity"
        >
          <div className="w-16 h-16 bg-[#A0E8AF] rounded-full border-[3px] border-[#3D2C24] shadow-[3px_3px_0px_#3D2C24] flex items-center justify-center">
            <Camera size={28} strokeWidth={3} className="text-[#3D2C24]" />
          </div>
          <p className="font-black text-[#3D2C24]">Tap to share a photo</p>
          <p className="text-xs font-bold text-[#3D2C24]/50">Max 5MB • JPG, PNG, WEBP</p>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <img src={preview} alt="Preview" className="w-full rounded-xl border-2 border-[#3D2C24] object-cover max-h-72" />
            <button
              onClick={clearSelection}
              className="absolute top-2 right-2 p-1.5 bg-white rounded-full border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24]"
            >
              <X size={16} strokeWidth={3} />
            </button>
          </div>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            className="cartoon-input w-full"
            maxLength={200}
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="cartoon-btn w-full flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} strokeWidth={3} />}
            {uploading ? "Uploading..." : "Share Photo"}
          </button>
        </div>
      )}
    </div>
  )
}
