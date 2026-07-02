import { supabase } from '@/integrations/supabase/client';

// Congresos (cliente 2026-07-02): tipos y helpers compartidos entre el listado,
// el detalle, el diálogo de reuniones y el perfil del doctor.
// GOTCHA repo: congresses/congress_speakers no están en types.ts generado → casts as any.

export interface Congress {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  specialty: string | null;
  banner_url: string | null;
  starts_at: string; // date YYYY-MM-DD
  ends_at: string;
  status: 'published' | 'archived';
  created_at: string;
}

export interface CongressSpeaker {
  id: string;
  congress_id: string;
  user_id: string;
  is_lead: boolean;
  name?: string;
  avatar_url?: string | null;
  specialty?: string;
}

export type CongressPhase = 'active' | 'upcoming' | 'archived';

// Fase del congreso según fechas + status manual. Las fechas son date (sin hora):
// el congreso está "en curso" durante todo su último día.
export function congressPhase(c: Pick<Congress, 'starts_at' | 'ends_at' | 'status'>): CongressPhase {
  if (c.status === 'archived') return 'archived';
  const today = localDateStr(new Date());
  if (c.ends_at < today) return 'archived';
  if (c.starts_at > today) return 'upcoming';
  return 'active';
}

// YYYY-MM-DD en hora LOCAL (toISOString desplazaría el día en zonas UTC-).
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Congresos abiertos (publicados y sin terminar) para los selectores de
// "agregar esta reunión/live a un congreso".
export async function fetchOpenCongresses(): Promise<Congress[]> {
  const today = localDateStr(new Date());
  const { data } = await (supabase as any)
    .from('congresses')
    .select('id, organizer_id, title, description, specialty, banner_url, starts_at, ends_at, status, created_at')
    .eq('status', 'published')
    .gte('ends_at', today)
    .order('starts_at', { ascending: true })
    .limit(50);
  return (data as Congress[]) || [];
}

// Adjunta name/avatar de profiles a las filas de congress_speakers.
export async function hydrateSpeakers(rows: CongressSpeaker[]): Promise<CongressSpeaker[]> {
  const ids = Array.from(new Set(rows.map(r => r.user_id)));
  if (ids.length === 0) return rows;
  const [{ data: profiles }, { data: docProfiles }] = await Promise.all([
    supabase.from('profiles').select('id, name, avatar_url').in('id', ids),
    supabase.from('doctor_profiles').select('user_id, specialty').in('user_id', ids),
  ]);
  const nameMap: Record<string, { name: string; avatar_url: string | null }> = {};
  (profiles || []).forEach((p: any) => { nameMap[p.id] = { name: p.name, avatar_url: p.avatar_url }; });
  const specMap: Record<string, string> = {};
  (docProfiles || []).forEach((d: any) => { specMap[d.user_id] = d.specialty; });
  return rows.map(r => ({
    ...r,
    name: nameMap[r.user_id]?.name || r.name,
    avatar_url: nameMap[r.user_id]?.avatar_url ?? r.avatar_url,
    specialty: specMap[r.user_id] || r.specialty,
  }));
}
