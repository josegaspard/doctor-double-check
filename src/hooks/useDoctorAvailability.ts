import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AvailabilityStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
export type AvailabilityType = 'live' | 'consultation' | 'office_hours';

export interface DoctorAvailability {
  id: string;
  doctorId: string;
  doctorName?: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  durationMinutes: number;
  type: AvailabilityType;
  status: AvailabilityStatus;
  notificationsSent: boolean;
  createdAt: Date;
}

export function useDoctorAvailability() {
  const { supabaseUser, role } = useAuth();
  const [availabilities, setAvailabilities] = useState<DoctorAvailability[]>([]);
  const [myAvailabilities, setMyAvailabilities] = useState<DoctorAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAvailabilities = useCallback(async () => {
    // Fetch all upcoming public availabilities
    const { data: publicData } = await supabase
      .from('doctor_availability')
      .select('*')
      .gte('scheduled_at', new Date().toISOString())
      .in('status', ['scheduled', 'confirmed'])
      .order('scheduled_at', { ascending: true });

    if (publicData) {
      const doctorIds = [...new Set(publicData.map(a => a.doctor_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, name')
        .in('id', doctorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

      setAvailabilities(
        publicData.map(a => ({
          id: a.id,
          doctorId: a.doctor_id,
          doctorName: profileMap.get(a.doctor_id),
          title: a.title,
          description: a.description || undefined,
          scheduledAt: new Date(a.scheduled_at),
          durationMinutes: a.duration_minutes,
          type: a.type as AvailabilityType,
          status: a.status as AvailabilityStatus,
          notificationsSent: a.notifications_sent,
          createdAt: new Date(a.created_at),
        }))
      );
    }

    // If user is a doctor, fetch their own availabilities
    if (supabaseUser?.id && role === 'doctor') {
      const { data: myData } = await supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', supabaseUser.id)
        .order('scheduled_at', { ascending: false });

      if (myData) {
        setMyAvailabilities(
          myData.map(a => ({
            id: a.id,
            doctorId: a.doctor_id,
            title: a.title,
            description: a.description || undefined,
            scheduledAt: new Date(a.scheduled_at),
            durationMinutes: a.duration_minutes,
            type: a.type as AvailabilityType,
            status: a.status as AvailabilityStatus,
            notificationsSent: a.notifications_sent,
            createdAt: new Date(a.created_at),
          }))
        );
      }
    }

    setIsLoading(false);
  }, [supabaseUser?.id, role]);

  useEffect(() => {
    fetchAvailabilities();
  }, [fetchAvailabilities]);

  const createAvailability = async (data: {
    title: string;
    description?: string;
    scheduledAt: Date;
    durationMinutes: number;
    type: AvailabilityType;
  }) => {
    if (!supabaseUser?.id) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase.from('doctor_availability').insert({
      doctor_id: supabaseUser.id,
      title: data.title,
      description: data.description,
      scheduled_at: data.scheduledAt.toISOString(),
      duration_minutes: data.durationMinutes,
      type: data.type,
      status: 'scheduled',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    await fetchAvailabilities();
    return { success: true };
  };

  const updateAvailability = async (id: string, updates: Partial<DoctorAvailability>) => {
    if (!supabaseUser?.id) return { success: false, error: 'Not authenticated' };

    const dbUpdates: Record<string, any> = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.scheduledAt) dbUpdates.scheduled_at = updates.scheduledAt.toISOString();
    if (updates.durationMinutes) dbUpdates.duration_minutes = updates.durationMinutes;
    if (updates.type) dbUpdates.type = updates.type;
    if (updates.status) dbUpdates.status = updates.status;

    const { error } = await supabase
      .from('doctor_availability')
      .update(dbUpdates)
      .eq('id', id)
      .eq('doctor_id', supabaseUser.id);

    if (error) {
      return { success: false, error: error.message };
    }

    await fetchAvailabilities();
    return { success: true };
  };

  const confirmAvailability = async (id: string) => {
    return updateAvailability(id, { status: 'confirmed' });
  };

  const cancelAvailability = async (id: string) => {
    return updateAvailability(id, { status: 'cancelled' });
  };

  const notifySubscribers = async (availabilityId: string) => {
    if (!supabaseUser?.id) return { success: false, error: 'Not authenticated' };

    // Find the availability
    const availability = myAvailabilities.find(a => a.id === availabilityId);
    if (!availability) return { success: false, error: 'Availability not found' };

    // Call the notify function
    const { data, error } = await supabase.rpc('notify_subscribers', {
      p_doctor_id: supabaseUser.id,
      p_notification_type: availability.type === 'live' ? 'doctor_live' : 'doctor_availability',
      p_title: availability.title,
      p_message: `Programado para ${availability.scheduledAt.toLocaleDateString()} a las ${availability.scheduledAt.toLocaleTimeString()}`,
      p_data: { availability_id: availabilityId, type: availability.type },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Mark as notifications sent
    await supabase
      .from('doctor_availability')
      .update({ notifications_sent: true })
      .eq('id', availabilityId);

    await fetchAvailabilities();
    return { success: true, notified: data };
  };

  const getAvailabilitiesByDoctor = (doctorId: string) => {
    return availabilities.filter(a => a.doctorId === doctorId);
  };

  return {
    availabilities,
    myAvailabilities,
    isLoading,
    createAvailability,
    updateAvailability,
    confirmAvailability,
    cancelAvailability,
    notifySubscribers,
    getAvailabilitiesByDoctor,
    refresh: fetchAvailabilities,
  };
}
