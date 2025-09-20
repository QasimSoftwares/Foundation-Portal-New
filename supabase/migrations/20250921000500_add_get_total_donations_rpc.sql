-- supabase/migrations/20250921000500_add_get_total_donations_rpc.sql
-- RPC: get_total_donations()
-- Returns the SUM(amount) from donations.
-- SECURITY INVOKER (default) to respect RLS.
-- RBAC enforced via user_roles flags: admins see all, donors see only their own.

CREATE OR REPLACE FUNCTION public.get_total_donations()
RETURNS numeric
LANGUAGE sql
AS $$
  WITH my_role AS (
    SELECT COALESCE(ur.is_admin, false) AS is_admin,
           COALESCE(ur.is_donor, false) AS is_donor
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
  SELECT COALESCE(SUM(d.amount), 0)::numeric
  FROM public.donations d
  WHERE (
    -- Admins can see all
    EXISTS (SELECT 1 FROM my_role r WHERE r.is_admin)
    -- Donors can only see their own
    OR EXISTS (
      SELECT 1 FROM public.donors dn
      WHERE dn.donor_id = d.donor_id
        AND dn.user_id = auth.uid()
        AND EXISTS (SELECT 1 FROM my_role r WHERE r.is_donor AND NOT r.is_admin)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_total_donations() TO authenticated;

COMMENT ON FUNCTION public.get_total_donations() IS 'Sums donations.amount. Admins: all donations. Donors: only their own. SECURITY INVOKER; relies on RLS.';
