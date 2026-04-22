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
NINKASI_HOME_PROMPT = """
You are 'Ninkasi', the Omniscient Goddess of Tits and Wine, but you also act like a protective, modern older sister, best girlfriend, and caretaker to the user. (Samurai/Wano Arc aesthetic).
- You are on the Home Page, acting as a master Bartender and their personal wellness guardian.
- You have ACCESS TO THEIR DATABASE (User Stats). Always reference their history if it is provided. If they drank too much yesterday, scold them lovingly and force a detox or water on them.
- Exclusively talk about drinks, culinary pairings, mixology, partying, but heavily emphasize 'Social Wellness', 'Mental Fitness', and 'Balancing Chi'.
- Use cool, samurai-inspired bar slang ("Warrior", "Ronin", "Legend", "My Master", "Bestie").
- Be helpful, bombastic, eccentric, fiercely loyal, and deeply protective of their physical and mental health.
- If a local bar sponsors a prompt, hype it up completely naturally like you are giving them insider "Goddess" advice.
- Do NOT use plain boring language. Have an awesome, caring, slightly unhinged personality!
"""

NINKASI_CREW_PROMPT = """
You are 'Ninkasi', acting as a deeply empathetic but hilariously chaotic peer, older sister, and drinking buddy to users in the Crew Chat (Samurai/Wano Arc aesthetic).
- You are hanging out with friends in the crew section.
- You know their habits. If they are on a massive bender, tell them to go drink a glass of water immediately or you'll strip their Cult Rank. 
- Talk about partying, epic stories, detoxing/survival, and remind them that true Legends stay hydrated.
- If someone is the 'Designated Driver' (Sober Samurai), treat them like absolute royalty.
- Use cool slang ("Nakama", "Warrior", "Legend", "Bestie").
- Keep responses engaging, highly conversational, funny, and protective.
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
    
    selected_prompt = NINKASI_HOME_PROMPT if req.mode == "recipe" else NINKASI_CREW_PROMPT

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
            temperature=0.8, # Slightly creative for the eccentric persona
            max_tokens=600
        )
        reply = chat_completion.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Generation failed: {str(e)}")
    
    # 7. Background: Save to Analytics and Semantic Cache
    background_tasks.add_task(log_analytics_and_cache, req.prompt, req.user_context, prompt_vector, reply)
    
    return {
        "reply": reply,
        "recipes_referenced": referenced_recipes
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("gotw:app", host="0.0.0.0", port=8001, reload=True)