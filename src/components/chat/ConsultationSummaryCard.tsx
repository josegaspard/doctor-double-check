import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Stethoscope, ClipboardList, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ConsultationSummary {
  doctor_summary: string | null;
  diagnosis: string | null;
  doctor_recommendations: string | null;
  completed_at: string | null;
}

interface Props {
  consultationId: string | null;
}

export function ConsultationSummaryCard({ consultationId }: Props) {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<ConsultationSummary | null>(null);
  const [sending, setSending] = useState(false);

  const sendByEmail = async () => {
    if (!summary) return;
    const to = prompt('Email destinatario:');
    if (!to) return;
    const trimmed = to.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Email inválido');
      return;
    }
    const lines: string[] = [];
    if (summary.doctor_summary) lines.push(`Resumen:\n${summary.doctor_summary}`);
    if (summary.diagnosis) lines.push(`Diagnóstico:\n${summary.diagnosis}`);
    if (summary.doctor_recommendations) lines.push(`Recomendaciones:\n${summary.doctor_recommendations}`);
    const body = lines.join('\n\n');
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-doctor-note', {
        body: { to: trimmed, subject: 'Resumen médico — Medical Masters', body, kind: 'summary' },
      });
      if (error) throw error;
      toast.success('Resumen enviado por email');
    } catch {
      const subject = encodeURIComponent('Resumen médico — Medical Masters');
      window.location.href = `mailto:${trimmed}?subject=${subject}&body=${encodeURIComponent(body)}`;
      toast.message('Abriendo tu cliente de correo (servicio de email no configurado).');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!consultationId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('consultations')
        .select('doctor_summary, diagnosis, doctor_recommendations, completed_at')
        .eq('id', consultationId)
        .maybeSingle();
      if (data && (data.doctor_summary || data.diagnosis || data.doctor_recommendations)) {
        setSummary(data);
      }
    };
    fetch();
  }, [consultationId]);

  if (!summary) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          {t('postConsultation.summaryTitle')}
          <Badge variant="secondary" className="text-[10px]">{t('postConsultation.completed')}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {summary.doctor_summary && (
          <div>
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
              <ClipboardList className="w-3 h-3" />
              {t('postConsultation.summary')}
            </p>
            <p className="text-foreground">{summary.doctor_summary}</p>
          </div>
        )}
        {summary.diagnosis && (
          <div>
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
              <Stethoscope className="w-3 h-3" />
              {t('postConsultation.diagnosis')}
            </p>
            <p className="text-foreground">{summary.diagnosis}</p>
          </div>
        )}
        {summary.doctor_recommendations && (
          <div>
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
              {t('postConsultation.recommendations')}
            </p>
            <p className="text-foreground">{summary.doctor_recommendations}</p>
          </div>
        )}
        <div className="pt-2 flex justify-end">
          <Button size="sm" variant="outline" onClick={sendByEmail} disabled={sending} className="gap-1.5">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            Enviar por email
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
