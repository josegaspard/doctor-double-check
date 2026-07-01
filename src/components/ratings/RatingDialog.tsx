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
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: t('fix20.chat.ratingSelectTitle'),
        description: t('fix20.chat.ratingSelectDesc'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('fix20.chat.notAuthenticated'));

      // Check if already rated (prevent duplicate)
      const { data: existing } = await supabase
        .from('consultation_ratings')
        .select('id')
        .eq('consultation_id', consultationId)
        .eq('patient_id', user.id)
        .maybeSingle();

      if (existing) {
        toast({
          title: t('fix20.chat.ratingAlreadyTitle'),
          description: t('fix20.chat.ratingAlreadyDesc'),
        });
        onRated?.();
        onClose();
        return;
      }

      const { error } = await supabase
        .from('consultation_ratings')
        .insert({
          consultation_id: consultationId,
          patient_id: user.id,
          doctor_id: doctorId,
          rating,
        });

      if (error) {
        // Handle unique constraint violation gracefully
        if (error.code === '23505' || error.message?.includes('unique')) {
          toast({
            title: t('fix20.chat.ratingAlreadyTitle'),
            description: t('fix20.chat.ratingAlreadyDesc'),
          });
          onRated?.();
          onClose();
          return;
        }
        throw error;
      }

      toast({
        title: t('fix20.chat.ratingThanksTitle'),
        description: t('fix20.chat.ratingThanksDesc'),
      });

      onRated?.();
      onClose();
    } catch (error: any) {
      console.error('Rating error:', error);
      toast({
        title: t('fix20.chat.ratingErrorTitle'),
        description: error.message || t('fix20.chat.ratingErrorDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const ratingLabels = ['', t('fix20.chat.ratingVeryBad'), t('fix20.chat.ratingBad'), t('fix20.chat.ratingRegular'), t('fix20.chat.ratingGood'), t('fix20.chat.ratingExcellent')];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-warning" />
            {t('fix20.chat.ratingDialogTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('fix20.chat.ratingDialogDesc')} {doctorName}?
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
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            {t('fix20.chat.ratingNotNow')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('fix20.chat.ratingSending')}
              </>
            ) : (
              t('fix20.chat.ratingSubmit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
