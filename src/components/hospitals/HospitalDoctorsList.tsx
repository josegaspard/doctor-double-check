import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Star, Stethoscope, ChevronRight } from 'lucide-react';

interface HospitalDoctorsListProps {
  hospitalId: string;
  hospitalName: string;
  specialties: string[];
  zone?: string | null;
  language: string;
}

interface DoctorRow {
  id: string;
  user_id: string;
  specialty: string;
  rating: number;
  total_consultations: number;
  location: string | null;
  name: string | null;
  avatar_url: string | null;
}

/**
 * Lists doctors related to a hospital by overlapping specialty.
 * Falls back to top-rated approved doctors if no specialty match.
 */
export default function HospitalDoctorsList({
  hospitalId,
  hospitalName,
  specialties,
  zone,
  language,
}: HospitalDoctorsListProps) {
  const navigate = useNavigate();
  const es = language === 'es';
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('doctor_profiles')
          .select('id, user_id, specialty, rating, total_consultations, location')
          .eq('status', 'approved')
          .order('rating', { ascending: false })
          .limit(6);

        if (specialties && specialties.length > 0) {
          query = query.in('specialty', specialties as any);
        }

        const { data: docs, error } = await query;
        if (error) throw error;
        if (cancelled) return;

        const userIds = (docs || []).map((d) => d.user_id);
        let profilesMap: Record<string, { name: string | null; avatar_url: string | null }> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .in('id', userIds);
          (profs || []).forEach((p) => {
            profilesMap[p.id] = { name: p.name, avatar_url: p.avatar_url };
          });
        }

        const merged: DoctorRow[] = (docs || []).map((d) => ({
          id: d.id,
          user_id: d.user_id,
          specialty: d.specialty,
          rating: Number(d.rating) || 0,
          total_consultations: d.total_consultations || 0,
          location: d.location,
          name: profilesMap[d.user_id]?.name || null,
          avatar_url: profilesMap[d.user_id]?.avatar_url || null,
        }));

        if (!cancelled) setDoctors(merged);
      } catch (e) {
        console.warn('[HospitalDoctorsList] error', e);
        if (!cancelled) setDoctors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [hospitalId, JSON.stringify(specialties)]);

  if (loading) {
    return (
      <div className="mt-4 p-4 rounded-lg bg-muted/40 border border-border">
        <p className="text-sm text-muted-foreground">{es ? 'Cargando médicos...' : 'Loading doctors...'}</p>
      </div>
    );
  }

  if (doctors.length === 0) {
    return (
      <div className="mt-4 p-4 rounded-lg bg-muted/40 border border-border">
        <p className="text-sm text-muted-foreground">
          {es ? 'No hay médicos relacionados disponibles por el momento.' : 'No related doctors available right now.'}
        </p>
        <Button
          variant="link"
          size="sm"
          className="px-0 mt-1"
          onClick={() => navigate('/doctors')}
        >
          {es ? 'Ver directorio completo' : 'See full directory'} <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-primary" />
          {es ? 'Médicos relacionados' : 'Related doctors'}
          <span className="text-xs font-normal text-muted-foreground">({doctors.length})</span>
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7"
          onClick={() => {
            const sp = specialties?.[0];
            navigate(sp ? `/doctors?specialty=${encodeURIComponent(sp)}` : '/doctors');
          }}
        >
          {es ? 'Ver todos' : 'See all'} <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {doctors.map((d) => (
          <button
            key={d.id}
            onClick={() => navigate(`/doctors/${d.user_id}`)}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border hover:border-primary/50 hover:bg-muted/40 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {d.avatar_url ? (
                <img src={d.avatar_url} alt={d.name || 'Doctor'} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <Stethoscope className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {d.name ? (es ? `Dr. ${d.name}` : `Dr. ${d.name}`) : (es ? 'Médico verificado' : 'Verified doctor')}
              </p>
              <p className="text-xs text-muted-foreground truncate">{d.specialty}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                <span className="text-[11px] text-muted-foreground">
                  {d.rating > 0 ? d.rating.toFixed(1) : '—'} · {d.total_consultations} {es ? 'consultas' : 'consults'}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
