-- This migration adds a dedicated, admin-only RPC for searching donors.
-- It uses SECURITY DEFINER to bypass RLS on the profiles and donors tables for a comprehensive search.

CREATE OR REPLACE FUNCTION public.search_donors_by_admin(p_query text)
RETURNS TABLE (
  donor_id uuid,
  user_id uuid,
  donor_number text,
  full_name text,
  phone_number text,
  address jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This RPC is for admins only.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can search for donors.';
  END IF;

  -- Perform the search across multiple fields.
  RETURN QUERY
  SELECT
    d.donor_id,
    d.user_id,
    d.donor_number,
    p.full_name,
    p.phone_number,
    p.address
  FROM public.donors d
  LEFT JOIN public.profiles p ON d.user_id = p.user_id
  WHERE
    p_query IS NOT NULL AND (
      d.donor_number ILIKE ('%' || p_query || '%')
      OR p.full_name ILIKE ('%' || p_query || '%')
      OR p.phone_number ILIKE ('%' || p_query || '%')
      OR (p_query ~ '^[0-9a-fA-F-]{16,}$' AND d.donor_id::text = p_query)
    )
  LIMIT 20;
END;
$$;

-- Grant execute permission.
GRANT EXECUTE ON FUNCTION public.search_donors_by_admin(text) TO authenticated;

COMMENT ON FUNCTION public.search_donors_by_admin(text) IS 'Performs a comprehensive search for donors by name, number, or ID. Admin-only. SECURITY DEFINER.';

RAISE NOTICE 'Successfully created the search_donors_by_admin(text) function.';
