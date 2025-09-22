-- Programs schema: donation categories and projects with RLS, triggers, and RPCs
-- Timestamp: 2025-09-20 19:00:00

-- 1) ENUM: project_status_enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'project_status_enum'
  ) THEN
    CREATE TYPE public.project_status_enum AS ENUM ('Pending', 'In Process', 'Completed');
  END IF;
END $$;

-- 2) Helper trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3) Table: donation_categories
CREATE TABLE IF NOT EXISTS public.donation_categories (
  donation_category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_category_name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category_deactivated_at TIMESTAMPTZ,
  category_deactivated_by UUID REFERENCES auth.users(id)
);

-- Trigger for donation_categories.updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_donation_categories_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_donation_categories_set_updated_at
    BEFORE UPDATE ON public.donation_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 4) Table: projects
CREATE TABLE IF NOT EXISTS public.projects (
  project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  project_description TEXT,
  start_date DATE,
  end_date DATE,
  target_amount NUMERIC(12,2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  donation_category_id UUID NOT NULL REFERENCES public.donation_categories(donation_category_id) ON DELETE CASCADE,
  deactivated_at TIMESTAMPTZ,
  project_deactivated_by UUID REFERENCES auth.users(id),
  project_status public.project_status_enum NOT NULL DEFAULT 'Pending'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(donation_category_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(project_status);
CREATE INDEX IF NOT EXISTS idx_projects_active ON public.projects(is_active);
CREATE INDEX IF NOT EXISTS idx_donation_categories_active ON public.donation_categories(is_active);

-- Trigger for projects.updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projects_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_projects_set_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 5) Enforce: A project can only be created if its parent category is active
CREATE OR REPLACE FUNCTION public.enforce_active_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_active BOOLEAN;
BEGIN
  SELECT is_active INTO v_active
  FROM public.donation_categories
  WHERE donation_category_id = NEW.donation_category_id;

  IF v_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Cannot create or move project under an inactive category';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projects_enforce_active_category_ins'
  ) THEN
    CREATE TRIGGER trg_projects_enforce_active_category_ins
    BEFORE INSERT ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.enforce_active_category();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projects_enforce_active_category_upd'
  ) THEN
    CREATE TRIGGER trg_projects_enforce_active_category_upd
    BEFORE UPDATE OF donation_category_id ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.enforce_active_category();
  END IF;
END $$;

-- 6) RLS enablement
ALTER TABLE public.donation_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 7) RLS Policies
-- Only admins can INSERT/UPDATE/DELETE; authenticated can SELECT active rows; admins can SELECT all
-- We assume a helper function public.is_admin(uuid) exists.

-- donation_categories policies
DO $$
BEGIN
  -- SELECT: authenticated can see active; admins see all
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'dc_select_active_or_admin' AND tablename = 'donation_categories'
  ) THEN
    CREATE POLICY dc_select_active_or_admin
      ON public.donation_categories
      FOR SELECT
      TO authenticated
      USING (is_active = TRUE OR public.is_admin());
  END IF;

  -- INSERT: admin only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'dc_insert_admin_only' AND tablename = 'donation_categories'
  ) THEN
    CREATE POLICY dc_insert_admin_only
      ON public.donation_categories
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin());
  END IF;

  -- UPDATE: admin only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'dc_update_admin_only' AND tablename = 'donation_categories'
  ) THEN
    CREATE POLICY dc_update_admin_only
      ON public.donation_categories
      FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;

  -- DELETE: admin only (rare, but consistent)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'dc_delete_admin_only' AND tablename = 'donation_categories'
  ) THEN
    CREATE POLICY dc_delete_admin_only
      ON public.donation_categories
      FOR DELETE
      TO authenticated
      USING (public.is_admin());
  END IF;
END $$;

-- projects policies
DO $$
BEGIN
  -- SELECT: authenticated can see active projects whose category is active; admins see all
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'p_select_active_or_admin' AND tablename = 'projects'
  ) THEN
    CREATE POLICY p_select_active_or_admin
      ON public.projects
      FOR SELECT
      TO authenticated
      USING (
        public.is_admin()
        OR (
          is_active = TRUE AND EXISTS (
            SELECT 1 FROM public.donation_categories c
            WHERE c.donation_category_id = projects.donation_category_id
              AND c.is_active = TRUE
          )
        )
      );
  END IF;

  -- INSERT: admin only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'p_insert_admin_only' AND tablename = 'projects'
  ) THEN
    CREATE POLICY p_insert_admin_only
      ON public.projects
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin());
  END IF;

  -- UPDATE: admin only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'p_update_admin_only' AND tablename = 'projects'
  ) THEN
    CREATE POLICY p_update_admin_only
      ON public.projects
      FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;

  -- DELETE: admin only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'p_delete_admin_only' AND tablename = 'projects'
  ) THEN
    CREATE POLICY p_delete_admin_only
      ON public.projects
      FOR DELETE
      TO authenticated
      USING (public.is_admin());
  END IF;
END $$;

-- 8) RPC functions (admin-guarded, JSONB responses for consistency)

-- create_donation_category(name, description, user_id)
CREATE OR REPLACE FUNCTION public.create_donation_category(
  p_name TEXT,
  p_description TEXT,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.donation_categories (
    donation_category_name, description, is_active, category_deactivated_at, category_deactivated_by
  ) VALUES (
    p_name, p_description, TRUE, NULL, NULL
  ) RETURNING donation_category_id INTO v_new_id;

  RETURN jsonb_build_object('status','success','donation_category_id',v_new_id);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('status','error','message','Category name must be unique');
WHEN OTHERS THEN
  RETURN jsonb_build_object('status','error','message',SQLERRM,'code',SQLSTATE);
END;
$$;

-- deactivate_donation_category(category_id, user_id)
CREATE OR REPLACE FUNCTION public.deactivate_donation_category(
  p_category_id UUID,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.donation_categories
  SET is_active = FALSE,
      category_deactivated_at = NOW(),
      category_deactivated_by = p_user_id
  WHERE donation_category_id = p_category_id;

  RETURN jsonb_build_object('status','success','donation_category_id',p_category_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status','error','message',SQLERRM,'code',SQLSTATE);
END;
$$;

-- create_project(category_id, name, description, start_date, end_date, target_amount, user_id)
CREATE OR REPLACE FUNCTION public.create_project(
  p_category_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_target_amount NUMERIC(12,2),
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_new_id UUID;
  v_active BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT is_active INTO v_active
  FROM public.donation_categories
  WHERE donation_category_id = p_category_id;

  IF v_active IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object('status','error','message','Parent category is inactive');
  END IF;

  INSERT INTO public.projects (
    project_name, project_description, start_date, end_date, target_amount,
    is_active, created_by, donation_category_id, project_status
  ) VALUES (
    p_name, p_description, p_start_date, p_end_date, p_target_amount,
    TRUE, p_user_id, p_category_id, 'Pending'
  ) RETURNING project_id INTO v_new_id;

  RETURN jsonb_build_object('status','success','project_id',v_new_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status','error','message',SQLERRM,'code',SQLSTATE);
END;
$$;

-- update_project_status(project_id, new_status, user_id)
CREATE OR REPLACE FUNCTION public.update_project_status(
  p_project_id UUID,
  p_new_status public.project_status_enum,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.projects
  SET project_status = p_new_status,
      updated_at = NOW()
  WHERE project_id = p_project_id;

  RETURN jsonb_build_object('status','success','project_id',p_project_id,'new_status',p_new_status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status','error','message',SQLERRM,'code',SQLSTATE);
END;
$$;

-- deactivate_project(project_id, user_id)
CREATE OR REPLACE FUNCTION public.deactivate_project(
  p_project_id UUID,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.projects
  SET is_active = FALSE,
      deactivated_at = NOW(),
      project_deactivated_by = p_user_id
  WHERE project_id = p_project_id;

  RETURN jsonb_build_object('status','success','project_id',p_project_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status','error','message',SQLERRM,'code',SQLSTATE);
END;
$$;

-- 9) Grants
GRANT SELECT ON public.donation_categories TO authenticated;
GRANT SELECT ON public.projects TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_donation_category(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_donation_category(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_project(UUID, TEXT, TEXT, DATE, DATE, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_project_status(UUID, public.project_status_enum, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_project(UUID, UUID) TO authenticated;

-- 10) Read RPCs for listing categories and projects (RPC-first, RLS respected)
-- Update donation category RPC (admin-only)
CREATE OR REPLACE FUNCTION public.update_donation_category(
  p_category_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.donation_categories
  SET donation_category_name = COALESCE(p_name, donation_category_name),
      description = p_description,
      updated_at = NOW()
  WHERE donation_category_id = p_category_id;

  RETURN jsonb_build_object('status','success','donation_category_id',p_category_id);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('status','error','message','Category name must be unique');
WHEN OTHERS THEN
  RETURN jsonb_build_object('status','error','message',SQLERRM,'code',SQLSTATE);
END;
$$;

-- Update project RPC (admin-only)
CREATE OR REPLACE FUNCTION public.update_project(
  p_project_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_target_amount NUMERIC,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.projects
  SET project_name = COALESCE(p_name, project_name),
      project_description = p_description,
      start_date = COALESCE(p_start_date, start_date),
      end_date = COALESCE(p_end_date, end_date),
      target_amount = COALESCE(p_target_amount, target_amount),
      updated_at = NOW()
  WHERE project_id = p_project_id;

  RETURN jsonb_build_object('status','success','project_id',p_project_id);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('status','error','message','Project name must be unique');
WHEN OTHERS THEN
  RETURN jsonb_build_object('status','error','message',SQLERRM,'code',SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_project(UUID, TEXT, TEXT, DATE, DATE, NUMERIC, UUID) TO authenticated;

-- 10) Read RPCs for listing categories and projects (RPC-first, RLS respected)
CREATE OR REPLACE FUNCTION public.list_donation_categories()
RETURNS TABLE (
  donation_category_id UUID,
  donation_category_name TEXT,
  description TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  category_deactivated_at TIMESTAMPTZ,
  category_deactivated_by UUID
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF v_is_admin THEN
    RETURN QUERY
    SELECT dc.donation_category_id, dc.donation_category_name, dc.description, dc.is_active, dc.created_at, dc.updated_at, dc.category_deactivated_at, dc.category_deactivated_by
    FROM public.donation_categories dc
    ORDER BY dc.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT dc.donation_category_id, dc.donation_category_name, dc.description, dc.is_active, dc.created_at, dc.updated_at, dc.category_deactivated_at, dc.category_deactivated_by
    FROM public.donation_categories dc
    WHERE dc.is_active = TRUE
    ORDER BY dc.created_at DESC;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_projects()
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  project_description TEXT,
  start_date DATE,
  end_date DATE,
  target_amount NUMERIC(12,2),
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  donation_category_id UUID,
  deactivated_at TIMESTAMPTZ,
  project_deactivated_by UUID,
  project_status public.project_status_enum
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF v_is_admin THEN
    RETURN QUERY
    SELECT p.project_id, p.project_name, p.project_description, p.start_date, p.end_date, p.target_amount, p.is_active, p.created_at, p.updated_at, p.created_by, p.donation_category_id, p.deactivated_at, p.project_deactivated_by, p.project_status
    FROM public.projects p
    ORDER BY p.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT p.project_id, p.project_name, p.project_description, p.start_date, p.end_date, p.target_amount, p.is_active, p.created_at, p.updated_at, p.created_by, p.donation_category_id, p.deactivated_at, p.project_deactivated_by, p.project_status
    FROM public.projects p
    JOIN public.donation_categories dc ON dc.donation_category_id = p.donation_category_id
    WHERE p.is_active = TRUE AND dc.is_active = TRUE
    ORDER BY p.created_at DESC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_donation_categories() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_projects() TO authenticated;
