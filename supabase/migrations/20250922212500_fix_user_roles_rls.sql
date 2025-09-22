-- This migration adds a new RLS policy to the user_roles table to allow admins to manage all user roles.

-- Enable RLS on the table if it's not already enabled.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows admins to insert, update, or delete any user role.
-- This is necessary for the handle_role_request function to work correctly.
CREATE POLICY "Admins can manage all user roles" 
ON public.user_roles 
FOR ALL 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

-- As a best practice, also ensure that users can view their own roles.
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);
