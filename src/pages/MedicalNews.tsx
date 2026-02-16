import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Newspaper, Search, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  image_url: string | null;
  source_url: string | null;
  category: string;
  published_at: string | null;
  created_at: string;
}

export default function MedicalNews() {
  const { language } = useLanguage();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('medical_news')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(50);
      if (data) setNews(data as NewsItem[]);
      setIsLoading(false);
    };
    fetch();
  }, []);

  const filtered = news.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.summary?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-primary" />
            {language === 'es' ? 'Noticias Médicas' : 'Medical News'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'es' ? 'Últimas noticias e innovaciones médicas' : 'Latest medical news and innovations'}
          </p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={language === 'es' ? 'Buscar noticias...' : 'Search news...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((item) => (
              <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="flex flex-col sm:flex-row">
                  {item.image_url && (
                    <div className="sm:w-48 h-32 sm:h-auto flex-shrink-0">
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardContent className="p-4 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(item.published_at || item.created_at), 'd MMM yyyy', { locale: es })}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                    {item.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{item.summary}</p>
                    )}
                    {item.source_url && (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver fuente original
                      </a>
                    )}
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Newspaper className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {language === 'es' ? 'No hay noticias disponibles' : 'No news available'}
            </h3>
            <p className="text-muted-foreground">
              {language === 'es' ? 'Las noticias médicas se publicarán próximamente' : 'Medical news will be published soon'}
            </p>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
