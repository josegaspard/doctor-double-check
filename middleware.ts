// Middleware de Vercel: escribe el SEO del panel (/admin/seo) en el HTML de cada página.
//
// La web es una SPA: sin esto, TODAS las URLs devuelven el mismo index.html con el
// título y la imagen de la home, y WhatsApp, Facebook, LinkedIn o X (que no ejecutan
// JavaScript) enseñan eso mismo para un médico, una noticia o un congreso.
//
// Por cada página: toma index.html, pide a la función seo-meta el <head> de esa URL y
// sustituye lo que hay entre <!-- seo:start --> y <!-- seo:end -->. También sirve
// robots.txt, sitemap.xml y el favicon que se suba desde el panel.
//
// Nunca tumba la web: si la función no contesta, sirve el HTML con el <head> por
// defecto, y si ni siquiera hay HTML, deja pasar la petición como antes (next()).
import { next } from '@vercel/functions';
import {
  DEFAULT_ROBOTS_NOINDEX, buildHeadHtml, createDefaultSeoConfig, injectHead, matchRoute, resolveSeo,
  type ResolvedSeo,
} from './supabase/functions/_shared/seo-render'; // sin «.ts»: el empaquetador Edge de Vercel no lo admite

export const config = {
  // Runtime Edge (el de por defecto). Vercel avisa de que está obsoleto y sugiere Node.js,
  // pero probado el 11-sep-2026 con runtime 'nodejs' TODAS las rutas daban 500 en la
  // preview; con Edge funciona. No cambiarlo sin probarlo antes en una preview.
  matcher: [
    '/',
    '/((?!assets/|api/|qr$|\\.well-known/)[^.]*)',
    '/robots.txt',
    '/sitemap.xml',
    '/favicon.ico',
    '/favicon.png',
    '/apple-touch-icon.png',
  ],
};

const SUPABASE = 'https://ouawwfqexfwuptlgoksr.supabase.co';
const FN = `${SUPABASE}/functions/v1/seo-meta`;
const STORAGE_PUBLIC = `${SUPABASE}/storage/v1/object/public/`;
const TTL_MS = 30_000;
// La función en frío tardó hasta 1,2 s en las pruebas; con 2,5 s hay margen sin
// que una página se quede colgada si Supabase no contesta.
const TIMEOUT_MS = 2_500;

// Cabeceras de seguridad que vercel.json pone a index.html y que la respuesta
// reescrita tiene que conservar.
const COPY_HEADERS = [
  'strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy',
  'permissions-policy', 'cross-origin-opener-policy', 'cross-origin-resource-policy',
  'origin-agent-cluster', 'content-security-policy',
];

type Cached<T> = { at: number; value: T };
const metaCache = new Map<string, Cached<ResolvedSeo>>();
let siteCache: Cached<{ faviconUrl: string }> | null = null;
let shell: { html: string; headers: Headers } | null = null;

async function fetchWithTimeout(url: string | URL, init: RequestInit = {}, ms = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getShell(request: Request) {
  if (shell) return shell;
  // En las previews protegidas, index.html también pide el pase de Vercel.
  const headers = new Headers();
  const bypass = request.headers.get('x-vercel-protection-bypass');
  if (bypass) headers.set('x-vercel-protection-bypass', bypass);
  const jwt = (request.headers.get('cookie') || '').match(/(?:^|;\s*)(_vercel_jwt=[^;]+)/);
  if (jwt) headers.set('cookie', jwt[1]);
  const res = await fetchWithTimeout(new URL('/index.html', request.url), { headers }, 3_000);
  if (!res.ok) throw new Error(`index.html ${res.status}`);
  shell = { html: await res.text(), headers: res.headers };
  return shell;
}

// Pasados TTL_MS, lo guardado se sigue sirviendo al instante hasta STALE_MS mientras se
// refresca por detrás (waitUntil): solo espera a la función la primera visita de cada
// instancia, no una de cada 30 segundos.
const STALE_MS = 10 * 60_000;
const refreshing = new Set<string>();
type Ctx = { waitUntil?: (promise: Promise<unknown>) => void } | undefined;

async function fetchMeta(path: string): Promise<ResolvedSeo> {
  const res = await fetchWithTimeout(`${FN}?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`seo-meta ${res.status}`);
  const value = (await res.json()) as ResolvedSeo;
  if (typeof value?.title !== 'string' || typeof value?.robots !== 'string') throw new Error('seo-meta: respuesta rara');
  if (metaCache.size > 500) metaCache.clear();
  metaCache.set(path, { at: Date.now(), value });
  return value;
}

async function getMeta(path: string, ctx: Ctx): Promise<ResolvedSeo | null> {
  const hit = metaCache.get(path);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age < TTL_MS) return hit.value;
  if (hit && age < STALE_MS && ctx?.waitUntil) {
    if (!refreshing.has(path)) {
      refreshing.add(path);
      ctx.waitUntil(fetchMeta(path).catch(() => {}).finally(() => refreshing.delete(path)));
    }
    return hit.value;
  }
  try {
    return await fetchMeta(path);
  } catch (error) {
    console.error('[seo] meta', path, (error as Error).message);
    return hit ? hit.value : null;
  }
}

async function fetchSite(): Promise<{ faviconUrl: string }> {
  const res = await fetchWithTimeout(`${FN}?kind=site`);
  if (!res.ok) throw new Error(`seo-meta site ${res.status}`);
  const value = (await res.json()) as { faviconUrl: string };
  siteCache = { at: Date.now(), value };
  return value;
}

async function getSite(ctx: Ctx): Promise<{ faviconUrl: string } | null> {
  const age = siteCache ? Date.now() - siteCache.at : Infinity;
  if (siteCache && age < TTL_MS) return siteCache.value;
  if (siteCache && age < STALE_MS && ctx?.waitUntil) {
    if (!refreshing.has('__site')) {
      refreshing.add('__site');
      ctx.waitUntil(fetchSite().catch(() => {}).finally(() => refreshing.delete('__site')));
    }
    return siteCache.value;
  }
  try {
    return await fetchSite();
  } catch {
    return siteCache ? siteCache.value : null;
  }
}

async function renderHtml(request: Request, pathname: string, ctx: Ctx): Promise<Response> {
  let page: { html: string; headers: Headers };
  try {
    page = await getShell(request);
  } catch (error) {
    console.error('[seo] shell', (error as Error).message);
    return next();
  }

  const route = matchRoute(pathname);
  const meta = await getMeta(route.path, ctx);
  let head: string;
  let robots: string | null;
  if (meta) {
    head = buildHeadHtml(meta);
    robots = meta.robots;
  } else {
    // Sin la función: <head> por defecto. Solo se cierra a Google lo que es privado;
    // una página o ficha que el admin haya abierto no se marca noindex por un corte.
    const fallback = resolveSeo(createDefaultSeoConfig(), route.path, route.kind === 'entity' ? { exists: true, vars: {} } : null);
    const closed = route.kind === 'private' || route.kind === 'alias' || route.kind === 'unknown';
    head = buildHeadHtml(fallback);
    if (!closed && route.path !== '/') head = head.replace(/<meta name="robots"[^>]*>\s*/, '');
    robots = closed ? DEFAULT_ROBOTS_NOINDEX : route.path === '/' ? fallback.robots : null;
  }

  const headers = new Headers();
  for (const name of COPY_HEADERS) {
    const value = page.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'public, max-age=0, must-revalidate');
  headers.set('x-seo', meta ? 'panel' : 'fallback');
  if (robots) headers.set('x-robots-tag', robots);
  const body = request.method === 'HEAD' ? null : injectHead(page.html, head);
  return new Response(body, { status: 200, headers });
}

async function proxyText(kind: 'robots' | 'sitemap', contentType: string): Promise<Response> {
  try {
    const res = await fetchWithTimeout(`${FN}?kind=${kind}`, {}, kind === 'sitemap' ? 5_000 : TIMEOUT_MS);
    if (!res.ok) throw new Error(`seo-meta ${kind} ${res.status}`);
    return new Response(await res.text(), {
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=0, must-revalidate',
        'x-robots-tag': 'index, follow, max-image-preview:large',
        'x-content-type-options': 'nosniff',
        'x-seo': 'panel',
      },
    });
  } catch (error) {
    console.error('[seo]', kind, (error as Error).message);
    return next(); // el fichero estático de public/ sigue ahí de respaldo
  }
}

async function proxyFavicon(ctx: Ctx): Promise<Response> {
  const site = await getSite(ctx);
  const url = site?.faviconUrl || '';
  if (!url.startsWith(STORAGE_PUBLIC)) return next();
  try {
    const res = await fetchWithTimeout(url, {}, 3_000);
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) throw new Error(`favicon ${res.status} ${type}`);
    return new Response(res.body, {
      headers: {
        'content-type': type,
        'cache-control': 'public, max-age=3600',
        'x-robots-tag': 'index, follow, max-image-preview:large',
        'x-content-type-options': 'nosniff',
        'x-seo': 'panel',
      },
    });
  } catch (error) {
    console.error('[seo] favicon', (error as Error).message);
    return next();
  }
}

export default async function middleware(request: Request, ctx?: { waitUntil(promise: Promise<unknown>): void }): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();
  const { pathname } = new URL(request.url);
  if (pathname === '/robots.txt') return proxyText('robots', 'text/plain; charset=utf-8');
  if (pathname === '/sitemap.xml') return proxyText('sitemap', 'application/xml; charset=utf-8');
  if (pathname === '/favicon.ico' || pathname === '/favicon.png' || pathname === '/apple-touch-icon.png') return proxyFavicon(ctx);
  // Red de seguridad por si el matcher dejara pasar algo que no es una página.
  if (
    /\.[a-z0-9]{1,8}$/i.test(pathname) || pathname.startsWith('/assets/') || pathname.startsWith('/api/') ||
    pathname === '/qr' || pathname.startsWith('/.well-known/')
  ) return next();
  return renderHtml(request, pathname, ctx);
}
