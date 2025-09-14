-- Create role_requests table per provided schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS public.role_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_type text NOT NULL,
  request_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- Maintain updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_role_requests_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_role_requests_set_updated_at
    BEFORE UPDATE ON public.role_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Prevent duplicate pending requests for the same (user_id, request_type)
-- Partial unique index on pending status
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'uq_role_requests_pending_unique' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX uq_role_requests_pending_unique
    ON public.role_requests (user_id, request_type)
    WHERE request_status = 'pending';
  END IF;
END $$;

-- Optional: RLS placeholders (adjust to your policy framework if needed)
-- ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;
-- Policies for select/insert/update can be added to match your existing RBAC.
