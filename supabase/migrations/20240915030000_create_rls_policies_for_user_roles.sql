-- Drop existing policies to start fresh
DO $$
BEGIN
  -- Drop all existing policies on user_roles
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || polname || '" ON public.user_roles;', ' ')
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
  );
  
  RAISE NOTICE 'Dropped all existing policies on user_roles table';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error dropping existing policies: %', SQLERRM;
END $$;

-- Create new, simplified RLS policies for user_roles
DO $$
BEGIN
  -- 1. Allow users to view their own roles
  CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
  
  -- 2. Allow admins to view all roles
  CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
  ));
  
  -- 3. Allow admins to update any role
  CREATE POLICY "Admins can update any role"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
  ));
  
  -- 4. Allow insertion of new user roles (for registration)
  CREATE POLICY "Allow user role creation"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
  
  RAISE NOTICE 'Successfully created RLS policies for user_roles table';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error creating RLS policies: %', SQLERRM;
END $$;
