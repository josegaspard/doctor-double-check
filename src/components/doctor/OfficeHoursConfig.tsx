import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return { value: `${hour}:00:00`, label: `${hour}:00` };
});

export function OfficeHoursConfig() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [startTime, setStartTime] = useState('08:00:00');
  const [endTime, setEndTime] = useState('20:00:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);

  useEffect(() => {
    const fetchOfficeHours = async () => {
      if (!user?.id) return;

      try {
        const { data } = await supabase
          .from('doctor_profiles')
          .select('office_hours_start, office_hours_end, office_days')
          .eq('user_id', user.id)
          .single();

        if (data) {
          setStartTime(data.office_hours_start || '08:00:00');
          setEndTime(data.office_hours_end || '20:00:00');
          setSelectedDays(data.office_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
        }
      } catch (error) {
        console.error('Error fetching office hours:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOfficeHours();
  }, [user?.id]);

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('doctor_profiles')
        .update({
          office_hours_start: startTime,
          office_hours_end: endTime,
          office_days: selectedDays,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Horarios de atención actualizados');
    } catch (error) {
      console.error('Error saving office hours:', error);
      toast.error('Error al guardar los horarios');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTimeDisplay = (time: string) => {
    return time.slice(0, 5);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Horarios de Atención
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Time Range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Hora de inicio</Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map(hour => (
                  <SelectItem key={hour.value} value={hour.value}>
                    {hour.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Hora de cierre</Label>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map(hour => (
                  <SelectItem key={hour.value} value={hour.value}>
                    {hour.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Days of Week */}
        <div className="space-y-3">
          <Label>Días de atención</Label>
          <div className="space-y-2">
            {DAYS_OF_WEEK.map(day => (
              <div key={day.value} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">{day.label}</span>
                <Switch
                  checked={selectedDays.includes(day.value)}
                  onCheckedChange={() => toggleDay(day.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-muted-foreground">
            <strong>Vista previa:</strong> Atiendes de {formatTimeDisplay(startTime)} a {formatTimeDisplay(endTime)} los{' '}
            {selectedDays.length > 0 
              ? DAYS_OF_WEEK.filter(d => selectedDays.includes(d.value)).map(d => d.label).join(', ')
              : 'ningún día seleccionado'
            }
          </p>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Guardar Horarios
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}