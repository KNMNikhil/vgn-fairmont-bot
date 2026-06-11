-- ============================================================
-- VGN Fairmont Bot — Cost Tracking & Resident Whitelist
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- 1. Create the `residents` table for Whitelisting
-- If a residents table already exists from an older setup, rename it first to avoid conflicts.
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'residents') THEN
        -- Check if it lacks the new 'phone' column
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'residents' AND column_name = 'phone') THEN
            ALTER TABLE public.residents RENAME TO residents_backup_old;
        END IF;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.residents (
    phone text PRIMARY KEY,
    name text,
    flat_number text,
    is_approved boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for residents
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

-- 2. Add Token Tracking columns to `messages` table
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS prompt_tokens integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS completion_tokens integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_tokens integer DEFAULT 0;

-- 3. Add an Admin User for your own number to test (Replace with your actual number)
INSERT INTO public.residents (phone, name, flat_number, is_approved)
VALUES ('918056240206', 'Admin Nagesh', 'Admin', true)
ON CONFLICT (phone) DO NOTHING;
