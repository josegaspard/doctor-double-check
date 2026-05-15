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
import { SearchableFilter } from '@/components/filters/SearchableFilter';
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
  Plus,
  GraduationCap,
  Globe,
  ArrowLeft,
  ArrowRight,
  UserPlus,
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
  country_code: string | null;
  country_flag: string | null;
}

import { SPECIALTIES_FILTER as SPECIALTIES } from '@/lib/specialties';

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
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const { getSubscription } = useSubscriptions();
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [dynamicCities, setDynamicCities] = useState<string[]>([]);
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
  const [universityDoctorIds, setUniversityDoctorIds] = useState<Set<string> | null>(null);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [hospitals, setHospitals] = useState<string[]>([]);
  const [hospitalDoctorIds, setHospitalDoctorIds] = useState<Set<string> | null>(null);
  const [, setTick] = useState(0);
  // Resident connection states
  const [residentConnections, setResidentConnections] = useState<Record<string, string>>({});
  const [connectingTo, setConnectingTo] = useState<string | null>(null);

  const fetchDoctorsStableRef = useRef<() => void>(() => {});
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch dynamic cities from doctor_profiles
  useEffect(() => {
    const fetchCities = async () => {
      const { data } = await supabase
        .from('doctor_profiles')
        .select('location')
        .eq('status', 'approved')
        .not('location', 'is', null);
      if (data) {
        const cities = [...new Set(
          data.map(d => d.location?.trim()).filter(Boolean) as string[]
        )].sort();
        setDynamicCities(cities);
      }
    };
    fetchCities();
  }, []);

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

  // When university filter changes, fetch matching doctor user_ids
  useEffect(() => {
    if (!selectedUniversity) {
      setUniversityDoctorIds(null);
      return;
    }
    const fetchUniDoctors = async () => {
      const { data } = await supabase
        .from('doctor_education')
        .select('doctor_id')
        .eq('status', 'approved')
        .eq('institution', selectedUniversity);
      if (data) {
        setUniversityDoctorIds(new Set(data.map(d => d.doctor_id)));
      }
    };
    fetchUniDoctors();
  }, [selectedUniversity]);

  // Fetch hospitals (from doctor_experience: current job orgs)
  useEffect(() => {
    const fetchHospitals = async () => {
      const { data } = await supabase
        .from('doctor_experience')
        .select('organization')
        .eq('status', 'approved')
        .eq('is_current', true);
      if (data) {
        const unique = [...new Set(data.map((d: any) => d.organization).filter(Boolean))].sort();
        setHospitals(unique as string[]);
      }
    };
    fetchHospitals();
  }, []);

  useEffect(() => {
    if (!selectedHospital) {
      setHospitalDoctorIds(null);
      return;
    }
    const fetchHospitalDoctors = async () => {
      const { data } = await supabase
        .from('doctor_experience')
        .select('doctor_id')
        .eq('status', 'approved')
        .eq('is_current', true)
        .eq('organization', selectedHospital);
      if (data) {
        setHospitalDoctorIds(new Set((data as any[]).map(d => d.doctor_id)));
      }
    };
    fetchHospitalDoctors();
  }, [selectedHospital]);

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
          () => toast.error(t('doctors.locationError'))
        );
      }
    } else {
      setNearbyMode(!nearbyMode);
    }
  };

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, selectedSpecialty, locationFilter]);
  useEffect(() => { fetchDoctors(); }, [currentPage, debouncedSearch, selectedSpecialty, locationFilter]);
  useEffect(() => { if (user?.id) fetchFollowedDoctors(); }, [user?.id]);

  // Fetch resident connections
  useEffect(() => {
    if (!user?.id || role !== 'resident') return;
    const fetchConnections = async () => {
      const { data } = await supabase
        .from('doctor_resident_connections')
        .select('doctor_id, status')
        .eq('resident_id', user.id);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((c: any) => { map[c.doctor_id] = c.status; });
        setResidentConnections(map);
      }
    };
    fetchConnections();
  }, [user?.id, role]);

  const handleRequestConnection = async (doctorUserId: string) => {
    if (!user?.id) return;
    setConnectingTo(doctorUserId);
    try {
      const { error } = await supabase
        .from('doctor_resident_connections')
        .insert({ doctor_id: doctorUserId, resident_id: user.id });
      if (error) throw error;
      setResidentConnections(prev => ({ ...prev, [doctorUserId]: 'pending' }));
      toast.success(t('residents.requestSent'));
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setConnectingTo(null);
    }
  };

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

  const specialtyOptions = SPECIALTIES.filter(s => s.value !== 'Todas').map(s => s.value);
  const cityOptions = dynamicCities.length > 0 ? dynamicCities : ['CDMX', 'Guadalajara', 'Monterrey', 'Puebla', 'Mérida', 'Cancún', 'Querétaro', 'Tijuana'];

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground mb-1">{t('doctors.exploreTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('doctors.exploreSubtitle')}</p>
        </div>

        <div className="md:grid md:grid-cols-[14rem_1fr] md:gap-6 md:items-start overflow-visible">
          {/* Desktop Sidebar (P6) */}
          {!isMobile && (
          <aside className="hidden md:block sticky top-24 self-start bg-card border border-border rounded-xl p-4 space-y-4">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {t('doctors.specAll') === 'All' ? 'Specialty' : 'Especialidad'}
                </h4>
                <SearchableFilter
                  options={specialtyOptions}
                  value={selectedSpecialty === 'Todas' ? '' : selectedSpecialty}
                  onChange={(val) => setSelectedSpecialty(val || 'Todas')}
                  placeholder="Especialidad"
                  searchPlaceholder="Buscar especialidad..."
                  icon={Stethoscope}
                  allLabel={t('doctors.specAll') === 'All' ? 'All' : 'Todas'}
                />
              </div>

              <div className="border-t border-border" />

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {t('doctors.specAll') === 'All' ? 'City' : 'Ciudad'}
                </h4>
                <SearchableFilter
                  options={cityOptions}
                  value={locationFilter}
                  onChange={setLocationFilter}
                  placeholder="Ciudad"
                  searchPlaceholder="Buscar ciudad..."
                  icon={MapPin}
                  allLabel={t('doctors.specAll') === 'All' ? 'All' : 'Todas'}
                />
              </div>
            </aside>
          )}

          {/* Main content */}
          <div className="min-w-0">
        {/* Search bar — bg sólido sobre app-bg teal, no transparent que se mezcla */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              placeholder={t('inputs.searchDoctors')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white dark:bg-card border-2 border-primary/30 shadow-md focus-visible:ring-primary/40 focus-visible:border-primary text-sm placeholder:text-muted-foreground"
            />
          </div>
          <Button
            variant={nearbyMode ? "default" : "outline"}
            size="icon"
            className={`flex-shrink-0 h-11 w-11 shadow-sm ${nearbyMode ? '' : 'bg-card hover:bg-muted'}`}
            title="Cerca de mí"
            onClick={handleNearbyToggle}
            aria-label="Cerca de mí"
          >
            <MapPin className={`w-4 h-4 ${nearbyMode ? 'text-primary-foreground' : ''}`} />
          </Button>
        </div>

        {/* Mobile: Searchable filter buttons */}
        <div className="flex gap-2 mb-3 md:hidden">
          <SearchableFilter
            options={specialtyOptions}
            value={selectedSpecialty === 'Todas' ? '' : selectedSpecialty}
            onChange={(val) => setSelectedSpecialty(val || 'Todas')}
            placeholder="Especialidad"
            searchPlaceholder="Buscar especialidad..."
            icon={Stethoscope}
            allLabel={t('doctors.specAll') === 'All' ? 'All' : 'Todas'}
          />
          <SearchableFilter
            options={cityOptions}
            value={locationFilter}
            onChange={setLocationFilter}
            placeholder="Ciudad"
            searchPlaceholder="Buscar ciudad..."
            icon={MapPin}
            allLabel={t('doctors.specAll') === 'All' ? 'All' : 'Todas'}
          />
        </div>

        {/* Advanced Filters — Collapsible */}
        <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 px-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t('doctors.moreFilters')}
              <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
              {(minRating > 0 || selectedLevel || minConsultations > 0 || selectedContinent || selectedCountry || selectedUniversity || selectedHospital) && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                  {[minRating > 0, selectedLevel, minConsultations > 0, selectedContinent, selectedCountry, selectedUniversity, selectedHospital].filter(Boolean).length}
                </Badge>
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mb-3">
            <div className="space-y-3 p-3 rounded-lg bg-white border-2 border-primary/30 shadow-sm">
              {/* Row 1: Rating, Level, Consultations */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Min Rating */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('doctors.minRating')}</span>
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
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('doctors.level')}</span>
                  <div className="flex gap-1">
                    {[
                      { value: 'new', label: t('doctors.levelNew') },
                      { value: 'active', label: t('doctors.levelActive') },
                      { value: 'elite', label: t('doctors.levelElite') },
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
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('doctors.minConsultations')}</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={minConsultations || ''}
                    onChange={(e) => setMinConsultations(Number(e.target.value) || 0)}
                    className="h-7 w-16 text-xs"
                  />
                </div>
              </div>

              {/* Row 2: Continent, Country, University */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Continent */}
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('doctors.continent')}</span>
                  <div className="flex gap-1">
                    {[
                      { value: '', label: t('doctors.allContinents') },
                      { value: 'americas', label: t('doctors.americas') },
                      { value: 'europe', label: t('doctors.europe') },
                    ].map(c => (
                      <button
                        key={c.value}
                        onClick={() => { setSelectedContinent(selectedContinent === c.value ? '' : c.value); setSelectedCountry(''); }}
                        className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all border ${
                          selectedContinent === c.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-px h-6 bg-border hidden sm:block" />

                {/* Country (filtered by continent) */}
                {selectedContinent && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('doctors.country')}</span>
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="h-7 text-xs rounded-md border bg-card px-2 py-1"
                    >
                      <option value="">{t('doctors.allCountries')}</option>
                      {(CONTINENTS[selectedContinent] || []).map(code => {
                        const info = COUNTRY_CURRENCIES[code];
                        return info ? (
                          <option key={code} value={code}>{info.flag} {info.name}</option>
                        ) : null;
                      })}
                    </select>
                  </div>
                )}

                <div className="w-px h-6 bg-border hidden sm:block" />

                {/* University */}
                {universities.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('doctors.university')}</span>
                    <select
                      value={selectedUniversity}
                      onChange={(e) => setSelectedUniversity(e.target.value)}
                      className="h-7 text-xs rounded-md border bg-card px-2 py-1 max-w-[180px]"
                    >
                      <option value="">{t('doctors.allUniversities')}</option>
                      {universities.map(uni => (
                        <option key={uni} value={uni}>{uni}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Hospital de práctica (PDF 1 Fase 2) */}
                {hospitals.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Hospital</span>
                    <select
                      value={selectedHospital}
                      onChange={(e) => setSelectedHospital(e.target.value)}
                      className="h-7 text-xs rounded-md border bg-card px-2 py-1 max-w-[180px]"
                    >
                      <option value="">Todos los hospitales</option>
                      {hospitals.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Reset */}
              {(minRating > 0 || selectedLevel || minConsultations > 0 || selectedContinent || selectedCountry || selectedUniversity || selectedHospital) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] px-2 text-muted-foreground"
                  onClick={() => { setMinRating(0); setSelectedLevel(''); setMinConsultations(0); setSelectedContinent(''); setSelectedCountry(''); setSelectedUniversity(''); setSelectedHospital(''); }}
                >
                  {t('doctors.clearFilters')}
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Emergency / Available Now Banner */}
        {!isLoading && (() => {
          const availableDoctors = doctors.filter(isDoctorAvailableNow);
          if (availableDoctors.length === 0) return null;
          return (
            <div className="mb-4 p-3 sm:p-4 rounded-xl bg-card shadow-md border border-primary/40 ring-1 ring-primary/10">
              {/* Mobile: stack vertical (icon+title, badges row below). Desktop: row inline */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 mb-3">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div className="relative w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md">
                    <Plus className="w-5 h-5 text-primary-foreground" strokeWidth={3} />
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-card animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-foreground leading-tight">{t('doctors.emergencyTitle')}</h3>
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">{t('doctors.emergencySubtitle')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                  <Badge className="text-[11px] gap-1.5 px-2.5 py-1 bg-primary/15 text-primary dark:bg-primary/25 dark:text-primary-foreground border border-primary/40 font-bold whitespace-nowrap">
                    <span className="relative flex w-2 h-2">
                      <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
                      <span className="relative w-2 h-2 rounded-full bg-primary" />
                    </span>
                    {availableDoctors.length}
                  </Badge>
                  <Button
                    size="sm"
                    className="h-9 px-3 text-xs gap-1.5 bg-secondary hover:bg-secondary/90 active:bg-secondary/80 text-secondary-foreground font-semibold shadow-md whitespace-nowrap"
                    onClick={(e) => { e.stopPropagation(); navigate('/emergency'); }}
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                    {t('emergency.title')}
                  </Button>
                </div>
              </div>
              <div className="relative group/avail">
                {/* Left arrow (desktop/tablet) */}
                <button
                  className="hidden md:flex absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card border border-border shadow-md items-center justify-center hover:bg-muted transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    const container = (e.currentTarget as HTMLElement).parentElement?.querySelector('[data-avail-scroll]');
                    container?.scrollBy({ left: -240, behavior: 'smooth' });
                  }}
                >
                  <ArrowLeft className="w-4 h-4 text-foreground" />
                </button>
                <div data-avail-scroll className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
                  {availableDoctors.slice(0, 10).map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => navigate(`/doctor/${doc.user_id}`)}
                      className="flex-shrink-0 snap-start flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-card border border-primary/20 hover:border-primary/50 transition-colors min-w-[210px] sm:min-w-[230px]"
                    >
                      <Avatar className="w-8 h-8 border border-primary/30">
                        <AvatarImage src={doc.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {getInitials(doc.name || 'Dr')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-medium truncate">{doc.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{doc.specialty}</p>
                      </div>
                      {/* Price hidden per client request */}
                    </button>
                  ))}
                </div>
                {/* Right arrow (desktop/tablet) */}
                <button
                  className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card border border-border shadow-md items-center justify-center hover:bg-muted transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    const container = (e.currentTarget as HTMLElement).parentElement?.querySelector('[data-avail-scroll]');
                    container?.scrollBy({ left: 240, behavior: 'smooth' });
                  }}
                >
                  <ArrowRight className="w-4 h-4 text-foreground" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* Results count */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <span>
            {totalCount} {t('doctors.found')}
            {totalPages > 1 && ` · ${t('doctors.page')} ${currentPage}/${totalPages}`}
          </span>
          {nearbyMode && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <MapPin className="w-3 h-3" />
              {t('doctors.nearMe')}
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
                  if (selectedLevel === 'active' && badge === 'new') return false;
                  if (selectedLevel === 'elite' && badge !== 'pro') return false;
                }
                // Continent/Country filter
                if (selectedContinent) {
                  const allowedCountries = CONTINENTS[selectedContinent] || [];
                  if (!d.country_code || !allowedCountries.includes(d.country_code)) return false;
                }
                if (selectedCountry) {
                  if (d.country_code !== selectedCountry) return false;
                }
                // University filter
                if (universityDoctorIds && !universityDoctorIds.has(d.user_id)) return false;
                // Hospital filter (PDF 1 Fase 2)
                if (hospitalDoctorIds && !hospitalDoctorIds.has(d.user_id)) return false;
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

                          {/* Name + specialty + badge — wrap-friendly para tablet/móvil */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mb-0.5 min-w-0">
                              <h3 className="font-semibold text-sm truncate min-w-0 max-w-full group-hover:text-primary transition-colors">
                                {doctor.name || 'Doctor'}
                              </h3>
                              {doctor.is_identity_verified && (
                                <CheckCircle
                                  className="w-3.5 h-3.5 text-success shrink-0"
                                  aria-label={t('doctors.identityVerified') || 'Identidad verificada'}
                                />
                              )}
                            </div>
                            <p className="text-xs text-primary/80 font-medium mb-1 line-clamp-1 sm:line-clamp-2">
                              {doctor.specialty}
                            </p>
                            <div className="flex flex-wrap items-center gap-1 max-w-full">
                              <DoctorBadge
                                type={getDoctorBadgeType(doctor.total_consultations || 0, doctor.rating || 0, doctor.badge_override)}
                                size="sm"
                              />
                            </div>
                          </div>

                          {/* Precio visible para todos los roles — toolitp aclara si el visor no puede comprar */}
                          {doctor.consultation_fee > 0 && (
                            <div
                              className="flex-shrink-0 text-right"
                              title={
                                role === 'patient' || role === 'resident'
                                  ? undefined
                                  : (t('doctors.priceTooltip') ||
                                      'Precio orientativo. Pacientes y residentes pueden iniciar consulta. Visitantes deben crear cuenta.')
                              }
                            >
                              <p className="text-[10px] text-muted-foreground leading-tight">
                                {t('doctors.from') || 'Desde'}
                              </p>
                              {role === 'resident' ? (
                                <div className="flex flex-col items-end">
                                  <PriceDisplay
                                    amount={doctor.consultation_fee}
                                    size="sm"
                                    className="text-[10px] text-muted-foreground line-through leading-none"
                                  />
                                  <PriceDisplay
                                    amount={doctor.consultation_fee * 0.5}
                                    size="sm"
                                    className="font-bold text-primary"
                                  />
                                </div>
                              ) : (
                                <PriceDisplay
                                  amount={doctor.consultation_fee}
                                  size="sm"
                                  className="font-bold text-primary"
                                />
                              )}
                            </div>
                          )}
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
                        {(doctor.location || doctor.country_flag) && (
                          <span className="flex items-center gap-1 ml-auto truncate max-w-[140px]">
                            {doctor.country_flag ? (
                              <span className="flex-shrink-0">{doctor.country_flag}</span>
                            ) : (
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                            )}
                            <span className="truncate">{doctor.location || ''}</span>
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
                          {role === 'resident' ? (
                            (() => {
                              const connStatus = residentConnections[doctor.user_id];
                              if (connStatus === 'accepted') {
                                return (
                                  <Badge variant="secondary" className="h-9 px-3 text-xs gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    {t('residents.connected')}
                                  </Badge>
                                );
                              }
                              if (connStatus === 'pending') {
                                return (
                                  <Badge variant="outline" className="h-9 px-3 text-xs gap-1">
                                    <Clock className="w-3 h-3" />
                                    {t('residents.pending')}
                                  </Badge>
                                );
                              }
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 px-3 text-xs font-medium gap-1"
                                  disabled={connectingTo === doctor.user_id}
                                  onClick={(e) => { e.stopPropagation(); handleRequestConnection(doctor.user_id); }}
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  {t('residents.requestConnection')}
                                </Button>
                              );
                            })()
                          ) : (
                            <Button
                              size="sm"
                              className="h-9 px-4 text-xs font-medium"
                              onClick={(e) => { e.stopPropagation(); navigate(`/doctor/${doctor.user_id}`); }}
                            >
                              {t('doctors.viewProfile')}
                            </Button>
                          )}
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
        </div>
      </div>
    </MainLayout>
  );
}
