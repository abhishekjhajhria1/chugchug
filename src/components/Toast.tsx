// ─── Toast Notification System ───────────────────────────────────
// Lightweight toast system — replaces all alert() calls.

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react"

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idCounter = useRef(0)

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++idCounter.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  const success = useCallback((msg: string) => addToast(msg, 'success'), [addToast])
  const error = useCallback((msg: string) => addToast(msg, 'error'), [addToast])
  const info = useCallback((msg: string) => addToast(msg, 'info'), [addToast])

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      {/* Toast container */}
      <div
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
          width: '90%',
          maxWidth: 400,
        }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            style={{
              pointerEvents: 'auto',
              padding: '12px 16px',
              borderRadius: 8,
              fontFamily: 'Syne, Inter, system-ui, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.4,
              cursor: 'pointer',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              animation: 'toastSlideIn 0.3s ease-out',
              ...(toast.type === 'success' ? {
                background: 'rgba(204,255,0,0.12)',
                border: '1px solid rgba(204,255,0,0.25)',
                color: 'var(--acid, #CCFF00)',
              } : toast.type === 'error' ? {
                background: 'rgba(209,32,32,0.12)',
                border: '1px solid rgba(209,32,32,0.3)',
                color: 'var(--coral, #FF6B6B)',
              } : {
                background: 'rgba(216,162,94,0.12)',
                border: '1px solid rgba(216,162,94,0.25)',
                color: 'var(--amber, #D8A25E)',
              }),
            }}
          >
            {toast.type === 'success' ? '✓ ' : toast.type === 'error' ? '✗ ' : 'ℹ '}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
