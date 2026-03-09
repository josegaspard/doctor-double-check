import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLives, Recording } from '@/contexts/LivesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
} from 'lucide-react';

type ContentFilter = 'all' | 'free' | 'paid' | 'purchased' | 'not_purchased';

export default function RecordingsGrid() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const doctorFilter = searchParams.get('doctor');
  const { recordings } = useLives();
  const { user, role, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const { balance } = useWallet();
  const { hasPurchased, purchaseWithWallet, isPurchasing } = usePurchases();
  const { getEffectiveRecordingPrice, hasPremiumTo } = useSubscriptions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');

  useEffect(() => {
    if (!doctorFilter) { setDoctorName(null); return; }
    const fetchName = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', doctorFilter)
        .single();
      setDoctorName(data?.name || null);
    };
    fetchName();
  }, [doctorFilter]);

  const specialties = [...new Set(recordings.map(r => r.specialty))];

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
    
    if (!matchesSearch || !matchesSpecialty || !matchesDoctor) return false;
    
    const owned = ownsRecording(rec);
    switch (contentFilter) {
      case 'free': return rec.price === 0;
      case 'paid': return rec.price > 0;
      case 'purchased': return owned;
      case 'not_purchased': return !owned && rec.price > 0;
      default: return true;
    }
  });

  const handleRecordingClick = (recording: Recording) => {
    if (!isAuthenticated || role === 'visitor') {
      navigate('/login');
      return;
    }
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
    { key: 'all', label: 'Todo', icon: <Library className="w-3.5 h-3.5" /> },
    { key: 'free', label: 'Gratis', icon: <Gift className="w-3.5 h-3.5" /> },
    { key: 'paid', label: 'De Pago', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { key: 'purchased', label: 'Comprados', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { key: 'not_purchased', label: 'Sin Comprar', icon: <Lock className="w-3.5 h-3.5" /> },
  ];

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <PlayCircle className="w-5 h-5 sm:w-6 sm:h-6 text-premium" />
              {doctorName ? `${t('recordings.recordingsOf')} ${doctorName}` : t('recordings.premiumContent')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {filteredRecordings.length} {t('recordings.title').toLowerCase()}
              {doctorFilter && (
                <Button variant="link" size="sm" className="ml-2 p-0 h-auto text-xs" onClick={() => navigate('/recordings')}>
                  {t('recordings.viewAll')}
                </Button>
              )}
            </p>
          </div>
          
          {isAuthenticated && (role === 'patient' || role === 'resident') && (
            <Link to="/wallet">
              <Button variant="outline" className="gap-2">
                <Wallet className="w-4 h-4" />
                {t('wallet.balance')}: ${balance.toLocaleString()}
              </Button>
            </Link>
          )}
        </div>

        {/* Content filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x mb-3">
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

        {/* Specialty filter chips */}
        {specialties.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x mb-3">
            <button
              onClick={() => setSelectedSpecialty(null)}
              className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                !selectedSpecialty
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-muted/50 text-muted-foreground border-border hover:border-accent/50'
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
                    ? 'bg-accent text-accent-foreground border-accent'
                    : 'bg-muted/50 text-muted-foreground border-border hover:border-accent/50'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
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
                    
                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                      {owned ? (
                        <Badge className="gap-1 bg-success/90 text-white border-0">
                          <CheckCircle className="w-3 h-3" />
                          {isFree ? 'Gratis' : 'Comprado'}
                        </Badge>
                      ) : isFree ? (
                        <Badge className="gap-1 bg-success/90 text-white border-0">
                          <Gift className="w-3 h-3" />
                          Gratis
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="w-3 h-3" />
                          De Pago
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
                        <span>{recording.peakViewers.toLocaleString()} espectadores</span>
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
              {contentFilter !== 'all' || selectedSpecialty ? 'No hay grabaciones con estos filtros' : t('recordings.noRecordings')}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t('common.noResults')}
            </p>
            {(contentFilter !== 'all' || selectedSpecialty) && (
              <Button variant="outline" className="mt-3" onClick={() => { setContentFilter('all'); setSelectedSpecialty(null); }}>
                Quitar filtros
              </Button>
            )}
          </Card>
        )}
      </div>

      <PaywallModal
        open={showPaywall}
        onClose={() => {
          setShowPaywall(false);
          setSelectedRecording(null);
        }}
        recording={selectedRecording as any}
        onPurchase={handlePurchase}
        isPurchasing={isPurchasing}
        canAfford={canAffordSelected}
        balance={balance}
      />
    </MainLayout>
  );
}
