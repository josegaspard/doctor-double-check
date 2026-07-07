import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ShieldCheck, Stethoscope, User, Pill, Calendar, Loader2 } from 'lucide-react';
import { prescriptionFolio } from '@/lib/generatePrescriptionPDF';

interface VerifiedRx {
  id: string;
  doctor_name: string;
  doctor_specialty: string;
  doctor_license: string;
  doctor_cedula: string | null;
  patient_name: string;
  patient_age: string | null;
  medications: any[];
  signed_at: string;
}

// Página PÚBLICA (sin login) para verificar la autenticidad de una receta
// escaneando el QR o abriendo el enlace. Mirror del portal de Prescrypto.
export default function VerifyPrescription() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [rx, setRx] = useState<VerifiedRx | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!id) { setLoading(false); return; }
      const { data, error } = await supabase.rpc('verify_prescription', { p_id: id } as any);
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row) {
        setRx({ ...(row as any), medications: Array.isArray((row as any).medications) ? (row as any).medications : [] });
      }
      setLoading(false);
    };
    run();
  }, [id]);

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1d45] to-[#163a83] px-4 py-8 sm:py-12">
      <div className="max-w-xl mx-auto">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-6 text-white">
          <ShieldCheck className="w-6 h-6" />
          <span className="font-heading font-bold text-lg tracking-tight">Medical Masters</span>
        </div>

        {loading ? (
          <Card className="border-0 shadow-2xl">
            <CardContent className="py-16 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('rxVerify.checking')}</p>
            </CardContent>
          </Card>
        ) : !rx ? (
          <Card className="border-0 shadow-2xl">
            <CardContent className="py-14 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-9 h-9 text-destructive" />
              </div>
              <h1 className="text-xl font-bold mb-2">{t('rxVerify.invalidTitle')}</h1>
              <p className="text-sm text-muted-foreground">{t('rxVerify.invalidBody')}</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-2xl overflow-hidden">
            {/* Valid banner */}
            <div className="bg-success/10 border-b border-success/20 px-5 py-5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-7 h-7 text-success" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-success leading-tight">{t('rxVerify.validTitle')}</h1>
                <p className="text-xs text-muted-foreground">{t('rxVerify.validBody')}</p>
              </div>
            </div>

            <CardContent className="p-5 space-y-5">
              {/* Folio + fecha */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t('rxExtra.folioLabel')}</p>
                  <p className="font-mono font-bold text-primary text-lg">{prescriptionFolio(rx.id)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{t('rxVerify.issuedOn')}</p>
                  <p className="text-sm font-medium">{fmt(rx.signed_at)}</p>
                </div>
              </div>

              {/* Doctor */}
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1"><Stethoscope className="w-3 h-3" />{t('rxVerify.doctor')}</p>
                <p className="font-semibold text-foreground">{rx.doctor_name}</p>
                <p className="text-sm text-primary">{rx.doctor_specialty}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('prescriptionDetailPage.doctor.licenseLabel')} {rx.doctor_license}
                  {rx.doctor_cedula ? ` · ${t('prescriptionDetailPage.doctor.cedulaLabel')} ${rx.doctor_cedula}` : ''}
                </p>
              </div>

              {/* Paciente */}
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1"><User className="w-3 h-3" />{t('rxVerify.patient')}</p>
                <p className="font-medium text-foreground">{rx.patient_name}</p>
                {rx.patient_age && <p className="text-sm text-muted-foreground">{rx.patient_age}</p>}
              </div>

              {/* Medicamentos */}
              {rx.medications.length > 0 && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-2"><Pill className="w-3 h-3" />{t('rxVerify.medications')} ({rx.medications.length})</p>
                  <div className="space-y-2">
                    {rx.medications.map((m: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm rounded-lg border border-border p-2.5">
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">#{i + 1}</Badge>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{m.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[m.dosage, m.route, m.frequency, m.duration].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground text-center pt-2 border-t border-border">
                {t('rxVerify.footer')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
