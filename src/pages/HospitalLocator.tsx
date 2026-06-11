import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useFeaturedListings } from '@/hooks/useFeaturedListings';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import {
  Building2, MapPin, Phone, Globe, Clock, Star, Navigation, Search, Loader2,
  ChevronDown, ChevronUp, MessageSquare, Sparkles, SlidersHorizontal, X, ArrowUpDown,
  ExternalLink, Heart
} from 'lucide-react';
import HospitalDoctorsList from '@/components/hospitals/HospitalDoctorsList';

const ZONES = ['Centro', 'Norte', 'Sur', 'Poniente', 'Oriente'];

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(d: number) {
  return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
}

type SortMode = 'distance' | 'rating' | 'name';

export default function HospitalLocator() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const es = language === 'es';
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('private');
  const [filterZone, setFilterZone] = useState('all');
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [filterMinRating, setFilterMinRating] = useState(0);
  const [filterMaxDist, setFilterMaxDist] = useState(100);
  const [sortMode, setSortMode] = useState<SortMode>('distance');
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewDialog, setReviewDialog] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeDoctorsCount, setActiveDoctorsCount] = useState<number>(0);
  const { featuredIds, featuredMap, trackImpression, trackClick } = useFeaturedListings('hospital');
  const impressionTrackerRef = useRef(new Set());

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLoc({ lat: 19.4326, lng: -99.1332 })
    );
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: h }, { data: r }, { count: docCount }] = await Promise.all([
        supabase.from('hospitals').select('*').eq('is_active', true).in('type', ['private', 'clinic']).order('name'),
        supabase.from('hospital_reviews').select('*'),
        supabase.from('doctor_profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      ]);
      const hospData = h || [];
      const revData = r || [];
      const revMap: Record<string, any[]> = {};
      revData.forEach(rev => {
        if (!revMap[rev.hospital_id]) revMap[rev.hospital_id] = [];
        revMap[rev.hospital_id].push(rev);
      });
      setReviews(revMap);
      setActiveDoctorsCount(docCount || 0);
      setHospitals(hospData.map(hosp => ({
        ...hosp,
        specialties: (Array.isArray(hosp.specialties) ? hosp.specialties : [])
          .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
          .filter((s: string) => !/^https?:\/\//i.test(s.trim()))
          .filter((s: string) => !/\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)(\?|$)/i.test(s.trim())),
        avg_rating: revMap[hosp.id] ? revMap[hosp.id].reduce((a, rv) => a + rv.rating, 0) / revMap[hosp.id].length : 0,
        review_count: revMap[hosp.id]?.length || 0,
      })));
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (loading) return;
    hospitals.forEach(h => {
      if (featuredIds.has(h.id) && !impressionTrackerRef.current.has(h.id)) {
        impressionTrackerRef.current.add(h.id);
        trackImpression(h.id);
      }
    });
  }, [hospitals, featuredIds, loading, trackImpression]);

  // Collect all specialties
  const allSpecialties = useMemo(() => {
    const set = new Set<string>();
    hospitals.forEach(h => h.specialties?.forEach((s: string) => set.add(s)));
    return Array.from(set).sort();
  }, [hospitals]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterType !== 'all') c++;
    if (filterZone !== 'all') c++;
    if (filterSpecialty !== 'all') c++;
    if (filterMinRating > 0) c++;
    if (filterMaxDist < 100) c++;
    return c;
  }, [filterType, filterZone, filterSpecialty, filterMinRating, filterMaxDist]);

  const clearFilters = () => {
    setFilterType('all');
    setFilterZone('all');
    setFilterSpecialty('all');
    setFilterMinRating(0);
    setFilterMaxDist(100);
    setSearch('');
  };

  const handleSubmitReview = async () => {
    if (!user || !reviewDialog) return;
    setSubmitting(true);
    const { error } = await supabase.from('hospital_reviews').insert({
      hospital_id: reviewDialog, user_id: user.id, rating: reviewForm.rating, comment: reviewForm.comment || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(t('autoI18n.hospitalLoc1'));
      const { data: r } = await supabase.from('hospital_reviews').select('*');
      const revData = r || [];
      const revMap: Record<string, any[]> = {};
      revData.forEach(rev => {
        if (!revMap[rev.hospital_id]) revMap[rev.hospital_id] = [];
        revMap[rev.hospital_id].push(rev);
      });
      setReviews(revMap);
      setHospitals(prev => prev.map(hp => ({
        ...hp,
        avg_rating: revMap[hp.id] ? revMap[hp.id].reduce((a, rv) => a + rv.rating, 0) / revMap[hp.id].length : 0,
        review_count: revMap[hp.id]?.length || 0,
      })));
    }
    setSubmitting(false);
    setReviewDialog(null);
    setReviewForm({ rating: 5, comment: '' });
  };

  const filtered = useMemo(() => {
    return hospitals.filter(h => {
      if (filterType !== 'all' && h.type !== filterType) return false;
      if (filterZone !== 'all' && h.zone !== filterZone) return false;
      if (filterSpecialty !== 'all' && !h.specialties.some((s: string) => s.toLowerCase() === filterSpecialty.toLowerCase())) return false;
      if (filterMinRating > 0 && h.avg_rating < filterMinRating) return false;
      if (filterMaxDist < 100 && userLoc && h.lat && h.lng) {
        const d = getDistance(userLoc.lat, userLoc.lng, h.lat, h.lng);
        if (d > filterMaxDist) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        return h.name.toLowerCase().includes(s) || h.address.toLowerCase().includes(s) || h.specialties.some((sp: string) => sp.toLowerCase().includes(s));
      }
      return true;
    }).sort((a, b) => {
      const aF = featuredIds.has(a.id) ? (featuredMap[a.id]?.priority || 1) : 0;
      const bF = featuredIds.has(b.id) ? (featuredMap[b.id]?.priority || 1) : 0;
      if (aF !== bF) return bF - aF;
      if (sortMode === 'rating') return b.avg_rating - a.avg_rating;
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      if (userLoc && a.lat && a.lng && b.lat && b.lng)
        return getDistance(userLoc.lat, userLoc.lng, a.lat, a.lng) - getDistance(userLoc.lat, userLoc.lng, b.lat, b.lng);
      return 0;
    });
  }, [hospitals, filterType, filterZone, filterSpecialty, filterMinRating, filterMaxDist, search, sortMode, featuredIds, featuredMap, userLoc]);

  const handleCardClick = (h: any) => {
    if (featuredIds.has(h.id)) trackClick(h.id);
    setExpandedId(expandedId === h.id ? null : h.id);
  };

  // Solo hospitales privados de México
  const FilterPanel = () => (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{t('autoI18n.hospitalLoc2')}</p>
        <div className="px-3 py-2 rounded-lg bg-secondary/10 border border-secondary/30 flex items-center gap-2">
          <span aria-hidden>🏨</span>
          <span className="text-sm font-medium text-secondary">{t('autoI18n.hospitalLoc3')}</span>
        </div>
      </div>

      <hr className="border-border/50" />

      {/* Specialty */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{t('autoI18n.hospitalLoc4')}</p>
        <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t('autoI18n.hospitalLoc5')} /></SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="all">{t('autoI18n.hospitalLoc6')}</SelectItem>
            {allSpecialties.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <hr className="border-border/50" />

      {/* Zone */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{t('autoI18n.hospitalLoc7')}</p>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilterZone('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${filterZone === 'all' ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-offset-1 ring-primary/20' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}>
            {t('autoI18n.hospitalLoc8')}
          </button>
          {ZONES.map(z => (
            <button key={z} onClick={() => setFilterZone(z)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${filterZone === z ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-offset-1 ring-primary/20' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}>
              {z}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-border/50" />

      {/* Min rating */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{t('autoI18n.hospitalLoc9')}</p>
        <div className="grid grid-cols-5 gap-1.5">
          {[0, 3, 3.5, 4, 4.5].map(r => (
            <button key={r} onClick={() => setFilterMinRating(r)} className={`py-2 rounded-lg text-xs font-medium transition-all duration-200 text-center ${filterMinRating === r ? 'bg-secondary/15 text-secondary border-2 border-secondary shadow-sm ring-1 ring-secondary/30' : 'bg-muted/60 text-muted-foreground hover:bg-muted border border-transparent'}`}>
              {r === 0 ? t('autoI18n.hospitalLoc10') : `${r}+`}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-border/50" />

      {/* Max distance */}
      {userLoc && (
        <>
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('autoI18n.hospitalLoc11')}</p>
              <span className="text-xs font-semibold text-primary">{filterMaxDist < 100 ? `${filterMaxDist} km` : t('autoI18n.hospitalLoc12')}</span>
            </div>
            <Slider value={[filterMaxDist]} onValueChange={([v]) => setFilterMaxDist(v)} min={1} max={100} step={1} className="py-2" />
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1 px-0.5">
              <span>1 km</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>
          <hr className="border-border/50" />
        </>
      )}

      {/* Sort */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{t('autoI18n.hospitalLoc13')}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { value: 'distance', label: t('autoI18n.hospitalLoc14'), icon: <Navigation className="w-3.5 h-3.5" /> },
            { value: 'rating', label: t('autoI18n.hospitalLoc15'), icon: <Star className="w-3.5 h-3.5" /> },
            { value: 'name', label: t('autoI18n.hospitalLoc16'), icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
          ] as { value: SortMode; label: string; icon: React.ReactNode }[]).map(s => (
            <button key={s.value} onClick={() => setSortMode(s.value)} className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${sortMode === s.value ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-offset-1 ring-primary/20' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}>
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <>
          <hr className="border-border/50" />
          <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10">
            <X className="w-3.5 h-3.5" /> {t('autoI18n.hospitalLoc17')} ({activeFilterCount})
          </Button>
        </>
      )}
    </div>
  );

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Hero */}
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10 p-5 sm:p-8 border border-primary/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{t('autoI18n.hospitalLoc18')}</h1>
              <p className="text-sm text-muted-foreground">{t('autoI18n.hospitalLoc19')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="mm-stat-pill"><Building2 className="w-3.5 h-3.5 text-primary" />{hospitals.length} {t('autoI18n.hospitalLoc20')}</span>
            <span className="mm-stat-pill"><Star className="w-3.5 h-3.5 text-secondary" />{t('autoI18n.hospitalLoc21')}</span>
            {userLoc && <span className="mm-stat-pill"><Navigation className="w-3.5 h-3.5 text-primary" />{t('autoI18n.hospitalLoc22')}</span>}
            <span className="mm-stat-pill"><Heart className="w-3.5 h-3.5 text-accent" />{activeDoctorsCount} {t('autoI18n.hospitalLoc23')}</span>
          </div>
        </div>

        {/* Search + Filter bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('autoI18n.hospitalLoc24')}
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 h-11 bg-white dark:bg-card border-2 border-primary/30 shadow-md focus-visible:ring-primary/40 focus-visible:border-primary placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Mobile: Sheet trigger */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 relative sm:hidden flex-shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center">{activeFilterCount}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
              <SheetHeader><SheetTitle>{t('autoI18n.hospitalLoc25')}</SheetTitle></SheetHeader>
              <div className="mt-4 overflow-y-auto max-h-[calc(85vh-80px)] pb-6">
                <FilterPanel />
              </div>
              <div className="pt-3 border-t">
                <Button onClick={() => setFiltersOpen(false)} className="w-full">
                  {t('autoI18n.hospitalLoc26').replace('{count}', String(filtered.length))}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop: Sort inline (filtros hardcodeados a Privado · México) */}
        <div className="hidden sm:flex items-center justify-between gap-3 mb-4">
          <div className="flex gap-2 flex-wrap">
            <span className="mm-chip mm-chip-active bg-secondary/15 text-secondary">
              {t('autoI18n.hospitalLoc27')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="h-8 w-36 text-xs"><ArrowUpDown className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="distance">{t('autoI18n.hospitalLoc28')}</SelectItem>
                <SelectItem value="rating">{t('autoI18n.hospitalLoc29')}</SelectItem>
                <SelectItem value="name">{t('autoI18n.hospitalLoc30')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile: active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 sm:hidden">
            {filterZone !== 'all' && (
              <Badge variant="secondary" className="text-[10px] gap-1 flex-shrink-0 cursor-pointer" onClick={() => setFilterZone('all')}>
                {filterZone} <X className="w-2.5 h-2.5" />
              </Badge>
            )}
            {filterSpecialty !== 'all' && (
              <Badge variant="secondary" className="text-[10px] gap-1 flex-shrink-0 cursor-pointer" onClick={() => setFilterSpecialty('all')}>
                {filterSpecialty} <X className="w-2.5 h-2.5" />
              </Badge>
            )}
            {filterMinRating > 0 && (
              <Badge variant="secondary" className="text-[10px] gap-1 flex-shrink-0 cursor-pointer" onClick={() => setFilterMinRating(0)}>
                {filterMinRating}+ ⭐ <X className="w-2.5 h-2.5" />
              </Badge>
            )}
            {filterMaxDist < 100 && (
              <Badge variant="secondary" className="text-[10px] gap-1 flex-shrink-0 cursor-pointer" onClick={() => setFilterMaxDist(100)}>
                ≤{filterMaxDist}km <X className="w-2.5 h-2.5" />
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden sm:block w-60 flex-shrink-0 sticky top-20 self-start">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                {t('autoI18n.hospitalLoc31')}
              </h3>
              <FilterPanel />
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Results count */}
            <p className="text-xs text-muted-foreground mb-3">
              {(filtered.length === 1 ? t('autoI18n.hospitalLoc32') : t('autoI18n.hospitalLoc33')).replace('{count}', String(filtered.length))}
            </p>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{t('autoI18n.hospitalLoc34')}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Building2 className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t('autoI18n.hospitalLoc35')}</p>
                {activeFilterCount > 0 && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs gap-1">
                    <X className="w-3.5 h-3.5" /> {t('autoI18n.hospitalLoc36')}
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filtered.map((h, idx) => {
                  const dist = userLoc && h.lat && h.lng ? getDistance(userLoc.lat, userLoc.lng, h.lat, h.lng) : null;
                  const expanded = expandedId === h.id;
                  const hospReviews = reviews[h.id] || [];
                  const isFeatured = featuredIds.has(h.id);
                  const featuredLabel = isFeatured ? (es ? featuredMap[h.id]?.label_es : featuredMap[h.id]?.label_en) : null;

                  return (
                    <Card
                      key={h.id}
                      className={`overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 group ${isFeatured ? 'ring-2 ring-accent/60 shadow-accent/20' : ''}`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      {/* Image */}
                      {h.image_url ? (
                        <div className="relative h-36 sm:h-44 overflow-hidden">
                          <img
                            src={h.image_url} alt={h.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                          {/* Overlays */}
                          <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm ${h.type === 'public' ? 'bg-primary/90 text-primary-foreground' : h.type === 'private' ? 'bg-secondary/90 text-secondary-foreground' : 'bg-accent/90 text-accent-foreground'}`}>
                              {h.type === 'public' ? t('autoI18n.hospitalLoc37') : h.type === 'private' ? t('autoI18n.hospitalLoc38') : t('autoI18n.hospitalLoc39')}
                            </span>
                          </div>
                          {isFeatured && (
                            <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-accent/90 text-accent-foreground backdrop-blur-sm flex items-center gap-1 shadow-lg">
                              <Sparkles className="w-3 h-3" /> {featuredLabel}
                            </span>
                          )}
                          <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
                            <h3 className="font-bold text-white text-sm sm:text-base leading-tight drop-shadow-lg line-clamp-2 flex-1 mr-2">{h.name}</h3>
                            {dist !== null && (
                              <span className="text-[10px] text-white/90 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 flex-shrink-0 flex items-center gap-1">
                                <Navigation className="w-3 h-3" /> {formatDist(dist)}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="relative px-4 pt-3 flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${h.type === 'public' ? 'bg-primary/10 text-primary' : h.type === 'private' ? 'bg-secondary/10 text-secondary' : 'bg-accent/15 text-accent'}`}>
                            {h.type === 'public' ? t('autoI18n.hospitalLoc40') : h.type === 'private' ? t('autoI18n.hospitalLoc41') : t('autoI18n.hospitalLoc42')}
                          </span>
                          {isFeatured && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-accent/15 text-accent flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> {featuredLabel}
                            </span>
                          )}
                        </div>
                      )}

                      <CardContent className="p-4">
                        {!h.image_url && (
                          <h3 className="font-semibold text-sm sm:text-base leading-tight mb-1.5">{h.name}</h3>
                        )}

                        {/* Rating + reviews */}
                        {h.avg_rating > 0 && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="flex">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} className={`w-3 h-3 ${s <= Math.round(h.avg_rating) ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                              ))}
                            </div>
                            <span className="text-xs font-semibold">{h.avg_rating.toFixed(1)}</span>
                            <span className="text-[10px] text-muted-foreground">({h.review_count} {t('autoI18n.hospitalLoc43')})</span>
                          </div>
                        )}

                        {/* Address */}
                        <p className="text-xs text-muted-foreground flex items-start gap-1.5 mb-2.5">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary/60" />
                          <span className="line-clamp-2">{h.address}</span>
                        </p>

                        {/* Specialties */}
                        {h.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {h.specialties.slice(0, 3).map((sp: string, i: number) => (
                              <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-primary/8 text-primary font-medium border border-primary/10">
                                {sp}
                              </span>
                            ))}
                            {h.specialties.length > 3 && (
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                +{h.specialties.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Info row */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                          {h.phone && (
                            <a href={`tel:${h.phone}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                              <Phone className="w-3 h-3" />{h.phone}
                            </a>
                          )}
                          {h.hours && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />{h.hours}
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          {h.lat && h.lng && (
                            <>
                              <Button size="sm" className="flex-1 text-xs gap-1.5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                                <a href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`} target="_blank" rel="noopener noreferrer">
                                  <Navigation className="w-3.5 h-3.5" /> Maps
                                </a>
                              </Button>
                              <Button size="sm" className="flex-1 text-xs gap-1.5 h-8 border border-secondary/30 text-secondary bg-secondary/10 hover:bg-secondary/20" asChild>
                                <a href={`https://www.waze.com/ul?ll=${h.lat},${h.lng}&navigate=yes`} target="_blank" rel="noopener noreferrer">
                                  <Navigation className="w-3.5 h-3.5" /> Waze
                                </a>
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm" variant="ghost"
                            className="text-xs gap-1 h-8 flex-shrink-0"
                            onClick={() => handleCardClick(h)}
                          >
                            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {t('autoI18n.hospitalLoc44')}
                          </Button>
                        </div>

                        {/* Expanded */}
                        {expanded && (
                          <div className="mt-3 pt-3 border-t border-border space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            {h.description && <p className="text-xs text-muted-foreground leading-relaxed">{h.description}</p>}
                            {h.level && <p className="text-xs"><span className="font-medium">{t('autoI18n.hospitalLoc45')}</span>{h.level}</p>}

                            {h.specialties.length > 0 && (
                              <div>
                                <p className="text-xs font-medium mb-1.5">{t('autoI18n.hospitalLoc46')}</p>
                                <div className="flex flex-wrap gap-1">
                                  {h.specialties.map((sp: string, i: number) => (
                                    <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                      {sp}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {h.website && (
                              <a href={h.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                                <Globe className="w-3.5 h-3.5" /> {t('autoI18n.hospitalLoc47')} <ExternalLink className="w-3 h-3" />
                              </a>
                            )}

                            {/* Reviews section */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium">{t('autoI18n.hospitalLoc48')} ({hospReviews.length})</p>
                                {user && (
                                  <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => setReviewDialog(h.id)}>
                                    <MessageSquare className="w-3 h-3" /> {t('autoI18n.hospitalLoc49')}
                                  </Button>
                                )}
                              </div>
                              {hospReviews.length === 0 && (
                                <p className="text-xs text-muted-foreground italic">{t('autoI18n.hospitalLoc50')}</p>
                              )}
                              {hospReviews.slice(0, 3).map(rv => (
                                <div key={rv.id} className="bg-muted/50 rounded-lg p-2.5 mb-1.5">
                                  <div className="flex items-center gap-1 mb-1">
                                    {[1,2,3,4,5].map(s => (
                                      <Star key={s} className={`w-3 h-3 ${s <= rv.rating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                                    ))}
                                    <span className="text-[10px] text-muted-foreground ml-1">
                                      {new Date(rv.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  {rv.comment && <p className="text-xs text-muted-foreground">{rv.comment}</p>}
                                </div>
                              ))}
                            </div>

                            {/* Doctors related to this hospital (by specialty overlap) */}
                            <HospitalDoctorsList
                              hospitalId={h.id}
                              hospitalName={h.name}
                              specialties={h.specialties || []}
                              zone={h.zone}
                              language={language}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Review Dialog */}
        <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{t('autoI18n.hospitalLoc51')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">{t('autoI18n.hospitalLoc52')}</p>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setReviewForm(f => ({ ...f, rating: s }))} className="p-1 transition-transform hover:scale-110">
                      <Star className={`w-7 h-7 ${s <= reviewForm.rating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                placeholder={t('autoI18n.hospitalLoc53')}
                value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                rows={3}
              />
              <Button onClick={handleSubmitReview} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('autoI18n.hospitalLoc54')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
