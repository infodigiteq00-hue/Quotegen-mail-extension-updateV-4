-- Paste entire file into Supabase Dashboard → SQL Editor → Run
-- Project: hrtvgakkumtrgsfaxjvp
-- Fixes: contact_number, is_active, RLS, get_my_role, is_superadmin

-- 1) Missing columns (owner management)
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS contact_number TEXT NOT NULL DEFAULT '';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS contact_number TEXT NOT NULL DEFAULT '';

-- 2) Superadmin RLS helper (email fallback)
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_email TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  ) THEN
    RETURN true;
  END IF;

  SELECT email INTO auth_email FROM auth.users WHERE id = auth.uid();

  IF auth_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(email) = lower(auth_email) AND role = 'superadmin'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- 3) Role lookup for login
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_role public.app_role;
  auth_email TEXT;
  owner_disabled BOOLEAN;
BEGIN
  SELECT p.role INTO found_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF found_role IS NULL THEN
    SELECT email INTO auth_email FROM auth.users WHERE id = auth.uid();
    IF auth_email IS NOT NULL THEN
      SELECT p.role INTO found_role
      FROM public.profiles p
      WHERE lower(p.email) = lower(auth_email)
      ORDER BY p.updated_at DESC
      LIMIT 1;
    END IF;
  END IF;

  IF found_role IS NULL THEN
    SELECT i.role::public.app_role INTO found_role
    FROM public.invites i
    WHERE i.user_id = auth.uid() AND i.status = 'accepted'
    ORDER BY i.accepted_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF found_role IS NULL THEN
    RETURN NULL;
  END IF;

  IF found_role = 'owner' THEN
    SELECT (p.is_active = false) INTO owner_disabled
    FROM public.profiles p
    WHERE p.id = auth.uid()
    LIMIT 1;
    IF COALESCE(owner_disabled, false) THEN
      RETURN NULL;
    END IF;
  END IF;

  RETURN found_role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- 4) Superadmin can update profiles & delete invites
DROP POLICY IF EXISTS profiles_update_superadmin ON public.profiles;
CREATE POLICY profiles_update_superadmin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS invites_delete_superadmin ON public.invites;
CREATE POLICY invites_delete_superadmin ON public.invites
  FOR DELETE TO authenticated
  USING (public.is_superadmin());

GRANT DELETE ON public.invites TO authenticated;

-- 5) Align profile id with auth user when emails match
UPDATE public.profiles p
SET id = u.id, updated_at = now()
FROM auth.users u
WHERE lower(p.email) = lower(u.email)
  AND p.id <> u.id
  AND NOT EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = u.id);
