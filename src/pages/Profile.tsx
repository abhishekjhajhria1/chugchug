import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { UserCircle, LogOut, Edit3, Save, X } from "lucide-react"
import { useChug } from "../context/ChugContext"

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

  // Edit Log State
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editLogPrivacy, setEditLogPrivacy] = useState<'public' | 'groups' | 'private' | 'hidden'>('public')
  const [editLogGroupStr, setEditLogGroupStr] = useState<string>('')
  const [savingLog, setSavingLog] = useState(false)

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditForm({
        bio: profile.bio || "",
        college: profile.college || "",
        city: profile.city || "",
        country: profile.country || "",
        stealth_mode: profile.stealth_mode || false
      })
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
      .update(editForm)
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

      const { data: actData } = await supabase
        .from("activity_logs")
        .select(`*, log_appraisals(vote_type, xp_awarded)`)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
      if (actData) setActivities(actData as any)

      const { data: grpData } = await supabase
        .from("group_members")
        .select(`groups (id, name)`)
        .eq("user_id", profile.id)

      if (grpData) {
        const gList = grpData.map(m => Array.isArray(m.groups) ? m.groups[0] : m.groups) as any as { id: string, name: string }[]
        setGroups(gList)
        if (gList.length > 0) setEditLogGroupStr(gList[0].id)
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
          <button onClick={() => setIsEditing(true)} className="cartoon-btn-secondary py-2! px-4! text-sm flex items-center gap-2">
            <Edit3 size={16} strokeWidth={3} /> Edit
          </button>
        ) : (
          <button onClick={() => setIsEditing(false)} className="cartoon-btn-secondary bg-[#FF7B9C] hover:bg-[#ff8fae] py-2! px-4! text-sm text-white flex items-center gap-2">
            <X size={16} strokeWidth={3} /> Cancel
          </button>
        )}
      </div>

      <div className="cartoon-card bg-[#A0E8AF]/30 w-full text-center py-8">
        <div className="mb-4 bg-white rounded-full h-32 w-32 mx-auto flex items-center justify-center border-[3px] border-[#3D2C24] shadow-[4px_4px_0px_#3D2C24] text-[#A0E8AF]">
          <UserCircle size={80} strokeWidth={2} />
        </div>
        <h2 className="text-3xl font-black text-[#FF7B9C] tracking-wide mb-2" style={{ textShadow: "1px 1px 0px #3D2C24" }}>
          {profile.username}
        </h2>

        {!isEditing ? (
          <div className="mt-4 px-4 space-y-2">
            {profile.bio && <p className="font-bold text-[#3D2C24] text-lg mb-4 leading-snug">"{profile.bio}"</p>}

            {(profile.college || profile.city || profile.country) && (
              <div className="flex flex-col gap-2 bg-white/50 rounded-xl p-4 border-[3px] border-[#3D2C24] text-left">
                {profile.college && <p className="font-bold text-sm text-[#3D2C24]"><span className="opacity-70 uppercase tracking-widest text-xs block">College</span> {profile.college}</p>}
                {profile.city && <p className="font-bold text-sm text-[#3D2C24]"><span className="opacity-70 uppercase tracking-widest text-xs block">City</span> {profile.city}</p>}
                {profile.country && <p className="font-bold text-sm text-[#3D2C24]"><span className="opacity-70 uppercase tracking-widest text-xs block">Country</span> {profile.country}</p>}
                {profile.stealth_mode && <p className="font-black text-sm text-[#FF7B9C] mt-2 flex items-center gap-2">🥷 Stealth Mode Active</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 px-4 space-y-4 text-left">
            <div>
              <label className="font-bold text-sm text-[#3D2C24] uppercase tracking-widest mb-1 block">Bio / Quote</label>
              <textarea
                value={editForm.bio}
                onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                className="cartoon-input w-full min-h-20"
                placeholder="Make it thirsty..."
              />
            </div>
            <div>
              <label className="font-bold text-sm text-[#3D2C24] uppercase tracking-widest mb-1 block">College</label>
              <input
                type="text"
                value={editForm.college}
                onChange={e => setEditForm({ ...editForm, college: e.target.value })}
                className="cartoon-input w-full"
                placeholder="State University"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="font-bold text-sm text-[#3D2C24] uppercase tracking-widest mb-1 block">City</label>
                <input
                  type="text"
                  value={editForm.city}
                  onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                  className="cartoon-input w-full"
                />
              </div>
              <div className="flex-1">
                <label className="font-bold text-sm text-[#3D2C24] uppercase tracking-widest mb-1 block">Country</label>
                <input
                  type="text"
                  value={editForm.country}
                  onChange={e => setEditForm({ ...editForm, country: e.target.value })}
                  className="cartoon-input w-full"
                />
              </div>
            </div>

            <div className="pt-2 border-t-2 border-[#3D2C24]/10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.stealth_mode}
                  onChange={e => setEditForm({ ...editForm, stealth_mode: e.target.checked })}
                  className="w-6 h-6 border-2 border-[#3D2C24] rounded text-[#FF7B9C] focus:ring-0"
                />
                <div>
                  <span className="font-black text-[#3D2C24]">🥷 Enable Stealth Mode</span>
                  <p className="text-xs font-bold text-[#3D2C24] opacity-70 leading-tight">Hide your public logs and party attendance. (For privacy).</p>
                </div>
              </label>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="cartoon-btn w-full mt-4 flex items-center justify-center gap-2 bg-[#FFD166]! text-[#3D2C24]"
            >
              <Save size={20} strokeWidth={3} /> {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        )}

        {!isEditing && (
          <div className="flex justify-center gap-4 mt-8">
            <div className="bg-white border-[3px] border-[#3D2C24] rounded-xl px-6 py-3 shadow-[3px_3px_0px_#3D2C24]">
              <p className="text-sm font-bold text-[#3D2C24] opacity-80 uppercase tracking-widest">Level</p>
              <p className="font-black text-2xl text-[#FFD166]">{profile.level ?? "-"}</p>
            </div>
            <div className="bg-white border-[3px] border-[#3D2C24] rounded-xl px-6 py-3 shadow-[3px_3px_0px_#3D2C24]">
              <p className="text-sm font-bold text-[#3D2C24] opacity-80 uppercase tracking-widest">Total XP</p>
              <p className="font-black text-2xl text-[#60D394]">{profile.xp ?? "-"}</p>
            </div>
          </div>
        )}
      </div>

      {/* ACTIVITY FEED */}
      {!isEditing && (
        <div className="w-full mt-6 space-y-4">
          <h3 className="text-xl font-black text-[#3D2C24]">Your Log</h3>
          {activities.length === 0 ? (
            <div className="text-center font-bold opacity-50 py-4 cartoon-card bg-gray-100 border-dashed">
              You haven't logged any activities yet.
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map(act => (
                <div key={act.id} className="cartoon-card bg-white flex flex-col p-4 relative">
                  <div className="flex justify-between items-center z-10">
                    <div>
                      <p className="font-black text-lg leading-tight text-[#3D2C24]">{act.item_name}</p>
                      <p className="text-xs font-bold uppercase tracking-widest opacity-50 mt-1">
                        {act.category} • Qty: {act.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-lg text-[#60D394]">+{act.xp_earned} XP</p>
                      <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">
                        {new Date(act.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {editingLogId === act.id ? (
                    <div className="mt-4 pt-4 border-t-2 border-[#3D2C24]/10 fade-in">
                      <label className="font-bold text-xs text-[#3D2C24] uppercase tracking-widest">Visibility</label>
                      <select
                        value={editLogPrivacy}
                        onChange={(e) => setEditLogPrivacy(e.target.value as any)}
                        className="cartoon-input w-full mt-1 text-sm py-2! mb-3"
                      >
                        <option value="public">🌍 Public (Global Feed)</option>
                        <option value="groups">👥 Groups Only</option>
                        <option value="private">🔒 Private (Just me)</option>
                        <option value="hidden">🥷 Stealth Mode</option>
                      </select>

                      {editLogPrivacy === 'groups' && groups.length > 0 && (
                        <div className="mb-3">
                          <label className="font-bold text-xs text-[#FF7B9C] uppercase tracking-widest">Post to Group</label>
                          <select
                            value={editLogGroupStr}
                            onChange={(e) => setEditLogGroupStr(e.target.value)}
                            className="cartoon-input w-full mt-1 text-sm py-2! bg-[#FF7B9C]/10 border-[#FF7B9C]"
                          >
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingLogId(null)} className="cartoon-btn-secondary text-xs! py-1! px-3! bg-white text-[#3D2C24]">Cancel</button>
                        <button onClick={() => handleEditLogSave(act.id)} disabled={savingLog} className="cartoon-btn text-xs! py-1! px-3!">{savingLog ? "..." : "Save"}</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditingLog(act)}
                      className="absolute bottom-2 right-4 text-[10px] font-black uppercase tracking-widest text-[#3D2C24] opacity-30 hover:opacity-100 transition-opacity flex items-center gap-1"
                    >
                      <Edit3 size={12} strokeWidth={3} /> Edit Visibility
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="w-full mt-8">
        <button onClick={handleLogout} className="cartoon-btn-secondary w-full text-lg py-4 border-[#FF7B9C] text-[#FF7B9C] gap-2 flex items-center justify-center">
          <LogOut size={20} strokeWidth={3} /> Sign Out
        </button>
      </div>
    </div>
  )
}