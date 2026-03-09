import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ContentPreviewModal } from '@/components/content/ContentPreviewModal';
import {
  FileText,
  Image as ImageIcon,
  Video,
  Search,
  Filter,
  Clock,
  Users,
  Stethoscope,
  Globe,
  Loader2,
  Library,
  User,
  Crown,
  Lock,
  ShoppingBag,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { usePurchases } from '@/hooks/usePurchases';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

/** Generate a data-URL thumbnail from the first second of a video */
function generateVideoThumbnail(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) { cleanup(); return reject('No canvas context'); }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => { cleanup(); reject('Video load error'); };

    // Timeout after 8s
    setTimeout(() => { cleanup(); reject('Timeout'); }, 8000);

    video.src = videoUrl;
  });
}

interface DoctorContent {
  id: string;
  title: string;
  description: string | null;
  type: 'video' | 'pdf' | 'image';
  file_url: string;
  thumbnail_url: string | null;
  is_public: boolean;
  price: number;
  audience_type: 'all' | 'patients' | 'professionals' | 'subscribers';
  category: string | null;
  created_at: string;
  creator_id: string;
  creator_name?: string;
  creator_avatar?: string;
  creator_specialty?: string;
}

// --- Extracted sub-components ---

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  video: { icon: Video, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Video' },
  pdf: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'PDF' },
  image: { icon: ImageIcon, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Imagen' },
};

function ContentCardThumbnail({
  content,
  thumbUrl,
  locked,
  t,
}: {
  content: DoctorContent;
  thumbUrl: string | null;
  locked: boolean;
  t: any;
}) {
  const config = typeConfig[content.type] || typeConfig.pdf;
  const TypeIcon = config.icon;

  return (
    <div className="relative aspect-video bg-muted/40 overflow-hidden">
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={content.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
          <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center`}>
            <TypeIcon className={`w-6 h-6 ${config.color}`} />
          </div>
          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
        </div>
      )}

      {/* Type badge - always green bg with white text */}
      <div className="absolute top-2 left-2">
        <Badge className="gap-1 capitalize text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0">
          <TypeIcon className="w-3 h-3" />
          {config.label}
        </Badge>
      </div>

      {/* Price badge */}
      {content.price > 0 && (
        <div className="absolute bottom-2 left-2">
          <Badge className="gap-1 text-xs bg-primary text-primary-foreground">
            <DollarSign className="w-3 h-3" />${content.price}
          </Badge>
        </div>
      )}

      {/* Audience badge */}
      {content.audience_type !== 'all' && (
        <div className="absolute top-2 right-2">
          <Badge
            variant={content.audience_type === 'subscribers' ? 'default' : 'outline'}
            className={
              content.audience_type === 'subscribers'
                ? 'bg-warning text-warning-foreground gap-1 text-xs'
                : 'bg-background/70 backdrop-blur-sm text-xs'
            }
          >
            {content.audience_type === 'subscribers' ? (
              <Crown className="w-3 h-3" />
            ) : content.audience_type === 'professionals' ? (
              <Stethoscope className="w-3 h-3" />
            ) : (
              <Users className="w-3 h-3" />
            )}
            <span className="ml-0.5">
              {content.audience_type === 'subscribers'
                ? t('subscribers.subscribersOnly')
                : content.audience_type === 'professionals'
                ? t('content.professionals')
                : t('content.patients')}
            </span>
          </Badge>
        </div>
      )}

      {/* Lock overlay */}
      {locked && (
        <div className="absolute inset-0 bg-background/60 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <Lock className="w-8 h-8 text-warning mx-auto mb-1" />
            <p className="text-xs font-medium text-foreground">{t('subscribers.subscribersOnly')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ContentCardBody({
  content,
  locale,
}: {
  content: DoctorContent;
  locale: typeof es;
}) {
  return (
    <CardContent className="p-4 space-y-2.5">
      <h3 className="font-semibold text-foreground line-clamp-2 text-sm leading-snug">
        {content.title}
      </h3>

      {content.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{content.description}</p>
      )}

      {/* Doctor info */}
      <div className="flex items-center gap-2">
        <Avatar className="w-6 h-6">
          <AvatarImage src={content.creator_avatar || undefined} />
          <AvatarFallback><User className="w-3 h-3" /></AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{content.creator_name}</p>
          {content.creator_specialty && (
            <p className="text-[11px] text-muted-foreground truncate">{content.creator_specialty}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {format(new Date(content.created_at), 'd MMM yyyy', { locale })}
        </span>
        {content.category && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {content.category}
          </Badge>
        )}
      </div>
    </CardContent>
  );
}

// --- Main page ---

export default function ContentGallery() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { getSubscription } = useSubscriptions();
  const { purchases } = usePurchases();
  const locale = language === 'es' ? es : enUS;

  const [contents, setContents] = useState<DoctorContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [previewContent, setPreviewContent] = useState<DoctorContent | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [contentTab, setContentTab] = useState('all');
  const [signedThumbs, setSignedThumbs] = useState<Record<string, string>>({});

  const fetchContents = useCallback(async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('doctor_content')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const creatorIds = [...new Set((data || []).map(c => c.creator_id))];

      const [{ data: profiles }, { data: doctorProfiles }] = await Promise.all([
        supabase.from('profiles_public').select('id, name, avatar_url').in('id', creatorIds),
        supabase.from('doctor_profiles_public').select('user_id, specialty').in('user_id', creatorIds),
      ]);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const specialtyMap = new Map(doctorProfiles?.map(d => [d.user_id, d.specialty]) || []);

      const uniqueCategories = [...new Set((data || []).map(c => c.category).filter(Boolean))] as string[];
      setCategories(uniqueCategories);

      const mapped: DoctorContent[] = (data || []).map(c => ({
        ...c,
        type: c.type as 'video' | 'pdf' | 'image',
        audience_type: c.audience_type as 'all' | 'patients' | 'professionals' | 'subscribers',
        creator_name: profileMap.get(c.creator_id)?.name,
        creator_avatar: profileMap.get(c.creator_id)?.avatar_url,
        creator_specialty: specialtyMap.get(c.creator_id),
      }));

      setContents(mapped);

      // Generate signed thumbnail URLs for content without a thumbnail_url (images and videos)
      const needThumb = mapped.filter(c => !c.thumbnail_url && !c.file_url.startsWith('http'));
      if (needThumb.length > 0) {
        const thumbResults = await Promise.all(
          needThumb.map(async c => {
            const { data: sd } = await supabase.storage
              .from('doctor-content')
              .createSignedUrl(c.file_url, 60 * 60);
            if (!sd?.signedUrl) return { id: c.id, url: null };

            // For videos, generate a thumbnail from the first second
            if (c.type === 'video') {
              try {
                const dataUrl = await generateVideoThumbnail(sd.signedUrl);
                return { id: c.id, url: dataUrl };
              } catch {
                return { id: c.id, url: null };
              }
            }
            return { id: c.id, url: sd.signedUrl };
          }),
        );
        const thumbMap: Record<string, string> = {};
        thumbResults.forEach(r => {
          if (r.url) thumbMap[r.id] = r.url;
        });
        setSignedThumbs(prev => ({ ...prev, ...thumbMap }));
      }
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  const canViewSubscriberContent = (content: DoctorContent) => {
    if (content.audience_type !== 'subscribers') return true;
    if (!user?.id) return false;
    if (content.creator_id === user.id) return true;
    const sub = getSubscription(content.creator_id);
    return sub && (sub.tier === 'basic' || sub.tier === 'premium');
  };

  const purchasedIds = new Set([
    ...(purchases?.map(p => p.recordingId) || []),
    ...(purchases?.filter(p => (p as any).contentId).map(p => (p as any).contentId) || []),
  ]);

  const filteredContents = contents.filter(content => {
    const matchesSearch =
      content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.creator_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || content.type === typeFilter;
    const matchesCategory = categoryFilter === 'all' || content.category === categoryFilter;
    const isPurchased = purchasedIds.has(content.id);

    if (contentTab === 'purchased') return matchesSearch && matchesType && matchesCategory && isPurchased;
    if (contentTab === 'new') return matchesSearch && matchesType && matchesCategory && !isPurchased;
    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Library className="w-6 h-6 text-primary" />
            {t('content.library')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('content.explore')}</p>
        </div>

        {/* Tabs */}
        <Tabs value={contentTab} onValueChange={setContentTab} className="mb-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex">
            <TabsTrigger value="all" className="gap-1.5 text-xs sm:text-sm">
              <Library className="w-3.5 h-3.5" />
              {language === 'es' ? 'Todo' : 'All'}
            </TabsTrigger>
            <TabsTrigger value="purchased" className="gap-1.5 text-xs sm:text-sm">
              <ShoppingBag className="w-3.5 h-3.5" />
              {language === 'es' ? 'Comprados' : 'Purchased'}
            </TabsTrigger>
            <TabsTrigger value="new" className="gap-1.5 text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5" />
              {language === 'es' ? 'Nuevos' : 'New'}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('inputs.searchByTitle')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        {/* Type filter chips */}
        <div className="mb-3">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-1">
              {[
                { value: 'all', label: language === 'es' ? 'Todos' : 'All', icon: Globe },
                { value: 'video', label: 'Videos', icon: Video },
                { value: 'pdf', label: 'PDFs', icon: FileText },
                { value: 'image', label: language === 'es' ? 'Imágenes' : 'Images', icon: ImageIcon },
              ].map(chip => {
                const active = typeFilter === chip.value;
                return (
                  <Button
                    key={chip.value}
                    variant={active ? 'default' : 'outline'}
                    size="sm"
                    className={`gap-1.5 rounded-full shrink-0 text-xs h-8 px-3.5 ${active ? '' : 'bg-muted/50 border-border/60 hover:bg-muted'}`}
                    onClick={() => setTypeFilter(chip.value)}
                  >
                    <chip.icon className="w-3.5 h-3.5" />
                    {chip.label}
                  </Button>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" className="h-0" />
          </ScrollArea>
        </div>

        {/* Category filter chips */}
        {categories.length > 0 && (
          <div className="mb-5">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 pb-1">
                <Button
                  variant={categoryFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className={`rounded-full shrink-0 text-xs h-7 px-3 ${categoryFilter === 'all' ? '' : 'bg-muted/50 border-border/60 hover:bg-muted'}`}
                  onClick={() => setCategoryFilter('all')}
                >
                  {t('content.allCategories')}
                </Button>
                {categories.map(cat => {
                  const active = categoryFilter === cat;
                  return (
                    <Button
                      key={cat}
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className={`rounded-full shrink-0 text-xs h-7 px-3 ${active ? '' : 'bg-muted/50 border-border/60 hover:bg-muted'}`}
                      onClick={() => setCategoryFilter(cat)}
                    >
                      {cat}
                    </Button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" className="h-0" />
            </ScrollArea>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredContents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filteredContents.map(content => {
              const locked = !canViewSubscriberContent(content);
              const thumbUrl = content.thumbnail_url || signedThumbs[content.id] || null;

              return (
                <Card
                  key={content.id}
                  className={`group overflow-hidden hover:shadow-lg transition-all cursor-pointer border-border/60 ${locked ? 'opacity-75' : ''}`}
                  onClick={() => {
                    if (locked) return;
                    setPreviewContent(content);
                  }}
                >
                  <ContentCardThumbnail content={content} thumbUrl={thumbUrl} locked={locked} t={t} />
                  <ContentCardBody content={content} locale={locale} />
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Library className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('content.noContent')}</h3>
            <p className="text-muted-foreground">
              {searchQuery || typeFilter !== 'all' || categoryFilter !== 'all'
                ? t('content.noContentFilters')
                : t('content.noContentUploaded')}
            </p>
          </Card>
        )}
      </div>

      <ContentPreviewModal
        isOpen={!!previewContent}
        onClose={() => setPreviewContent(null)}
        content={previewContent}
      />
    </MainLayout>
  );
}
