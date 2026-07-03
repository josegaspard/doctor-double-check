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
import { ManualBadge } from '@/components/doctor/ManualBadge';
import {
  Plus,
  Star,
  Users,
  MapPin,
  MessageCircle,
  CheckCircle,
  Phone,
  RefreshCw,
} from 'lucide-react';

export default function EmergencyDoctors() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAvailableDoctors = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.rpc('get_doctors_paginated', {
      p_page: 1,
      p_page_size: 100,
      p_search: '',
      p_specialty: '',
      p_location: '',
    });
    if (!error && data) {
      const now = new Date();
      const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const available = data.filter((doc: any) =>
        doc.office_days?.includes(currentDay) &&
        doc.office_hours_start &&
        doc.office_hours_end &&
        currentTime >= doc.office_hours_start &&
        currentTime <= doc.office_hours_end
      );
      setDoctors(available);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchAvailableDoctors(); }, []);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchAvailableDoctors, 60_000);
    return () => clearInterval(interval);
  }, []);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Hero — brandbook ESTRICTO: solo Blue Lagoon, Uranus, Metallic Blue, Comfort Blue.
            Gradient primary→secondary; decoración Uranus; pill indicator en Comfort Blue. */}
        <div className="mb-6 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-xl border border-primary/30 overflow-hidden relative">
          {/* Blobs decorativos en Uranus (#AED3D9) y Comfort Blue (#839ED5) */}
          <div aria-hidden className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-light/25 blur-2xl" />
          <div aria-hidden className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-accent/30 blur-2xl" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-light/25 backdrop-blur-sm flex items-center justify-center border border-light/40">
                  <Plus className="w-7 h-7 text-primary-foreground" strokeWidth={3} />
                </div>
                {/* "Disponible ahora" dot en Comfort Blue (acento brand) */}
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent animate-pulse border-2 border-primary" />
              </div>
              <div>
                <h1 className="font-heading text-xl sm:text-2xl font-bold text-primary-foreground">
                  {t('emergency.title')}
                </h1>
                <p className="text-sm text-light">{t('emergency.subtitle')}</p>
              </div>
            </div>
            <p className="text-sm text-light/90 max-w-lg mb-4">
              {t('emergency.description')}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="bg-light/25 text-primary-foreground border-light/40 backdrop-blur-sm gap-1.5 hover:bg-light/35">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                {doctors.length} {t('emergency.availableCount')}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 bg-light/20 border-light/50 text-primary-foreground hover:bg-light hover:text-primary backdrop-blur-sm"
                onClick={fetchAvailableDoctors}
              >
                <RefreshCw className="w-3 h-3" />
                {t('emergency.refresh')}
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Phone className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-lg mb-2">{t('emergency.noAvailable')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('emergency.noAvailableHint')}</p>
              <Button variant="outline" onClick={() => navigate('/doctors')}>
                {t('emergency.browseAll')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((doctor: any) => (
              <Card
                key={doctor.id}
                className="group hover:shadow-lg transition-all cursor-pointer overflow-hidden ring-1 ring-accent/40 hover:ring-accent"
                onClick={() => navigate(`/doctor/${doctor.user_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-14 h-14 border-2 border-accent/40">
                        <AvatarImage src={doctor.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-base font-bold">
                          {getInitials(doctor.name || 'Dr')}
                        </AvatarFallback>
                      </Avatar>
                      {/* Indicador "disponible" en Comfort Blue (brand accent) */}
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent border-2 border-background animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{doctor.name}</h3>
                        {doctor.is_identity_verified && <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-primary/80 font-medium mb-1">{doctor.specialty}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <ManualBadge badge={doctor.manual_badge} size="sm" />
                        <DoctorBadge type={getDoctorBadgeType(doctor.total_consultations || 0, doctor.rating || 0, doctor.badge_override)} size="sm" />
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <PriceDisplay amount={doctor.consultation_fee} size="lg" />
                      <p className="text-[10px] text-muted-foreground -mt-0.5">{t('doctors.perConsult')}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {/* Estrellas en Comfort Blue (brand) en lugar de amarillo */}
                      <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                      <span className="font-medium text-foreground">{Number(doctor.rating).toFixed(1)}</span>
                    </span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{doctor.followers_count}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{doctor.total_consultations}</span>
                    {(doctor.location || doctor.country_flag) && (
                      <span className="flex items-center gap-1 ml-auto truncate max-w-[120px]">
                        {doctor.country_flag && <span className="flex-shrink-0">{doctor.country_flag}</span>}
                        <span className="truncate">{doctor.location || ''}</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-accent text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                      {t('doctors.availableNow')}
                    </div>
                    {/* CTA primario en Blue Lagoon (--primary) — color dominante brand */}
                    <Button size="sm" className="h-8 px-4 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                      {t('emergency.consultNow')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
