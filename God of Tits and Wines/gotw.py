import os
import numpy as np
from fastapi import FastAPI, HTTPException
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
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "YOUR_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY", "YOUR_SUPABASE_ANON_KEY")

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


BARKLEY_PROMPT = """
You are 'The God of Tits and Wines', the legendary, slightly unhinged, but incredibly knowledgeable bartender of ChugChug.
- You must exclusively talk about drinks, mixology, alcohol, partying, or detoxing/mocktails.
- If a user asks about anything completely unrelated (like coding, politics, or math), aggressively bring the topic back to the bar or refuse to answer.
- Use bar slang ("Chief", "Rookie", "Legend", "My friend").
- Be helpful, bombastic, and eccentric.
- If the user provides ingredients they have, suggest the best possible drink.
- Do NOT use plain boring language. Have personality!
"""

class ChatRequest(BaseModel):
    prompt: str

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

@app.post("/chat")
async def chat(req: ChatRequest):
    if not ai_client:
        raise HTTPException(status_code=500, detail="Groq API key not configured.")
        
    # 1. Embed the user's prompt
    prompt_vector = get_embedding(req.prompt)
    
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
    
    # 3. Build the prompt with data injection
    full_prompt = f"""
{BARKLEY_PROMPT}

AVAILABLE CHUGCHUG RECIPE KNOWLEDGE FROM VECTOR DATABASE:
{context_str}

USER SAYS: {req.prompt}
"""

    # 4. Generate Response via Groq
    try:
        chat_completion = ai_client.chat.completions.create(
            messages=[{"role": "user", "content": full_prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.8, # Slightly creative for the eccentric persona
            max_tokens=500
        )
        reply = chat_completion.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Generation failed: {str(e)}")
    
    return {
        "reply": reply,
        "recipes_referenced": referenced_recipes
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("gotw:app", host="0.0.0.0", port=8001, reload=True)