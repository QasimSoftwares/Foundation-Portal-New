-- Enable RLS on role_requests table if not already enabled
DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'role_requests' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on role_requests table';
  END IF;
  
  -- Policy for admins to view all role requests
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'role_requests' 
    AND policyname = 'Allow admins to view all role requests'
  ) THEN
    CREATE POLICY "Allow admins to view all role requests" 
    ON public.role_requests
    FOR SELECT
    USING (auth.uid() IN (
      SELECT user_id FROM user_roles WHERE is_admin = true
    ));
    
    RAISE NOTICE 'Created admin view policy on role_requests table';
  END IF;
  
  -- Policy for users to view their own role requests
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'role_requests' 
    AND policyname = 'Allow users to view their own role requests'
  ) THEN
    CREATE POLICY "Allow users to view their own role requests" 
    ON public.role_requests
    FOR SELECT
    USING (auth.uid() = user_id);
    
    RAISE NOTICE 'Created user view policy on role_requests table';
  END IF;
  
  -- Policy for users to insert their own role requests
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'role_requests' 
    AND policyname = 'Allow users to insert their own role requests'
  ) THEN
    CREATE POLICY "Allow users to insert their own role requests" 
    ON public.role_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
    
    RAISE NOTICE 'Created user insert policy on role_requests table';
  END IF;
  
  -- Policy for admins to update role requests
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'role_requests' 
    AND policyname = 'Allow admins to update role requests'
  ) THEN
    CREATE POLICY "Allow admins to update role requests" 
    ON public.role_requests
    FOR UPDATE
    USING (auth.uid() IN (
      SELECT user_id FROM user_roles WHERE is_admin = true
    ))
    WITH CHECK (auth.uid() IN (
      SELECT user_id FROM user_roles WHERE is_admin = true
    ));
    
    RAISE NOTICE 'Created admin update policy on role_requests table';
  END IF;
  
  RAISE NOTICE 'RLS policies for role_requests table verified and updated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error setting up RLS policies for role_requests: %', SQLERRM;
END $$;
