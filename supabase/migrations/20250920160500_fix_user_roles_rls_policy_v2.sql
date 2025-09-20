-- Drop all existing policies on user_roles to avoid conflicts and redefine them correctly
DROP POLICY IF EXISTS "Admins can update any role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow user role creation" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- RLS policy for admins to have full access, preventing recursion by using is_admin()
CREATE POLICY "Allow full access to admins" 
ON public.user_roles
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- RLS policy for users to view their own roles
-- This will apply only to non-admins due to the admin policy above
CREATE POLICY "Allow users to view their own roles" 
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- RLS policy to allow a user to be created in user_roles
-- This is typically done upon user signup via a trigger, but if it's manual, this is needed.
-- The check condition ensures that a user can only insert a role for themselves.
CREATE POLICY "Allow user to create their own role entry" 
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);
