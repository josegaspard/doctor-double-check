import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { InlineFileViewer } from '@/components/content/InlineFileViewer';
import { Loader2, GraduationCap, Award, IdCard, FileX } from 'lucide-react';

// Panel de admin para revisar TODOS los documentos que un doctor subió al aplicar:
// identidad (frente/reverso/selfie), diplomas de educación y certificaciones.
// Reutiliza InlineFileViewer (firma URLs por bucket; el admin tiene política de
// SELECT sobre 'doctor-credentials' e 'identity-documents'). Cliente 2026-06-17.

interface DocItem {
  key: string;
  label: string;
  status?: string | null;
  bucket: string;
  fileUrl: string;
}

interface DocSection {
  key: string;
  title: string;
  icon: React.ElementType;
  items: DocItem[];
}

export function DoctorDocumentsDialog({
  userId,
  doctorName,
  open,
  onOpenChange,
}: {
  userId: string | null;
  doctorName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<DocSection[]>([]);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const client = supabase as any;
      const [eduRes, certRes, idRes, dpRes] = await Promise.all([
        client.from('doctor_education').select('id, degree, institution, document_url, status').eq('doctor_id', userId),
        client.from('doctor_certifications').select('id, name, issuing_organization, document_url, status').eq('doctor_id', userId),
        client.from('identity_verifications').select('id, status, metadata').eq('user_id', userId).order('created_at', { ascending: false }),
        client.from('doctor_profiles').select('cedula_photo_url, cedula_status').eq('user_id', userId).maybeSingle(),
      ]);

      // Foto de la cédula profesional subida en el onboarding (cliente 2026-07-08)
      const cedulaItems: DocItem[] = [];
      if (dpRes.data?.cedula_photo_url) {
        cedulaItems.push({
          key: 'cedula-photo',
          label: t('doctorDocuments.cedulaPhoto'),
          status: dpRes.data.cedula_status,
          bucket: 'doctor-credentials',
          fileUrl: dpRes.data.cedula_photo_url,
        });
      }

      // Identidad: usa la verificación más reciente que tenga archivos.
      const identityItems: DocItem[] = [];
      const idRow = (idRes.data || []).find((v: any) => v?.metadata && (v.metadata.front_url || v.metadata.back_url || v.metadata.selfie_url));
      if (idRow?.metadata) {
        const m = idRow.metadata as any;
        if (m.front_url) identityItems.push({ key: 'id-front', label: t('doctorDocuments.idFront'), status: idRow.status, bucket: 'identity-documents', fileUrl: m.front_url });
        if (m.back_url) identityItems.push({ key: 'id-back', label: t('doctorDocuments.idBack'), status: idRow.status, bucket: 'identity-documents', fileUrl: m.back_url });
        if (m.selfie_url) identityItems.push({ key: 'id-selfie', label: t('doctorDocuments.idSelfie'), status: idRow.status, bucket: 'identity-documents', fileUrl: m.selfie_url });
      }

      const eduItems: DocItem[] = (eduRes.data || [])
        .filter((e: any) => e.document_url)
        .map((e: any) => ({
          key: `edu-${e.id}`,
          label: [e.degree, e.institution].filter(Boolean).join(' — '),
          status: e.status,
          bucket: 'doctor-credentials',
          fileUrl: e.document_url,
        }));

      const certItems: DocItem[] = (certRes.data || [])
        .filter((c: any) => c.document_url)
        .map((c: any) => ({
          key: `cert-${c.id}`,
          label: [c.name, c.issuing_organization].filter(Boolean).join(' — '),
          status: c.status,
          bucket: 'doctor-credentials',
          fileUrl: c.document_url,
        }));

      const next: DocSection[] = [
        { key: 'cedula', title: t('doctorDocuments.sectionCedula'), icon: IdCard, items: cedulaItems },
        { key: 'identity', title: t('doctorDocuments.sectionIdentity'), icon: IdCard, items: identityItems },
        { key: 'education', title: t('doctorDocuments.sectionEducation'), icon: GraduationCap, items: eduItems },
        { key: 'certifications', title: t('doctorDocuments.sectionCertifications'), icon: Award, items: certItems },
      ].filter(s => s.items.length > 0);

      if (!cancelled) {
        setSections(next);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, userId, t]);

  const statusBadge = (status?: string | null) => {
    if (!status) return null;
    const map: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'secondary', label: t('doctorDocuments.statusPending') },
      verified: { variant: 'success', label: t('doctorDocuments.statusApproved') },
      approved: { variant: 'success', label: t('doctorDocuments.statusApproved') },
      rejected: { variant: 'destructive', label: t('doctorDocuments.statusRejected') },
      failed: { variant: 'destructive', label: t('doctorDocuments.statusRejected') },
    };
    const cfg = map[status];
    if (!cfg) return null;
    return <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('doctorDocuments.title')}</DialogTitle>
          {doctorName && (
            <DialogDescription>
              {t('doctorDocuments.subtitlePrefix')} <strong>{doctorName}</strong>
            </DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">{t('doctorDocuments.loading')}</p>
          </div>
        ) : sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <FileX className="w-10 h-10" />
            <p className="text-sm">{t('doctorDocuments.empty')}</p>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {sections.map(section => {
              const Icon = section.icon;
              return (
                <div key={section.key} className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Icon className="w-4 h-4 text-primary" />
                    {section.title}
                    <span className="text-xs font-normal text-muted-foreground">({section.items.length})</span>
                  </h3>
                  <div className="grid gap-3">
                    {section.items.map(item => (
                      <div key={item.key} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-sm font-medium truncate">{item.label || section.title}</p>
                          {statusBadge(item.status)}
                        </div>
                        <InlineFileViewer fileUrl={item.fileUrl} bucket={item.bucket} className="rounded-md overflow-hidden" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
