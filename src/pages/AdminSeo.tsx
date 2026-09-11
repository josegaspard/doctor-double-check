import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Bot, Code2, FileText, Loader2, Save, Search, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ENTITY_TYPES, PUBLIC_PAGES, resolveSeo, type SeoFields } from '@/lib/seo';
import { useSeoConfig, type SaveResult } from '@/hooks/useSeoConfig';
import { SeoGeneralTab } from '@/components/admin/seo/SeoGeneralTab';
import { SeoPagesTab } from '@/components/admin/seo/SeoPagesTab';
import { SeoContentTab } from '@/components/admin/seo/SeoContentTab';
import { SeoIndexingTab } from '@/components/admin/seo/SeoIndexingTab';
import { SeoSchemaTab } from '@/components/admin/seo/SeoSchemaTab';

const TABS = [
  { value: 'general', label: 'General', icon: Sparkles },
  { value: 'pages', label: 'Páginas', icon: FileText },
  { value: 'content', label: 'Contenido de usuarios', icon: Users },
  { value: 'indexing', label: 'Indexación', icon: Bot },
  { value: 'schema', label: 'Datos estructurados', icon: Code2 },
];

export default function AdminSeo() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? (params.get('tab') as string) : 'general';
  const { config, setConfig, loading, saving, dirty, save, discard, reload, loadError } = useSeoConfig();

  useEffect(() => {
    if (role && role !== 'admin') navigate('/');
  }, [role, navigate]);

  // Aviso del navegador si se cierra la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const report = (result: SaveResult) => {
    if (result.ok) {
      toast.success('Guardado. La web lo muestra en menos de un minuto.');
      return true;
    }
    toast.error(result.conflict ? `${result.message} Recarga la página para ver la última versión antes de guardar.` : `No se pudo guardar: ${result.message}`);
    return false;
  };

  const saveAll = async () => report(await save());

  const saveFields = async (path: string, fields: SeoFields | null) => {
    const pages = { ...config.pages };
    if (fields) pages[path] = fields;
    else delete pages[path];
    return report(await save({ ...config, pages }));
  };

  if (role !== 'admin') return null;

  const visiblePages = PUBLIC_PAGES.filter((p) => resolveSeo(config, p.path).index).length;
  const openTypes = ENTITY_TYPES.filter((t) => config.types[t.type].index).length;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl pb-36">
        <div className="mb-5 sm:mb-6 rounded-2xl bg-white border-2 border-primary/30 shadow-md p-4 sm:p-6">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Button variant="back" size="icon" onClick={() => navigate('/admin')} aria-label="Volver al panel">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow flex-shrink-0">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-lg sm:text-2xl font-bold text-secondary">SEO del sitio</h1>
              <p className="text-secondary/70 text-xs sm:text-sm">Título, descripción, favicon, imagen para redes e indexación de cada página, también de lo que publican los médicos.</p>
            </div>
          </div>
          {!loading && !loadError && (
            <p className="mt-3 text-xs text-secondary/70">
              Visibles en Google: <span className="font-semibold text-secondary">{visiblePages} de {PUBLIC_PAGES.length} páginas</span> · <span className="font-semibold text-secondary">{openTypes} de {ENTITY_TYPES.length} tipos de contenido</span>
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>
        ) : loadError ? (
          <Card className="bg-white border-2 border-destructive/30 rounded-xl">
            <CardContent className="p-6 space-y-3 text-center">
              <p className="text-sm text-secondary">No se pudo cargar la configuración SEO: {loadError}</p>
              <Button onClick={reload}>Reintentar</Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="space-y-4">
            <TabsList className="w-full h-auto flex flex-wrap justify-start gap-1 rounded-xl bg-white/95 p-1.5">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="gap-1.5 text-xs sm:text-sm text-secondary data-[state=active]:bg-primary data-[state=active]:text-white">
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="general"><SeoGeneralTab config={config} setConfig={setConfig} /></TabsContent>
            <TabsContent value="pages"><SeoPagesTab config={config} saving={saving} saveFields={saveFields} /></TabsContent>
            <TabsContent value="content"><SeoContentTab config={config} setConfig={setConfig} saving={saving} saveFields={saveFields} /></TabsContent>
            <TabsContent value="indexing"><SeoIndexingTab config={config} setConfig={setConfig} /></TabsContent>
            <TabsContent value="schema"><SeoSchemaTab config={config} setConfig={setConfig} /></TabsContent>
          </Tabs>
        )}
      </div>

      {dirty && (
        <div className="fixed inset-x-3 bottom-24 md:bottom-6 md:left-auto md:right-6 z-40 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-2xl bg-white border-2 border-primary/40 shadow-xl p-3 md:max-w-xl" role="status">
          <p className="text-sm font-medium text-secondary flex-1">Tienes cambios sin guardar</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={discard} disabled={saving} className="flex-1 sm:flex-none">Descartar</Button>
            <Button onClick={saveAll} disabled={saving} className="flex-1 sm:flex-none gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar cambios
            </Button>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
