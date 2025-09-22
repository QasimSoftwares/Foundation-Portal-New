-- This migration updates the storage policies for the 'receipts' bucket to use the new, reliable is_storage_admin() function.

-- Drop the old, incorrect policies first.
DROP POLICY IF EXISTS "Admins can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete receipts" ON storage.objects;

-- Re-create the policies using the correct, storage-safe admin check.

CREATE POLICY "Admins can upload receipts" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' AND
  public.is_storage_admin()
);

CREATE POLICY "Admins can view receipts" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND
  public.is_storage_admin()
);

CREATE POLICY "Admins can update receipts" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  public.is_storage_admin()
);

CREATE POLICY "Admins can delete receipts" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  public.is_storage_admin()
);

RAISE NOTICE 'Successfully updated storage policies for the receipts bucket to use is_storage_admin().';
