// Materiales formativos (Aprendizaje > "materiales"), 11-sep-2026.
//
// Biblioteca de PDF/presentaciones existentes en `doctor_content` (lo que ya
// se sube desde Contenido > Crear > Subir, sin masterclass ni libros de pago
// — esos siguen en Masterclass y en el perfil público del médico) + los cursos
// de categoría "material". Solo lectura aquí: subir contenido nuevo sigue
// viviendo en Contenido, que es quien administra el archivo y su categoría.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { doctorHref } from '@/lib/doctorSections';
import { fmtDate } from '@/lib/proFormat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Presentation, FolderOpen, Loader2, PlayCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';
import CoursesSection from '@/components/education/CoursesSection';

interface Material {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  type: string;
  creator_id: string;
  creatorName?: string;
  createdAt: string;
  fileUrl: string;
}

export default function MaterialsLibrary() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('doctor_content')
      .select('id, title, description, category, type, creator_id, created_at, file_url, moderation_status, is_public, is_masterclass, is_book')
      .in('type', ['pdf', 'presentation'])
      .order('created_at', { ascending: false })
      .limit(100);
    const rows = ((data as any[]) || []).filter(r => !r.is_masterclass && !r.is_book);
    const visible = rows.filter(r => (r.moderation_status === 'approved' && r.is_public) || r.creator_id === user?.id);
    const creatorIds = [...new Set(visible.map(r => r.creator_id))];
    const nameMap = new Map<string, string>();
    if (creatorIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, name').in('id', creatorIds);
      (profs || []).forEach((p: any) => nameMap.set(p.id, p.name));
    }
    setItems(
      visible.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        type: r.type,
        creator_id: r.creator_id,
        creatorName: nameMap.get(r.creator_id),
        createdAt: r.created_at,
        fileUrl: r.file_url,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const openMaterial = async (m: Material) => {
    setOpeningId(m.id);
    const tab = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('doctor-content').createSignedUrl(m.fileUrl, 3600);
    if (error || !data?.signedUrl) {
      if (tab) tab.close();
      toast.error(t('mm2.learning.materials.openError'));
      setOpeningId(null);
      return;
    }
    if (tab) tab.location.href = data.signedUrl;
    setOpeningId(null);
  };

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-start gap-3 text-xs rounded-xl px-3.5 py-2.5 bg-card border border-primary/20 border-l-4 border-l-primary shadow-md shadow-[#0b1d45]/15 flex-1">
            <span aria-hidden className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-white text-[11px] font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #227787, #839ed5)' }}>📄</span>
            <span className="leading-relaxed">
              <strong className="text-secondary font-semibold">{t('mm2.learning.materials.calloutTitle')}</strong>{' '}
              <span className="text-muted-foreground">{t('mm2.learning.materials.calloutBody')}</span>
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 sm:flex-shrink-0"
            onClick={() => navigate(doctorHref('contenido', { tab: 'crear', crear: 'subir' }))}
          >
            <Upload className="w-3.5 h-3.5" /> {t('mm2.learning.materials.upload')}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <Card className="p-10 text-center border-primary/15">
            <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-3 mx-auto">
              <FolderOpen className="w-8 h-8 text-primary" />
            </span>
            <p className="font-medium">{t('mm2.learning.materials.emptyTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('mm2.learning.materials.emptyBody')}</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map(m => (
              <Card key={m.id} className="border-l-4 border-l-primary/30">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2 min-w-0">
                      {m.type === 'presentation' ? <Presentation className="w-4 h-4 text-primary flex-shrink-0" /> : <FileText className="w-4 h-4 text-primary flex-shrink-0" />}
                      <span className="truncate">{m.title}</span>
                    </CardTitle>
                    {m.category && <Badge variant="outline" className="text-[10px] flex-shrink-0">{m.category}</Badge>}
                  </div>
                  {m.creatorName && <p className="text-xs text-muted-foreground">{m.creatorName} · {fmtDate(new Date(m.createdAt), language)}</p>}
                </CardHeader>
                <CardContent className="pt-0">
                  {m.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{m.description}</p>}
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openMaterial(m)} disabled={openingId === m.id}>
                    {openingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                    {t('mm2.learning.materials.view')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <CoursesSection category="material" />
    </div>
  );
}
