import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { exportPrescriptionToPDF } from '@/lib/generatePrescriptionPDF';
import { FileText, Download, Loader2, Pill } from 'lucide-react';

interface Prescription {
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
  signedAt: Date;
  createdAt: Date;
}

export function PrescriptionsList() {
  const { supabaseUser, role } = useAuth();
  const { language } = useLanguage();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!supabaseUser?.id) return;

      const query = supabase
        .from('prescriptions')
        .select('*')
        .order('created_at', { ascending: false });

      // Doctor sees their own, patient sees theirs
      if (role === 'doctor') {
        query.eq('doctor_id', supabaseUser.id);
      } else {
        query.eq('patient_id', supabaseUser.id);
      }

      const { data, error } = await query;
      if (!error && data) {
        setPrescriptions(data.map(p => ({
          id: p.id,
          patientName: p.patient_name,
          patientAge: p.patient_age || undefined,
          diagnosis: p.diagnosis || undefined,
          medications: (p.medications as any[]) || [],
          instructions: p.instructions || undefined,
          notes: p.notes || undefined,
          doctorName: p.doctor_name,
          doctorSpecialty: p.doctor_specialty,
          doctorLicense: p.doctor_license,
          doctorCedula: p.doctor_cedula || undefined,
          signedAt: new Date(p.signed_at),
          createdAt: new Date(p.created_at),
        })));
      }
      setIsLoading(false);
    };
    fetch();
  }, [supabaseUser?.id, role]);

  const handleDownload = (rx: Prescription) => {
    exportPrescriptionToPDF({
      id: rx.id,
      patientName: rx.patientName,
      patientAge: rx.patientAge,
      diagnosis: rx.diagnosis,
      medications: rx.medications,
      instructions: rx.instructions,
      notes: rx.notes,
      doctorName: rx.doctorName,
      doctorSpecialty: rx.doctorSpecialty,
      doctorLicense: rx.doctorLicense,
      doctorCedula: rx.doctorCedula,
      signedAt: rx.signedAt,
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (prescriptions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Pill className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">
            {language === 'es' ? 'No hay recetas' : 'No prescriptions'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {prescriptions.map(rx => (
        <Card key={rx.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {role === 'doctor' ? rx.patientName : rx.doctorName}
                  </p>
                  {rx.diagnosis && (
                    <p className="text-xs text-muted-foreground truncate">{rx.diagnosis}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {rx.medications.length} {language === 'es' ? 'medicamentos' : 'medications'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      }).format(rx.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1 flex-shrink-0" onClick={() => handleDownload(rx)}>
                <Download className="w-3 h-3" />
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
