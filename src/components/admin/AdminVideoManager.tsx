import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Json } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Upload, Trash2, Video } from 'lucide-react';
import { toast } from 'sonner';

interface VideosState {
  home: string | null;
  tutorial_doctor: string | null;
  tutorial_patient: string | null;
  tutorial_resident: string | null;
}

const DEFAULTS: VideosState = {
  home: '/landing-mm-2026.mp4',
  tutorial_doctor: null,
  tutorial_patient: null,
  tutorial_resident: null,
};

type VideoKey = keyof VideosState;

const MAX_BYTES = 300 * 1024 * 1024; // 300 MB (coincide con el bucket)

export function AdminVideoManager() {
  const { supabaseUser } = useAuth();
  const { t } = useLanguage();
  const [videos, setVideos] = useState<VideosState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<VideoKey | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('id', 'videos')
        .maybeSingle();
      if (data?.value) {
        const v = data.value as Partial<VideosState>;
        setVideos({
          home: v.home ?? DEFAULTS.home,
          tutorial_doctor: v.tutorial_doctor ?? null,
          tutorial_patient: v.tutorial_patient ?? null,
          tutorial_resident: v.tutorial_resident ?? null,
        });
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (next: VideosState) => {
    const { error } = await supabase
      .from('site_settings')
      .upsert({ id: 'videos', value: next as unknown as Json, updated_by: supabaseUser?.id });
    if (error) throw error;
    setVideos(next);
  };

  const handleUpload = async (key: VideoKey, file: File) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error(t('adminVideos.errNotVideo'));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('adminVideos.errTooBig'));
      return;
    }
    setBusyKey(key);
    try {
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const path = `${key}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('site-videos')
        .upload(path, file, { contentType: file.type, upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('site-videos').getPublicUrl(path);
      await persist({ ...videos, [key]: pub.publicUrl });
      toast.success(t('adminVideos.saved'));
    } catch (e) {
      console.error('upload video error', e);
      toast.error(t('adminVideos.errUpload'));
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemove = async (key: VideoKey) => {
    setBusyKey(key);
    try {
      // home vuelve al asset estático por defecto; los tutoriales quedan en null (aviso "muy pronto")
      const fallback = key === 'home' ? DEFAULTS.home : null;
      await persist({ ...videos, [key]: fallback });
      toast.success(t('adminVideos.removed'));
    } catch (e) {
      console.error('remove video error', e);
      toast.error(t('adminVideos.errUpload'));
    } finally {
      setBusyKey(null);
    }
  };

  const FIELDS: { key: VideoKey; labelKey: string }[] = [
    { key: 'home', labelKey: 'adminVideos.home' },
    { key: 'tutorial_doctor', labelKey: 'adminVideos.tutorialDoctor' },
    { key: 'tutorial_patient', labelKey: 'adminVideos.tutorialPatient' },
    { key: 'tutorial_resident', labelKey: 'adminVideos.tutorialResident' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {FIELDS.map(({ key, labelKey }) => (
        <VideoField
          key={key}
          label={t(labelKey)}
          value={videos[key]}
          busy={busyKey === key}
          uploadLabel={t('adminVideos.upload')}
          replaceLabel={t('adminVideos.replace')}
          removeLabel={t('adminVideos.remove')}
          emptyLabel={t('adminVideos.empty')}
          onUpload={(f) => handleUpload(key, f)}
          onRemove={() => handleRemove(key)}
        />
      ))}
    </div>
  );
}

function VideoField({
  label, value, busy, uploadLabel, replaceLabel, removeLabel, emptyLabel, onUpload, onRemove,
}: {
  label: string;
  value: string | null;
  busy: boolean;
  uploadLabel: string;
  replaceLabel: string;
  removeLabel: string;
  emptyLabel: string;
  onUpload: (f: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasVideo = !!value;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm text-[#163a83]">
          <Video className="w-4 h-4" /> {label}
        </div>

        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
          {hasVideo ? (
            <video key={value} src={value!} controls preload="metadata" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground px-4 text-center">{emptyLabel}</span>
          )}
          {busy && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/ogg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = '';
          }}
        />

        <div className="flex gap-2">
          <Button size="sm" variant="default" disabled={busy} onClick={() => inputRef.current?.click()} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            {hasVideo ? replaceLabel : uploadLabel}
          </Button>
          {hasVideo && (
            <Button size="sm" variant="outline" disabled={busy} onClick={onRemove} className="gap-1.5 text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
              {removeLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
