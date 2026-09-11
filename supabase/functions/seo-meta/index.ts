// SEO público de medical-masters.com.
//
//   GET ?path=/doctor/<id>   → JSON con el <head> ya resuelto para esa URL
//   GET ?kind=robots         → robots.txt
//   GET ?kind=sitemap        → sitemap.xml
//   GET ?kind=site           → { faviconUrl } (el middleware sirve el favicon del panel)
//
// Lo consume middleware.ts de Vercel en cada página y SeoRouteSync al navegar.
// verify_jwt = false: es público por diseño, igual que el HTML que alimenta.
//
// Dos clientes a propósito:
//   · service-role SOLO para leer site_settings 'seo_config' (su lectura pública es una
//     lista cerrada en RLS; ampliarla sería una migración).
//   · anon para los datos de médicos, lives, grabaciones, noticias y congresos, así la RLS
//     decide qué es público y esta función no puede enseñar nada que la web no enseñe ya.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SEO_SETTINGS_ID, buildRobotsTxt, buildSitemapXml, congressEntity, doctorEntity, entityInSitemap,
  entityPath, liveEntity, matchRoute, mergeSeoConfig, newsEntity, recordingEntity, resolveSeo,
  staticSitemapEntries, SITE_URL,
  type EntityData, type EntityType, type SeoConfig, type SitemapEntry,
} from "../_shared/seo-render.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const service = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const STORAGE_PUBLIC = `${SUPABASE_URL}/storage/v1/object/public/`;

let cached: { at: number; config: SeoConfig } | null = null;

async function getConfig(): Promise<SeoConfig> {
  if (cached && Date.now() - cached.at < 15_000) return cached.config;
  const { data, error } = await service.from("site_settings").select("value").eq("id", SEO_SETTINGS_ID).maybeSingle();
  if (error) {
    if (cached) return cached.config;
    throw new Error(`seo_config: ${error.message}`);
  }
  const config = mergeSeoConfig(data?.value ?? null);
  cached = { at: Date.now(), config };
  return config;
}

const NOT_FOUND: EntityData = { exists: false, vars: {} };

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? "error"}`);
}

async function doctorName(userId: string | null | undefined): Promise<string> {
  if (!userId) return "";
  const { data } = await anon.rpc("get_doctor_public_profile", { p_user_id: userId });
  const row = Array.isArray(data) ? data[0] : data;
  return row?.name ?? "";
}

// Distingue «no existe» (NOT_FOUND → noindex) de «la base falló» (excepción → 503),
// para que un corte momentáneo no le diga a Google que una ficha abierta ya no existe.
async function loadEntity(type: EntityType, id: string, siteName: string): Promise<EntityData> {
  if (type === "doctor") {
    const { data, error } = await anon.rpc("get_doctor_public_profile", { p_user_id: id });
    if (error) fail("doctor", error);
    const row = Array.isArray(data) ? data[0] : data;
    return row ? doctorEntity(row) : NOT_FOUND;
  }
  if (type === "live") {
    const { data, error } = await anon.from("lives")
      .select("id, title, description, specialty, thumbnail_url, doctor_id, started_at").eq("id", id).maybeSingle();
    if (error) fail("live", error);
    return data ? liveEntity(data, await doctorName(data.doctor_id)) : NOT_FOUND;
  }
  if (type === "recording") {
    const { data, error } = await anon.from("recordings_public")
      .select("id, title, description, specialty, thumbnail_url, doctor_id, created_at").eq("id", id).maybeSingle();
    if (error) fail("recording", error);
    return data ? recordingEntity(data, await doctorName(data.doctor_id)) : NOT_FOUND;
  }
  if (type === "news") {
    const { data, error } = await anon.from("medical_news")
      .select("id, slug, title, summary, image_url, category, published_at, created_at, updated_at")
      .eq("slug", id).eq("is_published", true).maybeSingle();
    if (error) fail("news", error);
    return data ? newsEntity(data, siteName) : NOT_FOUND;
  }
  const { data, error } = await anon.from("congresses")
    .select("id, title, description, specialty, banner_url, starts_at, ends_at, status, created_at").eq("id", id).maybeSingle();
  if (error) fail("congress", error);
  return data ? congressEntity(data, siteName) : NOT_FOUND;
}

async function listEntities(type: EntityType, siteName: string): Promise<{ id: string; entity: EntityData }[]> {
  if (type === "doctor") {
    const { data, error } = await anon.rpc("get_doctors_paginated", { p_page: 1, p_page_size: 1000, p_search: "", p_specialty: "", p_location: "" });
    if (error) fail("doctors", error);
    return (data ?? []).map((r: Record<string, unknown>) => ({ id: String(r.user_id), entity: doctorEntity(r) }));
  }
  if (type === "live") {
    const { data, error } = await anon.from("lives").select("id, title, started_at").order("started_at", { ascending: false }).limit(1000);
    if (error) fail("lives", error);
    return (data ?? []).map((r) => ({ id: r.id, entity: liveEntity(r) }));
  }
  if (type === "recording") {
    const { data, error } = await anon.from("recordings_public").select("id, title, thumbnail_url, created_at").order("created_at", { ascending: false }).limit(1000);
    if (error) fail("recordings", error);
    return (data ?? []).map((r) => ({ id: r.id, entity: recordingEntity(r) }));
  }
  if (type === "news") {
    const { data, error } = await anon.from("medical_news").select("slug, title, published_at, created_at, updated_at")
      .eq("is_published", true).not("slug", "is", null).order("published_at", { ascending: false }).limit(1000);
    if (error) fail("news", error);
    return (data ?? []).map((r) => ({ id: r.slug, entity: newsEntity(r, siteName) }));
  }
  const { data, error } = await anon.from("congresses").select("id, title, starts_at, created_at").limit(1000);
  if (error) fail("congresses", error);
  return (data ?? []).map((r) => ({ id: r.id, entity: congressEntity(r, siteName) }));
}

async function sitemapEntries(config: SeoConfig): Promise<SitemapEntry[]> {
  const entries = staticSitemapEntries(config);
  const types: EntityType[] = ["doctor", "live", "recording", "news", "congress"];
  for (const type of types) {
    const prefix = entityPath(type, "");
    const someOpen = config.types[type].index ||
      Object.entries(config.pages).some(([p, f]) => p.startsWith(prefix) && f.index === true);
    if (!someOpen) continue;
    for (const { id, entity } of await listEntities(type, config.site.name)) {
      if (entityInSitemap(config, type, id, entity)) {
        entries.push({ loc: `${SITE_URL}${entityPath(type, id)}`, lastmod: entity.lastmod });
      }
    }
  }
  return entries;
}

function respond(body: string, contentType: string, status = 200, cache = "public, max-age=30"): Response {
  return new Response(body, { status, headers: { ...CORS, "Content-Type": contentType, "Cache-Control": cache } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET") return respond(JSON.stringify({ error: "method_not_allowed" }), "application/json", 405, "no-store");

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "meta";
  try {
    const config = await getConfig();

    if (kind === "robots") return respond(buildRobotsTxt(config), "text/plain; charset=utf-8", 200, "public, max-age=60");
    if (kind === "sitemap") return respond(buildSitemapXml(await sitemapEntries(config)), "application/xml; charset=utf-8", 200, "public, max-age=300");
    if (kind === "site") {
      const favicon = config.site.faviconUrl.startsWith(STORAGE_PUBLIC) ? config.site.faviconUrl : "";
      return respond(JSON.stringify({ faviconUrl: favicon, updatedAt: config.updatedAt ?? null }), "application/json");
    }

    const rawPath = url.searchParams.get("path") ?? "/";
    if (rawPath.length > 512) return respond(JSON.stringify({ error: "path_too_long" }), "application/json", 400, "no-store");
    const route = matchRoute(rawPath);
    const entity = route.kind === "entity" ? await loadEntity(route.type, route.id, config.site.name) : null;
    return respond(JSON.stringify(resolveSeo(config, route.path, entity)), "application/json");
  } catch (error) {
    console.error("[seo-meta]", kind, (error as Error).message);
    return respond(JSON.stringify({ error: "seo_unavailable" }), "application/json", 503, "no-store");
  }
});
