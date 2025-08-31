-- ============================================
-- Migration: Add secure refresh tokens table
-- ============================================

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT false,
    ip_address TEXT,
    user_agent TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id 
    ON public.refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at 
    ON public.refresh_tokens(expires_at);

-- Create index for token lookup
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token 
    ON public.refresh_tokens(token);

-- Enable Row Level Security
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only access their own tokens
CREATE POLICY "Users can view their own refresh tokens"
ON public.refresh_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can create their own refresh tokens"
ON public.refresh_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can revoke their own tokens
CREATE POLICY "Users can revoke their own refresh tokens"
ON public.refresh_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to create a new refresh token
CREATE OR REPLACE FUNCTION public.create_refresh_token(
    p_user_id UUID,
    p_token TEXT,
    p_expires_in_seconds INTEGER DEFAULT 60 * 60 * 24 * 7, -- Default 7 days
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) 
RETURNS public.refresh_tokens
LANGUAGE sql
SECURITY DEFINER
AS $$
    INSERT INTO public.refresh_tokens (
        user_id,
        token,
        expires_at,
        ip_address,
        user_agent
    )
    VALUES (
        p_user_id,
        p_token,
        NOW() + (p_expires_in_seconds * INTERVAL '1 second'),
        p_ip_address,
        p_user_agent
    )
    RETURNING *;
$$;

-- Function to revoke all user's refresh tokens (on password change, etc.)
CREATE OR REPLACE FUNCTION public.revoke_all_user_refresh_tokens(p_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE public.refresh_tokens
    SET revoked = true
    WHERE user_id = p_user_id;
$$;

-- Function to validate and return a refresh token if valid
CREATE OR REPLACE FUNCTION public.validate_refresh_token(
    p_token TEXT,
    p_user_id UUID DEFAULT NULL
) 
RETURNS TABLE (
    is_valid BOOLEAN,
    user_id UUID,
    expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        true,
        user_id,
        expires_at
    FROM public.refresh_tokens
    WHERE token = p_token
    AND revoked = false
    AND expires_at > NOW()
    AND (p_user_id IS NULL OR user_id = p_user_id);
$$;

-- Cleanup job for expired tokens (to be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    DELETE FROM public.refresh_tokens
    WHERE expires_at < NOW() - INTERVAL '1 day';
$$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.refresh_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_refresh_token(UUID, TEXT, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_refresh_token(TEXT, UUID) TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.refresh_tokens IS 'Stores refresh tokens for user sessions with security metadata';
COMMENT ON COLUMN public.refresh_tokens.token IS 'Hashed refresh token (never store plaintext)';
COMMENT ON COLUMN public.refresh_tokens.expires_at IS 'When the token expires and becomes invalid';
COMMENT ON COLUMN public.refresh_tokens.revoked IS 'Whether the token has been manually revoked';

-- Create a policy to allow users to delete their own expired/revoked tokens
CREATE POLICY "Users can delete their own expired or revoked tokens"
ON public.refresh_tokens
FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id 
    AND (expires_at < NOW() OR revoked = true)
);
