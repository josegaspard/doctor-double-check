import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { NewsEditor } from '@/components/admin/NewsEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Newspaper, Plus, Edit, Trash2, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';

interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  image_url: string | null;
  category: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  slug: string | null;
}

export default function AdminNews() {
  const { role } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchNews = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('medical_news')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setNews(data as NewsItem[]);
    setIsLoading(false);
  };

  useEffect(() => { fetchNews(); }, []);

  if (role !== 'admin') return <Navigate to="/" replace />;

  const togglePublish = async (item: NewsItem) => {
    const { error } = await supabase
      .from('medical_news')
      .update({
        is_published: !item.is_published,
        published_at: !item.is_published ? new Date().toISOString() : null,
      })
      .eq('id', item.id);
    if (error) { toast.error('Error'); return; }
    toast.success(item.is_published ? 'Despublicada' : 'Publicada');
    fetchNews();
  };

  const deleteItem = async (id: string) => {
    if (!confirm('¿Eliminar esta noticia?')) return;
    const { error } = await supabase.from('medical_news').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Noticia eliminada');
    fetchNews();
  };

  if (isCreating || editingItem) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <Button variant="ghost" className="mb-4 gap-2" onClick={() => { setIsCreating(false); setEditingItem(null); }}>
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>{editingItem ? 'Editar noticia' : 'Nueva noticia'}</CardTitle>
            </CardHeader>
            <CardContent>
              <NewsEditor
                initialData={editingItem ? {
                  id: editingItem.id,
                  title: editingItem.title,
                  summary: editingItem.summary || '',
                  content: editingItem.content,
                  image_url: editingItem.image_url || '',
                  category: editingItem.category,
                  is_published: editingItem.is_published,
                  slug: editingItem.slug || '',
                } : undefined}
                onSaved={() => {
                  setIsCreating(false);
                  setEditingItem(null);
                  fetchNews();
                }}
              />
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-primary" />
              Gestión de Noticias
            </h1>
            <p className="text-muted-foreground mt-1">{news.length} noticias</p>
          </div>
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nueva noticia
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : news.length === 0 ? (
          <Card className="p-12 text-center">
            <Newspaper className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay noticias</h3>
            <p className="text-muted-foreground mb-4">Crea tu primera noticia</p>
            <Button onClick={() => setIsCreating(true)}><Plus className="w-4 h-4 mr-2" /> Crear noticia</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {news.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  {item.image_url && (
                    <div className="w-20 h-14 rounded-md overflow-hidden flex-shrink-0">
                      <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{item.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={item.is_published ? 'default' : 'secondary'} className="text-[10px]">
                        {item.is_published ? 'Publicada' : 'Borrador'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.created_at), 'd MMM yyyy', { locale: es })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => togglePublish(item)} title={item.is_published ? 'Despublicar' : 'Publicar'}>
                      {item.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditingItem(item)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
