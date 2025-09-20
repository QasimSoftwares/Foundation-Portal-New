-- supabase/migrations/20250916100100_create_get_profile_by_user_id_rpc.sql

CREATE OR REPLACE FUNCTION public.get_profile_by_user_id(p_user_id uuid)
RETURNS TABLE (
    user_id uuid,
    full_name text,
    email text,
    phone_number text,
    date_of_birth date,
    gender text,
    address jsonb,
    emergency_contact_name text,
    emergency_contact_number text,
    communication_preference text,
    skills text,
    skills_other text,
    availability text,
    cnic_number text
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- This function can only be called by authenticated users.
  -- RLS policies will determine if the user has permission to view the profile.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    p.email,
    p.phone_number,
    p.date_of_birth,
    p.gender,
    p.address,
    p.emergency_contact_name,
    p.emergency_contact_number,
    p.communication_preference,
    p.skills,
    p.skills_other,
    p.availability,
    p.cnic_number
  FROM
    public.profiles p
  WHERE
    p.user_id = p_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_profile_by_user_id(uuid) TO authenticated;
