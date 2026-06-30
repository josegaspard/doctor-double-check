import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

interface DocumentSignatureProps {
  signerName: string;
  onSignerNameChange: (name: string) => void;
  termsAccepted: boolean;
  onTermsChange: (accepted: boolean) => void;
  privacyAccepted: boolean;
  onPrivacyChange: (accepted: boolean) => void;
  doctorContractAccepted?: boolean;
  onDoctorContractChange?: (accepted: boolean) => void;
  showDoctorContract?: boolean;
  codeOfEthicsAccepted?: boolean;
  onCodeOfEthicsChange?: (accepted: boolean) => void;
  showCodeOfEthics?: boolean;
}

export function DocumentSignature({
  signerName,
  onSignerNameChange,
  termsAccepted,
  onTermsChange,
  privacyAccepted,
  onPrivacyChange,
  doctorContractAccepted,
  onDoctorContractChange,
  showDoctorContract = false,
  codeOfEthicsAccepted,
  onCodeOfEthicsChange,
  showCodeOfEthics = false,
}: DocumentSignatureProps) {
  const { t } = useLanguage();
  const allSigned = termsAccepted && privacyAccepted
    && (!showDoctorContract || doctorContractAccepted)
    && (!showCodeOfEthics || codeOfEthicsAccepted);

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-sm text-foreground">{t('fix20.admin.docSignatureTitle')}</h4>
        {allSigned && (
          <Badge variant="success" className="ml-auto gap-1 text-[10px]">
            <CheckCircle className="w-3 h-3" />
            Firmado
          </Badge>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Nombre completo (firma digital)</Label>
        <Input
          placeholder={t('fix20.admin.docSignatureNamePlaceholder')}
          value={signerName}
          onChange={(e) => onSignerNameChange(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={(checked) => onTermsChange(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor="terms" className="text-sm text-foreground cursor-pointer">
            Acepto los{' '}
            <Link to="/terms" target="_blank" className="text-primary underline">
              Términos de Servicio
            </Link>
          </label>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="privacy"
            checked={privacyAccepted}
            onCheckedChange={(checked) => onPrivacyChange(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor="privacy" className="text-sm text-foreground cursor-pointer">
            Acepto la{' '}
            <Link to="/privacy" target="_blank" className="text-primary underline">
              Política de Privacidad
            </Link>
          </label>
        </div>

        {showDoctorContract && (
          <div className="flex items-start gap-2">
            <Checkbox
              id="doctor-contract"
              checked={doctorContractAccepted}
              onCheckedChange={(checked) => onDoctorContractChange?.(checked === true)}
              className="mt-0.5"
            />
            <label htmlFor="doctor-contract" className="text-sm text-foreground cursor-pointer">
              Acepto el contrato de prestación de servicios médicos en la plataforma
            </label>
          </div>
        )}

        {showCodeOfEthics && (
          <div className="flex items-start gap-2">
            <Checkbox
              id="code-of-ethics"
              checked={codeOfEthicsAccepted}
              onCheckedChange={(checked) => onCodeOfEthicsChange?.(checked === true)}
              className="mt-0.5"
            />
            <label htmlFor="code-of-ethics" className="text-sm text-foreground cursor-pointer">
              He leído y acepto el{' '}
              <Link to="/codigo-etica" target="_blank" className="text-primary underline">
                Código de Ética
              </Link>{' '}
              de Medical Masters
            </label>
          </div>
        )}
      </div>

      {signerName && allSigned && (
        <p className="text-[10px] text-muted-foreground border-t border-border pt-2">
          Firmado electrónicamente por <strong>{signerName}</strong> el{' '}
          {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}
