-- This migration adds a dedicated RPC to fetch all data needed for a donation receipt.
-- It uses SECURITY DEFINER to bypass RLS on all the joined tables.

CREATE OR REPLACE FUNCTION public.get_donation_receipt_details(p_donation_id uuid)
RETURNS TABLE (
  donation_id uuid,
  donor_human_id text,
  donor_name text,
  phone_number text,
  address text,
  amount numeric,
  currency public.enum_donation_currency,
  donation_date date,
  payment_method public.enum_payment_mode,
  transaction_id text,
  category_name text,
  project_name text,
  donation_type public.enum_donation_type,
  approved_by_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function is for admin use only, enforced by an admin check.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can fetch receipt details.';
  END IF;

  RETURN QUERY
  SELECT
    d.donation_id,
    dn.donor_number AS donor_human_id,
    COALESCE(p.full_name, 'N/A') AS donor_name,
    COALESCE(p.phone_number, 'N/A') AS phone_number,
    COALESCE(
      CASE 
        WHEN jsonb_typeof(p.address) = 'object' THEN 
          TRIM(BOTH ', ' FROM 
            CONCAT_WS(', ',
              NULLIF(p.address->>'street', ''),
              NULLIF(p.address->>'city', ''),
              NULLIF(p.address->>'state', ''),
              NULLIF(p.address->>'country', ''),
              NULLIF(p.address->>'postalCode', '')
            )
          )
        ELSE 'N/A'
      END,
      'N/A'
    ) AS address,
    d.amount,
    d.currency,
    d.donation_date,
    d.mode_of_payment AS payment_method,
    COALESCE(d.transaction_id, 'N/A') AS transaction_id,
    COALESCE(dc.donation_category_name, 'N/A') AS category_name,
    COALESCE(proj.project_name, 'N/A') AS project_name,
    d.donation_type,
    COALESCE(approver_p.full_name, 'N/A') AS approved_by_name
  FROM public.donations d
  LEFT JOIN public.donors dn ON d.donor_id = dn.donor_id
  LEFT JOIN public.profiles p ON dn.user_id = p.user_id
  LEFT JOIN public.donation_categories dc ON d.category_id = dc.donation_category_id
  LEFT JOIN public.projects proj ON d.project_id = proj.project_id
  LEFT JOIN public.profiles approver_p ON d.approved_by = approver_p.user_id
  WHERE d.donation_id = p_donation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_donation_receipt_details(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_donation_receipt_details(uuid) IS 'Fetches all necessary details for a donation receipt. Admin-only. SECURITY DEFINER.';

RAISE NOTICE 'Successfully created get_donation_receipt_details(uuid) function.';
