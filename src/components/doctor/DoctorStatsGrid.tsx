import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Radio, PlayCircle, Folder, Star, Users } from 'lucide-react';
import { ConsultationFeeEditor } from '@/components/doctor/ConsultationFeeEditor';
import { SubscribersModal } from '@/components/doctor/SubscribersModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  activeLivesCount: number;
  recordingsCount: number;
  vaultFilesCount: number;
  rating: number;
}

export function DoctorStatsGrid({ activeLivesCount, recordingsCount, vaultFilesCount, rating }: Props) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [subscriberCounts, setSubscriberCounts] = useState({ total: 0, paid: 0 });
  const [showSubscribersModal, setShowSubscribersModal] = useState(false);

  useEffect(() => {
    const fetchSubscriberCounts = async () => {
      if (!user?.id) return;
      const { data: allSubs } = await supabase
        .from('subscriptions')
        .select('id, tier')
        .eq('creator_id', user.id)
        .eq('is_active', true);
      
      if (allSubs) {
        setSubscriberCounts({
          total: allSubs.length,
          paid: allSubs.filter(s => s.tier === 'basic' || s.tier === 'premium').length,
        });
      }
    };
    fetchSubscriberCounts();
  }, [user?.id]);

  const stats = [
    { label: t('dashboard.activeLives'), value: activeLivesCount, icon: Radio, color: 'live' },
    { label: t('dashboard.totalRecordings'), value: recordingsCount, icon: PlayCircle, color: 'premium', onClick: () => navigate('/doctor/recordings') },
    { label: t('dashboard.vaultAccess'), value: vaultFilesCount, icon: Folder, color: 'primary', onClick: () => navigate('/doctor/vault') },
    { label: t('dashboard.rating'), value: rating, icon: Star, color: 'success', onClick: () => navigate('/doctor/profile#reviews') },
    { label: `Suscriptores (${subscriberCounts.paid} de pago)`, value: subscriberCounts.total, icon: Users, color: 'info', onClick: () => setShowSubscribersModal(true) },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:gap-6 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className={`hover:shadow-md transition-shadow ${stat.onClick ? 'cursor-pointer' : ''}`}
              onClick={stat.onClick}
            >
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-${stat.color}/10 flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 sm:w-7 sm:h-7 text-${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-3xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 sm:p-6">
            <ConsultationFeeEditor variant="card" />
          </CardContent>
        </Card>
      </div>

      {user?.id && (
        <SubscribersModal
          open={showSubscribersModal}
          onOpenChange={setShowSubscribersModal}
          doctorId={user.id}
        />
      )}
    </>
  );
}
