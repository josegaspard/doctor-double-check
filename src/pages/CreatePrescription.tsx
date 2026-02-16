import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { PrescriptionForm } from '@/components/prescriptions/PrescriptionForm';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function CreatePrescription() {
  const { role } = useAuth();
  const { language } = useLanguage();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  if (role !== 'doctor') {
    navigate('/lives');
    return null;
  }

  const patientId = params.get('patientId') || '';
  const patientName = params.get('patientName') || '';
  const consultationId = params.get('consultationId') || undefined;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-heading text-xl font-bold">
            {language === 'es' ? 'Crear Receta' : 'Create Prescription'}
          </h1>
        </div>
        <Card>
          <CardContent className="p-4">
            <PrescriptionForm
              patientId={patientId}
              patientName={patientName}
              consultationId={consultationId}
              onCreated={() => navigate('/prescriptions')}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
