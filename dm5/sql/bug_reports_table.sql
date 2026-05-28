-- =====================================================
-- DONZO - BUG REPORTS TABLE
-- Run this in Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS public.bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    stack TEXT,
    url TEXT,
    user_agent TEXT,
    username TEXT,
    user_level INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime (optional but useful)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'bug_reports'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bug_reports;
    END IF;
END $$;

-- Disable RLS for simplicity (consistent with other tables in this project)
ALTER TABLE public.bug_reports DISABLE ROW LEVEL SECURITY;

-- Index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON public.bug_reports(created_at DESC);

-- =====================================================
-- Done. You can now log bugs from the frontend.
-- =====================================================