-- Create a function to generate member numbers
CREATE OR REPLACE FUNCTION public.generate_member_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  next_num INTEGER;
  new_member_number TEXT;
BEGIN
  -- Get the next sequence number
  SELECT COALESCE(MAX(CAST(SUBSTRING(member_number FROM 2) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.members
  WHERE member_number ~ '^M[0-9]+$';
  
  -- Format as M followed by 6-digit number with leading zeros
  new_member_number := 'M' || LPAD(next_num::TEXT, 6, '0');
  
  RETURN new_member_number;
END;
$$;

-- Create a function to create a member record
CREATE OR REPLACE FUNCTION public.create_member(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_member_number TEXT;
  v_member_id UUID;
  v_result JSONB;
BEGIN
  -- If a member record already exists for this user, return it (idempotent)
  SELECT member_id INTO v_member_id
  FROM public.members
  WHERE user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'success',
      'member_id', v_member_id,
      'member_number', (SELECT member_number FROM public.members WHERE member_id = v_member_id)
    );
  END IF;

  -- Generate a new member number
  SELECT public.generate_member_number() INTO v_member_number;
  
  -- Insert the new member record
  INSERT INTO public.members (
    user_id,
    member_number,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_member_number,
    NOW(),
    NOW()
  )
  RETURNING member_id INTO v_member_id;
  
  RETURN jsonb_build_object(
    'status', 'success',
    'member_id', v_member_id,
    'member_number', v_member_number
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status', 'error',
    'message', SQLERRM,
    'code', SQLSTATE
  );
END;
$$;

-- Create the members table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.members (
  member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  member_number TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Add any member-specific fields here
  membership_type TEXT,
  membership_start_date DATE,
  membership_end_date DATE
);

-- Add the foreign key constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'members_user_id_fkey' 
    AND conrelid = 'public.members'::regclass
  ) THEN
    ALTER TABLE public.members 
    ADD CONSTRAINT members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes if they don't exist
DO $$
BEGIN
  -- Create user_id index if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE indexname = 'members_user_id_key' 
    AND tablename = 'members'
  ) THEN
    CREATE UNIQUE INDEX members_user_id_key ON public.members(user_id);
  END IF;
  
  -- Create member_number index if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE indexname = 'members_member_number_key' 
    AND tablename = 'members'
  ) THEN
    CREATE UNIQUE INDEX members_member_number_key ON public.members(member_number);
  END IF;
END $$;

-- Enable RLS if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE tablename = 'members' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies only if they don't exist
DO $$
BEGIN
  -- Policy to allow users to view their own member record
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'members' 
    AND policyname = 'Users can view their own member data'
  ) THEN
    CREATE POLICY "Users can view their own member data"
    ON public.members
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
  
  -- Policy to allow admins to view all member records
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'members' 
    AND policyname = 'Admins can view all member data'
  ) THEN
    CREATE POLICY "Admins can view all member data"
    ON public.members
    FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    ));
  END IF;
  
  -- Policy to allow users to insert their own member record
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'members' 
    AND policyname = 'Users can insert their own member data'
  ) THEN
    CREATE POLICY "Users can insert their own member data"
    ON public.members
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
  
  -- Policy to allow admins to insert any member record
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'members' 
    AND policyname = 'Admins can insert any member data'
  ) THEN
    CREATE POLICY "Admins can insert any member data"
    ON public.members
    FOR INSERT
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    ));
  END IF;
  
  -- Policy to allow users to update their own member record
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'members' 
    AND policyname = 'Users can update their own member data'
  ) THEN
    CREATE POLICY "Users can update their own member data"
    ON public.members
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
  
  -- Policy to allow admins to update any member record
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'members' 
    AND policyname = 'Admins can update any member data'
  ) THEN
    CREATE POLICY "Admins can update any member data"
    ON public.members
    FOR UPDATE
    USING (EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    ));
  END IF;
END $$;

-- Create or replace the update function
CREATE OR REPLACE FUNCTION public.update_member_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger if it doesn't exist
DO $$
BEGIN
  -- First, drop the trigger if it exists to avoid duplicates
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_member_updated_at_trigger'
  ) THEN
    DROP TRIGGER IF EXISTS update_member_updated_at_trigger ON public.members;
  END IF;
  
  -- Then create the trigger
  EXECUTE 'CREATE TRIGGER update_member_updated_at_trigger
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_member_updated_at()';
  
  RAISE NOTICE 'Created trigger update_member_updated_at_trigger on public.members';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating trigger: %', SQLERRM;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.generate_member_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_member(UUID) TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.members TO authenticated;

-- Update the handle_role_request function to handle member creation
CREATE OR REPLACE FUNCTION public.handle_role_request(
  p_request_id UUID, 
  p_action TEXT, 
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_current_status TEXT;
  v_request_type TEXT;
  v_approver_id UUID := auth.uid();
  v_result JSONB;
  v_error_message TEXT;
  v_error_detail TEXT;
  v_error_hint TEXT;
  v_error_context TEXT;
  v_member_result JSONB;
  v_volunteer_result JSONB;
  v_donor_result JSONB;
BEGIN
  -- Log function entry
  RAISE LOG 'handle_role_request: Starting for request_id=%, action=%, role=%', p_request_id, p_action, p_role;
  
  -- Ensure the user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_approver_id AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can approve/reject role requests';
  END IF;
  
  -- Start a transaction
  BEGIN
    -- Get the user_id and current status of the request with FOR UPDATE to lock the row
    RAISE LOG 'handle_role_request: Fetching request details for request_id=%', p_request_id;
    SELECT user_id, request_status, request_type INTO v_user_id, v_current_status, v_request_type
    FROM public.role_requests
    WHERE request_id = p_request_id
    FOR UPDATE;
    
    -- Check if request exists
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Request not found';
    END IF;
    
    -- Validate the current status
    IF v_current_status NOT IN ('pending') THEN
      RAISE EXCEPTION 'Request is not in a pending state';
    END IF;
    
    -- Validate the action
    IF p_action NOT IN ('approve', 'reject') THEN
      RAISE EXCEPTION 'Invalid action. Must be ''approve'' or ''reject''';
    END IF;
    
    -- Process the action
    IF p_action = 'approve' THEN
      RAISE LOG 'handle_role_request: Processing approval for role=%', p_role;
      
      -- Update the request status with approval details
      UPDATE public.role_requests
      SET
        request_status = 'approved',
        approved_by = v_approver_id,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE request_id = p_request_id;
      
      -- Create the appropriate role record based on the request type
      IF p_role = 'volunteer' THEN
        -- Create volunteer record if it doesn't exist
        SELECT public.create_volunteer(v_user_id) INTO v_result;
        IF v_result->>'status' = 'error' THEN
          RAISE EXCEPTION 'Failed to create volunteer record: %', v_result->>'message';
        END IF;
        
        -- Update user_roles table
        INSERT INTO public.user_roles (user_id, is_volunteer, updated_at)
        VALUES (v_user_id, TRUE, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          is_volunteer = TRUE,
          updated_at = NOW()
        RETURNING * INTO v_result;
        
      ELSEIF p_role = 'member' THEN
        -- Create member record if it doesn't exist
        SELECT public.create_member(v_user_id) INTO v_member_result;
        IF v_member_result->>'status' = 'error' THEN
          RAISE EXCEPTION 'Failed to create member record: %', v_member_result->>'message';
        END IF;

        -- Update user_roles table
        INSERT INTO public.user_roles (user_id, is_member, updated_at)
        VALUES (v_user_id, TRUE, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          is_member = TRUE,
          updated_at = NOW();
        
      ELSEIF p_role = 'donor' THEN
        -- Create donor record if it doesn't exist
        -- (Assuming a similar create_donor function exists)
        -- SELECT public.create_donor(v_user_id) INTO v_result;
        -- IF v_result->>'status' = 'error' THEN
        --   RAISE EXCEPTION 'Failed to create donor record: %', v_result->>'message';
        -- END IF;
        
        -- Update user_roles table
        INSERT INTO public.user_roles (user_id, is_donor, updated_at)
        VALUES (v_user_id, TRUE, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          is_donor = TRUE,
          updated_at = NOW();
      END IF;
      
      RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Request approved successfully',
        'request_id', p_request_id,
        'user_id', v_user_id,
        'role', p_role
      );
      
    ELSIF p_action = 'reject' THEN
      RAISE LOG 'handle_role_request: Rejecting request %', p_request_id;
      
      -- Update the request status for rejection
      UPDATE public.role_requests
      SET
        request_status = 'rejected',
        rejected_by = v_approver_id,
        rejected_at = NOW(),
        updated_at = NOW(),
        rejection_reason = 'Rejected by admin' -- This could be a parameter
      WHERE request_id = p_request_id;
      
      RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Request rejected successfully',
        'request_id', p_request_id,
        'user_id', v_user_id,
        'role', p_role
      );
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    -- Capture error details
    GET STACKED DIAGNOSTICS
      v_error_message = MESSAGE_TEXT,
      v_error_detail = PG_EXCEPTION_DETAIL,
      v_error_hint = PG_EXCEPTION_HINT,
      v_error_context = PG_EXCEPTION_CONTEXT;
      
    -- Log the error
    RAISE LOG 'Error in handle_role_request: %', v_error_message;
    RAISE LOG 'Detail: %', v_error_detail;
    RAISE LOG 'Hint: %', v_error_hint;
    RAISE LOG 'Context: %', v_error_context;
    
    -- Re-raise the error
    RAISE EXCEPTION '%', v_error_message
      USING HINT = v_error_hint,
            DETAIL = v_error_detail,
            ERRCODE = 'P0001';
  END;
END;
$$;

-- Grant execute permissions on the updated function
GRANT EXECUTE ON FUNCTION public.handle_role_request(UUID, TEXT, TEXT) TO authenticated;
