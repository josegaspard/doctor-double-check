import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLives, Recording } from '@/contexts/LivesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWallet } from '@/contexts/WalletContext';
import { usePurchases } from '@/hooks/usePurchases';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import PaywallModal from '@/components/PaywallModal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
} from 'lucide-react';

type ContentFilter = 'all' | 'free' | 'paid' | 'purchased' | 'not_purchased';

const SPECIALTIES = [
  { value: 'Todas', labelKey: 'doctors.specAll' },
  { value: 'Alergología', labelKey: 'doctors.specAllergology' },
  { value: 'Anestesiología', labelKey: 'doctors.specAnesthesiology' },
  { value: 'Angiología', labelKey: 'doctors.specAngiology' },
  { value: 'Cardiología', labelKey: 'doctors.specCardiology' },
  { value: 'Cirugía General', labelKey: 'doctors.specGeneralSurgery' },
  { value: 'Cirugía Plástica', labelKey: 'doctors.specPlasticSurgery' },
  { value: 'Coloproctología', labelKey: 'doctors.specColoproctology' },
  { value: 'Dermatología', labelKey: 'doctors.specDermatology' },
  { value: 'Endocrinología', labelKey: 'doctors.specEndocrinology' },
  { value: 'Gastroenterología', labelKey: 'doctors.specGastroenterology' },
  { value: 'Geriatría', labelKey: 'doctors.specGeriatrics' },
  { value: 'Ginecología', labelKey: 'doctors.specGynecology' },
  { value: 'Hematología', labelKey: 'doctors.specHematology' },
  { value: 'Infectología', labelKey: 'doctors.specInfectology' },
  { value: 'Medicina Crítica', labelKey: 'doctors.specCriticalCare' },
  { value: 'Medicina de Urgencias', labelKey: 'doctors.specEmergencyMedicine' },
  { value: 'Medicina del Deporte', labelKey: 'doctors.specSportsMedicine' },
  { value: 'Medicina Familiar', labelKey: 'doctors.specFamilyMedicine' },
  { value: 'Medicina Física y Rehabilitación', labelKey: 'doctors.specPhysicalRehab' },
  { value: 'Medicina General', labelKey: 'doctors.specGeneralMedicine' },
  { value: 'Medicina Interna', labelKey: 'doctors.specInternalMedicine' },
  { value: 'Nefrología', labelKey: 'doctors.specNephrology' },
  { value: 'Neonatología', labelKey: 'doctors.specNeonatology' },
  { value: 'Neumología', labelKey: 'doctors.specPulmonology' },
  { value: 'Neurología', labelKey: 'doctors.specNeurology' },
  { value: 'Nutriología', labelKey: 'doctors.specNutriology' },
  { value: 'Oftalmología', labelKey: 'doctors.specOphthalmology' },
  { value: 'Oncología', labelKey: 'doctors.specOncology' },
  { value: 'Ortopedia', labelKey: 'doctors.specOrthopedics' },
  { value: 'Otorrinolaringología', labelKey: 'doctors.specENT' },
  { value: 'Patología', labelKey: 'doctors.specPathology' },
  { value: 'Pediatría', labelKey: 'doctors.specPediatrics' },
  { value: 'Psiquiatría', labelKey: 'doctors.specPsychiatry' },
  { value: 'Radiología', labelKey: 'doctors.specRadiology' },
  { value: 'Reumatología', labelKey: 'doctors.specRheumatology' },
  { value: 'Traumatología', labelKey: 'doctors.specTraumatology' },
  { value: 'Urología', labelKey: 'doctors.specUrology' },
];

export default function RecordingsGrid() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const doctorFilter = searchParams.get('doctor');
  const { recordings, refreshRecordings } = useLives();
  const { user, role, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const isMobile = useIsMobile();
  const { balance } = useWallet();
  const { hasPurchased, purchaseWithWallet, isPurchasing } = usePurchases();
  const { getEffectiveRecordingPrice, hasPremiumTo } = useSubscriptions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('Todas');
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => { refreshRecordings(); }, [refreshRecordings]);

  useEffect(() => {
    if (!doctorFilter) { setDoctorName(null); return; }
    const fetchName = async () => {
      const { data } = await supabase.from('profiles').select('name').eq('id', doctorFilter).single();
      setDoctorName(data?.name || null);
    };
    fetchName();
  }, [doctorFilter]);

  const allTags = [...new Set(recordings.flatMap(r => r.tags || []))].filter(Boolean).sort();

  const ownsRecording = (recording: Recording): boolean => {
    if (!user) return false;
    if (role === 'admin' || role === 'doctor') return true;
    if (recording.price === 0) return true;
    return hasPurchased(recording.id);
  };

  const filteredRecordings = recordings.filter(rec => {
    const matchesSearch = rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rec.doctorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialty = selectedSpecialty === 'Todas' || rec.specialty === selectedSpecialty;
    const matchesDoctor = !doctorFilter || rec.doctorId === doctorFilter;
    const matchesTag = !selectedTag || (rec.tags || []).includes(selectedTag);
    
    if (!matchesSearch || !matchesSpecialty || !matchesDoctor || !matchesTag) return false;
    
    const owned = ownsRecording(rec);
    switch (contentFilter) {
      case 'free': return rec.price === 0;
      case 'paid': return rec.price > 0;
      case 'purchased': return owned && rec.price > 0;
      case 'not_purchased': return !owned && rec.price > 0;
      default: return true;
    }
  });

  const handleRecordingClick = (recording: Recording) => {
    if (!isAuthenticated || role === 'visitor') { navigate('/login'); return; }
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
    if (seconds <= 0) return 'Procesando...';
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
    { key: 'paid', label: t('ads.filterPaid'), icon: <Sparkles className="w-3.5 h-3.5" /> },
    { key: 'purchased', label: t('ads.filterPurchased'), icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { key: 'not_purchased', label: t('ads.filterNotPurchased'), icon: <Lock className="w-3.5 h-3.5" /> },
  ];

  return (
    <MainLayout>
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-primary/[0.02] via-secondary/[0.01] to-primary/[0.02]">
        {/* Decorative medical-style background pattern */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          {/* Soft blurred ambient blobs — give warmth */}
          <div className="absolute -top-20 -right-20 w-[20rem] h-[20rem] sm:w-[32rem] sm:h-[32rem] rounded-full bg-primary/[0.04] blur-[80px]" />
          <div className="absolute top-[40%] -left-20 w-[18rem] h-[18rem] sm:w-[26rem] sm:h-[26rem] rounded-full bg-secondary/[0.03] blur-[60px]" />
          <div className="absolute bottom-0 right-[10%] w-[16rem] h-[16rem] sm:w-[24rem] sm:h-[24rem] rounded-full bg-primary/[0.03] blur-[70px]" />

          {/* Visible ring-style circles — the "design" feel */}
          <div className="absolute top-12 left-[8%] w-28 h-28 sm:w-44 sm:h-44 rounded-full border border-primary/[0.08]" />
          <div className="absolute top-12 left-[8%] w-20 h-20 sm:w-32 sm:h-32 rounded-full border border-primary/[0.05] translate-x-4 translate-y-4" />

          <div className="absolute top-[22rem] right-[5%] w-36 h-36 sm:w-52 sm:h-52 rounded-full border border-secondary/[0.08]" />
          <div className="absolute top-[22rem] right-[5%] w-24 h-24 sm:w-40 sm:h-40 rounded-full border border-secondary/[0.05] translate-x-6 translate-y-6" />

          <div className="absolute top-[50rem] left-[20%] w-32 h-32 sm:w-48 sm:h-48 rounded-full border border-primary/[0.07]" />
          <div className="absolute bottom-32 right-[25%] w-24 h-24 sm:w-36 sm:h-36 rounded-full border border-primary/[0.06]" />

          {/* Small filled dots scattered — medical feel */}
          <div className="absolute top-28 right-[20%] w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-primary/[0.12]" />
          <div className="absolute top-40 left-[30%] w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-secondary/[0.15]" />
          <div className="absolute top-[35rem] right-[40%] w-3 h-3 sm:w-5 sm:h-5 rounded-full bg-primary/[0.10]" />
          <div className="absolute top-[60rem] left-[50%] w-2.5 h-2.5 sm:w-4 sm:h-4 rounded-full bg-secondary/[0.12]" />
          <div className="absolute bottom-60 left-[15%] w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary/[0.14]" />
          <div className="absolute top-[18rem] left-[60%] w-2 h-2 rounded-full bg-primary/[0.10]" />
          <div className="absolute bottom-40 right-[35%] w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full bg-secondary/[0.12]" />
        </div>

        <div className="relative z-10 container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl">
          {/* Hero Header Card */}
          <div className="mb-6 rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent p-5 sm:p-6 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                    <PlayCircle className="w-5 h-5 text-primary" />
                  </div>
                  {doctorName ? `${t('recordings.recordingsOf')} ${doctorName}` : t('recordings.premiumContent')}
                </h1>
                <p className="text-muted-foreground text-sm mt-1.5 ml-11">
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
                      {language === 'es' ? 'Subir contenido' : 'Upload content'}
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

        <div className="md:grid md:grid-cols-[14rem_1fr] md:gap-6 md:items-start overflow-visible">
          {/* ===== Desktop Sidebar ===== */}
          {!isMobile && (
            <aside className="hidden md:block sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-hide bg-card border border-border rounded-xl p-4 space-y-1">
              {/* Access filter FIRST */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {language === 'es' ? 'Acceso' : 'Access'}
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
                  {language === 'es' ? 'Especialidades' : 'Specialties'}
                </h4>
                <div className="space-y-0.5">
                  {SPECIALTIES.map(spec => (
                    <button
                      key={spec.value}
                      onClick={() => setSelectedSpecialty(spec.value)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedSpecialty === spec.value
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      {t(spec.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              {allTags.length > 0 && (
                <>
                  <div className="border-t border-border my-3" />
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      {language === 'es' ? 'Categorías' : 'Categories'}
                    </h4>
                    <div className="space-y-0.5">
                      <button
                        onClick={() => setSelectedTag(null)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          !selectedTag
                            ? 'bg-accent text-accent-foreground shadow-sm'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        {language === 'es' ? 'Todas' : 'All'}
                      </button>
                      {allTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            selectedTag === tag
                              ? 'bg-accent text-accent-foreground shadow-sm'
                              : 'text-foreground hover:bg-muted'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
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
                className="pl-9"
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

            {/* Mobile: Specialty chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide snap-x mb-3 md:hidden">
              {SPECIALTIES.map(spec => (
                <button
                  key={spec.value}
                  onClick={() => setSelectedSpecialty(spec.value)}
                  className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap ${
                    selectedSpecialty === spec.value
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {t(spec.labelKey)}
                </button>
              ))}
            </div>

            {/* Mobile: Tag chips */}
            {allTags.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x mb-3 md:hidden">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    !selectedTag
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {language === 'es' ? 'Todas' : 'All'}
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      selectedTag === tag
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* No balance CTA */}
            {isAuthenticated && (role === 'patient' || role === 'resident') && balance === 0 && (
              <div className="mb-4 p-4 rounded-xl bg-muted border border-border">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Para comprar contenido premium necesitas saldo en tu billetera</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Recarga tu billetera y compra al instante sin ingresar tu tarjeta cada vez.</p>
                  </div>
                </div>
                <Link to="/wallet" className="block mt-3">
                  <Button className="w-full sm:w-auto gap-2">
                    <Wallet className="w-4 h-4" />
                    Recargar ahora
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
                    >
                      <div className="relative aspect-video bg-gradient-to-br from-premium/10 to-primary/10">
                        {recording.thumbnailUrl ? (
                          <img
                            src={recording.thumbnailUrl}
                            alt={recording.title}
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : null}
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
                          <span className="truncate">{recording.doctorName}</span>
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
                                  <Crown className="w-3 h-3 text-yellow-500" />
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
                  {contentFilter !== 'all' || selectedSpecialty !== 'Todas' ? t('ads.noRecordingsFilters') : t('recordings.noRecordings')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t('common.noResults')}
                </p>
                {(contentFilter !== 'all' || selectedSpecialty !== 'Todas') && (
                  <Button variant="outline" className="mt-3" onClick={() => { setContentFilter('all'); setSelectedSpecialty('Todas'); }}>
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
    </MainLayout>
  );
}
