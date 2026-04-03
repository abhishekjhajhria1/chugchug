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

    let html5QrCode: any;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          (decodedText: string) => {
            if (decodedText && onScanResult) {
              onScanResult(decodedText);
              html5QrCode.stop().then(() => onClose()).catch(console.error);
            }
          }, 
          () => { /* Ignore decode errors as they happen constantly on blank frames */ }
        );
        setScanning(true)
      } catch (err: any) {
        setScanError(err.message || "Could not access camera")
      }
    }

    // Small delay to ensure the DOM element exists
    const timer = setTimeout(() => startScanner(), 100);

    return () => {
      clearTimeout(timer);
      if (html5QrCode?.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    }
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
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center" style={{ border: '2px solid var(--glass-edge)' }}>
                <div id="qr-reader" className="w-full h-full [&_video]:object-cover" />
                {!scanning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{ background: 'rgba(0,0,0,0.50)' }}>
                    <div className="text-center">
                      <Camera size={32} className="mx-auto mb-2 accent-violet animate-pulse" />
                      <p className="text-sm font-medium text-white">Starting camera...</p>
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
