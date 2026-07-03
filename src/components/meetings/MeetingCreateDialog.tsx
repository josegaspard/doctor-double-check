import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, Stethoscope, UserPlus, X, Globe, Lock, Languages, Award } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

import { useSpecialties } from '@/hooks/useSpecialties';
import { SearchableFilter } from '@/components/filters/SearchableFilter';
import { Congress, fetchOpenCongresses } from '@/lib/congresses';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  // Congresos (cliente 2026-07-02): si la reunión nace desde un congreso,
  // llega preseleccionado y la reunión queda guardada dentro de él.
  defaultCongressId?: string;
  editing?: {
    id: string;
    title: string;
    description?: string;
    specialty: string;
    caseSummary?: string;
    scheduledAt?: Date | null;
    meetingType?: 'case_discussion' | 'resident_class';
    isPublic?: boolean;
    translateEnabled?: boolean;
    translateTargetLang?: string | null;
    congressId?: string | null;
  } | null;
}

interface InviteeDoc {
  id: string;
  name: string;
  specialty?: string;
  inviteeType?: 'doctor' | 'resident' | 'patient';
}

export function MeetingCreateDialog({ open, onOpenChange, onCreated, editing, defaultCongressId }: Props) {
  const { user, role } = useAuth();
  const { specialtiesList: SPECIALTIES } = useSpecialties();
  const { t } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  // ¿El creador es doctor con medalla? Habilita la opción "reunión solo medallas".
  const [isGoldDoctor, setIsGoldDoctor] = useState(false);
  useEffect(() => {
    if (role !== 'doctor' || !user?.id) { setIsGoldDoctor(false); return; }
    supabase.from('doctor_profiles').select('manual_badge').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setIsGoldDoctor((data as any)?.manual_badge === 'gold'));
  }, [role, user?.id]);
  const [form, setForm] = useState({
    title: '', description: '', specialty: '', caseSummary: '', scheduledAt: '',
    meetingType: 'case_discussion' as 'case_discussion' | 'resident_class',
    isPublic: false,
    goldOnly: false,
    translateEnabled: false,
    translateTargetLang: 'en',
    congressId: '' as string,
  });
  const isEditing = !!editing;

  // Congresos abiertos para el selector "guardar esta reunión en un congreso".
  const [congresses, setCongresses] = useState<Congress[]>([]);
  useEffect(() => {
    if (!open) return;
    fetchOpenCongresses().then(setCongresses).catch(() => setCongresses([]));
  }, [open]);

  // Pre-fill form on edit mode open
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title || '',
        description: editing.description || '',
        specialty: editing.specialty || '',
        caseSummary: editing.caseSummary || '',
        scheduledAt: editing.scheduledAt
          ? new Date(editing.scheduledAt.getTime() - editing.scheduledAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
          : '',
        meetingType: editing.meetingType || 'case_discussion',
        isPublic: editing.isPublic ?? false,
        goldOnly: (editing as any).goldOnly ?? false,
        translateEnabled: editing.translateEnabled ?? false,
        translateTargetLang: editing.translateTargetLang ?? 'en',
        congressId: editing.congressId || '',
      });
    } else {
      setForm({ title: '', description: '', specialty: '', caseSummary: '', scheduledAt: '',
        meetingType: 'case_discussion', isPublic: false, goldOnly: false, translateEnabled: false, translateTargetLang: 'en',
        congressId: defaultCongressId || '' });
    }
  }, [open, editing?.id, defaultCongressId]);

  // Doctor search for invitations
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InviteeDoc[]>([]);
  const [selectedInvitees, setSelectedInvitees] = useState<InviteeDoc[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }

    const timer = setTimeout(async () => {
      setIsSearching(true);

      // For residents, only allow inviting doctors with accepted connections
      let allowedDoctorIds: string[] | null = null;
      if (role === 'resident' && user?.id) {
        const { data: connections } = await supabase
          .from('doctor_resident_connections')
          .select('doctor_id')
          .eq('resident_id', user.id)
          .eq('status', 'accepted');
        allowedDoctorIds = (connections || []).map(c => c.doctor_id);
        if (allowedDoctorIds.length === 0) {
          setSearchResults([]);
          setIsSearching(false);
          return;
        }
      }

      // Search doctors/residents (via doctor_profiles) + pacientes (via profiles_public)
      const results: InviteeDoc[] = [];

      // 1) Doctores / residentes
      let docQuery = supabase
        .from('doctor_profiles')
        .select('user_id, specialty')
        .neq('user_id', user?.id || '');
      if (allowedDoctorIds) docQuery = docQuery.in('user_id', allowedDoctorIds);
      const { data: docProfiles } = await docQuery.limit(20);

      if (docProfiles && docProfiles.length > 0) {
        const userIds = docProfiles.map(d => d.user_id);
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds)
          .ilike('name', `%${searchQuery}%`)
          .limit(6);
        const specMap: Record<string, string> = {};
        docProfiles.forEach(d => { specMap[d.user_id] = d.specialty; });
        (profs || []).forEach(d => results.push({ id: d.id, name: d.name, specialty: specMap[d.id], inviteeType: 'doctor' }));
      }

      // 2) Pacientes — solo si el organizador es doctor (no residente).
      // profiles_public es la vista filtrada con name+email accesible a authenticated users.
      if (role === 'doctor') {
        const { data: patProfiles } = await supabase
          .from('profiles_public')
          .select('id, name')
          .ilike('name', `%${searchQuery}%`)
          .neq('id', user?.id || '')
          .limit(6);
        // Validar que sean pacientes consultando user_roles
        if (patProfiles && patProfiles.length > 0) {
          const patIds = patProfiles.map((p: any) => p.id);
          const { data: roles } = await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', patIds)
            .eq('role', 'patient');
          const patientSet = new Set((roles || []).map((r: any) => r.user_id));
          patProfiles.forEach((p: any) => {
            if (patientSet.has(p.id)) results.push({ id: p.id, name: p.name, inviteeType: 'patient' });
          });
        }
      }

      setSearchResults(results.slice(0, 10));
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user?.id]);

  const addInvitee = (doc: InviteeDoc) => {
    if (!selectedInvitees.find(d => d.id === doc.id)) {
      setSelectedInvitees(prev => [...prev, doc]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeInvitee = (id: string) => {
    setSelectedInvitees(prev => prev.filter(d => d.id !== id));
  };

  // Notificar a los invitados de una reunión: campanilla (tabla notifications,
  // type 'system' permitido para doctores aprobados) + push best-effort.
  // El correo de reunión requiere una edge function dedicada (pendiente de deploy).
  const notifyInvitees = async (
    invitees: { id: string; name?: string }[],
    sessionId: string,
    meetingTitle: string,
  ) => {
    if (!invitees.length || !user?.id) return;
    const title = t('meetingCreateDialog.notifyTitle');
    const message = t('meetingCreateDialog.notifyMessage').replace('{title}', meetingTitle || '');
    const rows = invitees.map(inv => ({
      user_id: inv.id,
      type: 'system' as const,
      title,
      message,
      data: { kind: 'meeting_invite', session_id: sessionId, meeting_title: meetingTitle },
    }));
    try {
      const { error } = await supabase.from('notifications').insert(rows as any);
      if (error) console.error('Error notifying invitees (bell):', error);
      // Push best-effort (no bloquea si falla).
      await supabase.functions.invoke('send-push-notification', {
        body: { user_ids: invitees.map(i => i.id), title, body: message, url: '/meetings' },
      }).catch(() => {});
      // Correo best-effort (requiere desplegar la función send-meeting-invite-email).
      await supabase.functions.invoke('send-meeting-invite-email', {
        body: { session_id: sessionId, invitee_ids: invitees.map(i => i.id) },
      }).catch(() => {});
    } catch (e) {
      console.error('notifyInvitees error:', e);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.specialty || !user?.id) return;
    setIsCreating(true);

    try {
      if (isEditing && editing) {
        // UPDATE existing session
        const { error } = await supabase
          .from('clinical_sessions')
          .update({
            title: form.title,
            description: form.description || null,
            specialty: form.specialty,
            case_summary: form.caseSummary || null,
            scheduled_at: form.scheduledAt || null,
            meeting_type: form.meetingType,
            is_public: form.isPublic,
            gold_only: form.goldOnly,
            translate_enabled: form.translateEnabled,
            translate_target_lang: form.translateEnabled ? form.translateTargetLang : null,
            congress_id: form.congressId || null,
          } as any)
          .eq('id', editing.id)
          .eq('organizer_id', user.id);
        if (error) throw error;

        // Add new invitations (if any added)
        if (selectedInvitees.length > 0) {
          const newInvitations = selectedInvitees.map(doc => ({
            session_id: editing.id,
            doctor_id: doc.id,
            invitee_name: doc.name,
          }));
          await supabase.from('clinical_session_invitations').insert(newInvitations as any);
          await notifyInvitees(selectedInvitees, editing.id, form.title);
        }

        toast.success(t('meetingCreateDialog.toastUpdated'));
      } else {
        // INSERT new session
        const { data: session, error } = await supabase
          .from('clinical_sessions')
          .insert({
            title: form.title,
            description: form.description || null,
            specialty: form.specialty,
            case_summary: form.caseSummary || null,
            scheduled_at: form.scheduledAt || null,
            organizer_id: user.id,
            meeting_type: form.meetingType,
            is_public: form.isPublic,
            gold_only: form.goldOnly,
            translate_enabled: form.translateEnabled,
            translate_target_lang: form.translateEnabled ? form.translateTargetLang : null,
            congress_id: form.congressId || null,
          } as any)
          .select('id')
          .single();

        if (error) throw error;

        if (selectedInvitees.length > 0 && session) {
          const invitations = selectedInvitees.map(doc => ({
            session_id: session.id,
            doctor_id: doc.id,
            invitee_name: doc.name,
          }));
          const { error: invError } = await supabase
            .from('clinical_session_invitations')
            .insert(invitations as any);
          if (invError) console.error('Error creating invitations:', invError);
          await notifyInvitees(selectedInvitees, session.id, form.title);
        }

        toast.success(t('meetingCreateDialog.toastCreated'));
      }

      onOpenChange(false);
      setForm({ title: '', description: '', specialty: '', caseSummary: '', scheduledAt: '',
        meetingType: 'case_discussion', isPublic: false, goldOnly: false, translateEnabled: false, translateTargetLang: 'en',
        congressId: defaultCongressId || '' });
      setSelectedInvitees([]);
      onCreated();
    } catch (error: any) {
      toast.error(error.message || t('meetingCreateDialog.toastErrorSave'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('meetingCreateDialog.editTitle') : t('meetingCreateDialog.newTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs font-medium">{t('meetingCreateDialog.titleLabel')}</Label>
            <Input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder={t('meetingCreateDialog.titlePlaceholder')}
            />
          </div>

          <div>
            <Label className="text-xs font-medium">{t('meetingCreateDialog.meetingTypeLabel')}</Label>
            <Select value={form.meetingType} onValueChange={(v: 'case_discussion' | 'resident_class') => setForm({ ...form, meetingType: v })}>
              <SelectTrigger><SelectValue placeholder={t('meetingCreateDialog.meetingTypePlaceholder')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="case_discussion">{t('meetingCreateDialog.meetingTypeCaseDiscussion')}</SelectItem>
                <SelectItem value="resident_class">{t('meetingCreateDialog.meetingTypeResidentClass')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Congreso (cliente 2026-07-02): la reunión queda guardada dentro del
              congreso elegido, sin importar quién la cree. */}
          {(congresses.length > 0 || form.congressId) && (
            <div>
              <Label className="text-xs font-medium">{t('congresses.meetingCongressLabel')}</Label>
              <Select
                value={form.congressId || 'none'}
                onValueChange={(v) => setForm({ ...form, congressId: v === 'none' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder={t('congresses.meetingCongressNone')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('congresses.meetingCongressNone')}</SelectItem>
                  {congresses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.congressId && (
                <p className="text-[11px] text-muted-foreground mt-1">{t('congresses.meetingCongressHint')}</p>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs font-medium">{t('meetingCreateDialog.specialtyLabel')}</Label>
            <SearchableFilter
              options={SPECIALTIES}
              value={form.specialty}
              onChange={v => setForm({ ...form, specialty: v })}
              placeholder={t('meetingCreateDialog.specialtyPlaceholder')}
              searchPlaceholder={t('meetingCreateDialog.specialtySearchPlaceholder')}
              icon={Stethoscope}
              allLabel=""
            />
          </div>

          <div>
            <Label className="text-xs font-medium">{t('meetingCreateDialog.scheduledAtLabel')}</Label>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs font-medium">{t('meetingCreateDialog.caseSummaryLabel')}</Label>
            <Textarea
              value={form.caseSummary}
              onChange={e => setForm({ ...form, caseSummary: e.target.value })}
              placeholder={t('meetingCreateDialog.caseSummaryPlaceholder')}
              rows={3}
            />
          </div>

          <div>
            <Label className="text-xs font-medium">{t('meetingCreateDialog.descriptionLabel')}</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder={t('meetingCreateDialog.descriptionPlaceholder')}
              rows={2}
            />
          </div>

          {/* Visibility — public vs private (invite-only) */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                {form.isPublic ? <Globe className="w-4 h-4 mt-0.5 text-primary" /> : <Lock className="w-4 h-4 mt-0.5 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">{form.isPublic ? t('meetingCreateDialog.visibilityPublicTitle') : t('meetingCreateDialog.visibilityPrivateTitle')}</p>
                  <p className="text-xs text-muted-foreground">
                    {form.isPublic
                      ? t('meetingCreateDialog.visibilityPublicDescription')
                      : t('meetingCreateDialog.visibilityPrivateDescription')}
                  </p>
                </div>
              </div>
              <Switch
                checked={form.isPublic}
                onCheckedChange={(v) => setForm({ ...form, isPublic: v })}
                aria-label={t('meetingCreateDialog.visibilityToggleAria')}
              />
            </div>

            {/* Reunión exclusiva entre medallas — solo visible para doctores con 🥇 (cliente 2026-06-29). */}
            {isGoldDoctor && (
              <div className="flex items-start justify-between gap-3 pt-3 border-t border-border">
                <div className="flex items-start gap-2">
                  <Award className="w-4 h-4 mt-0.5 text-premium" />
                  <div>
                    <p className="text-sm font-medium">{t('meetingCreateDialog.goldOnlyTitle')}</p>
                    <p className="text-xs text-muted-foreground">{t('meetingCreateDialog.goldOnlyDescription')}</p>
                  </div>
                </div>
                <Switch
                  checked={form.goldOnly}
                  onCheckedChange={(v) => setForm({ ...form, goldOnly: v })}
                  aria-label={t('meetingCreateDialog.goldOnlyTitle')}
                />
              </div>
            )}

            <div className="flex items-start justify-between gap-3 pt-3 border-t border-border">
              <div className="flex items-start gap-2">
                <Languages className="w-4 h-4 mt-0.5 text-sky-600" />
                <div>
                  <p className="text-sm font-medium">{t('meetingCreateDialog.liveTranslatorTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('meetingCreateDialog.liveTranslatorDescription')}</p>
                </div>
              </div>
              <Switch
                checked={form.translateEnabled}
                onCheckedChange={(v) => setForm({ ...form, translateEnabled: v })}
                aria-label={t('meetingCreateDialog.liveTranslatorToggleAria')}
              />
            </div>

            {form.translateEnabled && (
              <div>
                <Label className="text-xs font-medium">{t('meetingCreateDialog.targetLangLabel')}</Label>
                <Select
                  value={form.translateTargetLang}
                  onValueChange={(v) => setForm({ ...form, translateTargetLang: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">{t('meetingCreateDialog.langSpanish')}</SelectItem>
                    <SelectItem value="en">{t('meetingCreateDialog.langEnglish')}</SelectItem>
                    <SelectItem value="pt">{t('meetingCreateDialog.langPortuguese')}</SelectItem>
                    <SelectItem value="fr">{t('meetingCreateDialog.langFrench')}</SelectItem>
                    <SelectItem value="it">{t('meetingCreateDialog.langItalian')}</SelectItem>
                    <SelectItem value="de">{t('meetingCreateDialog.langGerman')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Invite doctors */}
          <div>
            <Label className="text-xs font-medium flex items-center gap-1.5 mb-2">
              <UserPlus className="w-3.5 h-3.5" />
              {t('meetingCreateDialog.inviteParticipantsLabel')} {form.isPublic && <span className="text-muted-foreground font-normal">{t('meetingCreateDialog.inviteOptionalPublic')}</span>}
            </Label>

            {selectedInvitees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedInvitees.map(doc => (
                  <Badge key={doc.id} variant="secondary" className="gap-1 text-xs pr-1">
                    {doc.name}
                    {doc.inviteeType === 'doctor' && <DoctorBadgeIcon userId={doc.id} size="sm" className="flex-shrink-0" />}
                    {doc.specialty && <span className="opacity-60">· {doc.specialty}</span>}
                    <button onClick={() => removeInvitee(doc.id)} className="ml-0.5 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={role === 'doctor' ? t('meetingCreateDialog.searchPlaceholderDoctor') : t('meetingCreateDialog.searchPlaceholderResident')}
                className="pl-8 text-sm"
              />
              {isSearching && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="mt-1 border border-border rounded-md bg-popover shadow-md max-h-40 overflow-y-auto">
                {searchResults.map(doc => (
                  <button
                    key={`${doc.inviteeType || 'doctor'}-${doc.id}`}
                    onClick={() => addInvitee(doc)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      {doc.name}
                      {doc.inviteeType === 'doctor' && <DoctorBadgeIcon userId={doc.id} size="sm" className="flex-shrink-0" />}
                      {doc.inviteeType === 'patient' && (
                        <Badge variant="info" className="text-[10px]">{t('meetingCreateDialog.patientBadge')}</Badge>
                      )}
                    </span>
                    {doc.specialty && (
                      <Badge variant="outline" className="text-[10px]">{doc.specialty}</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={isCreating || !form.title.trim() || !form.specialty}
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isEditing ? t('meetingCreateDialog.saveChanges') : t('meetingCreateDialog.create')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
