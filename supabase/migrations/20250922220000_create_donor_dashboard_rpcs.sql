-- supabase/migrations/20250922220000_create_donor_dashboard_rpcs.sql

-- This migration creates two RPC functions to power the donor dashboard.

-- 1. Function to get aggregate metrics for the current donor
CREATE OR REPLACE FUNCTION public.get_donor_dashboard_metrics()
RETURNS TABLE (
    total_donations numeric,
    last_donation_amount numeric,
    last_donation_date date,
    unique_projects_supported bigint,
    total_donation_count bigint
)
LANGUAGE plpgsql
SECURITY INVOKER -- Relies on RLS to ensure donors only see their own data.
AS $$
DECLARE
    v_donor_id uuid;
BEGIN
    -- Find the donor_id for the currently authenticated user
    SELECT d.donor_id INTO v_donor_id
    FROM public.donors d
    WHERE d.user_id = auth.uid();

    IF v_donor_id IS NULL THEN
        -- Return empty/zero values if the user is not a donor
        RETURN QUERY SELECT 0, 0, NULL::date, 0, 0;
        RETURN;
    END IF;

    RETURN QUERY
    WITH user_donations AS (
        SELECT * FROM public.donations d WHERE d.donor_id = v_donor_id
    ),
    last_donation AS (
        SELECT d.amount, d.donation_date
        FROM user_donations d
        ORDER BY d.donation_date DESC, d.created_at DESC
        LIMIT 1
    )
    SELECT
        COALESCE((SELECT SUM(d.amount) FROM user_donations d), 0) AS total_donations,
        (SELECT ld.amount FROM last_donation ld) AS last_donation_amount,
        (SELECT ld.donation_date FROM last_donation ld) AS last_donation_date,
        (SELECT COUNT(DISTINCT d.project_id) FROM user_donations d) AS unique_projects_supported,
        (SELECT COUNT(*) FROM user_donations d) AS total_donation_count;
END;
$$;

COMMENT ON FUNCTION public.get_donor_dashboard_metrics() IS 'Fetches key metrics for the currently authenticated donor''s dashboard.';

-- 2. Function to get a list of recent donations for the current donor
CREATE OR REPLACE FUNCTION public.get_donor_recent_donations()
RETURNS TABLE (
    date date,
    donationId text,
    amount numeric,
    category text,
    project text,
    status public.enum_request_status
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_donor_id uuid;
BEGIN
    SELECT d.donor_id INTO v_donor_id
    FROM public.donors d
    WHERE d.user_id = auth.uid();

    IF v_donor_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        d.donation_date AS date,
        d.donation_human_id AS donationId,
        d.amount,
        dc.donation_category_name AS category,
        p.project_name AS project,
        'Completed'::public.enum_request_status AS status
    FROM public.donations d
    LEFT JOIN public.donation_categories dc ON d.category_id = dc.donation_category_id
    LEFT JOIN public.projects p ON d.project_id = p.project_id
    WHERE d.donor_id = v_donor_id
    ORDER BY d.donation_date DESC, d.created_at DESC
    LIMIT 5;
END;
$$;

COMMENT ON FUNCTION public.get_donor_recent_donations() IS 'Fetches the 5 most recent donations for the currently authenticated donor.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_donor_dashboard_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_donor_recent_donations() TO authenticated;

-- 3. Function to get donation summary (aggregated rows) for the current donor
-- Filters: optional category_id and project_id
CREATE OR REPLACE FUNCTION public.get_donor_donations_summary(
  p_category_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  donation_date date,
  amount numeric,
  currency text,
  category_name text,
  project_name text
)
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH me AS (
    SELECT d.donor_id
    FROM public.donors d
    WHERE d.user_id = auth.uid()
  )
  SELECT
    dn.donation_date,
    dn.amount,
    dn.currency,
    dc.donation_category_name AS category_name,
    pj.project_name AS project_name
  FROM public.donations dn
  JOIN me ON me.donor_id = dn.donor_id
  LEFT JOIN public.donation_categories dc ON dc.donation_category_id = dn.category_id
  LEFT JOIN public.projects pj ON pj.project_id = dn.project_id
  WHERE
    (p_category_id IS NULL OR dn.category_id = p_category_id)
    AND (p_project_id IS NULL OR dn.project_id = p_project_id)
  ORDER BY dn.donation_date ASC, dn.created_at ASC;
$$;

COMMENT ON FUNCTION public.get_donor_donations_summary(uuid, uuid)
IS 'Returns donation rows for the current donor, filterable by category or project.';

GRANT EXECUTE ON FUNCTION public.get_donor_donations_summary(uuid, uuid) TO authenticated;

-- 4. Helper RPCs to list available categories and projects
CREATE OR REPLACE FUNCTION public.get_donation_categories()
RETURNS TABLE (
  donation_category_id uuid,
  donation_category_name text
)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT c.donation_category_id, c.donation_category_name
  FROM public.donation_categories c
  WHERE c.is_active = TRUE
  ORDER BY c.donation_category_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_donation_categories() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_projects()
RETURNS TABLE (
  project_id uuid,
  project_name text
)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT p.project_id, p.project_name
  FROM public.projects p
  WHERE p.is_active = TRUE
  ORDER BY p.project_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_projects() TO authenticated;

-- 5. List all donations for the current donor
CREATE OR REPLACE FUNCTION public.get_my_donations()
RETURNS TABLE (
  donation_id uuid,
  donation_human_id text,
  amount numeric,
  currency text,
  category_id uuid,
  category_name text,
  project_id uuid,
  project_name text,
  donation_date date,
  receipt_pdf_path text
)
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH me AS (
    SELECT d.donor_id
    FROM public.donors d
    WHERE d.user_id = auth.uid()
  )
  SELECT
    dn.donation_id,
    dn.donation_human_id,
    dn.amount,
    dn.currency,
    dn.category_id,
    dc.donation_category_name AS category_name,
    dn.project_id,
    pj.project_name,
    dn.donation_date,
    dn.receipt_pdf_path
  FROM public.donations dn
  JOIN me ON me.donor_id = dn.donor_id
  LEFT JOIN public.donation_categories dc ON dc.donation_category_id = dn.category_id
  LEFT JOIN public.projects pj ON pj.project_id = dn.project_id
  ORDER BY dn.donation_date DESC, dn.created_at DESC;
$$;

COMMENT ON FUNCTION public.get_my_donations()
IS 'Lists all donations for the currently authenticated donor with joined names and receipt path.';

GRANT EXECUTE ON FUNCTION public.get_my_donations() TO authenticated;

-- 6. Securely get receipt path only if the donation belongs to the current user
CREATE OR REPLACE FUNCTION public.get_receipt_path_if_owner(p_donation_id uuid)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH me AS (
    SELECT d.donor_id
    FROM public.donors d
    WHERE d.user_id = auth.uid()
  )
  SELECT dn.receipt_pdf_path
  FROM public.donations dn
  JOIN me ON me.donor_id = dn.donor_id
  WHERE dn.donation_id = p_donation_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_receipt_path_if_owner(uuid) TO authenticated;
