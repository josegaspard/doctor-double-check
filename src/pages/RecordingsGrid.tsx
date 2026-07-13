import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLives, Recording } from '@/contexts/LivesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWallet } from '@/contexts/WalletContext';
import { usePurchases } from '@/hooks/usePurchases';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import MainLayout from '@/components/layout/MainLayout';
import PaywallModal from '@/components/PaywallModal';
import { HoverPlayCard } from '@/components/recordings/HoverPlayCard';
import { useUserInterests, interestScore } from '@/hooks/useUserInterests';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableFilter } from '@/components/filters/SearchableFilter';
import { 
  PlayCircle, 
  Clock, 
  Search,
  Lock,
  CheckCircle,
  Wallet,
  Crown,
  Eye,
  ShoppingBag,
  Sparkles,
  Library,
  Gift,
  Globe,
  Upload,
  Stethoscope,
  Tag,
  User,
} from 'lucide-react';

type ContentFilter = 'all' | 'free' | 'purchased';

import { useSpecialties } from '@/hooks/useSpecialties';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';

export default function RecordingsGrid({ embedded = false }: { embedded?: boolean } = {}) {
  // embedded=true: se renderiza DENTRO de otra página (p.ej. /education → pestaña
  // "Contenido premium") sin su propio MainLayout/footer ni el min-h-screen, para
  // que el contenido se abra abajo igual que Casos clínicos/Reuniones. Cliente 2026-06-22.
  const Wrapper = embedded ? React.Fragment : MainLayout;
  const navigate = useNavigate();
  const { specialtyValues } = useSpecialties();
  const [searchParams] = useSearchParams();
  const doctorFilter = searchParams.get('doctor');
  const { recordings, refreshRecordings } = useLives();
  const { data: interests = [] } = useUserInterests();
  const { user, role, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const { balance } = useWallet();
  const { hasPurchased, purchaseWithWallet, isPurchasing } = usePurchases();
  const { getEffectiveRecordingPrice, hasPremiumTo } = useSubscriptions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');

  useEffect(() => { refreshRecordings(); }, [refreshRecordings]);

  useEffect(() => {
    if (!doctorFilter) { setDoctorName(null); return; }
    const fetchName = async () => {
      const { data } = await supabase.from('profiles_public').select('name').eq('id', doctorFilter).maybeSingle();
      setDoctorName(data?.name || null);
    };
    fetchName();
  }, [doctorFilter]);

  const allTags = useMemo(() => [...new Set(recordings.flatMap(r => r.tags || []))].filter(Boolean).sort(), [recordings]);
  const allDoctorNames = useMemo(() => [...new Set(recordings.map(r => r.doctorName))].filter(Boolean).sort(), [recordings]);
  const specialtyOptions = specialtyValues;

  const ownsRecording = (recording: Recording): boolean => {
    if (!user) return false;
    if (role === 'admin' || role === 'doctor') return true;
    if (recording.price === 0) return true;
    return hasPurchased(recording.id);
  };

  const filteredRecordings = recordings.filter(rec => {
    const matchesSearch = rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rec.doctorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialty = !selectedSpecialty || rec.specialty === selectedSpecialty;
    const matchesDoctor = !doctorFilter || rec.doctorId === doctorFilter;
    const matchesTag = !selectedTag || (rec.tags || []).includes(selectedTag);
    const matchesDoctorName = !selectedDoctor || rec.doctorName === selectedDoctor;
    
    if (!matchesSearch || !matchesSpecialty || !matchesDoctor || !matchesTag || !matchesDoctorName) return false;
    
    const owned = ownsRecording(rec);
    switch (contentFilter) {
      case 'free': return rec.price === 0;
      case 'purchased': return owned && rec.price > 0;
      default: return true;
    }
  });

  // Recomendación (cliente 2026-06-30): sin filtro manual, priorizar grabaciones
  // afines a lo que el usuario ha buscado (sus intereses).
  if (!searchQuery && !selectedSpecialty && !doctorFilter && !selectedTag && !selectedDoctor && interests.length) {
    filteredRecordings.sort((a, b) =>
      interestScore(`${b.title} ${b.specialty}`, interests) -
      interestScore(`${a.title} ${a.specialty}`, interests)
    );
  }

  // Prefetch del signed URL en hover. Si el user hace click después, el URL
  // ya está en sessionStorage cache y RecordingPlayer lo aplica al instante.
  // Cold-load percibido del recording: <300ms vs ~1s antes.
  const prefetchRecordingUrl = (recording: Recording) => {
    if (!recording.videoUrl || typeof window === 'undefined') return;
    const isBunny = recording.videoUrl.startsWith('bunny:');
    const path = recording.videoUrl.replace(/^b2:|^storage:|^bunny:/, '');
    const cacheKey = `signedurl-v3:${isBunny ? 'bunny:' : recording.videoUrl.startsWith('b2:') ? 'b2:' : ''}${path}`;
    // Skip si ya está cacheado y vigente
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as { url: string; generatedAt: number; ttlSec: number };
        if (Date.now() - cached.generatedAt < (cached.ttlSec - 300) * 1000) return;
      }
    } catch { /* ignore */ }

    if (isBunny) {
      // Bunny: prefetch HLS (anti-piracy fragmentado). Si está procesando, el
      // player vuelve a pedir /original — esto es solo el prefetch de hover.
      const isProcessing = recording.bunnyStatus && recording.bunnyStatus !== 'ready';
      supabase.functions
        .invoke('bunny-signed-url', { body: { videoId: path, ttlSec: 600 } })
        .then(({ data }) => {
          if (data?.hlsUrl) {
            const ttl = typeof data.expiresSec === 'number' ? data.expiresSec : 600;
            const url = isProcessing ? data.originalUrl : data.hlsUrl;
            sessionStorage.setItem(cacheKey, JSON.stringify({ url, poster: data.thumbnailUrl, generatedAt: Date.now(), ttlSec: ttl }));
          }
        })
        .catch(() => { /* fail silently */ });
    } else if (recording.videoUrl.startsWith('b2:')) {
      supabase.functions
        .invoke('b2-presigned-url', { body: { operation: 'get', path } })
        .then(({ data }) => {
          if (data?.url) {
            const ttl = typeof data.expiresSec === 'number' ? data.expiresSec : 3600;
            sessionStorage.setItem(cacheKey, JSON.stringify({ url: data.url, generatedAt: Date.now(), ttlSec: ttl }));
          }
        })
        .catch(() => { /* fail silently */ });
    } else if (recording.videoUrl.startsWith('storage:')) {
      supabase.storage
        .from('recordings')
        .createSignedUrl(path, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) {
            sessionStorage.setItem(cacheKey, JSON.stringify({ url: data.signedUrl, generatedAt: Date.now(), ttlSec: 3600 }));
          }
        })
        .catch(() => { /* fail silently */ });
    }
  };

  const handleRecordingClick = (recording: Recording) => {
    if (!isAuthenticated || role === 'visitor') { navigate('/login'); return; }
    // bunny_status='failed' → bloquear; 'uploading' → bloquear; 'processing' →
    // permitir click (player usa /original mientras encoding sucede).
    if (recording.bunnyStatus === 'failed') {
      toast.error(t('recordingsGridPage.errorProcessingToast'));
      return;
    }
    if (recording.bunnyStatus === 'uploading') {
      toast.info(t('recordingsGridPage.stillUploadingToast'));
      return;
    }
    // 'processing': sin toast — el player reproduce /original transparente
    prefetchRecordingUrl(recording);
    if (ownsRecording(recording)) {
      navigate(`/recording/${recording.id}`);
    } else {
      setSelectedRecording(recording);
      setShowPaywall(true);
    }
  };

  const handlePurchase = async () => {
    if (!selectedRecording) return;
    const result = await purchaseWithWallet(selectedRecording.id);
    if (result.success) {
      setShowPaywall(false);
      navigate(`/recording/${selectedRecording.id}`);
      setSelectedRecording(null);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return t('recordingsGridPage.processing');
    const totalMinutes = Math.floor(seconds / 60);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const canAffordSelected = selectedRecording 
    ? balance >= getEffectiveRecordingPrice(selectedRecording.price, selectedRecording.doctorId)
    : false;

  const filterOptions: { key: ContentFilter; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: t('ads.filterAll'), icon: <Library className="w-3.5 h-3.5" /> },
    { key: 'free', label: t('ads.filterFree'), icon: <Gift className="w-3.5 h-3.5" /> },
    { key: 'purchased', label: t('ads.filterPurchased'), icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  ];

  return (
    <Wrapper>
      <div className={embedded ? 'relative' : 'relative min-h-screen overflow-hidden'}>
        <div className={embedded ? 'relative z-10' : 'relative z-10 container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl'}>
          {/* Hero Header Card — sólo en la página propia /recordings.
              EMBEBIDO en /education (pestaña "Contenido Premium"): el cliente NO quiere
              la tarjeta blanca que repite "Contenido Premium"; sólo el botón rojo de subir,
              igual que "Subir caso clínico" (2026-06-24). */}
          {embedded ? (
            (isAuthenticated && role === 'doctor') && (
              <div className="mb-4">
                <Link to="/doctor/upload">
                  <Button size="lg" variant="live" className="w-full sm:w-auto gap-2 min-h-[48px] font-semibold shadow-lg shadow-live/30">
                    <Upload className="w-5 h-5" />
                    {t('recordingsGridPage.uploadContent')}
                  </Button>
                </Link>
              </div>
            )
          ) : (
          <div className="mb-6 rounded-2xl border-2 border-primary/40 bg-card p-5 sm:p-6 shadow-xl dark:bg-[hsl(223,55%,18%)]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                    <PlayCircle className="w-5 h-5 text-primary" />
                  </div>
                  {doctorName ? `${t('recordings.recordingsOf')} ${doctorName}` : t('recordings.premiumContent')}
                </h1>
                <p className="text-foreground/70 text-sm mt-1.5 ml-11">
                  {filteredRecordings.length} {t('recordings.title').toLowerCase()}
                  {doctorFilter && (
                    <Button variant="link" size="sm" className="ml-2 p-0 h-auto text-xs" onClick={() => navigate('/recordings')}>
                      {t('recordings.viewAll')}
                    </Button>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isAuthenticated && role === 'doctor' && (
                  <Link to="/doctor/upload">
                    <Button variant="live" className="gap-2">
                      <Upload className="w-4 h-4" />
                      {t('recordingsGridPage.uploadContent')}
                    </Button>
                  </Link>
                )}
                {isAuthenticated && (role === 'patient' || role === 'resident') && (
                  <Link to="/wallet">
                    <Button variant="outline" className="gap-2">
                      <Wallet className="w-4 h-4" />
                      {t('wallet.balance')}: ${balance.toLocaleString()}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
          )}

        <div className="md:grid md:grid-cols-[14rem_1fr] md:gap-6 md:items-start overflow-visible">
          {/* ===== Desktop Sidebar ===== */}
          {!isMobile && (
            <aside className="hidden md:block sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-hide bg-card border border-border rounded-xl p-4 space-y-1">
              {/* Access filter FIRST */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {t('recordingsGridPage.accessLabel')}
                </h4>
                <div className="space-y-0.5">
                  {filterOptions.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setContentFilter(opt.key)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        contentFilter === opt.key
                          ? 'bg-accent text-accent-foreground shadow-sm'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border my-3" />

              {/* Specialties */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {t('recordingsGridPage.specialtyLabel')}
                </h4>
                <SearchableFilter
                  options={specialtyOptions}
                  value={selectedSpecialty}
                  onChange={setSelectedSpecialty}
                  placeholder={t('recordingsGridPage.specialtyPlaceholder')}
                  searchPlaceholder={t('recordingsGridPage.specialtySearchPlaceholder')}
                  emptyLabel={t('recordingsGridPage.filterNoResults')}
                  icon={Stethoscope}
                  allLabel={t('recordingsGridPage.filterAll')}
                />
              </div>

              <div className="border-t border-border my-3" />

              {/* Doctor filter */}
              {allDoctorNames.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    {t('recordingsGridPage.doctorLabel')}
                  </h4>
                  <SearchableFilter
                    options={allDoctorNames}
                    value={selectedDoctor}
                    onChange={setSelectedDoctor}
                    placeholder={t('recordingsGridPage.doctorPlaceholder')}
                    searchPlaceholder={t('recordingsGridPage.doctorSearchPlaceholder')}
                    emptyLabel={t('recordingsGridPage.filterNoResults')}
                    icon={User}
                    allLabel={t('recordingsGridPage.filterAllMasc')}
                  />
                </div>
              )}

              {/* Tags */}
              {allTags.length > 0 && (
                <>
                  <div className="border-t border-border my-3" />
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      {t('recordingsGridPage.categoriesLabel')}
                    </h4>
                    <SearchableFilter
                      options={allTags}
                      value={selectedTag}
                      onChange={setSelectedTag}
                      placeholder={t('recordingsGridPage.categoryPlaceholder')}
                      searchPlaceholder={t('recordingsGridPage.categorySearchPlaceholder')}
                      emptyLabel={t('recordingsGridPage.filterNoResults')}
                      icon={Tag}
                      allLabel={t('recordingsGridPage.filterAll')}
                    />
                  </div>
                </>
              )}
            </aside>
          )}

          {/* ===== Main Content ===== */}
          <div className="min-w-0">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 bg-white dark:bg-card border-2 border-primary/30 shadow-md focus-visible:ring-primary/40 focus-visible:border-primary placeholder:text-muted-foreground"
              />
            </div>

            {/* Mobile: Content filter chips FIRST */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x mb-2 md:hidden">
              {filterOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setContentFilter(opt.key)}
                  className={`flex-shrink-0 snap-start flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    contentFilter === opt.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Mobile: Smart filters */}
            <div className="flex gap-2 mb-3 md:hidden">
              <SearchableFilter
                options={specialtyOptions}
                value={selectedSpecialty}
                onChange={setSelectedSpecialty}
                placeholder={t('recordingsGridPage.specialtyPlaceholder')}
                searchPlaceholder={t('recordingsGridPage.specialtySearchPlaceholder')}
                emptyLabel={t('recordingsGridPage.filterNoResults')}
                icon={Stethoscope}
                allLabel={t('recordingsGridPage.filterAll')}
              />
              {allDoctorNames.length > 0 && (
                <SearchableFilter
                  options={allDoctorNames}
                  value={selectedDoctor}
                  onChange={setSelectedDoctor}
                  placeholder={t('recordingsGridPage.doctorPlaceholder')}
                  searchPlaceholder={t('recordingsGridPage.doctorSearchPlaceholder')}
                  emptyLabel={t('recordingsGridPage.filterNoResults')}
                  icon={User}
                  allLabel={t('recordingsGridPage.filterAllMasc')}
                />
              )}
              {allTags.length > 0 && (
                <SearchableFilter
                  options={allTags}
                  value={selectedTag}
                  onChange={setSelectedTag}
                  placeholder={t('recordingsGridPage.categoryPlaceholder')}
                  searchPlaceholder={t('recordingsGridPage.categorySearchPlaceholder')}
                  emptyLabel={t('recordingsGridPage.filterNoResults')}
                  icon={Tag}
                  allLabel={t('recordingsGridPage.filterAll')}
                />
              )}
            </div>

            {/* No balance CTA */}
            {isAuthenticated && (role === 'patient' || role === 'resident') && balance === 0 && (
              <div className="mb-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-lg overflow-hidden relative border-0">
                <div aria-hidden className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-light/25 blur-2xl" />
                <div aria-hidden className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-accent/25 blur-2xl" />
                <div className="relative flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur ring-1 ring-white/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{t('recordingsGridPage.walletNeededTitle')}</p>
                    <p className="text-xs text-white/85 mt-0.5 leading-relaxed">{t('recordingsGridPage.walletNeededDescription')}</p>
                  </div>
                </div>
                <Link to="/wallet" className="relative block mt-3">
                  <Button className="w-full sm:w-auto gap-2 bg-white text-secondary font-semibold hover:bg-white/90 shadow-md">
                    <Wallet className="w-4 h-4" />
                    {t('recordingsGridPage.topUpNow')}
                  </Button>
                </Link>
              </div>
            )}

            {/* Recordings Grid */}
            {filteredRecordings.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredRecordings.map((recording) => {
                  const owned = ownsRecording(recording);
                  const isFree = recording.price === 0;
                  
                  return (
                    <Card
                      key={recording.id}
                      className={`group cursor-pointer overflow-hidden hover:shadow-lg transition-all ${
                        owned ? 'border-success/30' : 'card-premium'
                      }`}
                      onClick={() => handleRecordingClick(recording)}
                      onMouseEnter={() => owned && prefetchRecordingUrl(recording)}
                      onFocus={() => owned && prefetchRecordingUrl(recording)}
                    >
                      <div className="relative aspect-video bg-gradient-to-br from-premium/10 to-primary/10">
                        <HoverPlayCard
                          recordingId={recording.id}
                          thumbnailUrl={recording.thumbnailUrl}
                          previewClipUrl={(recording as any).previewClipUrl}
                          alt={recording.title}
                          enableHoverPlay={owned}
                          userEmail={user?.email}
                          userId={user?.id}
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          {!recording.thumbnailUrl && <PlayCircle className="w-12 h-12 text-premium/40" />}
                        </div>
                        
                        <div className="absolute top-2 left-2">
                          {owned ? (
                            <Badge className="gap-1 bg-success/90 text-white border-0">
                              <CheckCircle className="w-3 h-3" />
                              {isFree ? t('ads.filterFree') : t('ads.filterPurchased')}
                            </Badge>
                          ) : isFree ? (
                            <Badge className="gap-1 bg-success/90 text-white border-0">
                              <Gift className="w-3 h-3" />
                              {t('ads.filterFree')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Lock className="w-3 h-3" />
                              {t('ads.filterPaid')}
                            </Badge>
                          )}
                        </div>

                        <div className="absolute bottom-2 right-2">
                          <Badge variant="secondary" className="gap-1 bg-black/50 text-white border-0">
                            <Clock className="w-3 h-3" />
                            {formatDuration(recording.duration)}
                          </Badge>
                        </div>

                        {/* Bunny status overlay:
                            - uploading: bloquea visualmente (no hay video disponible aún)
                            - processing: NO overlay — el thumbnail/portada del live se ve
                              normal. El video YA es reproducible via /original (Bunny
                              encodea en background). Mostramos solo un pequeño badge
                              "Optimizando" en la esquina, no un overlay full-thumbnail.
                            - failed: badge de error en la esquina, no bloquea acceso */}
                        {recording.bunnyStatus === 'uploading' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
                            <div className="text-center text-white px-4">
                              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white/20 flex items-center justify-center">
                                <span className="block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              </div>
                              <p className="text-xs font-semibold">{t('recordingsGridPage.uploadingRecording')}</p>
                              <p className="text-[10px] text-white/75 mt-0.5">{t('recordingsGridPage.readyInMinutes')}</p>
                            </div>
                          </div>
                        )}
                        {/* processing: no overlay ni badge — el /original ya es reproducible.
                            Si Bunny tarda mucho o el webhook no llega, el usuario sigue viendo
                            el thumbnail normal y al hacer click obtiene /original sin fricción. */}
                        {recording.bunnyStatus === 'failed' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                            <div className="text-center text-white px-4">
                              <p className="text-xs font-semibold text-destructive-foreground bg-destructive/90 inline-block px-2 py-0.5 rounded">{t('recordingsGridPage.processingError')}</p>
                              <p className="text-[10px] text-white/85 mt-1">{t('recordingsGridPage.contactSupport')}</p>
                            </div>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/0 group-hover:bg-white/90 flex items-center justify-center transition-colors">
                            <PlayCircle className="w-6 h-6 text-premium opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                      
                      <CardContent className="p-3 sm:p-4">
                        <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors text-sm sm:text-base">
                          {recording.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary">
                              {recording.doctorName.charAt(0)}
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <span className="truncate">{recording.doctorName}</span>
                            <DoctorBadgeIcon userId={recording.doctorId} size="sm" className="flex-shrink-0" />
                          </span>
                        </div>
                        {recording.peakViewers != null && recording.peakViewers > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                            <Eye className="w-3.5 h-3.5" />
                            <span>{recording.peakViewers.toLocaleString()} {t('ads.viewers')}</span>
                          </div>
                        )}
                        {(!recording.peakViewers || recording.peakViewers === 0) && <div className="mb-3" />}
                        
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {recording.specialty}
                          </Badge>
                          {!owned && !isFree && (
                            <div className="text-right">
                              {hasPremiumTo(recording.doctorId) ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground line-through">
                                    ${recording.price}
                                  </span>
                                  <span className="font-bold text-success">
                                    ${getEffectiveRecordingPrice(recording.price, recording.doctorId).toFixed(0)}
                                  </span>
                                  <Crown className="w-3 h-3 text-warning" />
                                </div>
                              ) : (
                                <span className="font-bold text-premium">
                                  ${recording.price}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-8 sm:p-12 text-center">
                <PlayCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                  {contentFilter !== 'all' || selectedSpecialty ? t('ads.noRecordingsFilters') : t('recordings.noRecordings')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t('common.noResults')}
                </p>
                {(contentFilter !== 'all' || selectedSpecialty) && (
                  <Button variant="outline" className="mt-3" onClick={() => { setContentFilter('all'); setSelectedSpecialty(''); setSelectedDoctor(''); setSelectedTag(''); }}>
                    {t('ads.removeFilters')}
                  </Button>
                )}
              </Card>
            )}
          </div>
        </div>
        </div>
      </div>

      <PaywallModal
        open={showPaywall}
        onClose={() => { setShowPaywall(false); setSelectedRecording(null); }}
        recording={selectedRecording as any}
        onPurchase={handlePurchase}
        isPurchasing={isPurchasing}
        canAfford={canAffordSelected}
        balance={balance}
      />
    </Wrapper>
  );
}
