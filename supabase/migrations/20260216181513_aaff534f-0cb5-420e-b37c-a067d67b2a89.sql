-- Function to increment storage used
CREATE OR REPLACE FUNCTION public.increment_storage_used(p_user_id uuid, p_bytes bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET storage_used_bytes = storage_used_bytes + p_bytes
  WHERE id = p_user_id;
END;
$$;

-- Function to decrement storage used
CREATE OR REPLACE FUNCTION public.decrement_storage_used(p_user_id uuid, p_bytes bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET storage_used_bytes = GREATEST(0, storage_used_bytes - p_bytes)
  WHERE id = p_user_id;
END;
$$;