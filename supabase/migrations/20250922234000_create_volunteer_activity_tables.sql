-- supabase/migrations/20250922234000_create_volunteer_activity_tables.sql
-- Purpose: Create tables for volunteer activities, requests, and events.

-- 1. Create required enums (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'type_of_activity') THEN
        CREATE TYPE public.type_of_activity AS ENUM ('project_management', 'field_work', 'tech_work', 'admin_work');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'site_status') THEN
        CREATE TYPE public.site_status AS ENUM ('on_site', 'remote');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'volunteer_activity_status') THEN
        CREATE TYPE public.volunteer_activity_status AS ENUM ('pending', 'approved', 'rejected', 'revised');
    END IF;
END
$$;

-- 2. Create events table
CREATE TABLE public.events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  location text,
  volunteers_required integer,
  aim_of_event text,
  start_date date NOT NULL,
  end_date date,
  site_status public.site_status NOT NULL,
  event_created_by uuid REFERENCES auth.users(id) NOT NULL,
  event_created_at timestamptz DEFAULT now() NOT NULL,
  event_updated_by uuid REFERENCES auth.users(id),
  event_updated_at timestamptz
);

COMMENT ON TABLE public.events IS 'Stores information about volunteering events.';

-- 3. Create volunteer_activity_requests table
CREATE TABLE public.volunteer_activity_requests (
  volunteer_activity_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid REFERENCES public.volunteers(volunteer_id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(event_id) ON DELETE SET NULL,
  hours_contributed integer NOT NULL,
  type_of_activity public.type_of_activity NOT NULL,
  people_helped integer,
  site_status public.site_status NOT NULL,
  description text,
  volunteer_activity_status public.volunteer_activity_status DEFAULT 'pending',
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.volunteer_activity_requests IS 'Volunteers submit requests here for activity approval.';

-- 4. Create volunteer_activities table
CREATE TABLE public.volunteer_activities (
  volunteer_activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid REFERENCES public.volunteers(volunteer_id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(event_id) ON DELETE SET NULL,
  hours_contributed integer NOT NULL,
  type_of_activity public.type_of_activity NOT NULL,
  people_helped integer,
  site_status public.site_status NOT NULL,
  description text,
  approved_by uuid REFERENCES auth.users(id) NOT NULL,
  approved_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.volunteer_activities IS 'Stores approved volunteer activities, forming a log of contributions.';
