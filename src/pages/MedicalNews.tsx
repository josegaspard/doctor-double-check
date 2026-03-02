import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious, PaginationEllipsis
} from '@/components/ui/pagination';
import {
  Newspaper, Search, Clock, MessageCircle, PenSquare, Eye,
  TrendingUp, Flame, ChevronLeft, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';

const CATEGORIES = [
  'Todas', 'Cardiología', 'Neurología', 'Oncología', 'Pediatría',
  'Investigación', 'Tecnología Médica', 'Salud Pública', 'Farmacología', 'Cirugía', 'General'
];

type SortBy = 'recent' | 'most_read' | 'most_commented';
const PAGE_SIZE = 15;

interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  category: string;
  published_at: string | null;
  created_at: string;
  slug: string | null;
  view_count: number;
  comment_count?: number;
}

/* ─── Scrollable row with chevron arrows on desktop ─── */
function ScrollableFilterRow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const isMobile = useIsMobile();

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    check();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', check); ro.disconnect(); };
  }, [check]);

  const scroll = (dir: 'left' | 'right') => {
    ref.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Left arrow – hidden on mobile */}
      {!isMobile && canLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      <div
        ref={ref}
        className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-1 px-1"
      >
        {children}
      </div>
      {!isMobile && canRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ─── Skeleton card ─── */
const SkeletonCard = () => (
  <Card className="overflow-hidden">
    <Skeleton className="aspect-video w-full" />
    <CardContent className="p-4 space-y-3">
      <div className="flex justify-between"><Skeleton className="h-5 w-20 rounded-full" /><Skeleton className="h-4 w-16" /></div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-24" />
    </CardContent>
  </Card>
);

/* ─── News card ─── */
function NewsCard({ item, isHero = false, dateLocale, language, t }: {
  item: NewsItem; isHero?: boolean; dateLocale: any; language: string; t: (k: string) => string;
}) {
  return (
    <Link to={`/news/${item.slug || item.id}`} className={isHero ? 'col-span-full' : ''}>
      <Card className={`overflow-hidden hover:shadow-lg transition-all group h-full ${isHero ? 'md:flex md:flex-row' : ''}`}>
        {item.image_url && (
          <div className={`overflow-hidden ${isHero ? 'md:w-1/2 aspect-video md:aspect-auto' : 'aspect-video'}`}>
            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          </div>
        )}
        <CardContent className={`p-4 flex flex-col justify-center ${isHero ? 'md:w-1/2 md:p-6' : ''}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(item.published_at || item.created_at), 'd MMM yyyy', { locale: dateLocale })}
            </span>
          </div>
          <h3 className={`font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors ${isHero ? 'text-xl md:text-2xl' : ''}`}>
            {item.title}
          </h3>
          {item.summary && (
            <p className={`text-muted-foreground mb-3 ${isHero ? 'text-sm line-clamp-3' : 'text-sm line-clamp-2'}`}>{item.summary}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{item.view_count || 0} {language === 'es' ? 'lecturas' : 'views'}</span>
            <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{item.comment_count || 0} {t('medicalNews.comments')}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ─── Main page ─── */
export default function MedicalNews() {
  const { role, supabaseUser } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isMobile = useIsMobile();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [canPublish, setCanPublish] = useState(false);

  const dateLocale = language === 'es' ? esLocale : enUS;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  useEffect(() => {
    if (role === 'admin') { setCanPublish(true); }
    else if (role === 'doctor' && supabaseUser?.id) {
      supabase.from('doctor_profiles').select('can_publish_news').eq('user_id', supabaseUser.id).single()
        .then(({ data }) => setCanPublish((data as any)?.can_publish_news || false));
    }
  }, [role, supabaseUser?.id]);

  useEffect(() => { setPage(0); }, [search, selectedCategory, sortBy]);

  useEffect(() => {
    const fetchNews = async () => {
      setIsLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const sortColumn = sortBy === 'most_read' ? 'view_count' : 'published_at';

      let query = supabase
        .from('medical_news')
        .select('id, title, summary, image_url, category, published_at, created_at, slug, view_count', { count: 'exact' })
        .eq('is_published', true);

      if (selectedCategory !== 'Todas') query = query.eq('category', selectedCategory);
      if (search.trim()) query = query.or(`title.ilike.%${search.trim()}%,summary.ilike.%${search.trim()}%`);
      query = query.order(sortColumn, { ascending: false }).range(from, to);

      const { data, count } = await query;
      if (data) {
        const ids = data.map(d => d.id);
        const { data: commentCounts } = await supabase.from('news_comments').select('news_id').in('news_id', ids);
        const countMap = new Map<string, number>();
        commentCounts?.forEach(c => countMap.set(c.news_id, (countMap.get(c.news_id) || 0) + 1));
        let items = data.map(d => ({ ...d, comment_count: countMap.get(d.id) || 0 }));
        if (sortBy === 'most_commented') items.sort((a, b) => (b.comment_count || 0) - (a.comment_count || 0));
        setNews(items);
        setTotalCount(count || 0);
      }
      setIsLoading(false);
    };
    fetchNews();
  }, [page, search, selectedCategory, sortBy]);

  const sortOptions: { key: SortBy; label: string; icon: React.ReactNode }[] = [
    { key: 'recent', label: language === 'es' ? 'Recientes' : 'Recent', icon: <Clock className="w-3.5 h-3.5" /> },
    { key: 'most_read', label: language === 'es' ? 'Más leídos' : 'Most Read', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { key: 'most_commented', label: language === 'es' ? 'Más comentados' : 'Most Commented', icon: <Flame className="w-3.5 h-3.5" /> },
  ];

  const heroItem = page === 0 && news.length > 0 && !isMobile ? news[0] : null;
  const gridItems = heroItem ? news.slice(1) : news;

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pageNumbers: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) { for (let i = 0; i < totalPages; i++) pageNumbers.push(i); }
    else {
      pageNumbers.push(0);
      if (page > 2) pageNumbers.push('ellipsis');
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pageNumbers.push(i);
      if (page < totalPages - 3) pageNumbers.push('ellipsis');
      pageNumbers.push(totalPages - 1);
    }
    return (
      <div className="mt-8 flex flex-col items-center gap-3">
        {isMobile ? (
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-10 w-10"><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-sm font-medium text-muted-foreground">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-10 w-10"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        ) : (
          <Pagination>
            <PaginationContent>
              <PaginationItem><PaginationPrevious onClick={() => page > 0 && setPage(p => p - 1)} className={page === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} /></PaginationItem>
              {pageNumbers.map((p, i) => p === 'ellipsis'
                ? <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
                : <PaginationItem key={p}><PaginationLink isActive={page === p} onClick={() => setPage(p)} className="cursor-pointer">{p + 1}</PaginationLink></PaginationItem>
              )}
              <PaginationItem><PaginationNext onClick={() => page < totalPages - 1 && setPage(p => p + 1)} className={page >= totalPages - 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} /></PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Newspaper className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              {t('medicalNews.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 hidden sm:block">{t('medicalNews.subtitle')}</p>
          </div>
          {canPublish && (
            <Button onClick={() => navigate('/doctor/news')} size={isMobile ? 'icon' : 'default'} className="gap-2 shrink-0">
              <PenSquare className="w-4 h-4" />
              {!isMobile && <span>{t('medicalNews.writeArticle')}</span>}
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('medicalNews.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Sort filters with arrows */}
        <ScrollableFilterRow className="mb-3">
          {sortOptions.map(opt => (
            <Button key={opt.key} variant={sortBy === opt.key ? 'default' : 'outline'} size="sm" onClick={() => setSortBy(opt.key)} className="text-xs gap-1.5 shrink-0">
              {opt.icon}{opt.label}
            </Button>
          ))}
        </ScrollableFilterRow>

        {/* Category filters with arrows */}
        <ScrollableFilterRow className="mb-6">
          {CATEGORIES.map(cat => (
            <Button key={cat} variant={selectedCategory === cat ? 'secondary' : 'ghost'} size="sm" onClick={() => setSelectedCategory(cat)} className={`text-xs shrink-0 ${selectedCategory === cat ? 'font-semibold' : ''}`}>
              {cat}
            </Button>
          ))}
        </ScrollableFilterRow>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : news.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {heroItem && <NewsCard item={heroItem} isHero dateLocale={dateLocale} language={language} t={t} />}
              {gridItems.map(item => <NewsCard key={item.id} item={item} dateLocale={dateLocale} language={language} t={t} />)}
            </div>
            {renderPagination()}
          </>
        ) : (
          <Card className="p-12 text-center">
            <Newspaper className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('medicalNews.noNews')}</h3>
            <p className="text-muted-foreground">{t('medicalNews.noNewsSubtitle')}</p>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
