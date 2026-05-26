import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ArrowLeft, Megaphone, Loader2, EyeOff, Eye, Trash2, ExternalLink, MapPin, Globe, Search,
} from 'lucide-react';

interface AdminEvent {
  id: string;
  title: string;
  description: string;
  event_type: string;
  event_date: string;
  end_date: string | null;
  is_online: boolean;
  location: string | null;
  organizer: string | null;
  registration_url: string | null;
  image_url: string | null;
  is_published: boolean;
  created_by: string;
  created_at: string;
}

interface DoctorMini {
  user_id: string;
  status: string;
  specialty: string | null;
  name?: string | null;
  avatar_url?: string | null;
}

export default function AdminEvents() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [doctors, setDoctors] = useState<Record<string, DoctorMini>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past' | 'unpublished'>('upcoming');
  const [q, setQ] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    const { data: ev, error } = await (supabase as any)
      .from('foro_events')
      .select('*')
      .order('event_date', { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (ev as AdminEvent[]) || [];
    setEvents(list);

    const creatorIds = Array.from(new Set(list.map(e => e.created_by)));
    if (creatorIds.length) {
      const [docsRes, profsRes] = await Promise.all([
        (supabase as any).from('doctor_profiles').select('user_id, status, specialty').in('user_id', creatorIds),
        (supabase as any).from('profiles').select('id, name, avatar_url').in('id', creatorIds),
      ]);
      const profMap: Record<string, { name: string | null; avatar_url: string | null }> = {};
      ((profsRes.data as any[]) || []).forEach(p => { profMap[p.id] = { name: p.name, avatar_url: p.avatar_url }; });
      const map: Record<string, DoctorMini> = {};
      ((docsRes.data as any[]) || []).forEach(d => {
        map[d.user_id] = { ...d, name: profMap[d.user_id]?.name ?? null, avatar_url: profMap[d.user_id]?.avatar_url ?? null };
      });
      setDoctors(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    let list = events;
    if (tab === 'upcoming') list = list.filter(e => e.is_published && new Date(e.event_date).getTime() >= now);
    else if (tab === 'past') list = list.filter(e => e.is_published && new Date(e.event_date).getTime() < now);
    else list = list.filter(e => !e.is_published);
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      list = list.filter(e =>
        e.title.toLowerCase().includes(k) ||
        e.description.toLowerCase().includes(k) ||
        (doctors[e.created_by]?.name || '').toLowerCase().includes(k)
      );
    }
    return list;
  }, [events, tab, q, doctors]);

  const togglePublish = async (e: AdminEvent) => {
    const { error } = await (supabase as any)
      .from('foro_events')
      .update({ is_published: !e.is_published })
      .eq('id', e.id);
    if (error) { toast.error(error.message); return; }
    toast.success(!e.is_published ? (language === 'es' ? 'Evento publicado' : 'Event published') : (language === 'es' ? 'Evento ocultado' : 'Event hidden'));
    fetchAll();
  };

  const remove = async (e: AdminEvent) => {
    if (!window.confirm(language === 'es' ? `¿Eliminar permanentemente "${e.title}"?` : `Delete "${e.title}" permanently?`)) return;
    const { error } = await (supabase as any).from('foro_events').delete().eq('id', e.id);
    if (error) { toast.error(error.message); return; }
    toast.success(language === 'es' ? 'Evento eliminado' : 'Event deleted');
    fetchAll();
  };

  if (role !== 'admin') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-10 max-w-md">
          <Card><CardContent className="p-6 text-center text-sm">
            {language === 'es' ? 'Acceso solo para administradores.' : 'Admin access only.'}
          </CardContent></Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <Button variant="back" size="sm" onClick={() => navigate('/admin')} className="mb-3 -ml-2 gap-1.5">
          <ArrowLeft className="w-4 h-4" /> {language === 'es' ? 'Volver al panel' : 'Back to admin'}
        </Button>

        <div className="mb-5 rounded-2xl bg-card border border-border shadow-sm p-4 sm:p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-warning/15 flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-card-foreground">
                {language === 'es' ? 'Moderación de eventos' : 'Event moderation'}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {language === 'es'
                  ? 'Revisa los eventos publicados por doctores aprobados. Puedes ocultarlos o eliminarlos.'
                  : 'Review events published by approved doctors. Hide or delete them.'}
              </p>
            </div>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={language === 'es' ? 'Buscar por título, descripción o doctor…' : 'Search by title, description or doctor…'}
              className="pl-8 h-9"
            />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="mb-4">
          <TabsList className="grid grid-cols-3 w-full sm:w-fit">
            <TabsTrigger value="upcoming">{language === 'es' ? 'Próximos' : 'Upcoming'}</TabsTrigger>
            <TabsTrigger value="past">{language === 'es' ? 'Pasados' : 'Past'}</TabsTrigger>
            <TabsTrigger value="unpublished">{language === 'es' ? 'Ocultos' : 'Hidden'}</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
                {language === 'es' ? 'No hay eventos.' : 'No events.'}
              </CardContent></Card>
            ) : (
              <div className="space-y-2.5">
                {filtered.map(e => {
                  const doc = doctors[e.created_by];
                  const docName = doc?.name || (language === 'es' ? 'Doctor desconocido' : 'Unknown doctor');
                  const start = new Date(e.event_date);
                  return (
                    <Card key={e.id} className="overflow-hidden">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-lg bg-warning/15 border border-warning/30 flex flex-col items-center justify-center flex-shrink-0">
                            <p className="text-[10px] uppercase text-warning font-semibold leading-none">{format(start, 'MMM', { locale })}</p>
                            <p className="text-lg font-bold text-warning leading-none mt-0.5">{format(start, 'd')}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px] h-5 capitalize">{e.event_type}</Badge>
                              {!e.is_published && <Badge variant="secondary" className="text-[10px] h-5">{language === 'es' ? 'Oculto' : 'Hidden'}</Badge>}
                              <button type="button" onClick={() => navigate(`/doctor/${e.created_by}`)} className="text-[11px] text-primary hover:underline truncate">{docName}</button>
                              {doc?.status && doc.status !== 'approved' && (
                                <Badge variant="destructive" className="text-[10px] h-5">{doc.status}</Badge>
                              )}
                            </div>
                            <p className="font-semibold text-sm mt-1 line-clamp-2">{e.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{e.description}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1.5">
                              <span>{format(start, language === 'es' ? "d MMM yyyy · HH:mm" : 'MMM d, yyyy · HH:mm', { locale })}</span>
                              {e.is_online ? (
                                <span className="inline-flex items-center gap-1"><Globe className="w-3 h-3" />Online</span>
                              ) : e.location ? (
                                <span className="inline-flex items-center gap-1 truncate"><MapPin className="w-3 h-3" /> {e.location}</span>
                              ) : null}
                              {e.organizer && <span>· {e.organizer}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            {e.registration_url && (
                              <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 px-2" asChild>
                                <a href={e.registration_url} target="_blank" rel="noopener noreferrer" aria-label={language === 'es' ? 'Abrir enlace de registro' : 'Open registration link'}>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 px-2" onClick={() => togglePublish(e)}>
                              {e.is_published ? <><EyeOff className="w-3 h-3" /> {language === 'es' ? 'Ocultar' : 'Hide'}</> : <><Eye className="w-3 h-3" /> {language === 'es' ? 'Publicar' : 'Publish'}</>}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 px-2 text-destructive hover:text-destructive" onClick={() => remove(e)}>
                              <Trash2 className="w-3 h-3" /> {language === 'es' ? 'Eliminar' : 'Delete'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
