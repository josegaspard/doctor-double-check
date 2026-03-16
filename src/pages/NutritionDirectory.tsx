import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { PriceDisplay } from '@/components/currency/PriceDisplay';
import { DoctorBadge, getDoctorBadgeType } from '@/components/doctor/DoctorBadge';
import {
  Apple,
  Star,
  Users,
  MapPin,
  MessageCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';

export default function NutritionDirectory() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDoctors = async () => {
      const { data, error } = await supabase.rpc('get_doctors_paginated', {
        p_page: 1,
        p_page_size: 50,
        p_search: '',
        p_specialty: 'Nutriología',
        p_location: '',
      });
      if (!error) setDoctors(data || []);
      setIsLoading(false);
    };
    fetchDoctors();
  }, []);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const isDoctorAvailableNow = (doctor: any) => {
    const now = new Date();
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return !!(
      doctor.office_days?.includes(currentDay) &&
      doctor.office_hours_start &&
      doctor.office_hours_end &&
      currentTime >= doctor.office_hours_start &&
      currentTime <= doctor.office_hours_end
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Hero Section */}
        <div className="mb-6 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-teal-500/10 border border-emerald-200/30 dark:border-emerald-800/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Apple className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                {t('doctors.nutritionTitle')}
              </h1>
              <p className="text-sm text-muted-foreground">{t('doctors.nutritionSubtitle')}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground/80 max-w-lg">
            {t('doctors.nutritionHero')}
          </p>
          <div className="flex items-center gap-2 mt-4">
            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300/30">
              {doctors.length} {t('doctors.found')}
            </Badge>
          </div>
        </div>

        {/* Doctors Grid */}
        {isLoading ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Apple className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-lg mb-2">{t('doctors.noDoctors')}</h3>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((doctor: any) => {
              const isAvailable = isDoctorAvailableNow(doctor);
              return (
                <Card
                  key={doctor.id}
                  className={`group hover:shadow-md transition-all cursor-pointer overflow-hidden ${isAvailable ? 'ring-1 ring-emerald-400/25' : ''}`}
                  onClick={() => navigate(`/doctor/${doctor.user_id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-14 h-14 border-2 border-emerald-200/50">
                        <AvatarImage src={doctor.avatar_url || undefined} />
                        <AvatarFallback className="bg-emerald-500/10 text-emerald-600 text-base font-bold">
                          {getInitials(doctor.name || 'Dr')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="font-semibold text-sm truncate group-hover:text-emerald-600 transition-colors">{doctor.name}</h3>
                          {doctor.is_identity_verified && <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-emerald-600/80 font-medium mb-1">{doctor.specialty}</p>
                        <DoctorBadge type={getDoctorBadgeType(doctor.total_consultations || 0, doctor.rating || 0, doctor.badge_override)} size="sm" />
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <PriceDisplay amount={doctor.consultation_fee} size="lg" />
                        <p className="text-[10px] text-muted-foreground -mt-0.5">{t('doctors.perConsult')}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                        <span className="font-medium text-foreground">{Number(doctor.rating).toFixed(1)}</span>
                      </span>
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{doctor.followers_count}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{doctor.total_consultations}</span>
                    </div>

                    {doctor.bio && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{doctor.bio}</p>}

                    <div className="mt-3 pt-3 border-t flex items-center justify-between">
                      {isAvailable ? (
                        <div className="flex items-center gap-1.5 text-success text-xs font-medium">
                          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                          {t('doctors.availableNow')}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Clock className="w-3 h-3" />
                          {t('doctors.notAvailable')}
                        </div>
                      )}
                      <Button size="sm" className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                        {t('doctors.viewProfile')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}