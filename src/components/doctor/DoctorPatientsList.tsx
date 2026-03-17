import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, MessageCircle } from 'lucide-react';

interface PatientInfo {
  id: string;
  name: string;
  avatarUrl?: string;
  lastInteraction: string;
}

export function DoctorPatientsList() {
  const { supabaseUser } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseUser?.id) return;
    const fetchPatients = async () => {
      setLoading(true);
      try {
        // Get unique patients from chat_sessions where doctor is a participant
        const { data: sessions } = await supabase
          .from('chat_sessions')
          .select('participant1_id, participant1_type, participant2_id, participant2_type, last_message_at')
          .or(`participant1_id.eq.${supabaseUser.id},participant2_id.eq.${supabaseUser.id}`)
          .order('last_message_at', { ascending: false });

        if (!sessions) { setLoading(false); return; }

        const patientMap = new Map<string, string>();
        sessions.forEach(s => {
          let patientId: string | null = null;
          if (s.participant1_id === supabaseUser.id && s.participant2_type === 'patient') {
            patientId = s.participant2_id;
          } else if (s.participant2_id === supabaseUser.id && s.participant1_type === 'patient') {
            patientId = s.participant1_id;
          }
          if (patientId && !patientMap.has(patientId)) {
            patientMap.set(patientId, s.last_message_at || s.last_message_at || '');
          }
        });

        // Also check consultations
        const { data: consults } = await supabase
          .from('consultations')
          .select('patient_id, started_at')
          .eq('doctor_id', supabaseUser.id)
          .order('started_at', { ascending: false });

        consults?.forEach(c => {
          if (!patientMap.has(c.patient_id)) {
            patientMap.set(c.patient_id, c.started_at);
          }
        });

        if (patientMap.size === 0) { setPatients([]); setLoading(false); return; }

        const ids = Array.from(patientMap.keys());
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, name, avatar_url')
          .in('id', ids);

        const result: PatientInfo[] = (profiles || [])
          .filter(p => p.id)
          .map(p => ({
            id: p.id!,
            name: p.name || 'Paciente',
            avatarUrl: p.avatar_url || undefined,
            lastInteraction: patientMap.get(p.id!) || '',
          }))
          .sort((a, b) => (b.lastInteraction || '').localeCompare(a.lastInteraction || ''));

        setPatients(result);
      } catch (err) {
        console.error('Error fetching patients:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, [supabaseUser?.id]);

  if (loading) return null;
  if (patients.length === 0) return null;

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Mis Pacientes
          <span className="text-xs text-muted-foreground font-normal">({patients.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {patients.slice(0, 8).map(patient => (
            <div
              key={patient.id}
              className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer"
              onClick={() => navigate('/chat')}
            >
              <Avatar className="w-9 h-9">
                <AvatarImage src={patient.avatarUrl} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {getInitials(patient.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{patient.name}</p>
                {patient.lastInteraction && (
                  <p className="text-xs text-muted-foreground">
                    Último contacto: {formatDate(patient.lastInteraction)}
                  </p>
                )}
              </div>
              <MessageCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </div>
          ))}
        </div>
        {patients.length > 8 && (
          <Button variant="ghost" className="w-full mt-2 text-sm" onClick={() => navigate('/chat')}>
            Ver todos ({patients.length})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
