-- Migration: Fix donations schema and policies for receipt uploads
-- This migration adds any missing columns used by the app and creates RLS policies
-- so that admins can update the receipt_pdf_path after uploading a receipt.

-- 1) Add missing columns if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'donations' AND column_name = 'transaction_id'
  ) THEN
    ALTER TABLE public.donations ADD COLUMN transaction_id text;
    RAISE NOTICE 'Added donations.transaction_id column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'donations' AND column_name = 'receipt_id'
  ) THEN
    ALTER TABLE public.donations ADD COLUMN receipt_id text;
    RAISE NOTICE 'Added donations.receipt_id column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'donations' AND column_name = 'receipt_pdf_path'
  ) THEN
    ALTER TABLE public.donations ADD COLUMN receipt_pdf_path text;
    RAISE NOTICE 'Added donations.receipt_pdf_path column';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error adding columns to donations: %', SQLERRM;
END $$;

-- 2) Ensure RLS is enabled on donations (optional based on your setup)
-- Enable only if your project uses RLS for donations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'donations' AND rowsecurity = true
  ) THEN
    ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on public.donations';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not enable RLS on donations (may already be enabled): %', SQLERRM;
END $$;

-- 3) Create policies to allow admins to SELECT and UPDATE donations
DO $$
BEGIN
  -- SELECT policy for admins
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'donations' AND policyname = 'Admins can view donations'
  ) THEN
    DROP POLICY "Admins can view donations" ON public.donations;
  END IF;
  EXECUTE 'CREATE POLICY "Admins can view donations" ON public.donations FOR SELECT TO authenticated USING (public.is_admin())';
  RAISE NOTICE 'Created SELECT policy for donations';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create SELECT policy: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- UPDATE policy scoped to receipt_pdf_path for admins
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'donations' AND policyname = 'Admins can update donation receipt path'
  ) THEN
    DROP POLICY "Admins can update donation receipt path" ON public.donations;
  END IF;
  EXECUTE 'CREATE POLICY "Admins can update donation receipt path" ON public.donations FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  RAISE NOTICE 'Created UPDATE policy for donations';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create UPDATE policy: %', SQLERRM;
END $$;

-- 4) Optional: Add helpful comment
COMMENT ON COLUMN public.donations.receipt_pdf_path IS 'Path in Supabase Storage (e.g., receipts/donations/<donation_id>.pdf)';
