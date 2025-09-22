-- supabase/migrations/20250922224500_secure_receipts_storage_policies.sql
-- Purpose: Ensure donors can only read their own receipts from Storage and admins can read all.
-- Bucket: receipts

-- Notes:
-- storage.objects has columns: id, bucket_id, name, owner, metadata, etc.
-- We match donations.receipt_pdf_path to storage.objects.name.
-- Upload code saves path like 'donations/<donation_id>.pdf' in bucket 'receipts'.

-- 1) Drop any overly broad read policy if it exists (name may differ between envs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated read access to receipts'
  ) THEN
    EXECUTE 'DROP POLICY "Allow authenticated read access to receipts" ON storage.objects';
  END IF;
END $$;

-- 2) Donor can read only their own receipts
CREATE POLICY receipts_donor_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1
    FROM public.donations d
    JOIN public.donors dn ON dn.donor_id = d.donor_id
    WHERE d.receipt_pdf_path = storage.objects.name
      AND dn.user_id = auth.uid()
  )
);

-- 3) Admins can read all receipts
CREATE POLICY receipts_admin_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND public.is_admin()
);

-- (Optional) Ensure write is restricted to admins only (if not already covered)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname = 'receipts_admin_write'
  ) THEN
    EXECUTE 'CREATE POLICY receipts_admin_write
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (bucket_id = ''receipts'' AND public.is_admin())
      WITH CHECK (bucket_id = ''receipts'' AND public.is_admin())';
  END IF;
END $$;

-- Ensure RLS is enabled (it is by default for storage.objects, but being explicit is safe)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
