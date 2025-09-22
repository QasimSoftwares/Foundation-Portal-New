-- supabase/migrations/20250921214200_create_admin_dashboard_metrics_rpc.sql

-- This migration creates a single, efficient RPC to fetch all metrics for the admin dashboard.
-- This replaces multiple individual RPC calls, significantly improving performance.

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
RETURNS TABLE (
  total_donors bigint,
  total_donations numeric,
  total_volunteers bigint,
  total_members bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
BEGIN
  -- RBAC Check: Ensure only authenticated admins can execute this function.
  IF v_caller_id IS NULL OR NOT public.is_admin(v_caller_id::uuid) THEN
    RAISE EXCEPTION 'Forbidden: Caller is not an admin.' USING ERRCODE = '42501';
  END IF;

  -- Use CTEs to calculate all metrics in a single query execution plan.
  RETURN QUERY
  WITH donors_count AS (
    SELECT count(*) as total FROM donors
  ),
  donations_sum AS (
    SELECT coalesce(sum(amount), 0) as total FROM donations
  ),
  volunteers_count AS (
    SELECT count(*) as total FROM public.user_roles WHERE is_volunteer = TRUE
  ),
  members_count AS (
    SELECT count(*) as total FROM public.user_roles WHERE is_member = TRUE
  )
  SELECT
    dc.total,
    ds.total,
    vc.total,
    mc.total
  FROM donors_count dc, donations_sum ds, volunteers_count vc, members_count mc;
END;
$$;

-- Grant permission to authenticated users (the function's internal check will handle authorization).
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO authenticated;

COMMENT ON FUNCTION public.get_admin_dashboard_metrics() IS 'Aggregates all key metrics for the admin dashboard (total donors, donations, volunteers, members) in a single, efficient query.';
