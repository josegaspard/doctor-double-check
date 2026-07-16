import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, Trash2, Image as ImageIcon, Droplets } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_LIVE_BACKGROUNDS, type LiveBackground } from '@/hooks/useLiveBackgrounds';

// Gestor de fondos virtuales para lives (súper admin). EN ESPAÑOL hardcodeado
// (uso interno admin, igual que el panel de QR). Los fondos se guardan en
// site_settings id='live_backgrounds' y las imágenes en el bucket público
// 'site-videos' (prefijo live-backgrounds/). El doctor los ve en el picker
// del live junto a "Cámara normal" y "Fondo difuminado" (siempre fijos).
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB por imagen de fondo

export function AdminLiveBackgroundsManager() {
  const { supabaseUser } = useAuth();
  const [items, setItems] = useState<LiveBackground[]>(DEFAULT_LIVE_BACKGROUNDS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('id', 'live_backgrounds')
        .maybeSingle();
      const saved = (data?.value as any)?.items;
      if (Array.isArray(saved) && saved.length > 0) setItems(saved);
      setLoading(false);
    })();
  }, []);

  const persist = async (next: LiveBackground[]) => {
    const { error } = await supabase
      .from('site_settings')
      .upsert({ id: 'live_backgrounds', value: { items: next } as unknown as Json, updated_by: supabaseUser?.id });
    if (error) throw error;
    setItems(next);
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('El fondo debe ser una imagen (JPG/PNG/WebP).');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Imagen demasiado grande (máx 8 MB).');
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `live-backgrounds/bg-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('site-videos')
        .upload(path, file, { contentType: file.type, upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('site-videos').getPublicUrl(path);
      const label = newLabel.trim() || `Fondo ${items.length + 1}`;
      await persist([...items, { id: `bg-${Date.now()}`, label, url: pub.publicUrl }]);
      setNewLabel('');
      toast.success('Fondo agregado. Ya aparece en el selector del live.');
    } catch (e) {
      console.error('upload live background error', e);
      toast.error('No se pudo subir el fondo.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: string) => {
    setBusy(true);
    try {
      const next = items.filter((b) => b.id !== id);
      // Nunca dejar la lista vacía: si quitan todo, vuelve el fondo de marca.
      await persist(next.length > 0 ? next : DEFAULT_LIVE_BACKGROUNDS);
      toast.success('Fondo eliminado.');
    } catch (e) {
      console.error('remove live background error', e);
      toast.error('No se pudo eliminar el fondo.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-white">
        <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
          <p className="flex items-center gap-2 font-semibold text-[#163a83]">
            <Droplets className="w-4 h-4" /> Cómo funciona
          </p>
          <p>
            El doctor elige el fondo en el live (botón junto a compartir pantalla): <strong>Cámara normal</strong> y{' '}
            <strong>Fondo difuminado</strong> siempre están disponibles; aquí agregas o quitas las <strong>imágenes de fondo</strong> extra.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((bg) => (
          <Card key={bg.id} className="overflow-hidden bg-white">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm text-[#163a83]">
                <ImageIcon className="w-4 h-4" /> {bg.label}
              </div>
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                <img src={bg.url} alt={bg.label} className="w-full h-full object-cover" />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => handleRemove(bg.id)}
                className="gap-1.5 text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" /> Quitar
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* Agregar nuevo fondo */}
        <Card className="border-dashed bg-white">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm text-[#163a83]">
              <Upload className="w-4 h-4" /> Agregar fondo
            </div>
            <Input
              placeholder="Nombre del fondo (ej. Consultorio)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              disabled={busy}
            />
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = '';
              }}
            />
            <Button size="sm" disabled={busy} onClick={() => inputRef.current?.click()} className="gap-1.5">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Subir imagen
            </Button>
            <p className="text-[11px] text-muted-foreground">JPG/PNG/WebP · máx 8 MB · ideal 1280×720 o mayor.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
