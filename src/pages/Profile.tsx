import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { UserCircle, LogOut, Edit3, Save, X, Users as UsersIcon, QrCode } from "lucide-react"
import { useChug } from "../context/ChugContext"
import QRCodeModal from "../components/QRCodeModal"

export default function Profile() {
  const { profile, refreshProfile } = useChug()
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    bio: "",
    college: "",
    city: "",
    country: "",
    stealth_mode: false
  })
  const [saving, setSaving] = useState(false)
  const [activities, setActivities] = useState<{ id: string, item_name: string, category: string, quantity: number, xp_earned: number, created_at: string, privacy_level: string, group_id: string | null }[]>([])
  const [groups, setGroups] = useState<{ id: string, name: string }[]>([])
  const [sessionFriends, setSessionFriends] = useState<any[]>([])
  const [showMyQR, setShowMyQR] = useState(false)
  const [privacySettings, setPrivacySettings] = useState<any>({
    beer_counter: 'group',
    location_sharing: 'off',
    photo_metadata: 'show'
  })

  // Edit Log State
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editLogPrivacy, setEditLogPrivacy] = useState<'public' | 'groups' | 'private' | 'hidden'>('public')
  const [editLogGroupStr, setEditLogGroupStr] = useState<string>('')
  const [savingLog, setSavingLog] = useState(false)

  useEffect(() => {
    if (profile) {
      setEditForm({
        bio: profile.bio || "",
        college: profile.college || "",
        city: profile.city || "",
        country: profile.country || "",
        stealth_mode: profile.stealth_mode || false
      })
      if (profile.privacy_settings) {
          setPrivacySettings(profile.privacy_settings)
      }
    }
  }, [profile, isEditing])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)

    const { error } = await supabase
      .from("profiles")
      .update({
          ...editForm,
          privacy_settings: privacySettings
      })
      .eq("id", profile.id)

    if (error) {
      alert("Error saving profile: " + error.message)
    } else {
      await refreshProfile()
      setIsEditing(false)
    }
    setSaving(false)
  }

  useEffect(() => {
    const fetchActivitiesAndGroups = async () => {
      if (!profile) return

      const [
        { data: actData },
        { data: grpData }
      ] = await Promise.all([
        supabase
          .from("activity_logs")
          .select(`*, log_appraisals(vote_type, xp_awarded)`)
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("group_members")
          .select(`groups (id, name)`)
          .eq("user_id", profile.id)
      ])

      if (actData) setActivities(actData as any)

      if (grpData) {
        const gList = grpData.map(m => Array.isArray(m.groups) ? m.groups[0] : m.groups) as any as { id: string, name: string }[]
        setGroups(gList)
        if (gList.length > 0) setEditLogGroupStr(gList[0].id)
      }

      // Fetch session friends
      const { data: sfData } = await supabase
        .from('session_friends')
        .select(`*, user_a_profile:user_a(username), user_b_profile:user_b(username)`)
        .or(`user_a.eq.${profile.id},user_b.eq.${profile.id}`)
        .eq('active', true)
      
      if (sfData) {
          setSessionFriends(sfData)
      }
    }

    if (!isEditing) fetchActivitiesAndGroups()
  }, [profile, isEditing])

  const handleEditLogSave = async (id: string) => {
    setSavingLog(true)
    const { error } = await supabase
      .from('activity_logs')
      .update({
        privacy_level: editLogPrivacy,
        group_id: editLogPrivacy === 'groups' ? (editLogGroupStr || null) : null
      })
      .eq('id', id)

    if (!error) {
      // Optimistically update
      setActivities(activities.map(a => a.id === id ? { ...a, privacy_level: editLogPrivacy, group_id: editLogPrivacy === 'groups' ? (editLogGroupStr || null) : null } : a))
      setEditingLogId(null)
    } else {
      alert("Failed to update log: " + error.message)
    }
    setSavingLog(false)
  }

  const startEditingLog = (log: any) => {
    setEditLogPrivacy(log.privacy_level as any || 'public')
    setEditLogGroupStr(log.group_id || (groups.length > 0 ? groups[0].id : ''))
    setEditingLogId(log.id)
  }

  if (!profile) return <div className="p-8 text-center font-bold">Loading Profile...</div>

  return (
    <div className="space-y-6 flex flex-col items-center pb-24">
      <div className="flex w-full justify-between items-center mb-2">
        <h1 className="text-3xl font-black text-left">Profile</h1>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="glass-btn-secondary py-2! px-4! text-sm flex items-center gap-2">
            <Edit3 size={16} strokeWidth={2} /> Edit
          </button>
        ) : (
          <button onClick={() => setIsEditing(false)} className="glass-btn-secondary bg-pink-500/30 hover:bg-[#ff8fae] py-2! px-4! text-sm text-white flex items-center gap-2">
            <X size={16} strokeWidth={2} /> Cancel
          </button>
        )}
      </div>

      <div className="glass-card bg-green-300/20/30 w-full text-center py-8">
        <div className="mb-4 bg-white/5 rounded-full h-32 w-32 mx-auto flex items-center justify-center border border-white/15 shadow-lg shadow-black/20 neon-lime">
          <UserCircle size={80} strokeWidth={2} />
        </div>
        <h2 className="text-3xl font-black neon-pink tracking-wide mb-2" style={{ textShadow: "1px 1px 0px #3D2C24" }}>
          {profile.username}
        </h2>

        {!isEditing ? (
          <div className="mt-4 px-4 space-y-2">
            {profile.bio && <p className="font-bold text-white/90 text-lg mb-4 leading-snug">"{profile.bio}"</p>}

            {(profile.college || profile.city || profile.country) && (
              <div className="flex flex-col gap-2 bg-white/50 rounded-xl p-4 border border-white/15 text-left">
                {profile.college && <p className="font-bold text-sm text-white/90"><span className="opacity-70 uppercase tracking-widest text-xs block">College</span> {profile.college}</p>}
                {profile.city && <p className="font-bold text-sm text-white/90"><span className="opacity-70 uppercase tracking-widest text-xs block">City</span> {profile.city}</p>}
                {profile.country && <p className="font-bold text-sm text-white/90"><span className="opacity-70 uppercase tracking-widest text-xs block">Country</span> {profile.country}</p>}
                {profile.stealth_mode && <p className="font-black text-sm neon-pink mt-2 flex items-center gap-2">🥷 Stealth Mode Active</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 px-4 space-y-4 text-left">
            <div>
              <label className="font-bold text-sm text-white/90 uppercase tracking-widest mb-1 block">Bio / Quote</label>
              <textarea
                value={editForm.bio}
                onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                className="glass-input w-full min-h-20"
                placeholder="Make it thirsty..."
              />
            </div>
            <div>
              <label className="font-bold text-sm text-white/90 uppercase tracking-widest mb-1 block">College</label>
              <input
                type="text"
                value={editForm.college}
                onChange={e => setEditForm({ ...editForm, college: e.target.value })}
                className="glass-input w-full"
                placeholder="State University"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="font-bold text-sm text-white/90 uppercase tracking-widest mb-1 block">City</label>
                <input
                  type="text"
                  value={editForm.city}
                  onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                  className="glass-input w-full"
                />
              </div>
              <div className="flex-1">
                <label className="font-bold text-sm text-white/90 uppercase tracking-widest mb-1 block">Country</label>
                <input
                  type="text"
                  value={editForm.country}
                  onChange={e => setEditForm({ ...editForm, country: e.target.value })}
                  className="glass-input w-full"
                />
              </div>
            </div>

            <div className="pt-4 border-t-2 border-white/15/10 space-y-4">
              <label className="font-bold text-xs text-white/90 uppercase tracking-widest mb-2 block">Privacy Overrides</label>
              
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10">
                <span className="text-sm font-bold">Beer Counter</span>
                <select 
                    value={privacySettings.beer_counter} 
                    onChange={e => setPrivacySettings({...privacySettings, beer_counter: e.target.value})}
                    className="bg-transparent text-sm font-black focus:outline-none"
                >
                    <option value="public">Public</option>
                    <option value="group">Group</option>
                    <option value="private">Private</option>
                </select>
              </div>

              <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10">
                <span className="text-sm font-bold">Location Sharing</span>
                <select 
                    value={privacySettings.location_sharing} 
                    onChange={e => setPrivacySettings({...privacySettings, location_sharing: e.target.value})}
                    className="bg-transparent text-sm font-black focus:outline-none"
                >
                    <option value="always">Always</option>
                    <option value="sessions">Active Sessions</option>
                    <option value="off">Off</option>
                </select>
              </div>

              <label className="flex items-center gap-3 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={editForm.stealth_mode}
                  onChange={e => setEditForm({ ...editForm, stealth_mode: e.target.checked })}
                  className="w-6 h-6 border border-white/15 rounded neon-pink focus:ring-0"
                />
                <div>
                  <span className="font-black text-white/90">🥷 Enable Stealth Mode</span>
                  <p className="text-xs font-bold text-white/90 opacity-70 leading-tight">Globally hide your activity stats from all public feeds.</p>
                </div>
              </label>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="glass-btn w-full mt-4 flex items-center justify-center gap-2 bg-amber-400/30! text-white/90"
            >
              <Save size={20} strokeWidth={2} /> {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        )}

        {!isEditing && (
          <div className="flex flex-col gap-6 w-full px-4">
            <div className="flex justify-center gap-4 mt-8">
              <div className="bg-white/5 border border-white/15 rounded-xl px-6 py-3 shadow-lg shadow-black/20 text-center flex-1">
                <p className="text-sm font-bold text-white/90 opacity-80 uppercase tracking-widest">Level</p>
                <p className="font-black text-2xl neon-amber">{profile.level ?? "-"}</p>
              </div>
              <div className="bg-white/5 border border-white/15 rounded-xl px-6 py-3 shadow-lg shadow-black/20 text-center flex-1">
                <p className="text-sm font-bold text-white/90 opacity-80 uppercase tracking-widest">Total XP</p>
                <p className="font-black text-2xl neon-lime">{profile.xp ?? "-"}</p>
              </div>
            </div>

            <button 
                onClick={() => setShowMyQR(true)}
                className="glass-btn-secondary w-full py-4! border-amber-400/30 flex items-center justify-center gap-3 text-amber-200"
            >
                <QrCode size={20} /> My Connection QR
            </button>

            {/* Session Friends List */}
            {sessionFriends.length > 0 && (
                <div className="glass-card bg-white/5 border-pink-500/20 p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <UsersIcon size={18} className="text-pink-400" />
                        <h3 className="text-sm font-black uppercase tracking-wider">Active Session Friends</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {sessionFriends.map((sf: any) => {
                            const friendName = sf.user_a === profile.id ? sf.user_b_profile?.username : sf.user_a_profile?.username
                            return (
                                <div key={sf.id} className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                    {friendName}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
          </div>
        )}
      </div>

      <QRCodeModal 
        isOpen={showMyQR} 
        onClose={() => setShowMyQR(false)} 
        mode="display"
        personalId={profile.id}
      />

      {/* ACTIVITY FEED */}
      {!isEditing && (
        <div className="w-full mt-6 space-y-4">
          <h3 className="text-xl font-black text-white/90">Your Log</h3>
          {activities.length === 0 ? (
            <div className="text-center font-bold opacity-50 py-4 glass-card bg-white/5 border-dashed">
              You haven't logged any activities yet.
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map(act => (
                <div key={act.id} className="glass-card bg-white/5 flex flex-col p-4 relative">
                  <div className="flex justify-between items-center z-10">
                    <div>
                      <p className="font-black text-lg leading-tight text-white/90">{act.item_name}</p>
                      <p className="text-xs font-bold uppercase tracking-widest opacity-50 mt-1">
                        {act.category} • Qty: {act.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-lg neon-lime">+{act.xp_earned} XP</p>
                      <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">
                        {new Date(act.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {editingLogId === act.id ? (
                    <div className="mt-4 pt-4 border-t-2 border-white/15/10 animate-fadeInScale">
                      <label className="font-bold text-xs text-white/90 uppercase tracking-widest">Visibility</label>
                      <select
                        value={editLogPrivacy}
                        onChange={(e) => setEditLogPrivacy(e.target.value as any)}
                        className="glass-input w-full mt-1 text-sm py-2! mb-3"
                      >
                        <option value="public">🌍 Public (Global Feed)</option>
                        <option value="groups">👥 Groups Only</option>
                        <option value="private">🔒 Private (Just me)</option>
                        <option value="hidden">🥷 Stealth Mode</option>
                      </select>

                      {editLogPrivacy === 'groups' && groups.length > 0 && (
                        <div className="mb-3">
                          <label className="font-bold text-xs neon-pink uppercase tracking-widest">Post to Group</label>
                          <select
                            value={editLogGroupStr}
                            onChange={(e) => setEditLogGroupStr(e.target.value)}
                            className="glass-input w-full mt-1 text-sm py-2! bg-pink-500/30/10 border-pink-500/30"
                          >
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingLogId(null)} className="glass-btn-secondary text-xs! py-1! px-3! bg-white/5 text-white/90">Cancel</button>
                        <button onClick={() => handleEditLogSave(act.id)} disabled={savingLog} className="glass-btn text-xs! py-1! px-3!">{savingLog ? "..." : "Save"}</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditingLog(act)}
                      className="absolute bottom-2 right-4 text-[10px] font-black uppercase tracking-widest text-white/90 opacity-30 hover:opacity-100 transition-opacity flex items-center gap-1"
                    >
                      <Edit3 size={12} strokeWidth={2} /> Edit Visibility
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="w-full mt-8">
        <button onClick={handleLogout} className="glass-btn-secondary w-full text-lg py-4 border-pink-500/30 neon-pink gap-2 flex items-center justify-center">
          <LogOut size={20} strokeWidth={2} /> Sign Out
        </button>
      </div>
    </div>
  )
}