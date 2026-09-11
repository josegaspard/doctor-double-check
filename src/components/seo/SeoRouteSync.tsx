import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { isPrivatePath, normalizePath, type ResolvedSeo } from '@/lib/seo';

// La primera carga de cada URL ya trae su <head> escrito por middleware.ts. Esto solo
// actualiza título, descripción, robots y canonical cuando se navega dentro de la app
// sin recargar, para que la pestaña no se quede con el título de la página anterior.
const FN = 'https://ouawwfqexfwuptlgoksr.supabase.co/functions/v1/seo-meta';
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: ResolvedSeo }>();
let lastSiteName = 'Medical Masters';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

function apply(r: ResolvedSeo) {
  lastSiteName = r.siteName || lastSiteName;
  document.title = r.title;
  setMeta('name', 'description', r.description);
  setMeta('name', 'robots', r.robots);
  setCanonical(r.canonical);
  setMeta('property', 'og:title', r.ogTitle);
  setMeta('property', 'og:description', r.ogDescription);
  setMeta('property', 'og:url', r.canonical);
  setMeta('property', 'og:image', r.ogImage);
}

export function SeoRouteSync() {
  const { pathname } = useLocation();
  const firstLoad = useRef(true);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const path = normalizePath(pathname);
    if (isPrivatePath(path)) {
      // Zona privada: sin llamada a la red, solo que la pestaña no mienta.
      document.title = lastSiteName;
      setMeta('name', 'robots', 'noindex, nofollow');
      return;
    }
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < TTL_MS) {
      apply(hit.value);
      return;
    }
    let cancelled = false;
    fetch(`${FN}?path=${encodeURIComponent(path)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((value: ResolvedSeo | null) => {
        if (!value || typeof value.title !== 'string') return;
        cache.set(path, { at: Date.now(), value });
        if (!cancelled) apply(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
