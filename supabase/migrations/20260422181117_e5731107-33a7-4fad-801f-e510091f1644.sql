CREATE OR REPLACE FUNCTION public.get_doctor_accessible_files(p_doctor_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  id uuid,
  patient_id uuid,
  name text,
  file_type vault_file_type,
  file_url text,
  file_size integer,
  category text,
  description text,
  created_at timestamp with time zone,
  granted_at timestamp with time zone,
  expires_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    vf.id,
    vf.patient_id,
    vf.name,
    vf.file_type,
    vf.file_url,
    vf.file_size,
    vf.category,
    vf.description,
    vf.created_at,
    va.granted_at,
    va.expires_at
  FROM public.vault_files vf
  INNER JOIN public.vault_access va
    ON va.file_id = vf.id
   AND va.doctor_id = p_doctor_id
   AND (va.expires_at IS NULL OR va.expires_at > now())
  WHERE p_doctor_id = auth.uid()
  ORDER BY vf.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_accessible_files(uuid) TO authenticated;