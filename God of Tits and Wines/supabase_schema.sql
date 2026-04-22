-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store your recipe chunks and their embeddings
-- We use a 384-dimensional vector because all-MiniLM-L6-v2 outputs 384 dimensions.
create table if not exists recipes_vectors (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text, 
  chunk_type text not null, -- 'ingredients', 'instructions', 'flavor'
  content text not null,
  embedding vector(384),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create an HNSW index to make vector similarity searches incredibly fast
-- We use vector_cosine_ops for cosine similarity
create index on recipes_vectors using hnsw (embedding vector_cosine_ops);

-- Create a Postgres function (RPC) to perform similarity search
-- This allows the Supabase client to call `.rpc('match_recipes', ...)`
create or replace function match_recipes (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  item_name text,
  category text,
  chunk_type text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    recipes_vectors.id,
    recipes_vectors.item_name,
    recipes_vectors.category,
    recipes_vectors.chunk_type,
    recipes_vectors.content,
    1 - (recipes_vectors.embedding <=> query_embedding) as similarity
  from recipes_vectors
  where 1 - (recipes_vectors.embedding <=> query_embedding) > match_threshold
  order by recipes_vectors.embedding <=> query_embedding
  limit match_count;
$$;

-- SEMANTIC CACHING FOR AI --
create table if not exists semantic_cache (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  embedding vector(384), -- Matches the existing 384 size from miniLM
  response text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index on semantic_cache using hnsw (embedding vector_cosine_ops);

create or replace function match_cache (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  query text,
  response text,
  similarity float
)
language sql stable
as $$
  select
    semantic_cache.id,
    semantic_cache.query,
    semantic_cache.response,
    1 - (semantic_cache.embedding <=> query_embedding) as similarity
  from semantic_cache
  where 1 - (semantic_cache.embedding <=> query_embedding) > match_threshold
  order by semantic_cache.embedding <=> query_embedding
  limit match_count;
$$;

-- MONETIZATION & ANALYTICS LOGS --
create table if not exists analytics_logs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  user_context jsonb, -- e.g., {"location": "NYC", "age": 21}
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
