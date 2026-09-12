import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChatSession } from '@/contexts/ChatContext';
import {
  User, CalendarDays, Lock, Folder, Stethoscope, ChevronRight, Clock, Video, Loader2,
} from 'lucide-react';
import { initialsOf, fmtDate, fmtTime, whenLabel } from '@/lib/proFormat';
import { NewConsultationDialog } from '@/components/doctor/NewConsultationDialog';

interface Props {
  session: ChatSession;
  /** datos ya calculados por la página (evita repetir consultas) */
  other: { name: string; specialty?: string; avatar?: string; type: string; userId: string };
  officeHours: string | null;
  isAvailable: boolean;
}

interface Ctx {
  consultationsCount: number;
  lastConsultationAt: string | null;
  nextAppointmentAt: string | null;
  nextAppointmentId: string | null;
  nextAppointmentRoom: string | null;
  nextAppointmentStatus: string | null;
  sharedDocuments: number;
}

/**
 * Contexto clínico de la conversación — diseño PRO, 2.ª tanda (8-sep-2026).
 *
 * Todo sale de la base con las tablas que ya existen: `consultations`,
 * `appointments` y `vault_access`. Lo que la plataforma no guarda (edad, sexo)
 * no se enseña: en su lugar va el identificador real del paciente y lo que sí
 * está registrado.
 */
export function ChatClinicalContext({ session, other, officeHours, isAvailable }: Props) {
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  /** Diálogo «Nueva consulta» con el paciente de esta conversación */
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const otherIsPatient = other.type === 'patient';
  const doctorId = role === 'doctor' ? user?.id : other.userId;
  const patientId = role === 'doctor' ? other.userId : user?.id;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!doctorId || !patientId) { setLoading(false); return; }
      setLoading(true);
      try {
        const nowIso = new Date().toISOString();
        const [consRes, apptRes, vaultRes] = await Promise.all([
          supabase
            .from('consultations')
            .select('id, started_at, completed_at, ended_at')
            .eq('doctor_id', doctorId)
            .eq('patient_id', patientId)
            .order('started_at', { ascending: false }),
          supabase
            .from('appointments')
            .select('id, scheduled_at, status, daily_room_url')
            .eq('doctor_id', doctorId)
            .eq('patient_id', patientId)
            .gte('scheduled_at', nowIso)
            .in('status', ['requested', 'confirmed'])
            .order('scheduled_at', { ascending: true })
            .limit(1),
          // `vault_access` guarda el fichero, no el paciente: hay que resolver el
          // dueño en `vault_files`. Contar sus filas a secas daba el total del
          // médico y pintaba «Acceso confirmado» en pacientes que no compartieron
          // nada — el mismo número en todas sus conversaciones.
          role === 'doctor'
            ? supabase.from('vault_access').select('file_id').eq('doctor_id', doctorId)
            : Promise.resolve({ data: [] as any[] } as any),
        ]);
        if (cancelled) return;

        // Cuántos de esos ficheros son de ESTE paciente
        let sharedCount = 0;
        const fileIds = [...new Set((((vaultRes.data as any[]) || []).map(v => v.file_id)).filter(Boolean))];
        if (role === 'doctor' && fileIds.length) {
          const { data: files } = await supabase
            .from('vault_files')
            .select('id, patient_id')
            .in('id', fileIds)
            .eq('patient_id', patientId);
          sharedCount = ((files as any[]) || []).length;
        }
        if (cancelled) return;

        const cons = (consRes.data as any[]) || [];
        const next = ((apptRes.data as any[]) || [])[0] || null;
        setCtx({
          consultationsCount: cons.length,
          lastConsultationAt: cons[0]?.completed_at || cons[0]?.ended_at || cons[0]?.started_at || null,
          nextAppointmentAt: next?.scheduled_at || null,
          nextAppointmentId: next?.id || null,
          nextAppointmentRoom: next?.daily_room_url || null,
          nextAppointmentStatus: next?.status || null,
          sharedDocuments: sharedCount,
        });
      } catch (e) {
        console.error('ChatClinicalContext:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [doctorId, patientId, role, session.id]);

  const tagLabel = other.type === 'patient' ? t('pro.chatPro.tagPatient')
    : other.type === 'resident' ? t('pro.chatPro.tagDoctor')
    : t('pro.chatPro.tagDoctor');

  return (
    <div className="pro-scroll" style={{ padding: '2px 2px 8px' }}>
      {/* Persona */}
      <div className="pro-ctx-block">
        <div className="pro-ctx-h"><User /> {otherIsPatient ? t('pro.chatPro.ctxPatient') : t('pro.chatPro.ctxContact')}</div>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="pro-initials" style={{ width: 40, height: 40, fontSize: 13 }}>
            {other.avatar ? <img src={other.avatar} alt="" /> : initialsOf(other.name)}
          </span>
          <div className="min-w-0">
            <div className="pro-row-name truncate">{other.name}</div>
            <div className="pro-row-sub truncate">
              {other.specialty || tagLabel}
            </div>
          </div>
        </div>
        <div className="pro-ctx-line mt-2">
          <span className="k">ID</span>
          <span className="v">MM-{other.userId.slice(0, 6).toUpperCase()}</span>
        </div>
        {role === 'doctor' && otherIsPatient ? (
          <Link to={`/doctor/vault?patient=${other.userId}`} className="pro-btn pro-btn-outline pro-btn-sm w-full mt-2">
            <Folder /> {t('pro.chatPro.ctxViewRecord')}
          </Link>
        ) : (
          <Link to={`/doctor/${other.userId}`} className="pro-btn pro-btn-outline pro-btn-sm w-full mt-2">
            <Stethoscope /> {t('pro.chatPro.ctxProfile')}
          </Link>
        )}
      </div>

      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--pro-teal)' }} /></div>
      ) : ctx && (
        <>
          {/* Consultas */}
          <div className="pro-ctx-block">
            <div className="pro-ctx-h"><Stethoscope /> {t('pro.chatPro.ctxConsultations')}</div>
            {ctx.consultationsCount > 0 ? (
              <>
                <div className="pro-ctx-line"><span className="k">{t('pro.chatPro.ctxConsultations')}</span><span className="v">{ctx.consultationsCount}</span></div>
                {ctx.lastConsultationAt && (
                  <div className="pro-ctx-line">
                    <span className="k">{t('pro.chatPro.ctxLastConsultation')}</span>
                    <span className="v">{fmtDate(new Date(ctx.lastConsultationAt), language)}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[12.5px] pro-muted">{t('pro.chatPro.ctxNoConsultations')}</p>
            )}
            {role === 'doctor' && (
              <Link to="/doctor/consultations" className="pro-link mt-1">{t('pro.consults.title')} <ChevronRight /></Link>
            )}
          </div>

          {/* Documentos compartidos — sólo tiene sentido para el médico */}
          {role === 'doctor' && (
            <div className="pro-ctx-block">
              <div className="pro-ctx-h"><Lock /> {t('pro.chatPro.ctxAccess')}</div>
              <p className="text-[12.5px] pro-muted">{t('pro.chatPro.ctxAccessText')}</p>
              <div className="mt-1.5">
                <span className={`pro-pill ${ctx.sharedDocuments > 0 ? 'pro-pill-ok' : 'pro-pill-muted'}`}>
                  {ctx.sharedDocuments > 0 ? t('pro.chatPro.ctxAccessOn') : t('pro.chatPro.ctxAccessOff')}
                </span>
              </div>
              {ctx.sharedDocuments > 0 && (
                <Link to={`/doctor/vault?patient=${other.userId}`} className="pro-link mt-1.5">
                  <Folder /> {t('pro.chatPro.ctxDocuments')} ({ctx.sharedDocuments})
                </Link>
              )}
            </div>
          )}

          {/* Próxima cita */}
          <div className="pro-ctx-block">
            <div className="pro-ctx-h"><CalendarDays /> {t('pro.chatPro.ctxNext')}</div>
            {ctx.nextAppointmentAt ? (
              <>
                <div className="pro-row-name">{whenLabel(new Date(ctx.nextAppointmentAt), language, t)}</div>
                <div className="pro-row-sub">
                  {ctx.nextAppointmentStatus === 'confirmed' ? t('pro.consults.statusConfirmed') : t('pro.consults.statusRequested')}
                </div>
                {ctx.nextAppointmentRoom ? (
                  <a href={ctx.nextAppointmentRoom} target="_blank" rel="noreferrer" className="pro-btn pro-btn-teal pro-btn-sm w-full mt-2">
                    <Video /> {t('pro.chatPro.ctxOpenRoom')}
                  </a>
                ) : (
                  <p className="text-[11.5px] pro-muted mt-1">{t('pro.chatPro.ctxNoRoom')}</p>
                )}
                <Link to={role === 'doctor' ? '/doctor/consultations' : '/my-appointments'} className="pro-btn pro-btn-outline pro-btn-sm w-full mt-2">
                  {t('pro.chatPro.ctxManage')}
                </Link>
              </>
            ) : (
              <>
                <p className="text-[12.5px] pro-muted">{t('pro.chatPro.ctxNoNext')}</p>
                {/* «Nueva consulta» abre el flujo propio con el paciente del chat ya
                    elegido. Antes llevaba a /doctor/availability?nueva=consulta, que
                    es el editor del horario semanal: no agendaba nada. */}
                {role === 'doctor' ? (
                  otherIsPatient && (
                    <button
                      type="button"
                      className="pro-btn pro-btn-outline pro-btn-sm w-full mt-2"
                      onClick={() => setScheduleOpen(true)}
                    >
                      <CalendarDays /> {t('pro.chatPro.ctxSchedule')}
                    </button>
                  )
                ) : (
                  <Link to={`/book/${other.userId}`} className="pro-btn pro-btn-outline pro-btn-sm w-full mt-2">
                    <CalendarDays /> {t('pro.chatPro.ctxSchedule')}
                  </Link>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Horario de atención del médico (dato que ya traía el chat) */}
      {officeHours && (
        <div className="pro-ctx-block">
          <div className="pro-ctx-h"><Clock /> {t('pro.chatPro.ctxHours')}</div>
          <div className="pro-ctx-line"><span className="k">{officeHours}</span></div>
          <div className="mt-1">
            <span className={`pro-pill ${isAvailable ? 'pro-pill-ok' : 'pro-pill-muted'}`}>
              {isAvailable ? t('pro.chatPro.ctxAvailable') : t('pro.chatPro.ctxOutside')}
            </span>
          </div>
        </div>
      )}

      {role === 'doctor' && otherIsPatient && (
        <NewConsultationDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          defaultPatientId={other.userId}
        />
      )}
    </div>
  );
}
