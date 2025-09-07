-- Ensure refresh_tokens has token_hash column and unique index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'refresh_tokens' AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE public.refresh_tokens ADD COLUMN token_hash text;
  END IF;
END $$;

-- Ensure unique index on token_hash
CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_token_hash_key ON public.refresh_tokens(token_hash);
