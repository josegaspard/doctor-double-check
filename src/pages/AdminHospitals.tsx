import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Building2, Star, MapPin, Phone, Globe, Loader2, Stethoscope, Check, ArrowLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';

interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  type: string;
  level: string | null;
  specialties: string[];
  hours: string | null;
  zone: string | null;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  is_active: boolean;
}

const emptyHospital = {
  name: '', address: '', phone: '', website: '', type: 'public', level: '3er nivel',
  specialties: '', hours: '', zone: '', image_url: '', lat: '', lng: '', description: '', is_active: true,
};

export default function AdminHospitals() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  const es = language === 'es';
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyHospital);
  const [saving, setSaving] = useState(false);

  // Doctor assignment modal state
  const [docsDialogHospital, setDocsDialogHospital] = useState<Hospital | null>(null);
  const [allDoctors, setAllDoctors] = useState<any[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [primaryIds, setPrimaryIds] = useState<Set<string>>(new Set());
  const [docsSearch, setDocsSearch] = useState('');
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsSaving, setDocsSaving] = useState(false);

  useEffect(() => {
    if (role && role !== 'admin') { navigate('/'); }
  }, [role, navigate]);

  const fetchHospitals = async () => {
    setLoading(true);
    const { data } = await supabase.from('hospitals').select('*').order('name');
    setHospitals((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (role === 'admin') fetchHospitals(); }, [role]);

  const openCreate = () => { setEditingId(null); setForm(emptyHospital); setDialogOpen(true); };
  const openEdit = (h: Hospital) => {
    setEditingId(h.id);
    setForm({
      name: h.name, address: h.address, phone: h.phone || '', website: h.website || '',
      type: h.type, level: h.level || '', specialties: Array.isArray(h.specialties) ? h.specialties.join(', ') : '',
      hours: h.hours || '', zone: h.zone || '', image_url: h.image_url || '',
      lat: h.lat?.toString() || '', lng: h.lng?.toString() || '', description: h.description || '',
      is_active: h.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.address) { toast.error(es ? 'Nombre y dirección son requeridos' : 'Name and address are required'); return; }
    setSaving(true);
    const payload = {
      name: form.name, address: form.address, phone: form.phone || null, website: form.website || null,
      type: form.type, level: form.level || null,
      specialties: form.specialties ? form.specialties.split(',').map(s => s.trim()).filter(Boolean) : [],
      hours: form.hours || null, zone: form.zone || null, image_url: form.image_url || null,
      lat: form.lat ? parseFloat(form.lat) : null, lng: form.lng ? parseFloat(form.lng) : null,
      description: form.description || null, is_active: form.is_active,
    };
    if (editingId) {
      const { error } = await supabase.from('hospitals').update(payload as any).eq('id', editingId);
      if (error) toast.error(error.message); else toast.success(es ? 'Hospital actualizado' : 'Hospital updated');
    } else {
      const { error } = await supabase.from('hospitals').insert(payload as any);
      if (error) toast.error(error.message); else toast.success(es ? 'Hospital creado' : 'Hospital created');
    }
    setSaving(false); setDialogOpen(false); fetchHospitals();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(es ? '¿Eliminar este hospital?' : 'Delete this hospital?')) return;
    const { error } = await supabase.from('hospitals').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success(es ? 'Eliminado' : 'Deleted'); fetchHospitals(); }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('hospitals').update({ is_active: !active } as any).eq('id', id);
    fetchHospitals();
  };

  const openDoctorsDialog = async (h: Hospital) => {
    setDocsDialogHospital(h);
    setDocsSearch('');
    setDocsLoading(true);
    const [{ data: docs }, { data: profs }, { data: assigned }] = await Promise.all([
      supabase.from('doctor_profiles').select('id, user_id, specialty, rating, status').eq('status', 'approved').order('rating', { ascending: false }),
      supabase.from('profiles').select('id, name, avatar_url'),
      supabase.from('hospital_doctors').select('doctor_id, is_primary').eq('hospital_id', h.id),
    ]);
    const profMap: Record<string, any> = {};
    (profs || []).forEach((p: any) => { profMap[p.id] = p; });
    const merged = (docs || []).map((d: any) => ({
      ...d,
      name: profMap[d.user_id]?.name || null,
      avatar_url: profMap[d.user_id]?.avatar_url || null,
    }));
    setAllDoctors(merged);
    setAssignedIds(new Set(((assigned as any[]) || []).map((a) => a.doctor_id)));
    setPrimaryIds(new Set(((assigned as any[]) || []).filter((a) => a.is_primary).map((a) => a.doctor_id)));
    setDocsLoading(false);
  };

  const toggleAssign = (doctorId: string) => {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(doctorId)) { next.delete(doctorId); setPrimaryIds((p) => { const q = new Set(p); q.delete(doctorId); return q; }); }
      else next.add(doctorId);
      return next;
    });
  };

  const togglePrimary = (doctorId: string) => {
    setPrimaryIds((prev) => {
      const next = new Set(prev);
      if (next.has(doctorId)) next.delete(doctorId);
      else { next.add(doctorId); setAssignedIds((a) => new Set(a).add(doctorId)); }
      return next;
    });
  };

  const saveDoctorAssignments = async () => {
    if (!docsDialogHospital) return;
    setDocsSaving(true);
    const hospitalId = docsDialogHospital.id;
    const { data: existing } = await supabase.from('hospital_doctors').select('doctor_id').eq('hospital_id', hospitalId);
    const existingIds = new Set(((existing as any[]) || []).map((e) => e.doctor_id));
    const toAdd = [...assignedIds].filter((id) => !existingIds.has(id));
    const toRemove = [...existingIds].filter((id) => !assignedIds.has(id));

    if (toRemove.length > 0) {
      await supabase.from('hospital_doctors').delete().eq('hospital_id', hospitalId).in('doctor_id', toRemove);
    }
    if (toAdd.length > 0) {
      const rows = toAdd.map((doctor_id, i) => ({
        hospital_id: hospitalId, doctor_id, is_primary: primaryIds.has(doctor_id), sort_order: i,
      }));
      await supabase.from('hospital_doctors').insert(rows as any);
    }
    // Sync is_primary flag for already-present rows
    const stillAssigned = [...assignedIds].filter((id) => existingIds.has(id));
    for (const id of stillAssigned) {
      await supabase.from('hospital_doctors').update({ is_primary: primaryIds.has(id) } as any).eq('hospital_id', hospitalId).eq('doctor_id', id);
    }

    toast.success(es ? 'Doctores actualizados' : 'Doctors updated');
    setDocsSaving(false);
    setDocsDialogHospital(null);
  };

  const filteredDocs = allDoctors.filter((d) => {
    if (!docsSearch) return true;
    const q = docsSearch.toLowerCase();
    return (d.name || '').toLowerCase().includes(q) || (d.specialty || '').toLowerCase().includes(q);
  });

  const filtered = hospitals.filter(h => {
    if (filterType !== 'all' && h.type !== filterType) return false;
    if (search && !h.name.toLowerCase().includes(search.toLowerCase()) && !h.address.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-3 -ml-2 text-white hover:bg-white/10 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> {es ? 'Volver al panel' : 'Back to admin'}
        </Button>
        <div className="mb-6 rounded-2xl bg-white border-2 border-primary/30 shadow-md p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-secondary truncate">
                {es ? 'Hospitales y Clínicas' : 'Hospitals & Clinics'}
              </h1>
              <p className="text-xs sm:text-sm text-secondary/70">{es ? 'Administra el directorio de hospitales' : 'Manage the hospital directory'}</p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-1.5 flex-shrink-0">
            <Plus className="w-4 h-4" /> {es ? 'Agregar' : 'Add'}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={es ? 'Buscar hospital...' : 'Search hospital...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{es ? 'Todos' : 'All'}</SelectItem>
              <SelectItem value="public">{es ? 'Público' : 'Public'}</SelectItem>
              <SelectItem value="private">{es ? 'Privado' : 'Private'}</SelectItem>
              <SelectItem value="clinic">{es ? 'Clínica' : 'Clinic'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {filtered.map(h => (
              <Card key={h.id} className={`${!h.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="p-4 flex items-start gap-4">
                  {h.image_url && (
                    <img src={h.image_url} alt={h.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0 hidden sm:block" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-sm sm:text-base truncate">{h.name}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {h.address}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge variant={h.type === 'public' ? 'default' : 'secondary'} className="text-[10px]">
                          {h.type === 'public' ? (es ? 'Público' : 'Public') : h.type === 'private' ? (es ? 'Privado' : 'Private') : (es ? 'Clínica' : 'Clinic')}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {h.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{h.phone}</span>}
                      {h.website && <span className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" />{es ? 'Sitio web' : 'Website'}</span>}
                      {h.zone && <Badge variant="outline" className="text-[10px]">{h.zone}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2" onClick={() => openDoctorsDialog(h)} title={es ? 'Doctores' : 'Doctors'}>
                      <Stethoscope className="w-4 h-4" />
                      <span className="hidden sm:inline text-xs">{es ? 'Doctores' : 'Doctors'}</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(h)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleActive(h.id, h.is_active)}>
                      <span className={`w-2 h-2 rounded-full ${h.is_active ? 'bg-success' : 'bg-muted-foreground'}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(h.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{es ? 'No hay hospitales' : 'No hospitals'}</p>}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? (es ? 'Editar Hospital' : 'Edit Hospital') : (es ? 'Agregar Hospital' : 'Add Hospital')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>{es ? 'Nombre' : 'Name'} *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>{es ? 'Dirección' : 'Address'} *</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{es ? 'Teléfono' : 'Phone'}</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><Label>{es ? 'Sitio Web' : 'Website'}</Label><Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{es ? 'Tipo' : 'Type'}</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">{es ? 'Público' : 'Public'}</SelectItem>
                      <SelectItem value="private">{es ? 'Privado' : 'Private'}</SelectItem>
                      <SelectItem value="clinic">{es ? 'Clínica' : 'Clinic'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{es ? 'Nivel' : 'Level'}</Label><Input value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} placeholder="3er nivel" /></div>
              </div>
              <div><Label>{es ? 'Zona' : 'Zone'}</Label><Input value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} placeholder="Centro, Norte, Sur..." /></div>
              <div><Label>{es ? 'Especialidades (separadas por coma)' : 'Specialties (comma separated)'}</Label><Input value={form.specialties} onChange={e => setForm(f => ({ ...f, specialties: e.target.value }))} /></div>
              <div><Label>{es ? 'Horario' : 'Hours'}</Label><Input value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder="Urgencias 24h" /></div>
              <div><Label>{es ? 'URL de Imagen' : 'Image URL'}</Label><Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Latitud</Label><Input type="number" step="any" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} /></div>
                <div><Label>Longitud</Label><Input type="number" step="any" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} /></div>
              </div>
              <div><Label>{es ? 'Descripción' : 'Description'}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>{es ? 'Activo' : 'Active'}</Label>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? (es ? 'Guardar Cambios' : 'Save Changes') : (es ? 'Crear Hospital' : 'Create Hospital'))}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!docsDialogHospital} onOpenChange={(open) => !open && setDocsDialogHospital(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-primary" />
                {es ? 'Doctores en' : 'Doctors at'} {docsDialogHospital?.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {es
                  ? 'Asigna los médicos que atienden en esta clínica. Marca como principal a los destacados.'
                  : 'Assign doctors who practice at this clinic. Mark featured ones as primary.'}
              </p>
            </DialogHeader>

            <div className="relative mb-2 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={es ? 'Buscar por nombre o especialidad...' : 'Search by name or specialty...'}
                value={docsSearch}
                onChange={(e) => setDocsSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
              {docsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : filteredDocs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">{es ? 'Sin doctores aprobados' : 'No approved doctors'}</p>
              ) : (
                filteredDocs.map((d: any) => {
                  const assigned = assignedIds.has(d.id);
                  const primary = primaryIds.has(d.id);
                  return (
                    <div
                      key={d.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                        assigned ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      <Checkbox checked={assigned} onCheckedChange={() => toggleAssign(d.id)} />
                      <Avatar className="w-9 h-9 border border-border">
                        <AvatarImage src={d.avatar_url || undefined} alt={d.name || 'Doctor'} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {(d.name || 'Dr').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.name ? `Dr. ${d.name}` : (es ? 'Médico' : 'Doctor')}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.specialty}
                          {Number(d.rating) > 0 && (
                            <span className="inline-flex items-center gap-0.5 ml-2">
                              <Star className="w-3 h-3 fill-warning text-warning" />
                              {Number(d.rating).toFixed(1)}
                            </span>
                          )}
                        </p>
                      </div>
                      <Button
                        variant={primary ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => togglePrimary(d.id)}
                        disabled={!assigned && !primary}
                      >
                        {primary && <Check className="w-3 h-3" />}
                        {es ? 'Principal' : 'Primary'}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t flex-shrink-0">
              <p className="text-xs text-muted-foreground">
                {assignedIds.size} {es ? 'seleccionados' : 'selected'}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setDocsDialogHospital(null)}>{es ? 'Cancelar' : 'Cancel'}</Button>
                <Button onClick={saveDoctorAssignments} disabled={docsSaving}>
                  {docsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (es ? 'Guardar' : 'Save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
