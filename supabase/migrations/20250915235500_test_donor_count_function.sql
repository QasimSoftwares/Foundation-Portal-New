-- Test the donor count function
DO $$
DECLARE
  donor_count INT;
  is_admin_user BOOLEAN;
  error_message TEXT;
BEGIN
  -- Check if current user is admin
  SELECT is_admin() INTO is_admin_user;
  RAISE NOTICE 'Current user is admin: %', is_admin_user;
  
  -- Try to get donor count
  BEGIN
    SELECT get_total_donors_count() INTO donor_count;
    RAISE NOTICE 'Total donors: %', donor_count;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
    RAISE NOTICE 'Error getting donor count: %', error_message;
  END;
  
  -- Show current user's permissions
  RAISE NOTICE 'Current user: %', current_user;
  RAISE NOTICE 'Is superuser: %', current_setting('is_superuser') = 'on';
  
  -- Check if we can query donors directly
  BEGIN
    SELECT count(*) INTO donor_count FROM public.donors;
    RAISE NOTICE 'Direct query count: %', donor_count;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
    RAISE NOTICE 'Error querying donors directly: %', error_message;
  END;
END $$;
