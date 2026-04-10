import { useState } from "react"
import { supabase } from "../lib/supabase"
// @ts-ignore
import exifr from 'exifr/dist/lite.esm.mjs'
import { useChug } from "../context/ChugContext"
import { MapPin, Clock, Smartphone, Shield, CheckCircle2 } from "lucide-react"

interface PhotoMetadataProps {
  logId: string
  metadata: {
    taken_at?: string
    device?: string
    latitude?: number
    longitude?: number
    location_name?: string
    is_recipe?: boolean
  } | null
  verifications?: { verifier_id: string; profiles?: { username: string } }[]
  onVerify?: () => void
}

export default function PhotoMetadata({ logId, metadata, verifications = [], onVerify }: PhotoMetadataProps) {
  const { user } = useChug()
  const [verifying, setVerifying] = useState(false)

  if (!metadata) return null

  const hasVerified = verifications.some(v => v.verifier_id === user?.id)
  const verCount = verifications.length

  const handleVerify = async () => {
    if (!user || hasVerified) return
    setVerifying(true)
    const { error } = await supabase.from("photo_verifications").insert({
      log_id: logId, verifier_id: user.id
    })
    if (!error && onVerify) onVerify()
    setVerifying(false)
  }

  return (
    <div className="mt-3 rounded-xl p-3 space-y-2"
      style={{ background: 'var(--glass-fill)', border: '1px solid var(--glass-edge)' }}>

      {/* EXIF Info Row */}
      <div className="flex flex-wrap gap-3 text-[11px] font-medium" style={{ color: 'var(--text-dim)' }}>
        {metadata.taken_at && (
          <span className="flex items-center gap-1">
            <Clock size={10} /> {new Date(metadata.taken_at).toLocaleString()}
          </span>
        )}
        {metadata.device && (
          <span className="flex items-center gap-1">
            <Smartphone size={10} /> {metadata.device}
          </span>
        )}
        {metadata.location_name && (
          <span className="flex items-center gap-1">
            <MapPin size={10} className="accent-rose" /> {metadata.location_name}
          </span>
        )}
      </div>

      {/* Verification Row */}
      <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px dashed var(--glass-edge)' }}>
        <div className="flex items-center gap-2">
          {verCount > 0 ? (
            <>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                style={{
                  background: 'rgba(110,231,183,0.12)',
                  border: '1px solid rgba(110,231,183,0.25)',
                  color: 'var(--accent-mint)',
                }}>
                <Shield size={10} /> Verified by {verCount}
              </div>
              <div className="flex -space-x-1">
                {verifications.slice(0, 3).map((v, i) => (
                  <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                    style={{
                      background: 'var(--glass-fill-elevated)',
                      border: '1px solid var(--glass-edge)',
                    }}>
                    {v.profiles?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-ghost)' }}>
              Not yet verified
            </span>
          )}
        </div>

        {user && !hasVerified && (
          <button onClick={handleVerify} aria-label="Verify this photo" disabled={verifying}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-30"
            style={{
              background: 'var(--glass-fill)',
              border: '1px solid rgba(110,231,183,0.20)',
              color: 'var(--accent-mint)',
            }}>
            <CheckCircle2 size={12} /> I was there
          </button>
        )}

        {hasVerified && (
          <span className="flex items-center gap-1 text-[11px] font-semibold accent-mint">
            <CheckCircle2 size={12} /> Verified ✓
          </span>
        )}
      </div>
    </div>
  )
}

// EXIF extraction utility — call this on file upload
export async function extractPhotoMetadata(file: File): Promise<Record<string, any>> {
  const metadata: Record<string, any> = {
    taken_at: new Date().toISOString(),
    file_name: file.name,
    file_size: file.size,
    file_type: file.type,
  }

  try {
    const buffer = await file.arrayBuffer()
    const view = new DataView(buffer)

    // Check for JPEG EXIF
    if (view.getUint16(0) === 0xFFD8) {
      let offset = 2
      while (offset < view.byteLength - 2) {
        const marker = view.getUint16(offset)
        if (marker === 0xFFE1) { // APP1 (EXIF)
          const exifLength = view.getUint16(offset + 2)
          // Basic EXIF parsing — extract what we can
          const exifStr = new TextDecoder().decode(buffer.slice(offset + 4, offset + 4 + Math.min(exifLength, 500)))
          const normalizedExif = exifStr.replaceAll(String.fromCharCode(0), ' ')

          // Try to extract device model from EXIF string
          const modelMatch = normalizedExif.match(/(iPhone|Galaxy|Pixel|OnePlus|Xiaomi|Redmi|POCO|Samsung|Huawei|Oppo|Vivo|Realme|Nothing)[^\n\r]*/i)
          if (modelMatch) metadata.device = modelMatch[0].trim()

          break
        }
        const segmentLength = view.getUint16(offset + 2)
        offset += 2 + segmentLength
      }
    }

    // Try geolocation API for current position as a fallback
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        })
        metadata.latitude = pos.coords.latitude
        metadata.longitude = pos.coords.longitude
      } catch { /* location denied or timeout — skip */ }
    }
  } catch { /* EXIF parsing failed — use defaults */ }

  return metadata
}
