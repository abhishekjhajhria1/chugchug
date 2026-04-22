import { useState, useEffect, useRef, useMemo } from "react";
import {
  Loader2, BookOpen, ArrowRight, Swords, Skull, Beer, LogIn,
  ChevronLeft, ChevronRight, Flame, Zap
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useChug } from "../context/ChugContext";
import { useNavigate } from "react-router-dom";
import { getRankInfo, getDailyBounties, checkDailyBountyCompletion } from "../lib/progression";
import type { BountyDef } from "../lib/progression";
import ArchetypeQuiz, { ARCHETYPES } from "../components/ArchetypeQuiz";
import type { ArchetypeId } from "../components/ArchetypeQuiz";

interface RankUser { id: string; username: string; xp: number }
interface Badge { id: string; name: string; icon_text: string }
interface Recipe { id: string; item_name: string; category: string; xp_earned: number }

export default function Home() {
  const { user, profile } = useChug();
  const navigate = useNavigate();

  const [ranks, setRanks] = useState<RankUser[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showArchetypeQuiz, setShowArchetypeQuiz] = useState(false);

  // Daily Bounties
  const [dailyBounties, setDailyBounties] = useState<BountyDef[]>([]);
  const [bountyProgress, setBountyProgress] = useState<Record<string, { completed: boolean; current: number; target: number }>>({});

  const [chatPrompt, setChatPrompt] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [referencedRecipes, setReferencedRecipes] = useState<string[]>([]);
  const [chatError, setChatError] = useState("");
  const responseRef = useRef<HTMLDivElement>(null);
  const BARTENDER_API = import.meta.env.VITE_BARTENDER_API?.trim() || "";

  // --- MONTHLY CALENDAR STATE ---
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [monthLogs, setMonthLogs] = useState<Map<string, { drinks: number; categories: string[] }>>(new Map());

  // --- SESSION STATE ---
  const [activeSession, setActiveSession] = useState<{ id: string; join_code: string } | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [sessionCreating, setSessionCreating] = useState(false);

  // 🌸 Ninkasi's Quick Memos
  const quickPrompts = [
    { label: "🍶 Sake", prompt: "Ninkasi, recommend a legendary Sake!" },
    { label: "🌸 Soju", prompt: "What should I mix with Soju?" },
    { label: "🍵 Matcha", prompt: "Any green tea alcohol mixes?" },
    { label: "🎌 Feast", prompt: "I am feasting, what should I drink?" },
  ];

  const handleChatSend = async (prompt?: string) => {
    const finalPrompt = prompt || chatPrompt;
    if (!finalPrompt.trim()) return;
    if (!BARTENDER_API) {
      setChatError("Ninkasi is currently meditating. Configure VITE_BARTENDER_API!");
      return;
    }
    setChatLoading(true);
    setChatReply("");
    setChatError("");
    setReferencedRecipes([]);
    try {
      const body: any = {
        prompt: finalPrompt,
        mode: "recipe",
      };
      if (profile) {
        body.user_context = {
          user_id: profile.id,
          username: profile.username,
          level: profile.level,
          xp: profile.xp,
          city: profile.city || null,
          country: profile.country || null,
        };
      }
      const res = await fetch(`${BARTENDER_API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setChatReply(data.response || data.reply || "I've run out of sake. Try asking differently!");
      if (data.referenced_recipes) setReferencedRecipes(data.referenced_recipes);
      setChatPrompt("");
    } catch {
      setChatError("Ninkasi's ravens failed to return with a message. Try again later!");
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        return;
      }
      try {
        const [rankRes, badgeRes, recipeRes] = await Promise.allSettled([
          supabase.from("profiles").select("id, username, xp").order("xp", { ascending: false }).limit(5),
          supabase.from("user_badges").select("badges ( id, name, icon_text )").eq("user_id", user.id),
          supabase.from("activity_logs").select("id, item_name, category, xp_earned, photo_metadata")
            .in("category", ["snack", "drink"]).order("xp_earned", { ascending: false }).limit(20),
        ]);

        if (rankRes.status === 'fulfilled' && rankRes.value.data) setRanks(rankRes.value.data as RankUser[]);
        if (badgeRes.status === 'fulfilled' && badgeRes.value.data) setBadges(badgeRes.value.data.flatMap((b: any) => b.badges).filter(Boolean) as Badge[]);

        if (recipeRes.status === 'fulfilled' && recipeRes.value.data) {
          const uniq: Recipe[] = [];
          const names = new Set<string>();
          for (const r of recipeRes.value.data) {
            if (r.photo_metadata?.is_recipe && !names.has(r.item_name)) {
              names.add(r.item_name);
              uniq.push(r as Recipe);
            }
          }
          setRecipes(uniq.slice(0, 5));
        }

        if (profile && profile.level <= 1 && profile.xp === 0 && !localStorage.getItem('chugchug_onboarded')) {
          setShowOnboarding(true);
        }
      } catch (e) {
        console.error("Home feed fetch error bounds hit:", e);
      }
    };
    fetchData();
  }, [user, profile]);

  // Fetch daily bounties and their completion status
  useEffect(() => {
    if (!user) return;
    setDailyBounties(getDailyBounties());
    const fetchBountyProgress = async () => {
      const progress = await checkDailyBountyCompletion(user.id);
      setBountyProgress(progress);
    };
    fetchBountyProgress();
  }, [user]);

  // Fetch month's logs for calendar
  useEffect(() => {
    if (!user) return;
    const fetchMonthLogs = async () => {
      const start = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      const end = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}T23:59:59`;

      const { data } = await supabase
        .from('activity_logs')
        .select('category, quantity, created_at')
        .eq('user_id', user.id)
        .gte('created_at', start)
        .lte('created_at', end);

      if (data) {
        const map = new Map<string, { drinks: number; categories: string[] }>();
        for (const row of data) {
          const key = row.created_at.split('T')[0];
          if (!map.has(key)) map.set(key, { drinks: 0, categories: [] });
          const day = map.get(key)!;
          if (row.category === 'drink') day.drinks += row.quantity;
          if (!day.categories.includes(row.category)) day.categories.push(row.category);
        }
        setMonthLogs(map);
      }
    };
    fetchMonthLogs();
  }, [user, calMonth, calYear]);

  // Check for active session
  useEffect(() => {
    if (!user) return;
    const checkActiveSession = async () => {
      const { data } = await supabase
        .from('drinking_sessions')
        .select('id, join_code')
        .eq('creator_id', user.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      if (data) setActiveSession(data);
    };
    checkActiveSession();
  }, [user]);

  const generateJoinCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleStartSession = async () => {
    if (!user) return;
    setSessionCreating(true);
    const code = generateJoinCode();
    const { data, error } = await supabase.from('drinking_sessions').insert({
      creator_id: user.id,
      join_code: code,
      status: 'active',
    }).select('id, join_code').single();
    if (data && !error) {
      await supabase.from('session_participants').insert({ session_id: data.id, user_id: user.id });
      navigate(`/session/${data.id}`);
    } else {
      alert('Failed to create session');
    }
    setSessionCreating(false);
  };

  const handleJoinSession = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code || code.length < 4) return alert('Enter a valid join code');
    const { data } = await supabase
      .from('drinking_sessions')
      .select('id')
      .eq('join_code', code)
      .eq('status', 'active')
      .single();
    if (data) {
      navigate(`/session/${data.id}`);
    } else {
      alert('No active session found with this code');
    }
  };

  const xpForNextLevel = (profile?.level || 1) * 100;
  const xpProgress = Math.min(((profile?.xp || 0) % xpForNextLevel) / xpForNextLevel * 100, 100);

  // Monthly calendar computed values
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const CAT_EMOJI: Record<string, string> = { drink: '🍻', snack: '🍟', cigarette: '🚬', gym: '💪', detox: '🧘', water: '💧' };

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = (() => { const d = new Date(calYear, calMonth, 1).getDay(); return d === 0 ? 6 : d - 1; })();
  const todayStr = new Date().toISOString().split('T')[0];

  // Build month grid cells
  const monthGridCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calYear, calMonth, firstDayOfWeek, daysInMonth]);

  // Week stats (this week)
  const weekStats = useMemo(() => {
    const today = new Date();
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    let drinks = 0, dryDays = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      if (key > todayStr) break;
      const log = monthLogs.get(key);
      if (log && log.drinks > 0) drinks += log.drinks;
      else dryDays++;
    }
    return { drinks, dryDays };
  }, [monthLogs, todayStr]);

  // Dry streak (calculated from this month's data going backwards from today)
  const currentDryStreak = useMemo(() => {
    let streak = 0;
    const d = new Date();
    while (true) {
      const key = d.toISOString().split('T')[0];
      const log = monthLogs.get(key);
      if (log && log.drinks > 0) break;
      streak++;
      d.setDate(d.getDate() - 1);
      // Don't go before the month
      if (d.getMonth() !== calMonth || d.getFullYear() !== calYear) break;
    }
    return streak;
  }, [monthLogs, calMonth, calYear]);

  const monthDrinks = useMemo(() => {
    let total = 0;
    monthLogs.forEach(v => total += v.drinks);
    return total;
  }, [monthLogs]);

  const handleCalPrev = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const handleCalNext = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const quickActions = [
    { label: "Log Drink", to: "/log", color: 'var(--acid)', bg: 'var(--acid-dim)', emoji: "✍️" },
    { label: "My Crew", to: "/groups", color: 'var(--amber)', bg: 'var(--amber-dim)', emoji: "👥" },
    { label: "Taverns", to: "/party", color: 'var(--coral)', bg: 'var(--coral-dim)', emoji: "🏯" },
    { label: "Challenges", to: "/challenges", color: 'var(--coral)', bg: 'var(--coral-dim)', emoji: "🎯" },
    { label: "Explore", to: "/world", color: 'var(--acid)', bg: 'var(--acid-dim)', emoji: "🗺️" },
    { label: "Shogun Rank", to: "/rank", color: 'var(--amber)', bg: 'var(--amber-dim)', emoji: "👑" },
  ];

  return (
    <div className="space-y-6 pb-6 wano-fade">

      {/* Archetype Quiz Modal */}
      {showArchetypeQuiz && (
        <ArchetypeQuiz
          onComplete={() => setShowArchetypeQuiz(false)}
          onSkip={() => setShowArchetypeQuiz(false)}
        />
      )}

      {/* ─── ONBOARDING INTRO (new users only) ─── */}
      {showOnboarding && (
        <div
          className="p-6 space-y-4 anim-pop relative overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgba(216,162,94,0.12), rgba(209,32,32,0.06), rgba(124,154,116,0.05))',
            border: '2px solid rgba(216,162,94,0.3)',
            borderRadius: '4px',
          }}
        >
          <button
            onClick={() => { localStorage.setItem('chugchug_onboarded', '1'); setShowOnboarding(false); }}
            className="absolute top-3 right-3 text-xs px-2 py-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)' }}
          >
            Skip ✕
          </button>

          <div className="text-center pt-2">
            <div className="text-6xl mb-3 drop-shadow-xl">🌸</div>
            <h1 className="text-2xl mb-2 tracking-wide" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, color: 'var(--amber)' }}>
              Welcome to Wano!
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Your legendary drinking companion. Track your sake, compete with rival crews,
              and conquer the Grand Line.
            </p>
          </div>

          <div className="space-y-2.5 mt-2">
            {[
              { emoji: "📜", title: "Log Everything", desc: "Sake, cocktails, meals — track it all and earn XP", color: 'var(--amber)' },
              { emoji: "⚔️", title: "Compete & Climb", desc: "Level up, claim bounties, dominate the Shogun ranks", color: 'var(--acid)' },
              { emoji: "🏮", title: "Gather the Crew", desc: "Create Pirate Crews, host events, and clink live", color: 'var(--coral)' },
            ].map((card) => (
              <div
                key={card.title}
                className="flex items-center gap-3 p-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '4px' }}
              >
                <div
                  className="w-11 h-11 flex items-center justify-center text-2xl shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}
                >
                  {card.emoji}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: card.color }}>{card.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => { localStorage.setItem('chugchug_onboarded', '1'); setShowOnboarding(false); navigate("/log"); }} className="glass-btn w-full mt-2">
            Log Your First Drink 🍶
          </button>
        </div>
      )}

      {/* ─── 1. HERO GREETING ─── */}
      <div
        className="p-5 flex flex-col justify-between relative overflow-hidden anim-stagger-1"
        style={{
          background: 'linear-gradient(135deg, var(--amber-dim), rgba(209,32,32,0.05))',
          border: '1px solid var(--amber)',
          borderLeft: '5px solid var(--amber)',
          borderRadius: '4px'
        }}
      >
        <div className="absolute top-0 right-0 p-3 opacity-20 pointer-events-none">
          <Swords size={120} style={{ color: 'var(--amber)' }} />
        </div>

        <div className="relative z-10">
          {(() => {
            const rankInfo = getRankInfo(profile?.level ?? 1, profile?.xp ?? 0);
            const streak = profile?.current_streak ?? 0;
            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                      Welcome, {profile?.username || 'Traveler'}
                    </p>
                    <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                      {rankInfo.current.emoji} {rankInfo.current.title}
                    </h1>
                    {/* Archetype badge */}
                    {profile?.archetype && ARCHETYPES[profile.archetype as ArchetypeId] && (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-[2px] ml-1" style={{ background: `${ARCHETYPES[profile.archetype as ArchetypeId].color}18`, color: ARCHETYPES[profile.archetype as ArchetypeId].color, border: `1px solid ${ARCHETYPES[profile.archetype as ArchetypeId].color}30` }}>
                        {ARCHETYPES[profile.archetype as ArchetypeId].emoji} {ARCHETYPES[profile.archetype as ArchetypeId].title}
                      </span>
                    )}
                  </div>
                  {/* Streak flame */}
                  {streak > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: streak >= 14 ? 'rgba(209,32,32,0.15)' : streak >= 7 ? 'rgba(216,162,94,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${streak >= 14 ? 'rgba(209,32,32,0.3)' : streak >= 7 ? 'rgba(216,162,94,0.3)' : 'var(--border)'}` }}>
                      <Flame size={14} style={{ color: streak >= 14 ? 'var(--coral)' : streak >= 7 ? 'var(--amber)' : 'var(--text-muted)', animation: streak >= 7 ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
                      <span className="text-sm font-black" style={{ fontFamily: 'Syne, sans-serif', color: streak >= 14 ? 'var(--coral)' : streak >= 7 ? 'var(--amber)' : 'var(--text-secondary)' }}>{streak}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: rankInfo.current.color }}>
                    Lv. {profile?.level ?? 1} {rankInfo.current.title}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--amber)' }}>
                    {profile?.xp ?? 0} XP
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '1px' }}>
                  <div
                    className="h-full transition-all duration-700"
                    style={{
                      width: `${xpProgress}%`,
                      background: rankInfo.current.color,
                      boxShadow: `0 0 8px ${rankInfo.current.glowColor}`,
                    }}
                  />
                </div>

                {/* Next rank indicator */}
                {rankInfo.next && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] font-bold" style={{ color: 'var(--text-ghost)' }}>
                      {rankInfo.xpToNext.toLocaleString()} XP to {rankInfo.next.emoji} {rankInfo.next.title}
                    </span>
                    <span className="text-[10px] font-black" style={{ color: rankInfo.current.color }}>
                      {rankInfo.progressPercent}%
                    </span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* ─── 1.1 ARCHETYPE DISCOVER PROMPT ─── */}
      {profile && !profile.archetype && (
        <button
          onClick={() => setShowArchetypeQuiz(true)}
          className="w-full p-4 rounded-[4px] flex items-center gap-4 active:scale-[0.98] transition-transform relative overflow-hidden anim-stagger-1"
          style={{
            background: 'linear-gradient(135deg, rgba(155,89,182,0.12), rgba(216,162,94,0.08))',
            border: '1px solid rgba(155,89,182,0.25)',
            borderLeft: '4px solid #9B59B6',
          }}
        >
          <div className="w-12 h-12 rounded-[4px] flex items-center justify-center text-2xl shrink-0" style={{ background: 'rgba(155,89,182,0.15)', border: '1px solid rgba(155,89,182,0.3)' }}>
            🎭
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-black uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: '#9B59B6' }}>
              Discover Your Archetype
            </p>
            <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
              5 questions · Ronin, Shogun, Sage, or Berserker?
            </p>
          </div>
          <ArrowRight size={18} style={{ color: '#9B59B6' }} />
        </button>
      )}

      {/* ─── 1.25 DAILY BOUNTIES ─── */}
      {dailyBounties.length > 0 && (
        <section
          className="overflow-hidden anim-stagger-2"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--card-radius)',
          }}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--amber)' }}>
              <Zap size={12} /> Daily Bounties
            </h2>
            <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5" style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(216,162,94,0.2)', borderRadius: '2px' }}>
              Resets at midnight
            </span>
          </div>
          <div className="px-3 pb-3 space-y-2">
            {dailyBounties.map((bounty) => {
              const prog = bountyProgress[bounty.id];
              const completed = prog?.completed ?? false;
              const current = prog?.current ?? 0;
              const target = prog?.target ?? bounty.target;
              const pct = target > 0 ? Math.round((current / target) * 100) : 0;
              return (
                <div
                  key={bounty.id}
                  className="flex items-center gap-3 p-3 transition-all"
                  style={{
                    background: completed ? 'var(--acid-dim)' : 'var(--bg-raised)',
                    border: completed ? '1px solid rgba(204,255,0,0.2)' : '1px solid var(--border)',
                    borderRadius: 'var(--card-radius)',
                    opacity: completed ? 0.75 : 1,
                  }}
                >
                  <div
                    className="w-10 h-10 shrink-0 flex items-center justify-center text-lg"
                    style={{ background: 'var(--bg-deep)', borderRadius: 'var(--card-radius)', border: '1px solid var(--border-mid)' }}
                  >
                    {completed ? '✅' : bounty.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold" style={{ color: completed ? 'var(--acid)' : 'var(--text-primary)', textDecoration: completed ? 'line-through' : 'none' }}>
                        {bounty.title}
                      </span>
                      <span className="text-[10px] font-black px-1.5 py-0.5" style={{ background: completed ? 'var(--acid-dim)' : 'var(--amber-dim)', color: completed ? 'var(--acid)' : 'var(--amber)', borderRadius: '2px' }}>
                        +{bounty.xpReward}
                      </span>
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{bounty.description}</p>
                    {!completed && (
                      <div className="h-1 mt-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '1px' }}>
                        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: 'var(--amber)' }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── 1.5 FULL MONTHLY CALENDAR ─── */}
      <section
        className="overflow-hidden anim-stagger-2"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--card-radius)',
        }}
      >
        {/* Weekly stats strip */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black flex items-center gap-1" style={{ color: 'var(--amber)' }}>
              🍻 {weekStats.drinks} <span className="font-medium" style={{ color: 'var(--text-ghost)' }}>this week</span>
            </span>
            <span className="text-[10px] font-black flex items-center gap-1" style={{ color: 'var(--acid)' }}>
              🌿 {weekStats.dryDays} <span className="font-medium" style={{ color: 'var(--text-ghost)' }}>dry</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Flame size={12} style={{ color: 'var(--coral)' }} />
            <span className="text-[10px] font-black" style={{ color: 'var(--coral)' }}>{currentDryStreak}d streak</span>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button onClick={handleCalPrev} className="p-1.5 active:scale-90 transition-transform" style={{ color: 'var(--text-secondary)' }}>
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => navigate('/calendar')}
            className="text-sm font-black uppercase tracking-widest flex items-center gap-1.5 active:scale-95 transition-transform"
            style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}
          >
            {MONTH_NAMES[calMonth]} {calYear}
            <ArrowRight size={12} style={{ color: 'var(--amber)', opacity: 0.6 }} />
          </button>
          <button onClick={handleCalNext} className="p-1.5 active:scale-90 transition-transform" style={{ color: 'var(--text-secondary)' }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 px-3">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center py-1">
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>{d}</span>
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-1 px-3 pb-3">
          {monthGridCells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />;
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isPast = dateStr <= todayStr;
            const log = monthLogs.get(dateStr);
            const hasDrinks = log && log.drinks > 0;
            const hasDetox = log?.categories.includes('detox');
            const hasGym = log?.categories.includes('gym');

            let cellBg = 'transparent';
            if (hasDetox) cellBg = 'var(--acid-dim)';
            else if (hasGym) cellBg = 'var(--indigo-dim)';
            else if (hasDrinks && log.drinks >= 6) cellBg = 'var(--coral-dim)';
            else if (hasDrinks) cellBg = 'var(--amber-dim)';
            else if (isPast && !log) cellBg = 'rgba(124,154,116,0.06)';

            return (
              <button
                key={dateStr}
                onClick={() => navigate('/log', { state: { prefillDate: dateStr } })}
                className="flex flex-col items-center justify-center py-1.5 active:scale-90 transition-all relative"
                style={{
                  background: cellBg,
                  border: isToday ? '2px solid var(--amber)' : '1px solid transparent',
                  borderRadius: 'var(--card-radius)',
                  minHeight: 44,
                }}
              >
                <span
                  className="text-xs font-bold"
                  style={{ color: isToday ? 'var(--amber)' : isPast ? 'var(--text-primary)' : 'var(--text-ghost)' }}
                >
                  {day}
                </span>
                {log ? (
                  <div className="flex gap-0.5 mt-0.5">
                    {log.categories.slice(0, 2).map(c => (
                      <span key={c} className="text-[8px]">{CAT_EMOJI[c] || '📝'}</span>
                    ))}
                  </div>
                ) : isPast ? (
                  <span className="text-[7px] mt-0.5" style={{ color: 'var(--text-ghost)', opacity: 0.5 }}>·</span>
                ) : null}
                {hasDrinks && (
                  <span className="text-[7px] font-black" style={{ color: 'var(--amber)' }}>{log.drinks}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Month summary footer */}
        <div
          className="flex items-center justify-center gap-5 px-4 py-2"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-raised)' }}
        >
          <span className="text-[9px] font-bold" style={{ color: 'var(--amber)' }}>
            🍻 {monthDrinks} drinks this month
          </span>
          <span className="text-[9px] font-bold" style={{ color: 'var(--text-ghost)' }}>·</span>
          <button
            onClick={() => navigate('/calendar')}
            className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1 active:scale-95 transition-transform"
            style={{ color: 'var(--amber)' }}
          >
            Full Analytics <ArrowRight size={10} />
          </button>
        </div>
      </section>

      {/* ─── 2. DRINKING SESSION (Start / Join / Resume) ─── */}
      <section>
        {activeSession ? (
          <button
            onClick={() => navigate(`/session/${activeSession.id}`)}
            className="w-full p-4 rounded-[4px] flex items-center gap-4 active:scale-[0.98] transition-transform relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(209,32,32,0.15), rgba(216,162,94,0.1))',
              border: '1px solid rgba(209,32,32,0.3)',
              borderLeft: '4px solid var(--coral)',
            }}
          >
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--coral)', boxShadow: '0 0 12px rgba(209,32,32,0.5)' }} />
            <div className="flex-1 text-left">
              <p className="text-sm font-black uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--coral)' }}>Active Session</p>
              <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Code: {activeSession.join_code} · Tap to resume</p>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--coral)' }} />
          </button>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleStartSession}
              disabled={sessionCreating}
              className="w-full p-4 rounded-[4px] flex items-center gap-4 active:scale-[0.98] transition-transform"
              style={{
                background: 'linear-gradient(135deg, var(--amber-dim), rgba(216,162,94,0.05))',
                border: '1px solid rgba(216,162,94,0.3)',
                borderLeft: '4px solid var(--amber)',
              }}
            >
              <Beer size={22} style={{ color: 'var(--amber)' }} />
              <div className="flex-1 text-left">
                <p className="text-sm font-black uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--amber)' }}>
                  {sessionCreating ? 'Creating...' : 'Start Drinking Session'}
                </p>
                <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Get a code. Friends join with it.</p>
              </div>
              <ArrowRight size={18} style={{ color: 'var(--amber)' }} />
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="JOIN CODE"
                maxLength={6}
                className="glass-input flex-1 text-center font-black tracking-[0.2em] uppercase"
                style={{ fontFamily: 'Syne, sans-serif', fontSize: 14 }}
              />
              <button
                onClick={handleJoinSession}
                disabled={joinCodeInput.length < 4}
                className="px-5 rounded-[4px] font-black text-xs uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-30"
                style={{ background: 'var(--acid-dim)', border: '1px solid rgba(204,255,0,0.3)', color: 'var(--acid)' }}
              >
                <LogIn size={14} /> Join
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ─── 3. KATANA GRID QUICK ACTIONS ─── */}
      <section className="anim-stagger-3">
        <p className="section-label mb-3 border-l-2 pl-2" style={{ borderColor: 'var(--coral)' }}>What is your decree? 📜</p>
        <div className="grid grid-cols-3 gap-2.5">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.to)}
              className="flex flex-col items-center justify-center gap-1.5 p-3 active:scale-95 transition-transform"
              style={{
                background: action.bg,
                border: `1px solid ${action.color}40`,
                borderRight: `3px solid ${action.color}`,
                borderRadius: '2px'
              }}
            >
              <span className="text-xl drop-shadow-md">{action.emoji}</span>
              <span className="text-[9px] font-black uppercase text-center tracking-widest" style={{ color: action.color }}>
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ─── 3. TAVERN SUPERVISOR: Ninkasi ─── */}
      <section
        className="overflow-hidden anim-stagger-4"
        style={{
          background: 'linear-gradient(to bottom, rgba(209,32,32,0.05), var(--card-bg))',
          border: '1px solid var(--border)',
          borderTopColor: 'var(--coral)',
          borderRadius: '4px'
        }}
      >
        <div className="px-4 pt-4 pb-3 flex items-center justify-between relative">
          <h2 className="text-sm font-black flex items-center gap-2 uppercase tracking-wide" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--coral)' }}>
            <span className="text-xl">🌸</span>
            Mistress Ninkasi
          </h2>
          <span className="text-[8px] font-black px-2 py-0.5" style={{ background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid var(--coral)', borderRadius: '2px' }}>
            TAVERN KEEPER
          </span>
        </div>

        <div className="p-4 space-y-4">
          {chatReply ? (
            <div className="text-sm leading-loose anim-fade p-4" style={{ color: 'var(--text-primary)', background: 'var(--bg-deep)', border: '1px solid var(--border-mid)', borderRadius: '2px' }}>
              <p>{chatReply}</p>
              {referencedRecipes.length > 0 && (
                <div className="mt-4 pt-3 flex flex-wrap gap-2" style={{ borderTop: '1px dashed var(--border-mid)' }}>
                  {referencedRecipes.map((name) => (
                    <span key={name} className="text-[10px] font-bold px-2 py-1 flex items-center gap-1.5" style={{ background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid rgba(209,32,32,0.3)', borderRadius: '2px' }}>
                      <BookOpen size={10} /> {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm mb-4 font-bold" style={{ color: 'var(--text-muted)' }}>
                "Step into my tavern, traveler. Seek the finest sake recipes or simply tell me your woes." 🍶
              </p>
              <div className="flex flex-wrap gap-2.5">
                {quickPrompts.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => { setChatPrompt(qp.prompt); handleChatSend(qp.prompt); }}
                    disabled={chatLoading}
                    className="text-[10px] uppercase tracking-widest font-bold px-3 py-2 transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)', borderRadius: '2px' }}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatLoading && (
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--coral)' }}>
              <Loader2 size={14} className="animate-spin" /> Ninkasi is brewing...
            </div>
          )}

          {chatError && (
            <p className="text-[10px] font-black uppercase tracking-widest px-3 py-3" style={{ background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid rgba(209,32,32,0.3)', borderRadius: '2px' }}>
              ⚠ {chatError}
            </p>
          )}

          <div className="flex gap-2 items-center p-2" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)', borderRadius: '2px' }}>
            <input
              type="text"
              value={chatPrompt}
              onChange={(e) => setChatPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !chatLoading && handleChatSend()}
              placeholder="Speak with Ninkasi..."
              className="w-full bg-transparent outline-none text-sm px-2 py-1.5 placeholder-opacity-50"
              style={{ color: 'var(--text-primary)' }}
              disabled={chatLoading}
            />
            <button
              onClick={() => handleChatSend()}
              disabled={chatLoading || !chatPrompt.trim()}
              className="px-4 py-2 transition-all active:scale-90 disabled:opacity-30 flex gap-2 items-center"
              style={{ background: 'var(--coral)', color: 'white', borderRadius: '2px', fontWeight: '900' }}
            >
              SEND <ArrowRight size={14} />
            </button>
          </div>
          <div ref={responseRef} />
        </div>
      </section>

      {/* ─── 4. TOP PERFORMERS + RECIPES ─── */}
      <div className="grid grid-cols-2 gap-3 anim-stagger-5">
        <section className="p-4 relative overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '4px' }}>
          <h2 className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-1.5" style={{ color: 'var(--amber)' }}>
            🏆 Shogunate Top 5
          </h2>
          <div className="space-y-2.5">
            {ranks.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-ghost)' }}>No honors yet</p>
            ) : ranks.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black w-4 text-center" style={{ color: i < 3 ? 'var(--amber)' : 'var(--text-muted)' }}>
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold truncate max-w-[65px]" style={{ color: 'var(--text-primary)' }}>{r.username}</span>
                </div>
                <span className="text-[9px] font-black tracking-wider" style={{ color: 'var(--acid)' }}>{r.xp} XP</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/rank")}
            className="w-full mt-4 text-[9px] uppercase tracking-widest font-black py-2.5 flex items-center justify-center gap-1 transition-colors"
            style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-mid)', borderRadius: '2px' }}
          >
            View All Ranks
          </button>
        </section>

        <section className="p-4 relative overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '4px' }}>
          <h2 className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-1.5" style={{ color: 'var(--coral)' }}>
            📜 Recent Recipes
          </h2>
          <div className="space-y-2.5">
            {recipes.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-ghost)' }}>None found</p>
            ) : recipes.map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <span className="text-xs font-bold truncate max-w-[70px]" style={{ color: 'var(--text-primary)' }}>{r.item_name}</span>
                <span className="text-[9px] font-black px-1.5 py-0.5" style={{ background: 'var(--coral-dim)', border: '1px solid rgba(209,32,32,0.2)', color: 'var(--coral)', borderRadius: '2px' }}>
                  +{r.xp_earned}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/log")}
            className="w-full mt-4 text-[9px] uppercase tracking-widest font-black py-2.5 flex items-center justify-center gap-1 transition-colors"
            style={{ background: 'var(--coral-dim)', color: 'var(--coral)', border: '1px solid rgba(209,32,32,0.2)', borderRadius: '2px' }}
          >
            Scribe Recipe
          </button>
        </section>
      </div>

      {/* ─── 5. BADGES ─── */}
      <section className="anim-stagger-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: 18 }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest border-l-2 pl-2" style={{ borderColor: 'var(--acid)', color: 'var(--text-muted)' }}>
            🎖️ Bounties & Badges
          </h2>
        </div>

        {badges.length === 0 ? (
          <div className="text-center py-6" style={{ background: 'var(--bg-deep)', border: '1px dashed var(--border-mid)', borderRadius: '2px' }}>
            <Skull size={24} className="mx-auto mb-2 opacity-50" style={{ color: 'var(--text-ghost)' }} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">No Bounties Claimed</p>
            <button
              onClick={() => navigate("/log")}
              className="text-[10px] font-black uppercase tracking-widest px-4 py-2"
              style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(216, 162, 94, 0.3)', borderRadius: '2px' }}
            >
              Start Your Journey
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {badges.slice(0, 5).map((b) => (
              <div
                key={b.id}
                className="flex flex-col items-center gap-1.5 p-2 hover:scale-105 transition-transform"
                style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-mid)', borderRadius: '2px' }}
                title={b.name}
              >
                <span className="text-2xl drop-shadow-md">{b.icon_text}</span>
                <span className="text-[7px] font-black text-center uppercase tracking-widest leading-tight line-clamp-1" style={{ color: 'var(--amber)' }}>
                  {b.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
