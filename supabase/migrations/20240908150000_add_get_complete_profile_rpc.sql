-- Create or replace the get_complete_profile RPC function
CREATE OR REPLACE FUNCTION public.get_complete_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile JSONB;
BEGIN
  -- Get the complete profile with all fields
  SELECT 
    jsonb_build_object(
      'full_name', p.full_name,
      'email', p.email,
      'phone_number', p.phone_number,
      'cnic_number', p.cnic_number,
      'date_of_birth', p.date_of_birth,
      'gender', p.gender,
      'emergency_contact_name', p.emergency_contact_name,
      'emergency_contact_number', p.emergency_contact_number,
      'address', p.address,
      'verification_status', p.verification_status,
      'created_at', p.created_at,
      'updated_at', p.updated_at
    )
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id;
  
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Profile not found',
      'error', 'No profile exists for the current user'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile retrieved successfully',
    'data', v_profile
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', 'Failed to retrieve profile',
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_complete_profile() TO authenticated;
