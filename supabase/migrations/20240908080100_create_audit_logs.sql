-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET
);

-- Add row-level security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Create policy to allow users to see their own audit logs
CREATE POLICY "Users can view their own audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create policy to allow service role to insert audit logs
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Create policy to allow service role to update audit logs
CREATE POLICY "Service role can update audit logs"
ON public.audit_logs
FOR UPDATE
TO service_role
USING (true);

-- Grant permissions
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.audit_logs TO service_role;
