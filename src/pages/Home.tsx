import { useState, useEffect, useRef } from "react";
import {
  Loader2, BookOpen, ArrowRight, Swords, Skull
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
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [chatPrompt, setChatPrompt] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [referencedRecipes, setReferencedRecipes] = useState<string[]>([]);
  const [chatError, setChatError] = useState("");
  const responseRef = useRef<HTMLDivElement>(null);
  const BARTENDER_API = import.meta.env.VITE_BARTENDER_API?.trim() || "";

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



  const xpForNextLevel = (profile?.level || 1) * 100;
  const xpProgress = Math.min(((profile?.xp || 0) % xpForNextLevel) / xpForNextLevel * 100, 100);

  const quickActions = [
    { label: "Host Sesh", to: "/session", color: 'var(--amber)', bg: 'var(--amber-dim)', emoji: "🏮" },
    { label: "Log Drink", to: "/log", color: 'var(--acid)', bg: 'var(--acid-dim)', emoji: "✍️" },
    { label: "Live Party", to: "/live-party", color: 'var(--coral)', bg: 'var(--coral-dim)', emoji: "🎊" },
    { label: "Splitwise", to: "/groups", color: 'var(--acid)', bg: 'var(--acid-dim)', emoji: "💸" },
    { label: "My Crew", to: "/groups", color: 'var(--amber)', bg: 'var(--amber-dim)', emoji: "👥" },
    { label: "Taverns", to: "/party", color: 'var(--coral)', bg: 'var(--coral-dim)', emoji: "🏯" },
    { label: "Explore", to: "/world", color: 'var(--acid)', bg: 'var(--acid-dim)', emoji: "🗺️" },
    { label: "Shogun Rank", to: "/rank", color: 'var(--amber)', bg: 'var(--amber-dim)', emoji: "👑" },
  ];

  return (
    <div className="space-y-6 pb-6 wano-fade">

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
        className="p-5 flex flex-col justify-between relative overflow-hidden"
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
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                Welcome, {profile?.username || 'Traveler'}
              </p>
              <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                The Night is Young ⚔️
              </h1>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
              Lv. {profile?.level ?? 1} Samurai
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
                background: 'var(--amber)',
                boxShadow: 'var(--amber-glow)',
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── 2. KATANA GRID QUICK ACTIONS ─── */}
      <section>
        <p className="section-label mb-3 border-l-2 pl-2" style={{ borderColor: 'var(--coral)' }}>What is your decree? 📜</p>
        <div className="grid grid-cols-4 gap-2">
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
        className="overflow-hidden"
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
      <div className="grid grid-cols-2 gap-3">
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
      <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: 18 }}>
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
