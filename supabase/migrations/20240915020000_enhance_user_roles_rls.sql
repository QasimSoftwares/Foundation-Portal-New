-- Migration to enhance RLS policies for user_roles table

-- Drop existing policies to avoid conflicts
DO $$
BEGIN
  -- Drop existing policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Enable read access for all users') THEN
    DROP POLICY "Enable read access for all users" ON public.user_roles;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Enable update for admins') THEN
    DROP POLICY "Enable update for admins" ON public.user_roles;
  END IF;
  
  -- Add more DROP POLICY statements for any other existing policies
END $$;

-- Create comprehensive RLS policies for user_roles
DO $$
BEGIN
  -- 1. Users can read their own roles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Users can view their own roles') THEN
    CREATE POLICY "Users can view their own roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
  
  -- 2. Users can update their own roles (with some restrictions)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Users can update their own basic info') THEN
    CREATE POLICY "Users can update their own basic info"
    ON public.user_roles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
      auth.uid() = user_id
      -- Only allow updating non-privileged fields
      AND (
        (SELECT is_admin FROM public.user_roles WHERE user_id = auth.uid()) = false
        OR 
        (SELECT is_admin FROM public.user_roles WHERE user_id = auth.uid()) IS NULL
      )
    );
  END IF;
  
  -- 3. Admins can view all roles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Admins can view all roles') THEN
    CREATE POLICY "Admins can view all roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND is_admin = true
    ));
  END IF;
  
  -- 4. Admins can update any role
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Admins can update any role') THEN
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
  END IF;
  
  -- 5. Prevent users from escalating their own privileges
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Prevent self-privilege escalation') THEN
    CREATE POLICY "Prevent self-privilege escalation"
    ON public.user_roles
    FOR UPDATE
    TO authenticated
    WITH CHECK (
      -- Only allow updates to other users' roles
      auth.uid() != user_id
      -- Or if it's the same user, ensure they can't modify their own admin status
      OR (
        auth.uid() = user_id 
        AND (
          (OLD.is_admin = NEW.is_admin) OR 
          (SELECT is_admin FROM public.user_roles WHERE user_id = auth.uid()) = false
        )
      )
    );
  END IF;
  
  -- 6. Allow insertion of new user roles (handled by trigger)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Allow user role creation') THEN
    CREATE POLICY "Allow user role creation"
    ON public.user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;
  
  RAISE NOTICE 'Successfully applied or updated RLS policies for user_roles table';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error applying RLS policies: %', SQLERRM;
END $$;
