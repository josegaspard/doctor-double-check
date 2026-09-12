// Trayectoria pública del médico, tal como la ve un VISITANTE en /doctor/:id
// (11-sep-2026). Distinto de DoctorCredentials.tsx (que es el panel de EDICIÓN
// del propio médico, con pendientes/rechazados y el interruptor de publicar).
//
// Este componente solo lee `useDoctorPublicCredentials`, que ya trae SOLO lo
// aprobado y publicado (con respaldo a status='approved' si la migración de
// la rpc `get_doctor_public_credentials` todavía no está aplicada). No hace
// ninguna lectura propia a las tablas: así nunca puede colarse aquí nada
// pendiente, rechazado, o marcado como privado por el médico.
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { GraduationCap, Award, Briefcase, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionTabs } from '@/components/common/SectionTabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDoctorPublicCredentials } from '@/hooks/useDoctorPublicCredentials';

interface DoctorCredentialsCardProps {
  doctorId: string;
}

type CredTab = 'education' | 'certifications' | 'experience';

export default function DoctorCredentialsCard({ doctorId }: DoctorCredentialsCardProps) {
  const { t } = useLanguage();
  const { credentials, loading } = useDoctorPublicCredentials(doctorId);
  const [tab, setTab] = useState<CredTab>('education');

  const tabs: { id: CredTab; label: string; icon: LucideIcon; count: number }[] = [
    { id: 'education', label: t('mm2.publicProfile.tabEducation'), icon: GraduationCap, count: credentials.education.length },
    { id: 'certifications', label: t('mm2.publicProfile.tabCertifications'), icon: Award, count: credentials.certifications.length },
    { id: 'experience', label: t('mm2.publicProfile.tabExperience'), icon: Briefcase, count: credentials.experience.length },
  ];
  const available = tabs.filter(s => s.count > 0);
  const totalCount = credentials.education.length + credentials.certifications.length + credentials.experience.length;

  // Si la pestaña activa se quedó sin contenido (o todavía no cargó), aterriza
  // en la primera pestaña que sí tenga algo que enseñar.
  useEffect(() => {
    if (available.length > 0 && !available.some(s => s.id === tab)) {
      setTab(available[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available.map(s => s.id).join(',')]);

  if (loading) {
    return (
      <Card className="mt-3">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Nada aprobado y publicado todavía: perfil honesto sin trayectoria en vez
  // de una tarjeta vacía o con datos por defecto.
  if (totalCount === 0) return null;

  const activeTab = available.find(s => s.id === tab) || available[0];

  return (
    <Card className="mt-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          {t('mm2.publicProfile.cardTitle')}
        </CardTitle>
        {/* Deja claro que esto es lo VERIFICADO — a diferencia de la bio o la
            especialidad del encabezado, que el médico declara sin revisión. */}
        <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
          <span>{t('mm2.publicProfile.verifiedNote')}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {available.length > 1 && (
          <SectionTabs<CredTab>
            value={activeTab.id}
            onChange={setTab}
            variant="onLight"
            ariaLabel={t('mm2.publicProfile.cardTitle')}
            items={available.map(({ id, label, icon }) => ({ id, label, icon }))}
          />
        )}

        {activeTab.id === 'education' && (
          <div className="space-y-3">
            {credentials.education.map(edu => (
              <div key={edu.id} className="border rounded-lg p-3 space-y-1">
                <p className="font-semibold text-sm">{edu.degree}</p>
                {!!edu.institution?.trim() && <p className="text-sm text-muted-foreground">{edu.institution}</p>}
                {!!edu.field_of_study && <p className="text-xs text-muted-foreground">{edu.field_of_study}</p>}
                {(edu.start_year || edu.end_year) && (
                  <p className="text-xs text-muted-foreground">
                    {edu.start_year || '?'} — {edu.end_year || t('mm2.publicProfile.present')}
                  </p>
                )}
                {!!edu.description && <p className="text-xs mt-1">{edu.description}</p>}
              </div>
            ))}
          </div>
        )}

        {activeTab.id === 'certifications' && (
          <div className="space-y-3">
            {credentials.certifications.map(cert => (
              <div key={cert.id} className="border rounded-lg p-3 space-y-1">
                <p className="font-semibold text-sm">{cert.name}</p>
                {!!cert.issuing_organization?.trim() && <p className="text-sm text-muted-foreground">{cert.issuing_organization}</p>}
                {!!cert.issue_date && (
                  <p className="text-xs text-muted-foreground">{t('mm2.publicProfile.issuedLabel')}: {cert.issue_date}</p>
                )}
                {!!cert.expiry_date && (
                  <p className="text-xs text-muted-foreground">{t('mm2.publicProfile.expiresLabel')}: {cert.expiry_date}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab.id === 'experience' && (
          <div className="space-y-3">
            {credentials.experience.map(exp => (
              <div key={exp.id} className="border rounded-lg p-3 space-y-1">
                <p className="font-semibold text-sm">{exp.title}</p>
                {!!exp.organization?.trim() && <p className="text-sm text-muted-foreground">{exp.organization}</p>}
                {!!exp.location && <p className="text-xs text-muted-foreground">{exp.location}</p>}
                {(exp.start_date || exp.end_date || exp.is_current) && (
                  <p className="text-xs text-muted-foreground">
                    {exp.start_date || '?'} — {exp.is_current ? t('mm2.publicProfile.present') : (exp.end_date || '?')}
                  </p>
                )}
                {!!exp.description && <p className="text-xs mt-1">{exp.description}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
