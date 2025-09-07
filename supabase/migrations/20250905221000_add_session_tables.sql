-- Sessions, Refresh Tokens, and Security Events schema
-- Run via Supabase migrations

-- Sessions table
create table if not exists public.sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text,
  ua_hash text,
  ip text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text
);

create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_revoked_at on public.sessions(revoked_at);

-- Refresh tokens table
create table if not exists public.refresh_tokens (
  refresh_token_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(session_id) on delete cascade,
  token_hash text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  rotated_from uuid references public.refresh_tokens(refresh_token_id) on delete set null,
  revoked_at timestamptz,
  reused_at timestamptz,
  revoked_reason text,
  constraint refresh_tokens_token_hash_key unique (token_hash)
);

create index if not exists idx_refresh_tokens_user_id on public.refresh_tokens(user_id);
create index if not exists idx_refresh_tokens_session_id on public.refresh_tokens(session_id);

-- Security events table
create table if not exists public.security_events (
  security_event_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  ip text,
  ua_hash text,
  created_at timestamptz not null default now(),
  metadata jsonb
);

create index if not exists idx_security_events_user_id on public.security_events(user_id);
create index if not exists idx_security_events_type on public.security_events(event_type);
