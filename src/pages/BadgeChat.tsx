import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { BadgeChatPanel } from '@/components/chat/BadgeChatPanel';

/**
 * Ruta directa a la sala grupal exclusiva por distintivo (cliente 2026-06-29,
 * reestilizada 2026-07-02). El acceso normal es la pestaña "Doctores verificados"
 * dentro del Chat; esta ruta se mantiene para deeplinks. Toda la UI del chat vive
 * en BadgeChatPanel (agrupado por día, etiquetado por doctor). La RLS garantiza
 * que cada quien solo ve/escribe en su sala.
 */
export default function BadgeChat() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [badge, setBadge] = useState<'gold' | 'verified' | null | undefined>(undefined);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('doctor_profiles')
      .select('manual_badge')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setBadge(((data as any)?.manual_badge as 'gold' | 'verified' | null) ?? null));
  }, [user?.id]);

  if (badge === undefined) {
    return (
      <MainLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  // Sin distintivo → no tiene acceso a ninguna sala exclusiva
  if (badge !== 'gold' && badge !== 'verified') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 max-w-lg text-center">
          <p className="text-muted-foreground">{t('badgeChat.noAccess')}</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate('/chat')}>
            <ArrowLeft className="w-4 h-4" /> {t('badgeChat.backToChat')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 max-w-2xl flex flex-col h-[calc(100vh-8rem)]">
        <div className="mb-3">
          <Button variant="back" size="sm" className="gap-1.5" onClick={() => navigate('/chat')}>
            <ArrowLeft className="w-4 h-4" /> {t('badgeChat.backToChat')}
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <BadgeChatPanel badge={badge} />
        </div>
      </div>
    </MainLayout>
  );
}
