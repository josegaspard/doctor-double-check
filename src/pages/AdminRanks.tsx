import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDoctorRanks, DoctorRank } from '@/hooks/useDoctorRanks';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DoctorBadge } from '@/components/doctor/DoctorBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';

const ICONS = ['shield', 'zap', 'award', 'star', 'crown', 'gem'];
const COLORS = ['info', 'success', 'warning', 'premium', 'purple'];

interface RankForm {
  name: string;
  display_name: string;
  icon: string;
  color: string;
  min_consultations: number;
  min_earnings: number;
  min_months_active: number;
  min_rating: number;
  sort_order: number;
}

const emptyForm: RankForm = {
  name: '',
  display_name: '',
  icon: 'shield',
  color: 'info',
  min_consultations: 0,
  min_earnings: 0,
  min_months_active: 0,
  min_rating: 0,
  sort_order: 0,
};

export default function AdminRanks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: ranks = [], isLoading } = useDoctorRanks();
  const queryClient = useQueryClient();
  const [editDialog, setEditDialog] = useState<{ open: boolean; rank: DoctorRank | null }>({ open: false, rank: null });
  const [form, setForm] = useState<RankForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  if (user?.role !== 'admin') {
    navigate('/');
    return null;
  }

  const openCreate = () => {
    setForm({ ...emptyForm, sort_order: ranks.length });
    setEditDialog({ open: true, rank: null });
  };

  const openEdit = (rank: DoctorRank) => {
    setForm({
      name: rank.name,
      display_name: rank.display_name,
      icon: rank.icon,
      color: rank.color,
      min_consultations: rank.min_consultations,
      min_earnings: rank.min_earnings,
      min_months_active: rank.min_months_active,
      min_rating: rank.min_rating,
      sort_order: rank.sort_order,
    });
    setEditDialog({ open: true, rank });
  };

  const handleSave = async () => {
    if (!form.name || !form.display_name) {
      toast.error(t('adminRanks.nameRequired'));
      return;
    }
    setIsSaving(true);
    try {
      if (editDialog.rank) {
        const { error } = await supabase
          .from('doctor_ranks')
          .update(form as any)
          .eq('id', editDialog.rank.id);
        if (error) throw error;
        toast.success(t('adminRanks.rankUpdated'));
      } else {
        const { error } = await supabase
          .from('doctor_ranks')
          .insert(form as any);
        if (error) throw error;
        toast.success(t('adminRanks.rankCreated'));
      }
      queryClient.invalidateQueries({ queryKey: ['doctor-ranks'] });
      setEditDialog({ open: false, rank: null });
    } catch (err: any) {
      toast.error(err.message || t('adminRanks.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (rank: DoctorRank) => {
    if (!confirm(t('adminRanks.confirmDelete').replace('{name}', rank.display_name))) return;
    const { error } = await supabase.from('doctor_ranks').delete().eq('id', rank.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('adminRanks.rankDeleted'));
      queryClient.invalidateQueries({ queryKey: ['doctor-ranks'] });
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="flex-shrink-0 h-9 w-9">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-2xl font-bold flex items-center gap-1.5 sm:gap-2">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
              <span className="truncate">{t('adminRanks.title')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('adminRanks.subtitle')}</p>
          </div>
          <Button onClick={openCreate} className="gap-1.5 h-9 text-xs sm:text-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('adminRanks.newRank')}</span>
            <span className="sm:hidden">{t('adminRanks.newShort')}</span>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {ranks.map(rank => (
              <Card key={rank.id}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    {/* Badge + actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <DoctorBadge rank={rank} size="lg" />
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                        <span>{t('adminRanks.consultationsLabel')} ≥ {rank.min_consultations}</span>
                        <span>{t('adminRanks.earningsLabel')} ≥ ${rank.min_earnings}</span>
                        <span>{t('adminRanks.monthsLabel')} ≥ {rank.min_months_active}</span>
                        <span>{t('adminRanks.ratingLabel')} ≥ {rank.min_rating}</span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rank)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(rank)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={editDialog.open} onOpenChange={open => setEditDialog({ ...editDialog, open })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editDialog.rank ? t('adminRanks.editRank') : t('adminRanks.newRank')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-center">
                <DoctorBadge rank={{ ...form, id: '', created_at: '' } as any} size="lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('adminRanks.internalName')}</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('adminRanks.internalNamePlaceholder')} className="h-10" />
                </div>
                <div>
                  <Label className="text-xs">{t('adminRanks.displayName')}</Label>
                  <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder={t('adminRanks.displayNamePlaceholder')} className="h-10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('adminRanks.icon')}</Label>
                  <Select value={form.icon} onValueChange={v => setForm(f => ({ ...f, icon: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ICONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('adminRanks.color')}</Label>
                  <Select value={form.color} onValueChange={v => setForm(f => ({ ...f, color: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('adminRanks.minConsultations')}</Label>
                  <Input type="number" value={form.min_consultations} onChange={e => setForm(f => ({ ...f, min_consultations: +e.target.value }))} className="h-10" />
                </div>
                <div>
                  <Label className="text-xs">{t('adminRanks.minEarnings')}</Label>
                  <Input type="number" value={form.min_earnings} onChange={e => setForm(f => ({ ...f, min_earnings: +e.target.value }))} className="h-10" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">{t('adminRanks.minMonths')}</Label>
                  <Input type="number" value={form.min_months_active} onChange={e => setForm(f => ({ ...f, min_months_active: +e.target.value }))} className="h-10" />
                </div>
                <div>
                  <Label className="text-xs">{t('adminRanks.minRating')}</Label>
                  <Input type="number" step="0.1" value={form.min_rating} onChange={e => setForm(f => ({ ...f, min_rating: +e.target.value }))} className="h-10" />
                </div>
                <div>
                  <Label className="text-xs">{t('adminRanks.sortOrder')}</Label>
                  <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: +e.target.value }))} className="h-10" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog({ open: false, rank: null })}>{t('adminRanks.cancel')}</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editDialog.rank ? t('adminRanks.save') : t('adminRanks.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
