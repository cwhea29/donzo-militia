-- =====================================================
-- DONZO - Restore Original Marker Positions
-- =====================================================
-- Purpose: Bulk restore the exact original x/y values
--          from the user's saved backup after coordinate
--          math experiments caused small shifts.
--
-- HOW TO USE:
-- 1. Copy everything below this line.
-- 2. Go to your Supabase project → SQL Editor.
-- 3. Paste and run the script.
-- 4. Hard refresh your Donzo site (Ctrl + Shift + R).
--
-- This script only touches x, y, and updated_at.
-- It is wrapped in a transaction for safety.
-- =====================================================

BEGIN;

-- 1. Attachment Crafting
UPDATE public.markers
SET x = 44.88078647,
    y = 83.81042352189732,
    updated_at = NOW()
WHERE id = '05a55517-0279-4e70-b5d7-2b9b860295ce';

-- 2. Ammunition Crafting
UPDATE public.markers
SET x = 49.32270050048828,
    y = 44.195915821872376,
    updated_at = NOW()
WHERE id = '094fe8a1-5194-4a60-9ecb-1323bfe57bc7';

-- 3. Aircraft Carrier Heist
UPDATE public.markers
SET x = 52.42115020751953,
    y = 90.90199031565258,
    updated_at = NOW()
WHERE id = '14b88bda-a33c-4881-8002-387945f7b849';

-- 4. Butchery Heist
UPDATE public.markers
SET x = 50.83458264668782,
    y = 77.03262068833116,
    updated_at = NOW()
WHERE id = '2f536344-6744-466b-aedb-119d05cf2d95';

-- 5. Scrapyard Heist
UPDATE public.markers
SET x = 46.09342575073242,
    y = 81.83530932666594,
    updated_at = NOW()
WHERE id = '3b33ef5a-cfe9-4831-9998-977ee5e62813';

-- 6. Oil Rig Heist
UPDATE public.markers
SET x = 42.95435587565104,
    y = 25.72351802843566,
    updated_at = NOW()
WHERE id = '3efb7e9d-4650-4710-baf1-c31cf0abbbcc';

-- 7. Merryweather Port Heist
UPDATE public.markers
SET x = 47.57631513807509,
    y = 88.88083125623949,
    updated_at = NOW()
WHERE id = '527b1a89-3c41-42ae-9934-855c0d3a8816';

-- 8. Blueprint Crafting
UPDATE public.markers
SET x = 44.50383504231771,
    y = 75.15552548011244,
    updated_at = NOW()
WHERE id = '693bca50-9137-46b8-8b5f-ece5f47b373f';

-- 9. Armour Crafting
UPDATE public.markers
SET x = 40.20189497205946,
    y = 40.95067989931431,
    updated_at = NOW()
WHERE id = '8029f658-be6d-45f6-8a4c-92adbd85fa92';

-- 10. Oneils Heist
UPDATE public.markers
SET x = 56.77763197157118,
    y = 30.139414148703498,
    updated_at = NOW()
WHERE id = '82787fd9-e565-4f8e-ada2-7342bdb8126a';

-- 11. HumaneLabs Heist
UPDATE public.markers
SET x = 61.20974223,
    y = 38.24696515,
    updated_at = NOW()
WHERE id = '92d848e7-7262-4dd2-b45c-bc85ebaf775b';

-- 12. Mineshaft Heist
UPDATE public.markers
SET x = 46.292173597547745,
    y = 50.97152370021543,
    updated_at = NOW()
WHERE id = 'a761d9cc-5e05-420a-9cd0-902915ecebe4';

-- 13. Gang Heist
UPDATE public.markers
SET x = 50.90350257025824,
    y = 50.07215951,
    updated_at = NOW()
WHERE id = 'b01a8d81-82be-4516-8ef4-5f6a6408406c';

-- 14. Cayo Part 1 Heist
UPDATE public.markers
SET x = 41.48492733638642,
    y = 22.641804620409804,
    updated_at = NOW()
WHERE id = 'b14c3925-7277-4973-af10-10819d86c810';

-- 15. Cayo Part 2 Heist
UPDATE public.markers
SET x = 67.63873484823361,
    y = 73.56454852239037,
    updated_at = NOW()
WHERE id = 'b8995554-330f-4d90-ab53-61d80ccf1827';

-- 16. Illegal Fishing Store
UPDATE public.markers
SET x = 53.37532679239909,
    y = 16.46236917055146,
    updated_at = NOW()
WHERE id = 'd468e594-dc7e-4e87-a49c-511d8938e173';

-- 17. Static Black Market
UPDATE public.markers
SET x = 46.97084638807509,
    y = 66.28047498949138,
    updated_at = NOW()
WHERE id = 'fc726bb7-3ea9-4a70-af6e-e94bb05434da';

COMMIT;

-- =====================================================
-- Done. All 17 markers should now have their original positions.
-- Hard refresh the site to see the changes.
-- =====================================================
