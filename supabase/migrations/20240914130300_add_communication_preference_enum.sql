-- Create the enum type
CREATE TYPE communication_preference_enum AS ENUM ('email', 'phone', 'whatsapp');

-- Add the new column with the enum type
ALTER TABLE public.profiles 
ADD COLUMN communication_preference_new communication_preference_enum 
DEFAULT 'email'::communication_preference_enum;

-- First, update the new column with valid enum values
UPDATE public.profiles 
SET communication_preference_new = 
  CASE 
    WHEN LOWER(TRIM(communication_preference::text)) = 'email' THEN 'email'::communication_preference_enum
    WHEN LOWER(TRIM(communication_preference::text)) = 'phone' THEN 'phone'::communication_preference_enum
    WHEN LOWER(TRIM(communication_preference::text)) = 'whatsapp' THEN 'whatsapp'::communication_preference_enum
    ELSE 'email'::communication_preference_enum
  END
WHERE communication_preference IS NOT NULL;

-- Set default for any NULL values
UPDATE public.profiles 
SET communication_preference_new = 'email'::communication_preference_enum
WHERE communication_preference_new IS NULL;

-- Drop the old column
ALTER TABLE public.profiles DROP COLUMN communication_preference;

-- Rename the new column to the original name
ALTER TABLE public.profiles RENAME COLUMN communication_preference_new TO communication_preference;

-- Update the update_profile function to use the new enum type
CREATE OR REPLACE FUNCTION public.update_profile(
  p_full_name TEXT,
  p_phone_number TEXT DEFAULT NULL,
  p_cnic_number TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_emergency_contact_name TEXT DEFAULT NULL,
  p_emergency_contact_number TEXT DEFAULT NULL,
  p_address JSONB DEFAULT NULL,
  p_communication_preference communication_preference_enum DEFAULT 'email',
  p_skills TEXT DEFAULT NULL,
  p_availability TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSONB;
BEGIN
  -- Update the profile with the new enum type
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
  WHERE user_id = v_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile updated successfully',
    'data', (
      SELECT to_jsonb(profiles.*)
      FROM profiles
      WHERE user_id = v_user_id
    )
  );
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
  TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, JSONB, 
  communication_preference_enum, TEXT, TEXT
) TO authenticated;
