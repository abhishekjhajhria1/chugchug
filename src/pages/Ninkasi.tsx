import { useNavigate } from "react-router-dom"
import NinkasiChat from "../components/NinkasiChat"

export default function Ninkasi() {
  const navigate = useNavigate()
  return (
    <div
      className="overflow-hidden -mx-1"
      style={{
        height: 'calc(100dvh - var(--header-height, 60px) - var(--bottom-nav-height, 72px) - 24px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--card-radius)',
        background: 'var(--bg-deep)',
      }}
    >
      <NinkasiChat onBack={() => navigate('/')} />
    </div>
  )
}
