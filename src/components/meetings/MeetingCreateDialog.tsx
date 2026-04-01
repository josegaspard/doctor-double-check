import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
import { Loader2, Search, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

const SPECIALTIES = [
  'Cardiología', 'Neurología', 'Oncología', 'Radiología',
  'Medicina Interna', 'Cirugía General', 'Pediatría',
  'Ginecología', 'Dermatología', 'Oftalmología', 'Otra',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface InviteeDoc {
  id: string;
  name: string;
  specialty?: string;
}

export function MeetingCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const { user, role } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', specialty: '', caseSummary: '', scheduledAt: '', meetingType: 'case_discussion' as 'case_discussion' | 'resident_class',
  });

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

      // Search doctors and residents (via doctor_profiles)
      let query = supabase
        .from('doctor_profiles')
        .select('user_id, specialty')
        .neq('user_id', user?.id || '');

      // If resident, restrict to accepted connections only
      if (allowedDoctorIds) {
        query = query.in('user_id', allowedDoctorIds);
      }

      const { data: docProfiles } = await query.limit(20);

      if (docProfiles && docProfiles.length > 0) {
        const userIds = docProfiles.map(d => d.user_id);
        const { data } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds)
          .ilike('name', `%${searchQuery}%`)
          .limit(6);

        const specMap: Record<string, string> = {};
        docProfiles.forEach(d => { specMap[d.user_id] = d.specialty; });

        setSearchResults((data || []).map(d => ({
          id: d.id,
          name: d.name,
          specialty: specMap[d.id],
        })));
      } else {
        setSearchResults([]);
      }
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

  const handleCreate = async () => {
    if (!form.title.trim() || !form.specialty || !user?.id) return;
    setIsCreating(true);

    try {
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
        })
        .select('id')
        .single();

      if (error) throw error;

      // Create invitations for selected doctors
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
      }

      toast.success('Reunión creada exitosamente');
      onOpenChange(false);
      setForm({ title: '', description: '', specialty: '', caseSummary: '', scheduledAt: '', meetingType: 'case_discussion' });
      setSelectedInvitees([]);
      onCreated();
    } catch (error: any) {
      toast.error(error.message || 'Error al crear la reunión');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Reunión</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs font-medium">Título *</Label>
            <Input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Ej: Revisión de caso clínico de cardiopatía"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Especialidad *</Label>
            <Select value={form.specialty} onValueChange={v => setForm({ ...form, specialty: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium">Fecha y hora</Label>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Resumen del caso</Label>
            <Textarea
              value={form.caseSummary}
              onChange={e => setForm({ ...form, caseSummary: e.target.value })}
              placeholder="Describe brevemente el caso a discutir..."
              rows={3}
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Descripción</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Notas adicionales, agenda, materiales a revisar..."
              rows={2}
            />
          </div>

          {/* Invite doctors */}
          <div>
            <Label className="text-xs font-medium flex items-center gap-1.5 mb-2">
              <UserPlus className="w-3.5 h-3.5" />
              Invitar participantes
            </Label>

            {selectedInvitees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedInvitees.map(doc => (
                  <Badge key={doc.id} variant="secondary" className="gap-1 text-xs pr-1">
                    {doc.name}
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
                placeholder="Buscar doctor por nombre..."
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
                    key={doc.id}
                    onClick={() => addInvitee(doc)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
                  >
                    <span>{doc.name}</span>
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
            Crear reunión
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
