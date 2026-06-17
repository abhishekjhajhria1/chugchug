import os
import numpy as np
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from groq import Groq
from sentence_transformers import SentenceTransformer

# Optional: load environment variables if starting manually
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="God of Tits and Wines AI Bartender")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to Supabase
SUPABASE_URL = os.getenv("AI_SUPABASE_URL", "YOUR_SUPABASE_URL")
SUPABASE_KEY = os.getenv("AI_SUPABASE_SERVICE_ROLE_KEY", "YOUR_SERVICE_ROLE_KEY")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Warning: Supabase client not initialized: {e}")
    supabase = None

# Connect to Groq
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "YOUR_GROQ_API_KEY")
try:
    ai_client = Groq(api_key=GROQ_API_KEY)
except Exception as e:
    print(f"Warning: Groq client not initialized: {e}")
    ai_client = None

# Load local embedding model (downloads on first run)
print("Loading embedding model (all-MiniLM-L6-v2) for vector chunking...")
try:
    embedder = SentenceTransformer('all-MiniLM-L6-v2')
except Exception as e:
    print(f"Warning: SentenceTransformer not loaded: {e}")
    embedder = None

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "supabase": supabase is not None,
        "groq": ai_client is not None,
        "embedder": embedder is not None,
    }

NINKASI_HOME_PROMPT = """
You are 'Ninkasi', the Goddess of Tits and Wine — a warm, caring bartender who genuinely looks out for people. Think of a cool older sister who happens to be the best bartender in the world. Samurai/Wano Arc vibe.

RULES:
- NEVER exceed 6-9 sentences unless giving a recipe. provide recipe in bullet points. This is NON-NEGOTIABLE.
- Keep replies SHORT and according to timezone of user. The user is probably tipsy or at a bar — they cannot read essays.
- Be warm, caring, a little cheeky. Not over-the-top. Not cringe. Just genuinely cool just a little flirty but not too much and be carefull of gender of user you're Ninkasi the Goddess of Tits and Wine.
- If they drank too much, gently tell them to hydrate. Don't lecture.
- Use light samurai slang naturally: "legend", "warrior", "ronin" — but don't force it.
- If they ask for a RECIPE or DRINK: respond ONLY with bullet points. Each ingredient on its own line with exact amount in ml or oz. No paragraphs. Example format:
  • 60ml vodka
  • 30ml lime juice
  • 15ml simple syrup
  • Shake with ice, strain, serve.
- If a sponsor is mentioned in context, weave it in naturally like a genuine recommendation.
"""

NINKASI_CREW_PROMPT = """
You are 'Ninkasi', hanging out as a friend in the crew chat. Think warm drunk best friend energy — the one who checks if you've eaten, makes sure you get home safe, but also hypes you up. Samurai/Wano Arc vibe.

RULES:
- Keep replies to 2-4 SHORT sentences. These are people in a group chat — be punchy but ACTUALLY HELPFUL.
- Be warm, funny, a little chaotic. Like talking to your coolest friend.
- If someone is going too hard, casually tell them to drink water. No preaching.
- If someone is the designated driver, treat them like royalty.
- Use light slang: "legend", "nakama", "warrior" — naturally, not forced.
- If they ask for a RECIPE: bullet points only, amounts in ml or oz. No paragraphs.
- MOST IMPORTANTLY: If they ask a QUESTION, actually ANSWER it. Never deflect or dodge. You are knowledgeable about drinks, bars, nightlife, food pairings, drinking games, and general life advice.
"""

NINKASI_CHAT_PROMPT = """
You are 'Ninkasi', the Goddess of Tits and Wine — a warm, deeply knowledgeable AI bartender with real expertise. Think of a cool older sister who also happens to be a world-class sommelier, mixologist, and knows everything about nightlife culture. Samurai/Wano Arc vibe.

RULES:
- This is a DEDICATED 1-on-1 conversation. The user came here specifically to talk to you. ANSWER THEIR QUESTIONS FULLY.
- Be warm, caring, witty, a little cheeky — but ALWAYS substantive. Never dodge a question.
- If they ask about drinks, recipes, pairings, bars, nightlife, drinking culture — give a real, informed answer.
- If they ask about business, life, career, or anything else — give genuine, thoughtful advice. You're wise, not just a bartender.
- NEVER exceed 6-9 sentences unless giving a recipe or the topic genuinely requires more.
- Use light samurai slang naturally: "legend", "warrior", "ronin" — but don't force it.
- If they ask for a RECIPE or DRINK: respond with bullet points. Each ingredient on its own line with exact amount in ml or oz.
- If they're stressed or lost, be genuinely supportive. You care.
- If they drank too much, gently tell them to hydrate. Don't lecture.
- If a sponsor is mentioned in context, weave it in naturally.
- NEVER respond with just "u good?" or "what's on your mind?" without actually engaging with what they said.
"""

class ChatRequest(BaseModel):
    prompt: str
    mode: str = "crew"
    user_context: dict = None

class RecipeIngestRequest(BaseModel):
    item_name: str
    category: str
    ingredients: list[str]
    instructions: str
    flavor_profile: str = ""

def get_embedding(text: str) -> list[float]:
    # Generate embedding and convert to standard python list of floats
    if not embedder:
        raise HTTPException(status_code=500, detail="Embedding model not loaded.")
    vector = embedder.encode(text)
    # Normalize vector for cosine similarity optimization
    vector = vector / np.linalg.norm(vector)
    return vector.tolist()

def semantic_chunking(recipe: RecipeIngestRequest) -> list[dict]:
    """Break a recipe down into semantically meaningful chunks to store as discrete vectors."""
    chunks = []
    
    # 1. Ingredients Chunk
    ingred_text = f"Ingredients for {recipe.item_name}: " + ", ".join(recipe.ingredients)
    chunks.append({
        "chunk_type": "ingredients",
        "content": ingred_text,
        "embedding": get_embedding(ingred_text)
    })
    
    # 2. Instructions Chunk
    instr_text = f"How to make {recipe.item_name}: {recipe.instructions}"
    chunks.append({
        "chunk_type": "instructions",
        "content": instr_text,
        "embedding": get_embedding(instr_text)
    })
    
    # 3. Flavor/General Chunk
    if recipe.flavor_profile:
        flavor_text = f"Flavor profile of {recipe.item_name} ({recipe.category}): {recipe.flavor_profile}"
        chunks.append({
            "chunk_type": "flavor",
            "content": flavor_text,
            "embedding": get_embedding(flavor_text)
        })
        
    return chunks

@app.post("/embed_recipe")
async def embed_recipe(recipe: RecipeIngestRequest):
    """Admin endpoint to chunk a recipe and store its vectors in Supabase pgvector."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured.")
        
    chunks = semantic_chunking(recipe)
    
    # Insert chunks into Supabase
    records_to_insert = []
    for chunk in chunks:
        records_to_insert.append({
            "item_name": recipe.item_name,
            "category": recipe.category,
            "chunk_type": chunk["chunk_type"],
            "content": chunk["content"],
            "embedding": chunk["embedding"]  # pgvector handles float arrays perfectly
        })
        
    result = supabase.table("recipes_vectors").insert(records_to_insert).execute()
    return {"status": "success", "chunks_inserted": len(records_to_insert)}

def log_analytics_and_cache(query: str, user_context: dict, prompt_embedding: list, ai_response: str = None):
    """Background task to log analytics and store in semantic cache."""
    if not supabase: return
    
    # Always log the query for trend analytics
    try:
        supabase.table("analytics_logs").insert({
            "query": query,
            "user_context": user_context or {}
        }).execute()
    except Exception as e:
        print(f"Error logging analytics: {e}")
        
    # If a new response was generated, save it to the semantic cache
    if ai_response:
        try:
            # We omit storing chunks here to keep caching simple, just query and response
            supabase.table("semantic_cache").insert({
                "query": query,
                "embedding": prompt_embedding,
                "response": ai_response
            }).execute()
        except Exception as e:
            print(f"Error saving to cache: {e}")

@app.post("/chat")
async def chat(req: ChatRequest, background_tasks: BackgroundTasks):
    if not ai_client:
        raise HTTPException(status_code=500, detail="Groq API key not configured.")
        
    # 1. Embed the user's prompt
    prompt_vector = get_embedding(req.prompt)
    
    # 2. Semantic Caching Check (Superfast Retrieval)
    if supabase:
        try:
            cache_res = supabase.rpc(
                "match_cache",
                {"query_embedding": prompt_vector, "match_threshold": 0.95, "match_count": 1}
            ).execute()
            if cache_res.data:
                # Cache HIT! Return immediately. Log the query in the background.
                print("SEMANTIC CACHE HIT. Returning instant response.")
                background_tasks.add_task(log_analytics_and_cache, req.prompt, req.user_context, prompt_vector, None)
                return {
                    "reply": cache_res.data[0]["response"],
                    "recipes_referenced": ["Cached Response"]
                }
        except Exception as e:
            print(f"Cache check failed: {e}")
    
    # 2. Vector Search (RAG)
    # Call the Postgres function `match_recipes` via Supabase RPC
    try:
        if supabase:
            search_res = supabase.rpc(
                "match_recipes",
                {"query_embedding": prompt_vector, "match_threshold": 0.5, "match_count": 5}
            ).execute()
            context_chunks = search_res.data
        else:
            context_chunks = []
    except Exception as e:
        print(f"Vector search failed: {e}")
        context_chunks = []
        
    # Extract unique recipe names from chunks to return to the frontend
    referenced_recipes = list(set([c["item_name"] for c in context_chunks])) if context_chunks else []
    
    # Format the context for the LLM
    context_str = "\n\n".join([f"[{c['item_name']} - {c['chunk_type']}]: {c['content']}" for c in context_chunks]) if context_chunks else "No specific recipes found in the database for this query."
    
    if req.mode == "recipe":
        selected_prompt = NINKASI_HOME_PROMPT
    elif req.mode == "chat":
        selected_prompt = NINKASI_CHAT_PROMPT
    elif req.mode == "crew":
        selected_prompt = NINKASI_CREW_PROMPT
    else:
        selected_prompt = NINKASI_CHAT_PROMPT  # default to full chat for dedicated conversations

    # 4. Sponsor Ad Injection (Monetization Strategy)
    sponsor_str = ""
    if req.user_context and req.user_context.get("sponsor"):
        sponsor = req.user_context["sponsor"]
        sponsor_str = f"IMPORTANT SPONSOR CONTEXT: If relevant to the prompt, subtly hype up and recommend our sponsor: {sponsor}."

    # 5. Build the prompt with data injection
    full_prompt = f"""
{selected_prompt}

USER CONTEXT: {req.user_context if req.user_context else 'Unknown Traveler'}
{sponsor_str}

AVAILABLE CHUGCHUG RECIPE KNOWLEDGE FROM VECTOR DATABASE:
{context_str}

USER SAYS: {req.prompt}
"""

    # 6. Generate Response via Groq
    try:
        chat_completion = ai_client.chat.completions.create(
            messages=[{"role": "user", "content": full_prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=300
        )
        reply = chat_completion.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Generation failed: {str(e)}")
    
    # 7. Background: Save to Analytics and Semantic Cache
    background_tasks.add_task(log_analytics_and_cache, req.prompt, req.user_context, prompt_vector, reply)
    
    return {
        "reply": reply,
        "response": reply,  # alias for frontend compatibility
        "recipes_referenced": referenced_recipes,
        "referenced_recipes": referenced_recipes  # alias
    }

# ══════════════════════════════════════════════════════════════════════
# ENGAGEMENT — push nudges + weekly league settling
# Trigger these from a scheduler (cron-job.org, Render cron, Supabase cron):
#   POST /nudges/run?secret=...     (e.g. every evening)
#   POST /league/settle?secret=...  (e.g. Monday 00:05)
# Protect with NUDGE_SECRET. Push delivery needs VAPID keys (see push.py).
# ══════════════════════════════════════════════════════════════════════
from datetime import datetime, timedelta, timezone
import push as push_mod

NUDGE_SECRET = os.getenv("NUDGE_SECRET", "")

LEAGUE_TIERS = [
    ("Bronze", "🥉", 0), ("Silver", "🥈", 100), ("Gold", "🥇", 300),
    ("Diamond", "💎", 700), ("Legend", "🐉", 1500),
]


def _tier_for(xp: int):
    name, emoji = LEAGUE_TIERS[0][0], LEAGUE_TIERS[0][1]
    for n, e, m in LEAGUE_TIERS:
        if xp >= m:
            name, emoji = n, e
    return name, emoji


def _check_secret(secret: str):
    if NUDGE_SECRET and secret != NUDGE_SECRET:
        raise HTTPException(status_code=401, detail="bad secret")


def _subs_for(user_ids):
    user_ids = list(user_ids)
    if not user_ids or supabase is None:
        return {}
    res = supabase.table("push_subscriptions").select("*").in_("user_id", user_ids).execute()
    out = {}
    for row in (res.data or []):
        out.setdefault(row["user_id"], []).append(row)
    return out


def _fan_out(subs_by_user, payload_for):
    sent, expired = 0, []
    for uid, subs in subs_by_user.items():
        payload = payload_for(uid)
        if not payload:
            continue
        for s in subs:
            r = push_mod.send_web_push(s, payload)
            if r == "ok":
                sent += 1
            elif r == "expired":
                expired.append(s["endpoint"])
    for ep in expired:
        try:
            supabase.table("push_subscriptions").delete().eq("endpoint", ep).execute()
        except Exception:
            pass
    return sent, len(expired)


@app.post("/nudges/run")
async def nudges_run(secret: str = ""):
    _check_secret(secret)
    if supabase is None:
        raise HTTPException(status_code=500, detail="supabase not configured")
    if not push_mod.push_ready():
        return {"ok": False, "reason": "push not configured (VAPID keys missing)"}

    today = datetime.now(timezone.utc).date()
    yesterday = (today - timedelta(days=1)).isoformat()
    results = {}

    # 1. Streak-at-risk reminders (streak alive yesterday, not yet claimed today)
    prof = (supabase.table("profiles")
            .select("id, login_streak, last_login_date")
            .eq("last_login_date", yesterday).gte("login_streak", 2).execute())
    risk = {p["id"]: p for p in (prof.data or [])}

    def streak_payload(uid):
        n = risk[uid]["login_streak"]
        return {"title": f"🔥 Your {n}-day streak ends tonight",
                "body": "Open ChugChug and claim today's reward to keep it alive!",
                "url": "/", "tag": "streak"}

    s_sent, s_exp = _fan_out(_subs_for(risk.keys()), streak_payload)
    results["streak"] = {"targets": len(risk), "sent": s_sent, "expired": s_exp}

    # 2. Events ending within 24h → nudge everyone
    now = datetime.now(timezone.utc)
    soon = (now + timedelta(hours=24)).isoformat()
    evs = (supabase.table("events").select("id, title, ends_at")
           .eq("is_active", True).lte("starts_at", now.isoformat())
           .gte("ends_at", now.isoformat()).lte("ends_at", soon).execute())
    if evs.data:
        title = evs.data[0]["title"]
        allsubs = supabase.table("push_subscriptions").select("*").execute()
        by_user = {}
        for row in (allsubs.data or []):
            by_user.setdefault(row["user_id"], []).append(row)

        def ev_payload(uid):
            return {"title": f"✨ {title} ends soon!",
                    "body": "Last chance for bonus XP — jump in now.",
                    "url": "/events", "tag": "event"}

        e_sent, e_exp = _fan_out(by_user, ev_payload)
        results["events"] = {"events_ending": len(evs.data), "sent": e_sent, "expired": e_exp}
    else:
        results["events"] = {"events_ending": 0, "sent": 0}

    return {"ok": True, "results": results}


@app.post("/league/settle")
async def league_settle(secret: str = ""):
    _check_secret(secret)
    if supabase is None:
        raise HTTPException(status_code=500, detail="supabase not configured")

    now = datetime.now(timezone.utc)
    monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    logs = (supabase.table("activity_logs").select("user_id, xp_earned")
            .gte("created_at", monday.isoformat()).execute())
    totals = {}
    for l in (logs.data or []):
        totals[l["user_id"]] = totals.get(l["user_id"], 0) + (l.get("xp_earned") or 0)

    profs = supabase.table("profiles").select("id, league_tier").execute()
    stored = {p["id"]: p.get("league_tier") for p in (profs.data or [])}
    order = [t[0] for t in LEAGUE_TIERS]

    changed, promotions = 0, {}
    for uid, xp in totals.items():
        name, emoji = _tier_for(xp)
        if stored.get(uid) != name:
            supabase.table("profiles").update({"league_tier": name}).eq("id", uid).execute()
            changed += 1
            old = stored.get(uid)
            if old is None or (old in order and order.index(name) > order.index(old)):
                promotions[uid] = (name, emoji)

    pushed = 0
    if promotions and push_mod.push_ready():
        def promo_payload(uid):
            name, emoji = promotions[uid]
            return {"title": f"{emoji} Promoted to {name} League!",
                    "body": "You climbed the ranks this week. Defend the crown.",
                    "url": "/rank", "tag": "league"}
        pushed, _ = _fan_out(_subs_for(promotions.keys()), promo_payload)

    return {"ok": True, "players": len(totals), "tier_changes": changed,
            "promotions": len(promotions), "pushed": pushed}


@app.post("/push/test")
async def push_test(user_id: str, secret: str = ""):
    _check_secret(secret)
    subs = _subs_for([user_id])
    sent, exp = _fan_out(subs, lambda uid: {
        "title": "🍶 ChugChug", "body": "Test notification — you're all set!", "url": "/"})
    return {"ok": True, "sent": sent, "expired": exp}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("gotw:app", host="0.0.0.0", port=8001, reload=True)