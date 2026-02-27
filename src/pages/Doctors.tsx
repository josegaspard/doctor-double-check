import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
} from 'lucide-react';
import { SubscribeButton } from '@/components/subscriptions/SubscribeButton';
import { DoctorBadge, getDoctorBadgeType } from '@/components/doctor/DoctorBadge';

interface DoctorWithProfile {
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
  profile: {
    name: string;
    avatar_url: string | null;
    is_identity_verified: boolean;
  } | null;
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

export default function Doctors() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState<DoctorWithProfile[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<DoctorWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('Todas');
  const [followedDoctors, setFollowedDoctors] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const DOCTORS_PER_PAGE = 20;
  useEffect(() => {
    fetchDoctors();
    if (user?.id) {
      fetchFollowedDoctors();
    }
  }, [user?.id]);

  useEffect(() => {
    filterDoctors();
    setCurrentPage(1);
  }, [doctors, searchQuery, selectedSpecialty]);

  const fetchDoctors = async () => {
    try {
      // Use the public view which only exposes non-sensitive columns
      const { data, error } = await supabase
        .from('doctor_profiles_public')
        .select(`
          id,
          user_id,
          specialty,
          bio,
          rating,
          followers_count,
          consultation_fee,
          location,
          available_for_double_check,
          total_consultations,
          badge_override,
          office_hours_start,
          office_hours_end,
          office_days
        `)
        .order('rating', { ascending: false });

      if (error) throw error;

      // Fetch profiles from public view (no emails exposed)
      const userIds = data?.map(d => d.user_id).filter(Boolean) as string[] || [];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, name, avatar_url, is_identity_verified')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));
      
      const doctorsWithProfiles = data?.map(d => ({
        ...d,
        profile: profileMap.get(d.user_id) || null
      })) || [];

      setDoctors(doctorsWithProfiles);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast.error('Error al cargar doctores');
    } finally {
      setIsLoading(false);
    }
  };

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

  const filterDoctors = () => {
    let filtered = [...doctors];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.profile?.name?.toLowerCase().includes(query) ||
        d.specialty.toLowerCase().includes(query) ||
        d.bio?.toLowerCase().includes(query)
      );
    }

    if (selectedSpecialty !== 'Todas') {
      filtered = filtered.filter(d => d.specialty === selectedSpecialty);
    }

    setFilteredDoctors(filtered);
  };

  const handleFollow = async (doctorUserId: string) => {
    if (!user?.id) {
      toast.error('Debes iniciar sesión para seguir doctores');
      navigate('/login');
      return;
    }

    try {
      if (followedDoctors.has(doctorUserId)) {
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('followed_id', doctorUserId);
        
        setFollowedDoctors(prev => {
          const next = new Set(prev);
          next.delete(doctorUserId);
          return next;
        });
        toast.success('Dejaste de seguir al doctor');
      } else {
        await supabase
          .from('followers')
          .insert({ follower_id: user.id, followed_id: doctorUserId });
        
        setFollowedDoctors(prev => new Set([...prev, doctorUserId]));
        toast.success('Ahora sigues a este doctor');
      }
    } catch (error) {
      toast.error('Error al actualizar seguimiento');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
            Explorar Doctores
          </h1>
          <p className="text-muted-foreground">
            Encuentra y sigue a los mejores especialistas médicos
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('inputs.searchDoctors')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Especialidad" />
            </SelectTrigger>
            <SelectContent>
              {SPECIALTIES.map(spec => (
                <SelectItem key={spec} value={spec}>{spec}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results count & pagination info */}
        {(() => {
          const totalPages = Math.ceil(filteredDoctors.length / DOCTORS_PER_PAGE);
          const startIdx = (currentPage - 1) * DOCTORS_PER_PAGE;
          const endIdx = startIdx + DOCTORS_PER_PAGE;
          const paginatedDoctors = filteredDoctors.slice(startIdx, endIdx);
          
          return (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {filteredDoctors.length} doctores encontrados
                {totalPages > 1 && ` — Página ${currentPage} de ${totalPages}`}
              </p>

        {/* Doctors Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="w-16 h-16 rounded-full" />
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
        ) : filteredDoctors.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No se encontraron doctores</h3>
              <p className="text-muted-foreground">
                Intenta ajustar los filtros de búsqueda
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paginatedDoctors.map(doctor => (
                <Card 
                  key={doctor.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer group"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div 
                        className="cursor-pointer"
                        onClick={() => navigate(`/doctor/${doctor.user_id}`)}
                      >
                        <Avatar className="w-16 h-16 border-2 border-background shadow-md">
                          <AvatarImage src={doctor.profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                            {getInitials(doctor.profile?.name || 'Dr')}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 
                            className="font-semibold truncate group-hover:text-primary transition-colors cursor-pointer"
                            onClick={() => navigate(`/doctor/${doctor.user_id}`)}
                          >
                            {doctor.profile?.name || 'Doctor'}
                          </h3>
                          {doctor.profile?.is_identity_verified && (
                            <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                          )}
                        </div>
                        <DoctorBadge type={getDoctorBadgeType(doctor.total_consultations || 0, doctor.rating || 0, doctor.badge_override)} size="sm" />
                        <Badge variant="secondary" className="mb-2">
                          <Stethoscope className="w-3 h-3 mr-1" />
                          {doctor.specialty}
                        </Badge>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                            {doctor.rating.toFixed(1)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {doctor.followers_count}
                          </span>
                          {doctor.location && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3.5 h-3.5" />
                              {doctor.location}
                            </span>
                          )}
                        </div>
                        {(() => {
                          const now = new Date();
                          const currentDay = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][now.getDay()];
                          const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                          const isAvailable = doctor.office_days?.includes(currentDay) && 
                            doctor.office_hours_start && doctor.office_hours_end &&
                            currentTime >= doctor.office_hours_start && currentTime <= doctor.office_hours_end;
                          return (
                            <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${isAvailable ? 'text-success' : 'text-muted-foreground'}`}>
                              <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'}`} />
                              {isAvailable ? 'Disponible ahora' : 'No disponible'}
                            </div>
                          );
                        })()}
                        {doctor.bio && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {doctor.bio}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      <Button
                        variant={followedDoctors.has(doctor.user_id) ? "secondary" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollow(doctor.user_id);
                        }}
                      >
                        <Heart className={`w-4 h-4 mr-1 ${followedDoctors.has(doctor.user_id) ? 'fill-current' : ''}`} />
                        {followedDoctors.has(doctor.user_id) ? 'Siguiendo' : 'Seguir'}
                      </Button>
                      <SubscribeButton 
                        doctorId={doctor.user_id}
                        doctorName={doctor.profile?.name || 'Doctor'}
                        size="sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8 pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
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
                  Siguiente
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
            </>
          );
        })()}
      </div>
    </MainLayout>
  );
}
