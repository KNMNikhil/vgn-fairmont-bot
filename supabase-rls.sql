-- ============================================================
-- VGN Fairmont Bot — Database Security Migration (RLS)
-- Run this in your Supabase SQL Editor to secure your data.
-- ============================================================

-- Enable Row Level Security (RLS) on all tables to deny public access.
-- By default, tables with RLS enabled but no policies deny all queries from the anon key.
-- The Next.js backend uses the SUPABASE_SERVICE_ROLE_KEY, which securely bypasses RLS,
-- so the bot and admin dashboard will continue to work perfectly while hackers are blocked.

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- If you have these tables, enable RLS on them too
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tickets') THEN
        ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'maintenance_dues') THEN
        ALTER TABLE public.maintenance_dues ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;
