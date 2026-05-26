-- Owner management: contact number, account active flag, admin policies

ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS contact_number TEXT NOT NULL DEFAULT '';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS contact_number TEXT NOT NULL DEFAULT '';

-- Sync contact from invite to profile on acceptance
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
  resolved_contact TEXT;
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
    resolved_contact := COALESCE(inv.contact_number, '');

    UPDATE public.invites
    SET
      user_id = NEW.id,
      status = 'accepted',
      accepted_at = now(),
      updated_at = now()
    WHERE id = inv.id;

    INSERT INTO public.profiles (id, email, full_name, role, contact_number, is_active)
    VALUES (NEW.id, NEW.email, resolved_name, resolved_role, resolved_contact, true)
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      contact_number = EXCLUDED.contact_number,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE POLICY profiles_update_superadmin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY invites_delete_superadmin ON public.invites
  FOR DELETE TO authenticated
  USING (public.is_superadmin());

GRANT DELETE ON public.invites TO authenticated;
