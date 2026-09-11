// SEO de medical-masters.com — núcleo único: rutas, configuración y salida (<head>, robots, sitemap).
//
// Un solo fichero SIN imports a propósito. Lo usan tres entornos que tienen que calcular
// exactamente lo mismo:
//   · la función de Supabase `seo-meta` (Deno)          → import '../_shared/seo-render.ts'
//   · `middleware.ts` de Vercel (Edge)                   → import sin extensión
//   · el panel `/admin/seo` y `SeoRouteSync` (navegador) → vía src/lib/seo.ts
// Deno exige la extensión .ts en los imports relativos y el empaquetador Edge de Vercel no
// la acepta («referencing unsupported modules»): con un único fichero no hay ninguno.
//
// La configuración la edita el súper admin y se guarda en site_settings id='seo_config'.
// Los valores por defecto reproducen el <head> que tenía index.html antes del panel,
// así que desplegar esto sin tocar nada no cambia lo que ve Google.

export const SITE_URL = 'https://medical-masters.com';
export const SEO_SETTINGS_ID = 'seo_config';

export type EntityType = 'doctor' | 'live' | 'recording' | 'news' | 'congress';

/** Campos que se pueden fijar a mano para una URL concreta. Vacío = automático. */
export interface SeoFields {
  title?: string;
  /** true = el título se usa tal cual, sin la plantilla «{titulo} | {sitio}». */
  ignoreTemplate?: boolean;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonical?: string;
  /** undefined = hereda (de la página o del tipo de contenido). */
  index?: boolean;
  sitemap?: boolean;
}

export interface SeoTypeConfig {
  titleTemplate: string;
  descriptionTemplate: string;
  index: boolean;
  sitemap: boolean;
  /** Usar la foto del médico / miniatura / portada como imagen al compartir. */
  useContentImage: boolean;
  /** Añadir datos estructurados (schema.org) a cada página de este tipo. */
  structuredData: boolean;
}

export interface SeoConfig {
  version: 1;
  site: {
    name: string;
    titleTemplate: string;
    homeTitle: string;
    defaultDescription: string;
    keywords: string;
    locale: string;
    twitterSite: string;
    faviconUrl: string;
    ogImageUrl: string;
    ogImageWidth: number;
    ogImageHeight: number;
  };
  pages: Record<string, SeoFields>;
  types: Record<EntityType, SeoTypeConfig>;
  indexing: { robotsExtra: string };
  verification: { google: string; bing: string; yandex: string; pinterest: string; facebook: string };
  organization: {
    type: 'MedicalOrganization' | 'Organization';
    name: string;
    alternateName: string;
    description: string;
    logoUrl: string;
    email: string;
    phone: string;
    areaServed: string;
    medicalSpecialty: string[];
    sameAs: string[];
    searchAction: boolean;
  };
  updatedAt?: string;
}

export interface PublicPage {
  path: string;
  label: string;
  group: string;
  title: string;
  description?: string;
  /** El título ya lleva la marca: no se le añade la plantilla. */
  ignoreTemplate?: boolean;
}

export const DEFAULT_ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1';
export const DEFAULT_ROBOTS_NOINDEX = 'noindex, nofollow, noarchive, nosnippet, noimageindex';

const HOME_TITLE = 'Medical Masters | Plataforma de Médicos Especialistas Certificados';
const HOME_DESCRIPTION =
  'Plataforma médica internacional de especialistas certificados. Análisis en vivo, Lives Quirúrgicos, consultas presenciales y digitales y expediente clínico seguro.';

// Títulos y descripciones sacados del propio titular de cada página (lib/i18n/es.ts):
// no se inventa ningún texto, solo se reutiliza el que la web ya enseña.
export const PUBLIC_PAGES: PublicPage[] = [
  { path: '/', label: 'Inicio', group: 'Principal', title: HOME_TITLE, description: HOME_DESCRIPTION, ignoreTemplate: true },
  { path: '/app', label: 'Entrar a la plataforma', group: 'Principal', title: '¿Cómo quieres entrar?', description: 'Selecciona tu rol para acceder a la plataforma' },
  { path: '/login', label: 'Iniciar sesión', group: 'Principal', title: 'Iniciar sesión' },
  { path: '/doctors', label: 'Directorio de médicos', group: 'Directorios', title: 'Explorar doctores', description: 'Encuentra y sigue a los mejores especialistas médicos' },
  { path: '/psicologia', label: 'Psicología', group: 'Directorios', title: 'Directorio de Psicología', description: 'Encuentra especialistas en salud mental y bienestar emocional' },
  { path: '/nutricion', label: 'Nutrición', group: 'Directorios', title: 'Directorio de Nutrición', description: 'Encuentra especialistas en nutrición y bienestar' },
  { path: '/emergency', label: 'Atención inmediata', group: 'Directorios', title: 'Atención inmediata', description: 'Doctores disponibles ahora mismo para orientación médica' },
  { path: '/hospital-locator', label: 'Localiza un hospital', group: 'Directorios', title: 'Localiza un hospital', description: 'Directorio de hospitales y clínicas en México' },
  { path: '/lives', label: 'Lives', group: 'Contenido', title: 'Lives: ahora en directo' },
  { path: '/recordings', label: 'Contenido Premium', group: 'Contenido', title: 'Contenido Premium' },
  { path: '/content', label: 'Biblioteca de contenido', group: 'Contenido', title: 'Biblioteca de contenido' },
  { path: '/news', label: 'Noticias médicas', group: 'Contenido', title: 'Noticias médicas', description: 'Últimas noticias e innovaciones médicas' },
  { path: '/eventos', label: 'Eventos', group: 'Contenido', title: 'Eventos y convocatorias', description: 'Agenda simple compartida por la comunidad. Médicos verificados pueden publicar congresos, simposios, fellowships y convocatorias.' },
  { path: '/congresos', label: 'Congresos', group: 'Contenido', title: 'Congresos', description: 'Series de conferencias de varios doctores: síguelas en vivo y revive las grabaciones.' },
  { path: '/for-doctors', label: 'Para médicos', group: 'Para quién', title: 'Únete a la red global de médicos VIP', description: 'Únete a la plataforma líder de telemedicina y conecta con pacientes de todo el país mientras generas ingresos adicionales.' },
  { path: '/for-patients', label: 'Para pacientes', group: 'Para quién', title: 'Tu salud, nuestra prioridad', description: 'Accede a los mejores especialistas médicos desde cualquier lugar. Obtén orientación médica, segundas opiniones y contenido educativo de calidad.' },
  { path: '/for-residents', label: 'Para residentes', group: 'Para quién', title: 'Potencia tu formación médica', description: 'Únete a la comunidad académica más grande de residentes médicos. Aprende, colabora y crece profesionalmente.' },
  { path: '/enterprise', label: 'Empresas', group: 'Para quién', title: 'Salud corporativa de clase mundial', description: 'Potencia el bienestar de tu equipo con nuestra plataforma de telemedicina diseñada para empresas.' },
  { path: '/advertising', label: 'Publicidad', group: 'Para quién', title: 'Publicita en Medical Masters', ignoreTemplate: true, description: 'Llega a miles de profesionales de la salud y pacientes con banners inteligentes, segmentados y medibles.' },
  { path: '/success-stories', label: 'Casos de éxito', group: 'Para quién', title: 'Historias que inspiran', description: 'Conoce cómo médicos y pacientes están transformando la atención médica con nuestra plataforma.' },
  { path: '/contact', label: 'Contacto', group: 'Ayuda y contacto', title: 'Contacto', description: 'Estamos aquí para ayudarte. Envíanos un mensaje y te responderemos lo antes posible.' },
  { path: '/help', label: 'Centro de ayuda', group: 'Ayuda y contacto', title: '¿Cómo podemos ayudarte?', description: 'Encuentra respuestas a tus preguntas o contacta a nuestro equipo de soporte.' },
  { path: '/report-issue', label: 'Reportar un problema', group: 'Ayuda y contacto', title: 'Reportar un problema' },
  { path: '/terms', label: 'Términos', group: 'Legal', title: 'Términos y condiciones' },
  { path: '/privacy', label: 'Aviso de privacidad', group: 'Legal', title: 'Aviso de privacidad' },
  { path: '/codigo-etica', label: 'Código de ética', group: 'Legal', title: 'Código de ética' },
  { path: '/security', label: 'Seguridad', group: 'Legal', title: 'Tu seguridad es nuestra prioridad', description: 'Protegemos tu información médica con los más altos estándares de seguridad de la industria.' },
  { path: '/compliance', label: 'Cumplimiento', group: 'Legal', title: 'Cumplimiento normativo', description: 'Nos adherimos a los más altos estándares regulatorios en cada jurisdicción donde operamos.' },
  { path: '/dmca', label: 'Protección DMCA', group: 'Legal', title: 'Protección DMCA' },
  { path: '/arco', label: 'Derechos ARCO', group: 'Legal', title: 'Derechos ARCO' },
];

/** Rutas que en App.tsx solo redirigen a otra: se canonicalizan a su destino. */
export const ALIASES: Record<string, string> = {
  '/doctores': '/doctors',
  '/events': '/eventos',
  '/congresses': '/congresos',
  '/psychology': '/psicologia',
  '/nutrition': '/nutricion',
  '/emergencia': '/emergency',
};

// Zona privada de la app (sesión, pagos, expediente, paneles). Nunca indexable,
// diga lo que diga la configuración: el panel ni siquiera deja personalizarla.
export const PRIVATE_PREFIXES = [
  '/admin', '/doctor/', '/wallet', '/chat', '/badge-chat', '/profile', '/verify-identity',
  '/resident-groups', '/medical-history', '/medical-record', '/vault', '/education',
  '/clinical-sessions', '/meetings', '/foro', '/marketplace', '/medical-supplies',
  '/my-orders', '/my-books', '/order-success', '/my-appointments', '/double-check',
  '/settings', '/book/', '/vendor/', '/verification-pending', '/reset-password',
  '/onboarding', '/notifications', '/video-call', '/prescriptions', '/verificar-receta',
  '/email-confirmed', '/advertiser/', '/access-denied',
];

export interface EntityTypeInfo {
  type: EntityType;
  label: string;
  singular: string;
  prefix: string;
  pattern: RegExp;
  variables: { key: string; label: string }[];
}

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

export const ENTITY_TYPES: EntityTypeInfo[] = [
  {
    type: 'doctor', label: 'Médicos', singular: 'Médico', prefix: '/doctor/',
    pattern: new RegExp(`^/doctor/(${UUID})$`),
    variables: [
      { key: 'nombre', label: 'Nombre' }, { key: 'especialidad', label: 'Especialidad' },
      { key: 'ciudad', label: 'Ciudad' }, { key: 'bio', label: 'Biografía' }, { key: 'sitio', label: 'Sitio' },
    ],
  },
  {
    type: 'live', label: 'Lives', singular: 'Live', prefix: '/live/',
    pattern: new RegExp(`^/live/(${UUID})$`),
    variables: [
      { key: 'titulo', label: 'Título' }, { key: 'medico', label: 'Médico' },
      { key: 'especialidad', label: 'Especialidad' }, { key: 'descripcion', label: 'Descripción' }, { key: 'sitio', label: 'Sitio' },
    ],
  },
  {
    type: 'recording', label: 'Grabaciones', singular: 'Grabación', prefix: '/recording/',
    pattern: new RegExp(`^/recording/(${UUID})$`),
    variables: [
      { key: 'titulo', label: 'Título' }, { key: 'medico', label: 'Médico' },
      { key: 'especialidad', label: 'Especialidad' }, { key: 'descripcion', label: 'Descripción' }, { key: 'sitio', label: 'Sitio' },
    ],
  },
  {
    type: 'news', label: 'Noticias', singular: 'Noticia', prefix: '/news/',
    // Mismo alfabeto que generateSlug() de NewsEditor: a-z, 0-9 y guiones, hasta 80.
    pattern: /^\/news\/([a-z0-9][a-z0-9-]{0,99})$/,
    variables: [
      { key: 'titulo', label: 'Título' }, { key: 'resumen', label: 'Resumen' },
      { key: 'categoria', label: 'Categoría' }, { key: 'sitio', label: 'Sitio' },
    ],
  },
  {
    type: 'congress', label: 'Congresos', singular: 'Congreso', prefix: '/congreso/',
    pattern: new RegExp(`^/congreso/(${UUID})$`),
    variables: [
      { key: 'titulo', label: 'Título' }, { key: 'especialidad', label: 'Especialidad' },
      { key: 'descripcion', label: 'Descripción' }, { key: 'inicio', label: 'Fecha de inicio' },
      { key: 'fin', label: 'Fecha de fin' }, { key: 'sitio', label: 'Sitio' },
    ],
  },
];

export type RouteMatch =
  | { kind: 'page'; path: string; page: PublicPage }
  | { kind: 'alias'; path: string; target: string }
  | { kind: 'entity'; path: string; type: EntityType; id: string }
  | { kind: 'private'; path: string }
  | { kind: 'unknown'; path: string };

/** Quita query, hash, barras repetidas y la barra final (salvo en «/»). */
export function normalizePath(input: string): string {
  let p = String(input || '/').trim();
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch { /* se trata como ruta */ }
  p = p.split('#')[0].split('?')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

export function isPrivatePath(path: string): boolean {
  const p = normalizePath(path);
  for (const prefix of PRIVATE_PREFIXES) {
    if (prefix.endsWith('/')) {
      if (p.startsWith(prefix) || p === prefix.slice(0, -1)) {
        // /doctor/<uuid> es el perfil público del médico; el resto de /doctor/* es su panel.
        if (prefix === '/doctor/' && ENTITY_TYPES[0].pattern.test(p)) return false;
        return true;
      }
    } else if (p === prefix || p.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

export function matchRoute(path: string): RouteMatch {
  const p = normalizePath(path);
  const page = PUBLIC_PAGES.find((x) => x.path === p);
  if (page) return { kind: 'page', path: p, page };
  if (ALIASES[p]) return { kind: 'alias', path: p, target: ALIASES[p] };
  for (const info of ENTITY_TYPES) {
    const m = p.match(info.pattern);
    if (m) return { kind: 'entity', path: p, type: info.type, id: info.type === 'news' ? m[1] : m[1].toLowerCase() };
  }
  if (isPrivatePath(p)) return { kind: 'private', path: p };
  return { kind: 'unknown', path: p };
}

export function entityPath(type: EntityType, id: string): string {
  const info = ENTITY_TYPES.find((x) => x.type === type)!;
  return `${info.prefix}${id}`;
}

export function createDefaultSeoConfig(): SeoConfig {
  return {
    version: 1,
    site: {
      name: 'Medical Masters',
      titleTemplate: '{titulo} | {sitio}',
      homeTitle: HOME_TITLE,
      defaultDescription: HOME_DESCRIPTION,
      keywords:
        'telemedicina, doctores en línea, consulta médica online, médicos certificados, expediente clínico digital, recetas digitales, segunda opinión médica, lives quirúrgicos, formación médica continua, residentes médicos',
      locale: 'es_ES',
      twitterSite: '@MedicalMasters',
      faviconUrl: '',
      ogImageUrl: '',
      ogImageWidth: 0,
      ogImageHeight: 0,
    },
    pages: {},
    types: {
      doctor: {
        titleTemplate: '{nombre}[ · {especialidad}]',
        descriptionTemplate: '{nombre}[, {especialidad}][ en {ciudad}]. [{bio} ]Perfil profesional en {sitio}.',
        index: false, sitemap: true, useContentImage: true, structuredData: true,
      },
      live: {
        titleTemplate: '{titulo}[ · Live de {medico}]',
        descriptionTemplate: '[{descripcion} ]Transmisión en vivo[ de {especialidad}] en {sitio}.',
        index: false, sitemap: true, useContentImage: true, structuredData: false,
      },
      recording: {
        titleTemplate: '{titulo}[ · {medico}]',
        descriptionTemplate: '[{descripcion} ]Grabación[ de {especialidad}] en {sitio}.',
        index: false, sitemap: true, useContentImage: true, structuredData: true,
      },
      news: {
        titleTemplate: '{titulo}',
        descriptionTemplate: '[{resumen}]',
        index: false, sitemap: true, useContentImage: true, structuredData: true,
      },
      congress: {
        titleTemplate: '{titulo}[ · Congreso de {especialidad}]',
        descriptionTemplate: '[{descripcion} ]Congreso[ del {inicio}][ al {fin}] en {sitio}.',
        index: false, sitemap: true, useContentImage: true, structuredData: true,
      },
    },
    indexing: { robotsExtra: '' },
    verification: { google: '', bing: '', yandex: '', pinterest: '', facebook: '' },
    organization: {
      type: 'MedicalOrganization',
      name: 'Medical Masters',
      alternateName: 'Medical Masters',
      description:
        'Plataforma médica para doctores, residentes y pacientes: orientación médica en vivo, lives de doctores, contenido premium, recetas digitales y expediente clínico seguro.',
      logoUrl: '',
      email: '',
      phone: '',
      areaServed: 'Worldwide',
      medicalSpecialty: ['GeneralPractice', 'Cardiovascular', 'Pediatric', 'Dermatologic', 'Psychiatric', 'Gynecologic'],
      sameAs: [
        'https://www.facebook.com/MedicalMasters',
        'https://www.instagram.com/medicalmasters',
        'https://twitter.com/MedicalMasters',
      ],
      searchAction: true,
    },
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function pick<T>(base: T, stored: unknown): T {
  if (!isObj(base) || !isObj(stored)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(base as Record<string, unknown>)) {
    const s = stored[k];
    if (s === undefined || s === null) continue;
    if (Array.isArray(v)) out[k] = Array.isArray(s) ? s.filter((x) => typeof x === 'string') : v;
    else if (isObj(v)) out[k] = pick(v, s);
    else if (typeof v === typeof s) out[k] = s;
  }
  return out as T;
}

/** Mezcla lo guardado con los valores por defecto, tirando lo que no tenga el tipo esperado. */
export function mergeSeoConfig(stored: unknown): SeoConfig {
  const base = createDefaultSeoConfig();
  if (!isObj(stored)) return base;
  const merged = pick(base, stored);
  const pages: Record<string, SeoFields> = {};
  if (isObj(stored.pages)) {
    for (const [rawPath, fields] of Object.entries(stored.pages)) {
      if (!isObj(fields)) continue;
      const path = normalizePath(rawPath);
      if (isPrivatePath(path)) continue;
      const f: SeoFields = {};
      for (const key of ['title', 'description', 'keywords', 'ogTitle', 'ogDescription', 'ogImage', 'canonical'] as const) {
        if (typeof fields[key] === 'string' && (fields[key] as string).trim()) f[key] = (fields[key] as string).trim();
      }
      for (const key of ['ignoreTemplate', 'index', 'sitemap'] as const) {
        if (typeof fields[key] === 'boolean') f[key] = fields[key] as boolean;
      }
      if (Object.keys(f).length) pages[path] = f;
    }
  }
  merged.pages = pages;
  if (typeof stored.updatedAt === 'string') merged.updatedAt = stored.updatedAt;
  return merged;
}

// ═════════════════════════════ salida ═════════════════════════════


export const DEFAULT_OG_IMAGE = `${SITE_URL}/icon-512.png?v=18`;
export const SEO_MARK_START = '<!-- seo:start -->';
export const SEO_MARK_END = '<!-- seo:end -->';

/** Datos públicos de una ficha (médico, live…) ya convertidos a variables de plantilla. */
export interface EntityData {
  exists: boolean;
  vars: Record<string, string>;
  image?: string;
  lastmod?: string;
  publishedTime?: string;
  schema?: Record<string, unknown> | null;
}

export interface ResolvedSeo {
  path: string;
  source: 'page' | 'alias' | 'entity' | 'private' | 'unknown';
  entityType?: EntityType;
  label: string;
  customized: boolean;
  title: string;
  description: string;
  keywords: string;
  canonical: string;
  index: boolean;
  sitemap: boolean;
  robots: string;
  siteName: string;
  locale: string;
  twitterSite: string;
  ogType: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  twitterCard: 'summary' | 'summary_large_image';
  publishedTime?: string;
  favicon: { custom: boolean; version: string };
  verification: SeoConfig['verification'] | null;
  jsonLd: Record<string, unknown>[];
}

// ───────────────────────────── texto ─────────────────────────────

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Quita etiquetas HTML (las biografías y descripciones pueden venir de un editor rico). */
export function plainText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(value: string, max: number): string {
  const s = plainText(value);
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  // Mejor terminar en una frase entera que dejar «Perfil…» colgando.
  const lastStop = cut.lastIndexOf('. ');
  if (lastStop > max * 0.55) return cut.slice(0, lastStop + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

/**
 * Plantillas: {variable} se sustituye; lo que va [entre corchetes] solo aparece si
 * TODAS las variables de dentro tienen valor. «{nombre}[ en {ciudad}]» no deja
 * un « en » colgando cuando el médico no puso ciudad.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  const value = (key: string) => plainText(vars[key] ?? '');
  const withSegments = String(template ?? '').replace(/\[([^[\]]*)\]/g, (_m, inner: string) => {
    const keys = [...inner.matchAll(/\{([a-z_]+)\}/gi)].map((x) => x[1]);
    return keys.every((k) => value(k) !== '') ? inner : '';
  });
  return withSegments
    .replace(/\{([a-z_]+)\}/gi, (_m, key: string) => value(key))
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([,.;:])(?:\s*[,.;:])+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.;:·|–-]+/, '')
    .replace(/[\s,;:·|–-]+$/, '')
    .trim();
}

export function applyTitleTemplate(template: string, title: string, siteName: string): string {
  const t = plainText(title);
  if (!t) return siteName;
  const out = renderTemplate(template || '{titulo} | {sitio}', { titulo: t, sitio: siteName });
  return out || t;
}

/** Solo URLs http(s) absolutas o rutas del propio sitio. Nada de javascript:, data:, //host. */
export function safeUrl(value: string | undefined, allowPath = true): string {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (/^https?:\/\/[^\s<>"']+$/i.test(v)) return v;
  if (allowPath && v.startsWith('/') && !v.startsWith('//') && !/[\s<>"']/.test(v)) return `${SITE_URL}${v}`;
  return '';
}

export function shortHash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «12 de septiembre de 2026», en hora de Ciudad de México. */
export function formatDateEs(iso: string | null | undefined): string {
  if (!iso) return '';
  // Las columnas `date` (congresses.starts_at) llegan como «2026-09-12»: pasarlas por
  // Date las lee como medianoche UTC y en México saldrían un día antes.
  const dateOnly = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const month = Number(dateOnly[2]) - 1;
    return month >= 0 && month < 12 ? `${Number(dateOnly[3])} de ${MONTHS[month]} de ${dateOnly[1]}` : '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(d);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return `${get('day')} de ${MONTHS[get('month') - 1]} de ${get('year')}`;
  } catch {
    return `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  }
}

// ───────────────────────────── fichas ─────────────────────────────

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export function doctorEntity(row: Row | null | undefined): EntityData {
  if (!row || !row.user_id) return { exists: false, vars: {} };
  const path = entityPath('doctor', str(row.user_id));
  const vars = { nombre: str(row.name), especialidad: str(row.specialty), ciudad: str(row.location), bio: truncate(str(row.bio), 220) };
  const image = safeUrl(str(row.avatar_url), false);
  const person: Row = { '@type': 'Person', name: vars.nombre, url: `${SITE_URL}${path}` };
  if (vars.especialidad) person.jobTitle = vars.especialidad;
  if (vars.bio) person.description = vars.bio;
  if (image) person.image = image;
  if (vars.ciudad) person.address = { '@type': 'PostalAddress', addressLocality: vars.ciudad };
  return {
    exists: true, vars, image, lastmod: str(row.updated_at) || undefined,
    schema: vars.nombre ? { '@context': 'https://schema.org', '@type': 'ProfilePage', url: `${SITE_URL}${path}`, mainEntity: person } : null,
  };
}

export function liveEntity(row: Row | null | undefined, doctorName = ''): EntityData {
  if (!row || !row.id) return { exists: false, vars: {} };
  return {
    exists: true,
    vars: { titulo: str(row.title), medico: doctorName, especialidad: str(row.specialty), descripcion: truncate(str(row.description), 200) },
    image: safeUrl(str(row.thumbnail_url), false),
    // lives no tiene created_at/updated_at: su fecha es started_at (o scheduled_at).
    lastmod: str(row.started_at || row.scheduled_at) || undefined,
    schema: null,
  };
}

export function recordingEntity(row: Row | null | undefined, doctorName = ''): EntityData {
  if (!row || !row.id) return { exists: false, vars: {} };
  const path = entityPath('recording', str(row.id));
  const image = safeUrl(str(row.thumbnail_url), false);
  const vars = { titulo: str(row.title), medico: doctorName, especialidad: str(row.specialty), descripcion: truncate(str(row.description), 200) };
  const uploadDate = str(row.created_at);
  return {
    exists: true, vars, image, lastmod: uploadDate || undefined,
    // Google exige nombre, miniatura y fecha para VideoObject: sin miniatura no se emite.
    schema: image && uploadDate && vars.titulo ? {
      '@context': 'https://schema.org', '@type': 'VideoObject', name: vars.titulo,
      description: vars.descripcion || vars.titulo, thumbnailUrl: image, uploadDate, url: `${SITE_URL}${path}`,
    } : null,
  };
}

export function newsEntity(row: Row | null | undefined, siteName = 'Medical Masters'): EntityData {
  if (!row || !row.slug) return { exists: false, vars: {} };
  const path = entityPath('news', str(row.slug));
  const image = safeUrl(str(row.image_url), false);
  const vars = { titulo: str(row.title), resumen: truncate(str(row.summary), 220), categoria: str(row.category) };
  const published = str(row.published_at || row.created_at);
  const article: Row = {
    '@context': 'https://schema.org', '@type': 'NewsArticle', headline: truncate(vars.titulo, 110),
    url: `${SITE_URL}${path}`, publisher: { '@type': 'Organization', name: siteName, url: `${SITE_URL}/` },
  };
  if (image) article.image = [image];
  if (published) article.datePublished = published;
  if (row.updated_at) article.dateModified = str(row.updated_at);
  return { exists: true, vars, image, lastmod: str(row.updated_at) || published || undefined, publishedTime: published || undefined, schema: vars.titulo ? article : null };
}

export function congressEntity(row: Row | null | undefined, siteName = 'Medical Masters'): EntityData {
  if (!row || !row.id) return { exists: false, vars: {} };
  const path = entityPath('congress', str(row.id));
  const image = safeUrl(str(row.banner_url), false);
  const vars = {
    titulo: str(row.title), especialidad: str(row.specialty), descripcion: truncate(str(row.description), 200),
    inicio: formatDateEs(str(row.starts_at)), fin: formatDateEs(str(row.ends_at)),
  };
  const event: Row = {
    '@context': 'https://schema.org', '@type': 'Event', name: vars.titulo, url: `${SITE_URL}${path}`,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'VirtualLocation', url: `${SITE_URL}${path}` },
    organizer: { '@type': 'Organization', name: siteName, url: `${SITE_URL}/` },
  };
  if (vars.descripcion) event.description = vars.descripcion;
  if (image) event.image = [image];
  if (row.starts_at) event.startDate = str(row.starts_at);
  if (row.ends_at) event.endDate = str(row.ends_at);
  return {
    exists: true, vars, image, lastmod: str(row.updated_at || row.created_at) || undefined,
    // Event sin fecha de inicio no es válido para Google.
    schema: vars.titulo && row.starts_at ? event : null,
  };
}

// ───────────────────────────── resolver ─────────────────────────────

const OG_TYPES: Record<EntityType, string> = { doctor: 'profile', live: 'website', recording: 'video.other', news: 'article', congress: 'website' };

export function organizationJsonLd(config: SeoConfig): Record<string, unknown>[] {
  const org = config.organization;
  const logo = safeUrl(org.logoUrl, true) || safeUrl(config.site.faviconUrl, false) || DEFAULT_OG_IMAGE;
  const o: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': org.type || 'MedicalOrganization',
    name: org.name || config.site.name, url: `${SITE_URL}/`, logo, image: logo,
  };
  if (org.alternateName) o.alternateName = org.alternateName;
  if (org.description) o.description = org.description;
  if (org.areaServed) o.areaServed = org.areaServed;
  if (org.type === 'MedicalOrganization' && org.medicalSpecialty.length) o.medicalSpecialty = org.medicalSpecialty;
  const sameAs = org.sameAs.map((u) => safeUrl(u, false)).filter(Boolean);
  if (sameAs.length) o.sameAs = sameAs;
  if (org.email) o.email = org.email;
  if (org.phone) o.telephone = org.phone;
  const site: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'WebSite', name: config.site.name, url: `${SITE_URL}/`,
    inLanguage: ['es', 'en', 'pt', 'fr', 'it', 'de', 'ca', 'zh'],
  };
  if (org.searchAction) {
    site.potentialAction = {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/doctors?search={search_term_string}` },
      'query-input': 'required name=search_term_string',
    };
  }
  return [o, site];
}

export function resolveSeo(config: SeoConfig, rawPath: string, entity?: EntityData | null): ResolvedSeo {
  const route = matchRoute(rawPath);
  const site = config.site;
  let label = '';
  let title = site.name;
  let description = site.defaultDescription;
  let keywords = '';
  let ignoreTemplate = true;
  let index = false;
  let sitemap = false;
  let ogType = 'website';
  let image = '';
  let canonicalPath = route.path;
  let jsonLd: Record<string, unknown>[] = [];
  let publishedTime: string | undefined;
  let entityType: EntityType | undefined;
  let exists = true;

  if (route.kind === 'page' || route.kind === 'alias') {
    const target = route.kind === 'alias' ? route.target : route.path;
    const page = PUBLIC_PAGES.find((p) => p.path === target)!;
    const isHome = target === '/';
    label = route.kind === 'alias' ? `${page.label} (atajo)` : page.label;
    title = isHome ? site.homeTitle : page.title;
    ignoreTemplate = isHome || !!page.ignoreTemplate;
    description = (isHome ? site.defaultDescription : page.description) || site.defaultDescription;
    keywords = isHome ? site.keywords : '';
    index = route.kind === 'page' && isHome;
    sitemap = true;
    canonicalPath = target;
    if (isHome) jsonLd = organizationJsonLd(config);
  } else if (route.kind === 'entity') {
    entityType = route.type;
    const info = ENTITY_TYPES.find((t) => t.type === route.type)!;
    const typeCfg = config.types[route.type];
    ogType = OG_TYPES[route.type];
    exists = !!entity?.exists;
    if (exists && entity) {
      const vars = { ...entity.vars, sitio: site.name };
      label = entity.vars.nombre || entity.vars.titulo || info.singular;
      title = renderTemplate(typeCfg.titleTemplate, vars) || info.singular;
      ignoreTemplate = false;
      description = truncate(renderTemplate(typeCfg.descriptionTemplate, vars), 160) || site.defaultDescription;
      index = typeCfg.index;
      sitemap = typeCfg.sitemap;
      image = typeCfg.useContentImage ? entity.image || '' : '';
      if (typeCfg.structuredData && entity.schema) jsonLd = [entity.schema];
      publishedTime = entity.publishedTime;
    } else {
      label = `${info.singular} no encontrado`;
      title = info.singular;
      ignoreTemplate = false;
    }
  } else {
    label = route.kind === 'private' ? 'Zona privada' : 'Página sin configurar';
  }

  const override: SeoFields | undefined =
    route.kind === 'page' || route.kind === 'entity' || route.kind === 'unknown' ? config.pages[route.path] : undefined;
  if (override) {
    if (override.title) { title = override.title; ignoreTemplate = !!override.ignoreTemplate; }
    if (override.description) description = override.description;
    if (override.keywords) keywords = override.keywords;
    if (exists && typeof override.index === 'boolean') index = override.index;
    if (typeof override.sitemap === 'boolean') sitemap = override.sitemap;
  }
  if (route.kind === 'private' || route.kind === 'alias' || !exists) index = false;

  const finalTitle = ignoreTemplate ? plainText(title) : applyTitleTemplate(site.titleTemplate, title, site.name);
  const customOg = safeUrl(override?.ogImage, true);
  const siteOg = safeUrl(site.ogImageUrl, true);
  const ogImage = customOg || image || siteOg || DEFAULT_OG_IMAGE;
  let ogImageWidth: number | undefined;
  let ogImageHeight: number | undefined;
  if (ogImage === DEFAULT_OG_IMAGE) { ogImageWidth = 512; ogImageHeight = 512; }
  else if (ogImage === siteOg && site.ogImageWidth && site.ogImageHeight) { ogImageWidth = site.ogImageWidth; ogImageHeight = site.ogImageHeight; }

  return {
    path: route.path,
    source: route.kind,
    entityType,
    label,
    customized: !!override,
    title: finalTitle,
    description: plainText(description),
    keywords: plainText(keywords),
    canonical: safeUrl(override?.canonical, true) || `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`,
    index,
    sitemap: index && sitemap,
    robots: index ? DEFAULT_ROBOTS_INDEX : DEFAULT_ROBOTS_NOINDEX,
    siteName: site.name,
    locale: site.locale || 'es_ES',
    twitterSite: site.twitterSite,
    ogType,
    ogTitle: plainText(override?.ogTitle || '') || finalTitle,
    ogDescription: plainText(override?.ogDescription || '') || plainText(description),
    ogImage,
    ogImageWidth,
    ogImageHeight,
    twitterCard: ogImage === DEFAULT_OG_IMAGE ? 'summary' : 'summary_large_image',
    publishedTime,
    favicon: { custom: !!safeUrl(site.faviconUrl, false), version: site.faviconUrl ? shortHash(site.faviconUrl) : '18' },
    verification: route.path === '/' ? config.verification : null,
    jsonLd,
  };
}

// ───────────────────────────── salida ─────────────────────────────

function jsonLdScript(obj: Record<string, unknown>): string {
  // \u003c evita que un «</script>» dentro de un texto cierre la etiqueta.
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

const VERIFICATION_META: Record<keyof SeoConfig['verification'], string> = {
  google: 'google-site-verification', bing: 'msvalidate.01', yandex: 'yandex-verification',
  pinterest: 'p:domain_verify', facebook: 'facebook-domain-verification',
};

/** Extrae el código de lo que pegue el admin: el código solo o la etiqueta <meta> entera. */
export function cleanVerificationCode(value: string): string {
  const v = String(value ?? '').trim();
  const fromTag = v.match(/content\s*=\s*["']([^"']+)["']/i);
  const code = (fromTag ? fromTag[1] : v).trim();
  return /^[A-Za-z0-9_\-:=+/.]{1,200}$/.test(code) ? code : '';
}

export function buildHeadHtml(r: ResolvedSeo): string {
  const e = escapeHtml;
  const lines: string[] = [
    `<title>${e(r.title)}</title>`,
    `<meta name="description" content="${e(r.description)}" />`,
  ];
  if (r.keywords) lines.push(`<meta name="keywords" content="${e(r.keywords)}" />`);
  lines.push(`<meta name="robots" content="${e(r.robots)}" />`, `<link rel="canonical" href="${e(r.canonical)}" />`);
  lines.push(
    `<meta property="og:title" content="${e(r.ogTitle)}" />`,
    `<meta property="og:description" content="${e(r.ogDescription)}" />`,
    `<meta property="og:type" content="${e(r.ogType)}" />`,
    `<meta property="og:locale" content="${e(r.locale)}" />`,
    `<meta property="og:url" content="${e(r.canonical)}" />`,
    `<meta property="og:site_name" content="${e(r.siteName)}" />`,
    `<meta property="og:image" content="${e(r.ogImage)}" />`,
  );
  if (r.ogImageWidth && r.ogImageHeight) {
    lines.push(`<meta property="og:image:width" content="${r.ogImageWidth}" />`, `<meta property="og:image:height" content="${r.ogImageHeight}" />`);
  }
  lines.push(`<meta property="og:image:alt" content="${e(r.ogTitle)}" />`);
  if (r.publishedTime) lines.push(`<meta property="article:published_time" content="${e(r.publishedTime)}" />`);
  lines.push(`<meta name="twitter:card" content="${r.twitterCard}" />`);
  if (r.twitterSite) lines.push(`<meta name="twitter:site" content="${e(r.twitterSite)}" />`);
  lines.push(
    `<meta name="twitter:title" content="${e(r.ogTitle)}" />`,
    `<meta name="twitter:description" content="${e(r.ogDescription)}" />`,
    `<meta name="twitter:image" content="${e(r.ogImage)}" />`,
  );
  if (r.favicon.custom) {
    const v = e(r.favicon.version);
    lines.push(
      `<link rel="icon" href="/favicon.png?v=${v}" />`,
      `<link rel="shortcut icon" href="/favicon.png?v=${v}" />`,
      `<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${v}" />`,
    );
  } else {
    lines.push(
      '<link rel="icon" href="/favicon.ico?v=18" sizes="any" />',
      '<link rel="icon" type="image/png" sizes="48x48" href="/favicon.png?v=18" />',
      '<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png?v=18" />',
      '<link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png?v=18" />',
      '<link rel="shortcut icon" href="/favicon.ico?v=18" />',
      '<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=18" />',
    );
  }
  if (r.verification) {
    for (const [key, name] of Object.entries(VERIFICATION_META)) {
      const code = cleanVerificationCode(r.verification[key as keyof SeoConfig['verification']]);
      if (code) lines.push(`<meta name="${name}" content="${e(code)}" />`);
    }
  }
  for (const obj of r.jsonLd) lines.push(jsonLdScript(obj));
  return lines.join('\n    ');
}

/** Sustituye lo que hay entre las marcas seo:start / seo:end de index.html. */
export function injectHead(html: string, headHtml: string): string {
  const start = html.indexOf(SEO_MARK_START);
  const end = html.indexOf(SEO_MARK_END);
  if (start === -1 || end === -1 || end < start) return html;
  return `${html.slice(0, start + SEO_MARK_START.length)}\n    ${headHtml}\n    ${html.slice(end)}`;
}

const STATIC_ALLOW = [
  '/favicon.ico', '/favicon.png', '/apple-touch-icon.png', '/icon-16.png', '/icon-32.png', '/icon-72.png',
  '/icon-96.png', '/icon-128.png', '/icon-144.png', '/icon-152.png', '/icon-192.png', '/icon-384.png',
  '/icon-512.png', '/manifest.json', '/sitemap.xml', '/robots.txt',
];

// Rutas de panel que cuelgan de prefijos públicos: si se abre /doctor/ a Google,
// estas siguen cerradas (en robots.txt gana la regla más larga).
const PRIVATE_UNDER_PUBLIC_PREFIX = [
  '/doctor/dashboard', '/doctor/agenda', '/doctor/patients', '/doctor/consultations', '/doctor/upload', '/doctor/vault',
  '/doctor/availability', '/doctor/recordings', '/doctor/content', '/doctor/books', '/doctor/go-live', '/doctor/subscribers',
  '/doctor/news', '/doctor/bank-account', '/doctor/invoices', '/doctor/earnings', '/doctor/email-history',
];

export function sanitizeRobotsExtra(text: string): string[] {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^(#[^<>]{0,200}|(user-agent|allow|disallow|crawl-delay)\s*:\s*[^\s<>]{0,300})$/i.test(l))
    .slice(0, 50);
}

export function buildRobotsTxt(config: SeoConfig): string {
  const allow = new Set<string>(['/$', '/assets/']);
  for (const page of PUBLIC_PAGES) {
    if (resolveSeo(config, page.path).index) allow.add(page.path === '/' ? '/$' : `${page.path}$`);
  }
  let doctorOpen = false;
  for (const info of ENTITY_TYPES) {
    if (config.types[info.type].index) {
      allow.add(info.prefix);
      if (info.type === 'doctor') doctorOpen = true;
    }
  }
  for (const [path, fields] of Object.entries(config.pages)) {
    const m = matchRoute(path);
    if (fields.index === true && (m.kind === 'entity' || m.kind === 'unknown')) {
      allow.add(`${path}$`);
      if (m.kind === 'entity' && m.type === 'doctor') doctorOpen = true;
    }
  }
  const lines = [
    '# Medical Masters - https://medical-masters.com',
    '# Lo genera el panel SEO (/admin/seo). Se edita allí.',
    '',
    'User-agent: *',
    ...[...allow].map((p) => `Allow: ${p}`),
    ...STATIC_ALLOW.map((p) => `Allow: ${p}`),
    ...(doctorOpen ? PRIVATE_UNDER_PUBLIC_PREFIX.map((p) => `Disallow: ${p}`) : []),
    'Disallow: /',
  ];
  const extra = sanitizeRobotsExtra(config.indexing.robotsExtra);
  if (extra.length) lines.push('', '# Reglas adicionales del panel', ...extra);
  lines.push('', `Sitemap: ${SITE_URL}/sitemap.xml`, '');
  return lines.join('\n');
}

export interface SitemapEntry { loc: string; lastmod?: string }

function xmlEscape(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const seen = new Set<string>();
  const body = entries
    .filter((x) => x.loc && !seen.has(x.loc) && seen.add(x.loc))
    .map((x) => {
      const d = x.lastmod ? new Date(x.lastmod) : null;
      const lastmod = d && !Number.isNaN(d.getTime()) ? `<lastmod>${d.toISOString().slice(0, 10)}</lastmod>` : '';
      return `  <url><loc>${xmlEscape(x.loc)}</loc>${lastmod}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** Páginas fijas y URLs personalizadas (no fichas) que van al sitemap. */
export function staticSitemapEntries(config: SeoConfig): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  for (const page of PUBLIC_PAGES) {
    const r = resolveSeo(config, page.path);
    if (r.sitemap) out.push({ loc: r.canonical });
  }
  for (const path of Object.keys(config.pages)) {
    if (matchRoute(path).kind !== 'unknown') continue;
    const r = resolveSeo(config, path);
    if (r.sitemap) out.push({ loc: r.canonical });
  }
  return out;
}

/** ¿Va esta ficha al sitemap? (la regla del tipo, salvo que su URL diga otra cosa). */
export function entityInSitemap(config: SeoConfig, type: EntityType, id: string, entity: EntityData): boolean {
  return resolveSeo(config, entityPath(type, id), entity).sitemap;
}

/** Avisos para el panel: lo que Google cortaría o lo que queda repetido. */
export function seoWarnings(r: ResolvedSeo, config: SeoConfig): string[] {
  const w: string[] = [];
  if (r.title.length > 60) w.push(`Título de ${r.title.length} caracteres: Google suele cortar a partir de 60.`);
  if (r.title.length < 15) w.push('Título muy corto.');
  if (r.description.length > 160) w.push(`Descripción de ${r.description.length} caracteres: Google suele cortar a partir de 160.`);
  if (r.description.length < 50) w.push('Descripción muy corta (menos de 50 caracteres).');
  if (r.path !== '/' && r.description === plainText(config.site.defaultDescription)) w.push('Usa la descripción general del sitio: conviene una propia.');
  if (/\.(avif|svg)(\?|$)/i.test(r.ogImage)) w.push('La imagen para compartir es AVIF o SVG: WhatsApp y Facebook no la muestran. Sube un JPG o PNG.');
  return w;
}
