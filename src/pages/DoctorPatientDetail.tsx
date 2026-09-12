// Ficha del paciente para el médico (/doctor/patients/:patientId), 11-sep-2026.
//
// Encargo: «Ver ficha» no abría ningún paciente y los accesos Agenda, Consultas y
// Documentos de cada tarjeta llevaban a listados generales. Aquí todo es de ESE
// paciente: Resumen · Historial · Consultas · Documentos · Recetas · Agenda.
//
// Datos reales y con las RLS actuales:
//   · consultas, citas, recetas y notas propias del médico con ese paciente;
//   · historial clínico y vacunas solo si la base lo deja leer (expediente
//     compartido / consulta) — si no, se dice, no se inventa;
//   · documentos compartidos con su código de verificación y marca de agua.
// La cabecera usa doctor_get_patient_overview cuando la migración está aplicada.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, CalendarDays, ClipboardList, FileText, FolderOpen, History, LayoutGrid, Loader2,
  MessageSquare, Pill, Plus, ShieldCheck, Stethoscope, UserX,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVault } from '@/contexts/VaultContext';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { useDoctorPatients } from '@/hooks/useDoctorPatients';
import { usePatientOverview } from '@/hooks/usePatientOverview';
import { SectionTabs, useSectionParam } from '@/components/common/SectionTabs';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { NewConsultationDialog } from '@/components/doctor/NewConsultationDialog';
import { PatientDocumentsPanel } from '@/components/doctor/patient/PatientDocumentsPanel';
import { useAppDateFormat } from '@/lib/dateFormat';
import { fill, initialsOf } from '@/lib/proFormat';

const TABS = ['resumen', 'historial', 'consultas', 'documentos', 'recetas', 'agenda'] as const;
type Tab = (typeof TABS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sb = supabase as any;

interface RecordData {
  appointments: any[];
  consultations: any[];
  prescriptions: any[];
  notes: any[];
  clinical: any | null;
  vaccinations: any[];
  chatSessionId: string | null;
}

const EMPTY: RecordData = { appointments: [], consultations: [], prescriptions: [], notes: [], clinical: null, vaccinations: [], chatSessionId: null };

/** Todo lo que el médico puede leer de este paciente, en paralelo y sin inventar nada. */
function usePatientRecord(doctorId: string | undefined, patientId: string) {
  const [data, setData] = useState<RecordData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!doctorId || !UUID_RE.test(patientId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const pair = `and(participant1_id.eq.${doctorId},participant2_id.eq.${patientId}),and(participant1_id.eq.${patientId},participant2_id.eq.${doctorId})`;
    const [appts, consults, rx, notes, clinical, vacc, chat] = await Promise.all([
      sb.from('appointments').select('id, scheduled_at, duration_minutes, status, reason, notes, created_at').eq('doctor_id', doctorId).eq('patient_id', patientId).order('scheduled_at', { ascending: false }),
      sb.from('consultations').select('id, status, started_at, ended_at, completed_at, diagnosis, doctor_summary, doctor_recommendations, notes, chat_session_id').eq('doctor_id', doctorId).eq('patient_id', patientId).order('started_at', { ascending: false }),
      sb.from('prescriptions').select('id, created_at, diagnosis, medications, signed_at').eq('doctor_id', doctorId).eq('patient_id', patientId).order('created_at', { ascending: false }),
      sb.from('doctor_notes').select('id, title, content, created_at').eq('doctor_id', doctorId).eq('patient_id', patientId).order('created_at', { ascending: false }),
      sb.from('patient_clinical_history').select('blood_type, allergies, chronic_conditions, current_medications, previous_surgeries, family_history, height_cm, weight_kg, notes, updated_at').eq('patient_id', patientId).maybeSingle(),
      sb.from('patient_vaccinations').select('id, vaccine_key, dose_number, application_date, applied').eq('patient_id', patientId).order('application_date', { ascending: false }),
      sb.from('chat_sessions').select('id').or(pair).eq('status', 'active').limit(1),
    ]);
    setData({
      appointments: appts.data || [],
      consultations: consults.data || [],
      prescriptions: rx.data || [],
      notes: notes.data || [],
      clinical: clinical.data || null,
      vaccinations: vacc.data || [],
      chatSessionId: chat.data?.[0]?.id || null,
    });
    setLoading(false);
  }, [doctorId, patientId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, reload: load };
}

export default function DoctorPatientDetail() {
  const { patientId = '' } = useParams();
  const navigate = useNavigate();
  const { supabaseUser, role } = useAuth();
  const { t } = useLanguage();
  const fmt = useAppDateFormat();
  const { toggles } = useSiteToggles();
  const { getAccessibleFiles } = useVault();
  const { patients, loading: loadingList } = useDoctorPatients();
  const { overview, status } = usePatientOverview(UUID_RE.test(patientId) ? patientId : undefined);
  const { data, loading } = usePatientRecord(supabaseUser?.id, patientId);
  const [tab, setTab] = useSectionParam<Tab>('tab', TABS, 'resumen');
  const { confirm, dialog } = useConfirmAction();
  const [newOpen, setNewOpen] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  const chatEnabled = !!toggles.enable_patient_chat;
  const rxEnabled = !!toggles.enable_prescriptions;
  const listEntry = patients.find((p) => p.id === patientId);
  const sharedFiles = useMemo(
    () => getAccessibleFiles(supabaseUser?.id || '').filter((f) => f.patientId === patientId),
    [getAccessibleFiles, supabaseUser?.id, patientId],
  );

  const name = overview?.patient.name || listEntry?.name || '';
  const displayName = name || t('mm2.patients.unnamed');
  const avatarUrl = overview?.patient.avatar_url || listEntry?.avatarUrl || null;
  const email = overview ? overview.patient.email : listEntry?.email || null;
  const phone = overview ? overview.patient.phone : listEntry?.phone || null;
  const nowIso = new Date().toISOString();
  const upcoming = data.appointments.filter((a) => a.scheduled_at >= nowIso && (a.status === 'requested' || a.status === 'confirmed')).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const past = data.appointments.filter((a) => !(a.scheduled_at >= nowIso && (a.status === 'requested' || a.status === 'confirmed')));

  const counters = overview?.counters || {
    consultations: data.consultations.length,
    appointments: data.appointments.length,
    appointments_upcoming: upcoming.length,
    appointments_pending: upcoming.filter((a) => a.status === 'requested').length,
    prescriptions: data.prescriptions.length,
    shared_files: sharedFiles.length,
    notes: data.notes.length,
  };
  const lastConsultationAt =
    overview?.last_consultation_at ||
    data.consultations[0]?.completed_at || data.consultations[0]?.ended_at || data.consultations[0]?.started_at || null;

  const hasAnyRelation =
    !!overview || !!listEntry || data.appointments.length + data.consultations.length + data.prescriptions.length + sharedFiles.length > 0 || !!data.chatSessionId;
  const stillLoading = loading || loadingList || status === 'loading';
  const notFound = !UUID_RE.test(patientId) || status === 'no_relation' || (!stillLoading && !hasAnyRelation);

  const apptStatus = (s: string) => {
    const key = ['requested', 'confirmed', 'completed', 'cancelled', 'active'].includes(s) ? s : 'other';
    return t(`mm2.patients.status.${key}`);
  };
  const apptPill = (s: string) =>
    s === 'requested' ? 'pro-pill-warn' : s === 'confirmed' ? 'pro-pill-info' : s === 'cancelled' ? 'pro-pill-muted' : 'pro-pill-ok';

  const openChat = async () => {
    if (!supabaseUser?.id) return;
    if (data.chatSessionId) {
      navigate(`/chat?session=${data.chatSessionId}`);
      return;
    }
    const ok = await confirm({
      title: fill(t('mm2.patients.chatConfirm.title'), { name: displayName }),
      description: t('mm2.patients.chatConfirm.desc'),
      details: [
        { label: t('mm2.patients.chatConfirm.patient'), value: displayName },
        { label: t('mm2.patients.chatConfirm.type'), value: t('mm2.patients.chatConfirm.typeValue') },
      ],
      confirmLabel: t('mm2.patients.chatConfirm.confirm'),
    });
    if (!ok) return;
    setOpeningChat(true);
    try {
      const { data: created, error } = await supabase
        .from('chat_sessions')
        .insert({ participant1_id: supabaseUser.id, participant1_type: 'doctor', participant2_id: patientId, participant2_type: 'patient', status: 'active', is_double_check: false })
        .select('id')
        .single();
      if (error) throw error;
      navigate(`/chat?session=${created.id}`);
    } catch (e) {
      console.error('[DoctorPatientDetail] chat', e);
      toast.error(t('pro.patients.chatError'));
    } finally {
      setOpeningChat(false);
    }
  };

  const newPrescription = () =>
    navigate(`/prescriptions/new?patientId=${patientId}&patientName=${encodeURIComponent(name)}`);

  const dateOrDash = (iso?: string | null, withTime = false) => (iso ? (withTime ? fmt.formatDateTime(iso) : fmt.formatDate(iso)) : '—');

  // Guard de rol al final: todos los hooks ya se ejecutaron.
  if (role && role !== 'doctor') return <Navigate to="/lives" replace />;

  const tabs = [
    { id: 'resumen' as Tab, label: t('mm2.patients.tabs.resumen'), icon: LayoutGrid },
    { id: 'historial' as Tab, label: t('mm2.patients.tabs.historial'), icon: History },
    { id: 'consultas' as Tab, label: t('mm2.patients.tabs.consultas'), icon: ClipboardList, badge: counters.appointments_pending },
    { id: 'documentos' as Tab, label: t('mm2.patients.tabs.documentos'), icon: FolderOpen, badge: sharedFiles.length },
    { id: 'recetas' as Tab, label: t('mm2.patients.tabs.recetas'), icon: Pill },
    { id: 'agenda' as Tab, label: t('mm2.patients.tabs.agenda'), icon: CalendarDays },
  ];

  const empty = (text: string) => <p className="pro-muted text-sm py-6 text-center">{text}</p>;

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <Link to="/doctor/patients" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white mb-3">
          <ArrowLeft className="w-4 h-4" /> {t('mm2.patients.back')}
        </Link>

        {stillLoading && !overview && !listEntry ? (
          <section className="pro-card pro-card-pad bg-card flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </section>
        ) : notFound ? (
          <section className="pro-card pro-card-pad bg-card text-center py-12">
            <UserX className="w-12 h-12 mx-auto pro-muted opacity-50 mb-3" />
            <h1 className="font-heading font-extrabold text-lg pro-ink">{t('mm2.patients.notFound.title')}</h1>
            <p className="pro-muted text-sm mt-1 max-w-md mx-auto">{t('mm2.patients.notFound.desc')}</p>
            <Link to="/doctor/patients" className="pro-btn pro-btn-teal mt-5 inline-flex">{t('mm2.patients.back')}</Link>
          </section>
        ) : (
          <>
            {/* Cabecera */}
            <section className="pro-card pro-card-pad bg-card mb-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="pro-initials w-16 h-16 text-lg flex-none">{avatarUrl ? <img src={avatarUrl} alt="" /> : initialsOf(displayName)}</span>
                  <div className="min-w-0">
                    <h1 className="font-heading font-extrabold text-xl sm:text-2xl pro-ink truncate">{displayName}</h1>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {overview?.patient.is_identity_verified && (
                        <span className="pro-pill pro-pill-ok inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {t('mm2.patients.identityVerified')}</span>
                      )}
                      {counters.appointments_pending > 0 && (
                        <span className="pro-pill pro-pill-warn">{fill(t('mm2.patients.pendingAcceptCount'), { n: counters.appointments_pending })}</span>
                      )}
                    </div>
                    <p className="text-sm pro-ink-2 mt-1.5 break-words">
                      {email || phone ? [email, phone].filter(Boolean).join(' · ') : t('mm2.patients.contactLocked')}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 md:flex gap-2 md:flex-none">
                  {chatEnabled && (
                    <button type="button" className="pro-btn pro-btn-outline" disabled={openingChat} onClick={openChat}>
                      {openingChat ? <Loader2 className="animate-spin" /> : <MessageSquare />} {t('mm2.patients.actions.openChat')}
                    </button>
                  )}
                  <button type="button" className="pro-btn pro-btn-teal" onClick={() => setNewOpen(true)}>
                    <Plus /> {t('mm2.patients.actions.newConsultation')}
                  </button>
                  {rxEnabled && (
                    <button type="button" className="pro-btn pro-btn-outline" onClick={newPrescription}>
                      <FileText /> {t('mm2.patients.actions.newPrescription')}
                    </button>
                  )}
                </div>
              </div>
              {status === 'pending_activation' && (
                <p className="text-xs pro-muted mt-3">{t('mm2.patients.pendingActivation')}</p>
              )}
            </section>

            <SectionTabs value={tab} onChange={setTab} items={tabs} ariaLabel={t('mm2.patients.tabsLabel')} className="mb-4" />

            {tab === 'resumen' && (
              <section className="pro-card pro-card-pad bg-card">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    [t('mm2.patients.summary.consultations'), counters.consultations],
                    [t('mm2.patients.summary.upcoming'), counters.appointments_upcoming],
                    [t('mm2.patients.summary.pendingAccept'), counters.appointments_pending],
                    [t('mm2.patients.summary.prescriptions'), counters.prescriptions],
                    [t('mm2.patients.summary.sharedFiles'), counters.shared_files],
                    [t('mm2.patients.summary.notes'), counters.notes],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border border-[#d6e1e7] bg-white p-3">
                      <p className="text-2xl font-extrabold pro-ink">{value as number}</p>
                      <p className="text-xs pro-muted mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <dl className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
                  <div className="rounded-2xl border border-[#d6e1e7] bg-white p-3">
                    <dt className="pro-muted text-xs">{t('mm2.patients.summary.nextAppointment')}</dt>
                    <dd className="font-semibold pro-ink mt-0.5">
                      {upcoming[0] ? (
                        <>
                          {dateOrDash(upcoming[0].scheduled_at, true)}{' '}
                          <span className={`pro-pill ml-1 ${apptPill(upcoming[0].status)}`}>{apptStatus(upcoming[0].status)}</span>
                        </>
                      ) : overview?.next_appointment_at ? dateOrDash(overview.next_appointment_at, true) : t('mm2.patients.summary.none')}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-[#d6e1e7] bg-white p-3">
                    <dt className="pro-muted text-xs">{t('mm2.patients.summary.lastConsultation')}</dt>
                    <dd className="font-semibold pro-ink mt-0.5">{lastConsultationAt ? dateOrDash(lastConsultationAt) : t('mm2.patients.summary.none')}</dd>
                  </div>
                </dl>
              </section>
            )}

            {tab === 'historial' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="pro-card pro-card-pad bg-card min-w-0">
                  <h2 className="pro-card-title flex items-center gap-2 mb-3"><Stethoscope className="w-5 h-5" /> {t('mm2.patients.history.consultations')}</h2>
                  {data.consultations.length === 0
                    ? empty(t('mm2.patients.history.emptyConsults'))
                    : (
                      <ul className="space-y-3">
                        {data.consultations.map((c) => (
                          <li key={c.id} className="rounded-2xl border border-[#d6e1e7] bg-white p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold pro-ink">{dateOrDash(c.completed_at || c.started_at)}</span>
                              <span className={`pro-pill ${apptPill(c.status)}`}>{apptStatus(c.status)}</span>
                            </div>
                            {c.diagnosis && <p className="mt-2"><b className="pro-ink">{t('mm2.patients.history.diagnosis')}:</b> <span className="pro-ink-2">{c.diagnosis}</span></p>}
                            {c.doctor_summary && <p className="mt-1"><b className="pro-ink">{t('mm2.patients.history.summary')}:</b> <span className="pro-ink-2">{c.doctor_summary}</span></p>}
                            {c.doctor_recommendations && <p className="mt-1"><b className="pro-ink">{t('mm2.patients.history.recommendations')}:</b> <span className="pro-ink-2">{c.doctor_recommendations}</span></p>}
                          </li>
                        ))}
                      </ul>
                    )}
                </section>
                <div className="grid gap-4 content-start min-w-0">
                  <section className="pro-card pro-card-pad bg-card">
                    <h2 className="pro-card-title mb-3">{t('mm2.patients.history.clinical')}</h2>
                    {!data.clinical ? (
                      empty(t('mm2.patients.history.clinicalLocked'))
                    ) : (
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {([
                          ['bloodType', data.clinical.blood_type],
                          ['allergies', data.clinical.allergies],
                          ['chronic', data.clinical.chronic_conditions],
                          ['medications', data.clinical.current_medications],
                          ['surgeries', data.clinical.previous_surgeries],
                          ['family', data.clinical.family_history],
                          ['height', data.clinical.height_cm ? `${data.clinical.height_cm} cm` : null],
                          ['weight', data.clinical.weight_kg ? `${data.clinical.weight_kg} kg` : null],
                        ] as [string, any][])
                          .filter(([, v]) => v !== null && v !== undefined && String(Array.isArray(v) ? v.join('') : v).trim() !== '')
                          .map(([k, v]) => (
                            <div key={k} className="rounded-xl bg-[#f3f6fa] p-2.5">
                              <dt className="text-xs pro-muted">{t(`mm2.patients.history.${k}`)}</dt>
                              <dd className="font-medium pro-ink break-words">{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
                            </div>
                          ))}
                      </dl>
                    )}
                    {data.vaccinations.length > 0 && (
                      <p className="text-xs pro-muted mt-3">{fill(t('mm2.patients.history.vaccinationsCount'), { n: data.vaccinations.length })}</p>
                    )}
                  </section>
                  <section className="pro-card pro-card-pad bg-card">
                    <h2 className="pro-card-title mb-3">{t('mm2.patients.history.notes')}</h2>
                    {data.notes.length === 0
                      ? empty(t('mm2.patients.history.emptyNotes'))
                      : (
                        <ul className="space-y-2 text-sm">
                          {data.notes.map((n) => (
                            <li key={n.id} className="rounded-xl bg-[#f3f6fa] p-2.5">
                              <p className="font-semibold pro-ink">{n.title || dateOrDash(n.created_at)}</p>
                              {n.content && <p className="pro-ink-2 mt-0.5 whitespace-pre-line">{n.content}</p>}
                            </li>
                          ))}
                        </ul>
                      )}
                  </section>
                </div>
              </div>
            )}

            {tab === 'consultas' && (
              <section className="pro-card pro-card-pad bg-card">
                {data.consultations.length + data.appointments.length === 0
                  ? empty(t('mm2.patients.consults.empty'))
                  : (
                    <ul className="divide-y divide-[#e3eaf0]">
                      {[
                        ...data.appointments.map((a) => ({ kind: 'appointment' as const, id: a.id, at: a.scheduled_at, status: a.status, text: a.reason, minutes: a.duration_minutes, chat: null })),
                        ...data.consultations.map((c) => ({ kind: 'consultation' as const, id: c.id, at: c.started_at, status: c.status, text: c.doctor_summary || c.diagnosis, minutes: null, chat: c.chat_session_id })),
                      ]
                        .sort((a, b) => String(b.at).localeCompare(String(a.at)))
                        .map((row) => (
                          <li key={`${row.kind}-${row.id}`} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold pro-ink text-sm">{dateOrDash(row.at, true)}</span>
                                <span className="text-xs pro-muted">{t(row.kind === 'appointment' ? 'mm2.patients.consults.typeAppointment' : 'mm2.patients.consults.typeConsultation')}{row.minutes ? ` · ${fill(t('mm2.patients.agenda.duration'), { n: row.minutes })}` : ''}</span>
                                <span className={`pro-pill ${apptPill(row.status)}`}>{apptStatus(row.status)}</span>
                              </div>
                              {row.text && <p className="text-sm pro-ink-2 mt-1 break-words">{row.text}</p>}
                            </div>
                            {row.chat && chatEnabled && (
                              <Link to={`/chat?session=${row.chat}`} className="pro-btn pro-btn-outline pro-btn-sm self-start sm:self-center">
                                <MessageSquare /> {t('mm2.patients.consults.openChat')}
                              </Link>
                            )}
                          </li>
                        ))}
                    </ul>
                  )}
              </section>
            )}

            {tab === 'documentos' && (
              <PatientDocumentsPanel patientId={patientId} patientName={displayName} files={sharedFiles} />
            )}

            {tab === 'recetas' && (
              <section className="pro-card pro-card-pad bg-card">
                {!rxEnabled ? (
                  empty(t('mm2.patients.rx.disabled'))
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h2 className="pro-card-title">{t('mm2.patients.rx.title')}</h2>
                      <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={newPrescription}><Plus /> {t('mm2.patients.actions.newPrescription')}</button>
                    </div>
                    {data.prescriptions.length === 0
                      ? empty(t('mm2.patients.rx.empty'))
                      : (
                        <ul className="divide-y divide-[#e3eaf0]">
                          {data.prescriptions.map((p) => {
                            const meds = Array.isArray(p.medications) ? p.medications.length : 0;
                            return (
                              <li key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold pro-ink text-sm">{dateOrDash(p.created_at)}{p.signed_at ? <span className="pro-pill pro-pill-ok ml-2">{t('mm2.patients.rx.signed')}</span> : null}</p>
                                  <p className="text-sm pro-ink-2 break-words">{p.diagnosis || '—'} · {fill(t('mm2.patients.rx.medications'), { n: meds })}</p>
                                </div>
                                <Link to={`/prescriptions/${p.id}`} className="pro-btn pro-btn-outline pro-btn-sm self-start sm:self-center">{t('mm2.patients.rx.view')}</Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                  </>
                )}
              </section>
            )}

            {tab === 'agenda' && (
              <section className="pro-card pro-card-pad bg-card">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="pro-card-title">{t('mm2.patients.agenda.upcoming')}</h2>
                  <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={() => setNewOpen(true)}><Plus /> {t('mm2.patients.actions.newConsultation')}</button>
                </div>
                {upcoming.length === 0
                  ? empty(t('mm2.patients.agenda.emptyUpcoming'))
                  : (
                    <ul className="space-y-2">
                      {upcoming.map((a) => (
                        <li key={a.id} className="rounded-2xl border border-[#d6e1e7] bg-white p-3 flex flex-wrap items-center gap-2 text-sm">
                          <CalendarDays className="w-4 h-4 text-primary" />
                          <span className="font-semibold pro-ink">{dateOrDash(a.scheduled_at, true)}</span>
                          <span className="pro-muted">{fill(t('mm2.patients.agenda.duration'), { n: a.duration_minutes || 30 })}</span>
                          <span className={`pro-pill ${apptPill(a.status)}`}>{apptStatus(a.status)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                <h2 className="pro-card-title mt-6 mb-3">{t('mm2.patients.agenda.past')}</h2>
                {past.length === 0
                  ? empty(t('mm2.patients.agenda.emptyPast'))
                  : (
                    <ul className="space-y-2">
                      {past.map((a) => (
                        <li key={a.id} className="rounded-2xl bg-[#f3f6fa] p-3 flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold pro-ink">{dateOrDash(a.scheduled_at, true)}</span>
                          <span className={`pro-pill ${apptPill(a.status)}`}>{apptStatus(a.status)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
              </section>
            )}
          </>
        )}
      </div>

      <NewConsultationDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultPatientId={UUID_RE.test(patientId) ? patientId : undefined}
        onCreated={() => {
          setNewOpen(false);
          setTab('agenda');
          window.setTimeout(() => window.location.reload(), 400);
        }}
      />
      {dialog}
    </MainLayout>
  );
}
