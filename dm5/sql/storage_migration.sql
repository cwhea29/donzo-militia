-- =====================================================
-- DONZO — STORAGE & ADMIN PANEL
-- Run this in Supabase Dashboard → SQL Editor
-- =====================================================
-- Adds:
--   • storage_items      — the catalog of stockable items + live quantity
--   • storage_audit_log  — full record of every storage action
--
-- Storage page (level 2+): add / remove quantity of items.
-- Admin Panel (level 7+):  add new item names, view + export the log.
-- =====================================================

-- 1. Storage items (catalog + current quantity) ────────
CREATE TABLE IF NOT EXISTS public.storage_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    quantity   INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_items_name ON public.storage_items (name);

-- Keep updated_at fresh on every change
CREATE OR REPLACE FUNCTION public.set_storage_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_storage_items_updated_at ON public.storage_items;
CREATE TRIGGER trg_storage_items_updated_at
    BEFORE UPDATE ON public.storage_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_storage_items_updated_at();

-- 2. Storage audit log ─────────────────────────────────
-- item_name is denormalised so history survives item deletion.
CREATE TABLE IF NOT EXISTS public.storage_audit_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id        UUID REFERENCES public.storage_items(id) ON DELETE SET NULL,
    item_name      TEXT NOT NULL,
    action         TEXT NOT NULL,          -- add | remove | create_item | delete_item
    quantity       INTEGER,                -- amount added/removed (NULL for item create/delete)
    balance_after  INTEGER,                -- resulting quantity after the action
    performed_by   TEXT,
    performed_level INTEGER,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_audit_log_created ON public.storage_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_audit_log_item ON public.storage_audit_log (item_id);

-- 3. Disable RLS (internal tool — matches other Donzo tables) ──
ALTER TABLE public.storage_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_audit_log DISABLE ROW LEVEL SECURITY;

-- 4. Realtime (optional) ───────────────────────────────
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['storage_items', 'storage_audit_log']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- Done. Storage and Admin Panel are now ready to use.
-- =====================================================
