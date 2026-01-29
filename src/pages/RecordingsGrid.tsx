import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLives, Recording } from '@/contexts/LivesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import { supabase } from '@/integrations/supabase/client';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import MainLayout from '@/components/layout/MainLayout';
import PaywallModal from '@/components/PaywallModal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  PlayCircle, 
  Clock, 
  Search,
  Filter,
  Lock,
  CheckCircle,
  Wallet,
  Crown,
} from 'lucide-react';

export default function RecordingsGrid() {
  const navigate = useNavigate();
  const { recordings } = useLives();
  const { user, role, isAuthenticated, supabaseUser } = useAuth();
  const { t } = useLanguage();
  const { balance, canAfford, purchase, refreshWallet } = useWallet();
  const { getEffectiveRecordingPrice, hasPremiumTo } = useSubscriptions();
  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());

  // Fetch user's purchases
  const fetchPurchases = useCallback(async () => {
    if (!supabaseUser?.id) {
      setPurchasedIds(new Set());
      return;
    }

    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('recording_id')
        .eq('user_id', supabaseUser.id);

      if (error) throw error;

      setPurchasedIds(new Set(data?.map(p => p.recording_id) || []));
    } catch (error) {
      console.error('Error fetching purchases:', error);
    }
  }, [supabaseUser?.id]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  // Block visitors completely
  if (!isAuthenticated || role === 'visitor') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-premium/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-premium" />
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">
              {t('recordings.premiumContent')}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t('lives.registerPrompt')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/login')}>
                {t('nav.login')}
              </Button>
              <Button variant="outline" onClick={() => navigate('/lives')}>
                {t('chat.goToLives')}
              </Button>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Get unique specialties
  const specialties = [...new Set(recordings.map(r => r.specialty))];

  // Filter recordings
  const filteredRecordings = recordings.filter(rec => {
    const matchesSearch = rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rec.doctorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialty = specialtyFilter === 'all' || rec.specialty === specialtyFilter;
    return matchesSearch && matchesSpecialty;
  });

  // Check if user owns recording or has free access
  const ownsRecording = (recording: Recording): boolean => {
    if (!user) return false;
    if (role === 'admin' || role === 'doctor') return true;
    // Free recordings are accessible to all authenticated users
    if (recording.price === 0) return true;
    return purchasedIds.has(recording.id);
  };

  const handleRecordingClick = (recording: Recording) => {
    if (ownsRecording(recording)) {
      navigate(`/recording/${recording.id}`);
    } else {
      setSelectedRecording(recording);
      setShowPaywall(true);
    }
  };

  const handlePurchase = async () => {
    if (!selectedRecording || !supabaseUser?.id) return;
    
    setIsPurchasing(true);
    
    try {
      // Use the edge function that handles everything atomically
      const { data, error } = await supabase.functions.invoke('purchase-recording-wallet', {
        body: { recordingId: selectedRecording.id },
      });

      if (error) throw error;

      if (data?.alreadyPurchased) {
        setShowPaywall(false);
        navigate(`/recording/${selectedRecording.id}`);
        return;
      }

      if (data?.success) {
        // Refresh purchases and wallet
        await Promise.all([fetchPurchases(), refreshWallet()]);
        setShowPaywall(false);
        setSelectedRecording(null);
        navigate(`/recording/${selectedRecording.id}`);
      } else {
        throw new Error(data?.error || 'Error en la compra');
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
    } finally {
      setIsPurchasing(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <PlayCircle className="w-6 h-6 text-premium" />
              {t('recordings.premiumContent')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {recordings.length} {t('recordings.title').toLowerCase()}
            </p>
          </div>
          
          {(role === 'patient' || role === 'resident') && (
            <Link to="/wallet">
              <Button variant="outline" className="gap-2">
                <Wallet className="w-4 h-4" />
                {t('wallet.balance')}: ${balance.toLocaleString()}
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder={t('recordings.specialty')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('recordings.allSpecialties')}</SelectItem>
              {specialties.map(spec => (
                <SelectItem key={spec} value={spec}>{spec}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Recordings Grid */}
        {filteredRecordings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRecordings.map((recording) => {
              const owned = ownsRecording(recording);
              
              return (
                <Card
                  key={recording.id}
                  className={`group cursor-pointer overflow-hidden hover:shadow-lg transition-all ${
                    owned ? 'border-success/30' : 'card-premium'
                  }`}
                  onClick={() => handleRecordingClick(recording)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gradient-to-br from-premium/10 to-primary/10">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PlayCircle className="w-12 h-12 text-premium/40" />
                    </div>
                    
                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                      {owned ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {t('recordings.purchased')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="w-3 h-3" />
                          {t('recordings.premiumContent')}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Duration */}
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="secondary" className="gap-1 bg-black/50 text-white border-0">
                        <Clock className="w-3 h-3" />
                        {formatDuration(recording.duration)}
                      </Badge>
                    </div>
                    
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/0 group-hover:bg-white/90 flex items-center justify-center transition-colors">
                        <PlayCircle className="w-6 h-6 text-premium opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                      {recording.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                          {recording.doctorName.charAt(0)}
                        </span>
                      </div>
                      <span className="truncate">{recording.doctorName}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {recording.specialty}
                      </Badge>
                      {!owned && (
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
          <Card className="p-12 text-center">
            <PlayCircle className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('recordings.noRecordings')}
            </h3>
            <p className="text-muted-foreground">
              {t('common.noResults')}
            </p>
          </Card>
        )}
      </div>

      {/* Paywall Modal */}
      <PaywallModal
        open={showPaywall}
        onClose={() => {
          setShowPaywall(false);
          setSelectedRecording(null);
        }}
        recording={selectedRecording as any}
        onPurchase={handlePurchase}
        isPurchasing={isPurchasing}
        canAfford={selectedRecording ? canAfford(selectedRecording.price) : false}
        balance={balance}
      />
    </MainLayout>
  );
}
