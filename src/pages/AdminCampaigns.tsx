import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Ticket, ArrowLeft, Plus, Copy, Download, RefreshCcw, Loader2, ChevronDown, ChevronRight,
  CheckCircle2, Ban, Users, Percent, Tag,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Panel admin: CAMPAÑAS DE REGISTRO (cliente 2026-08-17).
//
// Para qué: dar de alta médicos/residentes por tandas ("los primeros 50 a precio
// de lanzamiento"). El súper admin crea la campaña, genera 50 o 100 códigos, los
// reparte, y ve en vivo cuántos se han canjeado y por quién.
//
// Seguridad: los códigos NO son legibles por nadie que no sea admin (RLS sobre
// signup_codes). Quien se registra sólo puede COMPROBAR un código concreto vía
// la función validate_signup_code — no puede listarlos ni adivinarlos.
//
// Español hardcodeado, como el resto de pantallas internas de admin (AdminQR).
// ─────────────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  prefix: string;
  target_role: 'doctor' | 'resident' | 'any';
  price_cents: number | null;
  currency: string;
  discount_percentage: number | null;
  notes: string | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface Code {
  id: string;
  code: string;
  seq: number;
  status: 'available' | 'redeemed' | 'revoked';
  redeemed_by: string | null;
  redeemed_at: string | null;
}

interface Counts { total: number; available: number; redeemed: number; revoked: number }

const ROLE_LABEL: Record<Campaign['target_role'], string> = {
  doctor: 'Médicos',
  resident: 'Residentes',
  any: 'Médicos y residentes',
};

const money = (cents: number | null, currency: string) =>
  cents == null ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: (currency || 'mxn').toUpperCase() }).format(cents / 100);

const prefixify = (s: string) =>
  s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '').slice(0, 10);

export default function AdminCampaigns() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [codes, setCodes] = useState<Record<string, Code[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Formulario de alta
  const [showForm, setShowForm] = useState(false);
  const [fName, setFName] = useState('');
  const [fPrefix, setFPrefix] = useState('');
  const [fRole, setFRole] = useState<Campaign['target_role']>('doctor');
  const [fPrice, setFPrice] = useState('');
  const [fDiscount, setFDiscount] = useState('');
  const [fExpires, setFExpires] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [fFirstBatch, setFFirstBatch] = useState('50');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && user && user.role !== 'admin') {
      toast.error('Sólo el súper administrador puede ver esta pantalla');
      navigate('/');
    }
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data: camps, error } = await supabase
      .from('signup_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('No se pudieron cargar las campañas');
      setIsLoading(false);
      return;
    }
    setCampaigns((camps || []) as Campaign[]);

    // Un solo viaje para los contadores de todas las campañas: traer sólo
    // (campaign_id, status) es barato aunque haya miles de códigos.
    const { data: all } = await supabase.from('signup_codes').select('campaign_id, status');
    const tally: Record<string, Counts> = {};
    ((all || []) as { campaign_id: string; status: Code['status'] }[]).forEach((r) => {
      const c = (tally[r.campaign_id] ||= { total: 0, available: 0, redeemed: 0, revoked: 0 });
      c.total += 1;
      c[r.status] += 1;
    });
    setCounts(tally);
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadCodes = async (campaignId: string) => {
    const { data, error } = await supabase
      .from('signup_codes')
      .select('id, code, seq, status, redeemed_by, redeemed_at')
      .eq('campaign_id', campaignId)
      .order('seq');
    if (error) { toast.error('No se pudieron cargar los códigos'); return; }
    setCodes((prev) => ({ ...prev, [campaignId]: (data || []) as Code[] }));
  };

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!codes[id]) await loadCodes(id);
  };

  const createCampaign = async () => {
    const prefix = prefixify(fPrefix || fName);
    if (!fName.trim()) { toast.error('Ponle nombre a la campaña'); return; }
    if (prefix.length < 2) { toast.error('El prefijo necesita al menos 2 letras o números'); return; }

    setSaving(true);
    const { data, error } = await supabase
      .from('signup_campaigns')
      .insert({
        name: fName.trim(),
        prefix,
        target_role: fRole,
        price_cents: fPrice.trim() ? Math.round(parseFloat(fPrice) * 100) : null,
        discount_percentage: fDiscount.trim() ? parseFloat(fDiscount) : null,
        expires_at: fExpires ? new Date(fExpires).toISOString() : null,
        notes: fNotes.trim() || null,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error || !data) {
      setSaving(false);
      toast.error('No se pudo crear la campaña', { description: error?.message });
      return;
    }

    // Primera tanda en el mismo gesto: crear una campaña sin códigos no sirve de nada.
    const n = parseInt(fFirstBatch, 10);
    if (n > 0) {
      const { error: genErr } = await supabase.rpc('generate_signup_codes', { _campaign_id: data.id, _count: n });
      if (genErr) toast.error('Campaña creada, pero fallaron los códigos', { description: genErr.message });
    }

    setSaving(false);
    setShowForm(false);
    setFName(''); setFPrefix(''); setFPrice(''); setFDiscount(''); setFExpires(''); setFNotes(''); setFFirstBatch('50');
    toast.success(`Campaña «${data.name}» creada con ${n} códigos`);
    load();
  };

  const generateMore = async (campaign: Campaign, n: number) => {
    setBusy(campaign.id);
    const { data, error } = await supabase.rpc('generate_signup_codes', { _campaign_id: campaign.id, _count: n });
    setBusy(null);
    if (error) { toast.error('No se pudieron generar', { description: error.message }); return; }
    toast.success(`${data} códigos nuevos en «${campaign.name}»`);
    await loadCodes(campaign.id);
    load();
  };

  const toggleActive = async (campaign: Campaign) => {
    const { error } = await supabase
      .from('signup_campaigns')
      .update({ is_active: !campaign.is_active })
      .eq('id', campaign.id);
    if (error) { toast.error('No se pudo cambiar'); return; }
    toast.success(campaign.is_active ? 'Campaña pausada' : 'Campaña activada');
    load();
  };

  const revokeCode = async (campaignId: string, code: Code) => {
    const { error } = await supabase.from('signup_codes').update({ status: 'revoked' }).eq('id', code.id);
    if (error) { toast.error('No se pudo anular'); return; }
    await loadCodes(campaignId);
    load();
  };

  const copyAvailable = (campaign: Campaign) => {
    const list = (codes[campaign.id] || []).filter((c) => c.status === 'available').map((c) => c.code);
    if (!list.length) { toast.error('No quedan códigos libres'); return; }
    navigator.clipboard.writeText(list.join('\n'));
    toast.success(`${list.length} códigos copiados`);
  };

  const downloadCsv = (campaign: Campaign) => {
    const list = codes[campaign.id] || [];
    if (!list.length) { toast.error('Esta campaña no tiene códigos'); return; }
    const rows = [
      ['codigo', 'numero', 'estado', 'canjeado_el'],
      ...list.map((c) => [c.code, String(c.seq), c.status, c.redeemed_at || '']),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `codigos-${campaign.prefix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-2 -ml-2">
              <ArrowLeft className="mr-1 h-4 w-4" /> Panel
            </Button>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Ticket className="h-6 w-6 text-primary" /> Campañas de registro
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Códigos por tandas para dar de alta médicos y residentes: «los primeros 50 a precio de lanzamiento».
              Sólo tú ves los códigos; quien se registra sólo puede comprobar el suyo.
            </p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)} className="flex-shrink-0">
            <Plus className="mr-1 h-4 w-4" /> Nueva campaña
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nueva campaña</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Primeros 50 médicos" />
                </div>
                <div className="space-y-1.5">
                  <Label>Prefijo del código</Label>
                  <Input
                    value={fPrefix}
                    onChange={(e) => setFPrefix(prefixify(e.target.value))}
                    placeholder="MM50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Quedarán así: <span className="font-mono">{(prefixify(fPrefix || fName) || 'MM50')}-001-K7QD</span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>¿Para quién?</Label>
                  <Select value={fRole} onValueChange={(v) => setFRole(v as Campaign['target_role'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">Médicos</SelectItem>
                      <SelectItem value="resident">Residentes</SelectItem>
                      <SelectItem value="any">Médicos y residentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cuántos códigos ahora</Label>
                  <Select value={fFirstBatch} onValueChange={setFFirstBatch}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="0">Ninguno por ahora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Precio de la campaña (MXN)</Label>
                  <Input value={fPrice} onChange={(e) => setFPrice(e.target.value)} inputMode="decimal" placeholder="499" />
                  <p className="text-xs text-muted-foreground">Opcional. Es la referencia de lo que pagan los de esta tanda.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>o descuento (%)</Label>
                  <Input value={fDiscount} onChange={(e) => setFDiscount(e.target.value)} inputMode="decimal" placeholder="50" />
                </div>
                <div className="space-y-1.5">
                  <Label>Caduca el</Label>
                  <Input type="date" value={fExpires} onChange={(e) => setFExpires(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Opcional. Sin fecha, los códigos no caducan.</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Notas internas</Label>
                  <Textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2} placeholder="Para el congreso de septiembre…" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={createCampaign} disabled={saving}>
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                  Crear y generar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Ticket className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">Todavía no hay campañas.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Crea la primera: «Primeros 50 médicos», 50 códigos, precio de lanzamiento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => {
              const n = counts[c.id] || { total: 0, available: 0, redeemed: 0, revoked: 0 };
              const isOpen = expanded === c.id;
              const pct = n.total ? Math.round((n.redeemed / n.total) * 100) : 0;
              return (
                <Card key={c.id} className={c.is_active ? '' : 'opacity-70'}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
                            {c.prefix}
                          </span>
                          <h3 className="font-semibold">{c.name}</h3>
                          {c.is_active
                            ? <Badge variant="success">Activa</Badge>
                            : <Badge variant="secondary">Pausada</Badge>}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {ROLE_LABEL[c.target_role]}</span>
                          {c.price_cents != null && (
                            <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {money(c.price_cents, c.currency)}</span>
                          )}
                          {c.discount_percentage != null && (
                            <span className="flex items-center gap-1"><Percent className="h-3 w-3" /> {c.discount_percentage}% dto.</span>
                          )}
                          {c.expires_at && <span>Caduca {new Date(c.expires_at).toLocaleDateString('es-MX')}</span>}
                        </div>
                        {c.notes && <p className="mt-2 text-xs text-muted-foreground">{c.notes}</p>}
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                        <Button variant="outline" size="sm" onClick={() => toggleExpand(c.id)}>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="ml-1">Códigos</span>
                        </Button>
                      </div>
                    </div>

                    {/* Marcador de la tanda */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">
                          {n.redeemed} de {n.total} usados
                          {n.revoked > 0 && <span className="text-muted-foreground"> · {n.revoked} anulados</span>}
                        </span>
                        <span className="text-muted-foreground">{n.available} libres</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-4 border-t border-border pt-4">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => generateMore(c, 50)} disabled={busy === c.id}>
                            {busy === c.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                            50 más
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => generateMore(c, 100)} disabled={busy === c.id}>
                            <Plus className="mr-1 h-3.5 w-3.5" /> 100 más
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => copyAvailable(c)}>
                            <Copy className="mr-1 h-3.5 w-3.5" /> Copiar libres
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => downloadCsv(c)}>
                            <Download className="mr-1 h-3.5 w-3.5" /> CSV
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => loadCodes(c.id)}>
                            <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Actualizar
                          </Button>
                        </div>

                        <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                              <tr className="text-left">
                                <th className="px-2 py-1.5 font-medium">#</th>
                                <th className="px-2 py-1.5 font-medium">Código</th>
                                <th className="px-2 py-1.5 font-medium">Estado</th>
                                <th className="px-2 py-1.5 font-medium">Canjeado</th>
                                <th className="px-2 py-1.5" />
                              </tr>
                            </thead>
                            <tbody>
                              {(codes[c.id] || []).map((code) => (
                                <tr key={code.id} className="border-t border-border">
                                  <td className="px-2 py-1.5 text-muted-foreground">{code.seq}</td>
                                  <td className="px-2 py-1.5 font-mono font-semibold">{code.code}</td>
                                  <td className="px-2 py-1.5">
                                    {code.status === 'available' && <span className="text-muted-foreground">Libre</span>}
                                    {code.status === 'redeemed' && (
                                      <span className="inline-flex items-center gap-1 font-medium text-success">
                                        <CheckCircle2 className="h-3 w-3" /> Usado
                                      </span>
                                    )}
                                    {code.status === 'revoked' && (
                                      <span className="inline-flex items-center gap-1 text-destructive"><Ban className="h-3 w-3" /> Anulado</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1.5 text-muted-foreground">
                                    {code.redeemed_at ? new Date(code.redeemed_at).toLocaleDateString('es-MX') : '—'}
                                  </td>
                                  <td className="px-2 py-1.5 text-right">
                                    {code.status === 'available' && (
                                      <>
                                        <Button
                                          size="sm" variant="ghost" className="h-6 px-1.5"
                                          onClick={() => { navigator.clipboard.writeText(code.code); toast.success('Copiado'); }}
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm" variant="ghost" className="h-6 px-1.5 text-destructive"
                                          onClick={() => revokeCode(c.id, code)}
                                        >
                                          <Ban className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
