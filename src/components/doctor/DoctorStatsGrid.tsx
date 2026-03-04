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
  recordingsCount: number;
  vaultFilesCount: number;
  rating: number;
}

export function DoctorStatsGrid({ recordingsCount, vaultFilesCount, rating }: Props) {
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
    { label: t('dashboard.totalRecordings'), value: recordingsCount, icon: PlayCircle, color: 'premium', onClick: () => navigate('/doctor/recordings') },
    { label: t('dashboard.vaultAccess'), value: vaultFilesCount, icon: Folder, color: 'primary', onClick: () => navigate('/doctor/vault') },
    { label: t('dashboard.rating'), value: rating, icon: Star, color: 'success', onClick: () => navigate(`/doctor/${user?.id}#reviews`) },
    { label: `Suscriptores (${subscriberCounts.paid} de pago)`, value: subscriberCounts.total, icon: Users, color: 'info', onClick: () => setShowSubscribersModal(true) },
  ];

  return (
    <>
      {/* Mobile: horizontal scroll, Desktop: grid */}
      <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-3 sm:gap-3 lg:grid-cols-6 lg:gap-4 sm:overflow-visible scrollbar-hide">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className={`min-w-[130px] snap-center flex-shrink-0 sm:min-w-0 sm:flex-shrink hover:shadow-md transition-shadow ${stat.onClick ? 'cursor-pointer' : ''}`}
              onClick={stat.onClick}
            >
              <CardContent className="p-3 sm:p-4 lg:p-5">
                <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-${stat.color}/10 flex items-center justify-center mb-2`}>
                  <Icon className={`w-4.5 h-4.5 sm:w-5 sm:h-5 text-${stat.color}`} />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-foreground leading-none">{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 leading-tight line-clamp-2">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}

        <Card className="min-w-[150px] snap-center flex-shrink-0 sm:min-w-0 sm:flex-shrink hover:shadow-md transition-shadow">
          <CardContent className="p-3 sm:p-4 lg:p-5">
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
