-- Create enum type for request status
CREATE TYPE donor_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create donor_requests table
CREATE TABLE IF NOT EXISTS public.donor_requests (
  donor_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status donor_request_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ
);

-- Add row-level security
ALTER TABLE public.donor_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_donor_requests_user_id ON public.donor_requests(user_id);
CREATE INDEX idx_donor_requests_status ON public.donor_requests(status);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_donor_requests_updated_at
BEFORE UPDATE ON public.donor_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create RPC function to submit donor request
CREATE OR REPLACE FUNCTION public.create_donor_request()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id UUID;
  user_has_pending_request BOOLEAN;
BEGIN
  -- Check if user already has a pending request
  SELECT EXISTS (
    SELECT 1 
    FROM public.donor_requests 
    WHERE user_id = auth.uid() 
    AND status = 'pending'
  ) INTO user_has_pending_request;

  IF user_has_pending_request THEN
    RAISE EXCEPTION 'You already have a pending donor request';
  END IF;

  -- Insert new request
  INSERT INTO public.donor_requests (user_id)
  VALUES (auth.uid())
  RETURNING donor_request_id INTO request_id;

  -- Log the event
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    auth.uid(),
    'donor_request_created',
    'donor_request',
    request_id,
    jsonb_build_object('status', 'pending')
  );

  RETURN request_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_donor_request() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Create a function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND is_admin = true
    LIMIT 1
  );
$$;

-- RLS Policies
CREATE POLICY "Users can view their own donor requests"
ON public.donor_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all donor requests"
ON public.donor_requests
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Create a function to get user profile data
CREATE OR REPLACE FUNCTION public.get_user_profile()
RETURNS TABLE (
  full_name TEXT,
  email TEXT,
  phone_number TEXT,
  address JSONB
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    full_name,
    email,
    phone_number,
    address
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_profile() TO authenticated;
