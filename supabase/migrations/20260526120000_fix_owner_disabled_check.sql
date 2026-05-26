-- Owner disable: check is_active with same id/email resolution as role lookup

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

    IF NOT COALESCE(owner_disabled, false) THEN
      SELECT email INTO auth_email FROM auth.users WHERE id = auth.uid();
      IF auth_email IS NOT NULL THEN
        SELECT (p.is_active = false) INTO owner_disabled
        FROM public.profiles p
        WHERE lower(p.email) = lower(auth_email)
        ORDER BY p.updated_at DESC
        LIMIT 1;
      END IF;
    END IF;

    IF COALESCE(owner_disabled, false) THEN
      RETURN NULL;
    END IF;
  END IF;

  RETURN found_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_my_owner_account_disabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_email TEXT;
  owner_disabled BOOLEAN;
BEGIN
  SELECT (p.is_active = false) INTO owner_disabled
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.role = 'owner'
  LIMIT 1;

  IF COALESCE(owner_disabled, false) THEN
    RETURN true;
  END IF;

  SELECT email INTO auth_email FROM auth.users WHERE id = auth.uid();

  IF auth_email IS NOT NULL THEN
    SELECT (p.is_active = false) INTO owner_disabled
    FROM public.profiles p
    WHERE lower(p.email) = lower(auth_email) AND p.role = 'owner'
    ORDER BY p.updated_at DESC
    LIMIT 1;
  END IF;

  RETURN COALESCE(owner_disabled, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_my_owner_account_disabled() TO authenticated;
