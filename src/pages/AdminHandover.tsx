import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, CheckCircle2, Loader2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// La confirmación vive en site_settings id='handover_acta': solo los administradores la
// leen y la escriben (no está en la lista de lectura pública).
const ACTA_ID = 'handover_acta';
const GUIDE_URL = '/entrega-2jqxxtcibd.html';

type Confirmation = { by: string; at: string };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Mexico_City' });

export default function AdminHandover() {
  const navigate = useNavigate();
  const { role, supabaseUser } = useAuth();
  const [confirmed, setConfirmed] = useState<Confirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (role && role !== 'admin') navigate('/');
  }, [role, navigate]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('id', ACTA_ID).maybeSingle();
    setConfirmed(((data?.value as { confirmed?: Confirmation } | null)?.confirmed) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirm = async () => {
    setBusy(true);
    const value = { confirmed: { by: supabaseUser?.email ?? 'administrador', at: new Date().toISOString() } };
    const { error } = await supabase
      .from('site_settings')
      .upsert({ id: ACTA_ID, value: value as unknown as Json, updated_by: supabaseUser?.id });
    setBusy(false);
    if (error) return toast.error(`No se pudo confirmar: ${error.message}`);
    setConfirmed(value.confirmed);
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-2xl pb-36">
        <div className="rounded-2xl bg-white border-2 border-primary/30 shadow-md p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <Button variant="back" size="icon" onClick={() => navigate('/admin')} aria-label="Volver al panel">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-secondary">Entrega de la plataforma</h1>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : confirmed ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-20 h-20 text-success mx-auto" />
              <p className="font-heading text-2xl font-bold text-secondary mt-4">Entrega recibida</p>
              <p className="text-secondary/80 mt-2">Confirmada por {confirmed.by}</p>
              <p className="text-secondary/80">el {fmt(confirmed.at)}</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <PackageCheck className="w-16 h-16 text-primary mx-auto" />
              <p className="text-secondary mt-4">HGROUP entrega a Medical Masters la plataforma medical-masters.com completa, funcionando y con su panel de administración.</p>
              <Button size="lg" className="mt-6 w-full sm:w-auto px-10" disabled={busy} onClick={confirm}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar entrega'}
              </Button>
            </div>
          )}

          <div className="text-center">
            <a href={GUIDE_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold">
              <BookOpen className="w-4 h-4" /> Ver la guía de entrega
            </a>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
