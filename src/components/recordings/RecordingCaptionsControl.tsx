import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Captions, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  recordingId: string;
  videoUrl?: string;
  captionsStatus?: string | null;
  captionsLanguages?: string[];
  /** Solo el dueño de la grabación o un admin pueden generar subtítulos. */
  canManage: boolean;
}

/**
 * Control INTUITIVO de subtítulos, justo DEBAJO del reproductor (no escondido en
 * el menú de tres puntos). Para el dueño/admin:
 *  - sin subtítulos → botón claro "Generar subtítulos".
 *  - procesando → estado "Generando…".
 *  - listos → aviso "Subtítulos disponibles, usa el botón CC" + regenerar.
 * Para los demás no renderiza nada (ven el botón CC nativo del reproductor).
 */
export function RecordingCaptionsControl({ recordingId, videoUrl, captionsStatus, captionsLanguages, canManage }: Props) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(captionsStatus ?? null);

  const isBunny = videoUrl?.startsWith('bunny:') ?? false;
  if (!canManage || !isBunny) return null;

  const ready = localStatus === 'ready' || (captionsLanguages && captionsLanguages.length > 0);
  const processing = localStatus === 'processing';

  const generate = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-captions', {
        body: { recordingId },
      });
      if (error || (data as any)?.error) {
        throw new Error((error as any)?.message || (data as any)?.error || 'failed');
      }
      setLocalStatus('processing');
      toast.success(t('recordings.captions.started'), { description: t('recordings.captions.startedDesc') });
    } catch (e) {
      toast.error(t('recordings.captions.failed'), { description: (e as Error)?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-border bg-card shadow-sm p-3 sm:p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Captions className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{t('recordings.captions.title')}</p>
        <p className="text-xs text-muted-foreground">
          {ready
            ? t('recordings.captions.readyHint')
            : processing
              ? t('recordings.captions.processingHint')
              : t('recordings.captions.emptyHint')}
        </p>
      </div>
      {ready ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="hidden sm:flex items-center gap-1 text-xs text-success font-medium">
            <CheckCircle2 className="w-4 h-4" /> {t('recordings.captions.readyBadge')}
          </span>
          <Button variant="outline" size="sm" disabled={busy} onClick={generate} className="gap-1.5">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {t('recordings.captions.regenerate')}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          disabled={busy || processing}
          onClick={generate}
          className="gap-1.5 flex-shrink-0"
        >
          {busy || processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Captions className="w-4 h-4" />}
          {processing ? t('recordings.captions.generating') : t('recordings.captions.generate')}
        </Button>
      )}
    </div>
  );
}
