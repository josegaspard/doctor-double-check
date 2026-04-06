// @ts-nocheck
// Full rewrite: DB-driven hospital locator with reviews + featured
import React, { useState, useEffect, useRef } from 'react';
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
import { toast } from 'sonner';
import { Building2, MapPin, Phone, Globe, Clock, Star, Navigation, Search, Loader2, ChevronDown, ChevronUp, MessageSquare, Sparkles } from 'lucide-react';

const ZONES = ['Centro', 'Norte', 'Sur', 'Poniente', 'Oriente'];
function getDistance(lat1, lng1, lat2, lng2) { const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180; const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2; return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }

export default function HospitalLocator() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const es = language === 'es';
  const [hospitals, setHospitals] = useState([]);
  const [reviews, setReviews] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [userLoc, setUserLoc] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const { featuredIds, featuredMap, trackImpression, trackClick } = useFeaturedListings('hospital');
  const impressionTrackerRef = useRef(new Set());

  useEffect(() => { navigator.geolocation?.getCurrentPosition(pos => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => setUserLoc({ lat: 19.4326, lng: -99.1332 })); }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: h }, { data: r }] = await Promise.all([
        supabase.from('hospitals').select('*').eq('is_active', true).order('name'),
        supabase.from('hospital_reviews').select('*'),
      ]);
      const hospData = (h) || []; const revData = (r) || [];
      const revMap = {};
      revData.forEach(rev => { if (!revMap[rev.hospital_id]) revMap[rev.hospital_id] = []; revMap[rev.hospital_id].push(rev); });
      setReviews(revMap);
      setHospitals(hospData.map(hosp => ({ ...hosp, specialties: Array.isArray(hosp.specialties) ? hosp.specialties : [], avg_rating: revMap[hosp.id] ? revMap[hosp.id].reduce((a, rv) => a + rv.rating, 0) / revMap[hosp.id].length : 0, review_count: revMap[hosp.id]?.length || 0 })));
      setLoading(false);
    };
    fetchData();
  }, []);

  // Track impressions for visible featured hospitals
  useEffect(() => {
    if (loading) return;
    hospitals.forEach(h => {
      if (featuredIds.has(h.id) && !impressionTrackerRef.current.has(h.id)) {
        impressionTrackerRef.current.add(h.id);
        trackImpression(h.id);
      }
    });
  }, [hospitals, featuredIds, loading, trackImpression]);

  const handleSubmitReview = async () => {
    if (!user || !reviewDialog) return;
    setSubmitting(true);
    const { error } = await supabase.from('hospital_reviews').insert({ hospital_id: reviewDialog, user_id: user.id, rating: reviewForm.rating, comment: reviewForm.comment || null });
    if (error) toast.error(error.message);
    else {
      toast.success(es ? 'Reseña enviada' : 'Review submitted');
      const { data: r } = await supabase.from('hospital_reviews').select('*');
      const revData = (r) || []; const revMap = {};
      revData.forEach(rev => { if (!revMap[rev.hospital_id]) revMap[rev.hospital_id] = []; revMap[rev.hospital_id].push(rev); });
      setReviews(revMap);
      setHospitals(prev => prev.map(hp => ({ ...hp, avg_rating: revMap[hp.id] ? revMap[hp.id].reduce((a, rv) => a + rv.rating, 0) / revMap[hp.id].length : 0, review_count: revMap[hp.id]?.length || 0 })));
    }
    setSubmitting(false); setReviewDialog(null); setReviewForm({ rating: 5, comment: '' });
  };

  const filtered = hospitals.filter(h => {
    if (filterType !== 'all' && h.type !== filterType) return false;
    if (filterZone !== 'all' && h.zone !== filterZone) return false;
    if (search) { const s = search.toLowerCase(); return h.name.toLowerCase().includes(s) || h.address.toLowerCase().includes(s) || h.specialties.some(sp => sp.toLowerCase().includes(s)); }
    return true;
  }).sort((a, b) => {
    // Featured items first
    const aFeatured = featuredIds.has(a.id) ? (featuredMap[a.id]?.priority || 1) : 0;
    const bFeatured = featuredIds.has(b.id) ? (featuredMap[b.id]?.priority || 1) : 0;
    if (aFeatured !== bFeatured) return bFeatured - aFeatured;
    // Then by distance
    if (userLoc && a.lat && a.lng && b.lat && b.lng) return getDistance(userLoc.lat, userLoc.lng, a.lat, a.lng) - getDistance(userLoc.lat, userLoc.lng, b.lat, b.lng);
    return 0;
  });

  const handleCardClick = (h) => {
    if (featuredIds.has(h.id)) trackClick(h.id);
    setExpandedId(expandedId === h.id ? null : h.id);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center"><Building2 className="w-6 h-6 text-primary" /></div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{es ? 'Localiza un Hospital' : 'Find a Hospital'}</h1>
              <p className="text-sm text-muted-foreground">{es ? 'Directorio de hospitales y clínicas en México' : 'Hospital & clinic directory in Mexico'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{hospitals.length} {es ? 'hospitales' : 'hospitals'}</span>
            <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-500" />{es ? 'Información verificada' : 'Verified info'}</span>
            <span className="flex items-center gap-1"><Navigation className="w-3.5 h-3.5" />{es ? 'Ubicación activa' : 'Location active'}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder={es ? 'Buscar por nombre, dirección o especialidad...' : 'Search by name, address or specialty...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
          <Select value={filterType} onValueChange={setFilterType}><SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{es ? 'Todos' : 'All'}</SelectItem><SelectItem value="public">{es ? 'Público' : 'Public'}</SelectItem><SelectItem value="private">{es ? 'Privado' : 'Private'}</SelectItem><SelectItem value="clinic">{es ? 'Clínica' : 'Clinic'}</SelectItem></SelectContent></Select>
          <Select value={filterZone} onValueChange={setFilterZone}><SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{es ? 'Todas las zonas' : 'All zones'}</SelectItem>{ZONES.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent></Select>
        </div>

        {loading ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map(h => {
              const dist = userLoc && h.lat && h.lng ? getDistance(userLoc.lat, userLoc.lng, h.lat, h.lng) : null;
              const expanded = expandedId === h.id;
              const hospReviews = reviews[h.id] || [];
              const isFeatured = featuredIds.has(h.id);
              const featuredLabel = isFeatured ? (es ? featuredMap[h.id]?.label_es : featuredMap[h.id]?.label_en) : null;
              return (
                <Card key={h.id} className={`overflow-hidden hover:shadow-lg transition-shadow ${isFeatured ? 'ring-2 ring-yellow-400/60 shadow-yellow-100/50' : ''}`}>
                  {h.image_url && (
                    <div className="relative h-40 sm:h-48 overflow-hidden">
                      <img src={h.image_url} alt={h.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                        <Badge variant="secondary" className="text-[10px] bg-background/90 backdrop-blur">{h.type === 'public' ? (es ? '🏥 Público' : '🏥 Public') : h.type === 'private' ? (es ? '🏨 Privado' : '🏨 Private') : (es ? '🏥 Clínica' : '🏥 Clinic')}</Badge>
                        {dist !== null && <span className="text-[10px] text-white font-medium">{dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)} km`}</span>}
                      </div>
                      {isFeatured && (
                        <Badge className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[9px] gap-1 shadow-lg">
                          <Sparkles className="w-3 h-3" /> {featuredLabel}
                        </Badge>
                      )}
                    </div>
                  )}
                  {!h.image_url && isFeatured && (
                    <Badge className="mx-4 mt-3 bg-yellow-400 text-yellow-900 text-[9px] gap-1 w-fit">
                      <Sparkles className="w-3 h-3" /> {featuredLabel}
                    </Badge>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm sm:text-base leading-tight">{h.name}</h3>
                      {h.avg_rating > 0 && (<div className="flex items-center gap-1 flex-shrink-0"><Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" /><span className="text-xs font-medium">{h.avg_rating.toFixed(1)}</span><span className="text-[10px] text-muted-foreground">({h.review_count})</span></div>)}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-start gap-1 mb-2"><MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />{h.address}</p>
                    <div className="flex flex-wrap gap-1 mb-3">{h.specialties.slice(0, 4).map((sp, i) => <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0">{sp}</Badge>)}{h.specialties.length > 4 && <Badge variant="outline" className="text-[9px] px-1.5 py-0">+{h.specialties.length - 4}</Badge>}</div>
                    <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground mb-3">{h.phone && <a href={`tel:${h.phone}`} className="flex items-center gap-1 hover:text-primary transition-colors"><Phone className="w-3 h-3" />{h.phone}</a>}{h.hours && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{h.hours}</span>}</div>
                    <div className="flex gap-2 mb-2">{h.lat && h.lng && (<><Button size="sm" variant="default" className="flex-1 text-xs gap-1" asChild><a href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`} target="_blank" rel="noopener noreferrer"><Navigation className="w-3.5 h-3.5" /> Google Maps</a></Button><Button size="sm" variant="outline" className="flex-1 text-xs gap-1" asChild><a href={`https://www.waze.com/ul?ll=${h.lat},${h.lng}&navigate=yes`} target="_blank" rel="noopener noreferrer"><Navigation className="w-3.5 h-3.5" /> Waze</a></Button></>)}</div>
                    <div className="flex gap-2">{h.website && <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1" asChild><a href={h.website} target="_blank" rel="noopener noreferrer"><Globe className="w-3.5 h-3.5" />{es ? 'Sitio web' : 'Website'}</a></Button>}<Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => handleCardClick(h)}>{expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}{es ? 'Detalles' : 'Details'}</Button></div>
                    {expanded && (<div className="mt-3 pt-3 border-t border-border space-y-3">{h.description && <p className="text-xs text-muted-foreground">{h.description}</p>}{h.level && <p className="text-xs"><span className="font-medium">{es ? 'Nivel: ' : 'Level: '}</span>{h.level}</p>}{h.specialties.length > 0 && <div><p className="text-xs font-medium mb-1">{es ? 'Especialidades:' : 'Specialties:'}</p><div className="flex flex-wrap gap-1">{h.specialties.map((sp, i) => <Badge key={i} variant="secondary" className="text-[9px]">{sp}</Badge>)}</div></div>}<div><div className="flex items-center justify-between mb-2"><p className="text-xs font-medium">{es ? 'Reseñas' : 'Reviews'} ({hospReviews.length})</p>{user && <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => setReviewDialog(h.id)}><MessageSquare className="w-3 h-3" />{es ? 'Escribir' : 'Write'}</Button>}</div>{hospReviews.slice(0, 3).map(rv => <div key={rv.id} className="bg-muted/50 rounded-lg p-2 mb-1.5"><div className="flex items-center gap-1 mb-1">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= rv.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />)}<span className="text-[10px] text-muted-foreground ml-1">{new Date(rv.created_at).toLocaleDateString()}</span></div>{rv.comment && <p className="text-xs text-muted-foreground">{rv.comment}</p>}</div>)}</div></div>)}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        {!loading && filtered.length === 0 && <p className="text-center text-muted-foreground py-12">{es ? 'No se encontraron hospitales' : 'No hospitals found'}</p>}

        <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{es ? 'Escribir Reseña' : 'Write Review'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><p className="text-sm font-medium mb-1">{es ? 'Calificación' : 'Rating'}</p><div className="flex gap-1">{[1,2,3,4,5].map(s => <button key={s} onClick={() => setReviewForm(f => ({ ...f, rating: s }))} className="p-0.5"><Star className={`w-6 h-6 ${s <= reviewForm.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} /></button>)}</div></div>
              <Textarea placeholder={es ? 'Tu opinión (opcional)...' : 'Your review (optional)...'} value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))} rows={3} />
              <Button onClick={handleSubmitReview} disabled={submitting} className="w-full">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (es ? 'Enviar Reseña' : 'Submit Review')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
