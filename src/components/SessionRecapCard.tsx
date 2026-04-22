import { useRef, useState, useEffect, useCallback } from "react"
import { Download, Share2, X } from "lucide-react"

interface ParticipantSummary {
  userId: string
  username: string
  count: number
}

interface SessionRecapCardProps {
  participants: ParticipantSummary[]
  sessionDate: Date
  elapsedMinutes: number
  currentUserStreak: number
  currentUserRank: string
  currentUserRankEmoji: string
  onClose: () => void
}

export default function SessionRecapCard({
  participants,
  sessionDate,
  elapsedMinutes,
  currentUserStreak,
  currentUserRank,
  currentUserRankEmoji,
  onClose,
}: SessionRecapCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [mode, setMode] = useState<'full' | 'sticker'>('full')

  const totalDrinks = participants.reduce((sum, p) => sum + p.count, 0)
  const mvp = participants.length > 0 ? participants.reduce((a, b) => a.count > b.count ? a : b) : null
  const crewSize = participants.length

  const dateStr = sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const durationStr = elapsedMinutes < 60
    ? `${elapsedMinutes}m`
    : `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`

  const renderCard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const W = 1080
    const H = mode === 'full' ? 1920 : 540
    canvas.width = W
    canvas.height = H

    const ctx = canvas.getContext('2d')!

    if (mode === 'full') {
      // ── Full Card Mode ──
      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, W, H)
      bgGrad.addColorStop(0, '#0D0A06')
      bgGrad.addColorStop(0.4, '#1A1208')
      bgGrad.addColorStop(1, '#0D0604')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, W, H)

      // Decorative border
      ctx.strokeStyle = 'rgba(216,162,94,0.3)'
      ctx.lineWidth = 4
      ctx.strokeRect(40, 40, W - 80, H - 80)

      // Inner border
      ctx.strokeStyle = 'rgba(216,162,94,0.12)'
      ctx.lineWidth = 1
      ctx.strokeRect(60, 60, W - 120, H - 120)

      // Top section — Branding
      ctx.fillStyle = 'rgba(216,162,94,0.9)'
      ctx.font = 'bold 28px "Inter", "Segoe UI", system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('⛩️  CHUGCHUG', W / 2, 140)

      ctx.fillStyle = 'rgba(216,162,94,0.4)'
      ctx.font = '600 16px "Inter", "Segoe UI", system-ui, sans-serif'
      ctx.letterSpacing = '6px'
      ctx.fillText('SESSION RECAP', W / 2, 175)

      // Decorative line
      ctx.strokeStyle = 'rgba(216,162,94,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(200, 210)
      ctx.lineTo(W - 200, 210)
      ctx.stroke()

      // Date
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '500 32px "Inter", "Segoe UI", system-ui, sans-serif'
      ctx.fillText(dateStr, W / 2, 300)

      // Main stats — big numbers
      const statsY = 480
      const statBlockWidth = W / 3

      // Duration
      drawStatBlock(ctx, statBlockWidth * 0.5, statsY, '⏱️', durationStr, 'Duration')
      // Total drinks
      drawStatBlock(ctx, statBlockWidth * 1.5, statsY, '🍻', `${totalDrinks}`, 'Total Drinks')
      // Crew
      drawStatBlock(ctx, statBlockWidth * 2.5, statsY, '👥', `${crewSize}`, 'People')

      // Decorative line
      ctx.strokeStyle = 'rgba(216,162,94,0.15)'
      ctx.beginPath()
      ctx.moveTo(100, 620)
      ctx.lineTo(W - 100, 620)
      ctx.stroke()

      // MVP section
      if (mvp && crewSize > 1) {
        ctx.fillStyle = 'rgba(216,162,94,0.9)'
        ctx.font = 'bold 20px "Inter", "Segoe UI", system-ui, sans-serif'
        ctx.fillText('🏆 MVP', W / 2, 700)

        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.font = 'bold 48px "Inter", "Segoe UI", system-ui, sans-serif'
        ctx.fillText(`@${mvp.username}`, W / 2, 760)

        ctx.fillStyle = 'rgba(216,162,94,0.7)'
        ctx.font = '600 28px "Inter", "Segoe UI", system-ui, sans-serif'
        ctx.fillText(`${mvp.count} drinks`, W / 2, 810)
      }

      // Participants leaderboard
      const lbStartY = mvp && crewSize > 1 ? 900 : 700
      if (crewSize > 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.font = 'bold 16px "Inter", "Segoe UI", system-ui, sans-serif'
        ctx.fillText('FINAL SCORES', W / 2, lbStartY)

        participants.forEach((p, i) => {
          const y = lbStartY + 50 + i * 55
          if (y > H - 300) return

          // Rank number
          ctx.textAlign = 'left'
          ctx.fillStyle = i === 0 ? 'rgba(216,162,94,0.9)' : 'rgba(255,255,255,0.5)'
          ctx.font = `bold 24px "Inter", "Segoe UI", system-ui, sans-serif`
          ctx.fillText(`#${i + 1}`, 180, y)

          // Username
          ctx.fillStyle = 'rgba(255,255,255,0.85)'
          ctx.font = `600 24px "Inter", "Segoe UI", system-ui, sans-serif`
          ctx.fillText(p.username, 250, y)

          // Count
          ctx.textAlign = 'right'
          ctx.fillStyle = 'rgba(216,162,94,0.8)'
          ctx.font = `bold 24px "Inter", "Segoe UI", system-ui, sans-serif`
          ctx.fillText(`${p.count} 🍺`, W - 180, y)

          ctx.textAlign = 'center'
        })
      }

      // Bottom section — user stats
      const bottomY = H - 200

      // Streak + Rank bar
      const barGrad = ctx.createLinearGradient(0, bottomY - 30, 0, bottomY + 80)
      barGrad.addColorStop(0, 'rgba(216,162,94,0.08)')
      barGrad.addColorStop(1, 'rgba(209,32,32,0.04)')
      ctx.fillStyle = barGrad
      roundRect(ctx, 80, bottomY - 30, W - 160, 110, 12)
      ctx.fill()

      ctx.strokeStyle = 'rgba(216,162,94,0.2)'
      ctx.lineWidth = 1
      roundRect(ctx, 80, bottomY - 30, W - 160, 110, 12)
      ctx.stroke()

      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = 'bold 28px "Inter", "Segoe UI", system-ui, sans-serif'
      ctx.fillText(`🔥 Day ${currentUserStreak}`, 120, bottomY + 20)

      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(216,162,94,0.9)'
      ctx.font = 'bold 28px "Inter", "Segoe UI", system-ui, sans-serif'
      ctx.fillText(`${currentUserRankEmoji} ${currentUserRank}`, W - 120, bottomY + 20)

      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.font = '500 14px "Inter", "Segoe UI", system-ui, sans-serif'
      ctx.fillText(`${currentUserRankEmoji} ${currentUserRank} · Streak: ${currentUserStreak} days`, W / 2, bottomY + 60)

      // Footer
      ctx.fillStyle = 'rgba(216,162,94,0.35)'
      ctx.font = '600 14px "Inter", "Segoe UI", system-ui, sans-serif'
      ctx.fillText('@chugchug.app', W / 2, H - 80)

    } else {
      // ── Sticker Mode — transparent stats bar ──
      ctx.clearRect(0, 0, W, H)

      // Semi-transparent background
      const stickerGrad = ctx.createLinearGradient(0, 0, W, H)
      stickerGrad.addColorStop(0, 'rgba(13,10,6,0.85)')
      stickerGrad.addColorStop(1, 'rgba(13,6,4,0.85)')
      roundRect(ctx, 20, 20, W - 40, H - 40, 24)
      ctx.fillStyle = stickerGrad
      ctx.fill()

      ctx.strokeStyle = 'rgba(216,162,94,0.4)'
      ctx.lineWidth = 2
      roundRect(ctx, 20, 20, W - 40, H - 40, 24)
      ctx.stroke()

      // Branding line
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(216,162,94,0.9)'
      ctx.font = 'bold 28px "Inter", "Segoe UI", system-ui, sans-serif'
      ctx.fillText('⛩️ CHUGCHUG', 60, 85)

      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '500 22px "Inter", "Segoe UI", system-ui, sans-serif'
      ctx.fillText(dateStr, W - 60, 85)

      // Stats row
      ctx.textAlign = 'center'
      const sW = (W - 80) / 4
      const sY = 200

      drawMiniStat(ctx, 40 + sW * 0.5, sY, '🍻', `${totalDrinks}`, 'drinks')
      drawMiniStat(ctx, 40 + sW * 1.5, sY, '👥', `${crewSize}`, 'people')
      drawMiniStat(ctx, 40 + sW * 2.5, sY, '🔥', `Day ${currentUserStreak}`, 'streak')
      drawMiniStat(ctx, 40 + sW * 3.5, sY, '⏱️', durationStr, 'duration')

      // Rank + MVP bar
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(216,162,94,0.7)'
      ctx.font = 'bold 22px "Inter", "Segoe UI", system-ui, sans-serif'
      ctx.fillText(`${currentUserRankEmoji} ${currentUserRank}`, 60, 340)

      if (mvp && crewSize > 1) {
        ctx.textAlign = 'right'
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = '500 22px "Inter", "Segoe UI", system-ui, sans-serif'
        ctx.fillText(`🏆 MVP: @${mvp.username} (${mvp.count})`, W - 60, 340)
      }

      // Footer
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(216,162,94,0.3)'
      ctx.font = '500 16px "Inter", "Segoe UI", system-ui, sans-serif'
      ctx.fillText('@chugchug.app', W / 2, H - 50)
    }

    setImageUrl(canvas.toDataURL('image/png'))
  }, [mode, participants, dateStr, durationStr, totalDrinks, crewSize, mvp, currentUserStreak, currentUserRank, currentUserRankEmoji])

  useEffect(() => {
    renderCard()
  }, [renderCard])

  const handleDownload = () => {
    if (!imageUrl) return
    const link = document.createElement('a')
    link.download = `chugchug-session-${sessionDate.toISOString().split('T')[0]}.png`
    link.href = imageUrl
    link.click()
  }

  const handleShare = async () => {
    if (!canvasRef.current) return
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], 'chugchug-recap.png', { type: 'image/png' })
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: 'ChugChug Session Recap',
            text: `${totalDrinks} drinks with ${crewSize} people 🍻`,
            files: [file],
          })
        } else {
          handleDownload()
        }
      }, 'image/png')
    } catch {
      handleDownload()
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center p-4 anim-fade" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}>
      {/* Close */}
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full z-20" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
        <X size={18} />
      </button>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        {(['full', 'sticker'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-[4px]"
            style={{
              background: mode === m ? 'var(--amber-dim)' : 'var(--bg-deep)',
              border: mode === m ? '1px solid rgba(216,162,94,0.4)' : '1px solid var(--border-mid)',
              color: mode === m ? 'var(--amber)' : 'var(--text-muted)',
            }}
          >
            {m === 'full' ? '📱 Full Card' : '🏷️ Sticker'}
          </button>
        ))}
      </div>

      {/* Canvas render (hidden) */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Preview */}
      {imageUrl && (
        <div className="w-full max-w-xs anim-enter">
          <img
            src={imageUrl}
            alt="Session Recap"
            className="w-full rounded-lg shadow-2xl"
            style={{ border: '1px solid rgba(216,162,94,0.2)' }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mt-5 w-full max-w-xs">
        <button
          onClick={handleDownload}
          className="flex-1 py-3.5 rounded-[4px] flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
          style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-mid)' }}
        >
          <Download size={16} /> Save
        </button>
        <button
          onClick={handleShare}
          className="flex-1 py-3.5 rounded-[4px] flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, var(--amber), #E8880A)', color: '#1A1208' }}
        >
          <Share2 size={16} /> Share
        </button>
      </div>

      <button onClick={onClose} className="mt-4 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
        Skip
      </button>
    </div>
  )
}

// ── Helper: draw stat block for full card ──
function drawStatBlock(ctx: CanvasRenderingContext2D, x: number, y: number, emoji: string, value: string, label: string) {
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `bold 56px "Inter", "Segoe UI", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(value, x, y)

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = `600 18px "Inter", "Segoe UI", system-ui, sans-serif`
  ctx.fillText(`${emoji} ${label}`, x, y + 35)
}

// ── Helper: draw mini stat for sticker mode ──
function drawMiniStat(ctx: CanvasRenderingContext2D, x: number, y: number, emoji: string, value: string, label: string) {
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `bold 36px "Inter", "Segoe UI", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(value, x, y)

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = `500 14px "Inter", "Segoe UI", system-ui, sans-serif`
  ctx.fillText(`${emoji} ${label}`, x, y + 28)
}

// ── Helper: rounded rect path ──
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
