import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultationId: string | null;
  onSaved: () => void;
}

export function PostConsultationSummaryDialog({ open, onOpenChange, consultationId, onSaved }: Props) {
  const { t } = useLanguage();
  const [summary, setSummary] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!consultationId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('consultations')
        .update({
          doctor_summary: summary.trim() || null,
          diagnosis: diagnosis.trim() || null,
          doctor_recommendations: recommendations.trim() || null,
          completed_at: new Date().toISOString(),
          status: 'completed',
        } as any)
        .eq('id', consultationId);

      if (error) throw error;
      toast.success(t('postConsultation.saved'));
      setSummary('');
      setDiagnosis('');
      setRecommendations('');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || t('postConsultation.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {t('postConsultation.title')}
          </DialogTitle>
          <DialogDescription>
            {t('postConsultation.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs font-medium">{t('postConsultation.summary')}</Label>
            <Textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder={t('postConsultation.summaryPlaceholder')}
              rows={3}
            />
          </div>

          <div>
            <Label className="text-xs font-medium">{t('postConsultation.diagnosis')}</Label>
            <Textarea
              value={diagnosis}
              onChange={e => setDiagnosis(e.target.value)}
              placeholder={t('postConsultation.diagnosisPlaceholder')}
              rows={2}
            />
          </div>

          <div>
            <Label className="text-xs font-medium">{t('postConsultation.recommendations')}</Label>
            <Textarea
              value={recommendations}
              onChange={e => setRecommendations(e.target.value)}
              placeholder={t('postConsultation.recommendationsPlaceholder')}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button variant="ghost" onClick={handleSkip} disabled={isSaving}>
            {t('postConsultation.skip')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {t('postConsultation.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
