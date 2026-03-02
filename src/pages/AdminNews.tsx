import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { NewsEditor } from '@/components/admin/NewsEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Newspaper, Plus, Edit, Trash2, Eye, EyeOff, Loader2, ArrowLeft, Pencil, Search, Users, Stethoscope } from 'lucide-react';
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

interface DoctorPermission {
  id: string;
  user_id: string;
  specialty: string;
  can_publish_news: boolean;
  status: string;
  profile?: { name: string; email: string; avatar_url: string | null };
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
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [mainTab, setMainTab] = useState('articles');

  // Doctor permissions state
  const [doctors, setDoctors] = useState<DoctorPermission[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!role) return; // Auth still loading, keep permissionLoading=true
    
    if (role === 'admin') {
      setCanPublish(true);
      setPermissionLoading(false);
    } else if (role === 'doctor' && supabaseUser?.id) {
      supabase
        .from('doctor_profiles')
        .select('can_publish_news')
        .eq('user_id', supabaseUser.id)
        .single()
        .then(({ data }) => {
          setCanPublish(data?.can_publish_news || false);
          setPermissionLoading(false);
        }, () => {
          setCanPublish(false);
          setPermissionLoading(false);
        });
    } else {
      setCanPublish(false);
      setPermissionLoading(false);
    }
  }, [role, supabaseUser?.id]);

  const fetchNews = async () => {
    setIsLoading(true);
    // Doctors only see their own news; admins see all
    let query = supabase
      .from('medical_news')
      .select('*')
      .order('created_at', { ascending: false });
    if (role === 'doctor' && supabaseUser?.id) {
      query = query.eq('created_by', supabaseUser.id);
    }
    const { data } = await query;
    if (data) {
      setNews(data as NewsItem[]);
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

  const fetchDoctors = async () => {
    setDoctorsLoading(true);
    try {
      // Only fetch doctors who already have publish permission (fast initial load)
      const { data: doctorProfiles } = await supabase
        .from('doctor_profiles')
        .select('id, user_id, specialty, can_publish_news, status')
        .eq('status', 'approved')
        .eq('can_publish_news', true)
        .order('created_at', { ascending: false });

      if (doctorProfiles) {
        const userIds = doctorProfiles.map(d => d.user_id);
        const { data: profiles } = userIds.length > 0
          ? await supabase.from('profiles').select('id, name, email, avatar_url').in('id', userIds)
          : { data: [] as any[] };
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        setDoctors(doctorProfiles.map(doc => ({
          ...doc,
          profile: profileMap.get(doc.user_id) as any,
        })));
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setDoctorsLoading(false);
    }
  };

  const searchDoctors = async (term: string) => {
    if (term.length < 2) return;
    setDoctorsLoading(true);
    try {
      // Search profiles first, then match to doctor_profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(20);

      if (profiles && profiles.length > 0) {
        const userIds = profiles.map(p => p.id);
        const { data: doctorProfiles } = await supabase
          .from('doctor_profiles')
          .select('id, user_id, specialty, can_publish_news, status')
          .eq('status', 'approved')
          .in('user_id', userIds);

        if (doctorProfiles) {
          const profileMap = new Map(profiles.map(p => [p.id, p]));
          const searchResults = doctorProfiles.map(doc => ({
            ...doc,
            profile: profileMap.get(doc.user_id) as any,
          }));

          // Merge with existing (keep those with permission that aren't in search)
          setDoctors(prev => {
            const existing = prev.filter(d => d.can_publish_news && !searchResults.find(s => s.id === d.id));
            return [...existing, ...searchResults];
          });
        }
      }
    } catch (error) {
      console.error('Error searching doctors:', error);
    } finally {
      setDoctorsLoading(false);
    }
  };

  useEffect(() => { fetchNews(); }, []);
  useEffect(() => { if (mainTab === 'permissions' && role === 'admin') fetchDoctors(); }, [mainTab]);

  useEffect(() => {
    if (pendingEditId && news.length > 0) {
      const item = news.find(n => n.id === pendingEditId);
      if (item) setEditingItem(item);
      setPendingEditId(null);
    }
  }, [pendingEditId, news]);

  if (permissionLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

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

  const toggleNewsPermission = async (doctor: DoctorPermission) => {
    setTogglingId(doctor.id);
    try {
      const newValue = !doctor.can_publish_news;
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ can_publish_news: newValue })
        .eq('id', doctor.id);

      if (error) throw error;

      if (newValue) {
        await supabase.from('notifications').insert({
          user_id: doctor.user_id,
          type: 'system' as any,
          title: '📰 Permiso de publicación otorgado',
          message: 'Se te ha otorgado permiso para crear y publicar artículos en el blog médico. ¡Ve a la sección de noticias para empezar!',
          data: { action_url: '/news' },
        });
      }

      toast.success(newValue ? 'Permiso otorgado' : 'Permiso revocado');
      fetchDoctors();
    } catch (error) {
      console.error('Error toggling news permission:', error);
      toast.error('Error al cambiar permiso');
    } finally {
      setTogglingId(null);
    }
  };

  const filteredDoctors = doctorSearch.length >= 2 
    ? doctors 
    : doctors.filter(d => d.can_publish_news || 
        d.profile?.name?.toLowerCase().includes(doctorSearch.toLowerCase()) ||
        d.profile?.email?.toLowerCase().includes(doctorSearch.toLowerCase())
      );

  if (isCreating || editingItem) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <Button variant="ghost" className="mb-4 gap-2 hidden sm:inline-flex" onClick={() => { setIsCreating(false); setEditingItem(null); }}>
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
        <Button variant="ghost" size="sm" onClick={() => navigate(role === 'admin' ? '/admin' : '/news')} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground hidden sm:inline-flex">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {role === 'admin' ? 'Volver al panel' : 'Volver a noticias'}
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Newspaper className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Gestión de Noticias
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{news.length} noticias</p>
          </div>
          {mainTab === 'articles' && (
            <Button onClick={() => setIsCreating(true)} className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" /> Nueva noticia
            </Button>
          )}
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="articles" className="gap-2">
              <Newspaper className="w-4 h-4" /> Artículos
            </TabsTrigger>
            {role === 'admin' && (
              <TabsTrigger value="permissions" className="gap-2">
                <Users className="w-4 h-4" /> Permisos de publicación
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="articles">
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
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4">
                      {item.image_url && (
                        <div className="w-full sm:w-20 h-32 sm:h-14 rounded-md overflow-hidden flex-shrink-0">
                          <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base text-foreground line-clamp-2 sm:truncate">{item.title}</h3>
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
                      <div className="flex items-center gap-1 border-t sm:border-t-0 pt-2 sm:pt-0">
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => togglePublish(item)} title={item.is_published ? 'Despublicar' : 'Publicar'}>
                          {item.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditingItem(item)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => deleteItem(item.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {role === 'admin' && (
            <TabsContent value="permissions">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Stethoscope className="w-5 h-5 text-primary" />
                    Doctores aprobados
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Activa o desactiva el permiso de publicación para cada doctor
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre o email para agregar doctores..."
                      value={doctorSearch}
                      onChange={(e) => {
                        setDoctorSearch(e.target.value);
                        if (e.target.value.length >= 2) {
                          searchDoctors(e.target.value);
                        } else if (e.target.value.length === 0) {
                          fetchDoctors(); // Reset to only show those with permission
                        }
                      }}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se muestran doctores con permiso. Busca por nombre o email para agregar más.
                  </p>

                  {doctorsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : filteredDoctors.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No se encontraron doctores</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredDoctors.map((doctor) => (
                        <div key={doctor.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={doctor.profile?.avatar_url || ''} />
                            <AvatarFallback>{doctor.profile?.name?.[0] || 'D'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{doctor.profile?.name || 'Sin nombre'}</p>
                            <p className="text-xs text-muted-foreground truncate">{doctor.profile?.email} · {doctor.specialty}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {doctor.can_publish_news && (
                              <Badge variant="default" className="text-[10px]">Puede publicar</Badge>
                            )}
                            {togglingId === doctor.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Switch
                                checked={doctor.can_publish_news}
                                onCheckedChange={() => toggleNewsPermission(doctor)}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
