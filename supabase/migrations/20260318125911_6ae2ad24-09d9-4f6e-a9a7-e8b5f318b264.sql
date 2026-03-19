
-- Add columns to store generated credentials for officers
ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS generated_email text;
ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS initial_password text;
