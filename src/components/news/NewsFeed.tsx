import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Newspaper, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  category: string;
  published_at: string | null;
  created_at: string;
  slug: string | null;
}

export const NewsFeed = React.forwardRef<HTMLElement, object>(function NewsFeed(_props, ref) {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const locale = language === 'es' ? es : enUS;
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('medical_news')
        .select('id, title, summary, image_url, category, published_at, created_at, slug')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(15);
      if (data) setNews(data);
      setIsLoading(false);
    };
    fetch();
  }, []);

  if (isLoading || news.length === 0) return null;

  const topCards = news.slice(0, 3);
  const listItems = news.slice(3);

  const formatDate = (item: NewsItem) =>
    format(new Date(item.published_at || item.created_at), 'd MMM', { locale });

  return (
    <section ref={ref} className="mt-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          {t('medicalNews.title')}
        </h2>
        <Link to="/news">
          <Button variant="ghost" size="sm" className="gap-1 text-primary">
            {t('medicalNews.viewAll')} <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Top 3 cards - equal grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {topCards.map((item, idx) => (
          <Link key={item.id} to={`/news/${item.slug || item.id}`} className="group">
            <Card className="overflow-hidden hover:shadow-xl transition-all h-full border-0 shadow-sm">
              {item.image_url && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-primary text-primary-foreground text-[10px] rounded-full px-2.5">{item.category}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(item)}
                  </span>
                </div>
                <h3 className={`font-heading font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 ${idx === 0 ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}>
                  {item.title}
                </h3>
                {item.summary && (
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-2">{item.summary}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Remaining as compact list */}
      {listItems.length > 0 && (
        <div className="mt-4 divide-y divide-border rounded-lg border bg-card">
          {listItems.map((item) => (
            <Link
              key={item.id}
              to={`/news/${item.slug || item.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors group"
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt=""
                  className="w-12 h-12 rounded-md object-cover shrink-0 hidden sm:block"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {item.title}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{item.category}</Badge>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {formatDate(item)}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      )}

      {/* Read more button */}
      <div className="mt-5 flex justify-center">
        <Button
          onClick={() => navigate('/news')}
          variant="outline"
          className="gap-2 px-6"
        >
          <Newspaper className="w-4 h-4" />
          {t('autoI18n.newsFeed1')}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </section>
  );
});
