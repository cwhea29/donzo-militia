-- Migration: add Roxwood zone support
-- Run in Supabase SQL Editor before placing Roxwood markers.

ALTER TABLE public.markers DROP CONSTRAINT IF EXISTS markers_zone_check;

ALTER TABLE public.markers
  ADD CONSTRAINT markers_zone_check
  CHECK (zone IN ('mainland', 'cayo', 'roxwood'));