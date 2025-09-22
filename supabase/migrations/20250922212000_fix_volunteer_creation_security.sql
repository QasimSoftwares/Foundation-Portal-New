-- This migration fixes the security context of create_volunteer and adds appropriate RLS policies.

-- 1. Update the create_volunteer function to use SECURITY DEFINER and add an admin check.
CREATE OR REPLACE FUNCTION public.create_volunteer(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_volunteer_number TEXT;
  v_volunteer_id UUID;
  v_result JSONB;
BEGIN
  -- Ensure the user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can create volunteer records';
  END IF;

  -- If a volunteer record already exists for this user, return it (idempotent)
  SELECT volunteer_id INTO v_volunteer_id
  FROM public.volunteers
  WHERE user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'success',
      'volunteer_id', v_volunteer_id,
      'volunteer_number', (SELECT volunteer_number FROM public.volunteers WHERE volunteer_id = v_volunteer_id)
    );
  END IF;

  -- Generate a new volunteer number
  SELECT public.generate_volunteer_number() INTO v_volunteer_number;
  
  -- Insert the new volunteer record
  INSERT INTO public.volunteers (
    user_id,
    volunteer_number,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_volunteer_number,
    NOW(),
    NOW()
  )
  RETURNING volunteer_id INTO v_volunteer_id;
  
  RETURN jsonb_build_object(
    'status', 'success',
    'volunteer_id', v_volunteer_id,
    'volunteer_number', v_volunteer_number
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status', 'error',
    'message', SQLERRM,
    'code', SQLSTATE
  );
END;
$$;

-- 2. Add RLS policies for the volunteers table.

-- Enable RLS if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE tablename = 'volunteers' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy to allow users to view their own volunteer record
CREATE POLICY "Users can view their own volunteer data" 
ON public.volunteers
FOR SELECT
USING (auth.uid() = user_id);

-- Policy to allow admins to view all volunteer records
CREATE POLICY "Admins can view all volunteer data"
ON public.volunteers
FOR SELECT
USING (public.is_admin());

-- Policy to allow admins to insert volunteer records
CREATE POLICY "Admins can insert volunteer data"
ON public.volunteers
FOR INSERT
WITH CHECK (public.is_admin());

-- Policy to allow admins to update any volunteer record
CREATE POLICY "Admins can update any volunteer data"
ON public.volunteers
FOR UPDATE
USING (public.is_admin());

-- Grant execute permissions on the updated function
GRANT EXECUTE ON FUNCTION public.create_volunteer(UUID) TO authenticated;
