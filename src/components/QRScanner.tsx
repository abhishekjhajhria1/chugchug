import { useEffect, useRef } from "react"
import { Html5QrcodeScanner } from "html5-qrcode"
import { X } from "lucide-react"

interface QRScannerProps {
  onScan: (decodedText: string) => void
  onClose: () => void
  title?: string
}

export default function QRScanner({ onScan, onClose, title = "Scan QR Code" }: QRScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scannerRef.current) return

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      false
    )

    let scanning = true
    scanner.render(
      (decodedText) => {
        if (scanning) {
          scanning = false
          scanner.clear()
          onScan(decodedText)
        }
      },
      () => {
        // Ignore constant stream of not-found errors
      }
    )

    return () => {
      scanning = false
      scanner.clear().catch(e => console.error("Failed to clear scanner", e))
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center p-4 bg-black/80 backdrop-blur-md anim-fade-in touch-none">
      <div className="bg-black/90 border border-white/10 w-full max-w-sm mx-auto rounded-[32px] overflow-hidden shadow-2xl anim-slide-up relative">
        <div className="flex justify-between items-center p-4 border-b border-white/5">
          <h3 className="font-bold text-lg text-white/90 px-2">{title}</h3>
          <button 
            onClick={onClose} 
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/70"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 bg-black/40">
          <div id="qr-reader" ref={scannerRef} className="rounded-2xl overflow-hidden bg-black w-full" style={{ border: 'none' }} />
        </div>
      </div>
      
      {/* Scope CSS to fix html5-qrcode's ugly default buttons */}
      <style>{`
        #qr-reader { border: none !important; }
        #qr-reader__scan_region { background: #000 !important; }
        #qr-reader__dashboard_section_csr button {
            background: rgba(255,255,255,0.1);
            color: white;
            border: 1px solid rgba(255,255,255,0.2);
            padding: 8px 16px;
            border-radius: 12px;
            font-weight: bold;
            font-family: inherit;
            margin-top: 10px;
        }
        #qr-reader__dashboard_section_swaplink { color: rgba(255,255,255,0.5); text-decoration: none; margin-top: 10px; display: inline-block; }
      `}</style>
    </div>
  )
}
