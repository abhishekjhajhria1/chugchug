import { useState, useEffect, useRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import { X, Camera, QrCode, Copy, Check } from "lucide-react"

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'display' | 'scan'
  data?: string
  title?: string
  subtitle?: string
  onScanResult?: (result: string) => void
  personalId?: string
}

export default function QRCodeModal({ isOpen, onClose, mode: initialMode, data: initialData, title, subtitle, onScanResult, personalId }: QRCodeModalProps) {
  const mode = personalId ? 'display' : initialMode
  const data = personalId ? `${window.location.origin}/connect/${personalId}` : initialData
  
  const [copied, setCopied] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      openerRef.current?.focus()
      return
    }
    openerRef.current = document.activeElement as HTMLElement | null
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || mode !== 'scan') return

    let detector: any = null
    let animFrame: number

    const startScanner = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setScanning(true)
        }

        if ('BarcodeDetector' in window) {
          detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })

          const scan = async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) {
              animFrame = requestAnimationFrame(scan)
              return
            }
            try {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes.length > 0) {
                const result = barcodes[0].rawValue
                if (result && onScanResult) {
                  onScanResult(result)
                  stopScanner()
                  onClose()
                  return
                }
              }
            } catch { /* ignore frame errors */ }
            animFrame = requestAnimationFrame(scan)
          }
          scan()
        } else {
          setScanError("QR scanning not supported on this browser. Try Chrome on Android or Safari on iOS.")
        }
      } catch (err: any) {
        setScanError(err.message || "Could not access camera")
      }
    }

    const stopScanner = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (animFrame) cancelAnimationFrame(animFrame)
      setScanning(false)
    }

    startScanner()
    return () => stopScanner()
  }, [isOpen, mode, onScanResult, onClose])

  const handleCopy = () => {
    if (data) {
      navigator.clipboard.writeText(data)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>

      <div className="glass-card w-full max-w-sm anim-pop" role="dialog" aria-modal="true" aria-label={title || (mode === 'display' ? 'QR code modal' : 'QR scanner modal')} onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(28px)' }}>

        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="accent-violet" />
            <h3 className="font-bold text-lg">{title || (mode === 'display' ? 'QR Code' : 'Scan QR')}</h3>
          </div>
          <button onClick={onClose} aria-label="Close QR modal" className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-ghost)' }}>
            <X size={18} />
          </button>
        </div>

        {subtitle && (
          <p className="text-sm font-medium mb-4" style={{ color: 'var(--text-dim)' }}>{subtitle}</p>
        )}

        {/* DISPLAY MODE */}
        {mode === 'display' && data && (
          <div className="flex flex-col items-center gap-4">
            <div className="p-5 rounded-2xl" style={{ background: 'white' }}>
              <QRCodeSVG value={data} size={200} level="M"
                bgColor="white" fgColor="#1a1530"
                imageSettings={{
                  src: '', width: 0, height: 0, excavate: false,
                }}
              />
            </div>

            <button onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: copied ? 'rgba(110,231,183,0.15)' : 'var(--glass-fill)',
                border: `1px solid ${copied ? 'rgba(110,231,183,0.30)' : 'var(--glass-edge)'}`,
                color: copied ? 'var(--accent-mint)' : 'var(--text-normal)',
              }}>
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
            </button>
          </div>
        )}

        {/* SCAN MODE */}
        {mode === 'scan' && (
          <div className="flex flex-col items-center gap-4">
            {scanError ? (
              <div className="text-center py-8">
                <p className="text-sm font-medium accent-rose mb-3">⚠️ {scanError}</p>
                <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>
                  You can also ask the host to share the party link directly.
                </p>
              </div>
            ) : (
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden" role="region" aria-label="QR scanner" style={{ border: '2px solid var(--glass-edge)' }}>
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 rounded-2xl"
                      style={{
                        borderColor: 'rgba(167,139,250,0.50)',
                        boxShadow: '0 0 20px rgba(167,139,250,0.20)',
                        animation: 'glowPulse 2s ease-in-out infinite',
                      }} />
                  </div>
                )}
                {!scanning && (
                  <div className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.50)' }}>
                    <div className="text-center" aria-live="polite">
                      <Camera size={32} className="mx-auto mb-2 accent-violet" />
                      <p className="text-sm font-medium">Starting camera...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
