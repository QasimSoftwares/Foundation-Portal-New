-- Add is_volunteer column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS is_volunteer BOOLEAN NOT NULL DEFAULT false;

-- Update RLS policy to allow admins to manage volunteer status
CREATE POLICY "Allow admins to manage volunteer status" 
ON public.user_roles
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.user_roles TO authenticated;

-- Create a function to safely update user roles
CREATE OR REPLACE FUNCTION public.update_user_volunteer_status(
  p_user_id UUID,
  p_is_volunteer BOOLEAN
) 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'User not found');
  END IF;
  
  -- Update or insert the volunteer status
  INSERT INTO public.user_roles (user_id, is_volunteer)
  VALUES (p_user_id, p_is_volunteer)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    is_volunteer = EXCLUDED.is_volunteer,
    updated_at = NOW()
  WHERE user_roles.user_id = EXCLUDED.user_id;
  
  RETURN jsonb_build_object('status', 'success', 'message', 'Volunteer status updated');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status', 'error',
    'message', SQLERRM,
    'detail', SQLSTATE,
    'context', PG_EXCEPTION_CONTEXT
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_volunteer_status(UUID, BOOLEAN) TO authenticated;
