import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle, Save, Eye, Heart, MessageSquare, Sparkles, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LiveStats {
  peakViewers: number;
  totalLikes: number;
  totalComments: number;
  paidComments: number;
  paidRevenue: number;
}

interface EndingLiveModalProps {
  isOpen: boolean;
  stage: 'ending' | 'saving' | 'uploading' | 'choose' | 'done';
  enableRecording: boolean;
  uploadProgress?: number;
  liveId?: string;
  onKeepDecision?: (keep: boolean) => void;
  onDismissDone?: () => void;
}

export function EndingLiveModal({ isOpen, stage, enableRecording, uploadProgress = 0, liveId, onKeepDecision, onDismissDone }: EndingLiveModalProps) {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [saveAsContent, setSaveAsContent] = useState(true);

  // Fetch stats when entering 'done' or 'choose' stage
  useEffect(() => {
    if ((stage !== 'done' && stage !== 'choose') || !liveId) return;
    const fetchStats = async () => {
      const [liveRes, msgRes, paidRes] = await Promise.all([
        supabase.from('lives').select('peak_viewers, likes_count, chat_price').eq('id', liveId).single(),
        supabase.from('live_chat_messages').select('id', { count: 'exact', head: true }).eq('live_id', liveId),
        supabase.from('live_chat_messages').select('id', { count: 'exact', head: true }).eq('live_id', liveId).eq('is_paid', true),
      ]);
      const chatPrice = Number(liveRes.data?.chat_price) || 0;
      const paidCount = paidRes.count || 0;
      setStats({
        peakViewers: liveRes.data?.peak_viewers || 0,
        totalLikes: liveRes.data?.likes_count || 0,
        totalComments: msgRes.count || 0,
        paidComments: paidCount,
        paidRevenue: paidCount * chatPrice,
      });
    };
    fetchStats();
  }, [stage, liveId]);

  // Reset checkbox when entering choose stage
  useEffect(() => {
    if (stage === 'choose') setSaveAsContent(true);
  }, [stage]);

  const getContent = () => {
    switch (stage) {
      case 'ending':
        return {
          title: 'Finalizando transmisión...',
          description: 'Cerrando la sala de transmisión',
          icon: <Loader2 className="w-8 h-8 animate-spin text-primary" />,
        };
      case 'saving':
        return {
          title: enableRecording ? 'Guardando grabación...' : 'Procesando...',
          description: enableRecording 
            ? 'Tu grabación se está guardando. Esto puede tomar unos segundos.'
            : 'Limpiando recursos de la transmisión.',
          icon: <Loader2 className="w-8 h-8 animate-spin text-primary" />,
        };
      case 'uploading':
        return {
          title: 'Subiendo grabación local...',
          description: `La grabación de respaldo se está subiendo. ${uploadProgress}% completado.`,
          icon: <Loader2 className="w-8 h-8 animate-spin text-primary" />,
        };
      case 'choose':
        return {
          title: '¿Guardar como contenido premium?',
          description: 'Elige si esta grabación estará disponible para la venta en tu perfil.',
          icon: <Save className="w-8 h-8 text-primary" />,
        };
      case 'done':
        return {
          title: '¡Transmisión finalizada!',
          description: enableRecording 
            ? 'Tu grabación se está procesando y estará disponible en tus grabaciones.'
            : 'La transmisión ha finalizado correctamente.',
          icon: <CheckCircle className="w-8 h-8 text-success" />,
        };
    }
  };

  const content = getContent();

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md" hideClose>
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            {content.icon}
          </div>
          <DialogTitle className="text-center text-xl">{content.title}</DialogTitle>
          <DialogDescription className="text-center text-base">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        {/* Stats shown in both choose and done stages */}
        {(stage === 'choose' || stage === 'done') && stats && (
          <div className="mt-2 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={Eye} label="Pico espectadores" value={stats.peakViewers} />
              <StatCard icon={Heart} label="Likes" value={stats.totalLikes} />
              <StatCard icon={MessageSquare} label="Comentarios" value={stats.totalComments} />
              <StatCard icon={Sparkles} label="Destacados" value={stats.paidComments} />
            </div>
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
              <DollarSign className="w-4 h-4 text-success" />
              <span className="text-sm font-semibold text-success">
                +${stats.paidRevenue.toLocaleString()} MXN en chats de pago
              </span>
            </div>
          </div>
        )}

        {stage === 'choose' && (
          <div className="flex flex-col gap-4 mt-2">
            <label className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer">
              <Checkbox
                checked={saveAsContent}
                onCheckedChange={(v) => setSaveAsContent(!!v)}
                className="mt-0.5 h-5 w-5"
              />
              <div>
                <p className="text-base font-semibold text-foreground">Guardar como contenido premium</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  La grabación estará disponible para la venta en tu perfil de doctor.
                </p>
              </div>
            </label>
            <Button
              onClick={() => onKeepDecision?.(saveAsContent)}
              className="w-full gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Confirmar
            </Button>
          </div>
        )}

        {stage === 'done' && (
          <div className="mt-2 space-y-3">
            {enableRecording && (
              <p className="text-xs text-muted-foreground text-center">
                Las compras de tu grabación se mostrarán en tu panel de ganancias.
              </p>
            )}
            <Button
              onClick={() => onDismissDone?.()}
              className="w-full gap-2"
            >
              {enableRecording ? (
                <>
                  <Eye className="w-4 h-4" />
                  Ver mis grabaciones
                </>
              ) : (
                'Ir al panel'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight text-foreground">{value.toLocaleString()}</p>
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}
