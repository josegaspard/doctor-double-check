import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Bucket público 'site-videos': solo el admin puede escribir (RLS) y acepta jpg, png y webp.
const BUCKET = 'site-videos';
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function readSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

interface Props {
  kind: 'favicon' | 'social' | 'logo';
  value: string;
  onChange: (url: string, size?: { width: number; height: number }) => void;
  /** Deja también escribir o pegar una URL. */
  allowUrl?: boolean;
}

export function SeoImageUpload({ kind, value, onChange, allowUrl = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      toast.error('Formato no admitido: sube un PNG, JPG o WebP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('La imagen pesa más de 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const size = await readSize(file);
      if (kind === 'favicon') {
        if (Math.abs(size.width - size.height) > 1) {
          toast.error(`El favicon tiene que ser cuadrado (esta imagen mide ${size.width}×${size.height}).`);
          return;
        }
        if (size.width < 48) {
          toast.error('El favicon tiene que medir al menos 48×48 píxeles (mejor 512×512).');
          return;
        }
      }
      if (kind === 'social' && size.width < 600) {
        toast.warning(`La imagen mide ${size.width}×${size.height}: en redes se verá pequeña. Lo ideal es 1200×630.`);
      }
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `seo/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl, size);
      toast.success('Imagen subida. Recuerda guardar los cambios.');
    } catch (error) {
      console.error('[seo] upload', error);
      toast.error('No se pudo subir la imagen.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const hint =
    kind === 'favicon'
      ? 'PNG cuadrado, mínimo 48×48 (recomendado 512×512).'
      : kind === 'logo'
        ? 'PNG o JPG, idealmente cuadrado y con fondo.'
        : 'JPG o PNG de 1200×630 píxeles, menos de 5 MB.';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {/* Sin clases bg-secondary/*: index.css pinta de blanco el texto de todo lo que las lleve. */}
        {value ? (
          <img
            src={value}
            alt=""
            className={kind === 'social' ? 'h-16 w-[122px] rounded-lg border border-[#d5dde8] object-cover bg-[#f3f6fa]' : 'h-16 w-16 rounded-lg border border-[#d5dde8] object-contain bg-white p-1'}
          />
        ) : (
          <div className={`${kind === 'social' ? 'h-16 w-[122px]' : 'h-16 w-16'} rounded-lg border-2 border-dashed border-[#c3cfdf] bg-[#f3f6fa] flex items-center justify-center`}>
            <ImagePlus className="w-5 h-5 text-[#8a9bb3]" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1.5" />}
            {value ? 'Cambiar imagen' : 'Subir imagen'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} className="text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4 mr-1.5" />
              Quitar
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" accept={TYPES.join(',')} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      </div>
      <p className="text-[11px] text-secondary/60">{hint}</p>
      {allowUrl && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="…o pega la URL de una imagen (https://…)"
          className="text-sm"
        />
      )}
    </div>
  );
}
