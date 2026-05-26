-- Run in Supabase SQL Editor if login says "No role assigned"
-- Step 1: Confirm auth user id matches profile (replace email if needed)

SELECT u.id AS auth_user_id, u.email, p.id AS profile_id, p.role
FROM auth.users u
LEFT JOIN public.profiles p ON lower(p.email) = lower(u.email)
WHERE lower(u.email) = lower('info.digiteq00@gmail.com');

-- Step 2: Sync profile id to auth user id (when they differ)
UPDATE public.profiles p
SET id = u.id, updated_at = now()
FROM auth.users u
WHERE lower(p.email) = lower(u.email)
  AND p.id <> u.id
  AND NOT EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = u.id);

-- Step 3: Ensure superadmin role
INSERT INTO public.profiles (id, email, full_name, role)
SELECT u.id, u.email, 'Super Admin', 'superadmin'
FROM auth.users u
WHERE lower(u.email) = lower('info.digiteq00@gmail.com')
ON CONFLICT (id) DO UPDATE
SET role = 'superadmin', email = EXCLUDED.email, updated_at = now();

-- Step 4: Fix is_superadmin for dashboard (run migration file)
-- supabase/migrations/20260519170000_fix_is_superadmin.sql
