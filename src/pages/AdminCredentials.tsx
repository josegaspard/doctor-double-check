import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ArrowLeft,
  GraduationCap,
  Award,
  Briefcase,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface CredentialItem {
  id: string;
  doctor_id: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  // Education fields
  institution?: string;
  degree?: string;
  field_of_study?: string;
  start_year?: number;
  end_year?: number;
  // Certification fields
  name?: string;
  issuing_organization?: string;
  issue_date?: string;
  expiry_date?: string;
  credential_id?: string;
  // Experience fields
  title?: string;
  organization?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  description?: string;
  // Joined
  doctor_name?: string;
}

export default function AdminCredentials() {
  const navigate = useNavigate();
  const { role, supabaseUser } = useAuth();
  const [education, setEducation] = useState<CredentialItem[]>([]);
  const [certifications, setCertifications] = useState<CredentialItem[]>([]);
  const [experience, setExperience] = useState<CredentialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      return;
    }
    fetchAll();
  }, [role]);

  const fetchAll = async () => {
    try {
      const [eduRes, certRes, expRes] = await Promise.all([
        supabase.from('doctor_education' as any).select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('doctor_certifications' as any).select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('doctor_experience' as any).select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      ]);

      // Fetch doctor names
      const allDoctorIds = new Set<string>();
      [eduRes.data, certRes.data, expRes.data].forEach(arr => {
        (arr as any[])?.forEach(item => allDoctorIds.add(item.doctor_id));
      });

      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, name')
        .in('id', Array.from(allDoctorIds));

      const nameMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

      const mapNames = (items: any[]) => items?.map(i => ({ ...i, doctor_name: nameMap.get(i.doctor_id) || 'Doctor' })) || [];

      setEducation(mapNames(eduRes.data as any));
      setCertifications(mapNames(certRes.data as any));
      setExperience(mapNames(expRes.data as any));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (table: string, id: string, status: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from(table as any)
        .update({
          status,
          admin_notes: adminNotes[id] || null,
          reviewed_by: supabaseUser?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(status === 'approved' ? 'Aprobado' : 'Rechazado');
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || 'Error');
    } finally {
      setProcessingId(null);
    }
  };

  if (role !== 'admin') return null;

  const renderItem = (item: CredentialItem, table: string) => (
    <Card key={item.id} className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">Doctor: <strong>{item.doctor_name}</strong></p>
            {item.degree && <p className="font-semibold text-sm">{item.degree} — {item.institution}</p>}
            {item.name && <p className="font-semibold text-sm">{item.name} — {item.issuing_organization}</p>}
            {item.title && <p className="font-semibold text-sm">{item.title} — {item.organization}</p>}
            {item.field_of_study && <p className="text-xs text-muted-foreground">{item.field_of_study}</p>}
            {item.location && <p className="text-xs text-muted-foreground">{item.location}</p>}
            {item.description && <p className="text-xs mt-1">{item.description}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(item.created_at).toLocaleDateString('es-MX')}
            </p>
          </div>
          <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Pendiente</Badge>
        </div>
        <Textarea
          placeholder="Notas del admin (opcional)..."
          className="mt-3 text-xs"
          rows={2}
          value={adminNotes[item.id] || ''}
          onChange={e => setAdminNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
        />
        <div className="flex gap-2 mt-2">
          <Button size="sm" className="gap-1 flex-1" onClick={() => handleAction(table, item.id, 'approved')} disabled={processingId === item.id}>
            {processingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            Aprobar
          </Button>
          <Button size="sm" variant="destructive" className="gap-1 flex-1" onClick={() => handleAction(table, item.id, 'rejected')} disabled={processingId === item.id}>
            <XCircle className="w-3 h-3" /> Rechazar
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const totalPending = education.length + certifications.length + experience.length;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" />
              Credenciales Médicas
            </h1>
            <p className="text-sm text-muted-foreground">{totalPending} pendientes de revisión</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : totalPending === 0 ? (
          <Card><CardContent className="p-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-semibold">No hay credenciales pendientes</p>
          </CardContent></Card>
        ) : (
          <Tabs defaultValue="education" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="education" className="gap-1 text-xs">
                <GraduationCap className="w-4 h-4" /> Educación ({education.length})
              </TabsTrigger>
              <TabsTrigger value="certifications" className="gap-1 text-xs">
                <Award className="w-4 h-4" /> Certificaciones ({certifications.length})
              </TabsTrigger>
              <TabsTrigger value="experience" className="gap-1 text-xs">
                <Briefcase className="w-4 h-4" /> Experiencia ({experience.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="education">{education.map(e => renderItem(e, 'doctor_education'))}</TabsContent>
            <TabsContent value="certifications">{certifications.map(c => renderItem(c, 'doctor_certifications'))}</TabsContent>
            <TabsContent value="experience">{experience.map(e => renderItem(e, 'doctor_experience'))}</TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
