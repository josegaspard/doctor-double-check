import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { RatingStars } from './RatingStars';
import { Loader2, Star } from 'lucide-react';

interface RatingDialogProps {
  open: boolean;
  onClose: () => void;
  consultationId: string;
  doctorId: string;
  doctorName: string;
  onRated?: () => void;
}

export function RatingDialog({
  open,
  onClose,
  consultationId,
  doctorId,
  doctorName,
  onRated,
}: RatingDialogProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: 'Selecciona una calificación',
        description: 'Por favor selecciona al menos 1 estrella',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { error } = await supabase
        .from('consultation_ratings')
        .insert({
          consultation_id: consultationId,
          patient_id: user.id,
          doctor_id: doctorId,
          rating,
          comment: comment.trim() || null,
        });

      if (error) throw error;

      toast({
        title: '¡Gracias por tu calificación!',
        description: 'Tu opinión ayuda a otros pacientes',
      });

      onRated?.();
      onClose();
    } catch (error: any) {
      console.error('Rating error:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar la calificación',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const ratingLabels = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            Califica tu consulta
          </DialogTitle>
          <DialogDescription>
            ¿Cómo fue tu experiencia con {doctorName}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="flex flex-col items-center gap-3">
            <RatingStars
              rating={rating}
              size="lg"
              interactive
              onChange={setRating}
            />
            {rating > 0 && (
              <p className="text-sm font-medium text-primary">
                {ratingLabels[rating]}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Comentario (opcional)
            </label>
            <Textarea
              placeholder="Cuéntanos más sobre tu experiencia..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Ahora no
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || rating === 0}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar calificación'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
