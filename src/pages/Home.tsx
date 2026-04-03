import { useState, useEffect, useRef } from "react";
import {
  Trophy, Terminal, ChevronRight, Send, Loader2,
  Beer, Users, Globe, Plus, PartyPopper,
  ArrowRight, BookOpen, Zap, Medal, UtensilsCrossed, Activity,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useChug } from "../context/ChugContext";
import { useNavigate } from "react-router-dom";

interface RankUser { id: string; username: string; xp: number }
interface Badge { id: string; name: string; icon_text: string }
interface Recipe { id: string; item_name: string; category: string; xp_earned: number }

export default function Home() {
  const { user, profile } = useChug();
  const navigate = useNavigate();

  const [ranks, setRanks] = useState<RankUser[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const [chatPrompt, setChatPrompt] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [referencedRecipes, setReferencedRecipes] = useState<string[]>([]);
  const [chatError, setChatError] = useState("");
  const responseRef = useRef<HTMLDivElement>(null);
  const BARTENDER_API = import.meta.env.VITE_BARTENDER_API?.trim() || "";

  const quickPrompts = [
    { label: "🥃 Whiskey", prompt: "What can I make with whiskey?" },
    { label: "🌿 Gin", prompt: "Recommend me a gin cocktail" },
    { label: "🍹 Rum", prompt: "I have rum, what should I make?" },
    { label: "☕ Coffee", prompt: "Any coffee-based drink recipes?" },
  ];

  const handleChatSend = async (prompt?: string) => {
    const finalPrompt = prompt || chatPrompt;
    if (!finalPrompt.trim()) return;
    if (!BARTENDER_API) {
      setChatError("AI Bartender isn't configured yet. Ask the admin to set VITE_BARTENDER_API.");
      return;
    }
    setChatLoading(true);
    setChatReply("");
    setChatError("");
    setReferencedRecipes([]);
    try {
      const res = await fetch(`${BARTENDER_API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => null);
        throw new Error(e?.detail || `Server error (${res.status})`);
      }
      const data = await res.json();
      setChatReply(data.reply || "No suitable response found.");
      setReferencedRecipes(data.recipes_referenced || []);
      setChatPrompt("");
      setTimeout(() => responseRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    } catch (err) {
      setChatError(
        err instanceof TypeError && err.message === "Failed to fetch"
          ? "Can't reach the AI server right now. Try again later."
          : err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const [{ data: rk }, { data: bd }, { data: rd }] = await Promise.all([
          supabase.from("profiles").select("id, username, xp").order("xp", { ascending: false }).limit(5),
          supabase.from("user_badges").select("badges ( id, name, icon_text )").eq("user_id", user.id),
          supabase.from("activity_logs").select("id, item_name, category, xp_earned, photo_metadata")
            .in("category", ["snack", "drink"]).order("xp_earned", { ascending: false }).limit(20),
        ]);
        if (rk) setRanks(rk as RankUser[]);
        if (bd) setBadges(bd.flatMap((b: any) => b.badges).filter(Boolean) as Badge[]);
        if (rd) {
          const uniq: Recipe[] = [];
          const names = new Set<string>();
          for (const r of rd) {
            if (r.photo_metadata?.is_recipe && !names.has(r.item_name)) {
              names.add(r.item_name);
              uniq.push(r as Recipe);
            }
          }
          setRecipes(uniq.slice(0, 5));
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
        <Activity size={28} style={{ color: 'var(--amber)' }} className="animate-pulse" />
        <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Loading your dashboard...</p>
      </div>
    );
  }

  // XP progress to next level
  const xpForNextLevel = (profile?.level || 1) * 100;
  const xpProgress = Math.min(((profile?.xp || 0) % xpForNextLevel) / xpForNextLevel * 100, 100);

  const quickActions = [
    { label: "Start Session", icon: Beer, to: "/session", color: 'var(--amber)', bg: 'var(--amber-dim)', emoji: "🍺" },
    { label: "Log Activity", icon: Plus, to: "/log", color: 'var(--sage)', bg: 'var(--sage-dim)', emoji: "✍️" },
    { label: "Live Party", icon: Zap, to: "/live-party", color: 'var(--coral)', bg: 'var(--coral-dim)', emoji: "🎉" },
    { label: "My Groups", icon: Users, to: "/groups", color: 'var(--indigo)', bg: 'var(--indigo-dim)', emoji: "👥" },
    { label: "Party Hub", icon: PartyPopper, to: "/party", color: 'var(--coral)', bg: 'var(--coral-dim)', emoji: "🥳" },
    { label: "World", icon: Globe, to: "/world", color: 'var(--sage)', bg: 'var(--sage-dim)', emoji: "🌍" },
    { label: "Leaderboard", icon: Trophy, to: "/rank", color: 'var(--amber)', bg: 'var(--amber-dim)', emoji: "🏆" },
    { label: "Friends", icon: Users, to: "/social", color: 'var(--indigo)', bg: 'var(--indigo-dim)', emoji: "❤️" },
  ];

  return (
    <div className="space-y-5 pb-24">

      {/* ─── 1. HERO GREETING ─── */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(245,166,35,0.12), rgba(76,175,125,0.06))',
          border: '1px solid rgba(245,166,35,0.18)',
        }}
      >
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'Nunito, sans-serif' }}>
          Hey {profile?.username || 'there'} 👋
        </p>
        <h1 className="text-2xl font-black mb-3" style={{ fontFamily: 'Nunito, sans-serif', color: 'var(--text-primary)' }}>
          Ready for tonight?
        </h1>

        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Level {profile?.level ?? 1}</span>
            <span className="mx-2" style={{ color: 'var(--text-ghost)' }}>·</span>
            <span className="text-xs font-bold" style={{ color: 'var(--amber)' }}>{profile?.xp ?? 0} XP</span>
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            {Math.round(xpProgress)}% to Lv.{(profile?.level ?? 1) + 1}
          </span>
        </div>

        {/* XP progress bar */}
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${xpProgress}%`,
              background: 'linear-gradient(90deg, var(--amber), var(--amber-light))',
              boxShadow: '0 0 8px rgba(245,166,35,0.5)',
            }}
          />
        </div>
      </div>

      {/* ─── 2. QUICK ACTIONS GRID ─── */}
      <section>
        <p className="section-label mb-3">Quick Actions</p>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.to)}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl active:scale-95 transition-all"
                style={{ background: action.bg, border: `1px solid ${action.color}25` }}
              >
                <Icon size={20} style={{ color: action.color }} strokeWidth={2} />
                <span className="text-[10px] font-bold text-center leading-tight" style={{ color: action.color, fontFamily: 'Nunito, sans-serif' }}>
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── 3. AI BARTENDER ─── */}
      <section
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderTopColor: 'rgba(123,143,245,0.25)',
        }}
      >
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito, sans-serif', color: 'var(--text-primary)' }}>
            <Terminal size={14} style={{ color: 'var(--indigo)' }} />
            AI Bartender
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--indigo-dim)', color: 'var(--indigo)' }}>BETA</span>
          </h2>
        </div>

        <div className="p-4 space-y-3">
          {chatReply ? (
            <div className="text-sm leading-relaxed anim-fade" style={{ color: 'var(--text-secondary)' }}>
              {chatReply}
              {referencedRecipes.length > 0 && (
                <div className="mt-3 pt-3 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                  {referencedRecipes.map((name) => (
                    <span key={name} className="text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1" style={{ background: 'var(--indigo-dim)', color: 'var(--indigo)' }}>
                      <BookOpen size={9} /> {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm mb-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                What are you drinking tonight? I know a recipe or two 🍹
              </p>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => { setChatPrompt(qp.prompt); handleChatSend(qp.prompt); }}
                    disabled={chatLoading}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)' }}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatLoading && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--indigo)' }} /> Mixing something up...
            </div>
          )}

          {chatError && (
            <p className="text-xs font-medium px-3 py-2 rounded-lg" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
              ⚠️ {chatError}
            </p>
          )}

          <div className="flex gap-2 items-center rounded-xl p-1.5" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <ChevronRight size={16} style={{ color: 'var(--text-ghost)' }} className="ml-1 shrink-0" />
            <input
              type="text"
              value={chatPrompt}
              onChange={(e) => setChatPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !chatLoading && handleChatSend()}
              placeholder="Ask me anything about drinks..."
              className="w-full bg-transparent outline-none text-sm py-1.5"
              style={{ color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}
              disabled={chatLoading}
            />
            <button
              onClick={() => handleChatSend()}
              disabled={chatLoading || !chatPrompt.trim()}
              className="p-2 rounded-lg transition-all active:scale-90 disabled:opacity-30"
              style={{ background: 'var(--indigo-dim)', color: 'var(--indigo)' }}
            >
              <Send size={15} />
            </button>
          </div>
          <div ref={responseRef} />
        </div>
      </section>

      {/* ─── 4. TOP PERFORMERS ─── */}
      <div className="grid grid-cols-2 gap-4">
        <section className="glass-card" style={{ padding: 16 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)', fontFamily: 'Nunito, sans-serif' }}>
            <Trophy size={12} style={{ color: 'var(--amber)' }} /> Top Players
          </h2>
          <div className="space-y-1.5">
            {ranks.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-ghost)' }}>No data yet</p>
            ) : ranks.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black w-5 text-center" style={{ color: i === 0 ? 'var(--amber)' : i === 1 ? '#A0A0A8' : i === 2 ? '#CD7F32' : 'var(--text-ghost)' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                  <span className="text-sm font-bold truncate max-w-[80px]" style={{ color: 'var(--text-primary)' }}>{r.username}</span>
                </div>
                <span className="text-[11px] font-black" style={{ color: 'var(--amber)' }}>{r.xp} XP</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/rank")}
            className="w-full mt-3 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
            style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}
          >
            Full Board <ArrowRight size={11} />
          </button>
        </section>

        <section className="glass-card" style={{ padding: 16 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)', fontFamily: 'Nunito, sans-serif' }}>
            <UtensilsCrossed size={12} style={{ color: 'var(--coral)' }} /> Recipes
          </h2>
          <div className="space-y-1.5">
            {recipes.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-ghost)' }}>No recipes yet</p>
            ) : recipes.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-1">
                <span className="text-sm font-semibold truncate max-w-[90px]" style={{ color: 'var(--text-primary)' }}>{r.item_name}</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}>+{r.xp_earned}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/log")}
            className="w-full mt-3 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
            style={{ background: 'var(--coral-dim)', color: 'var(--coral)' }}
          >
            Add Recipe <ArrowRight size={11} />
          </button>
        </section>
      </div>

      {/* ─── 5. BADGES ─── */}
      <section className="glass-card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-muted)', fontFamily: 'Nunito, sans-serif' }}>
            <Medal size={12} style={{ color: 'var(--indigo)' }} /> Your Badges
          </h2>
          <button
            onClick={() => navigate("/profile")}
            className="text-xs font-bold flex items-center gap-1"
            style={{ color: 'var(--text-muted)' }}
          >
            See all <ArrowRight size={10} />
          </button>
        </div>

        {badges.length === 0 ? (
          <div className="text-center py-6 rounded-xl" style={{ background: 'var(--bg-raised)', border: '1px dashed var(--border-mid)' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>No badges yet!</p>
            <button
              onClick={() => navigate("/log")}
              className="text-xs font-bold px-4 py-2 rounded-lg"
              style={{ background: 'var(--sage-dim)', color: 'var(--sage)' }}
            >
              Log to earn your first badge
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2">
            {badges.slice(0, 6).map((b) => (
              <div
                key={b.id}
                className="flex flex-col items-center gap-1 p-2 rounded-xl cursor-default hover:scale-105 transition-transform"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}
                title={b.name}
              >
                <span className="text-2xl">{b.icon_text}</span>
                <span className="text-[8px] font-bold text-center leading-tight line-clamp-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
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
