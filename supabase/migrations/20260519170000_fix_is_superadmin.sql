-- is_superadmin must match get_my_role (email fallback when profile.id <> auth.uid())

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
