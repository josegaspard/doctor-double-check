import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Save, Trash2, Eye, Heart, MessageSquare, Sparkles, DollarSign } from 'lucide-react';
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
}

export function EndingLiveModal({ isOpen, stage, enableRecording, uploadProgress = 0, liveId, onKeepDecision }: EndingLiveModalProps) {
  const [stats, setStats] = useState<LiveStats | null>(null);

  // Fetch stats when entering 'done' stage
  useEffect(() => {
    if (stage !== 'done' || !liveId) return;
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
          title: '¿Guardar grabación en tu perfil?',
          description: 'Elige si quieres que esta grabación esté disponible para la venta en tu perfil o si prefieres eliminarla.',
          icon: <Save className="w-8 h-8 text-primary" />,
        };
      case 'done':
        return {
          title: '¡Transmisión finalizada!',
          description: enableRecording 
            ? 'Tu grabación está disponible en Mis Grabaciones'
            : 'La transmisión ha finalizado correctamente',
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
          <DialogTitle className="text-center">{content.title}</DialogTitle>
          <DialogDescription className="text-center">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        {stage === 'choose' && (
          <div className="flex flex-col gap-3 mt-2">
            <Button
              onClick={() => onKeepDecision?.(true)}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Guardar en mi perfil
            </Button>
            <Button
              variant="outline"
              onClick={() => onKeepDecision?.(false)}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              No guardar
            </Button>
          </div>
        )}

        {stage === 'done' && stats && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={Eye} label="Pico espectadores" value={stats.peakViewers} />
              <StatCard icon={Heart} label="Likes" value={stats.totalLikes} />
              <StatCard icon={MessageSquare} label="Comentarios" value={stats.totalComments} />
              <StatCard icon={Sparkles} label="Destacados" value={stats.paidComments} />
            </div>
            {stats.paidRevenue > 0 && (
              <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                <DollarSign className="w-4 h-4 text-success" />
                <span className="text-sm font-semibold text-success">
                  +${stats.paidRevenue.toLocaleString()} MXN en chats de pago
                </span>
              </div>
            )}
            {enableRecording && (
              <p className="text-xs text-muted-foreground text-center">
                Las compras de tu grabación se mostrarán en tu panel de ganancias.
              </p>
            )}
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
