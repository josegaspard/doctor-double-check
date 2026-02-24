import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Newspaper, Search, Clock, MessageCircle, Loader2, Filter, PenSquare } from 'lucide-react';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

const CATEGORIES = [
  'Todas', 'Cardiología', 'Neurología', 'Oncología', 'Pediatría',
  'Investigación', 'Tecnología Médica', 'Salud Pública', 'Farmacología', 'Cirugía', 'General'
];

interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  category: string;
  published_at: string | null;
  created_at: string;
  slug: string | null;
  comment_count?: number;
}

export default function MedicalNews() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');

  useEffect(() => {
    const fetchNews = async () => {
      const { data } = await supabase
        .from('medical_news')
        .select('id, title, summary, image_url, category, published_at, created_at, slug')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(100);

      if (data) {
        const ids = data.map(d => d.id);
        const { data: commentCounts } = await supabase
          .from('news_comments')
          .select('news_id')
          .in('news_id', ids);

        const countMap = new Map<string, number>();
        commentCounts?.forEach(c => countMap.set(c.news_id, (countMap.get(c.news_id) || 0) + 1));

        setNews(data.map(d => ({ ...d, comment_count: countMap.get(d.id) || 0 })));
      }
      setIsLoading(false);
    };
    fetchNews();
  }, []);

  const filtered = news.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.summary?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || n.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const dateLocale = language === 'es' ? esLocale : enUS;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-primary" />
              {t('medicalNews.title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('medicalNews.subtitle')}
            </p>
          </div>
          {(role === 'admin' || role === 'doctor') && (
            <Button onClick={() => navigate('/admin/news')} className="gap-2">
              <PenSquare className="w-4 h-4" />
              <span className="hidden sm:inline">{t('medicalNews.writeArticle')}</span>
            </Button>
          )}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('medicalNews.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="text-xs"
            >
              {cat}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <Link key={item.id} to={`/news/${item.slug || item.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-all group h-full">
                  {item.image_url && (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(item.published_at || item.created_at), 'd MMM yyyy', { locale: dateLocale })}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    {item.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{item.summary}</p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageCircle className="w-3 h-3" />
                      {item.comment_count || 0} {t('medicalNews.comments')}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Newspaper className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('medicalNews.noNews')}
            </h3>
            <p className="text-muted-foreground">
              {t('medicalNews.noNewsSubtitle')}
            </p>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
