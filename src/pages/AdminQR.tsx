import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatsSkeleton } from '@/components/skeletons/CardSkeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import { QrCode, ArrowLeft, RefreshCcw, Scan, Users, Calendar, Clock, Copy, ExternalLink, Smartphone, Globe, Monitor, LineChart } from 'lucide-react';

// Página admin: conteo de escaneos del QR de las invitaciones impresas a médicos.
// Fuente de verdad = tabla public.qr_scans (first-party, no depende de GA). Lee la RPC
// `qr_campaign_stats`. Además GA4 registra cada visita vía los UTM de la redirección.
// Escrita en español (uso interno admin), igual que la card "Marketplace — Fee".

const CAMPAIGN_SLUG = 'doctores-invitacion-2026';
const QR_URL = 'https://medical-masters.com/qr?c=doctores-invitacion-2026';
const UTM = { source: 'invitacion-impresa', medium: 'qr', campaign: 'doctores-2026' };

interface Breakdown { k: string; n: number; }
interface QrStats {
  total: number;
  today: number;
  last7: number;
  last30: number;
  unique_est: number;
  last_scan_at: string | null;
  by_day: { day: string; scans: number }[];
  by_hour: { hour: number; scans: number }[];
  by_device: Breakdown[];
  by_browser: Breakdown[];
  by_os: Breakdown[];
  by_country: Breakdown[];
  by_city: Breakdown[];
  recent: { scanned_at: string; device_type: string; browser: string; os: string; country: string; city: string }[];
}

// Lista de desglose con barra proporcional (dispositivo, navegador, país...).
function BreakdownList({ title, icon: Icon, items }: { title: string; icon: any; items: Breakdown[] }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin datos aún.</p>
        ) : (
          items.map((it, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate mr-2">{it.k}</span>
                <span className="tabular-nums font-medium flex-shrink-0">{it.n.toLocaleString('es-MX')}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(it.n / max) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

const chartConfig = {
  scans: { label: 'Escaneos', color: 'hsl(168, 84%, 32%)' },
};

export default function AdminQR() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [stats, setStats] = useState<QrStats | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const { data, error } = await (supabase as any).rpc('qr_campaign_stats', { p_slug: CAMPAIGN_SLUG });
      if (error) throw error;
      setStats(data as QrStats);
    } catch (e) {
      console.error('qr stats error', e);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(QR_URL);
      toast.success('URL copiada');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const lastScan = stats?.last_scan_at
    ? new Date(stats.last_scan_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  const chartData = (stats?.by_day ?? []).map((d) => ({
    label: d.day.slice(8, 10) + '/' + d.day.slice(5, 7), // DD/MM
    scans: d.scans,
  }));

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
        <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="back" size="icon" onClick={() => navigate('/admin')} className="flex-shrink-0 h-9 w-9">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-base sm:text-2xl font-bold flex items-center gap-1.5 sm:gap-2">
                <QrCode className="w-4 h-4 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                <span className="truncate">Campañas QR</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Escaneos del QR impreso · Invitaciones a médicos 2026
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="flex-shrink-0">
              <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline ml-1.5">Actualizar</span>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <StatsSkeleton />
        ) : hasError ? (
          <Card className="border-2 border-destructive/20">
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No se pudieron cargar las estadísticas.</p>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCcw className="w-4 h-4 mr-1.5" /> Reintentar
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* KPIs */}
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

            {/* Último escaneo */}
            <Card className="rounded-xl">
              <CardContent className="p-3 sm:p-4 flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Último escaneo:</span>
                <span className="font-medium">{lastScan}</span>
              </CardContent>
            </Card>

            {/* Gráfica 30 días */}
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base">Escaneos por día (últimos 30 días)</CardTitle>
              </CardHeader>
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
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Aún no hay escaneos registrados. En cuanto alguien escanee el QR, aparecerá aquí.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Desgloses (dispositivo, navegador, SO). La ubicación geográfica se ve en
                GA4: Vercel no reenvía geo a la función, pero GA4 la resuelve server-side. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <BreakdownList title="Dispositivo" icon={Smartphone} items={stats?.by_device ?? []} />
              <BreakdownList title="Navegador" icon={Globe} items={stats?.by_browser ?? []} />
              <BreakdownList title="Sistema" icon={Monitor} items={stats?.by_os ?? []} />
            </div>

            {/* Hora del día */}
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Escaneos por hora del día (CDMX)
                </CardTitle>
              </CardHeader>
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

            {/* Últimos escaneos */}
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Scan className="w-4 h-4 text-primary" /> Últimos escaneos
                </CardTitle>
              </CardHeader>
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

            {/* GA4: comportamiento completo dentro del sitio */}
            <Card className="rounded-xl border-2 border-info/30 bg-info/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-info" /> Comportamiento dentro del sitio (Google Analytics)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground leading-relaxed">
                  Este panel cuenta los <strong>escaneos</strong> y con qué dispositivo entraron. Para ver
                  <strong> ubicación geográfica</strong> (país/ciudad), <strong>datos demográficos</strong> y
                  <strong> todo lo que hacen DESPUÉS</strong> de entrar (páginas vistas, tiempo en sitio, clics,
                  registros y conversiones), se mide en Google Analytics 4: cada visita del QR llega etiquetada.
                </p>
                <p className="text-xs">
                  GA4 → <strong>Interacción/Engagement</strong> y <strong>Adquisición → Adquisición de tráfico</strong>,
                  filtrando por <strong>Campaña = {UTM.campaign}</strong> (o Fuente/medio ={' '}
                  <code className="bg-muted px-1 rounded">{UTM.source} / {UTM.medium}</code>). ID de GA: <code className="bg-muted px-1 rounded">G-NB9CJEJYPV</code>.
                </p>
                <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-info hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir Google Analytics
                </a>
              </CardContent>
            </Card>

            {/* Datos del QR */}
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-primary" /> Datos del código QR
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">URL del QR impreso</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1">{QR_URL}</code>
                    <Button variant="ghost" size="icon" onClick={copyUrl} className="h-8 w-8 flex-shrink-0">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">utm_source: {UTM.source}</Badge>
                  <Badge variant="secondary">utm_medium: {UTM.medium}</Badge>
                  <Badge variant="secondary">utm_campaign: {UTM.campaign}</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cada escaneo se cuenta aquí (medición propia, no depende de Google) y además llega a
                  Google Analytics con esos UTM. En GA4 se ve en <strong>Adquisición → Tráfico → Campaña</strong>{' '}
                  filtrando por <strong>{UTM.campaign}</strong>. El QR no identifica a nadie: solo cuenta escaneos.
                </p>
                <a
                  href={QR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Probar el QR (cuenta como un escaneo)
                </a>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
