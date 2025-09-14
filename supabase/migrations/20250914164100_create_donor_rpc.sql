-- Table to manage yearly sequences for donor numbers
CREATE TABLE public.donor_number_config (
  year INT PRIMARY KEY,
  last_sequence_value INT NOT NULL DEFAULT 0
);

-- Allow admin access
ALTER TABLE public.donor_number_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to admins" ON public.donor_number_config
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- Function to get the next donor number
-- First drop the function if it exists
DROP FUNCTION IF EXISTS get_next_donor_number();

CREATE OR REPLACE FUNCTION get_next_donor_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INT;
  v_next_seq INT;
  v_donor_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW());

  INSERT INTO public.donor_number_config (year, last_sequence_value)
  VALUES (v_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_sequence_value = public.donor_number_config.last_sequence_value + 1
  RETURNING last_sequence_value INTO v_next_seq;

  v_donor_number := 'FF-' || v_year::TEXT || '-' || lpad(v_next_seq::TEXT, 2, '0');

  RETURN v_donor_number;
END;
$$;


-- RPC to create a new donor
-- First drop the function if it exists
DROP FUNCTION IF EXISTS create_donor(UUID);

CREATE OR REPLACE FUNCTION create_donor(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_donor_number TEXT;
  v_new_donor_id UUID;
BEGIN
  -- Ensure the user is an admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'User is not authorized to create a donor.');
  END IF;

  -- Generate the next donor number
  v_donor_number := get_next_donor_number();

  -- Insert into donors table
  INSERT INTO public.donors (user_id, donor_number)
  VALUES (p_user_id, v_donor_number)
  RETURNING donor_id INTO v_new_donor_id;

  -- Update user_roles
  UPDATE public.user_roles
  SET is_donor = TRUE
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Donor created successfully.',
    'donor_id', v_new_donor_id,
    'donor_number', v_donor_number
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'An unexpected error occurred: ' || SQLERRM);
END;
$$;
