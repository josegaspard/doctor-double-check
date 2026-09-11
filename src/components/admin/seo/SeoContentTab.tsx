import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Loader2, Pencil, Search, Users } from 'lucide-react';
import {
  ENTITY_TYPES, SITE_URL, congressEntity, doctorEntity, entityPath, liveEntity, newsEntity, recordingEntity, resolveSeo, seoWarnings,
  type EntityData, type EntityType, type SeoConfig, type SeoFields,
} from '@/lib/seo';
import { GooglePreview } from './SeoPreviews';
import { SeoEditorDialog, faviconPreviewSrc } from './SeoEditorDialog';
import { SEO_CARD } from './SeoGeneralTab';
import { SeoStatusBadges } from './SeoPagesTab';

interface Item { id: string; name: string; detail: string; image: string; draft?: boolean; entity: EntityData }

const SCHEMA_LABEL: Partial<Record<EntityType, string>> = {
  doctor: 'Ficha de perfil (ProfilePage)', recording: 'Vídeo (VideoObject)', news: 'Noticia (NewsArticle)', congress: 'Evento (Event)',
};
const PAGE = 30;
const sb = supabase as any;

// Las mismas fuentes que la función seo-meta: lo que se ve aquí es lo que ve Google.
async function loadItems(type: EntityType, siteName: string): Promise<Item[]> {
  const { data: doctors } = await sb.rpc('get_doctors_paginated', { p_page: 1, p_page_size: 1000, p_search: '', p_specialty: '', p_location: '' });
  const names = new Map<string, string>((doctors || []).map((d: any) => [d.user_id, d.name]));
  if (type === 'doctor') {
    return (doctors || []).map((d: any) => ({
      id: d.user_id, name: d.name || 'Sin nombre', detail: [d.specialty, d.location].filter(Boolean).join(' · '), image: d.avatar_url || '', entity: doctorEntity(d),
    }));
  }
  if (type === 'live') {
    const { data, error } = await sb.from('lives').select('id, title, description, specialty, thumbnail_url, doctor_id, status, started_at').order('started_at', { ascending: false }).limit(300);
    if (error) throw error;
    return (data || []).map((r: any) => ({ id: r.id, name: r.title, detail: [names.get(r.doctor_id), r.specialty, r.status].filter(Boolean).join(' · '), image: r.thumbnail_url || '', entity: liveEntity(r, names.get(r.doctor_id) || '') }));
  }
  if (type === 'recording') {
    const { data, error } = await sb.from('recordings_public').select('id, title, description, specialty, thumbnail_url, doctor_id, created_at').order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    return (data || []).map((r: any) => ({ id: r.id, name: r.title, detail: [names.get(r.doctor_id), r.specialty].filter(Boolean).join(' · '), image: r.thumbnail_url || '', entity: recordingEntity(r, names.get(r.doctor_id) || '') }));
  }
  if (type === 'news') {
    const { data, error } = await sb.from('medical_news').select('id, slug, title, summary, image_url, category, is_published, published_at, created_at, updated_at').not('slug', 'is', null).order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.slug, name: r.title, detail: [r.category, r.is_published ? 'Publicada' : 'Borrador'].filter(Boolean).join(' · '), image: r.image_url || '', draft: !r.is_published,
      entity: r.is_published ? newsEntity(r, siteName) : { exists: false, vars: {} },
    }));
  }
  const { data, error } = await sb.from('congresses').select('id, title, description, specialty, banner_url, starts_at, ends_at, status, created_at').order('starts_at', { ascending: false }).limit(300);
  if (error) throw error;
  return (data || []).map((r: any) => ({ id: r.id, name: r.title, detail: [r.specialty, r.starts_at, r.status === 'archived' ? 'Archivado' : ''].filter(Boolean).join(' · '), image: r.banner_url || '', entity: congressEntity(r, siteName) }));
}

interface Props {
  config: SeoConfig;
  setConfig: Dispatch<SetStateAction<SeoConfig>>;
  saving: boolean;
  saveFields: (path: string, fields: SeoFields | null) => Promise<boolean>;
}

export function SeoContentTab({ config, setConfig, saving, saveFields }: Props) {
  const [type, setType] = useState<EntityType>('doctor');
  const [items, setItems] = useState<Partial<Record<EntityType, Item[]>>>({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Item | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const info = ENTITY_TYPES.find((t) => t.type === type)!;
  const typeCfg = config.types[type];
  const list = items[type];

  useEffect(() => {
    if (items[type]) return;
    let cancelled = false;
    setError(null);
    loadItems(type, config.site.name)
      .then((rows) => { if (!cancelled) setItems((prev) => ({ ...prev, [type]: rows })); })
      .catch((e) => { if (!cancelled) setError(e?.message || 'No se pudo cargar el contenido.'); });
    return () => { cancelled = true; };
  }, [type, items, config.site.name]);

  const setType_ = (patch: Partial<SeoConfig['types'][EntityType]>) =>
    setConfig((c) => ({ ...c, types: { ...c.types, [type]: { ...c.types[type], ...patch } } }));

  const insertVar = (field: 'titleTemplate' | 'descriptionTemplate', key: string) => {
    const el = field === 'titleTemplate' ? titleRef.current : descRef.current;
    const current = typeCfg[field];
    const pos = el?.selectionStart ?? current.length;
    setType_({ [field]: `${current.slice(0, pos)}{${key}}${current.slice(pos)}` });
  };

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => (list || []).filter((it) => !q || `${it.name} ${it.detail}`.toLowerCase().includes(q)), [list, q]);
  const sample = list?.find((it) => it.entity.exists);
  const sampleSeo = sample ? resolveSeo(config, entityPath(type, sample.id), sample.entity) : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
        {ENTITY_TYPES.map((t) => (
          <Button
            key={t.type}
            size="sm"
            variant="outline"
            aria-pressed={t.type === type}
            onClick={() => { setType(t.type); setQuery(''); setLimit(PAGE); }}
            className={t.type === type ? 'flex-shrink-0 bg-white text-secondary border-white shadow hover:bg-white' : 'flex-shrink-0 bg-white/10 text-white border-white/40 hover:bg-white/20 hover:text-white'}
          >
            {t.label}
            {config.types[t.type].index && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-success" aria-label="visible en Google" />}
          </Button>
        ))}
      </div>

      <Card className={SEO_CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-secondary"><Users className="w-5 h-5 text-primary" />Reglas para todos: {info.label.toLowerCase()}</CardTitle>
          <CardDescription className="text-xs text-secondary/70">
            Se aplican a cada {info.singular.toLowerCase()} que publiquen los usuarios, también a los que se creen mañana. Cada uno se puede ajustar a mano en la lista de abajo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-secondary/15 p-3">
              <span className="text-sm text-secondary"><span className="font-semibold">Visibles en Google</span><br /><span className="text-[11px] text-secondary/60">Si está apagado, Google no los indexa.</span></span>
              <Switch checked={typeCfg.index} onCheckedChange={(v) => setType_({ index: v })} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-secondary/15 p-3">
              <span className="text-sm text-secondary"><span className="font-semibold">Incluir en el sitemap</span><br /><span className="text-[11px] text-secondary/60">Solo los visibles.</span></span>
              <Switch checked={typeCfg.sitemap} disabled={!typeCfg.index} onCheckedChange={(v) => setType_({ sitemap: v })} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-secondary/15 p-3">
              <span className="text-sm text-secondary"><span className="font-semibold">Usar su foto al compartir</span><br /><span className="text-[11px] text-secondary/60">Foto del médico, miniatura o portada.</span></span>
              <Switch checked={typeCfg.useContentImage} onCheckedChange={(v) => setType_({ useContentImage: v })} />
            </label>
            {SCHEMA_LABEL[type] && (
              <label className="flex items-center justify-between gap-3 rounded-xl border border-secondary/15 p-3">
                <span className="text-sm text-secondary"><span className="font-semibold">Datos estructurados</span><br /><span className="text-[11px] text-secondary/60">{SCHEMA_LABEL[type]}</span></span>
                <Switch checked={typeCfg.structuredData} onCheckedChange={(v) => setType_({ structuredData: v })} />
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seo-type-title" className="text-xs text-secondary">Plantilla del título</Label>
            <Input id="seo-type-title" ref={titleRef} value={typeCfg.titleTemplate} onChange={(e) => setType_({ titleTemplate: e.target.value })} className="text-sm font-mono" />
            <div className="flex flex-wrap gap-1">
              {info.variables.map((v) => (
                <button key={v.key} type="button" onClick={() => insertVar('titleTemplate', v.key)} className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/20">+ {v.label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seo-type-desc" className="text-xs text-secondary">Plantilla de la descripción</Label>
            <Textarea id="seo-type-desc" ref={descRef} value={typeCfg.descriptionTemplate} onChange={(e) => setType_({ descriptionTemplate: e.target.value })} className="text-sm font-mono min-h-[70px]" />
            <div className="flex flex-wrap gap-1">
              {info.variables.map((v) => (
                <button key={v.key} type="button" onClick={() => insertVar('descriptionTemplate', v.key)} className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/20">+ {v.label}</button>
              ))}
            </div>
            <p className="text-[11px] text-secondary/60">Lo que pongas [entre corchetes] solo aparece si el dato existe: «{'{nombre}[ en {ciudad}]'}» no deja un «en» colgando si falta la ciudad. Estos cambios se guardan con el botón «Guardar cambios».</p>
          </div>
          {sampleSeo && sample && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-secondary">Ejemplo con «{sample.name}»</p>
              <GooglePreview title={sampleSeo.title} description={sampleSeo.description} url={sampleSeo.canonical} siteName={config.site.name} faviconSrc={faviconPreviewSrc(config)} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={SEO_CARD}>
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-secondary/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder={`Buscar en ${info.label.toLowerCase()}…`} className="pl-9 text-sm" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!list && !error && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
          {list && filtered.length === 0 && <p className="py-6 text-center text-sm text-secondary/70">{list.length === 0 ? `Todavía no hay ${info.label.toLowerCase()} publicados.` : 'Nada coincide con la búsqueda.'}</p>}
          <div className="divide-y divide-secondary/10">
            {filtered.slice(0, limit).map((it) => {
              const path = entityPath(type, it.id);
              const r = resolveSeo(config, path, it.entity);
              return (
                <div key={it.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {it.image ? <img src={it.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-[#e9eef5]" /> : <div className="w-10 h-10 rounded-lg bg-[#e9eef5] flex-shrink-0" />}
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-secondary break-words">{it.name}</p>
                      {it.detail && <p className="text-[11px] text-secondary/60 break-words">{it.detail}</p>}
                      <p className="text-xs text-secondary/80 truncate">{r.title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <SeoStatusBadges r={r} warnings={it.entity.exists ? seoWarnings(r, config).length : 0} />
                        {it.draft && <Badge variant="outline" className="text-[10px] border-secondary/25 text-secondary/70">No publicada</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 self-start sm:self-center">
                    <Button variant="outline" size="sm" onClick={() => setEditing(it)} className="gap-1.5"><Pencil className="w-3.5 h-3.5" />Editar SEO</Button>
                    {!it.draft && (
                      <Button asChild variant="ghost" size="icon" className="h-9 w-9" aria-label="Ver la página">
                        <a href={`${SITE_URL}${path}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {filtered.length > limit && (
            <Button variant="outline" className="w-full" onClick={() => setLimit((n) => n + PAGE)}>Ver {Math.min(PAGE, filtered.length - limit)} más</Button>
          )}
        </CardContent>
      </Card>

      {editing && (
        <SeoEditorDialog
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null); }}
          config={config}
          path={entityPath(type, editing.id)}
          heading={`${info.singular}: ${editing.name}`}
          entity={editing.entity}
          saving={saving}
          onSave={(fields) => saveFields(entityPath(type, editing.id), fields)}
        />
      )}
    </div>
  );
}
