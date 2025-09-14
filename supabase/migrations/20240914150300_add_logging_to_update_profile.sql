-- Add detailed logging to the update_profile function
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
  p_skills_other TEXT DEFAULT NULL,
  p_availability TEXT DEFAULT 'on_site'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSONB;
  v_updated_rows INT;
BEGIN
  -- Log the input parameters
  RAISE NOTICE 'Updating profile for user: %', v_user_id;
  RAISE NOTICE 'Input - full_name: %, phone: %, cnic: %', 
    p_full_name, p_phone_number, p_cnic_number;
  
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
    communication_preference = p_communication_preference::communication_preference_enum,
    skills = p_skills,
    skills_other = p_skills_other,
    availability = p_availability,
    updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING 1 INTO v_updated_rows;
  
  -- Log the result
  IF v_updated_rows > 0 THEN
    RAISE NOTICE 'Successfully updated profile for user: %', v_user_id;
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Profile updated successfully'
    );
  ELSE
    RAISE NOTICE 'No rows updated for user: %', v_user_id;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No profile found to update',
      'error', 'No rows updated'
    );
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating profile: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'message', 'Failed to update profile',
    'error', SQLERRM
  );
END;
$$;

-- Update the grant to include the new parameter
grant execute on function public.update_profile(
  text, text, text, date, text, text, text, jsonb, text, text, text, text
) to authenticated;
