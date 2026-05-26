-- Reliable role lookup for logged-in users (bypasses RLS, supports email fallback)

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

-- One-time fix: align profile.id with auth.users.id when email matches
UPDATE public.profiles p
SET id = u.id, updated_at = now()
FROM auth.users u
WHERE lower(p.email) = lower(u.email)
  AND p.id <> u.id
  AND NOT EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = u.id);
