// Arquitectura de información del médico como DATOS (11-sep-2026).
//
// Una sola fuente para el menú, las pestañas y los enlaces: Inicio · Agenda ·
// Pacientes · Comunidad · Aprendizaje · Contenido · Cuenta, más el Chat, que es
// un icono global de la cabecera y no una sección.
//
// Nadie vuelve a escribir a mano "/doctor/agenda?tab=consultas": se pide con
// doctorHref('agenda', { tab: 'consultas' }).
import {
  BadgeCheck, BarChart3, Bell, BookOpen, Briefcase, CalendarDays, CalendarRange, ClipboardList,
  Clock, Coins, Compass, CreditCard, FileText, Film, FolderOpen, GraduationCap, HeartPulse,
  History, Home, Hospital, Landmark, LayoutList, Library, Languages, ListOrdered, Lock,
  MessageCircle, MessagesSquare, Percent, Pill, PlaySquare, PlusCircle, Presentation, Radio,
  Receipt, Rss, Shield, ShoppingBag, ShoppingCart, Stethoscope, TrendingUp, Upload, User, Users,
  Video, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type DoctorSectionId =
  | 'inicio' | 'agenda' | 'pacientes' | 'comunidad' | 'aprendizaje' | 'contenido' | 'cuenta';

/** Valor admitido por un parámetro secundario de una pestaña (ver, crear, b, f). */
export interface DoctorTabOption {
  id: string;
  labelKey: string;
  icon?: LucideIcon;
  /** Clave i18n del grupo al que pertenece (Finanzas: Comprar / Cobrar) */
  groupKey?: string;
}

export interface DoctorTab {
  id: string;
  labelKey: string;
  icon?: LucideIcon;
  /** Parámetro extra que admite la pestaña, p. ej. `ver` en Comunidad > Descubrir */
  paramName?: string;
  options?: DoctorTabOption[];
}

export interface DoctorSection {
  id: DoctorSectionId;
  path: string;
  labelKey: string;
  icon: LucideIcon;
  /** Nombre del parámetro de pestaña en la URL ('tab' en casi todas, 's' en Cuenta) */
  tabParam?: string;
  defaultTab?: string;
  tabs?: DoctorTab[];
  /** Rutas que iluminan la sección en el menú (prefijos) */
  matchPaths: string[];
}

/** Chat: acceso global persistente en la cabecera, no una sección del menú. */
export const DOCTOR_CHAT = {
  path: '/chat',
  labelKey: 'mm2.common.nav.chat',
  icon: MessageCircle as LucideIcon,
};

export const DOCTOR_SECTIONS: DoctorSection[] = [
  {
    id: 'inicio',
    path: '/doctor/dashboard',
    labelKey: 'mm2.common.nav.inicio',
    icon: Home,
    matchPaths: ['/doctor/dashboard'],
  },
  {
    id: 'agenda',
    path: '/doctor/agenda',
    labelKey: 'mm2.common.nav.agenda',
    icon: CalendarDays,
    tabParam: 'tab',
    defaultTab: 'calendario',
    tabs: [
      { id: 'calendario', labelKey: 'mm2.common.tabs.agenda.calendario', icon: CalendarRange },
      { id: 'consultas', labelKey: 'mm2.common.tabs.agenda.consultas', icon: Stethoscope },
      { id: 'disponibilidad', labelKey: 'mm2.common.tabs.agenda.disponibilidad', icon: Clock },
      { id: 'reuniones', labelKey: 'mm2.common.tabs.agenda.reuniones', icon: Video },
    ],
    // /clinical-sessions son reuniones entre médicos (tabla clinical_sessions), no casos clínicos.
    matchPaths: ['/doctor/agenda', '/doctor/consultations', '/doctor/availability', '/meetings', '/my-appointments', '/clinical-sessions'],
  },
  {
    id: 'pacientes',
    path: '/doctor/patients',
    labelKey: 'mm2.common.nav.pacientes',
    icon: Users,
    tabParam: 'tab',
    defaultTab: 'resumen',
    // Estas pestañas son las de la FICHA (/doctor/patients/:patientId)
    tabs: [
      { id: 'resumen', labelKey: 'mm2.common.tabs.paciente.resumen', icon: LayoutList },
      { id: 'historial', labelKey: 'mm2.common.tabs.paciente.historial', icon: History },
      { id: 'consultas', labelKey: 'mm2.common.tabs.paciente.consultas', icon: Stethoscope },
      { id: 'documentos', labelKey: 'mm2.common.tabs.paciente.documentos', icon: FileText },
      { id: 'recetas', labelKey: 'mm2.common.tabs.paciente.recetas', icon: Pill },
      { id: 'agenda', labelKey: 'mm2.common.tabs.paciente.agenda', icon: CalendarDays },
    ],
    matchPaths: ['/doctor/patients', '/doctor/vault', '/prescriptions'],
  },
  {
    id: 'comunidad',
    path: '/foro',
    labelKey: 'mm2.common.nav.comunidad',
    icon: MessagesSquare,
    tabParam: 'tab',
    defaultTab: 'feed',
    tabs: [
      { id: 'feed', labelKey: 'mm2.common.tabs.comunidad.feed', icon: Rss },
      {
        id: 'descubrir',
        labelKey: 'mm2.common.tabs.comunidad.descubrir',
        icon: Compass,
        paramName: 'ver',
        options: [
          { id: 'medicos', labelKey: 'mm2.common.tabs.comunidad.ver.medicos', icon: Stethoscope },
          { id: 'hospitales', labelKey: 'mm2.common.tabs.comunidad.ver.hospitales', icon: Hospital },
        ],
      },
    ],
    matchPaths: ['/foro', '/doctors', '/hospital-locator'],
  },
  {
    id: 'aprendizaje',
    path: '/education',
    labelKey: 'mm2.common.nav.aprendizaje',
    icon: GraduationCap,
    tabParam: 'tab',
    defaultTab: 'cursos',
    tabs: [
      { id: 'cursos', labelKey: 'mm2.common.tabs.aprendizaje.cursos', icon: BookOpen },
      { id: 'casos', labelKey: 'mm2.common.tabs.aprendizaje.casos', icon: ClipboardList },
      { id: 'masterclass', labelKey: 'mm2.common.tabs.aprendizaje.masterclass', icon: Presentation },
      { id: 'materiales', labelKey: 'mm2.common.tabs.aprendizaje.materiales', icon: FolderOpen },
    ],
    matchPaths: ['/education'],
  },
  {
    id: 'contenido',
    path: '/contenido',
    labelKey: 'mm2.common.nav.contenido',
    icon: PlaySquare,
    tabParam: 'tab',
    defaultTab: 'explorar',
    tabs: [
      { id: 'explorar', labelKey: 'mm2.common.tabs.contenido.explorar', icon: Compass },
      { id: 'lives', labelKey: 'mm2.common.tabs.contenido.lives', icon: Radio },
      { id: 'publicaciones', labelKey: 'mm2.common.tabs.contenido.publicaciones', icon: FileText },
      { id: 'grabaciones', labelKey: 'mm2.common.tabs.contenido.grabaciones', icon: Film },
      {
        id: 'crear',
        labelKey: 'mm2.common.tabs.contenido.crear',
        icon: PlusCircle,
        paramName: 'crear',
        options: [
          { id: 'subir', labelKey: 'mm2.common.tabs.contenido.crearOpciones.subir', icon: Upload },
          { id: 'live', labelKey: 'mm2.common.tabs.contenido.crearOpciones.live', icon: Radio },
          { id: 'libros', labelKey: 'mm2.common.tabs.contenido.crearOpciones.libros', icon: BookOpen },
        ],
      },
      { id: 'colecciones', labelKey: 'mm2.common.tabs.contenido.colecciones', icon: Library },
      { id: 'ventas', labelKey: 'mm2.common.tabs.contenido.ventas', icon: ShoppingBag },
      { id: 'estadisticas', labelKey: 'mm2.common.tabs.contenido.estadisticas', icon: BarChart3 },
    ],
    matchPaths: [
      '/contenido', '/lives', '/live', '/recordings', '/recording', '/content',
      '/doctor/content', '/doctor/recordings', '/doctor/upload', '/doctor/books', '/doctor/go-live',
    ],
  },
  {
    id: 'cuenta',
    path: '/settings',
    labelKey: 'mm2.common.nav.cuenta',
    icon: User,
    tabParam: 's',
    defaultTab: 'perfil',
    tabs: [
      {
        id: 'perfil',
        labelKey: 'mm2.common.tabs.cuenta.perfil',
        icon: BadgeCheck,
        paramName: 'b',
        options: [
          { id: 'identidad', labelKey: 'mm2.common.tabs.cuenta.perfilBloques.identidad', icon: BadgeCheck },
          { id: 'trayectoria', labelKey: 'mm2.common.tabs.cuenta.perfilBloques.trayectoria', icon: Briefcase },
          { id: 'servicios', labelKey: 'mm2.common.tabs.cuenta.perfilBloques.servicios', icon: Stethoscope },
          { id: 'contenido', labelKey: 'mm2.common.tabs.cuenta.perfilBloques.contenido', icon: Coins },
        ],
      },
      { id: 'seguridad', labelKey: 'mm2.common.tabs.cuenta.seguridad', icon: Shield },
      { id: 'notificaciones', labelKey: 'mm2.common.tabs.cuenta.notificaciones', icon: Bell },
      { id: 'idioma', labelKey: 'mm2.common.tabs.cuenta.idioma', icon: Languages },
      { id: 'privacidad', labelKey: 'mm2.common.tabs.cuenta.privacidad', icon: Lock },
      {
        id: 'finanzas',
        labelKey: 'mm2.common.tabs.cuenta.finanzas',
        icon: Wallet,
        paramName: 'f',
        options: [
          { id: 'wallet', labelKey: 'mm2.common.tabs.cuenta.finanzasOpciones.wallet', icon: Wallet, groupKey: 'mm2.common.tabs.cuenta.finanzasGrupos.comprar' },
          { id: 'recargas', labelKey: 'mm2.common.tabs.cuenta.finanzasOpciones.recargas', icon: CreditCard, groupKey: 'mm2.common.tabs.cuenta.finanzasGrupos.comprar' },
          { id: 'compras', labelKey: 'mm2.common.tabs.cuenta.finanzasOpciones.compras', icon: ShoppingCart, groupKey: 'mm2.common.tabs.cuenta.finanzasGrupos.comprar' },
          { id: 'suscripciones', labelKey: 'mm2.common.tabs.cuenta.finanzasOpciones.suscripciones', icon: Rss, groupKey: 'mm2.common.tabs.cuenta.finanzasGrupos.comprar' },
          { id: 'ingresos', labelKey: 'mm2.common.tabs.cuenta.finanzasOpciones.ingresos', icon: TrendingUp, groupKey: 'mm2.common.tabs.cuenta.finanzasGrupos.cobrar' },
          { id: 'comisiones', labelKey: 'mm2.common.tabs.cuenta.finanzasOpciones.comisiones', icon: Percent, groupKey: 'mm2.common.tabs.cuenta.finanzasGrupos.cobrar' },
          { id: 'pendientes', labelKey: 'mm2.common.tabs.cuenta.finanzasOpciones.pendientes', icon: Clock, groupKey: 'mm2.common.tabs.cuenta.finanzasGrupos.cobrar' },
          { id: 'suscriptores', labelKey: 'mm2.common.tabs.cuenta.finanzasOpciones.suscriptores', icon: Users, groupKey: 'mm2.common.tabs.cuenta.finanzasGrupos.cobrar' },
          { id: 'banco', labelKey: 'mm2.common.tabs.cuenta.finanzasOpciones.banco', icon: Landmark, groupKey: 'mm2.common.tabs.cuenta.finanzasGrupos.cobrar' },
          { id: 'facturas', labelKey: 'mm2.common.tabs.cuenta.finanzasOpciones.facturas', icon: Receipt, groupKey: 'mm2.common.tabs.cuenta.finanzasGrupos.cobrar' },
          { id: 'movimientos', labelKey: 'mm2.common.tabs.cuenta.finanzasOpciones.movimientos', icon: ListOrdered, groupKey: 'mm2.common.tabs.cuenta.finanzasGrupos.cobrar' },
        ],
      },
      { id: 'historial', labelKey: 'mm2.common.tabs.cuenta.historial', icon: HeartPulse },
    ],
    matchPaths: [
      '/settings', '/profile', '/wallet', '/notifications', '/medical-record', '/verify-identity',
      '/my-orders', '/my-books', '/doctor/earnings', '/doctor/invoices', '/doctor/bank-account',
      '/doctor/subscribers', '/doctor/email-history',
    ],
  },
];

export const DOCTOR_SECTION_IDS = DOCTOR_SECTIONS.map(s => s.id);

export const DOCTOR_SECTION_BY_ID = DOCTOR_SECTIONS.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {} as Record<DoctorSectionId, DoctorSection>);

export type HrefParams = Record<string, string | number | null | undefined>;

const query = (params: [string, string][]) =>
  params.length ? `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}` : '';

/**
 * Enlace a una sección del médico.
 *   doctorHref('agenda', { tab: 'consultas', nueva: 'consulta' })
 *     → /doctor/agenda?tab=consultas&nueva=consulta
 *   doctorHref('cuenta', { tab: 'finanzas', f: 'wallet' })
 *     → /settings?s=finanzas&f=wallet   (la pestaña usa el parámetro de la sección)
 *   doctorHref('pacientes', { patientId: 'uuid', tab: 'documentos' })
 *     → /doctor/patients/uuid?tab=documentos
 */
export function doctorHref(section: DoctorSectionId, params?: HrefParams): string {
  const def = DOCTOR_SECTION_BY_ID[section];
  if (!def) return '/';
  let path = def.path;
  const entries: [string, string][] = [];
  const source = { ...(params || {}) };

  if (section === 'pacientes' && source.patientId) {
    path = `${def.path}/${String(source.patientId)}`;
  }
  delete source.patientId;

  const tabParam = def.tabParam || 'tab';
  if (source.tab !== undefined && source.tab !== null && source.tab !== '') {
    entries.push([tabParam, String(source.tab)]);
    delete source.tab;
  }

  Object.entries(source).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (k === tabParam && entries.some(([ek]) => ek === tabParam)) return;
    entries.push([k, String(v)]);
  });

  return `${path}${query(entries)}`;
}

/** Ficha del paciente: /doctor/patients/:patientId?tab=… */
export function doctorPatientHref(patientId: string, tab?: string, extra?: HrefParams): string {
  return doctorHref('pacientes', { patientId, tab, ...(extra || {}) });
}

/** Sección que debe iluminarse para una ruta (null si no es del área del médico). */
export function doctorSectionForPath(pathname: string): DoctorSectionId | null {
  const path = (pathname || '').replace(/\/+$/, '') || '/';
  let best: { id: DoctorSectionId; len: number } | null = null;
  for (const section of DOCTOR_SECTIONS) {
    for (const p of section.matchPaths) {
      if (path === p || path.startsWith(`${p}/`)) {
        if (!best || p.length > best.len) best = { id: section.id, len: p.length };
      }
    }
  }
  return best?.id ?? null;
}

export interface DoctorLegacyRedirect {
  /** Ruta antigua (exacta) */
  from: string;
  /** Destino; si es función, recibe los parámetros de la ruta antigua */
  to: string | ((search: URLSearchParams, pathname: string) => string);
  /** true = solo se redirige cuando el rol es médico; el resto sigue en la ruta antigua */
  doctorOnly: boolean;
}

/**
 * Rutas antiguas que deben seguir funcionando. Las implementa el integrador en
 * App.tsx: ninguna se borra, todas llevan a su sitio nuevo conservando lo que
 * traían (fecha, hora, paciente, vista…).
 */
export const DOCTOR_LEGACY_REDIRECTS: DoctorLegacyRedirect[] = [
  {
    from: '/doctor/consultations',
    to: s => doctorHref('agenda', { tab: 'consultas', nueva: s.get('nueva'), fecha: s.get('fecha'), hora: s.get('hora') }),
    doctorOnly: false,
  },
  {
    from: '/doctor/availability',
    to: s => {
      const nueva = s.get('nueva');
      // ?nueva=consulta abría el editor de horarios: ahora abre Nueva consulta.
      if (nueva === 'consulta') {
        return doctorHref('agenda', { tab: 'consultas', nueva: 'consulta', fecha: s.get('fecha'), hora: s.get('hora'), paciente: s.get('paciente') });
      }
      return doctorHref('agenda', { tab: 'disponibilidad', nueva, fecha: s.get('fecha'), hora: s.get('hora') });
    },
    doctorOnly: false,
  },
  { from: '/meetings', to: () => doctorHref('agenda', { tab: 'reuniones' }), doctorOnly: true },
  { from: '/my-appointments', to: () => doctorHref('agenda', { tab: 'consultas' }), doctorOnly: true },
  {
    from: '/doctor/vault',
    to: s => {
      const patient = s.get('patient');
      return patient ? doctorPatientHref(patient, 'documentos') : doctorHref('pacientes');
    },
    doctorOnly: false,
  },
  { from: '/doctor/content', to: () => doctorHref('contenido', { tab: 'publicaciones' }), doctorOnly: false },
  // ?tab=lives-pasados (enlace antiguo) sobrevive como ?sub= dentro del hub de Contenido.
  { from: '/doctor/recordings', to: s => doctorHref('contenido', { tab: 'grabaciones', sub: s.get('tab') === 'lives-pasados' ? 'lives-pasados' : null }), doctorOnly: false },
  { from: '/doctor/upload', to: () => doctorHref('contenido', { tab: 'crear', crear: 'subir' }), doctorOnly: false },
  { from: '/doctor/books', to: () => doctorHref('contenido', { tab: 'crear', crear: 'libros' }), doctorOnly: false },
  { from: '/lives', to: s => doctorHref('contenido', { tab: 'lives', vista: s.get('vista') }), doctorOnly: true },
  { from: '/recordings', to: () => doctorHref('contenido', { tab: 'explorar' }), doctorOnly: true },
  { from: '/wallet', to: () => doctorHref('cuenta', { tab: 'finanzas', f: 'wallet' }), doctorOnly: true },
  { from: '/wallet/ledger', to: () => doctorHref('cuenta', { tab: 'finanzas', f: 'movimientos' }), doctorOnly: true },
  { from: '/doctor/earnings', to: () => doctorHref('cuenta', { tab: 'finanzas', f: 'ingresos' }), doctorOnly: false },
  { from: '/doctor/invoices', to: () => doctorHref('cuenta', { tab: 'finanzas', f: 'facturas' }), doctorOnly: false },
  { from: '/doctor/bank-account', to: () => doctorHref('cuenta', { tab: 'finanzas', f: 'banco' }), doctorOnly: false },
  { from: '/doctor/subscribers', to: () => doctorHref('cuenta', { tab: 'finanzas', f: 'suscriptores' }), doctorOnly: false },
  { from: '/my-books', to: () => doctorHref('cuenta', { tab: 'finanzas', f: 'compras' }), doctorOnly: true },
  { from: '/my-orders', to: () => doctorHref('cuenta', { tab: 'finanzas', f: 'compras' }), doctorOnly: true },
  { from: '/doctors', to: () => doctorHref('comunidad', { tab: 'descubrir', ver: 'medicos' }), doctorOnly: true },
  { from: '/hospital-locator', to: () => doctorHref('comunidad', { tab: 'descubrir', ver: 'hospitales' }), doctorOnly: true },
  { from: '/profile', to: () => doctorHref('cuenta', { tab: 'perfil' }), doctorOnly: true },
];

/**
 * Destino nuevo de una ruta antigua, o null si esa ruta no se redirige.
 * `isDoctor` decide las que solo cambian para el médico.
 */
export function resolveDoctorLegacyRedirect(
  pathname: string,
  search: string | URLSearchParams,
  isDoctor: boolean,
): string | null {
  const path = (pathname || '').replace(/\/+$/, '') || '/';
  const rule = DOCTOR_LEGACY_REDIRECTS.find(r => r.from === path);
  if (!rule) return null;
  if (rule.doctorOnly && !isDoctor) return null;
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  return typeof rule.to === 'function' ? rule.to(params, path) : rule.to;
}
