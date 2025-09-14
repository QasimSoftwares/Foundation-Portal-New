-- Update the update_profile function to use the correct parameter types
CREATE OR REPLACE FUNCTION public.update_profile(
  p_full_name TEXT,
  p_phone_number TEXT DEFAULT NULL,
  p_cnic_number TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_emergency_contact_name TEXT DEFAULT NULL,
  p_emergency_contact_number TEXT DEFAULT NULL,
  p_address JSONB DEFAULT NULL,
  p_communication_preference TEXT DEFAULT 'email',
  p_skills TEXT DEFAULT NULL,
  p_availability TEXT DEFAULT 'on_site'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSONB;
BEGIN
  -- Update the profile with new fields
  UPDATE public.profiles
  SET 
    full_name = p_full_name,
    phone_number = p_phone_number,
    cnic_number = p_cnic_number,
    date_of_birth = p_date_of_birth,
    gender = p_gender,
    emergency_contact_name = p_emergency_contact_name,
    emergency_contact_number = p_emergency_contact_number,
    address = p_address,
    communication_preference = p_communication_preference,
    skills = p_skills,
    availability = p_availability,
    updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING 
    jsonb_build_object(
      'success', true,
      'message', 'Profile updated successfully'
    ) INTO v_result;
    
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', 'Failed to update profile',
    'error', SQLERRM
  );
END;
$$;

-- Update the grant to include the new parameter types
GRANT EXECUTE ON FUNCTION public.update_profile(
  TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) TO authenticated;
