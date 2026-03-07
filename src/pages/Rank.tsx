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
        <h1 className="text-3xl font-black text-[#3D2C24]">Leaderboard</h1>
      </div>

      <div className="flex bg-white rounded-xl border-[3px] border-[#3D2C24] overflow-hidden shadow-[4px_4px_0px_#3D2C24] mb-6">
        <button
          onClick={() => setScope('global')}
          className={`flex-1 py-3 font-black text-sm transition-colors flex items-center justify-center gap-2 ${scope === 'global' ? 'bg-[#FFD166] text-[#3D2C24]' : 'text-[#3D2C24]/50'}`}
        >
          <Globe size={18} strokeWidth={3} /> Global
        </button>
        <div className="w-0.75 bg-[#3D2C24]" />
        <button
          onClick={() => setScope('group')}
          className={`flex-1 py-3 font-black text-sm transition-colors flex items-center justify-center gap-2 ${scope === 'group' ? 'bg-[#A0E8AF] text-[#3D2C24]' : 'text-[#3D2C24]/50'}`}
        >
          <Users size={18} strokeWidth={3} /> Group
        </button>
        <div className="w-0.75 bg-[#3D2C24]" />
        <button
          onClick={() => setScope('regional')}
          className={`flex-1 py-3 font-black text-sm transition-colors flex items-center justify-center gap-2 ${scope === 'regional' ? 'bg-[#FF7B9C] text-white' : 'text-[#3D2C24]/50'}`}
        >
          <MapPin size={18} strokeWidth={3} /> Local
        </button>
      </div>

      <div className="bg-[#FFD166]/20 p-4 rounded-3xl border-[3px] border-[#FFD166]">
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
                className={`flex items-center justify-between bg-white rounded-xl p-4 border-[3px] border-[#3D2C24] shadow-[4px_4px_0px_#3D2C24] ${leader.id === user?.id ? 'ring-4 ring-[#FF7B9C]/50' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg border-2 border-[#3D2C24] shadow-[2px_2px_0px_#3D2C24] ${index === 0 ? 'bg-[#FFD166]' : index === 1 ? 'bg-gray-300' : index === 2 ? 'bg-[#cd7f32]' : 'bg-[#A0E8AF]'}`}>
                    {index === 0 ? <Trophy size={20} strokeWidth={3} /> : `#${index + 1}`}
                  </div>
                  <div>
                    <Link to={`/profile/${leader.id}`} className="font-bold text-lg block leading-tight hover:text-[#FF7B9C] transition-colors">
                      {leader.username}
                    </Link>
                    {scope === 'regional' && leader.city && <span className="text-xs font-bold opacity-50">{leader.city}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-black text-xl text-[#FF7B9C] block leading-none">{leader.xp} XP</span>
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