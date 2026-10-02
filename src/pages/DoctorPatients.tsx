import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVault } from '@/contexts/VaultContext';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { useDoctorPatients, DoctorPatient } from '@/hooks/useDoctorPatients';
import { usePatientInvites, inviteLinkFor, PatientInvite } from '@/hooks/usePatientInvites';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DoctorPatientSearch } from '@/components/doctor/DoctorPatientSearch';
import { NewConsultationDialog } from '@/components/doctor/NewConsultationDialog';
import { ImportPatientsDialog } from '@/components/doctor/patients/ImportPatientsDialog';
import { InvitePatientForm } from '@/components/doctor/patients/InvitePatientForm';
import { InviteCard } from '@/components/doctor/patients/InviteCard';
import { failureKey } from '@/components/doctor/patients/inviteMessages';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import {
  Users, Plus, Search, ChevronDown, Calendar, CalendarDays, ClipboardList, FileText,
  ArrowRight, MoreHorizontal, UserPlus, Link2, MessageSquare, X, Copy, Download, Mail,
  AlertTriangle, Info,
} from 'lucide-react';
import { fill, initialsOf, norm, fmtDate, fmtDayShort, fmtTime } from '@/lib/proFormat';
import { CountryTag } from '@/components/common/CountryTag';
import '@/styles/diseno-pacientes.css';
import '@/styles/funciones-importar.css';

type Tab = 'all' | 'next' | 'followUp' | 'pending' | 'docs' | 'invites';
type Sort = 'recent' | 'name' | 'next';

/** Tarjetas «Invitado» que se ven en «Todos» antes del botón «Ver todas». */
const INVITES_IN_ALL = 6;
const INVITES_PAGE = 24;

// 11-sep-2026: «Ver ficha» y los accesos Agenda/Consultas/Documentos de cada tarjeta
// abren la ficha de ESE paciente (/doctor/patients/:id). El panel lateral y el
// enlace a «Expedientes de pacientes» (/doctor/vault) se retiran: los documentos
// viven ahora en Paciente > Documentos.
// 13-sep-2026: «Importar datos» e invitaciones (maqueta de Marta). Un médico no crea
// cuentas: sube su lista y se crean invitaciones; las pendientes se ven como
// tarjetas «Invitado» y en la pestaña «Invitaciones».
export default function DoctorPatients() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const { toggles } = useSiteToggles();
  const { getAccessibleFiles } = useVault();
  const { patients, loading, error, refresh } = useDoctorPatients();
  const {
    invites,
    loading: invitesLoading,
    pendingActivation: invitesPending,
    importRows,
    revoke: revokeInviteRow,
    sendEmail: sendInviteEmail,
  } = usePatientInvites();
  const { confirm, dialog } = useConfirmAction();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [openingChat, setOpeningChat] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);
  const [invitesLimit, setInvitesLimit] = useState(INVITES_PAGE);

  const chatEnabled = !!toggles.enable_patient_chat;
  const patientsAccessOpen = toggles.enable_patient_access === true;
  const docPatientIds = useMemo(
    () => new Set(getAccessibleFiles(user?.id || '').map(f => f.patientId)),
    [getAccessibleFiles, user?.id],
  );
  const nameOf = (p: DoctorPatient) => p.name || t('mm2.patients.unnamed');

  const statusLabel = (p: DoctorPatient) => {
    switch (p.status) {
      case 'pending': return t('pro.patients.statusPending');
      case 'next': return t('pro.patients.statusNext');
      case 'followUp': return t('pro.patients.statusFollowUp');
      case 'follower': return t('pro.patients.statusFollower');
      default: return t('pro.patients.statusActive');
    }
  };
  const statusClass = (p: DoctorPatient) =>
    p.status === 'pending' ? 'pro-pill-warn'
    : p.status === 'next' ? 'pro-pill-info'
    : p.status === 'follower' ? 'pro-pill-muted'
    : 'pro-pill-ok';

  const list = useMemo(() => {
    const q = norm(query.trim());
    let arr = patients.filter(p => {
      if (tab === 'invites') return false;
      if (tab === 'next' && !p.nextAppointmentAt) return false;
      if (tab === 'followUp' && p.status !== 'followUp') return false;
      if (tab === 'pending' && !p.hasPendingRequest) return false;
      if (tab === 'docs' && !docPatientIds.has(p.id)) return false;
      if (q) {
        const hay = norm(`${p.name} ${p.email || ''} ${statusLabel(p)} ${p.tier || ''}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === 'name') arr = [...arr].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'next') arr = [...arr].sort((a, b) => (a.nextAppointmentAt || '9999').localeCompare(b.nextAppointmentAt || '9999'));
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, query, tab, sort, language, docPatientIds]);

  // Invitaciones pendientes: en «Todos» (las primeras) y en «Invitaciones» (todas).
  const inviteList = useMemo(() => {
    if (tab !== 'all' && tab !== 'invites') return [];
    const q = norm(query.trim());
    let arr = invites.filter(i =>
      !q || norm(`${i.fullName} ${i.email || ''} ${i.phone || ''} ${t('mm2.importar.card.statusInvited')}`).includes(q),
    );
    if (sort === 'name') arr = [...arr].sort((a, b) => a.fullName.localeCompare(b.fullName));
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invites, query, tab, sort, language]);
  const invitesShown = tab === 'all' ? inviteList.slice(0, INVITES_IN_ALL) : inviteList.slice(0, invitesLimit);

  const shareLink = `${window.location.origin}/app`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success(t('pro.patients.linkCopied'));
    } catch {
      toast.error(t('pro.patients.linkCopyError'));
    }
  };

  const openChatWith = async (p: DoctorPatient) => {
    if (!user?.id) return;
    setOpeningChat(p.id);
    try {
      const { data: existing } = await supabase
        .from('chat_sessions')
        .select('id')
        .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${p.id}),and(participant1_id.eq.${p.id},participant2_id.eq.${user.id})`)
        .eq('status', 'active')
        .maybeSingle();
      let sessionId = existing?.id;
      if (!sessionId) {
        // Crear una conversación nueva es una acción con consecuencias: primero la revisión.
        const ok = await confirm({
          title: fill(t('mm2.patients.chatConfirm.title'), { name: nameOf(p) }),
          description: t('mm2.patients.chatConfirm.desc'),
          details: [
            { label: t('mm2.patients.chatConfirm.patient'), value: nameOf(p) },
            { label: t('mm2.patients.chatConfirm.type'), value: t('mm2.patients.chatConfirm.typeValue') },
          ],
          confirmLabel: t('mm2.patients.chatConfirm.confirm'),
        });
        if (!ok) return;
        const { data: created, error: insErr } = await supabase
          .from('chat_sessions')
          .insert({
            participant1_id: user.id,
            participant1_type: 'doctor',
            participant2_id: p.id,
            participant2_type: 'patient',
            status: 'active',
            is_double_check: false,
          })
          .select('id')
          .single();
        if (insErr) throw insErr;
        sessionId = created.id;
      }
      navigate(`/chat?session=${sessionId}`);
    } catch (e) {
      console.error('[DoctorPatients] chat', e);
      toast.error(t('pro.patients.chatError'));
    } finally {
      setOpeningChat(null);
    }
  };

  // Fecha corta («5 sep») como en el mockup; el año solo aparece si no es el actual.
  const dateOr = (iso: string | null, withTime = false) => {
    if (!iso) return t('pro.patients.noDate');
    const d = new Date(iso);
    const day = d.getFullYear() === new Date().getFullYear() ? fmtDayShort(d, language) : fmtDate(d, language);
    return withTime ? `${day} · ${fmtTime(d, language)}` : day;
  };

  const recordHref = (p: DoctorPatient, tabId?: string) => `/doctor/patients/${p.id}${tabId ? `?tab=${tabId}` : ''}`;

  // ---- Acciones de la tarjeta «Invitado» ----
  const copyInviteLink = async (inv: PatientInvite) => {
    try {
      await navigator.clipboard.writeText(inviteLinkFor(inv.token));
      toast.success(fill(t('mm2.importar.card.copied'), { name: inv.fullName }));
    } catch {
      toast.error(t('pro.patients.linkCopyError'));
    }
  };

  const sendInvite = async (inv: PatientInvite) => {
    if (!inv.email) {
      toast.error(t('mm2.importar.errors.noEmail'));
      return;
    }
    const ok = await confirm({
      title: fill(t('mm2.importar.send.title'), { name: inv.fullName }),
      description: t('mm2.importar.send.desc'),
      details: [
        { label: t('mm2.importar.send.to'), value: inv.fullName },
        { label: t('mm2.importar.col.email'), value: inv.email },
        { label: t('mm2.importar.send.contains'), value: t('mm2.importar.send.containsValue') },
        ...(inv.sentAt ? [{ label: t('mm2.importar.send.lastSent'), value: dateOr(inv.sentAt, true) }] : []),
      ],
      confirmLabel: t('mm2.importar.send.confirm'),
    });
    if (!ok) return;
    setInviteBusy(inv.id);
    try {
      const res = await sendInviteEmail(inv.id);
      if (res.ok === true) toast.success(fill(t('mm2.importar.send.done'), { email: inv.email }));
      else toast.error(t(failureKey(res.reason)));
    } finally {
      setInviteBusy(null);
    }
  };

  const revokeInvite = async (inv: PatientInvite) => {
    const ok = await confirm({
      title: fill(t('mm2.importar.revoke.title'), { name: inv.fullName }),
      description: t('mm2.importar.revoke.desc'),
      details: [
        { label: t('mm2.importar.col.name'), value: inv.fullName },
        { label: t('mm2.importar.revoke.contact'), value: inv.email || inv.phone || '—' },
      ],
      confirmLabel: t('mm2.importar.revoke.confirm'),
    });
    if (!ok) return;
    setInviteBusy(inv.id);
    try {
      const res = await revokeInviteRow(inv.id);
      if (res.ok === true) toast.success(t('mm2.importar.revoke.done'));
      else toast.error(t(failureKey(res.reason)));
    } finally {
      setInviteBusy(null);
    }
  };

  const renderInvite = (inv: PatientInvite) => (
    <InviteCard
      key={`inv-${inv.id}`}
      invite={inv}
      busy={inviteBusy === inv.id}
      onCopy={copyInviteLink}
      onSend={sendInvite}
      onRevoke={revokeInvite}
    />
  );

  // Guard de rol al final: los hooks ya se ejecutaron.
  if (role && role !== 'doctor') return <Navigate to="/lives" replace />;

  const patientsCountText = patients.length === 1 ? t('pro.patients.countOne') : fill(t('pro.patients.count'), { n: patients.length });
  const invitesCountText = invites.length === 0
    ? ''
    : invites.length === 1 ? t('mm2.importar.list.countOne') : fill(t('mm2.importar.list.count'), { n: invites.length });
  const countText = invitesCountText ? `${patientsCountText} · ${invitesCountText}` : patientsCountText;
  const sortLabel = sort === 'recent' ? t('pro.patients.sortRecent') : sort === 'name' ? t('pro.patients.sortName') : t('pro.patients.sortNext');
  const nothingYet = patients.length === 0 && invites.length === 0;

  const tabs: [Tab, string][] = [
    ['all', t('pro.patients.all')],
    ['next', t('pro.patients.nextConsultation')],
    ['followUp', t('pro.patients.followUp')],
    ['pending', t('pro.patients.pending')],
    ['docs', t('mm2.patients.list.withDocs')],
    ['invites', t('mm2.importar.tab')],
  ];

  const skeleton = (
    <div className="dp-grid">
      {[0, 1, 2].map(i => <div key={i} className="h-44 rounded-2xl bg-[#eef3f6] animate-pulse" />)}
    </div>
  );

  const invitesSection = (
    <>
      {invitesPending && (
        <div className="fi-notice is-warn mb-3" role="status">
          <AlertTriangle />
          <span>{t('mm2.importar.pendingActivation')}</span>
        </div>
      )}
      {!invitesPending && !patientsAccessOpen && (
        <div className="fi-notice mb-3" role="note">
          <Info />
          <span>{t('mm2.importar.patientsClosed')}</span>
        </div>
      )}
      {invitesLoading && invites.length === 0 && !invitesPending ? skeleton : inviteList.length === 0 ? (
        <div className="text-center py-10">
          <Mail className="w-12 h-12 mx-auto pro-muted opacity-40 mb-3" />
          <h3 className="font-bold pro-ink">{query.trim() ? t('pro.patients.noMatch') : t('mm2.importar.list.emptyTitle')}</h3>
          {!query.trim() && <p className="pro-muted text-sm mt-1 max-w-md mx-auto">{t('mm2.importar.list.emptyDesc')}</p>}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <button type="button" className="pro-btn pro-btn-teal" onClick={() => setImportOpen(true)}><Download /> {t('mm2.importar.quick')}</button>
            <button type="button" className="pro-btn pro-btn-outline" onClick={() => setAddOpen(true)}><UserPlus /> {t('mm2.importar.list.inviteOne')}</button>
          </div>
        </div>
      ) : (
        <div className="dp-grid">
          {invitesShown.map(renderInvite)}
          {inviteList.length > invitesShown.length && (
            <div className="fi-more">
              <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => setInvitesLimit(l => l + INVITES_PAGE)}>
                {fill(t('mm2.importar.list.showMore'), { n: inviteList.length - invitesShown.length })}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><Users className="w-7 h-7" /> <span className="truncate">{t('pro.patients.title')}</span></h1>
            <p className="pro-page-sub">{t('pro.patients.subtitle')}</p>
          </div>
          <button type="button" className="pro-btn pro-btn-white w-full sm:w-auto" onClick={() => setAddOpen(true)}>
            <Plus /> {t('pro.patients.add')}
          </button>
        </div>

        <section className="pro-card pro-card-pad bg-card min-w-0 dp-shell">
          {/* Buscador · pestañas · orden */}
          <div className="dp-toolbar flex flex-col lg:flex-row gap-3 lg:items-center mb-3">
            <div className="pro-search lg:max-w-[520px] lg:flex-1">
              <Search />
              <input type="search" className="bg-white" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('pro.patients.searchPlaceholder')} aria-label={t('pro.patients.searchPlaceholder')} />
              {query && <button type="button" className="pro-kebab w-7 h-7" onClick={() => setQuery('')} aria-label={t('pro.common.close')}><X /></button>}
            </div>
            <div className="pro-seg">
              {tabs.map(([k, l]) => (
                <button key={k} type="button" aria-pressed={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
                  {l}
                  {k === 'invites' && invites.length > 0 && <span className="fi-count">{invites.length}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* 13-sep-2026: con la pestaña «Invitaciones» el buscador se quedaba sin sitio a 1440
              y cortaba el texto; el orden baja a la fila del contador, alineado a la derecha. */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm pro-ink-2">{loading && patients.length === 0 ? t('pro.common.loading') : countText}</p>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button type="button" className="pro-btn pro-btn-outline pro-btn-sm ml-auto">{sortLabel} <ChevronDown /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSort('recent')}>{t('pro.patients.sortRecent')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('name')}>{t('pro.patients.sortName')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('next')}>{t('pro.patients.sortNext')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {error && (
            <div className="mb-3 p-3 rounded-xl bg-[#fdecec] text-sm" style={{ color: 'var(--pro-live)' }}>
              {t('pro.common.error')} <button type="button" className="underline font-semibold ml-1" onClick={refresh}>{t('pro.common.retry')}</button>
            </div>
          )}

          {tab === 'invites' ? invitesSection : loading && patients.length === 0 ? skeleton : nothingYet ? (
            <div className="text-center py-10">
              <Users className="w-12 h-12 mx-auto pro-muted opacity-40 mb-3" />
              <h3 className="font-bold pro-ink">{t('pro.patients.empty')}</h3>
              <p className="pro-muted text-sm mt-1 max-w-md mx-auto">{t('pro.patients.emptyDesc')}</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <button type="button" className="pro-btn pro-btn-teal" onClick={() => setAddOpen(true)}><Plus /> {t('pro.patients.add')}</button>
                <button type="button" className="pro-btn pro-btn-outline" onClick={() => setImportOpen(true)}><Download /> {t('mm2.importar.quick')}</button>
              </div>
            </div>
          ) : (
            <div className="dp-grid">
              {list.length === 0 && invitesShown.length === 0 && <p className="pro-muted text-sm dp-span">{t('pro.patients.noMatch')}</p>}
              {list.map(p => (
                <article key={p.id} className="pro-patient dp-card">
                  <div className="top">
                    <span className="pro-initials">{p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : initialsOf(nameOf(p))}</span>
                    <div className="min-w-0 flex-1">
                      <div className="name">{p.countryFlag && <CountryTag flag={p.countryFlag} className="mr-1" />}{nameOf(p)}</div>
                      <div className="mail" title={p.email || undefined}>{p.email || '—'}</div>
                      <span className={`pro-pill mt-1.5 ${statusClass(p)}`}>{statusLabel(p)}</span>
                    </div>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="pro-kebab" aria-label={t('nav.more')}><MoreHorizontal /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => navigate(recordHref(p))}><Users className="w-4 h-4 mr-2" />{t('pro.patients.viewRecord')}</DropdownMenuItem>
                        {chatEnabled && <DropdownMenuItem disabled={openingChat === p.id} onClick={() => openChatWith(p)}><MessageSquare className="w-4 h-4 mr-2" />{t('pro.patients.openChat')}</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => setScheduleFor(p.id)}><Calendar className="w-4 h-4 mr-2" />{t('pro.patients.schedule')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(recordHref(p, 'documentos'))}><FileText className="w-4 h-4 mr-2" />{t('pro.patients.openDocs')}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="dp-meta">
                    <span><Calendar />{t('pro.patients.lastConsultation')}: {dateOr(p.lastConsultationAt)}</span>
                    <span>{t('pro.patients.next')}: {dateOr(p.nextAppointmentAt, true)}</span>
                  </div>
                  <div className="dp-acts">
                    <Link to={recordHref(p, 'agenda')} title={t('pro.patients.agenda')}><CalendarDays /> <span>{t('pro.patients.agenda')}</span></Link>
                    <Link to={recordHref(p, 'consultas')} title={t('pro.patients.consultations')}><ClipboardList /> <span>{t('pro.patients.consultations')}</span></Link>
                    <Link to={recordHref(p, 'documentos')} title={t('pro.patients.documents')}><FileText /> <span>{t('pro.patients.documents')}</span></Link>
                    <button type="button" className="main" onClick={() => navigate(recordHref(p))}><span>{t('pro.patients.viewRecord')}</span> <ArrowRight /></button>
                  </div>
                </article>
              ))}
              {invitesShown.map(renderInvite)}
              {tab === 'all' && inviteList.length > INVITES_IN_ALL && (
                <div className="fi-more">
                  <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => setTab('invites')}>
                    <Mail /> {fill(t('mm2.importar.list.viewAll'), { n: inviteList.length })}
                  </button>
                </div>
              )}
              <button type="button" className="pro-add-card" onClick={() => setAddOpen(true)}>
                <span className="plus"><Plus /></span>
                <b>{t('pro.patients.add')}</b>
                <span>{t('pro.patients.addDesc')}</span>
              </button>
            </div>
          )}

          {/* Empieza a organizar tu consulta */}
          <div className="pro-quick dp-quick mt-4">
            <div className="dp-quick-intro">
              <span className="pro-icon-box"><UserPlus /></span>
              <div className="min-w-0">
                <div className="font-heading font-extrabold pro-ink text-base sm:text-[17px]">{t('pro.patients.getStarted')}</div>
                <div className="pro-muted text-xs sm:text-sm">{t('pro.patients.getStartedDesc')}</div>
              </div>
            </div>
            <div className="dp-quick-acts">
              <button type="button" onClick={() => setAddOpen(true)}><UserPlus /> {t('pro.patients.add')}</button>
              <button type="button" onClick={copyLink}><Link2 /> {t('pro.patients.shareLink')}</button>
              <button type="button" onClick={() => setImportOpen(true)}><Download /> {t('mm2.importar.quick')}</button>
            </div>
          </div>
        </section>
      </div>

      {/* Añadir paciente: buscar a alguien ya registrado, invitar a una persona o compartir el enlace general */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> {t('pro.patients.addDialogTitle')}</DialogTitle>
            <DialogDescription>{t('pro.patients.addDialogDesc')}</DialogDescription>
          </DialogHeader>
          <DoctorPatientSearch />
          <InvitePatientForm
            pendingActivation={invitesPending}
            onImport={importRows}
            onCreated={() => { setAddOpen(false); setTab('invites'); }}
            onOpenImport={() => { setAddOpen(false); setImportOpen(true); }}
          />
          <div className="rounded-xl border border-border p-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t('pro.patients.shareLink')}</p>
              <p className="text-xs text-muted-foreground truncate">{shareLink}</p>
            </div>
            <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={copyLink}><Copy /> {t('pro.patients.shareLink')}</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Importar datos: lista de pacientes → invitaciones */}
      <ImportPatientsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        pendingActivation={invitesPending}
        patientsAccessOpen={patientsAccessOpen}
        onImport={importRows}
        onShowInvites={() => setTab('invites')}
      />

      {/* Nueva consulta con el paciente ya elegido (nunca Disponibilidad) */}
      <NewConsultationDialog
        open={!!scheduleFor}
        onOpenChange={(o) => { if (!o) setScheduleFor(null); }}
        defaultPatientId={scheduleFor || undefined}
        onCreated={() => { setScheduleFor(null); refresh(); }}
      />
      {dialog}
    </MainLayout>
  );
}
