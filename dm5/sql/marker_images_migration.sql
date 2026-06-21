-- Migration: add multi-image support to markers
-- Run in Supabase SQL Editor after deploying the client update.

ALTER TABLE public.markers
  ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill existing single images into the array
UPDATE public.markers
SET image_urls = jsonb_build_array(image_url)
WHERE image_url <> ''
  AND (image_urls IS NULL OR image_urls = '[]'::jsonb);