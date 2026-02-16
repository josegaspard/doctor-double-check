-- Fix profiles_public view: disable security_invoker so it acts as a public gateway
-- This is safe because the view only exposes non-sensitive fields (id, name, avatar_url, is_identity_verified, created_at, updated_at)
ALTER VIEW public.profiles_public SET (security_invoker = false);