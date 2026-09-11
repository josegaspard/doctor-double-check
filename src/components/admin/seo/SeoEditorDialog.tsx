import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ExternalLink, Loader2, RotateCcw, Save } from 'lucide-react';
import {
  ENTITY_TYPES, SITE_URL, isPrivatePath, resolveSeo, seoWarnings,
  type EntityData, type SeoConfig, type SeoFields,
} from '@/lib/seo';
import { CharCount, GooglePreview, SocialPreview } from './SeoPreviews';
import { SeoImageUpload } from './SeoImageUpload';

const TEXT_KEYS = ['title', 'description', 'keywords', 'ogTitle', 'ogDescription', 'ogImage', 'canonical'] as const;

function clean(fields: SeoFields): SeoFields | null {
  const out: SeoFields = {};
  for (const key of TEXT_KEYS) {
    const v = (fields[key] || '').trim();
    if (v) out[key] = v;
  }
  if (out.title && fields.ignoreTemplate) out.ignoreTemplate = true;
  if (typeof fields.index === 'boolean') out.index = fields.index;
  if (fields.sitemap === false) out.sitemap = false;
  return Object.keys(out).length ? out : null;
}

export function faviconPreviewSrc(config: SeoConfig) {
  return config.site.faviconUrl || '/favicon.png?v=18';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: SeoConfig;
  path: string;
  heading: string;
  entity?: EntityData | null;
  saving: boolean;
  onSave: (fields: SeoFields | null) => Promise<boolean>;
}

export function SeoEditorDialog({ open, onOpenChange, config, path, heading, entity, saving, onSave }: Props) {
  const [fields, setFields] = useState<SeoFields>({});

  useEffect(() => {
    if (open) setFields({ ...(config.pages[path] || {}) });
  }, [open, path, config.pages]);

  const withoutOverride = useMemo(() => {
    const pages = { ...config.pages };
    delete pages[path];
    return { ...config, pages };
  }, [config, path]);

  const auto = useMemo(() => resolveSeo(withoutOverride, path, entity), [withoutOverride, path, entity]);
  const preview = useMemo(() => {
    const cleaned = clean(fields);
    return resolveSeo({ ...withoutOverride, pages: cleaned ? { ...withoutOverride.pages, [path]: cleaned } : withoutOverride.pages }, path, entity);
  }, [withoutOverride, fields, path, entity]);
  const warnings = seoWarnings(preview, config);

  const typeInfo = auto.entityType ? ENTITY_TYPES.find((t) => t.type === auto.entityType) : undefined;
  const inheritLabel = typeInfo
    ? `Como el resto de ${typeInfo.label.toLowerCase()} (${auto.index ? 'visibles' : 'ocultos'})`
    : `Automático (${auto.index ? 'visible' : 'oculta'})`;
  const indexValue = typeof fields.index === 'boolean' ? (fields.index ? 'yes' : 'no') : 'inherit';
  const privatePath = isPrivatePath(path);
  const notFound = auto.source === 'entity' && entity && !entity.exists;
  const set = (patch: Partial<SeoFields>) => setFields((f) => ({ ...f, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-3xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-secondary pr-6 break-words">{heading}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-secondary/70">
            <span className="font-mono text-xs break-all">{path}</span>
            {!privatePath && (
              <a href={`${SITE_URL}${path}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Ver la página <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        {privatePath ? (
          <p className="text-sm text-secondary/80">Esta URL es zona privada de la plataforma (sesión, pagos o expediente). Nunca se muestra a Google y no se puede personalizar.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
            <div className="space-y-4 min-w-0">
              {notFound && (
                <p className="rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-secondary">
                  Esta ficha ya no existe o no es pública: queda fuera de Google aunque la marques como visible.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-secondary">¿Visible en Google?</Label>
                  <Select value={indexValue} onValueChange={(v) => set({ index: v === 'inherit' ? undefined : v === 'yes' })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">{inheritLabel}</SelectItem>
                      <SelectItem value="yes">Sí, visible en Google</SelectItem>
                      <SelectItem value="no">No, oculta a Google</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2 pb-1.5">
                  <Switch
                    id="seo-sitemap"
                    checked={preview.index && fields.sitemap !== false}
                    disabled={!preview.index}
                    onCheckedChange={(v) => set({ sitemap: v ? undefined : false })}
                  />
                  <Label htmlFor="seo-sitemap" className="text-xs text-secondary">Incluir en el sitemap</Label>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="seo-title" className="text-xs text-secondary">Título SEO</Label>
                  <CharCount value={preview.title} min={30} max={60} />
                </div>
                <Input id="seo-title" value={fields.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder={auto.title} className="text-sm" />
                <div className="flex items-center gap-2">
                  <Switch id="seo-ignore" checked={!!fields.ignoreTemplate} disabled={!fields.title} onCheckedChange={(v) => set({ ignoreTemplate: v })} />
                  <Label htmlFor="seo-ignore" className="text-[11px] text-secondary/70">Usar el título tal cual, sin añadir «| {config.site.name}»</Label>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="seo-desc" className="text-xs text-secondary">Meta descripción</Label>
                  <CharCount value={preview.description} min={70} max={160} />
                </div>
                <Textarea id="seo-desc" value={fields.description || ''} onChange={(e) => set({ description: e.target.value })} placeholder={auto.description} className="text-sm min-h-[84px]" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="seo-kw" className="text-xs text-secondary">Palabras clave <span className="text-secondary/50">(opcional)</span></Label>
                <Input id="seo-kw" value={fields.keywords || ''} onChange={(e) => set({ keywords: e.target.value })} placeholder="separadas por comas" className="text-sm" />
              </div>

              <div className="rounded-xl border border-secondary/15 p-3 space-y-3">
                <p className="text-xs font-semibold text-secondary">Al compartir en redes (WhatsApp, Facebook, LinkedIn, X)</p>
                <div className="space-y-1.5">
                  <Label htmlFor="seo-ogt" className="text-xs text-secondary">Título para redes</Label>
                  <Input id="seo-ogt" value={fields.ogTitle || ''} onChange={(e) => set({ ogTitle: e.target.value })} placeholder={preview.title} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="seo-ogd" className="text-xs text-secondary">Descripción para redes</Label>
                  <Textarea id="seo-ogd" value={fields.ogDescription || ''} onChange={(e) => set({ ogDescription: e.target.value })} placeholder={preview.description} className="text-sm min-h-[64px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-secondary">Imagen para redes</Label>
                  <SeoImageUpload kind="social" value={fields.ogImage || ''} onChange={(url) => set({ ogImage: url })} allowUrl />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="seo-canon" className="text-xs text-secondary">URL canónica <span className="text-secondary/50">(avanzado)</span></Label>
                <Input id="seo-canon" value={fields.canonical || ''} onChange={(e) => set({ canonical: e.target.value })} placeholder={auto.canonical} className="text-sm" />
                <p className="text-[11px] text-secondary/60">Déjala vacía salvo que esta página duplique a otra: entonces pon aquí la URL principal.</p>
              </div>
            </div>

            <div className="space-y-3 min-w-0">
              <p className="text-xs font-semibold text-secondary">Así se vería en Google</p>
              <GooglePreview title={preview.title} description={preview.description} url={preview.canonical} siteName={config.site.name} faviconSrc={faviconPreviewSrc(config)} />
              <p className="text-xs font-semibold text-secondary pt-1">Así se vería al compartir</p>
              <SocialPreview title={preview.ogTitle} description={preview.ogDescription} image={preview.ogImage} url={preview.canonical} />
              {warnings.length > 0 && (
                <ul className="space-y-1.5 rounded-lg bg-warning/10 border border-warning/30 p-3">
                  {warnings.map((w) => (
                    <li key={w} className="flex gap-1.5 text-[11px] text-secondary">
                      <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-px" />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-2">
          <div>
            {config.pages[path] && !privatePath && (
              <Button type="button" variant="ghost" onClick={async () => { if (await onSave(null)) onOpenChange(false); }} disabled={saving} className="w-full sm:w-auto text-secondary">
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Volver a automático
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            {!privatePath && (
              <Button type="button" onClick={async () => { if (await onSave(clean(fields))) onOpenChange(false); }} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                Guardar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
