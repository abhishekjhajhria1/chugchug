import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ChugChug Error Boundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex items-center justify-center p-6" style={{ background: 'var(--bg-deep, #050505)' }}>
          <div className="max-w-sm w-full text-center space-y-6">
            <div className="text-7xl mb-2">💀</div>
            <h1 className="text-2xl font-black uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: '#D8A25E' }}>
              Something Broke
            </h1>
            <p className="text-sm font-bold leading-relaxed" style={{ color: 'color-mix(in srgb, var(--text-primary) 50%, transparent)' }}>
              The crew hit an iceberg. Don't worry — your data is safe.
            </p>
            <div className="p-3 rounded-[var(--card-radius)] text-left text-xs font-mono overflow-auto max-h-32" style={{ background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)', color: 'rgba(255,107,107,0.8)' }}>
              {this.state.error?.message || 'Unknown error'}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-[var(--card-radius)] font-black text-sm uppercase tracking-widest transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg, #D12020, #D8A25E)', color: '#FFFFFF' }}
            >
              Reload App
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
