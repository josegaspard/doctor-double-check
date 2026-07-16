import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { exportPrescriptionToPDF, prescriptionFolio, prescriptionVerifyUrl } from '@/lib/generatePrescriptionPDF';
import { fetchDoctorCredentials } from '@/lib/doctorCredentials';
import { SecurePDFViewer } from '@/components/security/SecurePDFViewer';
import { SecureImage } from '@/components/security/SecureImage';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';
import { getIntlLocale } from '@/lib/dateLocale';
import {
  ArrowLeft,
  FileText,
  Download,
  Pill,
  Stethoscope,
  Calendar,
  User,
  Clock,
  Image,
  File,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface PrescriptionDetail {
  id: string;
  patientName: string;
  patientAge?: string;
  patientBirthDate?: string;
  diagnosis?: string;
  medications: any[];
  instructions?: string;
  notes?: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorLicense: string;
  doctorCedula?: string;
  doctorNumeroConsejo?: string;
  doctorUniversity?: string;
  doctorHospital?: string;
  doctorCofepris?: string;
  doctorSignatureUrl?: string;
  signedAt: Date;
  createdAt: Date;
  fileUrl?: string;
  doctorId: string;
}

export default function PrescriptionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language, t } = useLanguage();
  const [prescription, setPrescription] = useState<PrescriptionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fileSignedUrl, setFileSignedUrl] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [cedulaVerified, setCedulaVerified] = useState(false);

  useEffect(() => {
    const fetchPrescription = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        setIsLoading(false);
        return;
      }

      setPrescription({
        id: data.id,
        patientName: data.patient_name,
        patientAge: data.patient_age || undefined,
        patientBirthDate: (data as any).patient_birth_date || undefined,
        diagnosis: data.diagnosis || undefined,
        medications: (data.medications as any[]) || [],
        instructions: data.instructions || undefined,
        notes: data.notes || undefined,
        doctorName: data.doctor_name,
        doctorSpecialty: data.doctor_specialty,
        doctorLicense: data.doctor_license,
        doctorCedula: data.doctor_cedula || undefined,
        signedAt: new Date(data.signed_at),
        createdAt: new Date(data.created_at),
        fileUrl: (data as any).file_url || undefined,
        doctorId: data.doctor_id,
      });

      // Credenciales completas del médico (membrete de la receta) + firma, vía RPCs
      // SECURITY DEFINER accesibles también a pacientes.
      const credentials = await fetchDoctorCredentials(data.doctor_id);
      setPrescription(prev => prev ? {
        ...prev,
        doctorNumeroConsejo: credentials.doctorNumeroConsejo,
        doctorUniversity: credentials.doctorUniversity,
        doctorHospital: credentials.doctorHospital,
        doctorCofepris: credentials.doctorCofepris,
        doctorSignatureUrl: credentials.doctorSignatureUrl || prev.doctorSignatureUrl,
      } : prev);

      // ¿Cédula del médico verificada ante SEP? (para badge y PDF)
      const { data: cedRows } = await supabase
        .rpc('verify_prescription', { p_id: data.id } as any);
      const cedRow = Array.isArray(cedRows) ? cedRows[0] : cedRows;
      if ((cedRow as any)?.cedula_verified) setCedulaVerified(true);

      // Get signed URL for the file (short TTL anti-piracy)
      if ((data as any).file_url) {
        setIsLoadingFile(true);
        const { data: signedData } = await supabase.storage
          .from('prescriptions')
          .createSignedUrl((data as any).file_url, 600); // 10 min
        if (signedData?.signedUrl) {
          setFileSignedUrl(signedData.signedUrl);
        }
        setIsLoadingFile(false);
      }

      setIsLoading(false);
    };

    fetchPrescription();
  }, [id]);

  const handleDownloadPDF = () => {
    if (!prescription) return;
    exportPrescriptionToPDF({
      id: prescription.id,
      patientName: prescription.patientName,
      patientAge: prescription.patientAge,
      patientBirthDate: prescription.patientBirthDate,
      diagnosis: prescription.diagnosis,
      medications: prescription.medications,
      instructions: prescription.instructions,
      notes: prescription.notes,
      doctorName: prescription.doctorName,
      doctorSpecialty: prescription.doctorSpecialty,
      doctorLicense: prescription.doctorLicense,
      doctorCedula: prescription.doctorCedula,
      doctorNumeroConsejo: prescription.doctorNumeroConsejo,
      doctorUniversity: prescription.doctorUniversity,
      doctorHospital: prescription.doctorHospital,
      doctorCofepris: prescription.doctorCofepris,
      doctorSignatureUrl: prescription.doctorSignatureUrl,
      signedAt: prescription.signedAt,
      cedulaVerified,
    });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-6 max-w-3xl">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!prescription) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 max-w-3xl text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('prescriptionDetailPage.notFound.title')}</h2>
          <p className="text-muted-foreground mb-4">{t('prescriptionDetailPage.notFound.description')}</p>
          <Button onClick={() => navigate('/prescriptions')}>{t('prescriptionDetailPage.notFound.backButton')}</Button>
        </div>
      </MainLayout>
    );
  }

  const isImage = prescription.fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(prescription.fileUrl);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="back" size="icon" onClick={() => navigate('/prescriptions')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              {t('prescriptionDetailPage.header.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Intl.DateTimeFormat(getIntlLocale(language), {
                day: 'numeric', month: 'long', year: 'numeric',
              }).format(prescription.createdAt)}
            </p>
          </div>
          {prescription.medications.length > 0 && (
            <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t('prescriptionDetailPage.header.downloadPdf')}</span>
            </Button>
          )}
        </div>

        {/* Doctor Info */}
        <Card className="mb-4 bg-white border-2 border-primary/40 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
                <Stethoscope className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-secondary inline-flex items-center gap-1 min-w-0">
                  <span className="truncate">{prescription.doctorName}</span>
                  <DoctorBadgeIcon userId={prescription.doctorId} size="sm" className="flex-shrink-0" />
                </p>
                {prescription.doctorHospital && (
                  <p className="text-xs text-secondary/80">{prescription.doctorHospital}</p>
                )}
                <p className="text-sm text-primary font-medium">{prescription.doctorSpecialty}</p>
                {prescription.doctorUniversity && (
                  <p className="text-xs text-secondary/80">{prescription.doctorUniversity}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-secondary/80 flex-wrap">
                  {prescription.doctorCedula && <span>Céd. Prof. {prescription.doctorCedula}</span>}
                  {prescription.doctorNumeroConsejo && <span>Céd. Esp. Reg. No. Consejo {prescription.doctorNumeroConsejo}</span>}
                  {!prescription.doctorCedula && <span>{t('prescriptionDetailPage.doctor.licenseLabel')} {prescription.doctorLicense}</span>}
                  {prescription.doctorCofepris && <span>COFEPRIS {prescription.doctorCofepris}</span>}
                  {cedulaVerified && (
                    <Badge variant="success" className="gap-1 text-[10px]">
                      <ShieldCheck className="w-3 h-3" />
                      {t('rxVerify.cedulaVerified')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Info */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">{prescription.patientName}</p>
                {prescription.patientAge && (
                  <p className="text-sm text-muted-foreground">{prescription.patientAge}</p>
                )}
                {prescription.patientBirthDate && (
                  <p className="text-sm text-muted-foreground">{t('rxExtra.birthDate')}: {prescription.patientBirthDate}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Diagnosis */}
        {prescription.diagnosis && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning" />
                {t('prescriptionDetailPage.diagnosis.title')}
              </h3>
              <p className="text-foreground">{prescription.diagnosis}</p>
            </CardContent>
          </Card>
        )}

        {/* Attached File */}
        {prescription.fileUrl && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                {isImage ? <Image className="w-4 h-4 text-info" /> : <File className="w-4 h-4 text-primary" />}
                {t('prescriptionDetailPage.attachedFile.title')}
              </h3>
              
              {isLoadingFile ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : fileSignedUrl ? (
                <div>
                  {isImage ? (
                    <SecureImage
                      signedUrl={fileSignedUrl}
                      alt={t('prescriptionDetailPage.attachedFile.imageAlt')}
                      bucket="prescriptions"
                      fileId={prescription.id}
                      maxHeight="500px"
                    />
                  ) : (
                    <SecurePDFViewer
                      signedUrl={fileSignedUrl}
                      fileName={`Receta-${prescription.id}.pdf`}
                      bucket="prescriptions"
                      fileId={prescription.id}
                    />
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('prescriptionDetailPage.attachedFile.loadError')}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Medications */}
        {prescription.medications.length > 0 && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Pill className="w-4 h-4 text-success" />
                {t('prescriptionDetailPage.medications.title')} ({prescription.medications.length})
              </h3>
              <div className="space-y-3">
                {prescription.medications.map((med: any, i: number) => (
                  <div key={i} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">#{i + 1}</Badge>
                      <p className="font-semibold text-foreground">{med.name}</p>
                      {med.genericName && (
                        <span className="text-sm text-muted-foreground">({t('rxExtra.genericShort')}: {med.genericName})</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mt-2">
                      {med.dosage && (
                        <div>
                          <p className="text-xs text-muted-foreground">{t('prescriptionDetailPage.medications.dosageLabel')}</p>
                          <p className="font-medium">{med.dosage}</p>
                        </div>
                      )}
                      {med.route && (
                        <div>
                          <p className="text-xs text-muted-foreground">{t('rxExtra.routeLabel')}</p>
                          <p className="font-medium">{med.route}</p>
                        </div>
                      )}
                      {med.frequency && (
                        <div>
                          <p className="text-xs text-muted-foreground">{t('prescriptionDetailPage.medications.frequencyLabel')}</p>
                          <p className="font-medium">{med.frequency}</p>
                        </div>
                      )}
                      {med.duration && (
                        <div>
                          <p className="text-xs text-muted-foreground">{t('prescriptionDetailPage.medications.durationLabel')}</p>
                          <p className="font-medium">{med.duration}</p>
                        </div>
                      )}
                    </div>
                    {med.notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">{med.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {prescription.instructions && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                {t('prescriptionDetailPage.instructions.title')}
              </h3>
              <p className="text-foreground whitespace-pre-wrap">{prescription.instructions}</p>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {prescription.notes && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                {t('prescriptionDetailPage.notes.title')}
              </h3>
              <p className="text-foreground whitespace-pre-wrap">{prescription.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Signature */}
        <Card className="border-primary/20 mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                {t('prescriptionDetailPage.signature.signedOn')} {new Intl.DateTimeFormat(getIntlLocale(language), {
                  day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                }).format(prescription.signedAt)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Folio + verificación pública — misma combinación de color que las
            tarjetas "Indicaciones generales"/resto de campos (pedido cliente) */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('rxExtra.folioLabel')}</p>
                <p className="font-mono font-bold text-primary text-lg">{prescriptionFolio(prescription.id)}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('rxExtra.verifyHint')}</p>
              </div>
              <Button
                variant="outline"
                className="gap-2 flex-shrink-0"
                onClick={() => window.open(prescriptionVerifyUrl(prescription.id), '_blank')}
              >
                <FileText className="w-4 h-4" />
                {t('rxExtra.verifyButton')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
