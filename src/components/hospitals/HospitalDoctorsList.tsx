import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star, Stethoscope, ChevronRight, MessageCircle, MapPin, Clock, Loader2 } from 'lucide-react';

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
  office_hours_start: string | null;
  office_hours_end: string | null;
  office_days: string[] | null;
  name: string | null;
  avatar_url: string | null;
}

function isAvailableNow(d: DoctorRow) {
  if (!d.office_days || !d.office_hours_start || !d.office_hours_end) return false;
  const now = new Date();
  const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return d.office_days.includes(day) && time >= d.office_hours_start && time <= d.office_hours_end;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Lista completa de doctores relacionados a un hospital.
 * Une por especialidad; si no hay match, trae top-rated aprobados como fallback.
 */
export default function HospitalDoctorsList({
  hospitalId,
  specialties,
  language,
}: HospitalDoctorsListProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let docs: any[] = [];
        let fallback = false;

        // 1) Explicit assignments via hospital_doctors pivot (admin-managed)
        const { data: pivot } = await supabase
          .from('hospital_doctors')
          .select('doctor_id, is_primary, sort_order')
          .eq('hospital_id', hospitalId)
          .order('is_primary', { ascending: false })
          .order('sort_order', { ascending: true });

        const pivotIds = ((pivot as any[]) || []).map((p) => p.doctor_id);
        if (pivotIds.length > 0) {
          const { data } = await supabase
            .from('doctor_profiles')
            .select('id, user_id, specialty, rating, total_consultations, location, office_hours_start, office_hours_end, office_days')
            .eq('status', 'approved')
            .in('id', pivotIds);
          const orderIndex: Record<string, number> = {};
          pivotIds.forEach((id, i) => { orderIndex[id] = i; });
          docs = ((data as any[]) || []).slice().sort((a, b) => (orderIndex[a.id] ?? 999) - (orderIndex[b.id] ?? 999));
        }

        if (docs.length === 0 && specialties && specialties.length > 0) {
          const { data } = await supabase
            .from('doctor_profiles')
            .select('id, user_id, specialty, rating, total_consultations, location, office_hours_start, office_hours_end, office_days')
            .eq('status', 'approved')
            .in('specialty', specialties as any)
            .order('rating', { ascending: false })
            .limit(8);
          docs = data || [];
        }

        if (docs.length === 0) {
          const { data } = await supabase
            .from('doctor_profiles')
            .select('id, user_id, specialty, rating, total_consultations, location, office_hours_start, office_hours_end, office_days')
            .eq('status', 'approved')
            .order('rating', { ascending: false })
            .limit(6);
          docs = data || [];
          fallback = docs.length > 0;
        }

        const userIds = docs.map((d) => d.user_id);
        const profilesMap: Record<string, { name: string | null; avatar_url: string | null }> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .in('id', userIds);
          (profs || []).forEach((p) => {
            profilesMap[p.id] = { name: p.name, avatar_url: p.avatar_url };
          });
        }

        const merged: DoctorRow[] = docs.map((d) => ({
          id: d.id,
          user_id: d.user_id,
          specialty: d.specialty,
          rating: Number(d.rating) || 0,
          total_consultations: d.total_consultations || 0,
          location: d.location,
          office_hours_start: d.office_hours_start,
          office_hours_end: d.office_hours_end,
          office_days: d.office_days,
          name: profilesMap[d.user_id]?.name || null,
          avatar_url: profilesMap[d.user_id]?.avatar_url || null,
        }));

        if (!cancelled) {
          setDoctors(merged);
          setUsedFallback(fallback);
        }
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
      <div className="mt-4 p-4 rounded-lg bg-muted/40 border border-border flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('autoI18n.clHospDoctors1')}</p>
      </div>
    );
  }

  if (doctors.length === 0) {
    return (
      <div className="mt-4 p-4 rounded-lg bg-muted/40 border border-border">
        <p className="text-sm text-muted-foreground">
          {t('autoI18n.clHospDoctors2')}
        </p>
        <Button
          variant="link"
          size="sm"
          className="px-0 mt-1"
          onClick={() => navigate('/doctors')}
        >
          {t('autoI18n.clHospDoctors3')} <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-primary" />
          {t('autoI18n.clHospDoctors4')}
          <Badge variant="secondary" className="text-[10px] h-5">{doctors.length}</Badge>
          {usedFallback && (
            <span className="text-[10px] font-normal text-muted-foreground">
              {t('autoI18n.clHospDoctors5')}
            </span>
          )}
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
          {t('autoI18n.clHospDoctors6')} <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>
      </div>

      <div className="-mx-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
        <div className="flex gap-2.5 px-1 pb-1">
          {doctors.map((d) => {
            const available = isAvailableNow(d);
            return (
              <button
                key={d.id}
                onClick={() => navigate(`/doctor/${d.user_id}`)}
                className="snap-start flex-shrink-0 w-[260px] text-left p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-12 h-12 border border-border">
                      <AvatarImage src={d.avatar_url || undefined} alt={d.name || 'Doctor'} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                        {getInitials(d.name || 'Dr')}
                      </AvatarFallback>
                    </Avatar>
                    {available && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-success border-2 border-card" aria-label={t('autoI18n.clHospDoctors7')} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground min-w-0">
                      <span className="inline-flex items-center gap-1 min-w-0 max-w-full align-bottom">
                        <span className="truncate">{d.name ? `Dr. ${d.name}` : t('autoI18n.clHospDoctors8')}</span>
                        <DoctorBadgeIcon userId={d.user_id} size="sm" className="flex-shrink-0" />
                      </span>
                    </p>
                    <p className="text-xs text-primary/80 font-medium truncate">{d.specialty}</p>
                    <div className="mt-1 flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-warning text-warning" />
                        <span className="font-medium text-foreground">{d.rating > 0 ? d.rating.toFixed(1) : '—'}</span>
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <MessageCircle className="w-3 h-3" />
                        {d.total_consultations}
                      </span>
                      {available ? (
                        <span className="inline-flex items-center gap-0.5 text-success font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                          {t('autoI18n.clHospDoctors9')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {t('autoI18n.clHospDoctors10')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground text-center">{t('autoI18n.clHospDoctors11')}</p>
    </div>
  );
}
