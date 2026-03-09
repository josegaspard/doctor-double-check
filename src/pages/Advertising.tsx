import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdConfig, useAdPlacements } from '@/hooks/useAds';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Megaphone, Eye, MousePointerClick, DollarSign, Zap,
  Target, BarChart3, Shield, ArrowRight, Calculator,
  Smartphone, Monitor, Layout,
} from 'lucide-react';

export default function Advertising() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { config } = useAdConfig();
  const { placements } = useAdPlacements();
  const [budget, setBudget] = useState(5000);

  const estimatedImpressions = Math.floor((budget / config.cpm_rate) * 1000);
  const estimatedClicks = Math.floor(budget / config.cpc_rate);

  const handleGetStarted = () => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      navigate('/advertiser/dashboard');
    }
  };

  const activePlacements = placements.filter(p => p.is_active);

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-10 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-2xl sm:text-4xl font-bold text-foreground mb-3">
            {es ? 'Publicita en Medical Masters' : 'Advertise on Medical Masters'}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
            {es
              ? 'Llega a miles de profesionales de la salud y pacientes con banners inteligentes, segmentados y medibles.'
              : 'Reach thousands of healthcare professionals and patients with smart, targeted, measurable banners.'}
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {[
            { icon: Target, label: es ? 'Segmentación precisa' : 'Precise targeting', desc: es ? 'Por rol, idioma y ubicación' : 'By role, language & location' },
            { icon: BarChart3, label: es ? 'Métricas en tiempo real' : 'Real-time metrics', desc: es ? 'Impresiones, clics y CTR' : 'Impressions, clicks & CTR' },
            { icon: Shield, label: es ? 'App Store compliant' : 'App Store compliant', desc: es ? 'Cumple políticas de Google y Apple' : 'Google & Apple policy compliant' },
            { icon: Zap, label: es ? 'Activación instantánea' : 'Instant activation', desc: es ? 'Paga y tu campaña se activa' : 'Pay and your campaign activates' },
          ].map((b, i) => (
            <Card key={i} className="text-center">
              <CardContent className="p-4">
                <b.icon className="w-7 h-7 text-primary mx-auto mb-2" />
                <p className="font-semibold text-sm mb-0.5">{b.label}</p>
                <p className="text-xs text-muted-foreground">{b.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pricing Calculator */}
        <Card className="mb-10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="w-5 h-5 text-primary" />
              {es ? 'Calculadora de Presupuesto' : 'Budget Calculator'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {es ? 'Presupuesto' : 'Budget'}: <span className="text-primary font-bold">${budget.toLocaleString()} MXN</span>
              </Label>
              <Slider
                value={[budget]}
                onValueChange={([v]) => setBudget(v)}
                min={Number(config.min_budget)}
                max={100000}
                step={500}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>${config.min_budget.toLocaleString()}</span>
                <span>$100,000</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-info/5 border border-info/20 p-4 text-center">
                <Eye className="w-6 h-6 text-info mx-auto mb-1" />
                <p className="text-2xl font-bold text-info">{estimatedImpressions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {es ? 'Impresiones estimadas' : 'Estimated impressions'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  CPM: ${config.cpm_rate}
                </p>
              </div>
              <div className="rounded-xl bg-warning/5 border border-warning/20 p-4 text-center">
                <MousePointerClick className="w-6 h-6 text-warning mx-auto mb-1" />
                <p className="text-2xl font-bold text-warning">{estimatedClicks.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {es ? 'Clics estimados' : 'Estimated clicks'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  CPC: ${config.cpc_rate}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Available Placements */}
        {activePlacements.length > 0 && (
          <div className="mb-10">
            <h2 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
              <Layout className="w-5 h-5 text-primary" />
              {es ? 'Espacios Disponibles' : 'Available Placements'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activePlacements.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{p.display_name}</p>
                        {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {p.width}×{p.height}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        {p.format === 'banner' ? <Monitor className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                        {p.format}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="text-center">
          <Button size="lg" className="gap-2 text-base px-8" onClick={handleGetStarted}>
            <Megaphone className="w-5 h-5" />
            {es ? 'Crear mi campaña' : 'Create my campaign'}
            <ArrowRight className="w-4 h-4" />
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            {es ? 'Necesitas una cuenta registrada para comenzar' : 'You need a registered account to get started'}
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
