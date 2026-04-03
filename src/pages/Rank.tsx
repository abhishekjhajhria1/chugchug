import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Globe, Users, MapPin, Trophy, UserPlus, Check, Clock } from "lucide-react"
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
  const [friendships, setFriendships] = useState<Record<string, string>>({})
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

        // Fetch friendships for current user to show correct button states
        const { data: fData } = await supabase
            .from('friendships')
            .select('user_1, user_2, status')
            .or(`user_1.eq.${user.id},user_2.eq.${user.id}`)
        
        if (fData) {
            const fMap: Record<string, string> = {}
            fData.forEach(f => {
                const other = f.user_1 === user.id ? f.user_2 : f.user_1
                fMap[other] = f.status
            })
            setFriendships(fMap)
        }

      } catch (error) {
        console.error("Error fetching leaders", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaders()
  }, [scope, user, profile])

  const handleAddFriend = async (targetId: string) => {
      if (!user) return
      const u1 = user.id < targetId ? user.id : targetId
      const u2 = user.id < targetId ? targetId : user.id
      
      setFriendships(prev => ({...prev, [targetId]: 'pending'}))
      await supabase.from('friendships').insert({
          user_1: u1,
          user_2: u2,
          status: 'pending',
          action_user_id: user.id
      })
  }

  return (
    <div className="space-y-6 pb-24">
      <h1 className="page-title">Leaderboard 🏆</h1>

      {/* Scope switcher */}
      <div className="flex rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)' }}>
        {([
          { id: 'global',   label: 'Global',   icon: Globe,   color: 'var(--amber)', bg: 'var(--amber-dim)' },
          { id: 'group',    label: 'Groups',   icon: Users,   color: 'var(--sage)',  bg: 'var(--sage-dim)'  },
          { id: 'regional', label: 'Local',    icon: MapPin,  color: 'var(--coral)', bg: 'var(--coral-dim)' },
        ] as const).map(({ id, label, icon: Icon, color, bg }, i, arr) => (
          <button
            key={id}
            onClick={() => setScope(id)}
            className="flex-1 py-3 font-bold text-sm transition-all flex items-center justify-center gap-1.5"
            style={{
              background: scope === id ? bg : 'transparent',
              color: scope === id ? color : 'var(--text-muted)',
              fontFamily: 'Nunito, sans-serif',
              borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <Icon size={16} strokeWidth={2} /> {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="text-center py-8 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-8 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {scope === 'regional' && !profile?.city ? "Add your City in Profile to see local ranks." : "No players found yet!"}
          </div>
        ) : (
          <div className="space-y-3">
            {leaders.map((leader, index) => {
              const isMe = leader.id === user?.id

              return (
              <div
                key={leader.id}
                className={`flex items-center justify-between p-3 rounded-xl transition-all`}
                style={{
                  background: isMe ? 'var(--amber-dim)' : 'var(--card-bg)',
                  border: isMe ? '1px solid rgba(245,166,35,0.25)' : '1px solid var(--border)',
                }}
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
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <span className="font-black text-xl neon-pink block leading-none">{leader.xp} XP</span>
                    <span className="text-xs font-bold opacity-50 uppercase tracking-widest block mt-1">Lvl {leader.level || 1}</span>
                  </div>
                  {user && user.id !== leader.id && (
                      <div className="mt-1">
                          {friendships[leader.id] === 'accepted' ? (
                              <div className="text-[10px] flex items-center gap-1 font-black uppercase tracking-widest text-emerald-400">
                                  <Check size={12}/> Friends
                              </div>
                          ) : friendships[leader.id] === 'pending' ? (
                              <div className="text-[10px] flex items-center gap-1 font-black uppercase tracking-widest text-white/50">
                                  <Clock size={12}/> Pending
                              </div>
                          ) : (
                              <button 
                                onClick={() => handleAddFriend(leader.id)}
                                className="text-[10px] flex items-center gap-1 font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20"
                              >
                                  <UserPlus size={12}/> Add
                              </button>
                          )}
                      </div>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}