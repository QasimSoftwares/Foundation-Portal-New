-- Add notes column to donor_requests table
ALTER TABLE public.donor_requests 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update the RPC function to include the notes field in the response
CREATE OR REPLACE FUNCTION public.create_donor_request(
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  donor_request_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.donor_requests (
    user_id,
    full_name,
    email,
    phone,
    address,
    notes,
    status
  ) VALUES (
    auth.uid(),
    p_full_name,
    p_email,
    p_phone,
    p_address::JSONB,
    p_notes,
    'pending'::donor_request_status
  )
  RETURNING 
    donor_requests.donor_request_id,
    donor_requests.status::TEXT,
    donor_requests.created_at,
    donor_requests.updated_at;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_donor_request(
  TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
