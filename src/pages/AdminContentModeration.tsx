import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Check,
  X,
  Eye,
  Loader2,
  FileVideo,
  FileText,
  Image as ImageIcon,
  Presentation,
} from 'lucide-react';

interface ContentRow {
  id: string;
  creator_id: string;
  type: string;
  title: string;
  description: string | null;
  file_url: string;
  thumbnail_url: string | null;
  is_public: boolean;
  category: string | null;
  price: number;
  moderation_status: 'pending' | 'approved' | 'rejected';
  moderation_note: string | null;
  created_at: string;
  creator_name?: string | null;
  creator_email?: string | null;
}

const typeIcon = (type: string) => {
  if (type === 'video' || type === 'masterclass') return <FileVideo className="w-4 h-4" />;
  if (type === 'pdf' || type === 'document') return <FileText className="w-4 h-4" />;
  if (type === 'image') return <ImageIcon className="w-4 h-4" />;
  if (type === 'presentation') return <Presentation className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
};

export default function AdminContentModeration() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [items, setItems] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContentRow | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (role && role !== 'admin') navigate('/');
  }, [role, navigate]);

  const fetchItems = async (status: typeof tab) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('doctor_content')
      .select('id, creator_id, type, title, description, file_url, thumbnail_url, is_public, category, price, moderation_status, moderation_note, created_at')
      .eq('moderation_status', status)
      .order('created_at', { ascending: status === 'pending' });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const rows = (data as any[]) || [];
    const creatorIds = [...new Set(rows.map((r) => r.creator_id))];
    let profilesMap: Record<string, { name: string | null; email: string | null }> = {};
    if (creatorIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', creatorIds);
      (profs || []).forEach((p: any) => {
        profilesMap[p.id] = { name: p.name, email: p.email };
      });
    }

    setItems(
      rows.map((r) => ({
        ...r,
        creator_name: profilesMap[r.creator_id]?.name || null,
        creator_email: profilesMap[r.creator_id]?.email || null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (role === 'admin') fetchItems(tab);
  }, [role, tab]);

  const decide = async (decision: 'approved' | 'rejected') => {
    if (!selected) return;
    setActing(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('doctor_content')
      .update({
        moderation_status: decision,
        moderation_note: note || null,
        moderated_at: new Date().toISOString(),
        moderated_by: userData.user?.id,
      } as any)
      .eq('id', selected.id);

    if (error) {
      toast.error(error.message);
      setActing(false);
      return;
    }

    // On approval, if content was public, notify the creator's subscribers (this is what would
    // have fired on upload before moderation was introduced).
    if (decision === 'approved' && selected.is_public) {
      try {
        await supabase.rpc('notify_subscribers', {
          p_doctor_id: selected.creator_id,
          p_notification_type: 'new_content',
          p_title: `Nuevo contenido: ${selected.title}`,
          p_message: `${selected.creator_name || 'Un doctor'} ha publicado nuevo contenido${selected.category ? ` en ${selected.category}` : ''}`,
          p_data: { content_id: selected.id, type: selected.type },
        });
        supabase.functions.invoke('send-content-notification-email', {
          body: {
            doctorId: selected.creator_id,
            doctorName: selected.creator_name || 'Doctor',
            contentId: selected.id,
            contentTitle: selected.title,
            contentType: selected.type,
            category: selected.category || '',
          },
        }).catch((e) => console.warn('subscriber email notification failed', e));
      } catch (e) {
        console.warn('notify_subscribers failed', e);
      }
    }

    toast.success(decision === 'approved' ? 'Contenido aprobado y notificado a suscriptores' : 'Contenido rechazado');
    setSelected(null);
    setNote('');
    setActing(false);
    fetchItems(tab);
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Moderación de contenido</h1>
            <p className="text-sm text-muted-foreground">Aprueba o rechaza los videos, PDFs y materiales que los doctores publican.</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="mb-4">
          <TabsList className="grid grid-cols-3 w-full sm:w-fit">
            <TabsTrigger value="pending">Pendientes</TabsTrigger>
            <TabsTrigger value="approved">Aprobados</TabsTrigger>
            <TabsTrigger value="rejected">Rechazados</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : items.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No hay contenido en este estado.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {items.map((it) => (
                  <Card key={it.id}>
                    <CardContent className="p-4 flex gap-3 items-start">
                      {it.thumbnail_url ? (
                        <img src={it.thumbnail_url} alt={it.title} className="w-20 h-20 rounded-md object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center flex-shrink-0">{typeIcon(it.type)}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate">{it.title}</h3>
                            <p className="text-xs text-muted-foreground line-clamp-2">{it.description || '(sin descripción)'}</p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] flex items-center gap-1">{typeIcon(it.type)} {it.type}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] text-muted-foreground">
                          <Avatar className="w-5 h-5">
                            <AvatarFallback className="text-[9px]">
                              {(it.creator_name || 'Dr').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{it.creator_name || 'Doctor'} · {it.creator_email}</span>
                          <span>· {new Date(it.created_at).toLocaleDateString('es-MX')}</span>
                          {Number(it.price) > 0 && <Badge variant="outline" className="text-[10px]">${Number(it.price).toFixed(2)}</Badge>}
                          {it.is_public ? <Badge variant="outline" className="text-[10px]">público</Badge> : <Badge variant="secondary" className="text-[10px]">privado</Badge>}
                        </div>
                        {it.moderation_note && (
                          <p className="mt-2 text-[11px] text-muted-foreground italic border-l-2 border-muted pl-2">Nota: {it.moderation_note}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(it.file_url, '_blank')}>
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </Button>
                        {tab === 'pending' && (
                          <>
                            <Button size="sm" className="gap-1.5 bg-success hover:bg-success" onClick={() => { setSelected(it); setNote(''); }}>
                              <Check className="w-3.5 h-3.5" /> Aprobar
                            </Button>
                            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => { setSelected({ ...it, type: '__reject__' + it.type } as any); setNote(''); }}>
                              <X className="w-3.5 h-3.5" /> Rechazar
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {selected && (
          <Card className="fixed inset-0 z-50 m-auto max-w-md h-fit p-6 shadow-2xl bg-card border" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
            <div className="space-y-3">
              <h3 className="font-semibold">
                {String(selected.type).startsWith('__reject__') ? 'Rechazar contenido' : 'Aprobar contenido'}
              </h3>
              <p className="text-sm text-muted-foreground">"{selected.title}"</p>
              <Textarea
                placeholder={String(selected.type).startsWith('__reject__') ? 'Motivo del rechazo (visible al creador)' : 'Nota opcional para el creador'}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setSelected(null)} disabled={acting}>Cancelar</Button>
                <Button
                  onClick={() => decide(String(selected.type).startsWith('__reject__') ? 'rejected' : 'approved')}
                  disabled={acting}
                  className={String(selected.type).startsWith('__reject__') ? 'bg-destructive hover:bg-destructive/90' : 'bg-success hover:bg-success'}
                >
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : (String(selected.type).startsWith('__reject__') ? 'Confirmar rechazo' : 'Aprobar')}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
