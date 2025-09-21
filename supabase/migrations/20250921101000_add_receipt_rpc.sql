-- Migration: Add RPC to set receipt PDF path for a donation (admin-only)

CREATE OR REPLACE FUNCTION public.set_donation_receipt_path(
  p_donation_id uuid,
  p_storage_path text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can set receipt path' USING ERRCODE = '42501';
  END IF;

  UPDATE public.donations
  SET receipt_pdf_path = NULLIF(trim(p_storage_path), '')
  WHERE donation_id = p_donation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_donation_receipt_path(uuid, text) TO authenticated;
