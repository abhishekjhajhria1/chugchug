import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Globe, Users, MapPin, Trophy } from "lucide-react"
import { useChug } from "../context/ChugContext"
import { Link } from "react-router-dom"

interface Leader {
  id: string
  username: string
  xp: number
  level: number
  city?: string
}

export default function Rank() {
  const { user, profile } = useChug()
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [scope, setScope] = useState<'global' | 'group' | 'regional'>('global')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaders = async () => {
      setLoading(true)
      if (!user) return

      try {
        if (scope === 'global') {
          const { data } = await supabase
            .from("profiles")
            .select("id, username, xp, level, city")
            .order("xp", { ascending: false })
            .limit(50)

          if (data) setLeaders(data as Leader[])
        }
        else if (scope === 'group') {
          const { data: userGroups } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", user.id)

          if (userGroups && userGroups.length > 0) {
            const groupIds = userGroups.map(g => g.group_id)
            const { data: groupMembers } = await supabase
              .from("group_members")
              .select("user_id")
              .in("group_id", groupIds)

            if (groupMembers) {
              const userIds = [...new Set(groupMembers.map(m => m.user_id))]
              const { data } = await supabase
                .from("profiles")
                .select("id, username, xp, level, city")
                .in("id", userIds)
                .order("xp", { ascending: false })

              if (data) setLeaders(data as Leader[])
            }
          } else {
            setLeaders([]) // No groups
          }
        }
        else if (scope === 'regional') {
          if (!profile?.city) {
            setLeaders([])
          } else {
            const { data } = await supabase
              .from("profiles")
              .select("id, username, xp, level, city")
              .ilike("city", profile.city)
              .order("xp", { ascending: false })
              .limit(50)

            if (data) setLeaders(data as Leader[])
          }
        }
      } catch (error) {
        console.error("Error fetching leaders", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaders()
  }, [scope, user, profile])

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black text-white/90">Leaderboard</h1>
      </div>

      <div className="flex bg-white/5 rounded-xl border border-white/15 overflow-hidden shadow-lg shadow-black/20 mb-6">
        <button
          onClick={() => setScope('global')}
          className={`flex-1 py-3 font-black text-sm transition-colors flex items-center justify-center gap-2 ${scope === 'global' ? 'bg-amber-400/30 text-white/90' : 'text-white/90/50'}`}
        >
          <Globe size={18} strokeWidth={2} /> Global
        </button>
        <div className="w-0.75 bg-[#3D2C24]" />
        <button
          onClick={() => setScope('group')}
          className={`flex-1 py-3 font-black text-sm transition-colors flex items-center justify-center gap-2 ${scope === 'group' ? 'bg-green-300/20 text-white/90' : 'text-white/90/50'}`}
        >
          <Users size={18} strokeWidth={2} /> Group
        </button>
        <div className="w-0.75 bg-[#3D2C24]" />
        <button
          onClick={() => setScope('regional')}
          className={`flex-1 py-3 font-black text-sm transition-colors flex items-center justify-center gap-2 ${scope === 'regional' ? 'bg-pink-500/30 text-white' : 'text-white/90/50'}`}
        >
          <MapPin size={18} strokeWidth={2} /> Local
        </button>
      </div>

      <div className="bg-amber-400/30/20 p-4 rounded-3xl border border-amber-400/30">
        {loading ? (
          <div className="text-center font-bold opacity-50 py-8">Loading ranks...</div>
        ) : leaders.length === 0 ? (
          <div className="text-center font-bold opacity-50 py-8">
            {scope === 'regional' && !profile?.city ? "Update your profile with a City to see local ranks." : "No players found."}
          </div>
        ) : (
          <div className="space-y-4">
            {leaders.map((leader, index) => (
              <div
                key={leader.id}
                className={`flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/15 shadow-lg shadow-black/20 ${leader.id === user?.id ? 'ring-4 ring-[#FF7B9C]/50' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg border border-white/15 shadow-lg shadow-black/20 ${index === 0 ? 'bg-amber-400/30' : index === 1 ? 'bg-gray-300' : index === 2 ? 'bg-amber-600/30' : 'bg-green-300/20'}`}>
                    {index === 0 ? <Trophy size={20} strokeWidth={2} /> : `#${index + 1}`}
                  </div>
                  <div>
                    <Link to={`/profile/${leader.id}`} className="font-bold text-lg block leading-tight hover:neon-pink transition-colors">
                      {leader.username}
                    </Link>
                    {scope === 'regional' && leader.city && <span className="text-xs font-bold opacity-50">{leader.city}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-black text-xl neon-pink block leading-none">{leader.xp} XP</span>
                  <span className="text-xs font-bold opacity-50 uppercase tracking-widest block mt-1">Lvl {leader.level || 1}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}