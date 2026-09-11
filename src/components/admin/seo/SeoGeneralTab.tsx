import type { Dispatch, SetStateAction } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Globe, Image as ImageIcon, Sparkles } from 'lucide-react';
import { applyTitleTemplate, resolveSeo, type SeoConfig } from '@/lib/seo';
import { CharCount, GooglePreview, SocialPreview } from './SeoPreviews';
import { SeoImageUpload } from './SeoImageUpload';
import { faviconPreviewSrc } from './SeoEditorDialog';

const LOCALES = [
  { value: 'es_ES', label: 'Español (España)' },
  { value: 'es_MX', label: 'Español (México)' },
  { value: 'es_LA', label: 'Español (Latinoamérica)' },
  { value: 'en_US', label: 'Inglés (EE. UU.)' },
  { value: 'pt_BR', label: 'Portugués (Brasil)' },
  { value: 'fr_FR', label: 'Francés' },
  { value: 'it_IT', label: 'Italiano' },
  { value: 'de_DE', label: 'Alemán' },
];

export const SEO_CARD = 'bg-white border-2 border-primary/20 rounded-xl';

interface Props {
  config: SeoConfig;
  setConfig: Dispatch<SetStateAction<SeoConfig>>;
}

export function SeoGeneralTab({ config, setConfig }: Props) {
  const site = config.site;
  const setSite = (patch: Partial<SeoConfig['site']>) => setConfig((c) => ({ ...c, site: { ...c.site, ...patch } }));
  const home = resolveSeo(config, '/');
  const example = applyTitleTemplate(site.titleTemplate, 'Explorar doctores', site.name);

  return (
    <div className="space-y-4">
      <Card className={SEO_CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-secondary"><Sparkles className="w-5 h-5 text-primary" />Identidad del sitio</CardTitle>
          <CardDescription className="text-xs text-secondary/70">Lo que Google enseña de la marca y de la página de inicio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="seo-site-name" className="text-xs text-secondary">Nombre del sitio</Label>
              <Input id="seo-site-name" value={site.name} onChange={(e) => setSite({ name: e.target.value })} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-template" className="text-xs text-secondary">Plantilla de los títulos</Label>
              <Input id="seo-template" value={site.titleTemplate} onChange={(e) => setSite({ titleTemplate: e.target.value })} className="text-sm font-mono" />
              <p className="text-[11px] text-secondary/60 break-words">Usa {'{titulo}'} y {'{sitio}'}. Ejemplo: «{example}»</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="seo-home-title" className="text-xs text-secondary">Título de la página de inicio</Label>
              <CharCount value={site.homeTitle} min={30} max={60} />
            </div>
            <Input id="seo-home-title" value={site.homeTitle} onChange={(e) => setSite({ homeTitle: e.target.value })} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="seo-default-desc" className="text-xs text-secondary">Descripción general</Label>
              <CharCount value={site.defaultDescription} min={70} max={160} />
            </div>
            <Textarea id="seo-default-desc" value={site.defaultDescription} onChange={(e) => setSite({ defaultDescription: e.target.value })} className="text-sm min-h-[84px]" />
            <p className="text-[11px] text-secondary/60">Se usa en la página de inicio y en toda página que no tenga descripción propia.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seo-keywords" className="text-xs text-secondary">Palabras clave de la página de inicio</Label>
            <Input id="seo-keywords" value={site.keywords} onChange={(e) => setSite({ keywords: e.target.value })} className="text-sm" />
            <p className="text-[11px] text-secondary/60">Google no las usa para posicionar; algunos buscadores y herramientas sí.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-secondary">Idioma y región al compartir</Label>
              <Select value={site.locale} onValueChange={(v) => setSite({ locale: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-x" className="text-xs text-secondary">Usuario de X (Twitter)</Label>
              <Input id="seo-x" value={site.twitterSite} onChange={(e) => setSite({ twitterSite: e.target.value })} placeholder="@MedicalMasters" className="text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={SEO_CARD}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-secondary"><Globe className="w-5 h-5 text-primary" />Favicon</CardTitle>
            <CardDescription className="text-xs text-secondary/70">El icono de la pestaña del navegador y el que Google pone junto al resultado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SeoImageUpload kind="favicon" value={site.faviconUrl} onChange={(url) => setSite({ faviconUrl: url })} />
            <div className="rounded-t-xl bg-[#dee1e6] px-2 pt-2">
              <div className="flex items-center gap-2 rounded-t-lg bg-white px-3 py-2 max-w-[260px]">
                <img src={faviconPreviewSrc(config)} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                <span className="text-xs text-[#202124] truncate">{home.title}</span>
              </div>
            </div>
            <p className="text-[11px] text-secondary/60">
              {site.faviconUrl ? 'Sin subir nada se usa el favicon original de la marca.' : 'Ahora mismo se usa el favicon original de la marca.'} Google tarda días o semanas en cambiar el icono de sus resultados.
            </p>
          </CardContent>
        </Card>

        <Card className={SEO_CARD}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-secondary"><ImageIcon className="w-5 h-5 text-primary" />Imagen para compartir</CardTitle>
            <CardDescription className="text-xs text-secondary/70">La que sale al pegar un enlace del sitio en WhatsApp, Facebook, LinkedIn o X, cuando la página no tiene una propia.</CardDescription>
          </CardHeader>
          <CardContent>
            <SeoImageUpload
              kind="social"
              value={site.ogImageUrl}
              onChange={(url, size) => setSite({ ogImageUrl: url, ogImageWidth: url ? size?.width ?? 0 : 0, ogImageHeight: url ? size?.height ?? 0 : 0 })}
            />
          </CardContent>
        </Card>
      </div>

      <Card className={SEO_CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-secondary"><Eye className="w-5 h-5 text-primary" />Vista previa de la página de inicio</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 min-w-0">
            <p className="text-xs font-semibold text-secondary">En Google</p>
            <GooglePreview title={home.title} description={home.description} url={home.canonical} siteName={site.name} faviconSrc={faviconPreviewSrc(config)} />
          </div>
          <div className="space-y-2 min-w-0">
            <p className="text-xs font-semibold text-secondary">Al compartir</p>
            <SocialPreview title={home.ogTitle} description={home.ogDescription} image={home.ogImage} url={home.canonical} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
