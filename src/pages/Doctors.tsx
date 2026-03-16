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
import { toast } from 'sonner';
import { PriceDisplay } from '@/components/currency/PriceDisplay';
import {
  Search,
  Star,
  Users,
  MapPin,
  Stethoscope,
  Heart,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Crown,
  MessageCircle,
  Clock,
  SlidersHorizontal,
  ChevronDown,
  AlertCircle,
  Zap,
  GraduationCap,
  Globe,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { DoctorBadge, getDoctorBadgeType } from '@/components/doctor/DoctorBadge';
import { useDebounce } from '@/hooks/use-debounce';
import { COUNTRY_CURRENCIES } from '@/hooks/useCurrency';

// Haversine distance in km
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  { value: 'Todas', labelKey: 'doctors.specAll' },
  { value: 'Cardiología', labelKey: 'doctors.specCardiology' },
  { value: 'Cirugía General', labelKey: 'doctors.specGeneralSurgery' },
  { value: 'Dermatología', labelKey: 'doctors.specDermatology' },
  { value: 'Endocrinología', labelKey: 'doctors.specEndocrinology' },
  { value: 'Gastroenterología', labelKey: 'doctors.specGastroenterology' },
  { value: 'Ginecología', labelKey: 'doctors.specGynecology' },
  { value: 'Medicina General', labelKey: 'doctors.specGeneralMedicine' },
  { value: 'Medicina Interna', labelKey: 'doctors.specInternalMedicine' },
  { value: 'Neurología', labelKey: 'doctors.specNeurology' },
  { value: 'Nutriología', labelKey: 'doctors.specNutriology' },
  { value: 'Oftalmología', labelKey: 'doctors.specOphthalmology' },
  { value: 'Oncología', labelKey: 'doctors.specOncology' },
  { value: 'Ortopedia', labelKey: 'doctors.specOrthopedics' },
  { value: 'Pediatría', labelKey: 'doctors.specPediatrics' },
  { value: 'Psiquiatría', labelKey: 'doctors.specPsychiatry' },
  { value: 'Urología', labelKey: 'doctors.specUrology' },
];

// Continent → Country mapping for geo filters
const CONTINENTS: Record<string, string[]> = {
  americas: ['MX', 'US', 'CA', 'CO', 'AR', 'CL', 'PE', 'BR', 'EC', 'UY', 'PY', 'BO', 'VE', 'CR', 'PA', 'GT', 'HN', 'SV', 'NI', 'DO', 'CU'],
  europe: ['ES', 'GB'],
  asia: [],
};

const DOCTORS_PER_PAGE = 20;

function isDoctorAvailableNow(doctor: DoctorRow) {
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
}

export default function Doctors() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const { getSubscription } = useSubscriptions();
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [minConsultations, setMinConsultations] = useState(0);
  const [selectedContinent, setSelectedContinent] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState('');
  const [universities, setUniversities] = useState<string[]>([]);
  const [, setTick] = useState(0);

  const fetchDoctorsStableRef = useRef<() => void>(() => {});
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch universities for filter
  useEffect(() => {
    const fetchUniversities = async () => {
      const { data } = await supabase
        .from('doctor_education')
        .select('institution')
        .eq('status', 'approved');
      if (data) {
        const unique = [...new Set(data.map(d => d.institution).filter(Boolean))].sort();
        setUniversities(unique);
      }
    };
    fetchUniversities();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('doctor-availability-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'doctor_profiles' }, (payload) => {
        const changed = payload.new as any;
        const old = payload.old as any;
        if (
          changed.office_hours_start !== old.office_hours_start ||
          changed.office_hours_end !== old.office_hours_end ||
          JSON.stringify(changed.office_days) !== JSON.stringify(old.office_days)
        ) {
          fetchDoctorsStableRef.current();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleNearbyToggle = () => {
    if (!nearbyMode && !userLocation) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setNearbyMode(true);
          },
          () => toast.error(t('doctors.locationError') || 'No se pudo obtener tu ubicación')
        );
      }
    } else {
      setNearbyMode(!nearbyMode);
    }
  };

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, selectedSpecialty, locationFilter]);
  useEffect(() => { fetchDoctors(); }, [currentPage, debouncedSearch, selectedSpecialty, locationFilter]);
  useEffect(() => { if (user?.id) fetchFollowedDoctors(); }, [user?.id]);

  const fetchDoctors = async () => {
    setIsLoading(true);
    try {
      const locationSearchMap: Record<string, string> = {
        'CDMX': 'Ciudad de M', 'Mérida': 'rida', 'Cancún': 'Canc', 'Querétaro': 'quer',
        'Monterrey': 'Monterrey', 'Puebla': 'Puebla', 'Guadalajara': 'Guadalajara', 'Tijuana': 'Tijuana',
      };
      const locationSearch = locationFilter ? (locationSearchMap[locationFilter] || locationFilter) : '';

      const { data, error } = await supabase.rpc('get_doctors_paginated', {
        p_page: currentPage,
        p_page_size: DOCTORS_PER_PAGE,
        p_search: debouncedSearch,
        p_specialty: selectedSpecialty === 'Todas' ? '' : selectedSpecialty,
        p_location: locationSearch,
      });
      if (error) throw error;

      let rows = (data || []) as DoctorRow[];
      if (nearbyMode && userLocation) {
        rows = rows.sort((a, b) => {
          const aCoords = a.location ? geocodeLocation(a.location) : null;
          const bCoords = b.location ? geocodeLocation(b.location) : null;
          if (!aCoords && !bCoords) return 0;
          if (!aCoords) return 1;
          if (!bCoords) return -1;
          return haversineDistance(userLocation.lat, userLocation.lng, aCoords.lat, aCoords.lng) -
                 haversineDistance(userLocation.lat, userLocation.lng, bCoords.lat, bCoords.lng);
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

  useEffect(() => { fetchDoctorsStableRef.current = fetchDoctors; });

  const fetchFollowedDoctors = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('followers').select('followed_id').eq('follower_id', user.id);
    if (data) setFollowedDoctors(new Set(data.map(f => f.followed_id)));
  };

  const handleFollow = async (doctorUserId: string) => {
    if (!user?.id) { toast.error(t('doctors.loginToFollow') || 'Debes iniciar sesión'); navigate('/login'); return; }
    try {
      if (followedDoctors.has(doctorUserId)) {
        await supabase.from('followers').delete().eq('follower_id', user.id).eq('followed_id', doctorUserId);
        setFollowedDoctors(prev => { const next = new Set(prev); next.delete(doctorUserId); return next; });
        toast.success(t('doctors.unfollowed') || 'Dejaste de seguir al doctor');
      } else {
        await supabase.from('followers').insert({ follower_id: user.id, followed_id: doctorUserId });
        setFollowedDoctors(prev => new Set([...prev, doctorUserId]));
        toast.success(t('doctors.followed') || 'Ahora sigues a este doctor');
      }
    } catch { toast.error('Error'); }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const totalPages = Math.ceil(totalCount / DOCTORS_PER_PAGE);

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground mb-1">{t('doctors.exploreTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('doctors.exploreSubtitle')}</p>
        </div>

        {/* Search bar */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={t('inputs.searchDoctors')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11" />
          </div>
          <Button
            variant={nearbyMode ? "default" : "outline"}
            size="icon"
            className="flex-shrink-0 h-11 w-11"
            title="Cerca de mí"
            onClick={handleNearbyToggle}
          >
            <MapPin className={`w-4 h-4 ${nearbyMode ? 'text-primary-foreground' : ''}`} />
          </Button>
        </div>

        {/* Specialty filter chips — clean, no emojis */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide snap-x mb-2">
          {SPECIALTIES.map(spec => (
            <button
              key={spec.value}
              onClick={() => setSelectedSpecialty(spec.value)}
              className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap ${
                selectedSpecialty === spec.value
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {t(spec.labelKey)}
            </button>
          ))}
        </div>

        {/* City filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide snap-x mb-2">
          {['CDMX', 'Guadalajara', 'Monterrey', 'Puebla', 'Mérida', 'Cancún', 'Querétaro', 'Tijuana'].map(city => (
            <button
              key={city}
              onClick={() => setLocationFilter(locationFilter === city ? '' : city)}
              className={`flex-shrink-0 snap-start flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                locationFilter === city
                  ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:border-accent/50'
              }`}
            >
              <MapPin className="w-3 h-3" />
              {city}
            </button>
          ))}
        </div>

        {/* Advanced Filters — Collapsible */}
        <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 px-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Más filtros
              <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
              {(minRating > 0 || selectedLevel || minConsultations > 0) && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                  {[minRating > 0 && '⭐', selectedLevel && '🏷', minConsultations > 0 && '📊'].filter(Boolean).length}
                </Badge>
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mb-3">
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/30 border">
              {/* Min Rating */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Rating mín.</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setMinRating(minRating === star ? 0 : star)}
                      className="p-0.5"
                    >
                      <Star className={`w-3.5 h-3.5 transition-colors ${
                        star <= minRating ? 'text-warning fill-warning' : 'text-muted-foreground/30'
                      }`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-px h-6 bg-border hidden sm:block" />

              {/* Level */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Nivel</span>
                <div className="flex gap-1">
                  {[
                    { value: 'new', label: 'Nuevo' },
                    { value: 'active', label: 'Activo' },
                    { value: 'elite', label: 'Elite' },
                  ].map(level => (
                    <button
                      key={level.value}
                      onClick={() => setSelectedLevel(selectedLevel === level.value ? '' : level.value)}
                      className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all border ${
                        selectedLevel === level.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-px h-6 bg-border hidden sm:block" />

              {/* Min consultations */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Consultas mín.</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={minConsultations || ''}
                  onChange={(e) => setMinConsultations(Number(e.target.value) || 0)}
                  className="h-7 w-16 text-xs"
                />
              </div>

              {/* Reset */}
              {(minRating > 0 || selectedLevel || minConsultations > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] px-2 text-muted-foreground"
                  onClick={() => { setMinRating(0); setSelectedLevel(''); setMinConsultations(0); }}
                >
                  Limpiar
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Results count */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <span>
            {totalCount} {t('doctors.found')}
            {totalPages > 1 && ` · ${t('doctors.page')} ${currentPage}/${totalPages}`}
          </span>
          {nearbyMode && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <MapPin className="w-3 h-3" />
              {t('doctors.nearMe') || 'Cerca de mí'}
            </Badge>
          )}
        </div>

        {/* Doctors Grid */}
        {isLoading ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-14 h-14 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-full" />
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
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.filter(d => {
                if (minRating > 0 && d.rating < minRating) return false;
                if (minConsultations > 0 && d.total_consultations < minConsultations) return false;
                if (selectedLevel) {
                  const badge = getDoctorBadgeType(d.total_consultations || 0, d.rating || 0, d.badge_override);
                  if (selectedLevel === 'new' && badge !== 'new') return false;
                  if (selectedLevel === 'active' && badge === 'new') return false; // active = not new
                  if (selectedLevel === 'elite' && badge !== 'pro') return false;
                }
                return true;
              }).map(doctor => {
                const isAvailable = isDoctorAvailableNow(doctor);
                const isFollowing = followedDoctors.has(doctor.user_id);
                const subscription = getSubscription(doctor.user_id);
                const isPaid = subscription?.tier === 'basic' || subscription?.tier === 'premium';

                return (
                  <Card
                    key={doctor.id}
                    className={`group hover:shadow-md transition-all cursor-pointer overflow-hidden ${
                      isAvailable ? 'ring-1 ring-success/25' : ''
                    }`}
                    onClick={() => navigate(`/doctor/${doctor.user_id}`)}
                  >
                    <CardContent className="p-0">
                      {/* Top section with subtle gradient */}
                      <div className="p-4 pb-3">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <Avatar className="w-14 h-14 border-2 border-background shadow-sm">
                              <AvatarImage src={doctor.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-base font-bold">
                                {getInitials(doctor.name || 'Dr')}
                              </AvatarFallback>
                            </Avatar>
                            {isAvailable && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-success border-2 border-background" />
                            )}
                          </div>

                          {/* Name + specialty + badge */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                                {doctor.name || 'Doctor'}
                              </h3>
                              {doctor.is_identity_verified && (
                                <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-primary/80 font-medium mb-1 truncate">
                              {doctor.specialty}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <DoctorBadge type={getDoctorBadgeType(doctor.total_consultations || 0, doctor.rating || 0, doctor.badge_override)} size="sm" />
                            </div>
                          </div>

                          {/* Fee */}
                          <div className="flex-shrink-0 text-right">
                            <span className="text-lg font-bold text-foreground">${doctor.consultation_fee}</span>
                            <p className="text-[10px] text-muted-foreground -mt-0.5">{t('doctors.perConsult') || 'consulta'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Stats bar */}
                      <div className="px-4 pb-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                          <span className="font-medium text-foreground">{Number(doctor.rating).toFixed(1)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {doctor.followers_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {doctor.total_consultations}
                        </span>
                        {doctor.location && (
                          <span className="flex items-center gap-1 ml-auto truncate max-w-[120px]">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{doctor.location}</span>
                          </span>
                        )}
                      </div>

                      {/* Bio */}
                      {doctor.bio && (
                        <div className="px-4 pb-3">
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{doctor.bio}</p>
                        </div>
                      )}

                      {/* Bottom: availability + actions */}
                      <div className="px-4 py-3 border-t bg-muted/20 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
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
                          {isPaid && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] gap-0.5 bg-warning/10 text-warning border-warning/20">
                              <Crown className="w-3 h-3" />
                              Pro
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-9 w-9 rounded-full ${
                              isFollowing
                                ? 'text-destructive hover:text-destructive/80'
                                : 'text-muted-foreground hover:text-destructive'
                            }`}
                            onClick={(e) => { e.stopPropagation(); handleFollow(doctor.user_id); }}
                          >
                            <Heart className={`w-4 h-4 ${isFollowing ? 'fill-current' : ''}`} />
                          </Button>
                          <Button
                            size="sm"
                            className="h-9 px-4 text-xs font-medium"
                            onClick={(e) => { e.stopPropagation(); navigate(`/doctor/${doctor.user_id}`); }}
                          >
                            {t('doctors.viewProfile')}
                          </Button>
                        </div>
                      </div>

                      {/* Nearby distance badge */}
                      {nearbyMode && userLocation && doctor.location && (() => {
                        const coords = geocodeLocation(doctor.location);
                        if (!coords) return null;
                        const dist = haversineDistance(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
                        return (
                          <div className="px-4 py-1.5 bg-primary/80 text-[11px] text-primary-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            ~{Math.round(dist)} km
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8 pb-4">
                <Button
                  variant="outline" size="sm"
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
                  variant="outline" size="sm"
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
