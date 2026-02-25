import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { NewsEditor } from '@/components/admin/NewsEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Newspaper, Plus, Edit, Trash2, Eye, EyeOff, Loader2, ArrowLeft, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

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
  last_edited_at: string | null;
  last_edited_by: string | null;
  author_bio: string | null;
  author_social: any;
}

export default function AdminNews() {
  const { role, supabaseUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editorNames, setEditorNames] = useState<Record<string, string>>({});
  const [pendingEditId, setPendingEditId] = useState<string | null>((location.state as any)?.editId || null);
  const [canPublish, setCanPublish] = useState(role === 'admin');

  useEffect(() => {
    if (role === 'doctor' && supabaseUser?.id) {
      supabase
        .from('doctor_profiles')
        .select('can_publish_news')
        .eq('user_id', supabaseUser.id)
        .single()
        .then(({ data }) => {
          setCanPublish((data as any)?.can_publish_news || false);
        });
    }
  }, [role, supabaseUser?.id]);

  const fetchNews = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('medical_news')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setNews(data as NewsItem[]);
      // Fetch editor names
      const editorIds = [...new Set(data.filter(d => d.last_edited_by).map(d => d.last_edited_by))];
      if (editorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', editorIds);
        if (profiles) {
          const map: Record<string, string> = {};
          profiles.forEach(p => { map[p.id] = p.name; });
          setEditorNames(map);
        }
      }
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchNews(); }, []);

  // Auto-open editor if navigated with editId
  useEffect(() => {
    if (pendingEditId && news.length > 0) {
      const item = news.find(n => n.id === pendingEditId);
      if (item) setEditingItem(item);
      setPendingEditId(null);
    }
  }, [pendingEditId, news]);

  if (role !== 'admin' && !canPublish) return <Navigate to="/" replace />;

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
                  author_bio: editingItem.author_bio || '',
                  author_social: editingItem.author_social || {},
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
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Volver al panel
        </Button>

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
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant={item.is_published ? 'default' : 'secondary'} className="text-[10px]">
                        {item.is_published ? 'Publicada' : 'Borrador'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.created_at), 'd MMM yyyy', { locale: es })}
                      </span>
                    </div>
                    {item.last_edited_at && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                        <Pencil className="w-2.5 h-2.5" />
                        Editado {format(new Date(item.last_edited_at), "d MMM yyyy, HH:mm", { locale: es })}
                        {item.last_edited_by && editorNames[item.last_edited_by] && (
                          <> por {editorNames[item.last_edited_by]}</>
                        )}
                      </div>
                    )}
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
