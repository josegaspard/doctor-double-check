import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search, UserPlus, Send, Check } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const externalSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded?: () => void;
}

interface PatientResult {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  country_code: string | null;
}

export function AddPatientModal({ open, onOpenChange, onAdded }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useState<'registered' | 'external'>('registered');

  // Search registered (LIVE)
  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PatientResult[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<number | null>(null);

  // External
  const [extName, setExtName] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const [extPhone, setExtPhone] = useState('');
  const [extNotes, setExtNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Debounced live search
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = term.trim();
    if (q.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('search_patients_for_doctor', {
          p_term: q,
          p_limit: 12,
        });
        if (error) {
          console.error('search_patients_for_doctor error', error);
          toast.error(error.message);
          setResults([]);
          return;
        }
        setResults((data || []) as PatientResult[]);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [term]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTerm(''); setResults([]); setInvitedIds(new Set());
      setExtName(''); setExtEmail(''); setExtPhone(''); setExtNotes('');
    }
  }, [open]);

  const handleInvite = async (patient: PatientResult) => {
    if (!user?.id) return;
    if (invitedIds.has(patient.user_id)) return;
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: patient.user_id,
        type: 'system' as any,
        title: t('addPatientModal.notificationTitle'),
        message: t('addPatientModal.notificationMessage'),
        data: { doctor_id: user.id, action: 'request_vault_access' },
      });
      if (error) throw error;
      setInvitedIds(prev => new Set(prev).add(patient.user_id));
      toast.success(`${t('addPatientModal.invitationSentTo')} ${patient.name || t('addPatientModal.patientFallback')}`);
      onAdded?.();
    } catch (e: any) {
      toast.error(e.message || t('addPatientModal.errorInviteFailed'));
    }
  };

  const handleAddExternal = async () => {
    if (!user?.id) return;
    const parsed = externalSchema.safeParse({
      full_name: extName,
      email: extEmail || undefined,
      phone: extPhone || undefined,
      notes: extNotes || undefined,
    });
    if (!parsed.success) {
      toast.error(t('addPatientModal.errorValidation'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('external_patients' as any).insert({
        doctor_id: user.id,
        full_name: parsed.data.full_name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || null,
      });
      if (error) throw error;
      toast.success(t('addPatientModal.externalPatientAdded'));
      onAdded?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || t('addPatientModal.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> {t('addPatientModal.title')}</DialogTitle>
          <DialogDescription>
            {t('addPatientModal.description')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="registered">{t('addPatientModal.tabRegistered')}</TabsTrigger>
            <TabsTrigger value="external">{t('addPatientModal.tabExternal')}</TabsTrigger>
          </TabsList>

          <TabsContent value="registered" className="space-y-3 pt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={term}
                onChange={e => setTerm(e.target.value)}
                placeholder={t('addPatientModal.searchPlaceholder')}
                className="pl-9 pr-9 h-11"
                autoFocus
                maxLength={100}
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>

            <div className="space-y-1.5 max-h-80 overflow-auto -mx-1 px-1">
              {term.trim().length === 0 && (
                <div className="text-center py-6">
                  <Search className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">{t('addPatientModal.searchHint')}</p>
                </div>
              )}
              {!searching && term.trim().length > 0 && results.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">{t('addPatientModal.noResultsFor')} "<strong>{term}</strong>"</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('addPatientModal.noResultsHint')}</p>
                </div>
              )}
              {results.map((r) => {
                const alreadyInvited = invitedIds.has(r.user_id);
                return (
                  <div key={r.user_id} className="flex items-center gap-2 p-2.5 rounded-md border border-border hover:bg-muted/40 transition-colors">
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarImage src={r.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {(r.name || r.email || '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.name || t('addPatientModal.noName')}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={alreadyInvited ? 'outline' : 'default'}
                      disabled={alreadyInvited}
                      onClick={() => handleInvite(r)}
                      className="flex-shrink-0 gap-1"
                    >
                      {alreadyInvited ? <><Check className="w-3.5 h-3.5" /> {t('addPatientModal.sent')}</> : <><Send className="w-3.5 h-3.5" /> {t('addPatientModal.invite')}</>}
                    </Button>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="external" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>{t('addPatientModal.fullNameLabel')}</Label>
              <Input value={extName} onChange={e => setExtName(e.target.value)} maxLength={120} placeholder={t('addPatientModal.fullNamePlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>{t('addPatientModal.emailLabel')}</Label>
                <Input value={extEmail} onChange={e => setExtEmail(e.target.value)} maxLength={255} type="email" placeholder={t('addPatientModal.optional')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('addPatientModal.phoneLabel')}</Label>
                <Input value={extPhone} onChange={e => setExtPhone(e.target.value)} maxLength={30} placeholder={t('addPatientModal.optional')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('addPatientModal.notesLabel')}</Label>
              <Input value={extNotes} onChange={e => setExtNotes(e.target.value)} maxLength={500} placeholder={t('addPatientModal.notesPlaceholder')} />
            </div>
            <DialogFooter className="pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('addPatientModal.cancel')}</Button>
              <Button onClick={handleAddExternal} disabled={saving || !extName.trim()}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} {t('addPatientModal.savePatient')}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
