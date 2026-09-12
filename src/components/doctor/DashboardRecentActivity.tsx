// Actividad reciente del Inicio del médico (11-sep-2026).
//
// Requisito 9 del encargo: el Inicio muestra «actividad reciente». Aquí NO se
// inventa nada: cada línea sale de una fila real de los últimos 7 días —
// consultas cerradas, citas creadas o cambiadas, suscripciones y recetas. Si no
// hay nada, se dice con un estado vacío honesto.
//
// Las `notifications` NO se usan como fuente: en producción hay 107 filas
// automáticas de prueba y pintarían actividad que nunca ocurrió.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, CalendarCheck, CalendarPlus, CalendarX, Pill, Rss, Stethoscope } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppDateFormat } from '@/lib/dateFormat';
import { doctorHref, doctorPatientHref } from '@/lib/doctorSections';
import { fill } from '@/lib/proFormat';

/** Días hacia atrás que se consideran «reciente». */
const WINDOW_DAYS = 7;
/** Máximo de líneas que se pintan. */
const MAX_ITEMS = 8;

interface ActivityItem {
  id: string;
  at: Date;
  icon: LucideIcon;
  text: string;
  href: string;
}

interface Props {
  /** Nombre del paciente ya conocido por el Inicio (evita volver a leer perfiles) */
  nameById: (id: string) => string | null;
}

export function DashboardRecentActivity({ nameById }: Props) {
  const { supabaseUser, role } = useAuth();
  const { t } = useLanguage();
  const fmt = useAppDateFormat();
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  const doctorId = supabaseUser?.id;

  useEffect(() => {
    if (!doctorId || role !== 'doctor') { setItems([]); return; }
    let active = true;
    (async () => {
      const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const [consRes, apptRes, subsRes, presRes] = await Promise.all([
        supabase
          .from('consultations')
          .select('id, patient_id, completed_at, ended_at')
          .eq('doctor_id', doctorId)
          .or(`completed_at.gte.${since},ended_at.gte.${since}`)
          .limit(MAX_ITEMS * 2),
        supabase
          .from('appointments')
          .select('id, patient_id, status, created_at, updated_at')
          .eq('doctor_id', doctorId)
          .gte('updated_at', since)
          .order('updated_at', { ascending: false })
          .limit(MAX_ITEMS * 2),
        supabase
          .from('subscriptions')
          .select('id, subscriber_id, created_at')
          .eq('creator_id', doctorId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(MAX_ITEMS),
        supabase
          .from('prescriptions')
          .select('id, patient_id, patient_name, created_at')
          .eq('doctor_id', doctorId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(MAX_ITEMS),
      ]);
      if (!active) return;

      const someone = t('mm2.dashboard.activity.someone');
      const who = (id?: string | null, fallback?: string | null) =>
        (id ? nameById(id) : null) || fallback || someone;
      const list: ActivityItem[] = [];

      // Consultas cerradas (chat o vídeo): la fecha real es completed_at o ended_at
      ((consRes.data as any[]) || []).forEach(c => {
        const iso = c.completed_at || c.ended_at;
        if (!iso) return;
        list.push({
          id: `cons-${c.id}`,
          at: new Date(iso),
          icon: Stethoscope,
          text: fill(t('mm2.dashboard.activity.consultationClosed'), { name: who(c.patient_id) }),
          href: c.patient_id ? doctorPatientHref(c.patient_id, 'consultas') : doctorHref('agenda', { tab: 'consultas' }),
        });
      });

      // Citas: created_at = updated_at significa que se acaba de crear
      ((apptRes.data as any[]) || []).forEach(a => {
        const created = a.created_at && a.updated_at && a.created_at === a.updated_at;
        let icon: LucideIcon = CalendarPlus;
        let key = 'mm2.dashboard.activity.appointmentCreated';
        if (!created) {
          if (a.status === 'cancelled') { icon = CalendarX; key = 'mm2.dashboard.activity.appointmentCancelled'; }
          else if (a.status === 'confirmed') { icon = CalendarCheck; key = 'mm2.dashboard.activity.appointmentConfirmed'; }
          else if (a.status === 'completed') { icon = CalendarCheck; key = 'mm2.dashboard.activity.appointmentCompleted'; }
          else { icon = CalendarPlus; key = 'mm2.dashboard.activity.appointmentUpdated'; }
        }
        list.push({
          id: `appt-${a.id}`,
          at: new Date(a.updated_at || a.created_at),
          icon,
          text: fill(t(key), { name: who(a.patient_id) }),
          href: doctorHref('agenda', { tab: 'consultas' }),
        });
      });

      // Suscripciones nuevas al perfil del médico
      ((subsRes.data as any[]) || []).forEach(s => {
        list.push({
          id: `sub-${s.id}`,
          at: new Date(s.created_at),
          icon: Rss,
          text: fill(t('mm2.dashboard.activity.subscription'), { name: who(s.subscriber_id) }),
          href: doctorHref('cuenta', { tab: 'finanzas', f: 'suscriptores' }),
        });
      });

      // Recetas emitidas (la receta guarda el nombre del paciente en la propia fila)
      ((presRes.data as any[]) || []).forEach(p => {
        list.push({
          id: `pres-${p.id}`,
          at: new Date(p.created_at),
          icon: Pill,
          text: fill(t('mm2.dashboard.activity.prescription'), { name: who(p.patient_id, p.patient_name) }),
          href: p.patient_id ? doctorPatientHref(p.patient_id, 'recetas') : doctorHref('pacientes'),
        });
      });

      list.sort((a, b) => b.at.getTime() - a.at.getTime());
      setItems(list.slice(0, MAX_ITEMS));
    })().catch(e => {
      console.error('DashboardRecentActivity:', e);
      if (active) setItems([]);
    });
    return () => { active = false; };
    // `nameById` cambia con la lista de pacientes; basta con recargar por médico.
  }, [doctorId, role, t, nameById]);

  const loading = items === null;
  const rows = useMemo(() => items || [], [items]);

  return (
    <section className="pro-card pro-card-pad bg-card min-w-0">
      <div className="pro-card-head">
        <h2 className="pro-card-title"><Activity /> <span className="truncate">{t('mm2.dashboard.activity.title')}</span></h2>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-9 rounded-xl bg-[#eef3f6] animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="pro-muted text-sm py-3">{t('mm2.dashboard.activity.empty')}</p>
      ) : (
        <div>
          {rows.map(item => (
            <Link key={item.id} to={item.href} className="pro-todo">
              <item.icon />
              <span className="min-w-0 flex-1 truncate">{item.text}</span>
              <span className="pro-row-sub flex-shrink-0">{fmt.formatDate(item.at, 'd MMM')}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default DashboardRecentActivity;
