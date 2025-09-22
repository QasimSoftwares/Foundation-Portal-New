-- supabase/migrations/20250922235000_events_module.sql
-- Purpose: Add event_status enum/column and RPCs for Events module.

-- 1) Create enum event_status if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE public.event_status AS ENUM ('active', 'completed', 'cancelled');
  END IF;
END $$;

-- 2) Alter events table: add event_status column with default 'active'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'event_status'
  ) THEN
    ALTER TABLE public.events
    ADD COLUMN event_status public.event_status NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- 3) RPC: create_event
-- Inserts a new event; event_status defaults to 'active'
CREATE OR REPLACE FUNCTION public.create_event(
  p_event_name text,
  p_location text,
  p_volunteers_required integer,
  p_aim_of_event text,
  p_start_date date,
  p_end_date date,
  p_site_status public.site_status,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.events (
    event_id,
    event_name,
    location,
    volunteers_required,
    aim_of_event,
    start_date,
    end_date,
    site_status,
    event_created_by,
    event_created_at,
    event_status
  ) VALUES (
    gen_random_uuid(),
    p_event_name,
    p_location,
    p_volunteers_required,
    p_aim_of_event,
    p_start_date,
    p_end_date,
    p_site_status,
    p_created_by,
    now(),
    'active'
  ) RETURNING event_id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_event(text, text, integer, text, date, date, public.site_status, uuid) TO authenticated;

-- 4) RPC: get_event_metrics
CREATE OR REPLACE FUNCTION public.get_event_metrics()
RETURNS TABLE (
  total_events integer,
  active_events integer,
  completed_events integer,
  cancelled_events integer,
  total_volunteers_required integer
)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT 
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE event_status = 'active') AS active_events,
    COUNT(*) FILTER (WHERE event_status = 'completed') AS completed_events,
    COUNT(*) FILTER (WHERE event_status = 'cancelled') AS cancelled_events,
    COALESCE(SUM(volunteers_required), 0) AS total_volunteers_required
  FROM public.events;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_metrics() TO authenticated;

-- 5) RPC: list_events
CREATE OR REPLACE FUNCTION public.list_events()
RETURNS TABLE (
  event_id uuid,
  event_name text,
  location text,
  volunteers_required integer,
  event_status public.event_status,
  start_date date,
  end_date date
)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT e.event_id, e.event_name, e.location, e.volunteers_required, e.event_status, e.start_date, e.end_date
  FROM public.events e
  ORDER BY e.start_date DESC NULLS LAST, e.event_created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_events() TO authenticated;

-- 6) RPC: update_event
-- Updates an existing event; any NULL parameter keeps the existing value
CREATE OR REPLACE FUNCTION public.update_event(
  p_event_id uuid,
  p_event_name text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_volunteers_required integer DEFAULT NULL,
  p_aim_of_event text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_site_status public.site_status DEFAULT NULL,
  p_event_status public.event_status DEFAULT NULL,
  p_updated_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.events e
  SET
    event_name = COALESCE(p_event_name, e.event_name),
    location = COALESCE(p_location, e.location),
    volunteers_required = COALESCE(p_volunteers_required, e.volunteers_required),
    aim_of_event = COALESCE(p_aim_of_event, e.aim_of_event),
    start_date = COALESCE(p_start_date, e.start_date),
    end_date = COALESCE(p_end_date, e.end_date),
    site_status = COALESCE(p_site_status, e.site_status),
    event_status = COALESCE(p_event_status, e.event_status),
    event_updated_by = COALESCE(p_updated_by, e.event_updated_by),
    event_updated_at = now()
  WHERE e.event_id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_event(uuid, text, text, integer, text, date, date, public.site_status, public.event_status, uuid) TO authenticated;
