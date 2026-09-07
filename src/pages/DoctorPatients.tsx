import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { useDoctorPatients, DoctorPatient } from '@/hooks/useDoctorPatients';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DoctorPatientSearch } from '@/components/doctor/DoctorPatientSearch';
import {
  Users, Plus, Search, ChevronDown, Calendar, Clock, CalendarDays, ClipboardList, FileText,
  ArrowRight, MoreVertical, UserPlus, Link2, Download, MessageSquare, Loader2, X, Copy,
} from 'lucide-react';
import { fill, initialsOf, norm, fmtDate, fmtTime, whenLabel } from '@/lib/proFormat';

type Tab = 'all' | 'next' | 'followUp' | 'pending';
type Sort = 'recent' | 'name' | 'next';

export default function DoctorPatients() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const { toggles } = useSiteToggles();
  const { patients, loading, error, refresh } = useDoctorPatients();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [addOpen, setAddOpen] = useState(false);
  const [record, setRecord] = useState<DoctorPatient | null>(null);
  const [openingChat, setOpeningChat] = useState<string | null>(null);

  const chatEnabled = !!toggles.enable_patient_chat;

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
      if (tab === 'next' && !p.nextAppointmentAt) return false;
      if (tab === 'followUp' && p.status !== 'followUp') return false;
      if (tab === 'pending' && !p.hasPendingRequest) return false;
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
  }, [patients, query, tab, sort, language]);

  if (role !== 'doctor') return <Navigate to="/lives" replace />;

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

  const dateOr = (iso: string | null, withTime = false) => {
    if (!iso) return t('pro.patients.noDate');
    const d = new Date(iso);
    return withTime ? `${fmtDate(d, language)} · ${fmtTime(d, language)}` : fmtDate(d, language);
  };

  const countText = patients.length === 1 ? t('pro.patients.countOne') : fill(t('pro.patients.count'), { n: patients.length });
  const sortLabel = sort === 'recent' ? t('pro.patients.sortRecent') : sort === 'name' ? t('pro.patients.sortName') : t('pro.patients.sortNext');

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

        <section className="pro-card pro-card-pad bg-card min-w-0">
          {/* Buscador · pestañas · orden */}
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center mb-3">
            <div className="pro-search lg:max-w-[520px] lg:flex-1">
              <Search />
              <input type="search" className="bg-white" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('pro.patients.searchPlaceholder')} aria-label={t('pro.patients.searchPlaceholder')} />
              {query && <button type="button" className="pro-kebab w-7 h-7" onClick={() => setQuery('')} aria-label={t('pro.common.close')}><X /></button>}
            </div>
            <div className="pro-seg">
              {([['all', t('pro.patients.all')], ['next', t('pro.patients.nextConsultation')], ['followUp', t('pro.patients.followUp')], ['pending', t('pro.patients.pending')]] as [Tab, string][]).map(([k, l]) => (
                <button key={k} type="button" className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button type="button" className="pro-btn pro-btn-outline pro-btn-sm lg:ml-auto">{sortLabel} <ChevronDown /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSort('recent')}>{t('pro.patients.sortRecent')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('name')}>{t('pro.patients.sortName')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('next')}>{t('pro.patients.sortNext')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="text-sm pro-ink-2 mb-3">{loading && patients.length === 0 ? t('pro.common.loading') : countText}</p>

          {error && (
            <div className="mb-3 p-3 rounded-xl bg-[#fdecec] text-sm" style={{ color: 'var(--pro-live)' }}>
              {t('pro.common.error')} <button type="button" className="underline font-semibold ml-1" onClick={refresh}>{t('pro.common.retry')}</button>
            </div>
          )}

          {loading && patients.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2].map(i => <div key={i} className="h-44 rounded-2xl bg-[#eef3f6] animate-pulse" />)}
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-12 h-12 mx-auto pro-muted opacity-40 mb-3" />
              <h3 className="font-bold pro-ink">{t('pro.patients.empty')}</h3>
              <p className="pro-muted text-sm mt-1 max-w-md mx-auto">{t('pro.patients.emptyDesc')}</p>
              <button type="button" className="pro-btn pro-btn-teal mt-4" onClick={() => setAddOpen(true)}><Plus /> {t('pro.patients.add')}</button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {list.length === 0 && <p className="pro-muted text-sm sm:col-span-2 xl:col-span-3">{t('pro.patients.noMatch')}</p>}
              {list.map(p => (
                <article key={p.id} className="pro-patient">
                  <div className="top">
                    <span className="pro-initials">{p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : initialsOf(p.name)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="name">{p.countryFlag ? `${p.countryFlag} ` : ''}{p.name}</div>
                      <div className="mail">{p.email || '—'}</div>
                      <span className={`pro-pill mt-1.5 ${statusClass(p)}`}>{statusLabel(p)}</span>
                    </div>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="pro-kebab" aria-label={t('nav.more')}><MoreVertical /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => setRecord(p)}><Users className="w-4 h-4 mr-2" />{t('pro.patients.viewRecord')}</DropdownMenuItem>
                        {chatEnabled && <DropdownMenuItem onClick={() => openChatWith(p)}><MessageSquare className="w-4 h-4 mr-2" />{t('pro.patients.openChat')}</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => navigate('/doctor/availability?nueva=consulta')}><Calendar className="w-4 h-4 mr-2" />{t('pro.patients.schedule')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/doctor/vault')}><FileText className="w-4 h-4 mr-2" />{t('pro.patients.openDocs')}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="dates">
                    <span><Calendar />{t('pro.patients.lastConsultation')}: {dateOr(p.lastConsultationAt)}</span>
                    <span><Clock />{t('pro.patients.next')}: {dateOr(p.nextAppointmentAt, true)}</span>
                  </div>
                  <div className="acts">
                    <Link to="/doctor/agenda" title={t('pro.patients.agenda')}><CalendarDays /> <span>{t('pro.patients.agenda')}</span></Link>
                    <Link to="/my-appointments" title={t('pro.patients.consultations')}><ClipboardList /> <span>{t('pro.patients.consultations')}</span></Link>
                    <Link to="/doctor/vault" title={t('pro.patients.documents')}><FileText /> <span>{t('pro.patients.documents')}</span></Link>
                    <button type="button" className="main" onClick={() => setRecord(p)}><span>{t('pro.patients.viewRecord')}</span> <ArrowRight /></button>
                  </div>
                </article>
              ))}
              <button type="button" className="pro-add-card" onClick={() => setAddOpen(true)}>
                <span className="plus"><Plus /></span>
                <b>{t('pro.patients.add')}</b>
                <span>{t('pro.patients.addDesc')}</span>
              </button>
            </div>
          )}

          {/* Empieza a organizar tu consulta */}
          <div className="pro-quick mt-4 flex-col md:flex-row md:items-center">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="pro-icon-box"><UserPlus /></span>
              <div className="min-w-0">
                <div className="font-heading font-extrabold pro-ink text-base sm:text-[17px]">{t('pro.patients.getStarted')}</div>
                <div className="pro-muted text-xs sm:text-sm">{t('pro.patients.getStartedDesc')}</div>
              </div>
            </div>
            <div className="pro-quick-acts">
              <button type="button" onClick={() => setAddOpen(true)}><UserPlus /> {t('pro.patients.add')}</button>
              <button type="button" onClick={copyLink}><Link2 /> {t('pro.patients.shareLink')}</button>
              <Link to="/doctor/vault"><Download /> {t('pro.patients.importData')}</Link>
            </div>
          </div>
        </section>
      </div>

      {/* Añadir paciente */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> {t('pro.patients.addDialogTitle')}</DialogTitle>
            <DialogDescription>{t('pro.patients.addDialogDesc')}</DialogDescription>
          </DialogHeader>
          <DoctorPatientSearch />
          <div className="rounded-xl border border-border p-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t('pro.patients.shareLink')}</p>
              <p className="text-xs text-muted-foreground truncate">{shareLink}</p>
            </div>
            <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={copyLink}><Copy /> {t('pro.patients.shareLink')}</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ficha del paciente */}
      <Sheet open={!!record} onOpenChange={(o) => { if (!o) setRecord(null); }}>
        <SheetContent side="right" className="w-[min(94vw,420px)] sm:max-w-[420px] overflow-y-auto">
          {record && (
            <>
              <SheetHeader className="mb-4"><SheetTitle className="pro-card-title">{t('pro.patients.recordTitle')}</SheetTitle></SheetHeader>
              <div className="flex items-center gap-3">
                <span className="pro-initials w-16 h-16 text-lg">{record.avatarUrl ? <img src={record.avatarUrl} alt="" /> : initialsOf(record.name)}</span>
                <div className="min-w-0">
                  <div className="font-heading font-extrabold text-lg pro-ink truncate">{record.countryFlag ? `${record.countryFlag} ` : ''}{record.name}</div>
                  <span className={`pro-pill mt-1 ${statusClass(record)}`}>{statusLabel(record)}</span>
                </div>
              </div>
              <dl className="mt-5 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('pro.patients.email')}</dt><dd className="font-medium text-right truncate">{record.email || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('pro.patients.phone')}</dt><dd className="font-medium text-right">{record.phone || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('pro.patients.consultationsDone')}</dt><dd className="font-medium">{record.consultationsCount}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('pro.patients.lastConsultation')}</dt><dd className="font-medium text-right">{dateOr(record.lastConsultationAt)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('pro.patients.next')}</dt><dd className="font-medium text-right">{dateOr(record.nextAppointmentAt, true)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('pro.patients.lastContact')}</dt><dd className="font-medium text-right">{record.lastInteraction ? whenLabel(new Date(record.lastInteraction), language, t) : '—'}</dd></div>
                {record.tier && (
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('pro.patients.tier')}</dt><dd className="font-medium">{record.tier === 'premium' ? t('pro.patients.tierPremium') : record.tier === 'basic' ? t('pro.patients.tierBasic') : t('pro.patients.tierFree')}</dd></div>
                )}
              </dl>
              <div className="grid gap-2 mt-6">
                {chatEnabled && (
                  <button type="button" className="pro-btn pro-btn-teal w-full" disabled={openingChat === record.id} onClick={() => openChatWith(record)}>
                    {openingChat === record.id ? <Loader2 className="animate-spin" /> : <MessageSquare />} {t('pro.patients.openChat')}
                  </button>
                )}
                <button type="button" className="pro-btn pro-btn-outline w-full" onClick={() => navigate('/doctor/availability?nueva=consulta')}><Calendar /> {t('pro.patients.schedule')}</button>
                <Link to="/my-appointments" className="pro-btn pro-btn-outline w-full"><ClipboardList /> {t('pro.patients.consultations')}</Link>
                <Link to="/doctor/vault" className="pro-btn pro-btn-outline w-full"><FileText /> {t('pro.patients.openDocs')}</Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </MainLayout>
  );
}
