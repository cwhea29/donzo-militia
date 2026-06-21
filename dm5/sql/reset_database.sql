-- =====================================================
-- DONZO — FULL DATABASE RESET
-- =====================================================
-- WARNING: This script DESTROYS ALL existing Donzo data
-- (users, markers, comments, groups, heist plans, bugs,
-- audit logs) and rebuilds the schema from scratch.
--
-- HOW TO USE:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Paste this entire file and click Run
-- 3. Hard refresh the Donzo site (Ctrl + Shift + R)
-- 4. Log in with the default Boss account (see bottom)
--    or create users via the in-app Users panel
--
-- Storage: also creates the public "marker-images" bucket
-- for marker photo uploads.
-- =====================================================

BEGIN;

-- ── DROP (dependency order) ─────────────────────────────
DROP TABLE IF EXISTS public.heist_plan_steps CASCADE;
DROP TABLE IF EXISTS public.heist_plans CASCADE;
DROP TABLE IF EXISTS public.marker_group_members CASCADE;
DROP TABLE IF EXISTS public.marker_groups CASCADE;
DROP TABLE IF EXISTS public.marker_comments CASCADE;
DROP TABLE IF EXISTS public.marker_audit_log CASCADE;
DROP TABLE IF EXISTS public.bug_reports CASCADE;
DROP TABLE IF EXISTS public.markers CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

DROP FUNCTION IF EXISTS public.set_markers_updated_at() CASCADE;

-- ── USERS ───────────────────────────────────────────────
CREATE TABLE public.users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT NOT NULL UNIQUE,
    password      TEXT NOT NULL,
    display_name  TEXT,
    access_level  INTEGER NOT NULL DEFAULT 1
                  CHECK (access_level >= 1 AND access_level <= 11),
    created_by    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_access_level ON public.users (access_level DESC);
CREATE INDEX idx_users_username ON public.users (username);

-- ── MARKERS ─────────────────────────────────────────────
CREATE TABLE public.markers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    image_url        TEXT NOT NULL DEFAULT '',
    image_urls       JSONB NOT NULL DEFAULT '[]'::jsonb,
    category         TEXT NOT NULL DEFAULT 'poi',
    zone             TEXT NOT NULL
                     CHECK (zone IN ('mainland', 'cayo')),
    x                DOUBLE PRECISION NOT NULL
                     CHECK (x >= 0 AND x <= 1),
    y                DOUBLE PRECISION NOT NULL
                     CHECK (y >= 0 AND y <= 1),
    min_access_level INTEGER NOT NULL DEFAULT 1
                     CHECK (min_access_level >= 1 AND min_access_level <= 11),
    created_by       TEXT,
    created_by_level INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_markers_zone ON public.markers (zone);
CREATE INDEX idx_markers_access ON public.markers (min_access_level);
CREATE INDEX idx_markers_created_at ON public.markers (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_markers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_markers_updated_at
    BEFORE UPDATE ON public.markers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_markers_updated_at();

-- ── MARKER COMMENTS ─────────────────────────────────────
CREATE TABLE public.marker_comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marker_id  UUID NOT NULL REFERENCES public.markers(id) ON DELETE CASCADE,
    username   TEXT NOT NULL,
    comment    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_marker_comments_marker ON public.marker_comments (marker_id, created_at);

-- ── MARKER GROUPS ───────────────────────────────────────
CREATE TABLE public.marker_groups (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.marker_group_members (
    marker_id UUID NOT NULL REFERENCES public.markers(id) ON DELETE CASCADE,
    group_id  UUID NOT NULL REFERENCES public.marker_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (marker_id, group_id)
);

CREATE INDEX idx_marker_group_members_group ON public.marker_group_members (group_id);

-- ── AUDIT LOG ───────────────────────────────────────────
CREATE TABLE public.marker_audit_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marker_id    UUID REFERENCES public.markers(id) ON DELETE SET NULL,
    action       TEXT NOT NULL,
    performed_by TEXT,
    details      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_marker_audit_log_created ON public.marker_audit_log (created_at DESC);

-- ── HEIST PLANS ───────────────────────────────────────────
CREATE TABLE public.heist_plans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_by  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.heist_plan_steps (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id    UUID NOT NULL REFERENCES public.heist_plans(id) ON DELETE CASCADE,
    marker_id  UUID NOT NULL REFERENCES public.markers(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL DEFAULT 1,
    notes      TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, marker_id)
);

CREATE INDEX idx_heist_plan_steps_plan ON public.heist_plan_steps (plan_id, step_order);
CREATE INDEX idx_heist_plan_steps_marker ON public.heist_plan_steps (marker_id);

-- ── BUG REPORTS ─────────────────────────────────────────
CREATE TABLE public.bug_reports (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message    TEXT NOT NULL,
    stack      TEXT,
    url        TEXT,
    user_agent TEXT,
    username   TEXT,
    user_level INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bug_reports_created_at ON public.bug_reports (created_at DESC);

-- ── ROW LEVEL SECURITY (disabled — internal tool) ───────
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.markers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marker_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marker_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marker_group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marker_audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.heist_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.heist_plan_steps DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports DISABLE ROW LEVEL SECURITY;

-- ── REALTIME ────────────────────────────────────────────
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users',
        'markers',
        'marker_comments',
        'marker_groups',
        'marker_group_members',
        'marker_audit_log',
        'heist_plans',
        'heist_plan_steps',
        'bug_reports'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        ) THEN
            EXECUTE format(
                'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
                t
            );
        END IF;
    END LOOP;
END $$;

-- ── STORAGE BUCKET (marker images) ───────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'marker-images',
    'marker-images',
    TRUE,
    8388608,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow public read + authenticated-style anon upload/delete for internal tool
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'donzo_marker_images_public_read'
    ) THEN
        CREATE POLICY donzo_marker_images_public_read
            ON storage.objects
            FOR SELECT
            USING (bucket_id = 'marker-images');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'donzo_marker_images_public_insert'
    ) THEN
        CREATE POLICY donzo_marker_images_public_insert
            ON storage.objects
            FOR INSERT
            WITH CHECK (bucket_id = 'marker-images');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'donzo_marker_images_public_update'
    ) THEN
        CREATE POLICY donzo_marker_images_public_update
            ON storage.objects
            FOR UPDATE
            USING (bucket_id = 'marker-images')
            WITH CHECK (bucket_id = 'marker-images');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'donzo_marker_images_public_delete'
    ) THEN
        CREATE POLICY donzo_marker_images_public_delete
            ON storage.objects
            FOR DELETE
            USING (bucket_id = 'marker-images');
    END IF;
END $$;

-- ── DEFAULT BOSS ACCOUNT ──────────────────────────────────
-- Change the password immediately after first login.
INSERT INTO public.users (username, password, display_name, access_level, created_by)
VALUES ('boss', 'changeme', 'Boss', 11, 'system');

COMMIT;

-- =====================================================
-- Done.
--
-- Default login after reset:
--   Username: boss
--   Password: changeme
--
-- To restore your 17 original marker positions after
-- re-creating markers, run restore_marker_positions.sql
-- (update the UUIDs if markers were re-inserted).
-- =====================================================