import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { useDoctorConsultations, DoctorConsultation, ConsultStatus } from '@/hooks/useDoctorConsultations';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Stethoscope, CalendarDays, Clock, FileText, Video, MessageSquare, MoreVertical,
  ChevronDown, ChevronRight, Check, X, Loader2, Search, ClipboardList, Folder,
  Plus, Star, CircleCheck, Circle, User, AlertCircle, ArrowRight, Info,
} from 'lucide-react';
import { fill, initialsOf, norm, fmtTime, fmtDayLong, fmtDate, money } from '@/lib/proFormat';

type Tab = 'requests' | 'upcoming' | 'ongoing' | 'followUp' | 'done' | 'cancelled';
type DateFilter = 'all' | 'today' | 'week' | 'month';
type ModeFilter = 'all' | 'video' | 'chat' | 'pending';

/** A qué pestaña pertenece cada estado derivado */
const TAB_OF: Record<ConsultStatus, Tab> = {
  requested: 'requests',
  confirmed: 'upcoming',
  ongoing: 'ongoing',
  toClose: 'followUp',
  followUp: 'followUp',
  completed: 'done',
  cancelled: 'cancelled',
};

export default function DoctorConsultations() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const { toggles } = useSiteToggles();
  const { items, consultationFee, loading, error, refresh } = useDoctorConsultations();

  const [tab, setTab] = useState<Tab>('upcoming');
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const chatEnabled = !!toggles.enable_patient_chat;
  const prescriptionsEnabled = toggles.enable_prescriptions !== false;

  if (role && role !== 'doctor') return <Navigate to="/my-appointments" replace />;

  // ---------------------------------------------------------------- helpers
  const statusLabel = (s: ConsultStatus) => {
    switch (s) {
      case 'requested': return t('pro.consults.statusRequested');
      case 'confirmed': return t('pro.consults.statusConfirmed');
      case 'ongoing': return t('pro.consults.statusOngoing');
      case 'toClose': return t('pro.consults.kpiToClose');
      case 'followUp': return t('pro.consults.statusFollowUp');
      case 'cancelled': return t('pro.consults.statusCancelled');
      default: return t('pro.consults.statusDone');
    }
  };
  const statusClass = (s: ConsultStatus) =>
    s === 'requested' ? 'pro-pill-warn'
    : s === 'ongoing' ? 'pro-pill-live'
    : s === 'toClose' ? 'pro-pill-warn'
    : s === 'cancelled' ? 'pro-pill-muted'
    : s === 'completed' ? 'pro-pill-muted'
    : s === 'followUp' ? 'pro-pill-info'
    : 'pro-pill-ok';

  const modeOf = (c: DoctorConsultation): ModeFilter =>
    c.roomUrl ? 'video' : c.kind === 'chat' ? 'chat' : 'pending';
  const modeLabel = (c: DoctorConsultation) => {
    const m = modeOf(c);
    return m === 'video' ? t('pro.consults.modeVideo')
      : m === 'chat' ? t('pro.consults.modeChat')
      : t('pro.consults.modePending');
  };

  const inRange = (c: DoctorConsultation) => {
    if (dateFilter === 'all') return true;
    const d = new Date(c.at);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateFilter === 'today') return d >= startOfDay && d < new Date(startOfDay.getTime() + 86_400_000);
    if (dateFilter === 'week') {
      const from = new Date(startOfDay.getTime() - ((now.getDay() + 6) % 7) * 86_400_000);
      return d >= from && d < new Date(from.getTime() + 7 * 86_400_000);
    }
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  // ------------------------------------------------------------------- KPIs
  const counts = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 86_400_000;
    const byTab: Record<Tab, number> = { requests: 0, upcoming: 0, ongoing: 0, followUp: 0, done: 0, cancelled: 0 };
    let today = 0;
    let toClose = 0;
    items.forEach(c => {
      byTab[TAB_OF[c.status]] += 1;
      const ts = new Date(c.at).getTime();
      if (ts >= startOfDay && ts < endOfDay && c.status !== 'cancelled') today += 1;
      if (c.status === 'toClose') toClose += 1;
    });
    return { byTab, today, toClose };
  }, [items]);

  // ------------------------------------------------------------------ lista
  const list = useMemo(() => {
    const q = norm(query.trim());
    const arr = items.filter(c => {
      if (TAB_OF[c.status] !== tab) return false;
      if (!inRange(c)) return false;
      if (modeFilter !== 'all' && modeOf(c) !== modeFilter) return false;
      if (!q) return true;
      return norm(c.patientName).includes(q) || norm(c.reason).includes(q) || norm(c.notes).includes(q);
    });
    // Las que están por delante, de la más próxima a la más lejana; el resto,
    // de la más reciente hacia atrás.
    const future = tab === 'requests' || tab === 'upcoming';
    arr.sort((a, b) => {
      const ta = new Date(a.at).getTime();
      const tb = new Date(b.at).getTime();
      return future ? ta - tb : tb - ta;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, tab, query, dateFilter, modeFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, DoctorConsultation[]>();
    list.forEach(c => {
      const d = new Date(c.at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return [...map.entries()].map(([key, rows]) => ({ key, date: new Date(rows[0].at), rows }));
  }, [list]);

  const selected = useMemo(
    () => items.find(c => c.id === selectedId) || null,
    [items, selectedId],
  );

  // --------------------------------------------------------------- acciones
  const confirmAppt = async (c: DoctorConsultation) => {
    setBusy(c.id);
    const { error: err } = await supabase.from('appointments').update({ status: 'confirmed' } as any).eq('id', c.id);
    if (err) { setBusy(null); toast.error(err.message); return; }
    toast.success(t('myAppointments.toastConfirmed'));

    // Provisiona la sala de vídeo (igual que hacía "Mis citas": sin esto el
    // botón «Entrar» del paciente nunca funcionaba).
    try {
      const { data: room } = await supabase.functions.invoke('create-daily-room', {
        body: { liveId: c.id, mode: 'appointment', title: t('pro.consults.title') },
      });
      if ((room as any)?.room?.url) {
        await supabase.from('appointments').update({ daily_room_url: (room as any).room.url } as any).eq('id', c.id);
      }
    } catch (e) {
      console.warn('provision appointment room failed:', e);
    }
    try {
      await supabase.from('notifications').insert({
        user_id: c.patientId,
        type: 'system',
        title: t('myAppointments.confirmedNotifyTitle'),
        message: t('myAppointments.confirmedNotifyMessage'),
        data: { kind: 'appointment_confirmed', appointment_id: c.id, deeplink: '/my-appointments' },
      } as any);
    } catch { /* la confirmación no depende de la notificación */ }
    supabase.functions.invoke('send-appointment-confirmation', { body: { appointmentId: c.id } })
      .catch(e => console.warn('send-appointment-confirmation failed:', e));
    setBusy(null);
    await refresh();
  };

  const rejectAppt = async (c: DoctorConsultation) => {
    if (!confirm(t('myAppointments.confirmReject'))) return;
    setBusy(c.id);
    const { error: err } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', cancellation_reason: t('myAppointments.rejectedByDoctor') } as any)
      .eq('id', c.id);
    setBusy(null);
    if (err) { toast.error(err.message); return; }
    toast.success(t('myAppointments.toastRejected'));
    await refresh();
  };

  const cancelAppt = async (c: DoctorConsultation) => {
    if (!confirm(t('myAppointments.confirmCancel'))) return;
    setBusy(c.id);
    const { error: err } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', cancellation_reason: t('myAppointments.cancelledByUser') } as any)
      .eq('id', c.id);
    setBusy(null);
    if (err) { toast.error(err.message); return; }
    toast.success(t('myAppointments.toastCancelled'));
    await refresh();
  };

  const closeConsult = async (c: DoctorConsultation) => {
    if (!confirm(t('pro.consults.confirmClose'))) return;
    setBusy(c.id);
    const err = c.kind === 'appointment'
      ? (await supabase.from('appointments').update({ status: 'completed' } as any).eq('id', c.id)).error
      : (await supabase.from('consultations').update({ status: 'completed', completed_at: new Date().toISOString(), ended_at: new Date().toISOString() } as any).eq('id', c.id)).error;
    setBusy(null);
    if (err) { toast.error(err.message); return; }
    toast.success(t('pro.consults.closed'));
    await refresh();
  };

  const openChat = (c: DoctorConsultation) => {
    if (c.chatSessionId) navigate(`/chat?session=${c.chatSessionId}`);
    else navigate('/chat');
  };

  const pick = (c: DoctorConsultation) => {
    setSelectedId(c.id);
    if (window.matchMedia('(max-width: 1099px)').matches) setDetailOpen(true);
  };

  // ------------------------------------------------------------------ vista
  const kpis = [
    { key: 'requests' as Tab, label: t('pro.consults.kpiRequests'), value: counts.byTab.requests, Icon: FileText },
    { key: null, label: t('pro.consults.kpiToday'), value: counts.today, Icon: CalendarDays, date: 'today' as DateFilter },
    { key: 'upcoming' as Tab, label: t('pro.consults.kpiUpcoming'), value: counts.byTab.upcoming, Icon: CalendarDays },
    { key: 'followUp' as Tab, label: t('pro.consults.kpiToClose'), value: counts.toClose, Icon: Clock },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'requests', label: t('pro.consults.tabRequests') },
    { key: 'upcoming', label: t('pro.consults.tabUpcoming') },
    { key: 'ongoing', label: t('pro.consults.tabOngoing') },
    { key: 'followUp', label: t('pro.consults.tabFollowUp') },
    { key: 'done', label: t('pro.consults.tabDone') },
    { key: 'cancelled', label: t('pro.consults.tabCancelled') },
  ];

  const dateLabel = dateFilter === 'all' ? t('pro.consults.filterDate')
    : dateFilter === 'today' ? t('pro.consults.dateToday')
    : dateFilter === 'week' ? t('pro.consults.dateWeek')
    : t('pro.consults.dateMonth');
  const modeMenuLabel = modeFilter === 'all' ? t('pro.consults.filterMode')
    : modeFilter === 'video' ? t('pro.consults.modeVideo')
    : modeFilter === 'chat' ? t('pro.consults.modeChat')
    : t('pro.consults.modePending');

  const detail = (c: DoctorConsultation) => {
    const start = new Date(c.at);
    const roomReady = !!c.roomUrl;
    const docsReady = c.documentsCount > 0;
    return (
      <div className="space-y-3">
        {/* Paciente */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="pro-initials" style={{ width: 44, height: 44, fontSize: 14 }}>
            {c.patientAvatar ? <img src={c.patientAvatar} alt="" /> : initialsOf(c.patientName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="pro-row-name truncate">{c.patientName || t('pro.common.patient')}</div>
            <div className="pro-row-sub">MM-{c.patientId.slice(0, 6).toUpperCase()}</div>
          </div>
          <Link to={`/doctor/vault?patient=${c.patientId}`} className="pro-btn pro-btn-outline pro-btn-xs">
            <Folder /> {t('pro.consults.dRecord')}
          </Link>
        </div>

        <div className="pro-ctx-block">
          <div className="pro-ctx-h"><ClipboardList /> {t('pro.consults.dReason')}</div>
          <p className="text-[12.5px] pro-ink-2">{c.reason || t('pro.consults.dNoReason')}</p>
        </div>

        <div className="pro-ctx-block">
          <div className="pro-ctx-h"><CalendarDays /> {t('pro.consults.dWhen')}</div>
          <div className="pro-ctx-line"><span className="k">{fmtDayLong(start, language)}</span><span className="v">{fmtTime(start, language)}</span></div>
          {c.durationMinutes && (
            <div className="pro-ctx-line"><span className="k">{t('pro.consults.dDuration')}</span><span className="v">{c.durationMinutes} {t('pro.common.min')}</span></div>
          )}
          <div className="pro-ctx-line">
            <span className="k">{t('pro.consults.dMode')}</span>
            <span className="v">{modeLabel(c)}</span>
          </div>
          <div className="mt-1">
            <span className={`pro-pill ${roomReady ? 'pro-pill-ok' : 'pro-pill-muted'}`}>
              {roomReady ? t('pro.consults.dAccessOn') : t('pro.consults.dAccessOff')}
            </span>
          </div>
        </div>

        <div className="pro-ctx-block">
          <div className="pro-ctx-h"><FileText /> {t('pro.consults.dFee')}</div>
          <div className="pro-ctx-line">
            <span className="k">{t('pro.consults.dFee')}</span>
            <span className="v">{consultationFee > 0 ? money(consultationFee, language) : t('pro.consults.dFeeFree')}</span>
          </div>
          <p className="text-[11.5px] pro-muted mt-1">{t('pro.consults.dFeeNote')}</p>
          <Link to="/doctor/earnings" className="pro-link mt-1"><ArrowRight /> {t('pro.earnings.title')}</Link>
        </div>

        <div className="pro-ctx-block">
          <div className="pro-ctx-h"><Folder /> {t('pro.consults.dDocuments')}</div>
          {docsReady ? (
            <Link to={`/doctor/vault?patient=${c.patientId}`} className="pro-link">
              {fill(t('pro.consults.dDocumentsN'), { n: c.documentsCount })} <ChevronRight />
            </Link>
          ) : (
            <p className="text-[12.5px] pro-muted">{t('pro.consults.dNoDocuments')}</p>
          )}
        </div>

        {(c.notes || c.summary || c.diagnosis || c.recommendations) && (
          <div className="pro-ctx-block">
            <div className="pro-ctx-h"><ClipboardList /> {t('pro.consults.dNotes')}</div>
            {c.notes && <p className="text-[12.5px] pro-ink-2 italic">«{c.notes}»</p>}
            {c.diagnosis && <p className="text-[12.5px] pro-ink-2 mt-1"><b>{c.diagnosis}</b></p>}
            {c.summary && <p className="text-[12.5px] pro-ink-2 mt-1">{c.summary}</p>}
            {c.recommendations && <p className="text-[12.5px] pro-ink-2 mt-1">{c.recommendations}</p>}
          </div>
        )}

        {c.rating != null && (
          <div className="pro-ctx-block">
            <div className="pro-ctx-h"><Star /> {t('pro.consults.rating')}</div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} className="w-4 h-4" style={{ color: n <= (c.rating || 0) ? '#e6a700' : '#d7e0e6', fill: n <= (c.rating || 0) ? '#e6a700' : 'transparent' }} />
              ))}
            </div>
          </div>
        )}

        {/* Lista de preparación — cada línea es un hecho comprobable */}
        <div className="pro-ctx-block">
          <div className="pro-ctx-h"><CircleCheck /> {t('pro.consults.dChecklist')}</div>
          <div className={`pro-check ${docsReady ? 'is-done' : 'is-todo'}`}>
            {docsReady ? <CircleCheck /> : <Circle />}
            {docsReady ? t('pro.consults.chkRecord') : t('pro.consults.chkRecordTodo')}
          </div>
          <div className={`pro-check ${c.hasOpenChat ? 'is-done' : 'is-todo'}`}>
            {c.hasOpenChat ? <CircleCheck /> : <Circle />}
            {c.hasOpenChat ? t('pro.consults.chkConsent') : t('pro.consults.chkConsentTodo')}
          </div>
          <div className={`pro-check ${roomReady ? 'is-done' : 'is-todo'}`}>
            {roomReady ? <CircleCheck /> : <Circle />}
            {roomReady ? t('pro.consults.chkRoom') : t('pro.consults.chkRoomTodo')}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link to={`/doctor/vault?patient=${c.patientId}`} className="pro-btn pro-btn-outline pro-btn-sm"><Folder /> {t('pro.consults.dDocuments')}</Link>
          {chatEnabled && (
            <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => openChat(c)}>
              <MessageSquare /> {t('pro.consults.chat')}
            </button>
          )}
          {prescriptionsEnabled && (
            <Link
              to={`/prescriptions/new?patientId=${c.patientId}&patientName=${encodeURIComponent(c.patientName || '')}${c.kind === 'chat' ? `&consultationId=${c.id}` : ''}${c.chatSessionId ? `&sessionId=${c.chatSessionId}` : ''}`}
              className="pro-btn pro-btn-teal pro-btn-sm col-span-2"
            >
              <FileText /> {t('pro.consults.dPrescribe')}
            </Link>
          )}
        </div>

        {/* Después de la consulta: el paso al que le toca ahora */}
        <div className="pro-ctx-block">
          <div className="pro-ctx-h"><ArrowRight /> {t('pro.consults.after')}</div>
          <div className="pro-steps">
            {[
              { lbl: t('pro.consults.stepSummary'), Icon: ClipboardList, done: !!c.summary },
              { lbl: t('pro.consults.stepNotes'), Icon: FileText, done: !!c.notes || !!c.diagnosis },
              { lbl: t('pro.consults.stepPrescription'), Icon: FileText, done: c.hasPrescription },
              { lbl: t('pro.consults.stepFollowUp'), Icon: MessageSquare, done: c.hasOpenChat },
            ].map((s, i) => (
              <div key={i} className={`pro-step ${s.done ? 'is-active' : ''}`}>
                <span className="dot"><s.Icon /></span>
                <span className="lbl">{s.lbl}</span>
              </div>
            ))}
          </div>
        </div>

        {c.cancellationReason && (
          <div className="pro-note"><Info /><span>{t('pro.consults.cancelReason')}: {c.cancellationReason}</span></div>
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><Stethoscope className="w-7 h-7" /> <span className="truncate">{t('pro.consults.title')}</span></h1>
            <p className="pro-page-sub">{t('pro.consults.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button type="button" className="pro-btn pro-btn-live flex-1 sm:flex-none" onClick={() => navigate('/doctor/availability?nueva=consulta')}>
              <Plus /> {t('pro.consults.newConsultation')}
            </button>
            <Link to="/doctor/agenda" className="pro-btn pro-btn-white flex-1 sm:flex-none">
              <CalendarDays /> {t('pro.consults.viewAgenda')}
            </Link>
          </div>
        </div>

        {/* KPIs — cada una lleva a su pestaña */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {kpis.map(k => (
            <button
              key={k.label}
              type="button"
              className="pro-card pro-kpi"
              onClick={() => {
                if (k.date) { setDateFilter(k.date); setTab('upcoming'); }
                else if (k.key) { setTab(k.key); setDateFilter('all'); }
              }}
            >
              <span className="pro-icon-box"><k.Icon /></span>
              <span className="min-w-0">
                <span className="pro-kpi-label block">{k.label}</span>
                <span className="pro-kpi-value block">{k.value}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="pro-work pro-work-2">
          {/* -------------------------------------------------- lista */}
          <section className="pro-card pro-card-pad min-w-0">
            <div className="pro-seg mb-3">
              {tabs.map(tt => (
                <button
                  key={tt.key}
                  type="button"
                  className={tab === tt.key ? 'is-active' : ''}
                  aria-pressed={tab === tt.key}
                  onClick={() => setTab(tt.key)}
                >
                  {tt.label} {counts.byTab[tt.key] > 0 && <span className="ml-1 opacity-70">{counts.byTab[tt.key]}</span>}
                </button>
              ))}
            </div>

            <div className="flex flex-col lg:flex-row gap-2 mb-3">
              <label className="pro-search flex-1">
                <Search />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t('pro.consults.searchPlaceholder')}
                  aria-label={t('pro.consults.searchPlaceholder')}
                />
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="pro-btn pro-btn-outline pro-btn-sm"><CalendarDays /> {dateLabel} <ChevronDown /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDateFilter('all')}>{t('pro.consults.dateAll')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDateFilter('today')}>{t('pro.consults.dateToday')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDateFilter('week')}>{t('pro.consults.dateWeek')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDateFilter('month')}>{t('pro.consults.dateMonth')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="pro-btn pro-btn-outline pro-btn-sm"><Video /> {modeMenuLabel} <ChevronDown /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setModeFilter('all')}>{t('pro.consults.modeAll')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setModeFilter('video')}>{t('pro.consults.modeVideo')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setModeFilter('chat')}>{t('pro.consults.modeChat')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setModeFilter('pending')}>{t('pro.consults.modePending')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {(dateFilter !== 'all' || modeFilter !== 'all' || query) && (
                  <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => { setDateFilter('all'); setModeFilter('all'); setQuery(''); }}>
                    <X /> {t('pro.consults.clearFilters')}
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--pro-teal)' }} /></div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="pro-muted text-sm mb-3">{t('pro.common.error')}</p>
                <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={refresh}>{t('pro.common.retry')}</button>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12">
                <span className="pro-icon-box mx-auto mb-3"><Stethoscope /></span>
                <p className="pro-ink font-semibold">{t('pro.consults.empty')}</p>
                <p className="pro-muted text-sm mt-1 max-w-md mx-auto">{t('pro.consults.emptyHint')}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {groups.map(g => (
                  <React.Fragment key={g.key}>
                    <div className="pro-daygroup">{fmtDayLong(g.date, language)}</div>
                    {g.rows.map(c => {
                      const start = new Date(c.at);
                      const soon = c.status === 'ongoing' || (c.status === 'confirmed' && Math.abs(start.getTime() - Date.now()) < 30 * 60_000);
                      return (
                        <div key={c.id} className={`pro-appt ${selectedId === c.id ? 'is-active' : ''}`}>
                          <button type="button" className="when text-left" onClick={() => pick(c)}>
                            <b>{fmtTime(start, language)}</b>
                            <span>{c.durationMinutes ? `${c.durationMinutes} ${t('pro.common.min')}` : t('pro.consults.sourceChat')}</span>
                          </button>
                          <button type="button" className="who text-left" onClick={() => pick(c)}>
                            <span className="pro-initials" style={{ width: 38, height: 38 }}>
                              {c.patientAvatar ? <img src={c.patientAvatar} alt="" /> : initialsOf(c.patientName)}
                            </span>
                            <span className="min-w-0">
                              <span className="pro-row-name block truncate">{c.patientName || t('pro.common.patient')}</span>
                              <span className="pro-row-sub block truncate">
                                {c.kind === 'chat' ? t('pro.consults.sourceChat') : t('pro.consults.sourceAppointment')}
                                {c.reason ? ` · ${c.reason}` : ''}
                              </span>
                            </span>
                          </button>
                          <div className="meta">
                            <span className={`pro-pill ${c.roomUrl ? 'pro-pill-info' : 'pro-pill-muted'} pro-pill-plain`}>
                              {c.roomUrl ? <Video className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />} {modeLabel(c)}
                            </span>
                            <span className={`pro-pill ${statusClass(c.status)}`}>{statusLabel(c.status)}</span>
                          </div>
                          <div className="acts">
                            {c.status === 'requested' ? (
                              <>
                                <button type="button" className="pro-btn pro-btn-teal pro-btn-xs" disabled={busy === c.id} onClick={() => confirmAppt(c)}>
                                  {busy === c.id ? <Loader2 className="animate-spin" /> : <Check />} {t('pro.consults.confirm')}
                                </button>
                                <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" disabled={busy === c.id} onClick={() => rejectAppt(c)}>
                                  {t('pro.consults.reject')}
                                </button>
                              </>
                            ) : soon && c.roomUrl ? (
                              <a href={c.roomUrl} target="_blank" rel="noreferrer" className="pro-btn pro-btn-teal pro-btn-xs"><Video /> {t('pro.consults.open')}</a>
                            ) : (
                              <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={() => pick(c)}>{t('pro.consults.details')}</button>
                            )}
                            {chatEnabled && (
                              <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={() => openChat(c)}>
                                <MessageSquare /> <span className="hidden sm:inline">{t('pro.consults.chat')}</span>
                              </button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className="pro-kebab" aria-label={t('pro.consults.details')}><MoreVertical /></button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => pick(c)}>{t('pro.consults.details')}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/doctor/vault?patient=${c.patientId}`)}>{t('pro.consults.dRecord')}</DropdownMenuItem>
                                {prescriptionsEnabled && (
                                  <DropdownMenuItem onClick={() => navigate(`/prescriptions/new?patientId=${c.patientId}&patientName=${encodeURIComponent(c.patientName || '')}`)}>
                                    {t('pro.consults.dPrescribe')}
                                  </DropdownMenuItem>
                                )}
                                {(c.status === 'toClose' || c.status === 'ongoing') && (
                                  <DropdownMenuItem onClick={() => closeConsult(c)}>{t('pro.consults.close')}</DropdownMenuItem>
                                )}
                                {c.kind === 'appointment' && c.status !== 'cancelled' && c.status !== 'completed' && (
                                  <DropdownMenuItem className="text-destructive" onClick={() => cancelAppt(c)}>{t('pro.consults.cancel')}</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            )}
          </section>

          {/* ------------------------------------------------- detalle */}
          <aside className="pro-card pro-card-pad hidden lg:block self-start">
            <div className="pro-card-head">
              <h2 className="pro-card-title"><ClipboardList /> {t('pro.consults.detailTitle')}</h2>
            </div>
            {selected ? detail(selected) : (
              <p className="pro-muted text-sm">{t('pro.consults.detailPick')}</p>
            )}
          </aside>
        </div>

        {/* Enlace a la vista antigua: no se pierde nada de lo que había */}
        <div className="mt-4">
          <Link to="/my-appointments" className="pro-link" style={{ color: '#fff' }}>
            <ArrowRight /> {t('pro.consults.patientView')}
          </Link>
        </div>
      </div>

      {/* Detalle en hoja lateral cuando no cabe la columna */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-card">
          <SheetHeader className="mb-4"><SheetTitle className="pro-card-title">{t('pro.consults.detailTitle')}</SheetTitle></SheetHeader>
          {selected && detail(selected)}
        </SheetContent>
      </Sheet>
    </MainLayout>
  );
}
