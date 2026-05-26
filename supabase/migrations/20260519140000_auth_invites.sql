-- Auth: roles, invites, profiles, RLS, and signup linkage

CREATE TYPE public.app_role AS ENUM ('superadmin', 'owner');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'owner',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX invites_pending_email_idx
  ON public.invites (lower(email))
  WHERE status = 'pending';

CREATE INDEX invites_token_idx ON public.invites (token) WHERE status = 'pending';
CREATE INDEX invites_user_id_idx ON public.invites (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Helpers (security definer for RLS checks)
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_role public.app_role;
  profile_role public.app_role;
BEGIN
  SELECT role INTO invite_role
  FROM public.invites
  WHERE user_id = auth.uid() AND status = 'accepted'
  ORDER BY accepted_at DESC NULLS LAST
  LIMIT 1;

  IF invite_role IS NOT NULL THEN
    RETURN invite_role;
  END IF;

  SELECT role INTO profile_role
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN profile_role;
END;
$$;

-- Link invite + profile when email is confirmed
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.invites;
  meta_token TEXT;
  resolved_name TEXT;
  resolved_role public.app_role;
BEGIN
  IF OLD.email_confirmed_at IS NOT NULL OR NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  meta_token := NEW.raw_user_meta_data ->> 'invite_token';
  resolved_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', '');

  IF meta_token IS NOT NULL AND meta_token <> '' THEN
    SELECT * INTO inv
    FROM public.invites
    WHERE token = meta_token
      AND status = 'pending'
      AND lower(email) = lower(NEW.email)
      AND expires_at > now()
    LIMIT 1;
  END IF;

  IF inv.id IS NULL THEN
    SELECT * INTO inv
    FROM public.invites
    WHERE lower(email) = lower(NEW.email)
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF inv.id IS NOT NULL THEN
    resolved_name := COALESCE(NULLIF(inv.full_name, ''), resolved_name);
    resolved_role := inv.role;

    UPDATE public.invites
    SET
      user_id = NEW.id,
      status = 'accepted',
      accepted_at = now(),
      updated_at = now()
    WHERE id = inv.id;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, resolved_name, resolved_role)
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_confirmed();

-- Superadmin profile bootstrap (run once after creating superadmin in Auth dashboard)
CREATE OR REPLACE FUNCTION public.bootstrap_superadmin_profile(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT DEFAULT 'Super Admin'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (p_user_id, p_email, p_full_name, 'superadmin')
  ON CONFLICT (id) DO UPDATE
  SET role = 'superadmin', email = EXCLUDED.email, full_name = EXCLUDED.full_name, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_superadmin_profile FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_superadmin_profile TO service_role;

-- RLS: profiles
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_superadmin());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- RLS: invites
CREATE POLICY invites_select_superadmin ON public.invites
  FOR SELECT TO authenticated
  USING (public.is_superadmin());

CREATE POLICY invites_select_own_accepted ON public.invites
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY invites_insert_superadmin ON public.invites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin());

CREATE POLICY invites_update_superadmin ON public.invites
  FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Public can validate invite token (read only pending row by token via RPC)
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role public.app_role,
  status TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.email, i.full_name, i.role, i.status, i.expires_at
  FROM public.invites i
  WHERE i.token = p_token
    AND i.status = 'pending'
    AND i.expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(TEXT) TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invites TO authenticated;
GRANT SELECT ON public.profiles TO anon;
