-- Congresos (cliente 2026-07-02): un congreso es una serie de conferencias de
-- distintos doctores en un rango de fechas. Agrupa reuniones (clinical_sessions)
-- y lives sin importar quién las cree; cada creador queda registrado como
-- conferencista y el congreso aparece en los perfiles de todos los ponentes.
-- Idempotente: se puede re-correr sin efectos.

CREATE TABLE IF NOT EXISTS public.congresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  specialty text,
  banner_url text,
  starts_at date NOT NULL,
  ends_at date NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS public.congress_speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congress_id uuid NOT NULL REFERENCES public.congresses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_lead boolean NOT NULL DEFAULT false,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (congress_id, user_id)
);

ALTER TABLE public.clinical_sessions ADD COLUMN IF NOT EXISTS congress_id uuid REFERENCES public.congresses(id) ON DELETE SET NULL;
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS congress_id uuid REFERENCES public.congresses(id) ON DELETE SET NULL;
ALTER TABLE public.recordings ADD COLUMN IF NOT EXISTS congress_id uuid REFERENCES public.congresses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_sessions_congress ON public.clinical_sessions(congress_id) WHERE congress_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lives_congress ON public.lives(congress_id) WHERE congress_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recordings_congress ON public.recordings(congress_id) WHERE congress_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_congress_speakers_user ON public.congress_speakers(user_id);
CREATE INDEX IF NOT EXISTS idx_congress_speakers_congress ON public.congress_speakers(congress_id);

ALTER TABLE public.congresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_speakers ENABLE ROW LEVEL SECURITY;

-- Administra el congreso: organizador, conferencista líder o admin.
CREATE OR REPLACE FUNCTION public.can_manage_congress(_congress_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM congresses c WHERE c.id = _congress_id AND c.organizer_id = _user_id)
      OR EXISTS (SELECT 1 FROM congress_speakers s WHERE s.congress_id = _congress_id AND s.user_id = _user_id AND s.is_lead)
      OR has_role(_user_id, 'admin');
$$;

DROP POLICY IF EXISTS "Congresses are viewable by everyone" ON public.congresses;
CREATE POLICY "Congresses are viewable by everyone" ON public.congresses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Approved doctors can create congresses" ON public.congresses;
CREATE POLICY "Approved doctors can create congresses" ON public.congresses
  FOR INSERT WITH CHECK (
    organizer_id = auth.uid()
    AND (is_approved_doctor(auth.uid()) OR is_approved_resident(auth.uid()) OR has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS "Managers can update congresses" ON public.congresses;
CREATE POLICY "Managers can update congresses" ON public.congresses
  FOR UPDATE USING (can_manage_congress(id, auth.uid()))
  WITH CHECK (can_manage_congress(id, auth.uid()));

DROP POLICY IF EXISTS "Organizers can delete congresses" ON public.congresses;
CREATE POLICY "Organizers can delete congresses" ON public.congresses
  FOR DELETE USING (organizer_id = auth.uid() OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Congress speakers are viewable by everyone" ON public.congress_speakers;
CREATE POLICY "Congress speakers are viewable by everyone" ON public.congress_speakers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Managers can add speakers" ON public.congress_speakers;
CREATE POLICY "Managers can add speakers" ON public.congress_speakers
  FOR INSERT WITH CHECK (can_manage_congress(congress_id, auth.uid()));

DROP POLICY IF EXISTS "Managers can update speakers" ON public.congress_speakers;
CREATE POLICY "Managers can update speakers" ON public.congress_speakers
  FOR UPDATE USING (can_manage_congress(congress_id, auth.uid()));

DROP POLICY IF EXISTS "Managers can remove speakers" ON public.congress_speakers;
CREATE POLICY "Managers can remove speakers" ON public.congress_speakers
  FOR DELETE USING (can_manage_congress(congress_id, auth.uid()) OR user_id = auth.uid());

-- Quien crea una reunión o live dentro de un congreso queda registrado como
-- conferencista automáticamente ("se guarde en los perfiles de todos los que
-- dieron la conferencia"). SECURITY DEFINER: el organizador de la reunión no
-- necesita permiso de manager sobre el congreso.
CREATE OR REPLACE FUNCTION public.mm_congress_autoregister_speaker()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _speaker uuid;
BEGIN
  IF NEW.congress_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'clinical_sessions' THEN
    _speaker := NEW.organizer_id;
  ELSIF TG_TABLE_NAME = 'lives' THEN
    _speaker := NEW.doctor_id;
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO congress_speakers (congress_id, user_id, added_by)
  VALUES (NEW.congress_id, _speaker, _speaker)
  ON CONFLICT (congress_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mm_session_congress_speaker ON public.clinical_sessions;
CREATE TRIGGER mm_session_congress_speaker
  AFTER INSERT OR UPDATE OF congress_id ON public.clinical_sessions
  FOR EACH ROW EXECUTE FUNCTION public.mm_congress_autoregister_speaker();

DROP TRIGGER IF EXISTS mm_live_congress_speaker ON public.lives;
CREATE TRIGGER mm_live_congress_speaker
  AFTER INSERT OR UPDATE OF congress_id ON public.lives
  FOR EACH ROW EXECUTE FUNCTION public.mm_congress_autoregister_speaker();

-- Las grabaciones de un live que pertenecía a un congreso heredan el congreso
-- (así el archivo del congreso se arma solo al terminar cada conferencia).
CREATE OR REPLACE FUNCTION public.mm_recording_inherit_congress()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.congress_id IS NULL AND NEW.live_id IS NOT NULL THEN
    SELECT congress_id INTO NEW.congress_id FROM lives WHERE id = NEW.live_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mm_recording_congress ON public.recordings;
CREATE TRIGGER mm_recording_congress
  BEFORE INSERT ON public.recordings
  FOR EACH ROW EXECUTE FUNCTION public.mm_recording_inherit_congress();

DROP TRIGGER IF EXISTS update_congresses_updated_at ON public.congresses;
CREATE TRIGGER update_congresses_updated_at
  BEFORE UPDATE ON public.congresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
