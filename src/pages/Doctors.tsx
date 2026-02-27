import React, { useState, useEffect } from 'react';
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
  const [selectedSpecialty, setSelectedSpecialty] = useState('Todas');
  const [followedDoctors, setFollowedDoctors] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const debouncedSearch = useDebounce(searchQuery, 300);

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

      const rows = (data || []) as DoctorRow[];
      setDoctors(rows);
      setTotalCount(rows.length > 0 ? Number(rows[0].total_count) : 0);
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
          Ver Perfil
        </Button>
        {/* Follow/Unfollow heart button */}
        <Button
          variant={isFollowing ? "secondary" : "outline"}
          size="icon"
          className="h-10 w-10 flex-shrink-0 active:scale-95 transition-transform"
          onClick={(e) => { e.stopPropagation(); handleFollow(doctor.user_id); }}
        >
          <Heart className={`w-4 h-4 ${isFollowing ? 'fill-current text-destructive' : ''}`} />
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
              <h3 className="font-semibold text-sm text-foreground mb-1">¿Cómo funciona?</h3>
              <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
                <p><Heart className="w-3 h-3 inline text-destructive mr-1" /><strong>Seguir</strong> — Gratis. Recibe notificaciones cuando el doctor transmita en vivo.</p>
                <p><Crown className="w-3 h-3 inline text-warning mr-1" /><strong>Suscripción Pro</strong> — Acceso a chat privado, contenido exclusivo y grabaciones.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">Explorar Doctores</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Encuentra y sigue a los mejores especialistas médicos</p>
        </div>

        {/* Filters */}
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

        <p className="text-sm text-muted-foreground mb-3 sm:mb-4">
          {totalCount} doctores encontrados
          {totalPages > 1 && ` — Página ${currentPage} de ${totalPages}`}
        </p>

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
              <h3 className="font-semibold text-lg mb-2">No se encontraron doctores</h3>
              <p className="text-muted-foreground">Intenta ajustar los filtros de búsqueda</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map(doctor => (
                <Card key={doctor.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <div className="cursor-pointer flex-shrink-0" onClick={() => navigate(`/doctor/${doctor.user_id}`)}>
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
                            className="font-semibold truncate group-hover:text-primary transition-colors cursor-pointer text-sm sm:text-base"
                            onClick={() => navigate(`/doctor/${doctor.user_id}`)}
                          >
                            {doctor.name || 'Doctor'}
                          </h3>
                          {doctor.is_identity_verified && (
                            <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                          )}
                        </div>
                        <DoctorBadge type={getDoctorBadgeType(doctor.total_consultations || 0, doctor.rating || 0, doctor.badge_override)} size="sm" />
                        <Badge variant="secondary" className="mb-1.5 sm:mb-2">
                          <Stethoscope className="w-3 h-3 mr-1" />
                          {doctor.specialty}
                        </Badge>
                        <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                            {Number(doctor.rating).toFixed(1)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {doctor.followers_count}
                          </span>
                          {doctor.location && !isMobile && (
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
                            <div className={`flex items-center gap-1.5 mt-1 text-xs ${isAvailable ? 'text-success' : 'text-muted-foreground'}`}>
                              <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'}`} />
                              {isAvailable ? 'Disponible ahora' : 'No disponible'}
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
      </div>
    </MainLayout>
  );
}
