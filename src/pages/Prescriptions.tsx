import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PrescriptionsList } from '@/components/prescriptions/PrescriptionsList';
import { ArrowLeft, FileText, Plus, Search, User, Loader2 } from 'lucide-react';

interface PatientOption {
  id: string;
  name: string;
}

export default function Prescriptions() {
  const navigate = useNavigate();
  const { supabaseUser, role } = useAuth();
  const { language } = useLanguage();
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');

  if (role !== 'doctor' && role !== 'patient') {
    navigate('/lives');
    return null;
  }

  const fetchPatients = async () => {
    if (!supabaseUser?.id) return;
    setIsLoadingPatients(true);
    
    try {
      // Get patient IDs from consultations
      const { data: consultations } = await supabase
        .from('consultations')
        .select('patient_id')
        .eq('doctor_id', supabaseUser.id);

      // Get patient IDs from chat sessions
      const { data: chatSessions } = await supabase
        .from('chat_sessions')
        .select('participant1_id, participant1_type, participant2_id, participant2_type')
        .or(`participant1_id.eq.${supabaseUser.id},participant2_id.eq.${supabaseUser.id}`)
        .eq('status', 'active');

      const patientIds = new Set<string>();
      
      consultations?.forEach(c => {
        if (c.patient_id) patientIds.add(c.patient_id);
      });

      chatSessions?.forEach(cs => {
        if (cs.participant1_id === supabaseUser.id && cs.participant2_type === 'patient') {
          patientIds.add(cs.participant2_id);
        } else if (cs.participant2_id === supabaseUser.id && cs.participant1_type === 'patient') {
          patientIds.add(cs.participant1_id);
        }
      });

      if (patientIds.size === 0) {
        setPatients([]);
        setIsLoadingPatients(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, name')
        .in('id', Array.from(patientIds));

      setPatients(
        (profiles || [])
          .filter(p => p.id && p.name)
          .map(p => ({ id: p.id!, name: p.name! }))
      );
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const filteredPatients = patients.filter(p =>
    !patientSearch || p.name.toLowerCase().includes(patientSearch.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hidden sm:flex flex-shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="font-heading text-lg sm:text-2xl font-bold text-foreground truncate">
                  {language === 'es' ? 'Recetas Electrónicas' : 'Electronic Prescriptions'}
                </h1>
                <p className="text-muted-foreground text-xs sm:text-sm truncate">
                  {role === 'doctor'
                    ? (language === 'es' ? 'Crea y gestiona recetas para tus pacientes' : 'Create and manage prescriptions')
                    : (language === 'es' ? 'Tus recetas médicas' : 'Your medical prescriptions')}
                </p>
              </div>
            </div>
          </div>

          {role === 'doctor' && (
            <Button 
              className="gap-2 w-full sm:w-auto flex-shrink-0 h-12 text-base" 
              onClick={() => {
                setShowPatientPicker(true);
                fetchPatients();
              }}
            >
              <Plus className="w-5 h-5" />
              {language === 'es' ? 'Nueva Receta' : 'New Prescription'}
            </Button>
          )}
        </div>

        <PrescriptionsList />

        {/* Patient Picker Dialog */}
        <Dialog open={showPatientPicker} onOpenChange={setShowPatientPicker}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Seleccionar Paciente
              </DialogTitle>
              <DialogDescription>
                Elige el paciente para el que quieres crear la receta.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {isLoadingPatients ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPatients.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {filteredPatients.map(patient => (
                    <button
                      key={patient.id}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                      onClick={() => {
                        setShowPatientPicker(false);
                        navigate(`/prescriptions/new?patientId=${patient.id}&patientName=${encodeURIComponent(patient.name)}`);
                      }}
                    >
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="font-medium text-sm">{patient.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No se encontraron pacientes</p>
                  <p className="text-xs mt-1">Inicia una consulta o chat para que aparezcan aquí.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
