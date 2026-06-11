import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { PrescriptionForm } from '@/components/prescriptions/PrescriptionForm';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function CreatePrescription() {
  const { user, role } = useAuth();
  const { language, t } = useLanguage();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  if (role !== 'doctor') {
    navigate('/lives');
    return null;
  }

  const patientId = params.get('patientId') || '';
  const patientName = params.get('patientName') || '';
  const consultationId = params.get('consultationId') || undefined;
  const sessionId = params.get('sessionId') || undefined;

  const handleCreated = async (prescriptionId?: string) => {
    // Send auto-message in chat if we have a session
    if (sessionId && user?.id && prescriptionId) {
      try {
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          sender_id: user.id,
          content: `📋 Se te ha generado tu receta médica. Haz clic aquí para verla: /prescriptions/${prescriptionId}`,
        });
        await supabase.from('chat_sessions').update({
          last_message: '📋 Se te ha generado tu receta médica',
          last_message_at: new Date().toISOString(),
        }).eq('id', sessionId);
      } catch (err) {
        console.error('Error sending prescription message:', err);
      }
    }
    if (sessionId) {
      navigate(`/chat?session=${sessionId}`);
    } else {
      navigate('/prescriptions');
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="back" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-heading text-xl font-bold">
            {t('autoI18n.createPresc1')}
          </h1>
        </div>
        <Card>
          <CardContent className="p-4">
            <PrescriptionForm
              patientId={patientId}
              patientName={patientName}
              consultationId={consultationId}
              onCreated={handleCreated}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
