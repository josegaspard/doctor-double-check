import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Check, X, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

interface ConsultationFeeEditorProps {
  initialFee?: number;
  onFeeChanged?: (newFee: number) => void;
  variant?: 'inline' | 'card';
}

export function ConsultationFeeEditor({ initialFee, onFeeChanged, variant = 'inline' }: ConsultationFeeEditorProps) {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [fee, setFee] = useState<number>(initialFee ?? 0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedFee, setEditedFee] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialFee !== undefined) {
      setFee(initialFee);
      return;
    }
    const fetchFee = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('doctor_profiles')
        .select('consultation_fee')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setFee(Number(data.consultation_fee));
    };
    fetchFee();
  }, [user?.id, initialFee]);

  const handleStartEdit = () => {
    setEditedFee(String(fee));
    setIsEditing(true);
  };

  const handleSave = async () => {
    const newFee = parseFloat(editedFee);
    if (isNaN(newFee) || newFee < 0) {
      toast.error(t('doctorLibrary.errorUpdatingPrice'));
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ consultation_fee: newFee })
        .eq('user_id', user!.id);
      if (error) throw error;

      setFee(newFee);
      setIsEditing(false);
      toast.success(newFee === 0 ? t('doctorLibrary.freeGuidanceSet') : `${t('doctorLibrary.priceUpdated')} $${newFee} MXN`);
      onFeeChanged?.(newFee);
      refreshUser?.();
    } catch (error: any) {
      toast.error(error.message || t('doctorLibrary.errorUpdatingPrice'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedFee(String(fee));
  };

  const isFree = fee === 0;

  if (variant === 'card') {
    return (
      <div className="p-3 rounded-lg bg-muted/50 text-center">
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div key="editing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-2">
              <div className="flex items-center gap-2 justify-center">
                <span className="text-sm text-muted-foreground">$</span>
                <Input type="number" min="0" step="1" value={editedFee} onChange={(e) => setEditedFee(e.target.value)} className="w-24 h-8 text-center text-sm" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
                <span className="text-xs text-muted-foreground">MXN</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{t('doctorLibrary.freeGuidance')}</p>
              <div className="flex items-center justify-center gap-1">
                <Button size="sm" variant="default" onClick={handleSave} disabled={isSaving} className="h-7 text-xs px-2">
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancel} className="h-7 text-xs px-2">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="cursor-pointer group" onClick={handleStartEdit}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Wallet className="w-4 h-4 text-success" />
                {isFree ? (
                  <span className="font-semibold text-success">{t('doctorLibrary.free')}</span>
                ) : (
                  <span className="font-semibold">${fee}</span>
                )}
                <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-muted-foreground">{t('availability.consultation')}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Inline variant
  return (
    <div className="py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t('doctorLibrary.consultationFee')}</span>
        </div>
        {!isEditing && (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleStartEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
        )}
      </div>
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div key="editing" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input type="number" min="0" step="1" value={editedFee} onChange={(e) => setEditedFee(e.target.value)} className="flex-1" placeholder="0" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
              <span className="text-sm text-muted-foreground">MXN</span>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground ml-5">
              {t('doctorLibrary.writeFree')} <strong>0</strong> {t('doctorLibrary.forFreeGuidance')}
            </p>
          </motion.div>
        ) : (
          <motion.p key="display" className="mt-1 text-sm font-medium ml-7">
            {isFree ? (
              <Badge className="bg-success/10 text-success border-success">{t('doctorLibrary.free')}</Badge>
            ) : (
              <span>${fee} MXN</span>
            )}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
