import React, { Suspense, useRef, useEffect, useState } from 'react';
import { AdBanner } from '@/components/ads/AdBanner';
import { Link } from 'react-router-dom';
import { useLives } from '@/contexts/LivesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UpcomingAvailabilities } from '@/components/availability/UpcomingAvailabilities';
import { NewsFeed } from '@/components/news/NewsFeed';
const LivePreviewPlayer = React.lazy(() => import('@/components/live/LivePreviewPlayer'));
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Video, 
  Users, 
  Clock, 
  Radio,
  Eye,
  Lock,
  Crown,
  Plus,
  LogIn,
} from 'lucide-react';

const LiveCard = React.forwardRef<HTMLDivElement, { live: any; isPremiumSub: boolean; isNew: boolean }>(function LiveCard({ live, isPremiumSub, isNew }, ref) {
  const { t } = useLanguage();

  const formatDuration = (startedAt: Date) => {
    const diff = Date.now() - startedAt.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <div ref={ref}>
    <Link to={`/live/${live.id}`}>
      <Card className="card-live group cursor-pointer overflow-hidden hover:shadow-lg transition-all relative ring-2 ring-live animate-pulse-ring">
        <div className="relative">
          <LivePreviewPlayer
            dailyRoomName={live.dailyRoomName || live.daily_room_name}
            thumbnailUrl={undefined}
          />
          
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <Badge variant="live" className="gap-1">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              {t('lives.liveBadge')}
            </Badge>
            {isPremiumSub && (
              <Badge className="gap-1 bg-yellow-500/90 text-white border-0 text-[10px]">
                <Crown className="w-3 h-3" />
                Premium
              </Badge>
            )}
          </div>
          
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="gap-1 bg-black/50 text-white border-0">
              <Users className="w-3 h-3" />
              {live.viewerCount}
            </Badge>
          </div>
          
          <div className="absolute bottom-2 right-2">
            <Badge variant="secondary" className="gap-1 bg-black/50 text-white border-0">
              <Clock className="w-3 h-3" />
              {formatDuration(live.startedAt)}
            </Badge>
          </div>
          
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/0 group-hover:bg-white/90 flex items-center justify-center transition-colors">
              <Video className="w-6 h-6 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
        
        <CardContent className="p-3 sm:p-4">
          <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors text-sm sm:text-base">
            {live.title}
          </h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-[10px] sm:text-xs font-semibold text-primary">
                {live.doctorName.charAt(0)}
              </span>
            </div>
            <span className="truncate text-xs sm:text-sm">{live.doctorName}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-2 sm:mt-3">
            <Badge variant="outline" className="text-xs">
              {live.specialty}
            </Badge>
            {isPremiumSub && (
              <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300 gap-1">
                <Crown className="w-3 h-3" />
                {t('lives.earlyAccess')}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
    </div>
  );
});

export default function LivesGrid() {
  const { lives, isLoading } = useLives();
  const { role, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { getSubscription } = useSubscriptions();
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const activeLives = lives.filter(l => l.status === 'live').slice(0, 20);

  // Extract unique specialties, tags, and cities from active lives
  const specialties = [...new Set(activeLives.map(l => l.specialty))];
  const allTags = [...new Set(activeLives.flatMap(l => l.tags || []))];
  const allCities = [...new Set(activeLives.map(l => (l as any).location).filter(Boolean))];

  // Filter lives
  const filteredLives = activeLives.filter(l => {
    if (selectedSpecialty && l.specialty !== selectedSpecialty) return false;
    if (selectedTag && !(l.tags || []).includes(selectedTag)) return false;
    if (selectedCity && (l as any).location !== selectedCity) return false;
    return true;
  });

  // Track known IDs to detect new ones for animation
  const knownIdsRef = useRef<Set<string>>(new Set());
  const newIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(activeLives.map(l => l.id));
    const freshIds = new Set<string>();
    currentIds.forEach(id => {
      if (!knownIdsRef.current.has(id)) freshIds.add(id);
    });
    newIdsRef.current = freshIds;
    knownIdsRef.current = currentIds;
  }, [activeLives]);

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Ad Banner */}
        <AdBanner placementName="lives_top_banner" className="mb-4" />

        {isAuthenticated && role !== 'visitor' && (
          <UpcomingAvailabilities />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-live animate-pulse" />
              {t('lives.title')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {filteredLives.length} de {activeLives.length} {t('lives.activeLives')}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {role === 'doctor' && (
              <Link to="/doctor/go-live">
                <Button className="gap-2 bg-live hover:bg-live/90 text-white">
                  <Plus className="w-4 h-4" />
                  {t('livePlayer.goLive')}
                </Button>
              </Link>
            )}
            {role === 'visitor' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-accent/50 rounded-lg px-3 sm:px-4 py-2">
                  <Eye className="w-4 h-4 text-accent-foreground" />
                  <span className="text-xs sm:text-sm text-accent-foreground">
                    {t('lives.viewerMode')}
                  </span>
                </div>
                <Link to="/login">
                  <Button size="sm" variant="outline" className="gap-2">
                    <LogIn className="w-4 h-4" />
                    {t('nav.login')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Filter Chips */}
        {(specialties.length > 1 || allTags.length > 0 || allCities.length > 0) && (
          <div className="space-y-2 mb-4">
            {/* Specialty chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
              <button
                onClick={() => setSelectedSpecialty(null)}
                className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  !selectedSpecialty
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:border-primary/50'
                }`}
              >
                Todas
              </button>
              {specialties.map(spec => (
                <button
                  key={spec}
                  onClick={() => setSelectedSpecialty(selectedSpecialty === spec ? null : spec)}
                  className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    selectedSpecialty === spec
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
            {/* Tag chips */}
            {allTags.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      selectedTag === tag
                        ? 'bg-accent text-accent-foreground border-accent'
                        : 'bg-muted/50 text-muted-foreground border-border hover:border-accent/50'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
            {/* City chips */}
            {allCities.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
                {allCities.map(city => (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(selectedCity === city ? null : city)}
                    className={`flex-shrink-0 snap-start flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      selectedCity === city
                        ? 'bg-info text-info-foreground border-info'
                        : 'bg-muted/50 text-muted-foreground border-border hover:border-info/50'
                    }`}
                  >
                    📍 {city}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-video bg-muted animate-pulse" />
                <CardContent className="p-3 sm:p-4 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredLives.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            <AnimatePresence mode="sync">
              {filteredLives.map((live) => {
                const sub = getSubscription(live.doctorId);
                const isPremiumSub = sub?.tier === 'premium';
                const isNew = newIdsRef.current.has(live.id);
                
                return (
                  <motion.div
                    key={live.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -20 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  >
                    <LiveCard live={live} isPremiumSub={isPremiumSub} isNew={isNew} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <Card className="p-8 sm:p-12 text-center">
            <Video className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
              {selectedSpecialty || selectedTag || selectedCity ? 'No hay lives con estos filtros' : t('lives.noLives')}
            </h3>
            <p className="text-muted-foreground text-sm">
              {selectedSpecialty || selectedTag || selectedCity
                ? 'Prueba quitando filtros para ver más transmisiones'
                : t('lives.noLivesDescription')}
            </p>
            {(selectedSpecialty || selectedTag || selectedCity) && (
              <Button variant="outline" className="mt-3" onClick={() => { setSelectedSpecialty(null); setSelectedTag(null); setSelectedCity(null); }}>
                Quitar filtros
              </Button>
            )}
          </Card>
        )}

        {role === 'visitor' && (
          <Card className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gradient-to-r from-primary/5 to-info/5 border-primary/20">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{t('lives.wantMore')}</h3>
                </div>
                <p className="text-muted-foreground text-sm">
                  {t('lives.registerPrompt')}
                </p>
              </div>
              <Link to="/login">
                <Button>{t('lives.createAccount')}</Button>
              </Link>
            </div>
          </Card>
        )}

        <NewsFeed />
      </div>
    </MainLayout>
  );
}
