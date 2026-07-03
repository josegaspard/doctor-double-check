-- Privacidad (2026-07-03): resident_groups y resident_group_members tenían SELECT
-- USING(true) para el rol public → un usuario ANÓNIMO podía leer qué residentes
-- pertenecen a qué grupos. Se restringe la lectura a usuarios autenticados.

DROP POLICY IF EXISTS "Everyone can view groups" ON public.resident_groups;
CREATE POLICY "Authenticated can view groups"
  ON public.resident_groups FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Everyone can view group members" ON public.resident_group_members;
CREATE POLICY "Authenticated can view group members"
  ON public.resident_group_members FOR SELECT TO authenticated
  USING (true);
