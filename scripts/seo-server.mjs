// Servidor SEO de medical-masters.com en el VPS: hace lo que hacía middleware.ts en Vercel.
//
// Caddy le pasa las páginas HTML (rutas sin extensión), /robots.txt y /sitemap.xml. Por
// cada página toma index.html del disco, pide a seo-meta el <head> de esa URL y sustituye
// lo que hay entre <!-- seo:start --> y <!-- seo:end -->. Pone X-Robots-Tag con el robots
// resuelto y responde 404 a las URLs que no existen en la app.
//
// Nunca tumba la web: si seo-meta no contesta, sirve el <head> por defecto; si este
// proceso cae, Caddy sirve index.html tal cual (handle_errors en medical-masters.caddy).
//
// Despliegue: /srv/mm-seo/scripts/seo-server.mjs junto a
// /srv/mm-seo/supabase/functions/_shared/seo-render.ts (misma ruta relativa que aquí),
// servicio systemd mm-seo (Node 24, que ejecuta el .ts sin compilar).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_ROBOTS_NOINDEX, buildHeadHtml, createDefaultSeoConfig, injectHead, matchRoute, resolveSeo,
} from '../supabase/functions/_shared/seo-render.ts';

const PORT = Number(process.env.PORT || 8871);
const ROOT = process.env.SITE_ROOT || '/srv/sitios/medical-masters';
// Directo a Kong del Supabase local: sin salir a internet ni pasar por Caddy.
const FN = process.env.SEO_FN || 'http://127.0.0.1:8000/functions/v1/seo-meta';
const TTL_MS = 30_000;
const STALE_MS = 10 * 60_000;
const TIMEOUT_MS = 2_500;

// Rutas de src/App.tsx (path="*" aparte). Lo que no case con ninguna, ni con una página
// del panel, responde 404. Si se añade una ruta a App.tsx, añadirla aquí también.
const APP_ROUTES = [
  '/', '/access-denied', '/admin/*', '/advertiser/*', '/advertising', '/app', '/arco', '/badge-chat', '/book/:p',
  '/chat', '/clinical-sessions', '/codigo-etica', '/como-funciona', '/compliance', '/congreso/:p', '/congresos',
  '/congresses', '/contact', '/contenido', '/content', '/dmca', '/doctor/*', '/doctores', '/doctors',
  '/double-check', '/education', '/email-confirmed', '/emergencia', '/emergency', '/enterprise', '/eventos',
  '/events', '/for-doctors', '/foro', '/for-patients', '/for-residents', '/help', '/hospital-locator', '/live/:p',
  '/lives', '/login', '/marketplace', '/medical-history', '/medical-record', '/medical-supplies', '/meetings',
  '/my-appointments', '/my-books', '/my-orders', '/news', '/news/:p', '/notifications', '/nutricion', '/nutrition',
  '/onboarding', '/order-success', '/prescriptions', '/prescriptions/*', '/privacy', '/profile', '/psicologia',
  '/psychology', '/recording/:p', '/recordings', '/register', '/registro', '/report-issue', '/reset-password',
  '/residentes/lo-que-debo-saber', '/resident-groups', '/security', '/settings', '/success-stories', '/terms',
  '/tutoriales', '/tutorials', '/vault', '/vendor/*', '/verificar-receta/:p', '/verification-pending',
  '/verify-identity', '/video-call', '/wallet', '/wallet/*',
].map((r) => new RegExp(`^${r.replace(/\/\*$/, '(/.*)?').replace(/:p/g, '[^/]+')}$`));

// HTML mínimo de la portada dentro de #root para quien no ejecuta JavaScript (y para
// que Google vea el H1 y el texto aunque no renderice). React lo sustituye al montar.
const HOME_STATIC = `<div style="min-height:100vh;background:#163a83;color:#fff;font-family:system-ui,sans-serif;padding:48px 24px">
      <main style="max-width:720px;margin:0 auto">
        <h1 style="font-size:2.2rem;line-height:1.1;margin:0 0 16px">La red global de médicos</h1>
        <p style="margin:0 0 8px">Conectando a los líderes de la medicina mundial.</p>
        <p style="margin:0 0 24px;opacity:.85">Conectamos médicos, hospitales y conocimiento en todo el mundo. Desde una segunda opinión hasta retransmisiones quirúrgicas en directo.</p>
        <nav style="display:flex;flex-wrap:wrap;gap:12px 20px">
          <a style="color:#aed3d9" href="/app">Acceder a la plataforma</a>
          <a style="color:#aed3d9" href="/for-doctors">Para médicos</a>
          <a style="color:#aed3d9" href="/for-patients">Para pacientes</a>
          <a style="color:#aed3d9" href="/for-residents">Para residentes</a>
          <a style="color:#aed3d9" href="/terms">Términos y condiciones</a>
          <a style="color:#aed3d9" href="/privacy">Aviso de privacidad</a>
        </nav>
      </main>
    </div>`;

const metaCache = new Map();
const refreshing = new Set();
let shell = null; // { html, mtimeMs }

async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// index.html cambia con cada despliegue del front: se relee si cambió su fecha.
async function getShell() {
  const file = path.join(ROOT, 'index.html');
  const st = await stat(file);
  if (!shell || shell.mtimeMs !== st.mtimeMs) shell = { html: await readFile(file, 'utf8'), mtimeMs: st.mtimeMs };
  return shell.html;
}

async function fetchMeta(p) {
  const res = await fetchWithTimeout(`${FN}?path=${encodeURIComponent(p)}`);
  if (!res.ok) throw new Error(`seo-meta ${res.status}`);
  const value = await res.json();
  if (typeof value?.title !== 'string' || typeof value?.robots !== 'string') throw new Error('seo-meta: respuesta rara');
  if (metaCache.size > 500) metaCache.clear();
  metaCache.set(p, { at: Date.now(), value });
  return value;
}

// 30 s fresco; hasta 10 min se sirve lo guardado al instante y se refresca por detrás.
async function getMeta(p) {
  const hit = metaCache.get(p);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age < TTL_MS) return hit.value;
  if (hit && age < STALE_MS) {
    if (!refreshing.has(p)) {
      refreshing.add(p);
      fetchMeta(p).catch(() => {}).finally(() => refreshing.delete(p));
    }
    return hit.value;
  }
  try {
    return await fetchMeta(p);
  } catch (error) {
    console.error('[seo] meta', p, error.message);
    return hit ? hit.value : null;
  }
}

async function renderHtml(pathname, isHead, res) {
  const html = await getShell();
  const route = matchRoute(pathname);
  const meta = await getMeta(route.path);
  let head;
  let robots;
  if (meta) {
    head = buildHeadHtml(meta);
    robots = meta.robots;
  } else {
    // Sin la función: <head> por defecto. Solo se cierra lo privado o desconocido.
    const fallback = resolveSeo(createDefaultSeoConfig(), route.path, route.kind === 'entity' ? { exists: true, vars: {} } : null);
    const closed = route.kind === 'private' || route.kind === 'alias' || route.kind === 'unknown';
    head = buildHeadHtml(fallback);
    if (!closed && route.path !== '/') head = head.replace(/<meta name="robots"[^>]*>\s*/, '');
    robots = closed ? DEFAULT_ROBOTS_NOINDEX : route.path === '/' ? fallback.robots : null;
  }
  const notFound = route.kind === 'unknown' && (!meta || meta.source === 'unknown') && !APP_ROUTES.some((re) => re.test(route.path));
  if (notFound) {
    robots = DEFAULT_ROBOTS_NOINDEX;
    head = head.replace(/<meta name="robots"[^>]*>/, `<meta name="robots" content="${DEFAULT_ROBOTS_NOINDEX}" />`)
      .replace(/<link rel="canonical"[^>]*>\s*/, '');
  }
  let body = injectHead(html, head);
  // RI-07: el preload del fondo del hero solo sirve en la portada; fuera de ella
  // competiria con el LCP real (p. ej. el logo de /login).
  if (route.path !== '/') body = body.replace(/\s*<!-- hero-preload:start -->[\s\S]*?<!-- hero-preload:end -->/, '');
  if (route.path === '/') body = body.replace('<div id="root"></div>', `<div id="root">${HOME_STATIC}</div>`);
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'public, max-age=0, must-revalidate',
    'x-seo': meta ? 'panel' : 'fallback',
  };
  if (robots) headers['x-robots-tag'] = robots;
  res.writeHead(notFound ? 404 : 200, headers);
  res.end(isHead ? undefined : body);
}

async function proxyText(kind, contentType, isHead, res) {
  let text;
  let source = 'panel';
  try {
    const r = await fetchWithTimeout(`${FN}?kind=${kind}`, kind === 'sitemap' ? 5_000 : TIMEOUT_MS);
    if (!r.ok) throw new Error(`seo-meta ${kind} ${r.status}`);
    text = await r.text();
  } catch (error) {
    console.error('[seo]', kind, error.message);
    // El fichero estático de public/ sigue ahí de respaldo.
    text = await readFile(path.join(ROOT, kind === 'robots' ? 'robots.txt' : 'sitemap.xml'), 'utf8');
    source = 'fallback';
  }
  res.writeHead(200, {
    'content-type': contentType,
    'cache-control': 'public, max-age=0, must-revalidate',
    'x-robots-tag': 'index, follow, max-image-preview:large',
    'x-seo': source,
  });
  res.end(isHead ? undefined : text);
}

http.createServer(async (req, res) => {
  const isHead = req.method === 'HEAD';
  try {
    if (req.method !== 'GET' && !isHead) {
      res.writeHead(405, { allow: 'GET, HEAD' });
      return res.end();
    }
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/robots.txt') return await proxyText('robots', 'text/plain; charset=utf-8', isHead, res);
    if (pathname === '/sitemap.xml') return await proxyText('sitemap', 'application/xml; charset=utf-8', isHead, res);
    return await renderHtml(pathname, isHead, res);
  } catch (error) {
    console.error('[seo]', req.url, error.message);
    if (res.headersSent) return res.end();
    // Último recurso: index.html tal cual, como antes de este servicio.
    try {
      const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'x-seo': 'error' });
      res.end(isHead ? undefined : html);
    } catch {
      res.writeHead(502);
      res.end();
    }
  }
}).listen(PORT, '127.0.0.1', () => console.log(`[seo] escuchando en 127.0.0.1:${PORT}`));
