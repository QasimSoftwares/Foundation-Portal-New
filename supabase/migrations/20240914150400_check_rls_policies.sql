-- Check and update RLS policies for profiles table
DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on profiles table';
  END IF;

  -- Check if update policy exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Allow users to update their own profile'
  ) THEN
    -- Create update policy if it doesn't exist
    CREATE POLICY "Allow users to update their own profile" 
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
    
    RAISE NOTICE 'Created update policy on profiles table';
  END IF;
  
  -- Check if select policy exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Allow users to view their own profile'
  ) THEN
    -- Create select policy if it doesn't exist
    CREATE POLICY "Allow users to view their own profile" 
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = user_id);
    
    RAISE NOTICE 'Created select policy on profiles table';
  END IF;
  
  RAISE NOTICE 'RLS policies verified and updated if needed';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error setting up RLS policies: %', SQLERRM;
END $$;
