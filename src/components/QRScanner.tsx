import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { X, FlipHorizontal } from "lucide-react"

interface QRScannerProps {
  onScan: (decodedText: string) => void
  onClose: () => void
  title?: string
}

export default function QRScanner({ onScan, onClose, title = "Scan QR Code" }: QRScannerProps) {
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const html5QrCode = useRef<Html5Qrcode | null>(null)
  const isComponentMounted = useRef(true)

  useEffect(() => {
    isComponentMounted.current = true
    html5QrCode.current = new Html5Qrcode("qr-reader")
    
    return () => {
      isComponentMounted.current = false
      if (html5QrCode.current?.isScanning) {
        html5QrCode.current.stop().catch(e => console.error("Failed to stop scanner on unmount", e))
      }
      html5QrCode.current?.clear()
    }
  }, [])

  useEffect(() => {
    if (!html5QrCode.current) return
    
    const startScanner = async () => {
      try {
        if (html5QrCode.current?.isScanning) {
          await html5QrCode.current.stop()
        }
        if (!isComponentMounted.current) return;
        
        await html5QrCode.current?.start(
          { facingMode: facingMode },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => {
            if (html5QrCode.current?.isScanning) {
              html5QrCode.current.stop().then(() => {
                if (isComponentMounted.current) onScan(decodedText)
              }).catch(console.error)
            }
          },
          () => {} // Ignore constant stream of not-found errors
        )
      } catch (err) {
        console.error("Scanner failed to start", err)
      }
    }

    startScanner()
  }, [facingMode, onScan])

  const toggleCamera = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment")
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center p-4 bg-black/80 backdrop-blur-md anim-fade-in touch-none">
      <div className="bg-black/90 border border-white/10 w-full max-w-sm mx-auto rounded-[32px] overflow-hidden shadow-2xl anim-slide-up relative">
        <div className="flex justify-between items-center p-4 border-b border-white/5">
          <h3 className="font-bold text-lg text-white/90 px-2">{title}</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleCamera} 
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/90"
              title="Flip Camera"
            >
              <FlipHorizontal size={20} />
            </button>
            <button 
              onClick={onClose} 
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/70"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="p-4 bg-black/40">
          <div id="qr-reader" className="rounded-2xl overflow-hidden bg-black w-full" style={{ border: 'none', minHeight: '250px' }} />
        </div>
        
        <div className="p-4 text-center">
            <p className="text-xs text-white/50 font-bold uppercase tracking-wider">Point camera at QR code</p>
        </div>
      </div>
      
      <style>{`
        #qr-reader { border: none !important; }
        #qr-reader video { object-fit: cover !important; border-radius: 16px; }
      `}</style>
    </div>
  )
}
