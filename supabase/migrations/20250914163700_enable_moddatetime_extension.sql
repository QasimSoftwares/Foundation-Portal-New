-- Enable the moddatetime extension if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'moddatetime') THEN
    CREATE EXTENSION moddatetime;
  END IF;
END $$;
