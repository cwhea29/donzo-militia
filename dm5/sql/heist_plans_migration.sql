-- =====================================================
-- DONZO - HEIST PLANS / OPERATION SEQUENCES
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Heist Plans table
CREATE TABLE IF NOT EXISTS public.heist_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Heist Plan Steps (ordered)
CREATE TABLE IF NOT EXISTS public.heist_plan_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES public.heist_plans(id) ON DELETE CASCADE,
    marker_id UUID REFERENCES public.markers(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plan_id, marker_id)  -- one marker per plan for now
);

-- Enable Realtime (optional)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'heist_plans'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.heist_plans;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'heist_plan_steps'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.heist_plan_steps;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_heist_plan_steps_plan ON public.heist_plan_steps(plan_id, step_order);
CREATE INDEX IF NOT EXISTS idx_heist_plan_steps_marker ON public.heist_plan_steps(marker_id);

-- Disable RLS for simplicity (like other tables)
ALTER TABLE public.heist_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.heist_plan_steps DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- Done. You can now create Heist Plans in the app.
-- =====================================================