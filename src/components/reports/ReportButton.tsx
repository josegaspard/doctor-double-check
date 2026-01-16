import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Flag, Loader2 } from 'lucide-react';

interface ReportButtonProps {
  contentType: 'live' | 'recording' | 'doctor' | 'chat_message';
  contentId: string;
  variant?: 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  showText?: boolean;
}

const REPORT_REASONS = [
  'Contenido inapropiado',
  'Información médica incorrecta',
  'Spam o publicidad',
  'Comportamiento abusivo',
  'Suplantación de identidad',
  'Contenido ofensivo',
  'Otro',
];

export function ReportButton({ 
  contentType, 
  contentId, 
  variant = 'ghost', 
  size = 'sm',
  showText = false 
}: ReportButtonProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error('Debes iniciar sesión para reportar contenido');
      return;
    }

    if (!reason) {
      toast.error('Selecciona una razón para el reporte');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        content_type: contentType,
        content_id: contentId,
        reason,
        description: description || null,
      });

      if (error) throw error;

      toast.success('Reporte enviado correctamente');
      setIsOpen(false);
      setReason('');
      setDescription('');
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        toast.error('Ya has reportado este contenido');
      } else {
        toast.error('Error al enviar el reporte');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Flag className="w-4 h-4" />
          {showText && <span className="ml-1">Reportar</span>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar Contenido</DialogTitle>
          <DialogDescription>
            Ayúdanos a mantener la plataforma segura reportando contenido inapropiado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Razón del reporte *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una razón" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descripción adicional (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Proporciona más detalles sobre el problema..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleSubmit} 
            disabled={isSubmitting || !reason}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Enviar Reporte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
