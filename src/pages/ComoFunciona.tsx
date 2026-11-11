import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus, IdCard, PenLine, ScanFace, BadgeCheck,
  Stethoscope, Search, Send, MessageSquare, Eye,
  CalendarClock, Inbox, CheckCircle2, Video, ClipboardCheck,
  Users, FileText, FolderOpen, Pill, QrCode,
  Radio, PlayCircle, BookOpen, Star,
  MessagesSquare, Package, GraduationCap,
  Wallet, TrendingUp, Landmark, Receipt, Banknote,
  Bell, ChevronDown, ArrowRight, Check, Map as MapIcon, Languages, HelpCircle,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { doctorHref } from '@/lib/doctorSections';
import '@/styles/como-funciona.css';

// «Cómo funciona» v2 (Jose, 11-nov-2026: «más fácil de entender»).
// Arriba un diagrama tipo metro del recorrido; debajo, cada etapa paso a paso
// en filas cortas con el detalle plegado. El contenido sale de las pantallas
// reales (App.tsx, doctorSections.ts) y de la configuración vigente en la BD.
// Los ✓ de avance solo usan datos que la app ya lee del médico (perfil,
// horario y cuenta bancaria); si no hay dato, no se marca nada.

type Who = 'patient' | 'resident' | 'team' | 'community';
type CheckKey = 'registro' | 'verificacion' | 'perfil' | 'agenda' | 'banco';

interface Step {
  id: string;
  icon: React.ElementType;
  other: Who;
  href: (uid: string) => string;
  doctorOnly?: boolean;
  adminHref?: string;
  check?: CheckKey;
}

interface Section { id: string; icon: React.ElementType; steps: Step[] }

const finanzas = (f: string) => doctorHref('cuenta', { tab: 'finanzas', f });
const perfil = (b: string) => doctorHref('cuenta', { tab: 'perfil', b });

const SECTIONS: Section[] = [
  {
    id: 'a', icon: BadgeCheck, steps: [
      { id: 'a1', icon: UserPlus, other: 'team', href: () => perfil('identidad'), doctorOnly: true, adminHref: '/admin/users', check: 'registro' },
      { id: 'a2', icon: IdCard, other: 'team', href: () => perfil('trayectoria'), doctorOnly: true, adminHref: '/admin/doctors' },
      { id: 'a3', icon: PenLine, other: 'team', href: () => perfil('identidad'), doctorOnly: true },
      { id: 'a4', icon: ScanFace, other: 'team', href: () => '/verify-identity', doctorOnly: true, adminHref: '/admin/verifications' },
      { id: 'a5', icon: BadgeCheck, other: 'team', href: () => '/verification-pending', doctorOnly: true, adminHref: '/admin/doctors', check: 'verificacion' },
    ],
  },
  {
    id: 'b', icon: Stethoscope, steps: [
      { id: 'b1', icon: Stethoscope, other: 'patient', href: () => perfil('servicios'), doctorOnly: true, check: 'perfil' },
      { id: 'b2', icon: Search, other: 'patient', href: () => '/doctors' },
      { id: 'b3', icon: Send, other: 'patient', href: () => doctorHref('pacientes'), doctorOnly: true },
      { id: 'b4', icon: MessageSquare, other: 'patient', href: () => '/chat' },
      { id: 'b5', icon: Eye, other: 'patient', href: (uid) => `/doctor/${uid}`, doctorOnly: true },
    ],
  },
  {
    id: 'c', icon: CalendarClock, steps: [
      { id: 'c1', icon: CalendarClock, other: 'patient', href: () => doctorHref('agenda', { tab: 'disponibilidad' }), doctorOnly: true, check: 'agenda' },
      { id: 'c2', icon: Inbox, other: 'patient', href: () => doctorHref('agenda', { tab: 'consultas' }), doctorOnly: true },
      { id: 'c3', icon: CheckCircle2, other: 'patient', href: () => doctorHref('agenda', { tab: 'consultas' }), doctorOnly: true },
      { id: 'c4', icon: Video, other: 'patient', href: () => doctorHref('agenda', { tab: 'calendario' }), doctorOnly: true },
      { id: 'c5', icon: ClipboardCheck, other: 'patient', href: () => doctorHref('agenda', { tab: 'consultas' }), doctorOnly: true },
    ],
  },
  {
    id: 'd', icon: FileText, steps: [
      { id: 'd1', icon: Users, other: 'patient', href: () => doctorHref('pacientes'), doctorOnly: true },
      { id: 'd2', icon: FileText, other: 'patient', href: () => doctorHref('pacientes'), doctorOnly: true },
      { id: 'd3', icon: FolderOpen, other: 'patient', href: () => doctorHref('pacientes'), doctorOnly: true },
      { id: 'd4', icon: Pill, other: 'patient', href: () => '/prescriptions/new', doctorOnly: true },
      { id: 'd5', icon: QrCode, other: 'patient', href: () => '/prescriptions', doctorOnly: true },
    ],
  },
  {
    id: 'e', icon: Radio, steps: [
      { id: 'e1', icon: Radio, other: 'community', href: () => '/doctor/go-live', doctorOnly: true },
      { id: 'e2', icon: PlayCircle, other: 'community', href: () => '/lives' },
      { id: 'e3', icon: Video, other: 'community', href: () => doctorHref('contenido', { tab: 'grabaciones' }), doctorOnly: true },
      { id: 'e4', icon: BookOpen, other: 'community', href: () => doctorHref('contenido', { tab: 'crear' }), doctorOnly: true },
      { id: 'e5', icon: Star, other: 'community', href: () => perfil('contenido'), doctorOnly: true },
    ],
  },
  {
    id: 'f', icon: MessagesSquare, steps: [
      { id: 'f1', icon: MessageSquare, other: 'patient', href: () => '/chat' },
      { id: 'f2', icon: MessagesSquare, other: 'community', href: () => '/resident-groups' },
      { id: 'f3', icon: Users, other: 'community', href: () => '/foro' },
      { id: 'f4', icon: Package, other: 'community', href: () => '/marketplace', adminHref: '/admin/marketplace' },
      { id: 'f5', icon: GraduationCap, other: 'resident', href: () => doctorHref('inicio'), doctorOnly: true, adminHref: '/admin/residents' },
    ],
  },
  {
    id: 'g', icon: Wallet, steps: [
      { id: 'g1', icon: Wallet, other: 'patient', href: () => finanzas('recargas'), doctorOnly: true },
      { id: 'g2', icon: TrendingUp, other: 'patient', href: () => finanzas('ingresos'), doctorOnly: true },
      { id: 'g3', icon: Landmark, other: 'team', href: () => finanzas('banco'), doctorOnly: true, check: 'banco' },
      { id: 'g4', icon: Receipt, other: 'team', href: () => finanzas('facturas'), doctorOnly: true, adminHref: '/admin/invoices' },
      { id: 'g5', icon: Banknote, other: 'team', href: () => finanzas('movimientos'), doctorOnly: true, adminHref: '/admin/payouts' },
    ],
  },
];

// Metro: recorrido principal + dos ramas que corren en paralelo.
interface Station { id: string; icon: React.ElementType; sec: string; branch?: boolean; check?: CheckKey }
const STATIONS: Station[] = [
  { id: 'registro', icon: UserPlus, sec: 'a', check: 'registro' },
  { id: 'verificacion', icon: BadgeCheck, sec: 'a', check: 'verificacion' },
  { id: 'perfil', icon: Stethoscope, sec: 'b', check: 'perfil' },
  { id: 'lives', icon: Radio, sec: 'e', branch: true },
  { id: 'pacientes', icon: Users, sec: 'b' },
  { id: 'agenda', icon: CalendarClock, sec: 'c', check: 'agenda' },
  { id: 'consulta', icon: Video, sec: 'c' },
  { id: 'comunidad', icon: MessagesSquare, sec: 'f', branch: true },
  { id: 'expediente', icon: FileText, sec: 'd' },
  { id: 'cobro', icon: Wallet, sec: 'g', check: 'banco' },
  { id: 'retiro', icon: Banknote, sec: 'g' },
];

const NOTIF_KEYS = ['chat', 'appointment', 'messages', 'payouts', 'community', 'meetings', 'refunds', 'moderation'];
const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
const NAV_IDS = [...SECTIONS.map(s => s.id), 'avisos', 'faq'];

/** Fondo de las barras fijas de la app (cabecera y barra «Inicio» del móvil). */
function appBarsBottom(): number {
  let bottom = 0;
  document.querySelectorAll<HTMLElement>('header.pro-topbar, .app-back-header').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || (cs.position !== 'sticky' && cs.position !== 'fixed')) return;
    bottom = Math.max(bottom, (parseFloat(cs.top) || 0) + el.getBoundingClientRect().height);
  });
  return Math.round(bottom);
}

function useIsMobile() {
  const q = '(max-width: 1023px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

export default function ComoFunciona() {
  const { user, role } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const k = useCallback((key: string) => t(`howItWorks.${key}`), [t]);
  const uid = user?.id || '';
  const isDoctor = role === 'doctor';
  const isMobile = useIsMobile();

  // ---- Avance del médico (solo datos que la app ya consulta) ----
  const [checks, setChecks] = useState<Partial<Record<CheckKey, boolean>>>({});
  useEffect(() => {
    if (!isDoctor || !uid) return;
    let alive = true;
    const sb = supabase as any;
    Promise.all([
      sb.from('doctor_profiles').select('status, bio').eq('user_id', uid).maybeSingle(),
      sb.from('doctor_schedule_ranges').select('id', { count: 'exact', head: true }).eq('doctor_id', uid).eq('is_active', true),
      sb.from('doctor_bank_accounts').select('id').eq('doctor_id', uid).maybeSingle(),
    ]).then(([dp, sched, bank]: any[]) => {
      if (!alive) return;
      const next: Partial<Record<CheckKey, boolean>> = {};
      if (!dp.error && dp.data) {
        next.registro = true;
        next.verificacion = dp.data.status === 'approved';
        next.perfil = Boolean(user?.avatarUrl) && Boolean((dp.data.bio || '').trim());
      }
      if (!sched.error && typeof sched.count === 'number') next.agenda = sched.count > 0;
      if (!bank.error) next.banco = Boolean(bank.data);
      setChecks(next);
    }).catch(() => { /* sin datos: no se marca nada */ });
    return () => { alive = false; };
  }, [isDoctor, uid, user?.avatarUrl]);
  const checkKeys = Object.keys(checks) as CheckKey[];
  const doneCount = checkKeys.filter(c => checks[c]).length;

  // ---- Barras fijas, sección activa y avance de lectura ----
  const [barsTop, setBarsTop] = useState(0);
  const [active, setActive] = useState('a');
  const [progress, setProgress] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const secbarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const measure = () => setBarsTop(appBarsBottom());
    measure();
    const id = window.setTimeout(measure, 600);
    window.addEventListener('resize', measure);
    return () => { window.clearTimeout(id); window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const line = appBarsBottom() + (secbarRef.current?.offsetHeight || 0) + 24;
        let current = NAV_IDS[0];
        for (const id of NAV_IDS) {
          const el = document.getElementById(`hiw-${id}`);
          if (el && el.getBoundingClientRect().top - line <= 4) current = id;
        }
        setActive(current);
        const body = bodyRef.current;
        if (body) {
          const r = body.getBoundingClientRect();
          const total = r.height - window.innerHeight + line;
          setProgress(Math.max(0, Math.min(1, total > 0 ? (line - r.top) / total : 0)));
        }
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  // En la barra móvil, la etapa activa queda a la vista.
  useEffect(() => {
    const bar = secbarRef.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-sec="${active}"]`);
    if (bar && chip) bar.scrollTo({ left: chip.offsetLeft - 16, behavior: 'smooth' });
  }, [active]);

  // ---- Plegado: en móvil las etapas empiezan cerradas ----
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set());
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set());
  const isOpen = (id: string) => !isMobile || openSecs.has(id);
  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const goTo = (id: string) => {
    if (SECTIONS.some(s => s.id === id)) setOpenSecs(prev => new Set(prev).add(id));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(`hiw-${id}`);
      if (!el) return;
      const offset = appBarsBottom() + (secbarRef.current?.offsetHeight || 0) + 12;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: reduce ? 'auto' : 'smooth' });
    }));
  };

  const linkFor = (s: Step): string | null => {
    if (role === 'doctor') return s.href(uid);
    if (role === 'admin' && s.adminHref) return s.adminHref;
    return s.doctorOnly ? null : s.href(uid);
  };

  const navLabel = (id: string) =>
    id === 'faq' ? k('faq.title') : id === 'avisos' ? k('notif.title') : k(`sections.${id}.title`);

  const statusChip = (c?: CheckKey) => {
    if (!c || checks[c] === undefined) return null;
    return checks[c]
      ? <span className="hiw-state is-done"><Check aria-hidden />{k('status.done')}</span>
      : <span className="hiw-state is-pending">{k('status.pending')}</span>;
  };

  const sectionHasCheck = useMemo(() => {
    const m: Record<string, boolean | undefined> = {};
    SECTIONS.forEach(sec => {
      const cs = sec.steps.map(s => s.check).filter(Boolean) as CheckKey[];
      const known = cs.filter(c => checks[c] !== undefined);
      if (known.length) m[sec.id] = known.every(c => checks[c]);
    });
    return m;
  }, [checks]);

  return (
    <MainLayout>
      <div className="pro-container pro-page hiw">
        {/* Cabecera */}
        <div className="pro-page-head hiw-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><MapIcon className="w-5 h-5" /><span>{k('title')}</span></h1>
            <p className="pro-page-sub">{k('subtitle')}</p>
          </div>
          <div className="hiw-lang" role="group" aria-label={k('langLabel')}>
            <Languages aria-hidden />
            {(['es', 'en'] as const).map(l => (
              <button key={l} type="button" className={language === l ? 'is-on' : ''} aria-pressed={language === l}
                onClick={() => { void setLanguage(l); }}>
                {l === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </div>
        </div>

        {/* Metro del recorrido */}
        <section className="pro-card hiw-metro" aria-labelledby="hiw-metro-t">
          <div className="hiw-metro-head">
            <div className="min-w-0">
              <h2 id="hiw-metro-t" className="hiw-h2">{k('metro.title')}</h2>
              <p className="hiw-muted">{k('metro.sub')}</p>
            </div>
            {isDoctor && checkKeys.length > 0 && (
              <div className="hiw-avance" aria-label={`${k('status.title')}: ${doneCount}/${checkKeys.length}`}>
                <span className="hiw-avance-label">{k('status.title')}</span>
                <span className="hiw-avance-num">{doneCount}/{checkKeys.length}</span>
                <span className="hiw-avance-bar"><span style={{ width: `${(doneCount / checkKeys.length) * 100}%` }} /></span>
              </div>
            )}
          </div>

          <ol className="hiw-line">
            {STATIONS.map(st => {
              const Icon = st.icon;
              const done = st.check ? checks[st.check] : undefined;
              return (
                <li key={st.id} className={`hiw-st hiw-st-${st.id}${st.branch ? ' is-branch' : ''}${done ? ' is-done' : ''}`}>
                  <button type="button" className="hiw-st-btn" onClick={() => goTo(st.sec)}
                    aria-label={`${k(`metro.stations.${st.id}`)} · ${k(`sections.${st.sec}.title`)}${done ? ` · ${k('status.done')}` : ''}`}>
                    <span className="hiw-st-label">{k(`metro.stations.${st.id}`)}</span>
                    <span className="hiw-st-dot">
                      <Icon aria-hidden />
                      {done && <span className="hiw-st-ok"><Check aria-hidden /></span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="hiw-legend" aria-hidden>
            <span><i className="hiw-legend-main" />{k('metro.legendMain')}</span>
            <span><i className="hiw-legend-branch" />{k('metro.legendBranch')}</span>
          </div>
        </section>

        {/* Barra de etapas fija (móvil) */}
        <nav ref={secbarRef} className="hiw-secbar" style={{ top: barsTop }} aria-label={k('index')}>
          {NAV_IDS.map(id => (
            <button key={id} type="button" data-sec={id} className={active === id ? 'is-on' : ''}
              aria-current={active === id ? 'true' : undefined} onClick={() => goTo(id)}>
              {SECTIONS.some(s => s.id === id) && <span className="hiw-letter hiw-letter-sm">{id.toUpperCase()}</span>}
              {navLabel(id)}
            </button>
          ))}
          <span className="hiw-secbar-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden />
        </nav>

        <div className="hiw-body" ref={bodyRef}>
          {/* Índice lateral (escritorio) */}
          <aside className="hiw-index" style={{ top: barsTop + 16 }}>
            <p className="hiw-index-title">{k('index')}</p>
            <div className="hiw-index-bar" role="progressbar" aria-label={k('progressLabel')}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <span style={{ transform: `scaleX(${progress})` }} />
            </div>
            <ol>
              {NAV_IDS.map(id => (
                <li key={id}>
                  <button type="button" className={active === id ? 'is-on' : ''} aria-current={active === id ? 'true' : undefined} onClick={() => goTo(id)}>
                    {SECTIONS.some(s => s.id === id)
                      ? <span className="hiw-letter hiw-letter-sm">{id.toUpperCase()}</span>
                      : <span className="hiw-letter hiw-letter-sm hiw-letter-soft">{id === 'faq' ? <HelpCircle aria-hidden /> : <Bell aria-hidden />}</span>}
                    <span className="hiw-index-name">{navLabel(id)}</span>
                    {sectionHasCheck[id] && <Check className="hiw-index-ok" aria-label={k('status.done')} />}
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          <div className="hiw-main">
            {SECTIONS.map(sec => {
              const open = isOpen(sec.id);
              const SecIcon = sec.icon;
              const head = (
                <>
                  <span className="hiw-letter hiw-letter-lg">{sec.id.toUpperCase()}</span>
                  <span className="hiw-sec-text">
                    <span className="hiw-sec-title">{k(`sections.${sec.id}.title`)}</span>
                    <span className="hiw-sec-sub">{k(`sections.${sec.id}.sub`)}</span>
                  </span>
                  <span className="hiw-sec-meta">
                    <SecIcon aria-hidden className="hiw-sec-icon" />
                    <span>{k('stepsCount').replace('{n}', String(sec.steps.length))}</span>
                    {isMobile && <ChevronDown aria-hidden className={`hiw-chev${open ? ' is-open' : ''}`} />}
                  </span>
                </>
              );
              return (
                <section key={sec.id} id={`hiw-${sec.id}`} className="pro-card hiw-sec" aria-labelledby={`hiw-${sec.id}-t`}>
                  <h2 id={`hiw-${sec.id}-t`} className="hiw-sec-h">
                    {isMobile ? (
                      <button type="button" className="hiw-sec-head" aria-expanded={open} aria-controls={`hiw-${sec.id}-steps`}
                        onClick={() => toggle(setOpenSecs, sec.id)}>{head}</button>
                    ) : (
                      <span className="hiw-sec-head">{head}</span>
                    )}
                  </h2>

                  <div id={`hiw-${sec.id}-steps`} className={`hiw-collapse${open ? ' is-open' : ''}`}>
                    <div className="hiw-collapse-inner">
                      <ol className="hiw-steps">
                        {sec.steps.map(s => {
                          const Icon = s.icon;
                          const more = openSteps.has(s.id);
                          const href = linkFor(s);
                          return (
                            <li key={s.id} className="hiw-step">
                              <span className="hiw-step-ico"><Icon aria-hidden /></span>
                              <div className="hiw-step-body">
                                <div className="hiw-step-top">
                                  <h3 className="hiw-step-title">{k(`steps.${s.id}.title`)}</h3>
                                  {isDoctor && statusChip(s.check)}
                                </div>
                                <p className="hiw-step-short">{k(`steps.${s.id}.short`)}</p>
                                <div className="hiw-step-foot">
                                  <span className="hiw-tag hiw-tag-doctor">{k('tags.doctor')}</span>
                                  <span className={`hiw-tag hiw-tag-${s.other}`}>{k(`tags.${s.other}`)}</span>
                                  <button type="button" className="hiw-more" aria-expanded={more} aria-controls={`hiw-${s.id}-more`}
                                    onClick={() => toggle(setOpenSteps, s.id)}>
                                    {more ? k('less') : k('more')}
                                    <ChevronDown aria-hidden className={`hiw-chev${more ? ' is-open' : ''}`} />
                                  </button>
                                </div>
                                <div id={`hiw-${s.id}-more`} className={`hiw-collapse${more ? ' is-open' : ''}`}>
                                  <div className="hiw-collapse-inner">
                                    <dl className="hiw-detail">
                                      <div><dt className="hiw-tag hiw-tag-doctor">{k('tags.doctor')}</dt><dd>{k(`steps.${s.id}.you`)}</dd></div>
                                      <div><dt className={`hiw-tag hiw-tag-${s.other}`}>{k(`tags.${s.other}`)}</dt><dd>{k(`steps.${s.id}.other`)}</dd></div>
                                      {href && (
                                        <Link to={href} className="hiw-go">{k('go')}<ArrowRight aria-hidden /></Link>
                                      )}
                                    </dl>
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  </div>
                </section>
              );
            })}

            {/* Avisos */}
            <section id="hiw-avisos" className="pro-card hiw-sec hiw-pad" aria-labelledby="hiw-avisos-t">
              <div className="hiw-sec-head hiw-sec-head-static">
                <span className="hiw-letter hiw-letter-lg"><Bell aria-hidden /></span>
                <div className="hiw-sec-text">
                  <h2 id="hiw-avisos-t" className="hiw-sec-title">{k('notif.title')}</h2>
                  <p className="hiw-sec-sub">{k('notif.sub')}</p>
                </div>
              </div>
              <ul className="hiw-chips">
                {NOTIF_KEYS.map(key => <li key={key}>{k(`notif.items.${key}`)}</li>)}
              </ul>
              <Link to="/notifications" className="hiw-go hiw-go-block">{k('notif.open')}<ArrowRight aria-hidden /></Link>
            </section>

            {/* Preguntas rápidas */}
            <section id="hiw-faq" className="pro-card hiw-sec hiw-pad" aria-labelledby="hiw-faq-t">
              <div className="hiw-sec-head hiw-sec-head-static">
                <span className="hiw-letter hiw-letter-lg"><HelpCircle aria-hidden /></span>
                <div className="hiw-sec-text">
                  <h2 id="hiw-faq-t" className="hiw-sec-title">{k('faq.title')}</h2>
                </div>
              </div>
              <div className="hiw-faq">
                {FAQ_KEYS.map(q => (
                  <details key={q} className="hiw-faq-item">
                    <summary>{k(`faq.items.${q}.q`)}<ChevronDown aria-hidden className="hiw-chev" /></summary>
                    <p>{k(`faq.items.${q}.a`)}</p>
                  </details>
                ))}
              </div>
            </section>

            <p className="hiw-foot">{k('rolesNote')}</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
