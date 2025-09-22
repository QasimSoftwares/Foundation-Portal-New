-- This migration adds the necessary storage policy to allow admins to upload receipts.

-- 1. Ensure the 'receipts' bucket exists.
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Create a policy that allows admins to upload to the 'receipts' bucket.
-- This policy checks if the user is an admin using the canonical is_admin() function.
CREATE POLICY "Admins can upload receipts" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' AND
  public.is_admin()
);

-- 3. (Optional but recommended) Add policies for other operations.

-- Admins can view all receipts.
CREATE POLICY "Admins can view receipts" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND
  public.is_admin()
);

-- Admins can update/overwrite receipts.
CREATE POLICY "Admins can update receipts" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  public.is_admin()
);

-- Admins can delete receipts.
CREATE POLICY "Admins can delete receipts" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  public.is_admin()
);


RAISE NOTICE 'Successfully created storage policies for the receipts bucket.';
