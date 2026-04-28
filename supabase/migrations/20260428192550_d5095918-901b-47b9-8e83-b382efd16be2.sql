CREATE OR REPLACE FUNCTION public.search_patients_for_doctor(p_term text, p_limit integer DEFAULT 10)
RETURNS TABLE(
  user_id uuid,
  name text,
  email text,
  avatar_url text,
  country_code text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    p.id as user_id,
    p.name,
    p.email,
    p.avatar_url,
    p.country_code
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'patient'
  WHERE
    public.is_approved_doctor(auth.uid())
    AND (
      p.name ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      OR p.email ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
    )
  ORDER BY
    CASE WHEN p.name ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\' THEN 0 ELSE 1 END,
    p.name
  LIMIT LEAST(GREATEST(p_limit, 1), 20);
$function$;

REVOKE EXECUTE ON FUNCTION public.search_patients_for_doctor(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_patients_for_doctor(text, integer) TO authenticated;