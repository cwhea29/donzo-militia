-- =====================================================
-- DONZO — Add default Boss user (run if login says "User not found")
-- =====================================================
-- Use after a reset, or if the users table is empty.
-- Login: boss / changeme  (change password after first login)
-- =====================================================

INSERT INTO public.users (username, password, display_name, access_level, created_by)
VALUES ('boss', 'changeme', 'Boss', 11, 'system')
ON CONFLICT (username) DO NOTHING;