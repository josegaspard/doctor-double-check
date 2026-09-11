import type { Dispatch, SetStateAction } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BadgeCheck, Bot, ExternalLink, FileCode2, Lock, Map as MapIcon } from 'lucide-react';
import {
  ENTITY_TYPES, PUBLIC_PAGES, SITE_URL, buildRobotsTxt, cleanVerificationCode, matchRoute, resolveSeo, sanitizeRobotsExtra,
  type SeoConfig,
} from '@/lib/seo';
import { SEO_CARD } from './SeoGeneralTab';

const VERIFICATIONS: { key: keyof SeoConfig['verification']; label: string; hint: string }[] = [
  { key: 'google', label: 'Google Search Console', hint: 'google-site-verification' },
  { key: 'bing', label: 'Bing Webmaster Tools', hint: 'msvalidate.01' },
  { key: 'yandex', label: 'Yandex', hint: 'yandex-verification' },
  { key: 'pinterest', label: 'Pinterest', hint: 'p:domain_verify' },
  { key: 'facebook', label: 'Facebook (Meta Business)', hint: 'facebook-domain-verification' },
];

interface Props {
  config: SeoConfig;
  setConfig: Dispatch<SetStateAction<SeoConfig>>;
}

export function SeoIndexingTab({ config, setConfig }: Props) {
  const openPages = PUBLIC_PAGES.filter((p) => resolveSeo(config, p.path).index);
  const openTypes = ENTITY_TYPES.filter((t) => config.types[t.type].index);
  const openOverrides = Object.entries(config.pages).filter(([path, f]) => f.index === true && matchRoute(path).kind !== 'page').length;
  const extraLines = config.indexing.robotsExtra.split(/\r?\n/).filter((l) => l.trim()).length;
  const ignored = extraLines - sanitizeRobotsExtra(config.indexing.robotsExtra).length;

  const setVerification = (key: keyof SeoConfig['verification'], value: string) =>
    setConfig((c) => ({ ...c, verification: { ...c.verification, [key]: value } }));

  return (
    <div className="space-y-4">
      <Card className={SEO_CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-secondary"><Bot className="w-5 h-5 text-primary" />Qué puede ver Google ahora</CardTitle>
          <CardDescription className="text-xs text-secondary/70">Se abre o se cierra página por página («Páginas») o por tipo de contenido («Contenido de usuarios»). La web lo aplica sola en menos de un minuto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3">
              <p className="text-2xl font-bold text-secondary">{openPages.length}<span className="text-sm font-medium text-secondary/60"> / {PUBLIC_PAGES.length}</span></p>
              <p className="text-xs text-secondary/70">páginas visibles en Google</p>
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3">
              <p className="text-2xl font-bold text-secondary">{openTypes.length}<span className="text-sm font-medium text-secondary/60"> / {ENTITY_TYPES.length}</span></p>
              <p className="text-xs text-secondary/70">tipos de contenido abiertos</p>
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3">
              <p className="text-2xl font-bold text-secondary">{openOverrides}</p>
              <p className="text-xs text-secondary/70">fichas o URLs abiertas una a una</p>
            </div>
          </div>
          <p className="text-xs text-secondary/80 break-words">
            <span className="font-semibold">Visibles:</span> {openPages.map((p) => p.label).join(', ') || 'ninguna'}
            {openTypes.length > 0 && <> · <span className="font-semibold">Contenido:</span> {openTypes.map((t) => t.label).join(', ')}</>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={`${SITE_URL}/robots.txt`} target="_blank" rel="noopener noreferrer"><FileCode2 className="w-4 h-4" />Ver robots.txt<ExternalLink className="w-3 h-3" /></a>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={`${SITE_URL}/sitemap.xml`} target="_blank" rel="noopener noreferrer"><MapIcon className="w-4 h-4" />Ver sitemap<ExternalLink className="w-3 h-3" /></a>
            </Button>
          </div>
          <p className="flex gap-2 rounded-lg bg-[#f3f6fa] p-3 text-[11px] text-secondary/80">
            <Lock className="w-4 h-4 flex-shrink-0 text-secondary/60" />
            Los paneles, el chat, el expediente, los pagos y la administración son zona privada: nunca se muestran a Google, se configure lo que se configure.
          </p>
        </CardContent>
      </Card>

      <Card className={SEO_CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-secondary"><FileCode2 className="w-5 h-5 text-primary" />robots.txt</CardTitle>
          <CardDescription className="text-xs text-secondary/70">Se genera solo a partir de lo que está visible. Aquí puedes añadir reglas propias (por ejemplo, para bloquear un robot concreto).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="seo-robots-extra" className="text-xs text-secondary">Reglas adicionales</Label>
            <Textarea
              id="seo-robots-extra"
              value={config.indexing.robotsExtra}
              onChange={(e) => setConfig((c) => ({ ...c, indexing: { ...c.indexing, robotsExtra: e.target.value } }))}
              placeholder={'User-agent: GPTBot\nDisallow: /'}
              className="text-sm font-mono min-h-[90px]"
            />
            <p className="text-[11px] text-secondary/60">Líneas admitidas: User-agent, Allow, Disallow, Crawl-delay y comentarios con #. {ignored > 0 && <span className="text-warning font-medium">{ignored} línea(s) no válidas se ignorarán.</span>}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-secondary">Así queda</p>
            <pre className="max-h-64 overflow-auto rounded-lg bg-[#f3f6fa] border border-secondary/10 p-3 text-[11px] leading-relaxed text-secondary">{buildRobotsTxt(config)}</pre>
          </div>
        </CardContent>
      </Card>

      <Card className={SEO_CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-secondary"><BadgeCheck className="w-5 h-5 text-primary" />Verificación de propiedad</CardTitle>
          <CardDescription className="text-xs text-secondary/70">Pega el código o la etiqueta &lt;meta&gt; entera que te da cada herramienta. Se añade a la página de inicio.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {VERIFICATIONS.map((v) => {
            const raw = config.verification[v.key];
            const code = cleanVerificationCode(raw);
            return (
              <div key={v.key} className="space-y-1.5 min-w-0">
                <Label htmlFor={`seo-verif-${v.key}`} className="text-xs text-secondary">{v.label}</Label>
                <Input id={`seo-verif-${v.key}`} value={raw} onChange={(e) => setVerification(v.key, e.target.value)} placeholder={v.hint} className="text-sm font-mono" />
                {raw.trim() && (
                  <p className={code ? 'text-[11px] text-success' : 'text-[11px] text-destructive'}>
                    {code ? `Se publicará: ${code}` : 'No parece un código de verificación.'}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
