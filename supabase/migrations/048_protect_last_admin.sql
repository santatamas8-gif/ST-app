-- Prevent demoting the last remaining admin.
-- Login used to upsert profiles.role = 'player' when the role read failed,
-- which could wipe the only admin. This trigger blocks that write.

CREATE OR REPLACE FUNCTION public.profiles_protect_last_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.role = 'admin'
     AND NEW.role IS DISTINCT FROM 'admin' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.role = 'admin'
        AND p.id IS DISTINCT FROM OLD.id
    ) THEN
      RAISE EXCEPTION 'Cannot demote the last remaining admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_last_admin ON public.profiles;
CREATE TRIGGER profiles_protect_last_admin
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.profiles_protect_last_admin();
