import React from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus, IdCard, PenLine, ScanFace, BadgeCheck,
  Stethoscope, Search, Send, MessageSquare, Eye,
  CalendarClock, Inbox, CheckCircle2, Video, ClipboardCheck,
  Users, FileText, FolderOpen, Pill, QrCode,
  Radio, PlayCircle, BookOpen, Star,
  MessagesSquare, Package, GraduationCap,
  Wallet, TrendingUp, Landmark, Receipt, Banknote,
  Bell, ChevronRight, Map as MapIcon, Languages,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { doctorHref } from '@/lib/doctorSections';
import '@/styles/como-funciona.css';

// «Cómo funciona» (Jose, 11-nov-2026): el recorrido del médico dentro de la
// plataforma, de punta a punta, en un diagrama por secciones. El contenido sale
// de las pantallas reales (rutas de App.tsx y secciones de doctorSections.ts).
// La ven médico, residente y administración; los enlaces que solo sirven al
// médico se ocultan para los otros roles.

type Who = 'patient' | 'resident' | 'team' | 'community';

interface Step {
  id: string;
  icon: React.ElementType;
  other: Who;
  /** Pantalla del médico. */
  href: (uid: string) => string;
  /** Si la pantalla es solo del médico, otros roles no ven el botón. */
  doctorOnly?: boolean;
  /** Pantalla equivalente para administración. */
  adminHref?: string;
}

interface Section {
  id: string;
  icon: React.ElementType;
  steps: Step[];
}

const finanzas = (f: string) => doctorHref('cuenta', { tab: 'finanzas', f });
const perfil = (b: string) => doctorHref('cuenta', { tab: 'perfil', b });

const SECTIONS: Section[] = [
  {
    id: 'a', icon: BadgeCheck, steps: [
      { id: 'a1', icon: UserPlus, other: 'team', href: () => perfil('identidad'), doctorOnly: true, adminHref: '/admin/users' },
      { id: 'a2', icon: IdCard, other: 'team', href: () => perfil('trayectoria'), doctorOnly: true, adminHref: '/admin/doctors' },
      { id: 'a3', icon: PenLine, other: 'team', href: () => perfil('identidad'), doctorOnly: true },
      { id: 'a4', icon: ScanFace, other: 'team', href: () => '/verify-identity', doctorOnly: true, adminHref: '/admin/verifications' },
      { id: 'a5', icon: BadgeCheck, other: 'team', href: () => '/verification-pending', doctorOnly: true, adminHref: '/admin/doctors' },
    ],
  },
  {
    id: 'b', icon: Stethoscope, steps: [
      { id: 'b1', icon: Stethoscope, other: 'patient', href: () => perfil('servicios'), doctorOnly: true },
      { id: 'b2', icon: Search, other: 'patient', href: () => '/doctors' },
      { id: 'b3', icon: Send, other: 'patient', href: () => doctorHref('pacientes'), doctorOnly: true },
      { id: 'b4', icon: MessageSquare, other: 'patient', href: () => '/chat' },
      { id: 'b5', icon: Eye, other: 'patient', href: (uid) => `/doctor/${uid}`, doctorOnly: true },
    ],
  },
  {
    id: 'c', icon: CalendarClock, steps: [
      { id: 'c1', icon: CalendarClock, other: 'patient', href: () => doctorHref('agenda', { tab: 'disponibilidad' }), doctorOnly: true },
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
      { id: 'g3', icon: Landmark, other: 'team', href: () => finanzas('banco'), doctorOnly: true },
      { id: 'g4', icon: Receipt, other: 'team', href: () => finanzas('facturas'), doctorOnly: true, adminHref: '/admin/invoices' },
      { id: 'g5', icon: Banknote, other: 'team', href: () => finanzas('movimientos'), doctorOnly: true, adminHref: '/admin/payouts' },
    ],
  },
];

const NOTIF_KEYS = ['chat', 'appointment', 'messages', 'payouts', 'community', 'meetings', 'refunds', 'moderation'];

export default function ComoFunciona() {
  const { user, role } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const k = (key: string) => t(`howItWorks.${key}`);
  const uid = user?.id || '';

  const linkFor = (s: Step): string | null => {
    if (role === 'doctor') return s.href(uid);
    if (role === 'admin' && s.adminHref) return s.adminHref;
    return s.doctorOnly ? null : s.href(uid);
  };

  let n = 0;

  return (
    <MainLayout>
      <div className="pro-container pro-page hiw">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title">
              <MapIcon className="w-5 h-5" />
              <span>{k('title')}</span>
            </h1>
            <p className="pro-page-sub">{k('subtitle')}</p>
          </div>
          <div className="hiw-lang" role="group" aria-label={k('langLabel')}>
            <Languages className="w-4 h-4" aria-hidden />
            {(['es', 'en'] as const).map(l => (
              <button
                key={l}
                type="button"
                className={language === l ? 'is-on' : ''}
                aria-pressed={language === l}
                onClick={() => { void setLanguage(l); }}
              >
                {l === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </div>
        </div>

        {/* Mapa: las siete etapas en orden */}
        <nav className="pro-card hiw-map" aria-label={k('mapTitle')}>
          <p className="hiw-map-title">{k('mapTitle')}</p>
          <ol className="hiw-map-list">
            {SECTIONS.map(sec => (
              <li key={sec.id}>
                <a href={`#hiw-${sec.id}`} className="hiw-map-item">
                  <span className="hiw-letter">{sec.id.toUpperCase()}</span>
                  <span className="hiw-map-name">{k(`sections.${sec.id}.title`)}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {SECTIONS.map(sec => (
          <section key={sec.id} id={`hiw-${sec.id}`} className="pro-card hiw-sec" aria-labelledby={`hiw-${sec.id}-t`}>
            <header className="hiw-sec-head">
              <span className="hiw-letter hiw-letter-lg">{sec.id.toUpperCase()}</span>
              <div className="min-w-0">
                <h2 id={`hiw-${sec.id}-t`} className="hiw-sec-title">{k(`sections.${sec.id}.title`)}</h2>
                <p className="hiw-sec-sub">{k(`sections.${sec.id}.sub`)}</p>
              </div>
            </header>

            <ol className="hiw-flow">
              {sec.steps.map((s, i) => {
                n += 1;
                const href = linkFor(s);
                const Icon = s.icon;
                return (
                  <li key={s.id} className="hiw-step">
                    <div className="hiw-node">
                      <div className="hiw-node-top">
                        <span className="hiw-num" aria-label={`${k('stepLabel')} ${n}`}>{n}</span>
                        <span className="hiw-ico"><Icon aria-hidden /></span>
                      </div>
                      <h3 className="hiw-node-title">{k(`steps.${s.id}.title`)}</h3>
                      <div className="hiw-lane hiw-lane-you">
                        <span className="hiw-who">{k('who.you')}</span>
                        <p>{k(`steps.${s.id}.you`)}</p>
                      </div>
                      <div className={`hiw-lane hiw-lane-${s.other}`}>
                        <span className="hiw-who">{k(`who.${s.other}`)}</span>
                        <p>{k(`steps.${s.id}.other`)}</p>
                      </div>
                      {href && (
                        <Link to={href} className="pro-btn pro-btn-teal pro-btn-sm hiw-go">
                          {k('open')} <ChevronRight aria-hidden />
                        </Link>
                      )}
                    </div>
                    {i < sec.steps.length - 1 && <span className="hiw-conn" aria-hidden />}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

        <section className="pro-card hiw-sec hiw-notif" aria-labelledby="hiw-notif-t">
          <header className="hiw-sec-head">
            <span className="hiw-letter hiw-letter-lg"><Bell aria-hidden /></span>
            <div className="min-w-0">
              <h2 id="hiw-notif-t" className="hiw-sec-title">{k('notif.title')}</h2>
              <p className="hiw-sec-sub">{k('notif.sub')}</p>
            </div>
          </header>
          <ul className="hiw-chips">
            {NOTIF_KEYS.map(key => <li key={key}>{k(`notif.items.${key}`)}</li>)}
          </ul>
          <Link to="/notifications" className="pro-btn pro-btn-teal pro-btn-sm hiw-go hiw-go-inline">
            {k('notif.open')} <ChevronRight aria-hidden />
          </Link>
        </section>

        <p className="hiw-foot">{k('rolesNote')}</p>
      </div>
    </MainLayout>
  );
}
