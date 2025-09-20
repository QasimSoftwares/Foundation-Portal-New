-- Donations schema: enums, tables, RLS, and human-readable ID generators
-- Safe re-runs
DO $$ BEGIN
  CREATE TYPE public.enum_donation_currency AS ENUM ('PKR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.enum_payment_mode AS ENUM ('Online', 'BankTransfer', 'CreditCard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.enum_donation_type AS ENUM ('Zakat', 'Sadqa', 'General');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.enum_request_status AS ENUM ('Pending', 'Approved', 'Rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper table to generate yearly human IDs per prefix
CREATE TABLE IF NOT EXISTS public.human_id_counters (
  prefix text NOT NULL,
  year int NOT NULL,
  last_val int NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, year)
);

-- Function to get the next yearly counter for a given prefix
CREATE OR REPLACE FUNCTION public.next_yearly_human_id(prefix text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  yr int := EXTRACT(YEAR FROM now())::int;
  next_val int;
BEGIN
  LOOP
    UPDATE public.human_id_counters
      SET last_val = last_val + 1
      WHERE prefix = next_yearly_human_id.prefix AND year = yr
      RETURNING last_val INTO next_val;
    IF FOUND THEN
      RETURN format('%s-%s-%s', prefix, yr, to_char(next_val, 'FM000'));
    END IF;

    BEGIN
      INSERT INTO public.human_id_counters(prefix, year, last_val)
      VALUES (next_yearly_human_id.prefix, yr, 1)
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN unique_violation THEN
      -- ignore and retry
      NULL;
    END;
  END LOOP;
END;
$$;

-- donation_requests table
CREATE TABLE IF NOT EXISTS public.donation_requests (
  donation_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES public.donors(donor_id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency public.enum_donation_currency NOT NULL DEFAULT 'PKR',
  category_id uuid NOT NULL REFERENCES public.donation_categories(donation_category_id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.projects(project_id) ON DELETE RESTRICT,
  mode_of_payment public.enum_payment_mode NOT NULL,
  donation_type public.enum_donation_type NOT NULL,
  donation_date date NOT NULL,
  status public.enum_request_status NOT NULL DEFAULT 'Pending',
  created_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text
);

-- donations table
CREATE TABLE IF NOT EXISTS public.donations (
  donation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_human_id text UNIQUE,
  donor_id uuid NOT NULL REFERENCES public.donors(donor_id) ON DELETE RESTRICT,
  donor_human_id text,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency public.enum_donation_currency NOT NULL DEFAULT 'PKR',
  category_id uuid NOT NULL REFERENCES public.donation_categories(donation_category_id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.projects(project_id) ON DELETE RESTRICT,
  mode_of_payment public.enum_payment_mode NOT NULL,
  donation_type public.enum_donation_type NOT NULL,
  donation_date date NOT NULL,
  transaction_id text,
  receipt_id text UNIQUE,
  receipt_pdf_path text,
  created_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_donation_requests_donor ON public.donation_requests(donor_id);
CREATE INDEX IF NOT EXISTS idx_donation_requests_status ON public.donation_requests(status);
CREATE INDEX IF NOT EXISTS idx_donation_requests_date ON public.donation_requests(donation_date);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON public.donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_date ON public.donations(donation_date);
CREATE INDEX IF NOT EXISTS idx_donations_project ON public.donations(project_id);

-- Triggers to populate human-readable IDs and donor_human_id
CREATE OR REPLACE FUNCTION public.set_donation_human_ids()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  donor_num text;
BEGIN
  IF NEW.donation_human_id IS NULL THEN
    NEW.donation_human_id := public.next_yearly_human_id('DON');
  END IF;
  IF NEW.receipt_id IS NULL THEN
    NEW.receipt_id := public.next_yearly_human_id('REC');
  END IF;
  IF NEW.donor_human_id IS NULL THEN
    SELECT donor_number INTO donor_num FROM public.donors WHERE donor_id = NEW.donor_id;
    NEW.donor_human_id := donor_num;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_donation_human_ids ON public.donations;
CREATE TRIGGER trg_set_donation_human_ids
BEFORE INSERT ON public.donations
FOR EACH ROW
EXECUTE FUNCTION public.set_donation_human_ids();

-- Enable RLS
ALTER TABLE public.donation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Policies for donation_requests
-- Admins full access
DROP POLICY IF EXISTS donation_requests_admin_all ON public.donation_requests;
CREATE POLICY donation_requests_admin_all ON public.donation_requests
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Donors: can select their own requests
DROP POLICY IF EXISTS donation_requests_select_own ON public.donation_requests;
CREATE POLICY donation_requests_select_own ON public.donation_requests
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.donors d
    WHERE d.donor_id = donation_requests.donor_id
      AND d.user_id = auth.uid()
  )
);

-- Admins: can insert donation requests; donors cannot insert
DROP POLICY IF EXISTS donation_requests_insert_own ON public.donation_requests;
CREATE POLICY donation_requests_insert_own ON public.donation_requests
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
);

-- Admins: can update donation requests; donors cannot update
DROP POLICY IF EXISTS donation_requests_update_pending_own ON public.donation_requests;
CREATE POLICY donation_requests_update_pending_own ON public.donation_requests
FOR UPDATE TO authenticated
USING (
  public.is_admin()
)
WITH CHECK (
  public.is_admin()
);

-- Policies for donations
-- Admins full access
DROP POLICY IF EXISTS donations_admin_all ON public.donations;
CREATE POLICY donations_admin_all ON public.donations
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Donors: read-only their own donations
DROP POLICY IF EXISTS donations_select_own ON public.donations;
CREATE POLICY donations_select_own ON public.donations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.donors d
    WHERE d.donor_id = donations.donor_id
      AND d.user_id = auth.uid()
  )
);

-- Note: Inserts/approvals should be handled by RPCs; donors should not insert directly into donations.

-- Foreign key sanity comments
COMMENT ON TABLE public.donation_requests IS 'End-user requested donations pending approval; feeds into donations upon approval.';
COMMENT ON TABLE public.donations IS 'Approved/recorded donations with human-readable IDs and receipts.';
