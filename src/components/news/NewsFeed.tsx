import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Newspaper, Clock, MessageCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

export function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('medical_news')
        .select('id, title, summary, image_url, category, published_at, created_at, slug')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(6);
      if (data) setNews(data);
      setIsLoading(false);
    };
    fetch();
  }, []);

  if (isLoading || news.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          Noticias Médicas
        </h2>
        <Link to="/news">
          <Button variant="ghost" size="sm" className="gap-1 text-primary">
            Ver todas <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {news.map((item) => (
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
                    {format(new Date(item.published_at || item.created_at), 'd MMM', { locale: es })}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors text-sm">
                  {item.title}
                </h3>
                {item.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.summary}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
