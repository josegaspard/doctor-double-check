import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Code2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { organizationJsonLd, type SeoConfig } from '@/lib/seo';
import { SeoImageUpload } from './SeoImageUpload';
import { SEO_CARD } from './SeoGeneralTab';

// Valores de la enumeración MedicalSpecialty de schema.org.
const SPECIALTIES: { value: string; label: string }[] = [
  { value: 'PrimaryCare', label: 'Atención primaria' }, { value: 'Cardiovascular', label: 'Cardiología' },
  { value: 'Dermatology', label: 'Dermatología' }, { value: 'DietNutrition', label: 'Nutrición' },
  { value: 'Emergency', label: 'Urgencias' }, { value: 'Endocrine', label: 'Endocrinología' },
  { value: 'Gastroenterologic', label: 'Gastroenterología' }, { value: 'Geriatric', label: 'Geriatría' },
  { value: 'Gynecologic', label: 'Ginecología' }, { value: 'Infectious', label: 'Infectología' },
  { value: 'Musculoskeletal', label: 'Traumatología' }, { value: 'Neurologic', label: 'Neurología' },
  { value: 'Obstetric', label: 'Obstetricia' }, { value: 'Oncologic', label: 'Oncología' },
  { value: 'Pediatric', label: 'Pediatría' }, { value: 'PlasticSurgery', label: 'Cirugía plástica' },
  { value: 'Psychiatric', label: 'Psiquiatría' }, { value: 'Pulmonary', label: 'Neumología' },
  { value: 'Renal', label: 'Nefrología' }, { value: 'Rheumatologic', label: 'Reumatología' },
  { value: 'Surgical', label: 'Cirugía' }, { value: 'Urologic', label: 'Urología' },
];

interface Props {
  config: SeoConfig;
  setConfig: Dispatch<SetStateAction<SeoConfig>>;
}

export function SeoSchemaTab({ config, setConfig }: Props) {
  const org = config.organization;
  const setOrg = (patch: Partial<SeoConfig['organization']>) => setConfig((c) => ({ ...c, organization: { ...c.organization, ...patch } }));
  // Los valores guardados que no están en la lista (p. ej. los que ya traía la web) se enseñan igual.
  const options = [...SPECIALTIES, ...org.medicalSpecialty.filter((v) => !SPECIALTIES.some((s) => s.value === v)).map((v) => ({ value: v, label: v }))];

  const importSocial = async () => {
    const { data, error } = await supabase.from('site_settings').select('value').eq('id', 'social_links').maybeSingle();
    if (error) return toast.error('No se pudieron leer las redes sociales.');
    const urls = Object.values((data?.value as Record<string, string>) || {}).filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim()));
    if (!urls.length) return toast.info('En «Config. del sitio → Redes sociales» no hay enlaces guardados.');
    setOrg({ sameAs: [...new Set(urls.map((u) => u.trim()))] });
    toast.success(`${urls.length} perfil(es) traídos de Redes sociales.`);
  };

  return (
    <div className="space-y-4">
      <Card className={SEO_CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-secondary"><Building2 className="w-5 h-5 text-primary" />La organización</CardTitle>
          <CardDescription className="text-xs text-secondary/70">Datos de la marca que Google y los asistentes de IA leen en la página de inicio (schema.org). Solo datos reales: lo que se deje vacío no se publica.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-secondary">Tipo</Label>
              <Select value={org.type} onValueChange={(v) => setOrg({ type: v as SeoConfig['organization']['type'] })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MedicalOrganization">Organización médica</SelectItem>
                  <SelectItem value="Organization">Organización</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-org-name" className="text-xs text-secondary">Nombre</Label>
              <Input id="seo-org-name" value={org.name} onChange={(e) => setOrg({ name: e.target.value })} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-org-alt" className="text-xs text-secondary">Nombre alternativo</Label>
              <Input id="seo-org-alt" value={org.alternateName} onChange={(e) => setOrg({ alternateName: e.target.value })} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-org-area" className="text-xs text-secondary">Área de servicio</Label>
              <Input id="seo-org-area" value={org.areaServed} onChange={(e) => setOrg({ areaServed: e.target.value })} placeholder="Worldwide" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-org-email" className="text-xs text-secondary">Correo de contacto</Label>
              <Input id="seo-org-email" type="email" value={org.email} onChange={(e) => setOrg({ email: e.target.value })} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-org-phone" className="text-xs text-secondary">Teléfono</Label>
              <Input id="seo-org-phone" value={org.phone} onChange={(e) => setOrg({ phone: e.target.value })} className="text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seo-org-desc" className="text-xs text-secondary">Descripción</Label>
            <Textarea id="seo-org-desc" value={org.description} onChange={(e) => setOrg({ description: e.target.value })} className="text-sm min-h-[70px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-secondary">Logo</Label>
            <SeoImageUpload kind="logo" value={org.logoUrl} onChange={(url) => setOrg({ logoUrl: url })} allowUrl />
            <p className="text-[11px] text-secondary/60">Vacío: se usa el favicon del panel o el icono de la marca.</p>
          </div>
          {org.type === 'MedicalOrganization' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-secondary">Especialidades médicas</Label>
              <div className="flex flex-wrap gap-1.5">
                {options.map((s) => {
                  const on = org.medicalSpecialty.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setOrg({ medicalSpecialty: on ? org.medicalSpecialty.filter((v) => v !== s.value) : [...org.medicalSpecialty, s.value] })}
                      className={on ? 'rounded-full bg-primary px-2.5 py-1 text-[11px] text-white' : 'rounded-full border border-secondary/20 bg-white px-2.5 py-1 text-[11px] text-secondary hover:border-primary/40'}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="seo-org-sameas" className="text-xs text-secondary">Perfiles oficiales en redes (uno por línea)</Label>
              <Button type="button" variant="outline" size="sm" onClick={importSocial} className="gap-1.5 h-8"><Download className="w-3.5 h-3.5" />Traer de Redes sociales</Button>
            </div>
            <Textarea
              id="seo-org-sameas"
              value={org.sameAs.join('\n')}
              onChange={(e) => setOrg({ sameAs: e.target.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) })}
              placeholder="https://www.instagram.com/…"
              className="text-sm font-mono min-h-[80px]"
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-secondary/15 p-3">
            <span className="text-sm text-secondary"><span className="font-semibold">Buscador del sitio</span><br /><span className="text-[11px] text-secondary/60">Le dice a Google que en /doctors se puede buscar médicos.</span></span>
            <Switch checked={org.searchAction} onCheckedChange={(v) => setOrg({ searchAction: v })} />
          </label>
        </CardContent>
      </Card>

      <Card className={SEO_CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-secondary"><Code2 className="w-5 h-5 text-primary" />Código que se publica</CardTitle>
          <CardDescription className="text-xs text-secondary/70">Los datos estructurados de médicos, grabaciones, noticias y congresos se activan en «Contenido de usuarios».</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-72 overflow-auto rounded-lg bg-[#f3f6fa] border border-secondary/10 p-3 text-[11px] leading-relaxed text-secondary">{JSON.stringify(organizationJsonLd(config), null, 2)}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
