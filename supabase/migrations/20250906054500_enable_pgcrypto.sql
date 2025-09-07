-- Ensure pgcrypto is available for gen_random_uuid() and digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
