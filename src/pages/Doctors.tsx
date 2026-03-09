import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Search,
  Star,
  Users,
  MapPin,
  Stethoscope,
  Heart,
  CheckCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Crown,
} from 'lucide-react';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { DoctorBadge, getDoctorBadgeType } from '@/components/doctor/DoctorBadge';
import { useDebounce } from '@/hooks/use-debounce';

// Haversine distance in km
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Known Mexican city coordinates for geocoding doctor locations
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'ciudad de mexico': { lat: 19.4326, lng: -99.1332 },
  'cdmx': { lat: 19.4326, lng: -99.1332 },
  'mexico city': { lat: 19.4326, lng: -99.1332 },
  'df': { lat: 19.4326, lng: -99.1332 },
  'guadalajara': { lat: 20.6597, lng: -103.3496 },
  'monterrey': { lat: 25.6866, lng: -100.3161 },
  'puebla': { lat: 19.0414, lng: -98.2063 },
  'tijuana': { lat: 32.5149, lng: -117.0382 },
  'leon': { lat: 21.1221, lng: -101.6847 },
  'zapopan': { lat: 20.7214, lng: -103.3891 },
  'merida': { lat: 20.9674, lng: -89.5926 },
  'cancun': { lat: 21.1619, lng: -86.8515 },
  'queretaro': { lat: 20.5888, lng: -100.3899 },
  'chihuahua': { lat: 28.6353, lng: -106.0889 },
  'morelia': { lat: 19.7060, lng: -101.1950 },
  'aguascalientes': { lat: 21.8853, lng: -102.2916 },
  'toluca': { lat: 19.2826, lng: -99.6557 },
  'hermosillo': { lat: 29.0729, lng: -110.9559 },
  'saltillo': { lat: 25.4232, lng: -100.9924 },
  'veracruz': { lat: 19.1738, lng: -96.1342 },
  'villahermosa': { lat: 17.9869, lng: -92.9303 },
  'tuxtla gutierrez': { lat: 16.7528, lng: -93.1152 },
  'oaxaca': { lat: 17.0732, lng: -96.7266 },
  'culiacan': { lat: 24.7994, lng: -107.3940 },
  'acapulco': { lat: 16.8531, lng: -99.8237 },
  'san luis potosi': { lat: 22.1565, lng: -100.9855 },
  'cuernavaca': { lat: 18.9242, lng: -99.2216 },
  'pachuca': { lat: 20.1011, lng: -98.7591 },
  'playa del carmen': { lat: 20.6296, lng: -87.0739 },
  'mazatlan': { lat: 23.2494, lng: -106.4111 },
  'jalisco': { lat: 20.6597, lng: -103.3496 },
  'nuevo leon': { lat: 25.6866, lng: -100.3161 },
  'estado de mexico': { lat: 19.4326, lng: -99.1332 },
};

function geocodeLocation(location: string): { lat: number; lng: number } | null {
  const lower = location.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    const normalizedCity = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(normalizedCity)) return coords;
  }
  return null;
}

interface DoctorRow {
  id: string;
  user_id: string;
  specialty: string;
  bio: string | null;
  rating: number;
  followers_count: number;
  consultation_fee: number;
  total_consultations: number;
  location: string | null;
  available_for_double_check: boolean;
  badge_override: string | null;
  office_hours_start: string | null;
  office_hours_end: string | null;
  office_days: string[] | null;
  name: string;
  avatar_url: string | null;
  is_identity_verified: boolean;
  total_count: number;
}

const SPECIALTIES = [
  'Todas',
  'Cardiología',
  'Dermatología',
  'Endocrinología',
  'Gastroenterología',
  'Ginecología',
  'Medicina General',
  'Medicina Interna',
  'Neurología',
  'Oftalmología',
  'Oncología',
  'Ortopedia',
  'Pediatría',
  'Psiquiatría',
  'Urología',
];

const DOCTORS_PER_PAGE = 20;

export default function Doctors() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const { isSubscribedTo, getSubscription } = useSubscriptions();
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('Todas');
  const [followedDoctors, setFollowedDoctors] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [, setTick] = useState(0); // Forces re-render for time-based availability

  const fetchDoctorsStableRef = useRef<() => void>(() => {});
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Re-evaluate availability every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Realtime subscription: refetch when doctors update office hours
  useEffect(() => {
    const channel = supabase
      .channel('doctor-availability-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'doctor_profiles',
        },
        (payload) => {
          const changed = payload.new as any;
          // Only refetch if availability-related fields changed
          const old = payload.old as any;
          if (
            changed.office_hours_start !== old.office_hours_start ||
            changed.office_hours_end !== old.office_hours_end ||
            JSON.stringify(changed.office_days) !== JSON.stringify(old.office_days)
          ) {
            fetchDoctorsStableRef.current();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleNearbyToggle = () => {
    if (!nearbyMode && !userLocation) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setNearbyMode(true);
          },
          () => {
            toast.error('No se pudo obtener tu ubicación. Habilita los permisos de ubicación.');
          }
        );
      } else {
        toast.error('Tu navegador no soporta geolocalización');
      }
    } else {
      setNearbyMode(!nearbyMode);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedSpecialty]);

  useEffect(() => {
    fetchDoctors();
  }, [currentPage, debouncedSearch, selectedSpecialty]);

  useEffect(() => {
    if (user?.id) fetchFollowedDoctors();
  }, [user?.id]);

  const fetchDoctors = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_doctors_paginated', {
        p_page: currentPage,
        p_page_size: DOCTORS_PER_PAGE,
        p_search: debouncedSearch,
        p_specialty: selectedSpecialty === 'Todas' ? '' : selectedSpecialty,
      });

      if (error) throw error;

      let rows = (data || []) as DoctorRow[];
      
      // When nearby mode is on, sort by real haversine distance
      if (nearbyMode && userLocation) {
        rows = rows.sort((a, b) => {
          const aCoords = a.location ? geocodeLocation(a.location) : null;
          const bCoords = b.location ? geocodeLocation(b.location) : null;
          if (!aCoords && !bCoords) return 0;
          if (!aCoords) return 1;
          if (!bCoords) return -1;
          const aDist = haversineDistance(userLocation.lat, userLocation.lng, aCoords.lat, aCoords.lng);
          const bDist = haversineDistance(userLocation.lat, userLocation.lng, bCoords.lat, bCoords.lng);
          return aDist - bDist;
        });
      }
      
      setDoctors(rows);
      setTotalCount(rows.length > 0 ? Number(rows[0].total_count) : 0);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast.error('Error al cargar doctores');
    } finally {
      setIsLoading(false);
    }
  };

  // Keep ref updated so realtime callback always calls latest fetchDoctors
  useEffect(() => {
    fetchDoctorsStableRef.current = fetchDoctors;
  });

  const fetchFollowedDoctors = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('followers')
      .select('followed_id')
      .eq('follower_id', user.id);
    if (data) {
      setFollowedDoctors(new Set(data.map(f => f.followed_id)));
    }
  };

  const handleFollow = async (doctorUserId: string) => {
    if (!user?.id) {
      toast.error('Debes iniciar sesión para seguir doctores');
      navigate('/login');
      return;
    }
    try {
      if (followedDoctors.has(doctorUserId)) {
        await supabase.from('followers').delete().eq('follower_id', user.id).eq('followed_id', doctorUserId);
        setFollowedDoctors(prev => { const next = new Set(prev); next.delete(doctorUserId); return next; });
        toast.success('Dejaste de seguir al doctor');
      } else {
        await supabase.from('followers').insert({ follower_id: user.id, followed_id: doctorUserId });
        setFollowedDoctors(prev => new Set([...prev, doctorUserId]));
        toast.success('Ahora sigues a este doctor');
      }
    } catch {
      toast.error('Error al actualizar seguimiento');
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const totalPages = Math.ceil(totalCount / DOCTORS_PER_PAGE);

  const renderCardFooter = (doctor: DoctorRow) => {
    const isFollowing = followedDoctors.has(doctor.user_id);
    const subscription = getSubscription(doctor.user_id);
    const isPaid = subscription?.tier === 'basic' || subscription?.tier === 'premium';

    return (
      <div className="flex gap-2 w-full">
        {/* Primary CTA: Always show Ver Perfil */}
        <Button
          variant="default"
          size="sm"
          className="flex-1 h-10 text-sm active:scale-95 transition-transform"
          onClick={(e) => { e.stopPropagation(); navigate(`/doctor/${doctor.user_id}`); }}
        >
          {t('doctors.viewProfile')}
        </Button>
        {/* Follow/Unfollow heart button */}
        <Button
          variant="outline"
          size="icon"
          className={`h-10 w-10 flex-shrink-0 active:scale-95 transition-all ${
            isFollowing 
              ? 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20' 
              : 'hover:bg-destructive/5 hover:text-destructive hover:border-destructive/20'
          }`}
          onClick={(e) => { e.stopPropagation(); handleFollow(doctor.user_id); }}
        >
          <Heart className={`w-4 h-4 ${isFollowing ? 'fill-current' : ''}`} />
        </Button>
        {/* Pro badge if subscribed */}
        {isPaid && (
          <Badge variant="secondary" className="h-10 px-2.5 flex items-center gap-1 bg-warning/10 text-warning border-warning/20">
            <Crown className="w-3.5 h-3.5" />
            Pro
          </Badge>
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Onboarding banner explaining follow vs subscribe */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-primary/5 to-info/5 border border-primary/15 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 hidden sm:flex">
              <Stethoscope className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground mb-1">{t('doctors.howItWorks')}</h3>
              <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
                <p><Heart className="w-3 h-3 inline text-destructive mr-1" /><strong>{t('doctors.follow')}</strong> — {t('doctors.followDescription')}</p>
                <p><Crown className="w-3 h-3 inline text-warning mr-1" /><strong>{t('doctors.proSubscription')}</strong> — {t('doctors.proDescription')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">{t('doctors.exploreTitle')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t('doctors.exploreSubtitle')}</p>
        </div>

        {/* Specialty filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x mb-3">
          {SPECIALTIES.map(spec => (
            <button
              key={spec}
              onClick={() => setSelectedSpecialty(spec)}
              className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-medium transition-colors border whitespace-nowrap ${
                selectedSpecialty === spec
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:border-primary/50'
              }`}
            >
              {spec}
            </button>
          ))}
        </div>

        {/* City filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x mb-3">
          {['CDMX', 'Guadalajara', 'Monterrey', 'Puebla', 'Mérida', 'Cancún', 'Querétaro', 'Tijuana'].map(city => (
            <button
              key={city}
              onClick={() => setSearchQuery(searchQuery === city ? '' : city)}
              className={`flex-shrink-0 snap-start flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                searchQuery === city
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-muted/50 text-muted-foreground border-border hover:border-accent/50'
              }`}
            >
              <MapPin className="w-3 h-3" />
              {city}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('inputs.searchDoctors')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={nearbyMode ? "default" : "outline"}
              size="icon"
              className="flex-shrink-0 h-10 w-10"
              title="Cerca de mí"
              onClick={handleNearbyToggle}
            >
              <MapPin className={`w-4 h-4 ${nearbyMode ? 'text-primary-foreground' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 sm:mb-4">
          <span>
            {totalCount} {t('doctors.found')}
            {totalPages > 1 && ` — ${t('doctors.page')} ${currentPage} ${t('doctors.of')} ${totalPages}`}
          </span>
          {nearbyMode && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <MapPin className="w-3 h-3" />
              Cerca de mí
            </Badge>
          )}
        </div>

        {/* Doctors Grid */}
        {isLoading ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">{t('doctors.noDoctors')}</h3>
              <p className="text-muted-foreground">{t('doctors.adjustFilters')}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map(doctor => (
                <Card key={doctor.id} className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => navigate(`/doctor/${doctor.user_id}`)}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <Avatar className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} border-2 border-background shadow-md`}>
                          <AvatarImage src={doctor.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                            {getInitials(doctor.name || 'Dr')}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3
                            className="font-semibold truncate group-hover:text-primary transition-colors text-sm sm:text-base"
                          >
                            {doctor.name || 'Doctor'}
                          </h3>
                          {doctor.is_identity_verified && (
                            <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5 sm:mb-2">
                          <DoctorBadge type={getDoctorBadgeType(doctor.total_consultations || 0, doctor.rating || 0, doctor.badge_override)} size="sm" />
                          <Badge variant="secondary">
                            <Stethoscope className="w-3 h-3 mr-1" />
                            {doctor.specialty}
                          </Badge>
                        </div>
                        {/* Stats row: rating + followers only */}
                        <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                            {Number(doctor.rating).toFixed(1)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {doctor.followers_count}
                          </span>
                        </div>
                        {/* Location row (separate, always visible) */}
                        {doctor.location && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{doctor.location}</span>
                            {nearbyMode && userLocation && (() => {
                              const coords = geocodeLocation(doctor.location!);
                              if (!coords) return null;
                              const dist = haversineDistance(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
                              return <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 flex-shrink-0">~{Math.round(dist)} km</Badge>;
                            })()}
                          </div>
                        )}
                        {/* Availability row */}
                        {(() => {
                          const now = new Date();
                          const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
                          const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                          const isAvailable = doctor.office_days?.includes(currentDay) &&
                            doctor.office_hours_start && doctor.office_hours_end &&
                            currentTime >= doctor.office_hours_start && currentTime <= doctor.office_hours_end;
                           return (
                            <div className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium ${isAvailable ? 'text-success' : 'text-muted-foreground'}`}>
                              <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'}`} />
                              {isAvailable ? t('doctors.availableNow') : t('doctors.notAvailable')}
                            </div>
                          );
                        })()}
                        {doctor.bio && !isMobile && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{doctor.bio}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      {renderCardFooter(doctor)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8 pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  <ChevronLeft className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t('common.previous')}</span>
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2)
                    .reduce<(number | string)[]>((acc, page, idx, arr) => {
                      if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(page);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">…</span>
                      ) : (
                        <Button
                          key={item}
                          variant={currentPage === item ? "default" : "outline"}
                          size="sm"
                          className="w-9 h-9 p-0"
                          onClick={() => { setCurrentPage(item as number); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        >
                          {item}
                        </Button>
                      )
                    )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  <span className="hidden sm:inline">{t('common.next')}</span>
                  <ChevronRight className="w-4 h-4 sm:ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
