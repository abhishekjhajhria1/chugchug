import { useState, useEffect, useRef, useMemo } from "react";
import {
  Loader2, ArrowRight, Beer, LogIn, ChevronLeft, ChevronRight,
  Flame, Trophy, Sparkles, Send, BookOpen, Zap, MessageCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useChug } from "../context/ChugContext";
import { useNavigate } from "react-router-dom";
import { getRankInfo, getDailyBounties, checkDailyBountyCompletion } from "../lib/progression";
import type { BountyDef } from "../lib/progression";
import ArchetypeQuiz, { ARCHETYPES } from "../components/ArchetypeQuiz";
import type { ArchetypeId } from "../components/ArchetypeQuiz";
import { useToast } from "../components/Toast";
import NearestBarCompass from "../components/NearestBarCompass";
import DailyRewardStreak from "../components/DailyRewardStreak";
import LiveActivityFeed from "../components/LiveActivityFeed";
import WeeklyLeagueCard from "../components/WeeklyLeagueCard";
import FriendsLeagueCard from "../components/FriendsLeagueCard";
import CrewBattleCard from "../components/CrewBattleCard";
import EventBanner from "../components/EventBanner";
import { generateSessionCode } from "../utils/crypto";
import type { RankUser, Badge, Recipe } from "../types";

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

  // Ninkasi mini-chat (full conversation lives at /ninkasi)
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [referencedRecipes, setReferencedRecipes] = useState<string[]>([]);
  const [chatError, setChatError] = useState("");
  const toast = useToast();
  const responseRef = useRef<HTMLDivElement>(null);
  const BARTENDER_API = import.meta.env.VITE_BARTENDER_API?.trim() || import.meta.env.VITE_NINKASI_API_URL?.trim() || "";

  // --- MONTHLY CALENDAR STATE ---
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [monthLogs, setMonthLogs] = useState<Map<string, { drinks: number; categories: string[] }>>(new Map());

  // --- SESSION STATE ---
  const [activeSession, setActiveSession] = useState<{ id: string; join_code: string } | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [sessionCreating, setSessionCreating] = useState(false);

  const quickPrompts = [
    { label: "🍸 Cocktail", prompt: "Recommend a great cocktail for tonight." },
    { label: "🍺 Beer pairing", prompt: "What food pairs well with a cold beer?" },
    { label: "🍷 Wine", prompt: "Suggest an easy-drinking wine." },
    { label: "🎉 Party shots", prompt: "Give me 3 fun party shot ideas." },
  ];

  const handleChatSend = async (prompt?: string) => {
    const finalPrompt = prompt || chatPrompt;
    if (!finalPrompt.trim()) return;
    if (!BARTENDER_API) {
      setChatError("Ninkasi is offline right now. (Configure VITE_BARTENDER_API)");
      return;
    }
    setChatLoading(true);
    setChatReply("");
    setChatError("");
    setReferencedRecipes([]);
    try {
      const body: any = { prompt: finalPrompt, mode: "recipe" };
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
      setChatReply(data.response || data.reply || "Hmm, ask me that a different way?");
      if (data.referenced_recipes) setReferencedRecipes(data.referenced_recipes);
      setChatPrompt("");
    } catch {
      setChatError("Couldn't reach Ninkasi. Try again in a moment.");
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
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
        console.error("Home feed fetch error:", e);
      }
    };
    fetchData();
  }, [user, profile]);

  useEffect(() => {
    if (!user) return;
    setDailyBounties(getDailyBounties());
    checkDailyBountyCompletion(user.id).then(setBountyProgress);
  }, [user]);

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

  useEffect(() => {
    if (!user) return;
    const checkActiveSession = async () => {
      const { data } = await supabase
        .from('drinking_sessions')
        .select('id, join_code')
        .eq('creator_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setActiveSession(data);
    };
    checkActiveSession();
  }, [user]);

  const handleStartSession = async () => {
    if (!user) return;
    setSessionCreating(true);
    try {
      const code = generateSessionCode();
      const { data, error } = await supabase.from('drinking_sessions').insert({
        creator_id: user.id,
        join_code: code,
        status: 'active',
      }).select('id, join_code').single();

      if (error || !data) {
        console.error('Start session failed:', error);
        toast.error(error?.message || 'Could not start a session');
        return;
      }
      await supabase.from('session_participants').insert({ session_id: data.id, user_id: user.id });
      navigate(`/session/${data.id}`);
    } catch (e: any) {
      console.error('Start session exception:', e);
      toast.error(e?.message || 'Something went wrong starting the session');
    } finally {
      setSessionCreating(false);
    }
  };

  const handleJoinSession = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code || code.length < 4) { toast.error('Enter a valid join code'); return; }
    const { data } = await supabase
      .from('drinking_sessions')
      .select('id')
      .eq('join_code', code)
      .eq('status', 'active')
      .maybeSingle();
    if (data) navigate(`/session/${data.id}`);
    else toast.error('No active session found with that code');
  };

  const xpForNextLevel = (profile?.level || 1) * 100;
  const xpProgress = Math.min(((profile?.xp || 0) % xpForNextLevel) / xpForNextLevel * 100, 100);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "Late night";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const CAT_EMOJI: Record<string, string> = { drink: '🍻', snack: '🍟', cigarette: '🚬', gym: '💪', detox: '🧘', water: '💧' };

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = (() => { const d = new Date(calYear, calMonth, 1).getDay(); return d === 0 ? 6 : d - 1; })();
  const todayStr = new Date().toISOString().split('T')[0];

  const monthGridCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [firstDayOfWeek, daysInMonth]);

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

  const currentDryStreak = useMemo(() => {
    let streak = 0;
    const d = new Date();
    while (true) {
      const key = d.toISOString().split('T')[0];
      const log = monthLogs.get(key);
      if (log && log.drinks > 0) break;
      streak++;
      d.setDate(d.getDate() - 1);
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
    { label: "Log a drink", to: "/log", emoji: "✍️" },
    { label: "Split a bill", to: "/groups", emoji: "💸" },
    { label: "Find a bar", to: "/tavern", emoji: "🍸" },
    { label: "Events", to: "/events", emoji: "✨" },
    { label: "Challenges", to: "/challenges", emoji: "🎯" },
    { label: "Leaderboard", to: "/rank", emoji: "🏆" },
  ];

  const rankInfo = getRankInfo(profile?.level ?? 1, profile?.xp ?? 0);
  const streak = profile?.current_streak ?? 0;

  return (
    <div className="space-y-6 pb-8 wano-fade">

      {showArchetypeQuiz && (
        <ArchetypeQuiz onComplete={() => setShowArchetypeQuiz(false)} onSkip={() => setShowArchetypeQuiz(false)} />
      )}

      {/* ─── ONBOARDING (new users) ─── */}
      {showOnboarding && (
        <div className="glass-card anim-pop p-6 space-y-4" style={{ borderColor: 'var(--border-mid)' }}>
          <button
            onClick={() => { localStorage.setItem('chugchug_onboarded', '1'); setShowOnboarding(false); }}
            className="absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full transition-colors"
            style={{ color: 'var(--text-muted)', background: 'var(--glass-fill-inset)' }}
          >
            Skip
          </button>
          <div className="text-center pt-1">
            <div className="text-5xl mb-3">🍻</div>
            <h1 className="text-2xl mb-2">Welcome to ChugChug</h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Track your nights out, keep your streak alive, and out-rank your friends every week.
            </p>
          </div>
          <div className="space-y-2.5">
            {[
              { emoji: "📒", title: "Log everything", desc: "Drinks, snacks, sessions — earn XP for it all", color: 'var(--amber)' },
              { emoji: "🏆", title: "Climb the ranks", desc: "Level up and top your friends league", color: 'var(--acid)' },
              { emoji: "👥", title: "Roll with your crew", desc: "Create groups, split bills, party together", color: 'var(--coral)' },
            ].map((card) => (
              <div key={card.title} className="flex items-center gap-3 p-3" style={{ background: 'var(--glass-fill-inset)', borderRadius: 12 }}>
                <div className="w-11 h-11 flex items-center justify-center text-2xl shrink-0" style={{ background: 'var(--bg-surface)', borderRadius: 12 }}>{card.emoji}</div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{card.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { localStorage.setItem('chugchug_onboarded', '1'); setShowOnboarding(false); navigate("/log"); }} className="glass-btn w-full">
            Log your first drink
          </button>
        </div>
      )}

      {/* ─── 1. HERO — greeting + XP ─── */}
      <section className="glass-card anim-stagger-1" style={{ padding: 22 }}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
              {greeting}, {profile?.username || 'traveler'}
            </p>
            <h1 className="text-2xl flex items-center gap-2 flex-wrap">
              <span>{rankInfo.current.emoji}</span>
              <span style={{ color: 'var(--text-primary)' }}>{rankInfo.current.title}</span>
            </h1>
            {profile?.archetype && ARCHETYPES[profile.archetype as ArchetypeId] && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full mt-2"
                style={{ background: `${ARCHETYPES[profile.archetype as ArchetypeId].color}1A`, color: ARCHETYPES[profile.archetype as ArchetypeId].color }}>
                {ARCHETYPES[profile.archetype as ArchetypeId].emoji} {ARCHETYPES[profile.archetype as ArchetypeId].title}
              </span>
            )}
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0"
              style={{ background: streak >= 7 ? 'var(--coral-dim)' : 'var(--glass-fill-inset)' }}>
              <Flame size={15} style={{ color: streak >= 7 ? 'var(--coral)' : 'var(--text-muted)' }} />
              <span className="text-sm font-extrabold" style={{ color: streak >= 7 ? 'var(--coral)' : 'var(--text-secondary)' }}>{streak}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Level {profile?.level ?? 1}</span>
          <span className="text-sm font-bold" style={{ color: 'var(--amber)' }}>{(profile?.xp ?? 0).toLocaleString()} XP</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--glass-fill-inset)' }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${xpProgress}%`, background: rankInfo.current.color }} />
        </div>
        {rankInfo.next && (
          <p className="text-xs font-medium mt-2.5" style={{ color: 'var(--text-muted)' }}>
            {rankInfo.xpToNext.toLocaleString()} XP to {rankInfo.next.emoji} {rankInfo.next.title}
          </p>
        )}
      </section>

      {/* ─── 2. CALENDAR (right under the XP bar) ─── */}
      <section className="glass-card anim-stagger-2 overflow-hidden" style={{ padding: 0 }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--amber)' }}>
              🍻 {weekStats.drinks} <span className="font-medium" style={{ color: 'var(--text-muted)' }}>this week</span>
            </span>
            <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--acid)' }}>
              🌿 {weekStats.dryDays} <span className="font-medium" style={{ color: 'var(--text-muted)' }}>dry</span>
            </span>
          </div>
          {currentDryStreak > 0 && (
            <span className="flex items-center gap-1 text-sm font-bold" style={{ color: 'var(--coral)' }}>
              <Flame size={13} /> {currentDryStreak}d
            </span>
          )}
        </div>

        <div className="flex items-center justify-between px-5 pt-3.5 pb-1">
          <button onClick={handleCalPrev} className="p-2 -ml-2 rounded-full active:scale-90 transition-transform" style={{ color: 'var(--text-secondary)' }}>
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => navigate('/calendar')} className="text-base font-extrabold flex items-center gap-1.5 active:scale-95 transition-transform" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
            {MONTH_NAMES[calMonth]} {calYear}
            <ArrowRight size={13} style={{ color: 'var(--amber)' }} />
          </button>
          <button onClick={handleCalNext} className="p-2 -mr-2 rounded-full active:scale-90 transition-transform" style={{ color: 'var(--text-secondary)' }}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 px-3.5">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center py-1.5">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-ghost)' }}>{d}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 px-3.5 pb-4">
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

            return (
              <button
                key={dateStr}
                onClick={() => navigate('/log', { state: { prefillDate: dateStr } })}
                className="flex flex-col items-center justify-center py-1.5 active:scale-90 transition-all"
                style={{
                  background: cellBg,
                  border: isToday ? '2px solid var(--amber)' : '1px solid transparent',
                  borderRadius: 10,
                  minHeight: 46,
                }}
              >
                <span className="text-[13px] font-semibold" style={{ color: isToday ? 'var(--amber)' : isPast ? 'var(--text-primary)' : 'var(--text-ghost)' }}>
                  {day}
                </span>
                {log && (
                  <div className="flex gap-0.5 mt-0.5">
                    {log.categories.slice(0, 2).map(c => (<span key={c} className="text-[9px]">{CAT_EMOJI[c] || '📝'}</span>))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-3 px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>🍻 {monthDrinks} drinks this month</span>
          <span style={{ color: 'var(--text-ghost)' }}>·</span>
          <button onClick={() => navigate('/calendar')} className="text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform" style={{ color: 'var(--amber)' }}>
            Full analytics <ArrowRight size={11} />
          </button>
        </div>
      </section>

      {/* ─── 3. DRINKING SESSION ─── */}
      <section>
        {activeSession ? (
          <button
            onClick={() => navigate(`/session/${activeSession.id}`)}
            className="w-full p-4 flex items-center gap-3.5 active:scale-[0.99] transition-transform"
            style={{ background: 'var(--coral-dim)', border: '1px solid color-mix(in srgb, var(--coral) 28%, transparent)', borderRadius: 'var(--card-radius)' }}
          >
            <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--coral)' }} />
            <div className="flex-1 text-left">
              <p className="text-sm font-extrabold" style={{ color: 'var(--coral)' }}>Active session</p>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Code {activeSession.join_code} · tap to resume</p>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--coral)' }} />
          </button>
        ) : (
          <div className="space-y-2.5">
            <button
              onClick={handleStartSession}
              disabled={sessionCreating}
              className="w-full p-4 flex items-center gap-3.5 active:scale-[0.99] transition-transform disabled:opacity-60"
              style={{ background: 'var(--amber-dim)', border: '1px solid color-mix(in srgb, var(--amber) 28%, transparent)', borderRadius: 'var(--card-radius)' }}
            >
              {sessionCreating ? <Loader2 size={20} className="animate-spin" style={{ color: 'var(--amber)' }} /> : <Beer size={20} style={{ color: 'var(--amber)' }} />}
              <div className="flex-1 text-left">
                <p className="text-sm font-extrabold" style={{ color: 'var(--amber)' }}>{sessionCreating ? 'Starting…' : 'Start a drinking session'}</p>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Get a code, friends join live</p>
              </div>
              <ArrowRight size={18} style={{ color: 'var(--amber)' }} />
            </button>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="Enter join code"
                maxLength={6}
                className="glass-input flex-1 text-center font-bold tracking-[0.18em] uppercase"
                style={{ fontSize: 15 }}
              />
              <button
                onClick={handleJoinSession}
                disabled={joinCodeInput.length < 4}
                className="px-5 font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-30"
                style={{ background: 'var(--acid-dim)', color: 'var(--acid)', borderRadius: 'var(--input-radius)' }}
              >
                <LogIn size={15} /> Join
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ─── 4. QUICK ACTIONS ─── */}
      <section className="anim-stagger-3">
        <p className="section-label mb-3">Quick actions</p>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.to)}
              className="flex flex-col items-center justify-center gap-2 py-5 active:scale-95 transition-transform"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)' }}
            >
              <span className="text-2xl">{action.emoji}</span>
              <span className="text-[11px] font-bold text-center leading-tight" style={{ color: 'var(--text-secondary)' }}>{action.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-3"><NearestBarCompass /></div>
      </section>

      {/* ─── 5. NINKASI — AI bartender (right under the shortcuts) ─── */}
      <section className="glass-card anim-stagger-4" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--amber-dim)' }}>🍸</div>
          <div className="flex-1">
            <h2 className="text-base font-extrabold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              Ninkasi <Sparkles size={13} style={{ color: 'var(--amber)' }} />
            </h2>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Your AI bartender</p>
          </div>
          <button onClick={() => navigate('/ninkasi')} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full active:scale-95 transition-transform" style={{ background: 'var(--glass-fill-inset)', color: 'var(--amber)' }}>
            <MessageCircle size={14} /> Full chat
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          {chatReply ? (
            <div className="text-sm leading-relaxed anim-fade p-4 rounded-xl" style={{ color: 'var(--text-primary)', background: 'var(--glass-fill-inset)' }}>
              <p>{chatReply}</p>
              {referencedRecipes.length > 0 && (
                <div className="mt-3 pt-3 flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                  {referencedRecipes.map((name) => (
                    <span key={name} className="text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1.5" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                      <BookOpen size={11} /> {name}
                    </span>
                  ))}
                </div>
              )}
              <button onClick={() => navigate('/ninkasi')} className="mt-3 text-xs font-bold flex items-center gap-1" style={{ color: 'var(--amber)' }}>
                Keep chatting <ArrowRight size={12} />
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm mb-3.5" style={{ color: 'var(--text-secondary)' }}>
                Need a recipe, a pairing, or just can't decide what to drink? Ask away. 🍶
              </p>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => { setChatPrompt(qp.prompt); handleChatSend(qp.prompt); }}
                    disabled={chatLoading}
                    className="text-xs font-semibold px-3.5 py-2 rounded-full active:scale-95 transition-transform disabled:opacity-40"
                    style={{ background: 'var(--glass-fill-inset)', color: 'var(--text-secondary)' }}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatLoading && (
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--amber)' }}>
              <Loader2 size={15} className="animate-spin" /> Ninkasi is thinking…
            </div>
          )}
          {chatError && (
            <p className="text-xs font-semibold px-3 py-2.5 rounded-xl" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>{chatError}</p>
          )}

          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={chatPrompt}
              onChange={(e) => setChatPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !chatLoading && handleChatSend()}
              placeholder="Ask Ninkasi…"
              className="glass-input flex-1"
              disabled={chatLoading}
            />
            <button
              onClick={() => handleChatSend()}
              disabled={chatLoading || !chatPrompt.trim()}
              className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl active:scale-90 transition-transform disabled:opacity-30"
              style={{ background: 'var(--btn-bg)', color: 'var(--btn-color)' }}
            >
              <Send size={17} />
            </button>
          </div>
          <div ref={responseRef} />
        </div>
      </section>

      {/* ─── 6. ENGAGEMENT ─── */}
      <EventBanner />
      <DailyRewardStreak />
      <FriendsLeagueCard />

      {/* Archetype discover */}
      {profile && !profile.archetype && (
        <button
          onClick={() => setShowArchetypeQuiz(true)}
          className="w-full p-4 flex items-center gap-3.5 active:scale-[0.99] transition-transform"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)' }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: 'rgba(155,89,182,0.14)' }}>🎭</div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Discover your archetype</p>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>5 quick questions</p>
          </div>
          <ArrowRight size={18} style={{ color: '#9B59B6' }} />
        </button>
      )}

      {/* Daily bounties */}
      {dailyBounties.length > 0 && (
        <section className="glass-card anim-stagger-5 overflow-hidden" style={{ padding: 0 }}>
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="text-sm font-extrabold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Zap size={15} style={{ color: 'var(--amber)' }} /> Daily bounties
            </h2>
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-ghost)' }}>resets at midnight</span>
          </div>
          <div className="px-3.5 pb-3.5 space-y-2">
            {dailyBounties.map((bounty) => {
              const prog = bountyProgress[bounty.id];
              const completed = prog?.completed ?? false;
              const current = prog?.current ?? 0;
              const target = prog?.target ?? bounty.target;
              const pct = target > 0 ? Math.round((current / target) * 100) : 0;
              return (
                <div key={bounty.id} className="flex items-center gap-3 p-3" style={{ background: completed ? 'var(--acid-dim)' : 'var(--glass-fill-inset)', borderRadius: 12, opacity: completed ? 0.8 : 1 }}>
                  <div className="w-10 h-10 shrink-0 flex items-center justify-center text-lg rounded-xl" style={{ background: 'var(--bg-surface)' }}>{completed ? '✅' : bounty.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-bold" style={{ color: completed ? 'var(--acid)' : 'var(--text-primary)', textDecoration: completed ? 'line-through' : 'none' }}>{bounty.title}</span>
                      <span className="text-xs font-extrabold px-1.5 py-0.5 rounded-full" style={{ background: completed ? 'var(--acid-dim)' : 'var(--amber-dim)', color: completed ? 'var(--acid)' : 'var(--amber)' }}>+{bounty.xpReward}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{bounty.description}</p>
                    {!completed && (
                      <div className="h-1.5 mt-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-surface)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'var(--amber)' }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <LiveActivityFeed />
      <CrewBattleCard />
      <WeeklyLeagueCard />

      {/* ─── 7. LEADERBOARD + RECIPES ─── */}
      <div className="grid grid-cols-2 gap-3 anim-stagger-6">
        <section className="glass-card" style={{ padding: 16 }}>
          <h2 className="text-sm font-extrabold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
            <Trophy size={14} style={{ color: 'var(--amber)' }} /> Top 5
          </h2>
          <div className="space-y-2.5">
            {ranks.length === 0 ? (
              <p className="text-xs text-center py-3" style={{ color: 'var(--text-ghost)' }}>No data yet</p>
            ) : ranks.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-extrabold w-4 text-center" style={{ color: i < 3 ? 'var(--amber)' : 'var(--text-muted)' }}>{i + 1}</span>
                  <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.username}</span>
                </div>
                <span className="text-[11px] font-bold shrink-0" style={{ color: 'var(--acid)' }}>{r.xp} XP</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate("/rank")} className="w-full mt-3 text-xs font-bold py-2.5 rounded-xl transition-colors" style={{ background: 'var(--glass-fill-inset)', color: 'var(--text-secondary)' }}>
            View all
          </button>
        </section>

        <section className="glass-card" style={{ padding: 16 }}>
          <h2 className="text-sm font-extrabold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>📒 Recipes</h2>
          <div className="space-y-2.5">
            {recipes.length === 0 ? (
              <p className="text-xs text-center py-3" style={{ color: 'var(--text-ghost)' }}>None yet</p>
            ) : recipes.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.item_name}</span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>+{r.xp_earned}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate("/log")} className="w-full mt-3 text-xs font-bold py-2.5 rounded-xl transition-colors" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>
            Add recipe
          </button>
        </section>
      </div>

      {/* ─── 8. BADGES ─── */}
      <section className="glass-card">
        <h2 className="text-sm font-extrabold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>🎖️ Badges</h2>
        {badges.length === 0 ? (
          <div className="text-center py-6 rounded-xl" style={{ background: 'var(--glass-fill-inset)' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>No badges yet</p>
            <button onClick={() => navigate("/log")} className="text-xs font-bold px-4 py-2 rounded-full" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
              Start your journey
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {badges.slice(0, 5).map((b) => (
              <div key={b.id} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:scale-105 transition-transform" style={{ background: 'var(--glass-fill-inset)' }} title={b.name}>
                <span className="text-2xl">{b.icon_text}</span>
                <span className="text-[9px] font-semibold text-center leading-tight line-clamp-1" style={{ color: 'var(--text-muted)' }}>{b.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
