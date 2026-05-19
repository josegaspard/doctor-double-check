import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVault } from '@/contexts/VaultContext';
import { useOtp } from '@/contexts/OtpContext';
import MainLayout from '@/components/layout/MainLayout';
import { VaultFilePreviewModal } from '@/components/vault/VaultFilePreviewModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Folder, FileText, Image, ArrowLeft, Lock, User, Users,
  Calendar, Eye, KeyRound, ShieldCheck, DollarSign, Mail, UserPlus,
} from 'lucide-react';
import { VaultAuditPanel } from '@/components/vault/VaultAuditPanel';
import { VaultFile } from '@/contexts/VaultContext';
import { supabase } from '@/integrations/supabase/client';
import { PriceDisplay } from '@/components/currency/PriceDisplay';
import { AddPatientModal } from '@/components/doctor/AddPatientModal';

interface PatientPaymentSummary {
  patientEmail: string | null;
  totalPaid: number;
  consultationsCount: number;
  purchasesCount: number;
  lastPaymentAt: string | null;
}

export default function DoctorVault() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { getAccessibleFiles } = useVault();
  const { openOtpForPatient, isPatientVerified } = useOtp();
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [autoOpenHandled, setAutoOpenHandled] = useState(false);
  const [paymentsByPatient, setPaymentsByPatient] = useState<Record<string, PatientPaymentSummary>>({});
  const [showAddPatient, setShowAddPatient] = useState(false);

  const accessibleFiles = getAccessibleFiles(user?.id || '');

  // Auto-open patient content when redirected from OTP verification
  const targetPatientId = searchParams.get('patient');
  useEffect(() => {
    if (!targetPatientId || autoOpenHandled) return;
    if (!isPatientVerified(targetPatientId)) return;
    const patientFiles = accessibleFiles.filter(f => f.patientId === targetPatientId);
    if (patientFiles.length > 0) {
      setSelectedFile(patientFiles[0]);
      setIsPreviewOpen(true);
    }
    setAutoOpenHandled(true);
    setSearchParams({}, { replace: true });
  }, [targetPatientId, autoOpenHandled, accessibleFiles, isPatientVerified, setSearchParams]);

  useEffect(() => {
    if (role && role !== 'doctor') navigate('/lives');
  }, [role, navigate]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getIcon = (type: string) => {
    if (type === 'image') return <Image className="w-5 h-5 text-info" />;
    return <FileText className="w-5 h-5 text-primary" />;
  };

  const handleViewFile = (file: VaultFile) => {
    if (!isPatientVerified(file.patientId)) {
      openOtpForPatient(file.patientId, file.patientName || t('doctorVaultPage.patientFallback'));
      setSelectedFile(file);
      return;
    }
    setSelectedFile(file);
    setIsPreviewOpen(true);
  };

  // Group files by patient
  const filesByPatient: Record<string, { patientName: string; files: VaultFile[] }> = {};
  accessibleFiles.forEach(file => {
    if (!filesByPatient[file.patientId]) {
      filesByPatient[file.patientId] = {
        patientName: file.patientName || `${t('doctorVaultPage.patientFallbackPrefix')} ${file.patientId.slice(-3)}`,
        files: [],
      };
    }
    filesByPatient[file.patientId].files.push(file);
  });

  const patientKeys = Object.keys(filesByPatient).join(',');
  useEffect(() => {
    const patientIds = patientKeys ? patientKeys.split(',') : [];
    if (!user?.id || patientIds.length === 0) return;
    (async () => {
      const [{ data: cons }, { data: profs }, { data: dp }, { data: purchases }] = await Promise.all([
        supabase.from('consultations').select('patient_id, completed_at, started_at, status').eq('doctor_id', user.id).in('patient_id', patientIds),
        supabase.from('profiles').select('id, email').in('id', patientIds),
        supabase.from('doctor_profiles').select('consultation_fee').eq('user_id', user.id).maybeSingle(),
        supabase.from('purchases').select('user_id, amount, created_at, content_id').in('user_id', patientIds),
      ]);
      const emailMap = new Map((profs || []).map((p: any) => [p.id, p.email]));
      const fee = Number(dp?.consultation_fee || 0);
      const summary: Record<string, PatientPaymentSummary> = {};
      for (const pid of patientIds) {
        const myCons = (cons || []).filter((c: any) => c.patient_id === pid && c.status === 'completed');
        const myPurchases = (purchases || []).filter((p: any) => p.user_id === pid);
        const consultTotal = myCons.length * fee;
        const purchaseTotal = myPurchases.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        const lastConsult = myCons[0]?.completed_at || myCons[0]?.started_at || null;
        const lastPurchase = myPurchases[0]?.created_at || null;
        const lastPaymentAt = [lastConsult, lastPurchase].filter(Boolean).sort().reverse()[0] || null;
        summary[pid] = {
          patientEmail: emailMap.get(pid) || null,
          totalPaid: consultTotal + purchaseTotal,
          consultationsCount: myCons.length,
          purchasesCount: myPurchases.length,
          lastPaymentAt,
        };
      }
      setPaymentsByPatient(summary);
    })();
  }, [user?.id, patientKeys]);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/doctor/dashboard')} className="hidden sm:inline-flex mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('doctorVaultPage.backToPanel')}
        </Button>

        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              {t('nav.doctorVault')}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              {t('doctorVaultPage.description')}
            </p>
          </div>
          <Button size="sm" onClick={() => setShowAddPatient(true)} className="gap-2 flex-shrink-0">
            <UserPlus className="w-4 h-4" />
            {t('doctorVaultPage.addPatient')}
          </Button>
        </div>

        {/* Info Banner */}
        <Card className="mb-6 bg-info/10 border-info/30">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground text-sm">{t('doctorVaultPage.infoBannerTitle')}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('doctorVaultPage.infoBannerText')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Files by Patient */}
        {Object.keys(filesByPatient).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(filesByPatient).map(([patientId, { patientName, files }]) => (
              <Card key={patientId}>
                <CardHeader className="pb-3 px-3 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2 flex-wrap">
                    <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{patientName}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">{files.length} {t('doctorVaultPage.filesCountSuffix')}</Badge>
                    {isPatientVerified(patientId) && (
                      <Badge variant="info" className="gap-1 text-[10px]">
                        <ShieldCheck className="w-3 h-3" />
                        {t('doctorVaultPage.verifiedBadge')}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {paymentsByPatient[patientId] && (paymentsByPatient[patientId].consultationsCount > 0 || paymentsByPatient[patientId].purchasesCount > 0 || paymentsByPatient[patientId].patientEmail) && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-3 space-y-2">
                      {/* Contacto de cobros */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate" title={paymentsByPatient[patientId].patientEmail || ''}>
                          {paymentsByPatient[patientId].patientEmail || t('doctorVaultPage.noEmailRegistered')}
                        </span>
                      </div>

                      {/* Total destacado */}
                      <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-primary/10">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{t('doctorVaultPage.totalPaid')}</span>
                        <span className="flex items-center gap-1 text-base sm:text-lg font-bold text-primary">
                          <DollarSign className="w-4 h-4" />
                          <PriceDisplay amount={paymentsByPatient[patientId].totalPaid} />
                        </span>
                      </div>

                      {/* Desglose orientaciones vs compras */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-background/60 rounded-md p-2">
                          <p className="text-[10px] uppercase text-muted-foreground font-medium leading-tight">{t('doctorVaultPage.consultations')}</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">
                            {paymentsByPatient[patientId].consultationsCount}
                          </p>
                        </div>
                        <div className="bg-background/60 rounded-md p-2">
                          <p className="text-[10px] uppercase text-muted-foreground font-medium leading-tight">{t('doctorVaultPage.purchases')}</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">
                            {paymentsByPatient[patientId].purchasesCount}
                          </p>
                        </div>
                      </div>

                      {paymentsByPatient[patientId].lastPaymentAt && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
                          <Calendar className="w-3 h-3" />
                          {t('doctorVaultPage.lastPayment')} {new Date(paymentsByPatient[patientId].lastPaymentAt!).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  )}
                  {!isPatientVerified(patientId) && (
                    <div className="bg-secondary/10 border border-secondary/40 rounded-lg p-3 mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <KeyRound className="w-4 h-4 text-secondary flex-shrink-0" />
                        <span className="text-xs text-foreground font-medium truncate">{t('doctorVaultPage.requiresOtpVerification')}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openOtpForPatient(patientId, patientName)}
                        className="h-8 text-xs gap-1 flex-shrink-0 border-secondary/40 text-secondary hover:bg-secondary/10"
                      >
                        <KeyRound className="w-3 h-3" />
                        {t('doctorVaultPage.verify')}
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {files.map(file => (
                      <div 
                        key={file.id} 
                        className={`flex items-center gap-3 p-3 bg-muted/50 rounded-lg transition-colors min-w-0 ${
                          isPatientVerified(patientId) ? 'cursor-pointer hover:bg-muted active:scale-[0.98]' : 'opacity-60'
                        }`}
                        onClick={() => handleViewFile(file)}
                      >
                        <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
                          {getIcon(file.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="truncate">{file.category}</span>
                            <span>•</span>
                            <span className="flex-shrink-0">{formatSize(file.size)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(file.uploadedAt).toLocaleDateString('es-MX')}
                          </span>
                          {isPatientVerified(patientId) ? (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-9 h-9"
                              title={t('common.viewFile')}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewFile(file);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 sm:p-12 text-center">
            <Lock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
              {t('doctorVaultPage.emptyTitle')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('doctorVaultPage.emptyText')}
            </p>
          </Card>
        )}

        {/* Auditoría: doctor ve sus propios accesos y revocaciones */}
        {user?.id && (
          <div className="mt-6">
            <VaultAuditPanel mode="doctor" userId={user.id} />
          </div>
        )}
      </div>

      <VaultFilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSelectedFile(null);
        }}
        file={selectedFile}
        viewOnly={true}
      />

      <AddPatientModal
        open={showAddPatient}
        onOpenChange={setShowAddPatient}
      />
    </MainLayout>
  );
}
