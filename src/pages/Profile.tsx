import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { LogOut, Edit3, Save, X, Users as UsersIcon, QrCode, MapPin, ChevronDown } from "lucide-react"
import { useChug } from "../context/ChugContext"
import QRCodeModal from "../components/QRCodeModal"

export default function Profile() {
  const { user, profile, refreshProfile } = useChug()
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ bio: "", college: "", city: "", country: "", stealth_mode: false })
  const [saving, setSaving] = useState(false)
  const [activities, setActivities] = useState<any[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [sessionFriends, setSessionFriends] = useState<any[]>([])
  const [showMyQR, setShowMyQR] = useState(false)
  const [privacySettings, setPrivacySettings] = useState<any>({ beer_counter: 'group', location_sharing: 'off' })

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
      alert("Error saving: " + error.message)
    } else {
      setIsEditing(false)
      // Refresh in background — don't block the UI
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
    } else alert("Failed: " + error.message)
    setSavingLog(false)
  }

  const p = profile || { id: user?.id || '', username: user?.email?.split('@')[0] || 'Traveler', level: 1, xp: 0, bio: '', city: '', country: '', stealth_mode: false, privacy_settings: {} }

  const catColors: Record<string, string> = {
    drink: 'var(--amber)', snack: 'var(--coral)', cigarette: 'var(--sage)',
    gym: 'var(--indigo)', detox: 'var(--sage)', other: 'var(--text-muted)'
  }
  const catEmoji: Record<string, string> = {
    drink: '🍻', snack: '🍟', cigarette: '🚬', gym: '💪', detox: '🧘', other: '📝'
  }

  const levelColor = (p.level || 1) >= 25 ? 'var(--acid)' : (p.level || 1) >= 10 ? 'var(--amber)' : 'var(--coral)'

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">My Profile</h1>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="glass-btn-secondary flex items-center gap-2 text-sm" style={{ padding: '8px 16px' }}>
            <Edit3 size={15} /> Edit
          </button>
        ) : (
          <button onClick={() => setIsEditing(false)} className="glass-btn-secondary flex items-center gap-2 text-sm" style={{ padding: '8px 16px', borderColor: 'rgba(229,83,75,0.3)', color: 'var(--danger)' }}>
            <X size={15} /> Cancel
          </button>
        )}
      </div>

      {/* ── Profile Card ── */}
      <div className="glass-card text-center">
        {/* Avatar */}
        <div className="flex justify-center mb-3">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black relative"
            style={{
              background: 'var(--bg-raised)',
              border: `3px solid ${levelColor}`,
              boxShadow: `0 0 20px ${levelColor}40`,
              color: levelColor,
              fontFamily: 'Syne, sans-serif',
            }}
          >
            {p.username?.[0]?.toUpperCase() || '?'}
            {/* Level badge */}
            <div
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
              style={{ background: levelColor, color: '#1A1208', border: '2px solid var(--bg-deep)' }}
            >
              {p.level ?? 1}
            </div>
          </div>
        </div>

        <h2 className="text-xl font-black mb-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
          {p.username}
        </h2>

        {p.bio && !isEditing && (
          <p className="text-sm font-medium mb-3 italic" style={{ color: 'var(--text-secondary)' }}>"{p.bio}"</p>
        )}

        {(p.city || p.country) && !isEditing && (
          <p className="text-xs font-medium mb-3 flex items-center justify-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <MapPin size={11} /> {[p.city, p.country].filter(Boolean).join(', ')}
          </p>
        )}

        {/* Stats row */}
        {!isEditing && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Level', value: p.level ?? 1, color: levelColor },
              { label: 'Total XP', value: p.xp ?? 0, color: 'var(--amber)' },
              { label: 'Logs', value: activities.length, color: 'var(--coral)' },
            ].map(stat => (
              <div key={stat.label} className="rounded-sm py-3" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                <p className="text-xl font-black" style={{ color: stat.color, fontFamily: 'Syne, sans-serif' }}>{stat.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* QR button */}
        {!isEditing && (
          <div className="mt-4 space-y-3">
            <button onClick={() => setShowMyQR(true)} className="glass-btn-secondary w-full py-3 flex items-center justify-center gap-2 text-sm" style={{ borderColor: 'rgba(245,166,35,0.25)', color: 'var(--amber)' }}>
              <QrCode size={18} /> My Connection QR
            </button>
            {sessionFriends.length > 0 && (
              <div className="rounded-sm p-3 text-left" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <UsersIcon size={14} style={{ color: 'var(--coral)' }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Active Session Friends</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sessionFriends.map((sf: any) => {
                    const name = sf.user_a === p.id ? sf.user_b_profile?.username : sf.user_a_profile?.username
                    return (
                      <div key={sf.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid rgba(244,132,95,0.2)' }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        {name}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit form */}
        {isEditing && (
          <div className="mt-4 space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Bio</label>
              <textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} className="glass-input min-h-[72px]" placeholder="Say something interesting..." style={{ resize: 'vertical' }} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>College / University</label>
              <input type="text" value={editForm.college} onChange={e => setEditForm({ ...editForm, college: e.target.value })} className="glass-input" placeholder="State University" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>City</label>
                <input type="text" value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} className="glass-input" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Country</label>
                <input type="text" value={editForm.country} onChange={e => setEditForm({ ...editForm, country: e.target.value })} className="glass-input" />
              </div>
            </div>

            {/* Privacy settings */}
            <div className="rounded-sm p-4 space-y-3" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Privacy Settings</p>
              {[
                { key: 'beer_counter', label: 'Beer Counter', options: [['public','Public'],['group','Group Only'],['private','Private']] },
                { key: 'location_sharing', label: 'Location Sharing', options: [['always','Always'],['sessions','Active Sessions'],['off','Off']] },
              ].map(({ key, label, options }) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <div className="relative">
                    <select
                      value={privacySettings[key]}
                      onChange={e => setPrivacySettings({ ...privacySettings, [key]: e.target.value })}
                      className="appearance-none text-xs font-bold pr-6 pl-3 py-1.5 rounded-lg"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}
                    >
                      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))}
              <label className="flex items-center gap-3 cursor-pointer pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                <input type="checkbox" checked={editForm.stealth_mode} onChange={e => setEditForm({ ...editForm, stealth_mode: e.target.checked })} className="w-5 h-5 rounded" style={{ accentColor: 'var(--coral)' }} />
                <div>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>🥷 Stealth Mode</span>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hide your stats from public feeds</p>
                </div>
              </label>
            </div>

            <button onClick={handleSave} disabled={saving} className="glass-btn w-full flex items-center justify-center gap-2">
              <Save size={18} /> {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        )}
      </div>

      <QRCodeModal isOpen={showMyQR} onClose={() => setShowMyQR(false)} mode="display" personalId={p.id} />

      {/* ── Activity Log ── */}
      {!isEditing && (
        <div>
          <h2 className="font-black text-lg mb-3" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
            Your Activity Log
          </h2>
          {activities.length === 0 ? (
            <div className="glass-card text-center py-8" style={{ borderStyle: 'dashed' }}>
              <p className="font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nothing logged yet!</p>
              <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>Start by logging your first activity.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map(act => (
                <div key={act.id} className="glass-card" style={{ padding: 16 }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-sm flex items-center justify-center text-lg"
                        style={{ background: `${catColors[act.category] || 'var(--text-muted)'}18`, border: `1px solid ${catColors[act.category] || 'var(--border)'}30` }}
                      >
                        {catEmoji[act.category] || '📝'}
                      </div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{act.item_name}</p>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                          {act.category} · qty {act.quantity}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black" style={{ color: 'var(--sage)' }}>+{act.xp_earned} XP</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>
                        {new Date(act.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Inline log edit */}
                  {editingLogId === act.id ? (
                    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="relative">
                        <select value={editLogPrivacy} onChange={e => setEditLogPrivacy(e.target.value as any)} className="glass-input text-sm appearance-none pr-8">
                          <option value="public">🌍 Public</option>
                          <option value="groups">👥 Groups Only</option>
                          <option value="private">🔒 Private</option>
                          <option value="hidden">🥷 Stealth</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                      </div>
                      {editLogPrivacy === 'groups' && groups.length > 0 && (
                        <div className="relative">
                          <select value={editLogGroupStr} onChange={e => setEditLogGroupStr(e.target.value)} className="glass-input text-sm appearance-none pr-8" style={{ borderColor: 'rgba(244,132,95,0.3)' }}>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => setEditingLogId(null)} className="glass-btn-secondary flex-1 py-2 text-xs">Cancel</button>
                        <button onClick={() => handleEditLogSave(act.id)} disabled={savingLog} className="glass-btn flex-1 py-2 text-xs">{savingLog ? "..." : "Save"}</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditLogPrivacy(act.privacy_level || 'public'); setEditLogGroupStr(act.group_id || (groups[0]?.id || '')); setEditingLogId(act.id) }}
                      className="mt-2 text-[10px] font-bold flex items-center gap-1 transition-colors"
                      style={{ color: 'var(--text-ghost)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-ghost)')}
                    >
                      <Edit3 size={10} /> Edit Visibility
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sign out */}
      <button
        onClick={handleLogout}
        className="glass-btn-secondary w-full py-4 flex items-center justify-center gap-2 text-sm"
        style={{ borderColor: 'rgba(229,83,75,0.25)', color: 'var(--danger)' }}
      >
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  )
}