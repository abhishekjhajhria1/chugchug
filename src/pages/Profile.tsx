import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { LogOut, Edit3, Save, X, Users as UsersIcon, QrCode, MapPin, ChevronDown, CalendarDays, Lock, Share2, Sun, Moon, Swords, PartyPopper } from "lucide-react"
import { useChug } from "../context/ChugContext"
import { useTheme } from "../context/ThemeContext"
import type { Theme } from "../types"
import QRCodeModal from "../components/QRCodeModal"
import NotificationToggle from "../components/NotificationToggle"
import StatShareCard from "../components/StatShareCard"
import { getRankInfo, RANK_LADDER } from "../lib/progression"
import ArchetypeQuiz, { ARCHETYPES } from "../components/ArchetypeQuiz"
import type { ArchetypeId } from "../components/ArchetypeQuiz"
import { useToast } from "../components/Toast"
import type { PrivacySettings } from "../types"

export default function Profile() {
  const { user, profile, refreshProfile } = useChug()
  const { theme, setTheme } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [showArchetypeQuiz, setShowArchetypeQuiz] = useState(false)
  const [editForm, setEditForm] = useState({ bio: "", college: "", city: "", country: "", stealth_mode: false })
  const [saving, setSaving] = useState(false)
  const [activities, setActivities] = useState<any[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [sessionFriends, setSessionFriends] = useState<any[]>([])
  const [showMyQR, setShowMyQR] = useState(false)
  const [showStatCard, setShowStatCard] = useState(false)
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({ beer_counter: 'group', location_sharing: 'off' })

  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editLogPrivacy, setEditLogPrivacy] = useState<'public' | 'groups' | 'private' | 'hidden'>('public')
  const [editLogGroupStr, setEditLogGroupStr] = useState<string>('')
  const [savingLog, setSavingLog] = useState(false)

  useEffect(() => {
    if (profile) {
      setEditForm({ bio: profile.bio || "", college: profile.college || "", city: profile.city || "", country: profile.country || "", stealth_mode: profile.stealth_mode || false })
      if (profile.privacy_settings) setPrivacySettings(profile.privacy_settings)
    }
  }, [profile])

  const handleLogout = async () => { await supabase.auth.signOut() }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase.from("profiles").update({ ...editForm, privacy_settings: privacySettings }).eq("id", profile.id)
    setSaving(false)
    if (error) {
      toast.error("Error saving: " + error.message)
    } else {
      setIsEditing(false)
      refreshProfile().catch(console.error)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return
      const [{ data: actData }, { data: grpData }] = await Promise.all([
        supabase.from("activity_logs").select(`*, log_appraisals(vote_type, appraiser_id)`).eq("user_id", profile.id).order("created_at", { ascending: false }),
        supabase.from("group_members").select(`groups (id, name)`).eq("user_id", profile.id)
      ])
      if (actData) setActivities(actData as any)
      if (grpData) {
        const gList = grpData.map(m => Array.isArray(m.groups) ? m.groups[0] : m.groups) as any as { id: string; name: string }[]
        setGroups(gList)
        if (gList.length > 0) setEditLogGroupStr(gList[0].id)
      }
      const { data: sfData } = await supabase.from('session_friends').select(`*, user_a_profile:user_a(username), user_b_profile:user_b(username)`).or(`user_a.eq.${profile.id},user_b.eq.${profile.id}`).eq('active', true)
      if (sfData) setSessionFriends(sfData)
    }
    if (!isEditing) fetchData()
  }, [profile, isEditing])

  const handleEditLogSave = async (id: string) => {
    setSavingLog(true)
    const { error } = await supabase.from('activity_logs').update({ privacy_level: editLogPrivacy, group_id: editLogPrivacy === 'groups' ? (editLogGroupStr || null) : null }).eq('id', id)
    if (!error) {
      setActivities(activities.map(a => a.id === id ? { ...a, privacy_level: editLogPrivacy, group_id: editLogPrivacy === 'groups' ? (editLogGroupStr || null) : null } : a))
      setEditingLogId(null)
    } else toast.error("Failed: " + error.message)
    setSavingLog(false)
  }

  const p = profile || { id: user?.id || '', username: user?.email?.split('@')[0] || 'Traveler', level: 1, xp: 0, bio: '', city: '', country: '', stealth_mode: false, privacy_settings: {}, archetype: undefined }

  const catColors: Record<string, string> = {
    drink: 'var(--amber)', snack: 'var(--coral)', cigarette: 'var(--sage)',
    gym: 'var(--indigo)', detox: 'var(--sage)', other: 'var(--text-muted)'
  }
  const catEmoji: Record<string, string> = {
    drink: '🍻', snack: '🍟', cigarette: '🚬', gym: '💪', detox: '🧘', other: '📝'
  }

  const levelColor = (p.level || 1) >= 25 ? 'var(--acid)' : (p.level || 1) >= 10 ? 'var(--amber)' : 'var(--coral)'
  const ri = getRankInfo(p.level ?? 1, p.xp ?? 0)

  return (
    <div className="space-y-5 pb-24 wano-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">Profile</h1>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="glass-btn-secondary flex items-center gap-2 text-sm" style={{ padding: '8px 16px' }}>
            <Edit3 size={15} /> Edit
          </button>
        ) : (
          <button onClick={() => setIsEditing(false)} className="glass-btn-secondary flex items-center gap-2 text-sm" style={{ padding: '8px 16px', borderColor: 'color-mix(in srgb, var(--coral) 30%, transparent)', color: 'var(--coral)' }}>
            <X size={15} /> Cancel
          </button>
        )}
      </div>

      {/* ── Identity card ── */}
      <div className="glass-card text-center" style={{ padding: 22 }}>
        <div className="flex justify-center mb-3">
          <div className="relative">
            <div className="absolute -inset-2" style={{ border: `1.5px dashed ${levelColor}`, borderRadius: '50%', opacity: 0.22, animation: 'spin 14s linear infinite' }} />
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-extrabold relative"
              style={{ background: 'var(--glass-fill-inset)', border: `3px solid ${levelColor}`, color: levelColor, fontFamily: 'Syne, sans-serif' }}
            >
              {p.username?.[0]?.toUpperCase() || '?'}
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold" style={{ background: levelColor, color: '#fff', border: '2px solid var(--card-bg)' }}>
                {p.level ?? 1}
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-extrabold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{p.username}</h2>
        <p className="text-sm font-bold mb-2" style={{ color: ri.current.color }}>{ri.current.emoji} {ri.current.title}</p>

        {/* Archetype */}
        {p.archetype && ARCHETYPES[p.archetype as ArchetypeId] ? (
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: `${ARCHETYPES[p.archetype as ArchetypeId].color}1A`, color: ARCHETYPES[p.archetype as ArchetypeId].color }}>
              {ARCHETYPES[p.archetype as ArchetypeId].emoji} The {ARCHETYPES[p.archetype as ArchetypeId].title}
            </span>
            <button onClick={() => setShowArchetypeQuiz(true)} className="text-[11px] font-semibold" style={{ color: 'var(--text-ghost)' }}>Retake</button>
          </div>
        ) : !isEditing && (
          <button onClick={() => setShowArchetypeQuiz(true)} className="text-xs font-bold mb-2 px-3 py-1.5 rounded-full active:scale-95 transition-transform" style={{ background: 'rgba(155,89,182,0.12)', color: '#9B59B6' }}>
            🎭 Discover your archetype
          </button>
        )}

        {showArchetypeQuiz && (
          <ArchetypeQuiz onComplete={() => setShowArchetypeQuiz(false)} onSkip={() => setShowArchetypeQuiz(false)} />
        )}

        {p.bio && !isEditing && <p className="text-sm mb-2.5" style={{ color: 'var(--text-secondary)' }}>{p.bio}</p>}
        {(p.city || p.country) && !isEditing && (
          <p className="text-xs font-medium mb-2 flex items-center justify-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <MapPin size={11} /> {[p.city, p.country].filter(Boolean).join(', ')}
          </p>
        )}

        {/* Stats */}
        {!isEditing && (
          <div className="grid grid-cols-3 gap-2.5 mt-4">
            {[
              { label: 'Level', value: p.level ?? 1, color: levelColor },
              { label: 'Total XP', value: (p.xp ?? 0).toLocaleString(), color: 'var(--amber)' },
              { label: 'Logs', value: activities.length, color: 'var(--coral)' },
            ].map(stat => (
              <div key={stat.label} className="py-3 rounded-xl" style={{ background: 'var(--glass-fill-inset)' }}>
                <p className="text-xl font-extrabold" style={{ color: stat.color, fontFamily: 'Syne, sans-serif' }}>{stat.value}</p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Appearance (Light / Dark) ── */}
        {!isEditing && (
          <div className="mt-5 text-left">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Appearance</p>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl" style={{ background: 'var(--glass-fill-inset)' }}>
              {([
                { id: 'light' as Theme, label: 'Light', Icon: Sun },
                { id: 'dark' as Theme, label: 'Dark', Icon: Moon },
              ]).map(({ id, label, Icon }) => {
                const active = theme === id
                return (
                  <button
                    key={id}
                    onClick={() => setTheme(id)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                    style={{ background: active ? 'var(--card-bg)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: active ? 'var(--card-shadow)' : 'none' }}
                  >
                    <Icon size={16} /> {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        {!isEditing && (
          <div className="mt-4 space-y-2.5">
            <button onClick={() => navigate('/calendar')} className="glass-btn-secondary w-full py-3 flex items-center justify-center gap-2 text-sm">
              <CalendarDays size={18} style={{ color: 'var(--acid)' }} /> Drinking calendar
            </button>
            <button onClick={() => setShowMyQR(true)} className="glass-btn-secondary w-full py-3 flex items-center justify-center gap-2 text-sm">
              <QrCode size={18} style={{ color: 'var(--amber)' }} /> My QR code
            </button>

            <NotificationToggle />

            <button onClick={() => navigate('/party', { state: { view: 'create' } })} className="w-full py-3.5 flex items-center justify-center gap-2 text-sm font-bold active:scale-[0.99] transition-transform rounded-xl" style={{ background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid color-mix(in srgb, var(--coral) 28%, transparent)' }}>
              <PartyPopper size={18} /> Host a party
            </button>

            <button onClick={() => setShowStatCard(true)} className="glass-btn w-full py-3 flex items-center justify-center gap-2 text-sm">
              <Share2 size={18} /> Share my stats
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => navigate('/tavern')} className="py-3 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform rounded-xl" style={{ background: 'var(--glass-fill-inset)', color: 'var(--text-secondary)' }}>
                🍸 Taverns
              </button>
              <button onClick={() => navigate('/challenges')} className="py-3 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform rounded-xl" style={{ background: 'var(--glass-fill-inset)', color: 'var(--text-secondary)' }}>
                <Swords size={15} /> Challenges
              </button>
            </div>

            {sessionFriends.length > 0 && (
              <div className="rounded-xl p-3 text-left" style={{ background: 'var(--glass-fill-inset)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <UsersIcon size={14} style={{ color: 'var(--coral)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Active session friends</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sessionFriends.map((sf: any) => {
                    const name = sf.user_a === p.id ? sf.user_b_profile?.username : sf.user_a_profile?.username
                    return (
                      <div key={sf.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--acid)' }} />
                        {name}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Rank journey */}
            <div className="rounded-xl p-4 text-left" style={{ background: 'var(--glass-fill-inset)' }}>
              <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>Rank journey</p>
              <div className="space-y-1.5">
                {RANK_LADDER.map((rank) => {
                  const userLevel = p.level ?? 1
                  const isCurrentRank = userLevel >= rank.minLevel && userLevel <= rank.maxLevel
                  const isUnlocked = userLevel >= rank.minLevel
                  return (
                    <div key={rank.title} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: isCurrentRank ? `${rank.color}14` : 'transparent', opacity: isUnlocked ? 1 : 0.45 }}>
                      <span className="text-lg w-7 text-center">{rank.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold" style={{ color: isCurrentRank ? rank.color : isUnlocked ? 'var(--text-primary)' : 'var(--text-ghost)' }}>{rank.title}</span>
                          <span className="text-[11px] font-medium" style={{ color: 'var(--text-ghost)' }}>Lv {rank.minLevel}{rank.maxLevel < 999 ? `–${rank.maxLevel}` : '+'}</span>
                        </div>
                        {isCurrentRank && ri.next && (
                          <div className="h-1.5 mt-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-surface)' }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ri.progressPercent}%`, background: rank.color }} />
                          </div>
                        )}
                      </div>
                      {isCurrentRank && <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: `${rank.color}22`, color: rank.color }}>YOU</span>}
                      {!isUnlocked && <Lock size={13} style={{ color: 'var(--text-ghost)' }} />}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Edit form */}
        {isEditing && (
          <div className="mt-4 space-y-4 text-left">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Bio</label>
              <textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} className="glass-input min-h-[72px]" placeholder="Say something about yourself…" style={{ resize: 'vertical' }} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>College / university</label>
              <input type="text" value={editForm.college} onChange={e => setEditForm({ ...editForm, college: e.target.value })} className="glass-input" placeholder="State University" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>City</label>
                <input type="text" value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} className="glass-input" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Country</label>
                <input type="text" value={editForm.country} onChange={e => setEditForm({ ...editForm, country: e.target.value })} className="glass-input" />
              </div>
            </div>

            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--glass-fill-inset)' }}>
              <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Privacy</p>
              {[
                { key: 'beer_counter', label: 'Beer counter', options: [['public', 'Public'], ['group', 'Group only'], ['private', 'Private']] },
                { key: 'location_sharing', label: 'Location sharing', options: [['always', 'Always'], ['sessions', 'Active sessions'], ['off', 'Off']] },
              ].map(({ key, label, options }) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <div className="relative">
                    <select
                      value={privacySettings[key as keyof PrivacySettings]}
                      onChange={e => setPrivacySettings({ ...privacySettings, [key]: e.target.value })}
                      className="appearance-none text-sm font-semibold pr-7 pl-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}
                    >
                      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))}
              <label className="flex items-center gap-3 cursor-pointer pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                <input type="checkbox" checked={editForm.stealth_mode} onChange={e => setEditForm({ ...editForm, stealth_mode: e.target.checked })} className="w-5 h-5 rounded" style={{ accentColor: 'var(--coral)' }} />
                <div>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>🥷 Stealth mode</span>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hide your stats from public feeds</p>
                </div>
              </label>
            </div>

            <button onClick={handleSave} disabled={saving} className="glass-btn w-full flex items-center justify-center gap-2">
              <Save size={18} /> {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        )}
      </div>

      <QRCodeModal isOpen={showMyQR} onClose={() => setShowMyQR(false)} mode="display" personalId={p.id} />
      {showStatCard && <StatShareCard onClose={() => setShowStatCard(false)} />}

      {/* ── Activity log ── */}
      {!isEditing && (
        <div>
          <h2 className="text-lg font-extrabold mb-3" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>Activity</h2>
          {activities.length === 0 ? (
            <div className="glass-card text-center py-8">
              <p className="font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Nothing logged yet</p>
              <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>Log your first activity to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map(act => (
                <div key={act.id} className="glass-card" style={{ padding: 16, borderLeft: `4px solid ${catColors[act.category] || 'var(--border)'}` }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${catColors[act.category] || 'var(--text-muted)'}1A` }}>
                        {catEmoji[act.category] || '📝'}
                      </div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{act.item_name}</p>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{act.category} · qty {act.quantity}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold" style={{ color: 'var(--acid)' }}>+{act.xp_earned} XP</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-ghost)' }}>{new Date(act.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {editingLogId === act.id ? (
                    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="relative">
                        <select value={editLogPrivacy} onChange={e => setEditLogPrivacy(e.target.value as any)} className="glass-input text-sm appearance-none pr-8">
                          <option value="public">🌍 Public</option>
                          <option value="groups">👥 Groups only</option>
                          <option value="private">🔒 Private</option>
                          <option value="hidden">🥷 Stealth</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                      </div>
                      {editLogPrivacy === 'groups' && groups.length > 0 && (
                        <div className="relative">
                          <select value={editLogGroupStr} onChange={e => setEditLogGroupStr(e.target.value)} className="glass-input text-sm appearance-none pr-8">
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => setEditingLogId(null)} className="glass-btn-secondary flex-1 py-2 text-xs">Cancel</button>
                        <button onClick={() => handleEditLogSave(act.id)} disabled={savingLog} className="glass-btn flex-1 py-2 text-xs">{savingLog ? "…" : "Save"}</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditLogPrivacy(act.privacy_level || 'public'); setEditLogGroupStr(act.group_id || (groups[0]?.id || '')); setEditingLogId(act.id) }}
                      className="mt-2 text-xs font-semibold flex items-center gap-1"
                      style={{ color: 'var(--text-ghost)' }}
                    >
                      <Edit3 size={11} /> Edit visibility
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sign out */}
      <button onClick={handleLogout} className="glass-btn-secondary w-full py-4 flex items-center justify-center gap-2 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--coral) 30%, transparent)', color: 'var(--coral)' }}>
        <LogOut size={18} /> Sign out
      </button>
    </div>
  )
}
