import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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

const REPORT_REASON_LABEL_KEYS: Record<string, string> = {
  'Contenido inapropiado': 'reportButton.reasons.inappropriate',
  'Información médica incorrecta': 'reportButton.reasons.medicalIncorrect',
  'Spam o publicidad': 'reportButton.reasons.spam',
  'Comportamiento abusivo': 'reportButton.reasons.abusive',
  'Suplantación de identidad': 'reportButton.reasons.impersonation',
  'Contenido ofensivo': 'reportButton.reasons.offensive',
  'Otro': 'reportButton.reasons.other',
};

export function ReportButton({
  contentType,
  contentId,
  variant = 'ghost',
  size = 'sm',
  showText = false
}: ReportButtonProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error(t('reportButton.errors.notLoggedIn'));
      return;
    }

    if (!reason) {
      toast.error(t('reportButton.errors.noReason'));
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

      toast.success(t('reportButton.success'));
      setIsOpen(false);
      setReason('');
      setDescription('');
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        toast.error(t('reportButton.errors.duplicate'));
      } else {
        toast.error(t('reportButton.errors.generic'));
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
          {showText && <span className="ml-1">{t('reportButton.report')}</span>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('reportButton.title')}</DialogTitle>
          <DialogDescription>
            {t('reportButton.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('reportButton.reasonLabel')}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder={t('reportButton.reasonPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{t(REPORT_REASON_LABEL_KEYS[r])}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('reportButton.descriptionLabel')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('reportButton.descriptionPlaceholder')}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t('reportButton.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {t('reportButton.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
