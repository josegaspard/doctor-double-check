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
}

export function DoctorDashboardHeader({ userName, isApproved, isPending, isRejected, totalConsultations = 0, rating = 0 }: Props) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div>
        <h1 className="font-heading text-xl sm:text-3xl font-bold text-foreground">
          {t('dashboard.title')}
        </h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-lg truncate">
          {t('dashboard.welcome')}, {userName?.split(' ')[0]}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        {isApproved && (
          <>
            <Button
              onClick={() => navigate('/doctor/go-live')}
              className="gap-1.5 sm:gap-2 bg-red-600 hover:bg-red-700 h-9 sm:h-11 px-3 sm:px-6 text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <Radio className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden xs:inline">{t('dashboard.startLive')}</span>
              <span className="xs:hidden">Live</span>
            </Button>
            <Badge variant="verified" className="gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-sm">
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t('dashboard.verified')}</span>
              <span className="sm:hidden">✓</span>
            </Badge>
            <DoctorBadge type={getDoctorBadgeType(totalConsultations, rating)} />
          </>
        )}
        {isPending && (
          <Badge variant="warning" className="gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-sm">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            {t('doctorStatus.pending')}
          </Badge>
        )}
        {isRejected && (
          <Badge variant="destructive" className="gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-sm">
            <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" />
            {t('doctorStatus.rejected')}
          </Badge>
        )}
      </div>
    </div>
  );
}
