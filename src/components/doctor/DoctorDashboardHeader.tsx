import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Radio, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { DoctorBadge, getDoctorBadgeType } from '@/components/doctor/DoctorBadge';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  userName?: string;
  isApproved: boolean;
  isPending: boolean;
  isRejected: boolean;
  totalConsultations?: number;
  rating?: number;
  badgeOverride?: string | null;
}

export function DoctorDashboardHeader({ userName, isApproved, isPending, isRejected, totalConsultations = 0, rating = 0, badgeOverride }: Props) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-2 sm:gap-3 mb-4 sm:mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-lg sm:text-2xl lg:text-3xl font-bold text-foreground truncate">
            {t('dashboard.title')}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm lg:text-base mt-0.5 truncate">
            {t('dashboard.welcome')}, {userName?.split(' ')[0]}
          </p>
        </div>
        {isApproved && (
          <Button
            onClick={() => navigate('/doctor/go-live')}
            className="gap-1.5 bg-red-600 hover:bg-red-700 h-8 sm:h-10 px-3 sm:px-5 text-xs sm:text-sm flex-shrink-0"
          >
            <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{t('dashboard.startLive')}</span>
            <span className="sm:hidden">Live</span>
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {isApproved && (
          <>
            <Badge variant="verified" className="gap-1 px-2 py-0.5 text-[10px] sm:text-xs">
              <CheckCircle className="w-3 h-3" />
              <span className="hidden sm:inline">{t('dashboard.verified')}</span>
              <span className="sm:hidden">✓</span>
            </Badge>
            <DoctorBadge type={getDoctorBadgeType(totalConsultations, rating, badgeOverride)} />
          </>
        )}
        {isPending && (
          <Badge variant="warning" className="gap-1 px-2 py-0.5 text-[10px] sm:text-xs">
            <Clock className="w-3 h-3" />
            {t('doctorStatus.pending')}
          </Badge>
        )}
        {isRejected && (
          <Badge variant="destructive" className="gap-1 px-2 py-0.5 text-[10px] sm:text-xs">
            <AlertTriangle className="w-3 h-3" />
            {t('doctorStatus.rejected')}
          </Badge>
        )}
      </div>
    </div>
  );
}
