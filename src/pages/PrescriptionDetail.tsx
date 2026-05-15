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
import { exportPrescriptionToPDF } from '@/lib/generatePrescriptionPDF';
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
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface PrescriptionDetail {
  id: string;
  patientName: string;
  patientAge?: string;
  diagnosis?: string;
  medications: any[];
  instructions?: string;
  notes?: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorLicense: string;
  doctorCedula?: string;
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
  const { language } = useLanguage();
  const [prescription, setPrescription] = useState<PrescriptionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fileSignedUrl, setFileSignedUrl] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  useEffect(() => {
    const fetchPrescription = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        setIsLoading(false);
        return;
      }

      setPrescription({
        id: data.id,
        patientName: data.patient_name,
        patientAge: data.patient_age || undefined,
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

      // Fetch doctor signature via security definer function (accessible to patients)
      const { data: sigUrl } = await supabase
        .rpc('get_doctor_signature', { p_doctor_user_id: data.doctor_id });
      if (sigUrl) {
        setPrescription(prev => prev ? { ...prev, doctorSignatureUrl: sigUrl } : prev);
      }

      // Get signed URL for the file
      if ((data as any).file_url) {
        setIsLoadingFile(true);
        const { data: signedData } = await supabase.storage
          .from('prescriptions')
          .createSignedUrl((data as any).file_url, 3600); // 1 hour
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
      diagnosis: prescription.diagnosis,
      medications: prescription.medications,
      instructions: prescription.instructions,
      notes: prescription.notes,
      doctorName: prescription.doctorName,
      doctorSpecialty: prescription.doctorSpecialty,
      doctorLicense: prescription.doctorLicense,
      doctorCedula: prescription.doctorCedula,
      doctorSignatureUrl: prescription.doctorSignatureUrl,
      signedAt: prescription.signedAt,
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
          <h2 className="text-xl font-semibold mb-2">Receta no encontrada</h2>
          <p className="text-muted-foreground mb-4">La receta que buscas no existe o no tienes acceso.</p>
          <Button onClick={() => navigate('/prescriptions')}>Ver mis recetas</Button>
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/prescriptions')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Receta Médica
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Intl.DateTimeFormat('es-MX', {
                day: 'numeric', month: 'long', year: 'numeric',
              }).format(prescription.createdAt)}
            </p>
          </div>
          {prescription.medications.length > 0 && (
            <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Descargar PDF</span>
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
                <p className="font-semibold text-secondary truncate">{prescription.doctorName}</p>
                <p className="text-sm text-primary font-medium">{prescription.doctorSpecialty}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-secondary/80">
                  <span>Lic: {prescription.doctorLicense}</span>
                  {prescription.doctorCedula && <span>Cédula: {prescription.doctorCedula}</span>}
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
                Diagnóstico
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
                Archivo adjunto
              </h3>
              
              {isLoadingFile ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : fileSignedUrl ? (
                <div>
                  {isImage ? (
                    <img 
                      src={fileSignedUrl} 
                      alt="Receta adjunta" 
                      className="rounded-lg border max-w-full max-h-[500px] object-contain mx-auto"
                    />
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <File className="w-8 h-8 text-primary" />
                        <div>
                          <p className="font-medium text-sm">Documento PDF</p>
                          <p className="text-xs text-muted-foreground">Haz clic para ver o descargar</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={fileSignedUrl} target="_blank" rel="noopener noreferrer" className="gap-1">
                          <ExternalLink className="w-3 h-3" />
                          Abrir
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No se pudo cargar el archivo.</p>
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
                Medicamentos ({prescription.medications.length})
              </h3>
              <div className="space-y-3">
                {prescription.medications.map((med: any, i: number) => (
                  <div key={i} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">#{i + 1}</Badge>
                      <p className="font-semibold text-foreground">{med.name}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm mt-2">
                      {med.dosage && (
                        <div>
                          <p className="text-xs text-muted-foreground">Dosis</p>
                          <p className="font-medium">{med.dosage}</p>
                        </div>
                      )}
                      {med.frequency && (
                        <div>
                          <p className="text-xs text-muted-foreground">Frecuencia</p>
                          <p className="font-medium">{med.frequency}</p>
                        </div>
                      )}
                      {med.duration && (
                        <div>
                          <p className="text-xs text-muted-foreground">Duración</p>
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
                Indicaciones generales
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
                Notas adicionales
              </h3>
              <p className="text-foreground whitespace-pre-wrap">{prescription.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Signature */}
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                Firmada el {new Intl.DateTimeFormat('es-MX', {
                  day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                }).format(prescription.signedAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
