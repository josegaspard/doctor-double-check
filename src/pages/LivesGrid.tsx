import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { DoctorAvailability } from '@/hooks/useDoctorAvailability';
import { AdBanner } from '@/components/ads/AdBanner';
import { AdInterstitial } from '@/components/ads/AdInterstitial';
import { useLives } from '@/contexts/LivesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { useDoctorAvailability } from '@/hooks/useDoctorAvailability';
import MainLayout from '@/components/layout/MainLayout';
import { NewsFeed } from '@/components/news/NewsFeed';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Video,
  Radio,
  Eye,
  Lock,
  Crown,
  Plus,
  LogIn,
  AlertCircle,
  RefreshCw,
  Globe,
  GraduationCap,
  Building2,
  SlidersHorizontal,
  Search,
  ArrowRight,
  Compass,
  CalendarDays,
  X,
  Clock,
  User,
  Bell,
  MessageSquare,
} from 'lucide-react';
import { SearchableFilter } from '@/components/filters/SearchableFilter';
import { useDoctorFilterFields } from '@/hooks/useDoctorFilterFields';
import { CredentialStatusBadge } from '@/components/doctor/CredentialStatusBadge';
import { LivesDebugPanel } from '@/components/live/LivesDebugPanel';
import { useUserInterests, interestScore } from '@/hooks/useUserInterests';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';
import { ProfileCategoryMark, AuthorRoleTag } from '@/components/profile/ProfileCategoryMark';
import { useProfileCategories } from '@/hooks/useProfileCategory';
import { ContentRating } from '@/components/ratings/ContentRating';
import { fill, initialsOf, norm, whenLabel, tzShort } from '@/lib/proFormat';

const LivePreviewPlayer = React.lazy(() => import('@/components/live/LivePreviewPlayer'));

// Tiempo que lleva un live emitiendo (mismo formato que la parrilla anterior)
const formatDuration = (startedAt?: Date) => {
  if (!startedAt) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

// ---------------------------------------------------------------------------
// Diseño PRO de Lives (cliente, 7-sep-2026). DOS vistas de la misma página:
//   · /lives                 → PARRILLA ("la inicial de la app"): buscador arriba
//                              y todos los lives en rejilla.
//   · /lives?vista=directo   → PORTADA (al pulsar la pestaña Lives): live
//                              destacado + "También en directo" + carrusel.
// Cada vista lleva el botón que abre la otra: en la parrilla «Explorar todo»,
// en la portada «Ver todos los Lives» (y «Ver los N Lives» / «Ver todos»).
// ---------------------------------------------------------------------------

function LiveMedia({ live }: { live: any }) {
  return (
    <div className="pro-live-fill">
      <Suspense fallback={<div className="w-full h-full bg-[#0f3d4a] animate-pulse" />}>
        <LivePreviewPlayer
          dailyRoomName={live.dailyRoomName || live.daily_room_name}
          thumbnailUrl={live.thumbnailUrl || null}
        />
      </Suspense>
    </div>
  );
}

function DoctorAvatar({ live, className }: { live: any; className?: string }) {
  return (
    <span className={`pro-initials ${className || ''}`}>
      {live.doctorAvatar ? <img src={live.doctorAvatar} alt="" /> : initialsOf(live.doctorName)}
    </span>
  );
}

function CredentialRow({ live }: { live: any }) {
  const parts: string[] = [];
  if (live.doctorCedulaStatus === 'rejected' && live.doctorCedulaRejectionReason) parts.push(`Cédula: ${live.doctorCedulaRejectionReason}`);
  if (live.doctorCofeprisStatus === 'rejected' && live.doctorCofeprisRejectionReason) parts.push(`COFEPRIS: ${live.doctorCofeprisRejectionReason}`);
  if (parts.length === 0 && (live.doctorCedulaStatus === 'rejected' || live.doctorCofeprisStatus === 'rejected')) {
    parts.push('Credencial rechazada (sin motivo registrado)');
  }
  return (
    <>
      {/* Credenciales verificadas con estado — SIEMPRE visibles (cumplimiento). */}
      <div className="flex flex-wrap gap-1 mt-2">
        <CredentialStatusBadge type="cedula" status={live.doctorCedulaStatus} value={live.doctorCedula} rejectionReason={live.doctorCedulaRejectionReason} size="xs" />
        <CredentialStatusBadge type="cofepris" status={live.doctorCofeprisStatus} value={live.doctorCofepris} rejectionReason={live.doctorCofeprisRejectionReason} size="xs" />
      </div>
      {parts.length > 0 && (
        <p className="text-[10px] text-red-200 mt-1 line-clamp-2 flex items-start gap-1">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{parts.join(' · ')}</span>
        </p>
      )}
    </>
  );
}

function LiveCardPro({ live, isPremiumSub, t }: { live: any; isPremiumSub: boolean; t: (k: string) => string }) {
  return (
    <div className="pro-live-card is-live h-full">
      <Link to={`/live/${live.id}`} className="pro-live-media block" aria-label={live.title}>
        <LiveMedia live={live} />
        <div className="pro-live-shade" />
        <span className="pro-live-badge"><Radio /> {t('lives.liveBadge')}</span>
        {isPremiumSub && <span className="pro-live-badge !left-auto !right-[92px] !bg-[#b7791f]"><Crown /> {t('pro.lives.premium')}</span>}
        <span className="pro-live-views"><Eye /> {fill(t('pro.lives.watching'), { n: (live.viewerCount ?? 0).toLocaleString() })}</span>
        {live.startedAt && <span className="pro-live-dur" title={fill(t('pro.lives.startedAgo'), { t: formatDuration(live.startedAt) })}><Clock /> {formatDuration(live.startedAt)}</span>}
        <span className="pro-play" aria-hidden="true"><Video /></span>
        <div className="pro-live-title">{live.title}</div>
      </Link>
      <div className="pro-live-body">
        <div className="pro-live-doc">
          <DoctorAvatar live={live} />
          <span className="min-w-0 flex items-center gap-1 flex-1">
            <b>{live.doctorName}</b>
            <DoctorBadgeIcon userId={live.doctorId} size="sm" className="flex-shrink-0" />
            <ProfileCategoryMark userId={live.doctorId} size="sm" className="flex-shrink-0" />
            <AuthorRoleTag userId={live.doctorId} className="flex-shrink-0" />
          </span>
          <span className="spec hidden min-[400px]:inline">{live.specialty}</span>
        </div>
        <div className="pro-live-meta">
          <span className="min-[400px]:hidden">{live.specialty}</span>
          <span className="min-[400px]:hidden sep">|</span>
          <span>{t('pro.lives.freeAccess')}</span>
          {isPremiumSub && (
            <>
              <span className="sep">|</span>
              <span className="inline-flex items-center gap-1"><Crown className="w-3 h-3" /> {t('lives.earlyAccess')}</span>
            </>
          )}
        </div>
        {live.location && <div className="pro-live-loc">📍 {live.location}</div>}
        <ContentRating targetType="live" targetId={live.id} ownerId={live.doctorId} compact className="mt-1.5" />
        <CredentialRow live={live} />
      </div>
    </div>
  );
}

function SideLiveItem({ live, t }: { live: any; t: (k: string) => string }) {
  return (
    <Link to={`/live/${live.id}`} className="pro-side-item">
      <div className="pro-side-thumb">
        <LiveMedia live={live} />
        <span className="pro-live-badge"><Radio /> {t('lives.liveBadge')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <span className="pro-side-views"><Eye /> {fill(t('pro.lives.watching'), { n: (live.viewerCount ?? 0).toLocaleString() })}</span>
        <div className="pro-side-title">{live.title}</div>
        <div className="pro-side-sub">
          <DoctorAvatar live={live} className="w-5 h-5 text-[9px]" />
          <span className="truncate font-semibold text-white">{live.doctorName}</span>
          <DoctorBadgeIcon userId={live.doctorId} size="sm" className="flex-shrink-0" />
          <span className="truncate">{live.specialty}</span>
        </div>
        <div className="pro-side-sub"><span>{t('pro.lives.freeAccess')}</span></div>
      </div>
    </Link>
  );
}

export default function LivesGrid() {
  const { lives, isLoading, refreshLives, credentialsLoadError, credentialsRetrying, retryCredentials } = useLives();
  const { data: interests = [] } = useUserInterests();
  const { role } = useAuth();
  const { t, language } = useLanguage();
  const { getSubscription, subscriptions } = useSubscriptions();
  const { toggles } = useSiteToggles();
  const { availabilities, isLoading: upcomingLoading } = useDoctorAvailability();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedUpcoming, setSelectedUpcoming] = useState<DoctorAvailability | null>(null);
  const dateLocale = language === 'es' ? esLocale : enUS;

  const view: 'featured' | 'grid' = searchParams.get('vista') === 'directo' ? 'featured' : 'grid';
  const setView = (v: 'featured' | 'grid') => {
    const next = new URLSearchParams(searchParams);
    if (v === 'featured') next.set('vista', 'directo'); else next.delete('vista');
    setSearchParams(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [query, setQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [authorFilter, setAuthorFilter] = useState<'all' | 'doctor' | 'resident'>('all');
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  useEffect(() => {
    refreshLives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeLives = lives.filter(l => l.status === 'live').slice(0, 20);
  const allTags = [...new Set(activeLives.flatMap(l => l.tags || []))];
  const allCities = [...new Set(activeLives.map(l => (l as any).location).filter(Boolean))] as string[];
  const doctorFields = useDoctorFilterFields(activeLives.map(l => l.doctorId));
  const authorCats = useProfileCategories(activeLives.map(l => l.doctorId));
  const residentLiveCount = activeLives.filter(l => authorCats[l.doctorId]?.authorRole === 'resident').length;
  const doctorLiveCount = activeLives.filter(l => authorCats[l.doctorId]?.authorRole === 'doctor').length;
  const showAuthorTabs = residentLiveCount > 0 && doctorLiveCount > 0;

  const liveSpecialties = [...new Set(activeLives.map(l => l.specialty).filter(Boolean))].sort() as string[];
  const liveCountries = [...new Set(activeLives.map(l => doctorFields[l.doctorId]?.country).filter(Boolean))].sort() as string[];
  const liveUniversities = [...new Set(activeLives.map(l => doctorFields[l.doctorId]?.university).filter(Boolean))].sort() as string[];
  const liveHospitals = [...new Set(activeLives.map(l => doctorFields[l.doctorId]?.practiceHospital).filter(Boolean))].sort() as string[];
  const advancedFilterActive = !!(selectedTag || selectedCity || selectedCountry || selectedUniversity || selectedHospital);
  const anyFilterActive = !!(query || selectedSpecialty || advancedFilterActive || authorFilter !== 'all');
  const hasAdvancedOptions = liveCountries.length > 0 || liveUniversities.length > 0 || liveHospitals.length > 0 || allTags.length > 0 || allCities.length > 0;

  const clearAllFilters = () => {
    setQuery('');
    setSelectedSpecialty(null); setSelectedTag(null); setSelectedCity(null);
    setSelectedCountry(''); setSelectedUniversity(''); setSelectedHospital('');
    setAuthorFilter('all');
  };

  const filteredLives = useMemo(() => {
    const q = norm(query.trim());
    const list = activeLives.filter(l => {
      if (selectedSpecialty && l.specialty !== selectedSpecialty) return false;
      if (selectedTag && !(l.tags || []).includes(selectedTag)) return false;
      if (selectedCity && (l as any).location !== selectedCity) return false;
      if (selectedCountry && doctorFields[l.doctorId]?.country !== selectedCountry) return false;
      if (selectedUniversity && doctorFields[l.doctorId]?.university !== selectedUniversity) return false;
      if (selectedHospital && doctorFields[l.doctorId]?.practiceHospital !== selectedHospital) return false;
      if (authorFilter !== 'all' && authorCats[l.doctorId]?.authorRole !== authorFilter) return false;
      if (q) {
        const hay = norm(`${l.title} ${l.doctorName} ${l.specialty} ${(l.tags || []).join(' ')} ${(l as any).location || ''}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (!anyFilterActive && interests.length) {
      list.sort((a, b) => interestScore(`${b.title} ${b.specialty}`, interests) - interestScore(`${a.title} ${a.specialty}`, interests));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLives, query, selectedSpecialty, selectedTag, selectedCity, selectedCountry, selectedUniversity, selectedHospital, authorFilter, doctorFields, authorCats, interests]);

  const broadcastingDoctors = new Set(activeLives.map(l => l.doctorId)).size;
  // «Próximamente» — misma lógica que el bloque anterior de próximos eventos:
  // si el usuario sigue a médicos, primero lo de ellos (hasta 10); si no, lo de todos.
  // Incluye lives, consultas y horarios programados (no sólo lives), como antes.
  const premiumDoctorIds = useMemo(() => new Set(subscriptions.filter(s => s.tier === 'premium').map(s => s.creatorId)), [subscriptions]);
  const subscribedDoctorIds = useMemo(() => new Set(subscriptions.map(s => s.creatorId)), [subscriptions]);
  const { upcomingLives, upcomingFromFollowed } = useMemo(() => {
    const nowMs = Date.now();
    const future = availabilities
      .filter(a => a.scheduledAt.getTime() > nowMs && a.type !== 'blocked')
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    const followed = future.filter(a => subscribedDoctorIds.has(a.doctorId));
    return followed.length > 0
      ? { upcomingLives: followed, upcomingFromFollowed: true }
      : { upcomingLives: future, upcomingFromFollowed: false };
  }, [availabilities, subscribedDoctorIds]);
  const tz = tzShort(language);
  const upcomingTypeLabel = (a: DoctorAvailability) =>
    a.type === 'live' ? t('pro.lives.typeLive') : a.type === 'consultation' ? t('pro.lives.typeConsultation') : t('pro.lives.typeSchedule');
  const UpcomingIcon = ({ type }: { type: string }) => (type === 'live' ? <Video className="w-5 h-5" /> : type === 'consultation' ? <MessageSquare className="w-5 h-5" /> : <Clock className="w-5 h-5" />);

  const canGoLive =
    (role === 'doctor' && toggles.enable_lives_doctors !== false) ||
    (role === 'resident' && toggles.enable_lives_residents === true);

  const featured = filteredLives[0];
  const others = filteredLives.slice(1);

  const broadcastingText =
    activeLives.length === 0
      ? t('pro.lives.noneBroadcasting')
      : broadcastingDoctors === 1
        ? t('pro.lives.broadcastingOne')
        : fill(t('pro.lives.broadcasting'), { n: broadcastingDoctors });

  const searchAndChips = (
    <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
      <div className="pro-search lg:max-w-[560px] lg:flex-1">
        <Search />
        <input
          type="search"
          className="bg-white"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('pro.lives.searchPlaceholder')}
          aria-label={t('pro.lives.searchPlaceholder')}
          enterKeyHint="search"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label={t('pro.lives.clearSearch')} className="pro-kebab w-7 h-7"><X /></button>
        )}
      </div>
      <div className="pro-chip-row lg:flex-1">
        <button type="button" className={`pro-chip ${!selectedSpecialty ? 'is-active' : ''}`} onClick={() => setSelectedSpecialty(null)}>{t('pro.lives.all')}</button>
        {liveSpecialties.map(s => (
          <button key={s} type="button" className={`pro-chip ${selectedSpecialty === s ? 'is-active' : ''}`} onClick={() => setSelectedSpecialty(selectedSpecialty === s ? null : s)}>{s}</button>
        ))}
        {anyFilterActive && (
          <button type="button" className="pro-chip" onClick={clearAllFilters}><X className="w-3.5 h-3.5" /> {t('lives.clearFilters')}</button>
        )}
        {hasAdvancedOptions && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={`pro-chip ${advancedFilterActive ? 'is-active' : ''}`}><SlidersHorizontal className="w-3.5 h-3.5" /> {t('pro.lives.filters')}</button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(92vw,420px)] p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {liveCountries.length > 0 && (
                  <SearchableFilter label={t('doctorFilters.countryLabel')} options={liveCountries} value={selectedCountry} onChange={setSelectedCountry} placeholder={t('doctorFilters.countryLabel')} emptyLabel={t('recordingsGridPage.filterNoResults')} icon={Globe} allLabel={t('doctorFilters.countryPlaceholder')} />
                )}
                {liveUniversities.length > 0 && (
                  <SearchableFilter label={t('doctorFilters.universityLabel')} options={liveUniversities} value={selectedUniversity} onChange={setSelectedUniversity} placeholder={t('doctorFilters.universityLabel')} emptyLabel={t('recordingsGridPage.filterNoResults')} icon={GraduationCap} allLabel={t('doctorFilters.universityPlaceholder')} />
                )}
                {liveHospitals.length > 0 && (
                  <SearchableFilter label={t('doctorFilters.hospitalLabel')} options={liveHospitals} value={selectedHospital} onChange={setSelectedHospital} placeholder={t('doctorFilters.hospitalLabel')} emptyLabel={t('recordingsGridPage.filterNoResults')} icon={Building2} allLabel={t('doctorFilters.hospitalPlaceholder')} />
                )}
              </div>
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map(tag => (
                    <button key={tag} type="button" onClick={() => setSelectedTag(selectedTag === tag ? null : tag)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${selectedTag === tag ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border'}`}>#{tag}</button>
                  ))}
                </div>
              )}
              {allCities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allCities.map(city => (
                    <button key={city} type="button" onClick={() => setSelectedCity(selectedCity === city ? null : city)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${selectedCity === city ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border'}`}>📍 {city}</button>
                  ))}
                </div>
              )}
              {advancedFilterActive && (
                <button type="button" onClick={() => { setSelectedTag(null); setSelectedCity(null); setSelectedCountry(''); setSelectedUniversity(''); setSelectedHospital(''); }} className="text-xs font-semibold text-primary hover:underline">{t('lives.clearFilters')}</button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );

  const authorTabs = showAuthorTabs && (
    <div className="pro-chip-row mt-3" aria-label={t('livesAuthorTabs.ariaLabel')}>
      {([
        { key: 'all' as const, label: t('livesAuthorTabs.all'), count: activeLives.length },
        { key: 'doctor' as const, label: t('livesAuthorTabs.doctors'), count: doctorLiveCount },
        { key: 'resident' as const, label: t('livesAuthorTabs.residents'), count: residentLiveCount },
      ]).map(tab => (
        <button key={tab.key} type="button" aria-pressed={authorFilter === tab.key} onClick={() => setAuthorFilter(tab.key)} className={`pro-chip ${authorFilter === tab.key ? 'is-active' : ''}`}>
          {tab.label} <span className="opacity-70">({tab.count})</span>
        </button>
      ))}
    </div>
  );

  const credentialsBanner = (credentialsLoadError || credentialsRetrying) && filteredLives.length > 0 && (
    <div className="mb-3 p-2 rounded-xl bg-white/90 border border-destructive/30 flex items-center justify-between gap-2 text-xs">
      {credentialsRetrying ? (
        <span className="flex items-center gap-2 text-muted-foreground"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recargando credenciales…</span>
      ) : (
        <>
          <span className="text-destructive flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> No se pudieron cargar todas las credenciales</span>
          <button type="button" onClick={retryCredentials} disabled={credentialsRetrying} className="pro-btn pro-btn-outline pro-btn-xs"><RefreshCw className="w-3 h-3" /> Reintentar</button>
        </>
      )}
    </div>
  );

  const emptyState = (
    <div className="pro-card pro-card-pad bg-card text-center py-10">
      <Video className="w-12 h-12 mx-auto pro-muted opacity-40 mb-3" />
      <h3 className="text-base font-bold pro-ink mb-1">{anyFilterActive ? t('lives.noLivesFiltered') : t('lives.noLives')}</h3>
      <p className="pro-muted text-sm">{anyFilterActive ? t('lives.noLivesFilteredDesc') : t('lives.noLivesDescription')}</p>
      {anyFilterActive && (
        <button type="button" className="pro-btn pro-btn-outline pro-btn-sm mt-4" onClick={clearAllFilters}>{t('lives.clearFilters')}</button>
      )}
    </div>
  );

  const skeletonGrid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="pro-live-card">
          <div className="pro-live-media animate-pulse" />
          <div className="pro-live-body space-y-2">
            <div className="h-3.5 rounded bg-white/20 animate-pulse" />
            <div className="h-3 rounded bg-white/10 animate-pulse w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );

  const upcomingSection = (upcomingLoading && availabilities.length === 0) ? (
    <section className="mt-2">
      <div className="pro-section-title"><span>{t('pro.lives.upcoming')}</span></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[0, 1, 2].map(i => <div key={i} className="h-[66px] rounded-[14px] bg-white/10 animate-pulse" />)}
      </div>
    </section>
  ) : upcomingLives.length > 0 && (
    <section className="mt-2">
      <div className="pro-section-title">
        <span className="min-w-0 truncate">{upcomingFromFollowed ? t('pro.lives.followedUpcoming') : t('pro.lives.upcoming')}</span>
        <span className="flex items-center gap-3 shrink-0">
          {upcomingLives.length > 4 && (
            <button type="button" className="pro-link" onClick={() => setShowAllUpcoming(v => !v)}>
              {showAllUpcoming ? t('pro.lives.lessCalendar') : fill(t('pro.lives.seeAllUpcoming'), { n: upcomingLives.length })} <ArrowRight />
            </button>
          )}
        </span>
      </div>
      {!upcomingFromFollowed && subscriptions.length === 0 && (
        <p className="-mt-1 mb-2 inline-flex items-center gap-1 text-xs font-medium text-white/80"><Bell className="w-3.5 h-3.5" /> {t('pro.lives.followHint')}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {(showAllUpcoming ? upcomingLives.slice(0, 50) : upcomingLives.slice(0, 4)).map(a => (
          <button key={a.id} type="button" className="pro-upcoming pro-upcoming-btn" onClick={() => setSelectedUpcoming(a)}>
            <span className="icon"><UpcomingIcon type={a.type} /></span>
            <span className="min-w-0 flex-1">
              <b>{a.title}{premiumDoctorIds.has(a.doctorId) && a.type === 'live' ? <span className="star">⭐</span> : null}</b>
              {a.doctorName && <span className="inline-flex items-center gap-1 max-w-full"><span className="truncate">{a.doctorName}</span><DoctorBadgeIcon userId={a.doctorId} size="sm" className="flex-shrink-0" /></span>}
              <span>
                <i className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: a.status === 'confirmed' ? '#4ade80' : 'rgba(255,255,255,.55)' }} aria-hidden="true" />
                {upcomingTypeLabel(a)} · 📅 {whenLabel(a.scheduledAt, language, t)}{tz ? ` (${tz})` : ''} · {formatDistanceToNow(a.scheduledAt, { addSuffix: true, locale: dateLocale })}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );

  // Detalle de un próximo evento (lo que abría el bloque anterior al pulsar una tarjeta)
  const upcomingDialog = (
    <Dialog open={!!selectedUpcoming} onOpenChange={(o) => { if (!o) setSelectedUpcoming(null); }}>
      <DialogContent className="sm:max-w-md">
        {selectedUpcoming && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-start gap-3 text-left">
                <span className="pro-icon-box" style={selectedUpcoming.type === 'live' ? { background: '#fde8e8', color: 'var(--pro-live)' } : undefined}>
                  <UpcomingIcon type={selectedUpcoming.type} />
                </span>
                <span className="min-w-0">
                  <span className="block leading-snug break-words">{selectedUpcoming.title}</span>
                  <span className="block text-sm font-normal text-muted-foreground mt-1 inline-flex items-center gap-1 max-w-full">
                    <span className="truncate">{selectedUpcoming.doctorName}</span>
                    <DoctorBadgeIcon userId={selectedUpcoming.doctorId} size="sm" className="flex-shrink-0" />
                  </span>
                </span>
              </DialogTitle>
              <DialogDescription className="sr-only">{selectedUpcoming.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`pro-pill pro-pill-plain ${selectedUpcoming.status === 'confirmed' ? 'pro-pill-ok' : 'pro-pill-muted'}`}>{upcomingTypeLabel(selectedUpcoming)}</span>
                {premiumDoctorIds.has(selectedUpcoming.doctorId) && selectedUpcoming.type === 'live' && (
                  <span className="pro-pill pro-pill-plain pro-pill-warn">⭐ {t('lives.earlyAccess')}</span>
                )}
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="font-medium">{whenLabel(selectedUpcoming.scheduledAt, language, t)}{tz ? ` (${tz})` : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span>{selectedUpcoming.durationMinutes} {t('pro.common.min')} · {formatDistanceToNow(selectedUpcoming.scheduledAt, { addSuffix: true, locale: dateLocale })}</span>
                </div>
              </div>
              {selectedUpcoming.description && (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{selectedUpcoming.description}</div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
              <button type="button" className="pro-btn pro-btn-outline w-full sm:w-auto" onClick={() => setSelectedUpcoming(null)}>{t('pro.common.close')}</button>
              <Link to={`/doctor/${selectedUpcoming.doctorId}`} className="pro-btn pro-btn-teal w-full sm:w-auto"><User /> {t('pro.lives.viewProfile')}</Link>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  const header = (
    <div className="pro-page-head">
      <div className="min-w-0">
        <h1 className="pro-page-title">
          <span className="pro-live-dot"><Radio className="w-5 h-5" style={{ color: 'var(--pro-live)' }} /></span>
          <span className="truncate">{t('pro.lives.liveNow')}</span>
        </h1>
        <p className="pro-page-sub">
          {broadcastingText}
          {anyFilterActive && activeLives.length > 0 && (
            <span className="block text-white/75 text-[13px]">{fill(t('pro.lives.activeCount'), { x: filteredLives.length, y: activeLives.length })}</span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
        {view === 'grid' ? (
          <button type="button" className="pro-btn pro-btn-ghost flex-1 sm:flex-none" onClick={() => setView('featured')}>
            <Compass /> {t('pro.lives.exploreAll')}
          </button>
        ) : (
          <button type="button" className="pro-btn pro-btn-ghost flex-1 sm:flex-none" onClick={() => setView('grid')}>
            {t('pro.lives.seeAllLives')} <ArrowRight />
          </button>
        )}
        {canGoLive && (
          <Link to="/doctor/go-live" className="pro-btn pro-btn-live flex-1 sm:flex-none">
            <Plus /> {t('pro.lives.goLive')}
          </Link>
        )}
        {role === 'visitor' && (
          <>
            <span className="pro-btn pro-btn-ghost flex-1 sm:flex-none cursor-default"><Eye /> <span className="truncate">{t('lives.viewerMode')}</span></span>
            <Link to="/login" className="pro-btn pro-btn-white flex-1 sm:flex-none"><LogIn /> {t('nav.login')}</Link>
          </>
        )}
      </div>
    </div>
  );

  return (
    <MainLayout>
      <AdInterstitial />
      <div className="pro-container pro-page">
        <AdBanner placementName="lives_top_banner" className="mb-4" />
        {header}

        {view === 'featured' ? (
          <>
            {isLoading && activeLives.length === 0 ? (
              <div className="pro-hero"><div className="pro-hero-media animate-pulse" /></div>
            ) : featured ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="pro-hero">
                  <div className="pro-hero-media">
                    <LiveMedia live={featured} />
                    <div className="pro-hero-shade" />
                    <span className="pro-live-badge sm:!top-4 sm:!left-4"><Radio /> {t('lives.liveBadge')}</span>
                    <span className="pro-live-views sm:!top-4 sm:!right-4"><Eye /> {fill(t('pro.lives.watching'), { n: (featured.viewerCount ?? 0).toLocaleString() })}</span>
                    {featured.startedAt && <span className="pro-live-dur sm:!right-4 sm:!bottom-4" title={fill(t('pro.lives.startedAgo'), { t: formatDuration(featured.startedAt) })}><Clock /> {formatDuration(featured.startedAt)}</span>}
                    <div className="pro-hero-content">
                      <h2 className="pro-hero-title">{featured.title}</h2>
                      <div className="pro-hero-doc">
                        <DoctorAvatar live={featured} />
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <b className="truncate">{featured.doctorName}</b>
                          <DoctorBadgeIcon userId={featured.doctorId} size="sm" className="flex-shrink-0" />
                          <ProfileCategoryMark userId={featured.doctorId} size="sm" className="flex-shrink-0" />
                        </span>
                        <span className="spec">· {featured.specialty}</span>
                      </div>
                      <div className="pro-hero-doc !mt-1.5 text-[13px]">
                        <span className="meta">{t('pro.lives.freeAccess')}</span>
                        {getSubscription(featured.doctorId)?.tier === 'premium' && (
                          <span className="meta inline-flex items-center gap-1">| <Crown className="w-3.5 h-3.5" /> {t('lives.earlyAccess')}</span>
                        )}
                      </div>
                      <div className="pro-hero-cta">
                        <Link to={`/live/${featured.id}`} className="pro-btn pro-btn-teal">{t('pro.lives.enter')} <ArrowRight /></Link>
                      </div>
                    </div>
                  </div>
                </div>
                <aside className="pro-panel-dark flex flex-col min-w-0">
                  <h3 className="pro-card-title text-white mb-2"><span className="truncate">{t('pro.lives.alsoLive')}</span></h3>
                  <div className="flex-1">
                    {others.length === 0 ? (
                      <p className="text-sm text-white/75 py-2">{t('pro.lives.noOthers')}</p>
                    ) : (
                      others.slice(0, 3).map(l => <SideLiveItem key={l.id} live={l} t={t} />)
                    )}
                  </div>
                  <button type="button" className="pro-btn pro-btn-ghost w-full mt-3" onClick={() => setView('grid')}>
                    {fill(t('pro.lives.seeAllN'), { n: filteredLives.length })} <ArrowRight />
                  </button>
                </aside>
              </div>
            ) : (
              emptyState
            )}

            <div className="mt-4">{searchAndChips}</div>
            {authorTabs}
            <div className="mt-3">{credentialsBanner}</div>

            {filteredLives.length > 0 && (
              <section>
                <div className="pro-section-title">
                  <span>{t('pro.lives.allLives')}</span>
                  <button type="button" className="pro-link" onClick={() => setView('grid')}>{t('pro.lives.seeAll')} <ArrowRight /></button>
                </div>
                <div className="pro-rail">
                  {filteredLives.map(live => (
                    <div key={live.id}>
                      <LiveCardPro live={live} isPremiumSub={getSubscription(live.doctorId)?.tier === 'premium'} t={t} />
                    </div>
                  ))}
                </div>
              </section>
            )}
            {featured && filteredLives.length === 0 && emptyState}

            {upcomingSection}
          </>
        ) : (
          <>
            {searchAndChips}
            {authorTabs}
            <div className="mt-4">{credentialsBanner}</div>

            {isLoading && activeLives.length === 0 ? (
              skeletonGrid
            ) : filteredLives.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                <AnimatePresence mode="sync">
                  {filteredLives.map(live => (
                    <motion.div
                      key={live.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: 16 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -16 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      className="h-full"
                    >
                      <LiveCardPro live={live} isPremiumSub={getSubscription(live.doctorId)?.tier === 'premium'} t={t} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              emptyState
            )}

            {upcomingSection}
          </>
        )}

        {role === 'visitor' && (
          <div className="pro-card pro-card-pad bg-card mt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-5 h-5" style={{ color: 'var(--pro-teal)' }} />
                  <h3 className="font-bold pro-ink">{t('lives.wantMore')}</h3>
                </div>
                <p className="pro-muted text-sm">{t('lives.registerPrompt')}</p>
              </div>
              <Link to="/login" className="pro-btn pro-btn-teal">{t('lives.createAccount')}</Link>
            </div>
          </div>
        )}

        {toggles.show_news_section && <div className="mt-6"><NewsFeed /></div>}
      </div>

      {upcomingDialog}
      <LivesDebugPanel />
    </MainLayout>
  );
}
