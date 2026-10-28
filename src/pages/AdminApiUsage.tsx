import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsSkeleton, TableSkeleton } from '@/components/skeletons/CardSkeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import {
  Gauge, ArrowLeft, Download, DollarSign, TrendingUp, Wallet, Activity,
  CreditCard, Video, Film, HardDrive, Radio, AlertTriangle, RefreshCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Provider {
  key: string; name: string; billing: string; unit: string | null;
  usage: number | null; requests: number | null;
  consumedUsd: number | null; balanceUsd: number | null; remaining: string;
  revenueMxn: number; costMxn: number | null; netMxn: number | null; roi: number | null;
  available: boolean; note: string;
}
interface UsageData {
  generatedAt: string; days: number; usdMxn: number;
  revenue: { consultations: number; content: number; subscriptions: number; marketplace: number; gross: number };
  totals: { costMxn: number; revenueMxn: number; netMxn: number; roi: number | null };
  providers: Provider[];
}

const mxn = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);
const usd = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
const roiFmt = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(1)}×`);
const num = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('es-MX').format(n));

const ICONS: Record<string, React.ElementType> = {
  stripe: CreditCard, cloudflare: Radio, daily: Video, bunny: Film, b2: HardDrive,
};
const ACCENT: Record<string, { border: string; text: string; bg: string; hsl: string }> = {
  stripe: { border: 'border-l-primary', text: 'text-primary', bg: 'bg-primary/10', hsl: 'hsl(168, 84%, 32%)' },
  cloudflare: { border: 'border-l-warning', text: 'text-warning', bg: 'bg-warning/10', hsl: 'hsl(45, 93%, 47%)' },
  daily: { border: 'border-l-info', text: 'text-info', bg: 'bg-info/10', hsl: 'hsl(199, 89%, 48%)' },
  bunny: { border: 'border-l-accent', text: 'text-accent', bg: 'bg-accent/10', hsl: 'hsl(142, 72%, 42%)' },
  b2: { border: 'border-l-secondary', text: 'text-secondary', bg: 'bg-secondary/10', hsl: 'hsl(0, 84%, 60%)' },
};

export default function AdminApiUsage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<UsageData | null>(null);
  const [days, setDays] = useState<30 | 7 | 90>(30);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (role && role !== 'admin') navigate('/'); }, [role, navigate]);

  const load = async () => {
    if (role !== 'admin') return;
    setIsLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('admin-api-usage', { body: { days } });
      if (error) throw error;
      setData(res as UsageData);
    } catch (e) {
      console.error('admin-api-usage', e);
      toast.error('No se pudo cargar el consumo de APIs');
    } finally { setIsLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [role, days]);

  const chartConfig = {
    costMxn: { label: 'Coste', color: 'hsl(0, 84%, 60%)' },
    revenueMxn: { label: 'Ingreso', color: 'hsl(168, 84%, 32%)' },
  };

  const handlePrintPDF = () => {
    if (!data) return;
    const generatedAt = format(new Date(data.generatedAt), "dd 'de' MMMM yyyy, HH:mm", { locale: es });
    const rows = data.providers.map((p) => `<tr>
      <td>${p.name}</td><td>${p.billing}</td>
      <td class="r">${p.available ? num(p.requests) : '—'}</td>
      <td class="r">${p.available && p.usage != null ? num(p.usage) + (p.unit ? ' ' + p.unit : '') : '—'}</td>
      <td class="r">${p.available ? mxn(p.costMxn) : '—'}</td>
      <td class="r">${p.balanceUsd != null ? usd(p.balanceUsd) : '—'}</td>
      <td class="r">${mxn(p.revenueMxn)}</td>
      <td class="r ${(p.netMxn ?? 0) >= 0 ? 'g' : 'bad'}">${p.netMxn != null ? mxn(p.netMxn) : '—'}</td>
      <td class="r">${roiFmt(p.roi)}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Consumo de APIs y ROI — Medical Masters</title>
    <style>body{font-family:system-ui,sans-serif;padding:40px;color:#333;max-width:1000px;margin:0 auto}
    h1{font-size:24px;margin-bottom:4px}h2{font-size:17px;margin-top:28px;border-bottom:2px solid #0d9488;padding-bottom:6px}
    .sub{color:#666;font-size:13px}.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0}
    .kpi{border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center}
    .kpi .v{font-size:22px;font-weight:700;color:#0d9488}.kpi .l{font-size:11px;color:#666}
    table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12px}
    th,td{border:1px solid #e5e7eb;padding:7px 9px;text-align:left}th{background:#f9fafb}
    .r{text-align:right}.g{color:#0d9488}.bad{color:#dc2626}
    .foot{margin-top:34px;text-align:center;color:#999;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px}</style></head><body>
    <h1>Consumo de APIs y ROI</h1>
    <p class="sub">Medical Masters · últimos ${data.days} días · ${generatedAt} · tipo de cambio 1 USD = ${data.usdMxn.toFixed(2)} MXN</p>
    <div class="kpi-grid">
      <div class="kpi"><div class="v">${mxn(data.totals.costMxn)}</div><div class="l">Coste total de APIs</div></div>
      <div class="kpi"><div class="v">${mxn(data.totals.revenueMxn)}</div><div class="l">Ingreso atribuido</div></div>
      <div class="kpi"><div class="v">${mxn(data.totals.netMxn)}</div><div class="l">Beneficio neto</div></div>
      <div class="kpi"><div class="v">${roiFmt(data.totals.roi)}</div><div class="l">ROI global</div></div>
    </div>
    <h2>Detalle por servicio</h2>
    <table><thead><tr><th>Servicio</th><th>Facturación</th><th class="r">Peticiones</th><th class="r">Consumo</th><th class="r">Coste (MXN)</th><th class="r">Saldo</th><th class="r">Ingreso</th><th class="r">Neto</th><th class="r">ROI</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="foot">Medical Masters — generado ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}. Los costes de Cloudflare, Daily, Bunny y B2 son estimaciones con tarifas públicas; Stripe reporta comisiones reales.</div>
    </body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 400);
  };

  if (role !== 'admin') return null;

  const chartData = (data?.providers ?? []).filter((p) => p.available).map((p) => ({
    name: p.name.replace(' Stream', '').replace('.co', ''),
    costMxn: Math.round(p.costMxn ?? 0),
    revenueMxn: Math.round(p.revenueMxn),
  }));

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
                <Gauge className="w-4 h-4 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                <span className="truncate">Consumo de APIs y ROI</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Gasto, saldo, peticiones y retorno de cada servicio externo que paga la plataforma</p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-between sm:justify-end">
            <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 30 | 90)}>
              <TabsList className="h-8">
                <TabsTrigger value="7" className="text-xs h-7 px-2.5">7 días</TabsTrigger>
                <TabsTrigger value="30" className="text-xs h-7 px-2.5">30 días</TabsTrigger>
                <TabsTrigger value="90" className="text-xs h-7 px-2.5">90 días</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={() => load()} className="gap-1 text-xs h-8" disabled={isLoading}>
              <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
            {data && (
              <Button variant="outline" size="sm" onClick={handlePrintPDF} className="gap-1 text-xs h-8">
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <><StatsSkeleton /><div className="mt-6"><TableSkeleton rows={5} columns={5} /></div></>
        ) : data ? (
          <div ref={printRef}>
            {/* KPIs globales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {[
                { value: mxn(data.totals.costMxn), label: 'Coste total de APIs', icon: DollarSign, bg: 'bg-destructive/10', color: 'text-destructive' },
                { value: mxn(data.totals.revenueMxn), label: 'Ingreso atribuido', icon: Wallet, bg: 'bg-success/10', color: 'text-success' },
                { value: mxn(data.totals.netMxn), label: 'Beneficio neto', icon: TrendingUp, bg: 'bg-primary/10', color: 'text-primary' },
                { value: roiFmt(data.totals.roi), label: 'ROI global', icon: Gauge, bg: 'bg-info/10', color: 'text-info' },
              ].map((s, i) => (
                <Card key={i}><CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}><s.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${s.color}`} /></div>
                    <div className="min-w-0">
                      <p className="text-sm sm:text-2xl font-bold truncate">{s.value}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{s.label}</p>
                    </div>
                  </div>
                </CardContent></Card>
              ))}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-4 -mt-1">
              Últimos {data.days} días · tipo de cambio 1 USD = {data.usdMxn.toFixed(2)} MXN · Stripe reporta comisiones reales; Cloudflare, Daily, Bunny y B2 estiman el coste con sus tarifas públicas.
            </p>

            {/* Tarjeta por servicio */}
            <h2 className="text-sm sm:text-base font-bold mb-2 flex items-center gap-1.5"><Activity className="w-4 h-4 text-primary" /> Servicios</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {data.providers.map((p) => {
                const Icon = ICONS[p.key] ?? Activity;
                const a = ACCENT[p.key] ?? ACCENT.stripe;
                return (
                  <Card key={p.key} className={`border-l-4 ${a.border} ${!p.available ? 'opacity-70' : ''}`}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded-lg ${a.bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-4 h-4 ${a.text}`} /></div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{p.billing}</p>
                          </div>
                        </div>
                        {p.available
                          ? <Badge variant="outline" className="text-[10px]">{roiFmt(p.roi)} ROI</Badge>
                          : <Badge variant="secondary" className="text-[10px] gap-1"><AlertTriangle className="w-3 h-3" />sin datos</Badge>}
                      </div>
                      {p.available ? (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                          <div><p className="text-muted-foreground text-[10px]">Consumo</p><p className="font-bold">{mxn(p.costMxn)}</p><p className="text-[9px] text-muted-foreground">{usd(p.consumedUsd)}</p></div>
                          <div><p className="text-muted-foreground text-[10px]">Ingreso atribuido</p><p className="font-bold text-success">{mxn(p.revenueMxn)}</p></div>
                          <div><p className="text-muted-foreground text-[10px]">Peticiones</p><p className="font-semibold">{num(p.requests)}</p></div>
                          <div><p className="text-muted-foreground text-[10px]">Consumo{p.unit ? ` (${p.unit})` : ''}</p><p className="font-semibold">{num(p.usage)}</p></div>
                          <div><p className="text-muted-foreground text-[10px]">Saldo</p><p className="font-semibold">{p.balanceUsd != null ? usd(p.balanceUsd) : '—'}</p></div>
                          <div><p className="text-muted-foreground text-[10px]">Beneficio neto</p><p className={`font-semibold ${(p.netMxn ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>{mxn(p.netMxn)}</p></div>
                          <div className="col-span-2 pt-1 border-t mt-0.5"><p className="text-[10px] text-muted-foreground">{p.remaining}</p></div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">{p.note}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Gráfico coste vs ingreso */}
            {chartData.length > 0 && (
              <Card className="mb-4 sm:mb-6">
                <CardHeader className="pb-2 sm:pb-4"><CardTitle className="text-sm sm:text-lg flex items-center gap-2"><TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />Coste vs. ingreso atribuido por servicio</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[220px] sm:h-[260px]">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="costMxn" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} name="Coste (MXN)" />
                      <Bar dataKey="revenueMxn" fill="hsl(168, 84%, 32%)" radius={[4, 4, 0, 0]} name="Ingreso (MXN)" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {/* Tabla detalle */}
            <Card>
              <CardHeader className="pb-2 sm:pb-4"><CardTitle className="text-sm sm:text-lg">Detalle completo</CardTitle></CardHeader>
              <CardContent>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b">
                      <th className="text-left p-2 font-semibold">Servicio</th>
                      <th className="text-right p-2 font-semibold">Peticiones</th>
                      <th className="text-right p-2 font-semibold">Consumo</th>
                      <th className="text-right p-2 font-semibold">Coste</th>
                      <th className="text-right p-2 font-semibold">Saldo</th>
                      <th className="text-right p-2 font-semibold">Ingreso</th>
                      <th className="text-right p-2 font-semibold">Neto</th>
                      <th className="text-right p-2 font-semibold">ROI</th>
                    </tr></thead>
                    <tbody>
                      {data.providers.map((p) => (
                        <tr key={p.key} className="border-b hover:bg-muted/30">
                          <td className="p-2 font-medium">{p.name}<span className="block text-[10px] text-muted-foreground font-normal">{p.billing}</span></td>
                          <td className="p-2 text-right">{p.available ? num(p.requests) : '—'}</td>
                          <td className="p-2 text-right">{p.available && p.usage != null ? `${num(p.usage)}${p.unit ? ' ' + p.unit : ''}` : '—'}</td>
                          <td className="p-2 text-right">{p.available ? mxn(p.costMxn) : '—'}</td>
                          <td className="p-2 text-right">{p.balanceUsd != null ? usd(p.balanceUsd) : '—'}</td>
                          <td className="p-2 text-right text-success">{mxn(p.revenueMxn)}</td>
                          <td className={`p-2 text-right ${(p.netMxn ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>{p.netMxn != null ? mxn(p.netMxn) : '—'}</td>
                          <td className="p-2 text-right font-semibold">{roiFmt(p.roi)}</td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-muted/50">
                        <td className="p-2">Total</td>
                        <td className="p-2 text-right">{num(data.providers.reduce((s, p) => s + (p.requests ?? 0), 0))}</td>
                        <td className="p-2 text-right">—</td>
                        <td className="p-2 text-right">{mxn(data.totals.costMxn)}</td>
                        <td className="p-2 text-right">—</td>
                        <td className="p-2 text-right text-success">{mxn(data.totals.revenueMxn)}</td>
                        <td className={`p-2 text-right ${data.totals.netMxn >= 0 ? 'text-success' : 'text-destructive'}`}>{mxn(data.totals.netMxn)}</td>
                        <td className="p-2 text-right">{roiFmt(data.totals.roi)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* Móvil */}
                <div className="sm:hidden space-y-2">
                  {data.providers.map((p) => (
                    <div key={p.key} className="p-2.5 rounded-lg border bg-muted/20">
                      <div className="flex items-center justify-between mb-1.5"><p className="font-semibold text-xs">{p.name}</p><span className="text-[11px] font-bold">{roiFmt(p.roi)}</span></div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        <span className="text-muted-foreground">Coste</span><span className="text-right">{p.available ? mxn(p.costMxn) : '—'}</span>
                        <span className="text-muted-foreground">Ingreso</span><span className="text-right text-success">{mxn(p.revenueMxn)}</span>
                        <span className="text-muted-foreground">Peticiones</span><span className="text-right">{p.available ? num(p.requests) : '—'}</span>
                        <span className="text-muted-foreground">Neto</span><span className={`text-right ${(p.netMxn ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>{p.netMxn != null ? mxn(p.netMxn) : '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No hay datos. Pulsa «Actualizar».</CardContent></Card>
        )}
      </div>
    </MainLayout>
  );
}
