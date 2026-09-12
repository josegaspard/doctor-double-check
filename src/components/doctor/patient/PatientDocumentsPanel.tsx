// Documentos que UN paciente ha compartido con el médico (Paciente > Documentos), 11-sep-2026.
//
// Es lo que antes vivía en /doctor/vault («Expedientes de pacientes»), pero de un
// solo paciente: el mismo código de verificación (OTP), la misma vista previa con
// marca de agua y la misma auditoría (VaultFilePreviewModal → log_vault_action).
// Sin descarga y sin el bloque de «cobros» estimado que tenía la bóveda.
import React, { useState } from 'react';
import { Eye, FileText, Image as ImageIcon, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOtp } from '@/contexts/OtpContext';
import type { VaultFile } from '@/contexts/VaultContext';
import { VaultFilePreviewModal } from '@/components/vault/VaultFilePreviewModal';
import { useAppDateFormat } from '@/lib/dateFormat';
import { fill } from '@/lib/proFormat';

interface Props {
  patientId: string;
  patientName: string;
  files: VaultFile[];
}

const formatSize = (bytes: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function PatientDocumentsPanel({ patientId, patientName, files }: Props) {
  const { t } = useLanguage();
  const fmt = useAppDateFormat();
  const { openOtpForPatient, isPatientVerified } = useOtp();
  const [selected, setSelected] = useState<VaultFile | null>(null);
  const verified = isPatientVerified(patientId);

  const open = (file: VaultFile) => {
    if (!verified) {
      openOtpForPatient(patientId, patientName);
      return;
    }
    setSelected(file);
  };

  if (files.length === 0) {
    return (
      <section className="pro-card pro-card-pad bg-card text-center py-10">
        <Lock className="w-12 h-12 mx-auto pro-muted opacity-40 mb-3" />
        <h2 className="font-heading font-extrabold pro-ink">{t('mm2.patients.docs.empty')}</h2>
        <p className="pro-muted text-sm mt-1 max-w-md mx-auto">{t('mm2.patients.docs.emptyHint')}</p>
      </section>
    );
  }

  return (
    <section className="pro-card pro-card-pad bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="pro-card-title">{t('mm2.patients.docs.title')}</h2>
        <span className="text-xs pro-muted">{fill(t('mm2.patients.docs.count'), { n: files.length })}</span>
      </div>

      {verified ? (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#e7f6ef] px-3 py-1 text-xs font-semibold text-[#1f7a4d]">
          <ShieldCheck className="w-3.5 h-3.5" /> {t('mm2.patients.docs.verified')}
        </p>
      ) : (
        <div className="mb-3 rounded-2xl border border-[#d6e1e7] bg-[#f3f6fa] p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <KeyRound className="w-4 h-4 text-primary flex-none mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold pro-ink">{t('mm2.patients.docs.verifyTitle')}</p>
              <p className="text-xs pro-muted">{t('mm2.patients.docs.verifyDesc')}</p>
            </div>
          </div>
          <button type="button" className="pro-btn pro-btn-teal pro-btn-sm self-start sm:self-center" onClick={() => openOtpForPatient(patientId, patientName)}>
            <KeyRound /> {t('mm2.patients.docs.verify')}
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {files.map((file) => (
          <li key={file.id}>
            <button
              type="button"
              onClick={() => open(file)}
              className={`w-full text-left rounded-2xl border border-[#d6e1e7] bg-white p-3 flex items-center gap-3 min-w-0 transition-colors ${verified ? 'hover:bg-[#f3f6fa]' : 'opacity-70'}`}
            >
              <span className="w-10 h-10 rounded-xl bg-[#f3f6fa] flex items-center justify-center flex-none">
                {file.type === 'image' ? <ImageIcon className="w-5 h-5 text-primary" /> : <FileText className="w-5 h-5 text-primary" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-sm pro-ink truncate">{file.name}</span>
                <span className="block text-xs pro-muted truncate">
                  {[file.category, formatSize(file.size), file.uploadedAt ? fmt.formatDate(file.uploadedAt) : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              {verified ? <Eye className="w-4 h-4 text-primary flex-none" aria-label={t('mm2.patients.docs.view')} /> : <Lock className="w-4 h-4 pro-muted flex-none" />}
            </button>
          </li>
        ))}
      </ul>

      <VaultFilePreviewModal isOpen={!!selected} onClose={() => setSelected(null)} file={selected} viewOnly />
    </section>
  );
}

export default PatientDocumentsPanel;
