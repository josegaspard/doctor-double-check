import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { PrescriptionsList } from '@/components/prescriptions/PrescriptionsList';
import { ArrowLeft, FileText } from 'lucide-react';

export default function Prescriptions() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();

  if (role !== 'doctor' && role !== 'patient') {
    navigate('/lives');
    return null;
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                {language === 'es' ? 'Recetas Electrónicas' : 'Electronic Prescriptions'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {role === 'doctor'
                  ? (language === 'es' ? 'Crea y gestiona recetas para tus pacientes' : 'Create and manage prescriptions')
                  : (language === 'es' ? 'Tus recetas médicas' : 'Your medical prescriptions')}
              </p>
            </div>
          </div>
        </div>

        <PrescriptionsList />
      </div>
    </MainLayout>
  );
}
