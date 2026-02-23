
-- Create a bulk version of get_chat_session_details that accepts multiple session IDs
-- This eliminates the N+1 query pattern in ChatContext
CREATE OR REPLACE FUNCTION public.get_chat_sessions_details_bulk(p_session_ids uuid[])
RETURNS TABLE(
  session_id uuid,
  participant1_id uuid,
  participant1_name text,
  participant1_type chat_participant_type,
  participant1_specialty text,
  participant1_avatar text,
  participant2_id uuid,
  participant2_name text,
  participant2_type chat_participant_type,
  participant2_specialty text,
  participant2_avatar text,
  doctor_office_hours_start time without time zone,
  doctor_office_hours_end time without time zone,
  doctor_office_days text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    cs.id as session_id,
    cs.participant1_id,
    p1.name as participant1_name,
    cs.participant1_type,
    COALESCE(dp1.specialty, rp1.specialty) as participant1_specialty,
    p1.avatar_url as participant1_avatar,
    cs.participant2_id,
    p2.name as participant2_name,
    cs.participant2_type,
    COALESCE(dp2.specialty, rp2.specialty) as participant2_specialty,
    p2.avatar_url as participant2_avatar,
    COALESCE(dp1.office_hours_start, dp2.office_hours_start) as doctor_office_hours_start,
    COALESCE(dp1.office_hours_end, dp2.office_hours_end) as doctor_office_hours_end,
    COALESCE(dp1.office_days, dp2.office_days) as doctor_office_days
  FROM public.chat_sessions cs
  LEFT JOIN public.profiles p1 ON p1.id = cs.participant1_id
  LEFT JOIN public.profiles p2 ON p2.id = cs.participant2_id
  LEFT JOIN public.doctor_profiles dp1 ON dp1.user_id = cs.participant1_id
  LEFT JOIN public.doctor_profiles dp2 ON dp2.user_id = cs.participant2_id
  LEFT JOIN public.resident_profiles rp1 ON rp1.user_id = cs.participant1_id
  LEFT JOIN public.resident_profiles rp2 ON rp2.user_id = cs.participant2_id
  WHERE cs.id = ANY(p_session_ids)
    AND (cs.participant1_id = auth.uid() OR cs.participant2_id = auth.uid());
$$;
