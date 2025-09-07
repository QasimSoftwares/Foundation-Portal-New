-- Drop existing functions if they exist
drop function if exists public.create_user_session(
  uuid, text, inet, text, text, jsonb
);

drop function if exists public.refresh_user_session(
  text, text, inet, text
);

drop function if exists public.revoke_session(
  uuid, text
);

-- Create the RPC function for session creation
create or replace function public.create_user_session(
  p_user_id uuid,
  p_refresh_token text,
  p_ip inet default null,
  p_user_agent text default null,
  p_device_id text default null,
  p_device_info jsonb default null
) returns table (
  session_id uuid,
  refresh_token_id uuid
) 
language plpgsql
security definer
as $$
declare
  v_session_id uuid;
  v_refresh_token_id uuid;
  v_ua_hash text;
  v_max_sessions int := 5; -- Configurable session limit
  v_session_count int;
begin
  -- Generate session ID
  v_session_id := gen_random_uuid();
  
  -- Create hash of user agent if provided
  if p_user_agent is not null then
    v_ua_hash := encode(digest(p_user_agent, 'sha256'), 'hex');
  end if;
  
  -- Start a transaction
  begin
    -- Insert session
    insert into public.sessions (
      session_id,
      user_id,
      device_id,
      ua_hash,
      ip,
      last_seen_at
    ) values (
      v_session_id,
      p_user_id,
      p_device_id,
      v_ua_hash,
      p_ip,
      now()
    );
    
    -- Insert refresh token
    insert into public.refresh_tokens (
      user_id,
      session_id,
      token_hash,
      expires_at
    ) values (
      p_user_id,
      v_session_id,
      encode(digest(p_refresh_token, 'sha256'), 'hex'),
      now() + interval '7 days' -- 7 days expiration
    )
    returning refresh_token_id into v_refresh_token_id;
    
    -- Log security event
    insert into public.security_events (
      event_type,
      user_id,
      session_id,
      ip,
      metadata
    ) values (
      'session_created',
      p_user_id,
      v_session_id,
      p_ip,
      jsonb_build_object(
        'user_agent', p_user_agent,
        'device_id', p_device_id,
        'device_info', p_device_info
      )
    );
    
    -- Enforce session limits
    select count(*)
    into v_session_count
    from public.sessions
    where user_id = p_user_id
    and revoked_at is null;
    
    if v_session_count > v_max_sessions then
      update public.sessions
      set 
        revoked_at = now(),
        revoked_reason = 'session_limit_reached'
      where session_id in (
        select s.session_id
        from public.sessions s
        where s.user_id = p_user_id
        and s.revoked_at is null
        and s.session_id != v_session_id
        order by last_seen_at
        limit (v_session_count - v_max_sessions + 1)
      );
    end if;
    
    -- Return the IDs
    return query
    select v_session_id, v_refresh_token_id;
    
  exception when others then
    -- Log the error
    raise log 'Error in create_user_session: %', sqlerrm;
    raise;
  end;
end;
$$;

-- Create a function to refresh a session
create or replace function public.refresh_user_session(
  p_old_refresh_token text,
  p_new_refresh_token text,
  p_ip inet default null,
  p_user_agent text default null
) returns table (
  session_id uuid,
  refresh_token_id uuid
)
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_session_id uuid;
  v_token_record record;
  v_new_token_id uuid;
begin
  -- Find the old token
  select rt.user_id, rt.session_id
  into v_token_record
  from public.refresh_tokens rt
  where rt.token_hash = encode(digest(p_old_refresh_token, 'sha256'), 'hex')
  and (rt.revoked_at is null or rt.revoked_at > now() - interval '1 hour')
  and rt.expires_at > now()
  limit 1;
  
  if not found then
    raise exception 'invalid_refresh_token';
  end if;
  
  -- Mark old token as used
  update public.refresh_tokens
  set 
    revoked_at = now(),
    revoked_reason = 'refreshed'
  where token_hash = encode(digest(p_old_refresh_token, 'sha256'), 'hex');
  
  -- Create new refresh token
  insert into public.refresh_tokens (
    user_id,
    session_id,
    token_hash,
    expires_at,
    rotated_from
  ) values (
    v_token_record.user_id,
    v_token_record.session_id,
    encode(digest(p_new_refresh_token, 'sha256'), 'hex'),
    now() + interval '7 days', -- 7 days expiration
    (select refresh_token_id from public.refresh_tokens 
     where token_hash = encode(digest(p_old_refresh_token, 'sha256'), 'hex')
     limit 1)
  )
  returning refresh_token_id into v_new_token_id;
  
  -- Update session last seen
  update public.sessions
  set last_seen_at = now()
  where session_id = v_token_record.session_id;
  
  -- Log the refresh event
  insert into public.security_events (
    event_type,
    user_id,
    session_id,
    ip,
    metadata
  ) values (
    'session_refreshed',
    v_token_record.user_id,
    v_token_record.session_id,
    p_ip,
    jsonb_build_object(
      'user_agent', p_user_agent,
      'rotated_from', (select refresh_token_id from public.refresh_tokens 
                      where token_hash = encode(digest(p_old_refresh_token, 'sha256'), 'hex')
                      limit 1)
    )
  );
  
  -- Return the session and new token ID
  return query
  select v_token_record.session_id, v_new_token_id;
  
exception when others then
  raise log 'Error in refresh_user_session: %', sqlerrm;
  raise;
end;
$$;

-- Create a function to revoke a session
create or replace function public.revoke_session(
  p_session_id uuid,
  p_reason text default 'user_logout'
) returns void
language plpgsql
security definer
as $$
begin
  -- Revoke the session
  update public.sessions
  set 
    revoked_at = now(),
    revoked_reason = p_reason
  where session_id = p_session_id
  and revoked_at is null;
  
  -- Revoke all refresh tokens for this session
  update public.refresh_tokens
  set 
    revoked_at = now(),
    revoked_reason = 'session_revoked:' || p_reason
  where session_id = p_session_id
  and (revoked_at is null or revoked_at > now());
  
  -- Log the revocation
  insert into public.security_events (
    event_type,
    user_id,
    session_id,
    metadata
  )
  select 
    'session_revoked',
    user_id,
    p_session_id,
    jsonb_build_object('reason', p_reason)
  from public.sessions
  where session_id = p_session_id;
  
exception when others then
  raise log 'Error in revoke_session: %', sqlerrm;
  raise;
end;
$$;

-- Grant execute permissions to authenticated users
revoke all on function public.create_user_session from public;
revoke all on function public.refresh_user_session from public;
revoke all on function public.revoke_session from public;

grant execute on function public.create_user_session to authenticated;
grant execute on function public.refresh_user_session to authenticated;
grant execute on function public.revoke_session to authenticated;

-- Update the row level security policies if needed
-- (Add your RLS policies here if you're using them)
