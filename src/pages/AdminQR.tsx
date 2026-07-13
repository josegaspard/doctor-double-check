import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { StatsSkeleton } from '@/components/skeletons/CardSkeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import {
  QrCode, ArrowLeft, RefreshCcw, Scan, Users, Calendar, Clock, Copy, ExternalLink,
  Smartphone, Globe, Monitor, LineChart, Plus, Download, Link2,
} from 'lucide-react';

// Panel admin: GESTOR de códigos QR medibles. Crea campañas para cualquier enlace,
// descarga el QR (HD/SVG) aquí mismo, y mide TODO por campaña. Cada QR apunta a
// /qr?c=<slug> (redirección con UTM + registro first-party en qr_scans).
// Español hardcodeado (uso interno admin), igual que la card "Marketplace — Fee".

const APP_ORIGIN = 'https://medical-masters.com';

interface Campaign {
  slug: string; name: string; destination_path: string;
  utm_source: string; utm_medium: string; utm_campaign: string;
  active: boolean; created_at: string;
}
interface Breakdown { k: string; n: number; }
interface QrStats {
  total: number; today: number; last7: number; last30: number;
  unique_est: number; last_scan_at: string | null;
  by_day: { day: string; scans: number }[];
  by_hour: { hour: number; scans: number }[];
  by_device: Breakdown[]; by_browser: Breakdown[]; by_os: Breakdown[];
  recent: { scanned_at: string; device_type: string; browser: string; os: string; country: string; city: string }[];
}

const chartConfig = { scans: { label: 'Escaneos', color: 'hsl(168, 84%, 32%)' } };

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function BreakdownList({ title, icon: Icon, items }: { title: string; icon: any; items: Breakdown[] }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Icon className="w-4 h-4 text-primary" /> {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin datos aún.</p>
        ) : items.map((it, i) => (
          <div key={i} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate mr-2">{it.k}</span>
              <span className="tabular-nums font-medium flex-shrink-0">{it.n.toLocaleString('es-MX')}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${(it.n / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminQR() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [stats, setStats] = useState<QrStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [previewPng, setPreviewPng] = useState('');
  // Formulario de creación
  const [name, setName] = useState('');
  const [dest, setDest] = useState('');
  const [creating, setCreating] = useState(false);

  const current = campaigns.find((c) => c.slug === selected) || null;
  const qrUrl = selected ? `${APP_ORIGIN}/qr?c=${selected}` : '';

  const loadCampaigns = useCallback(async (preferSlug?: string) => {
    const { data, error } = await (supabase as any)
      .from('qr_campaigns').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    const list = (data || []) as Campaign[];
    setCampaigns(list);
    setSelected((prev) => {
      if (preferSlug && list.some((c) => c.slug === preferSlug)) return preferSlug;
      if (prev && list.some((c) => c.slug === prev)) return prev;
      return list.find((c) => c.slug === 'doctores-invitacion-2026')?.slug || list[0]?.slug || '';
    });
  }, []);

  const loadStats = useCallback(async (slug: string) => {
    if (!slug) return;
    setLoadingStats(true); setStatsError(false);
    try {
      const { data, error } = await (supabase as any).rpc('qr_campaign_stats', { p_slug: slug });
      if (error) throw error;
      setStats(data as QrStats);
    } catch (e) { console.error('qr stats error', e); setStatsError(true); }
    finally { setLoadingStats(false); }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);
  useEffect(() => { if (selected) loadStats(selected); }, [selected, loadStats]);

  // Vista previa del QR (ligera, 320px). La descarga genera alta resolución al vuelo.
  useEffect(() => {
    if (!qrUrl) { setPreviewPng(''); return; }
    let cancelled = false;
    QRCode.toDataURL(qrUrl, { errorCorrectionLevel: 'H', margin: 4, width: 320 })
      .then((u) => { if (!cancelled) setPreviewPng(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [qrUrl]);

  const createCampaign = async () => {
    const nm = name.trim();
    if (!nm) { toast.error('Ponle un nombre a la campaña'); return; }
    const slug = slugify(nm);
    if (!slug) { toast.error('Nombre inválido (usa letras o números)'); return; }
    setCreating(true);
    try {
      const destination = dest.trim() || '/';
      const { error } = await (supabase as any).from('qr_campaigns').insert({
        slug, name: nm, destination_path: destination,
        utm_source: 'qr', utm_medium: 'qr', utm_campaign: slug,
      });
      if (error) {
        if (error.code === '23505') { toast.error('Ya existe una campaña con ese nombre'); return; }
        throw error;
      }
      toast.success('Código QR creado');
      setName(''); setDest('');
      await loadCampaigns(slug);
    } catch (e) { console.error(e); toast.error('No se pudo crear la campaña'); }
    finally { setCreating(false); }
  };

  const downloadPng = async () => {
    try {
      const data = await QRCode.toDataURL(qrUrl, { errorCorrectionLevel: 'H', margin: 4, width: 2048 });
      const a = document.createElement('a'); a.href = data; a.download = `qr-${selected}.png`; a.click();
    } catch { toast.error('No se pudo generar el PNG'); }
  };
  const downloadSvg = async () => {
    try {
      const svg = await QRCode.toString(qrUrl, { type: 'svg', errorCorrectionLevel: 'H', margin: 4, width: 1024 });
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = u; a.download = `qr-${selected}.svg`; a.click();
      URL.revokeObjectURL(u);
    } catch { toast.error('No se pudo generar el SVG'); }
  };
  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(qrUrl); toast.success('Enlace copiado'); }
    catch { toast.error('No se pudo copiar'); }
  };

  const lastScan = stats?.last_scan_at
    ? new Date(stats.last_scan_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const chartData = (stats?.by_day ?? []).map((d) => ({ label: d.day.slice(8, 10) + '/' + d.day.slice(5, 7), scans: d.scans }));
  const kpis = [
    { icon: Scan, label: 'Escaneos totales', value: stats?.total ?? 0, color: 'text-primary' },
    { icon: Calendar, label: 'Hoy', value: stats?.today ?? 0, color: 'text-success' },
    { icon: Calendar, label: 'Últimos 7 días', value: stats?.last7 ?? 0, color: 'text-info' },
    { icon: Calendar, label: 'Últimos 30 días', value: stats?.last30 ?? 0, color: 'text-secondary' },
    { icon: Users, label: 'Personas únicas (aprox.)', value: stats?.unique_est ?? 0, color: 'text-warning' },
  ];

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="back" size="icon" onClick={() => navigate('/admin')} className="flex-shrink-0 h-9 w-9">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-base sm:text-2xl font-bold flex items-center gap-1.5 sm:gap-2">
              <QrCode className="w-4 h-4 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
              <span className="truncate">Códigos QR</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Crea, descarga y mide códigos QR</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadStats(selected)} disabled={loadingStats || !selected} className="flex-shrink-0">
            <RefreshCcw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-1.5">Actualizar</span>
          </Button>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {/* Crear QR */}
          <Card className="rounded-xl border-2 border-primary/20 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Crear un código QR nuevo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Nombre de la campaña</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Volantes congreso 2026" maxLength={80} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Destino (enlace o ruta)</label>
                  <Input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="https://…  o  /doctors  (vacío = inicio)" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={createCampaign} disabled={creating} size="sm">
                  <Plus className="w-4 h-4 mr-1.5" /> {creating ? 'Creando…' : 'Crear código QR'}
                </Button>
                <p className="text-xs text-muted-foreground">El QR apuntará a un enlace medible y se contará todo automáticamente.</p>
              </div>
            </CardContent>
          </Card>

          {/* Selector de campañas */}
          {campaigns.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {campaigns.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setSelected(c.slug)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors ${
                    selected === c.slug ? 'bg-primary text-primary-foreground border-primary' : 'bg-white text-foreground border-primary/20 hover:border-primary/50'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {/* QR de la campaña seleccionada + descarga */}
          {current && (
            <Card className="rounded-xl border-2 border-primary/20 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2"><QrCode className="w-4 h-4 text-primary" /> {current.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-4">
                <div className="flex-shrink-0 mx-auto sm:mx-0">
                  {previewPng ? (
                    <img src={previewPng} alt={`QR ${current.name}`} className="w-40 h-40 rounded-lg border" width={160} height={160} />
                  ) : (
                    <div className="w-40 h-40 rounded-lg border bg-muted animate-pulse" />
                  )}
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Enlace del QR</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded break-all flex-1">{qrUrl}</code>
                      <Button variant="ghost" size="icon" onClick={copyUrl} className="h-8 w-8 flex-shrink-0"><Copy className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 flex-shrink-0" /> Redirige a: <span className="font-medium text-foreground break-all">{current.destination_path}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">utm_campaign: {current.utm_campaign}</Badge>
                    <Badge variant="secondary">{current.utm_source} / {current.utm_medium}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={downloadPng}><Download className="w-4 h-4 mr-1.5" /> PNG (HD)</Button>
                    <Button size="sm" variant="outline" onClick={downloadSvg}><Download className="w-4 h-4 mr-1.5" /> SVG</Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={qrUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4 mr-1.5" /> Probar</a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Métricas de la campaña seleccionada */}
          {loadingStats ? (
            <StatsSkeleton />
          ) : statsError ? (
            <Card className="border-2 border-destructive/20"><CardContent className="py-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No se pudieron cargar las estadísticas.</p>
              <Button variant="outline" size="sm" onClick={() => loadStats(selected)}><RefreshCcw className="w-4 h-4 mr-1.5" /> Reintentar</Button>
            </CardContent></Card>
          ) : current && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                {kpis.map((k, i) => (
                  <Card key={i} className="rounded-xl bg-white border-2 border-primary/20">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <k.icon className={`w-4 h-4 ${k.color}`} />
                        <span className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{k.label}</span>
                      </div>
                      <div className="text-2xl sm:text-3xl font-bold tabular-nums">{k.value.toLocaleString('es-MX')}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="rounded-xl">
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Último escaneo:</span>
                  <span className="font-medium">{lastScan}</span>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">Escaneos por día (últimos 30 días)</CardTitle></CardHeader>
                <CardContent>
                  {chartData.some((d) => d.scans > 0) ? (
                    <ChartContainer config={chartConfig} className="h-[220px] sm:h-[280px] w-full">
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} width={30} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="scans" fill="var(--color-scans)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">Aún no hay escaneos. En cuanto alguien escanee el QR, aparecerá aquí.</div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <BreakdownList title="Dispositivo" icon={Smartphone} items={stats?.by_device ?? []} />
                <BreakdownList title="Navegador" icon={Globe} items={stats?.by_browser ?? []} />
                <BreakdownList title="Sistema" icon={Monitor} items={stats?.by_os ?? []} />
              </div>

              <Card className="rounded-xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Escaneos por hora del día (CDMX)</CardTitle></CardHeader>
                <CardContent>
                  {(stats?.by_hour ?? []).some((h) => h.scans > 0) ? (
                    <ChartContainer config={chartConfig} className="h-[180px] sm:h-[220px] w-full">
                      <BarChart data={(stats?.by_hour ?? []).map((h) => ({ label: `${h.hour}h`, scans: h.scans }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={9} interval={1} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} width={30} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="scans" fill="var(--color-scans)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground">Aún no hay escaneos.</div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base flex items-center gap-2"><Scan className="w-4 h-4 text-primary" /> Últimos escaneos</CardTitle></CardHeader>
                <CardContent>
                  {(stats?.recent ?? []).length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">Aún no hay escaneos registrados.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b">
                            <th className="py-2 pr-3 font-medium">Fecha y hora</th>
                            <th className="py-2 pr-3 font-medium">Dispositivo</th>
                            <th className="py-2 pr-3 font-medium">Navegador</th>
                            <th className="py-2 pr-3 font-medium">Sistema</th>
                            <th className="py-2 font-medium">Ubicación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(stats?.recent ?? []).map((r, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.scanned_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</td>
                              <td className="py-2 pr-3 capitalize">{r.device_type}</td>
                              <td className="py-2 pr-3">{r.browser}</td>
                              <td className="py-2 pr-3">{r.os}</td>
                              <td className="py-2">{[r.city, r.country].filter((x) => x && x !== 'N/D').join(', ') || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* GA4: comportamiento completo dentro del sitio (tarjeta OPACA para legibilidad) */}
              <Card className="rounded-xl border-2 border-info/40 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-info"><LineChart className="w-4 h-4 flex-shrink-0" /> Comportamiento dentro del sitio (Google Analytics)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-foreground leading-relaxed">
                    Este panel cuenta los <strong>escaneos</strong> y con qué dispositivo entraron. Para ver{' '}
                    <strong>ubicación geográfica</strong> (país/ciudad), <strong>datos demográficos</strong> y{' '}
                    <strong>todo lo que hacen DESPUÉS</strong> de entrar (páginas vistas, tiempo en sitio, clics,
                    registros y conversiones), se mide en Google Analytics 4: cada visita del QR llega etiquetada.
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    GA4 → <strong className="text-foreground">Interacción/Engagement</strong> y{' '}
                    <strong className="text-foreground">Adquisición → Adquisición de tráfico</strong>, filtrando por{' '}
                    <strong className="text-foreground">Campaña = {current.utm_campaign}</strong>. ID de GA:{' '}
                    <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded">G-NB9CJEJYPV</code>.
                  </p>
                  <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-info/50 bg-info/10 px-3 py-1.5 text-sm font-medium text-info hover:bg-info/20 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir Google Analytics
                  </a>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
