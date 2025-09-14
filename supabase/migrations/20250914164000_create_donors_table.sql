-- Drop existing objects if they exist
DROP TABLE IF EXISTS public.donors CASCADE;
DROP SEQUENCE IF EXISTS donor_number_seq;

-- Create a sequence for the donor number, resetting each year
CREATE SEQUENCE donor_number_seq;

-- Create the donors table
CREATE TABLE public.donors (
  donor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  donor_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add an index on the donor_number for faster lookups
CREATE INDEX idx_donor_number ON public.donors(donor_number);

-- Enable RLS
ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;

-- Create a trigger to automatically update the updated_at timestamp
CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.donors
FOR EACH ROW
EXECUTE PROCEDURE moddatetime (updated_at);

-- Define RLS policies for the donors table
-- Admins can do anything
CREATE POLICY "Allow all access to admins" ON public.donors
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Users can view their own donor record
CREATE POLICY "Allow individual user to view their own record" ON public.donors
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
