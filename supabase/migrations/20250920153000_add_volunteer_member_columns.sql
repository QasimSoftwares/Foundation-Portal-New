-- Add missing columns to user_roles table
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS is_volunteer BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_member BOOLEAN NOT NULL DEFAULT false;

-- Update RLS policy to include new columns
DROP POLICY IF EXISTS "Enable all for users based on user_id" ON public.user_roles;
CREATE POLICY "Enable all for users based on user_id" 
ON public.user_roles
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.user_roles TO authenticated;
