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
import { Plus, Pencil, Trash2, Search, Building2, Star, MapPin, Phone, Globe, Loader2 } from 'lucide-react';

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

  const filtered = hospitals.filter(h => {
    if (filterType !== 'all' && h.type !== filterType) return false;
    if (search && !h.name.toLowerCase().includes(search.toLowerCase()) && !h.address.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              {es ? 'Hospitales y Clínicas' : 'Hospitals & Clinics'}
            </h1>
            <p className="text-sm text-muted-foreground">{es ? 'Administra el directorio de hospitales' : 'Manage the hospital directory'}</p>
          </div>
          <Button onClick={openCreate} className="gap-1.5">
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
                    <Button variant="ghost" size="icon" onClick={() => openEdit(h)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleActive(h.id, h.is_active)}>
                      <span className={`w-2 h-2 rounded-full ${h.is_active ? 'bg-green-500' : 'bg-muted-foreground'}`} />
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
      </div>
    </MainLayout>
  );
}
