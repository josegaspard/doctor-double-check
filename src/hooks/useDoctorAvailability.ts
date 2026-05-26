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
  reminderSent: boolean;
  extraInvitees: string[];
  createdAt: Date;
}

export function useDoctorAvailability() {
  const { supabaseUser, role } = useAuth();
  const [availabilities, setAvailabilities] = useState<DoctorAvailability[]>([]);
  const [myAvailabilities, setMyAvailabilities] = useState<DoctorAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAvailabilities = useCallback(async () => {
    // Fetch public availabilities and doctor's own in parallel
    const publicQuery = supabase
      .from('doctor_availability')
      .select('*')
      .gte('scheduled_at', new Date().toISOString())
      .in('status', ['scheduled', 'confirmed'])
      .order('scheduled_at', { ascending: true });

    const myQuery = (supabaseUser?.id && role === 'doctor')
      ? supabase
          .from('doctor_availability')
          .select('*')
          .eq('doctor_id', supabaseUser.id)
          .order('scheduled_at', { ascending: false })
      : null;

    const [publicResult, myResult] = await Promise.all([
      publicQuery,
      myQuery,
    ]);

    const publicData = publicResult.data;

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
          reminderSent: a.reminder_sent ?? false,
          extraInvitees: ((a as any).extra_invitees ?? []) as string[],
          createdAt: new Date(a.created_at),
        }))
      );
    }

    // Apply doctor's own availabilities (already fetched in parallel)
    if (myResult) {
      const myData = myResult.data;
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
            reminderSent: a.reminder_sent ?? false,
            extraInvitees: ((a as any).extra_invitees ?? []) as string[],
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
    extraInvitees?: string[];
  }) => {
    if (!supabaseUser?.id) return { success: false, error: 'Not authenticated' };

    const invitees = (data.extraInvitees ?? []).map(e => e.trim().toLowerCase()).filter(Boolean);

    const { data: newAvail, error } = await supabase
      .from('doctor_availability')
      .insert({
        doctor_id: supabaseUser.id,
        title: data.title,
        description: data.description,
        scheduled_at: data.scheduledAt.toISOString(),
        duration_minutes: data.durationMinutes,
        type: data.type,
        status: 'confirmed',
        extra_invitees: invitees,
      } as any)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    try {
      const { data: notifyCount } = await supabase.rpc('notify_subscribers', {
        p_doctor_id: supabaseUser.id,
        p_notification_type: data.type === 'live' ? 'doctor_live' : 'doctor_availability',
        p_title: `📅 Nueva disponibilidad: ${data.title}`,
        p_message: `Programado para ${data.scheduledAt.toLocaleDateString()} a las ${data.scheduledAt.toLocaleTimeString()}`,
        p_data: { availability_id: newAvail?.id, type: data.type },
      });

      if (newAvail?.id) {
        await supabase
          .from('doctor_availability')
          .update({ notifications_sent: true })
          .eq('id', newAvail.id);
      }

      if (invitees.length > 0 && newAvail?.id) {
        supabase.functions.invoke('send-availability-invite', {
          body: {
            availability_id: newAvail.id,
            recipients: invitees,
            action: 'new',
          },
        }).catch(err => console.warn('send-availability-invite failed (non-fatal):', err));
      }

      console.log(`Notified ${notifyCount} subscribers about new availability`);
    } catch (notifyError) {
      console.error('Failed to notify subscribers:', notifyError);
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
    if (updates.extraInvitees) dbUpdates.extra_invitees = updates.extraInvitees.map(e => e.trim().toLowerCase()).filter(Boolean);

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

  const moveAvailability = async (id: string, newDate: Date) => {
    if (!supabaseUser?.id) return { success: false, error: 'Not authenticated' };
    const target = myAvailabilities.find(a => a.id === id);
    if (!target) return { success: false, error: 'Availability not found' };

    const next = new Date(target.scheduledAt);
    next.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());

    const { error } = await supabase
      .from('doctor_availability')
      .update({
        scheduled_at: next.toISOString(),
        notifications_sent: false,
        reminder_sent: false,
      })
      .eq('id', id)
      .eq('doctor_id', supabaseUser.id);

    if (error) return { success: false, error: error.message, oldDate: target.scheduledAt, newDate: next };
    await fetchAvailabilities();
    return { success: true, oldDate: target.scheduledAt, newDate: next };
  };

  const notifyDateChange = async (id: string, oldDate: Date, newDate: Date) => {
    if (!supabaseUser?.id) return { success: false, error: 'Not authenticated' };
    const target = myAvailabilities.find(a => a.id === id);
    if (!target) return { success: false, error: 'Availability not found' };

    const fmt = (d: Date) => `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const message = `"${target.title}" cambió de ${fmt(oldDate)} a ${fmt(newDate)}.`;

    const { data: notifyCount } = await supabase.rpc('notify_subscribers', {
      p_doctor_id: supabaseUser.id,
      p_notification_type: target.type === 'live' ? 'doctor_live' : 'doctor_availability',
      p_title: `📅 Cambio de fecha: ${target.title}`,
      p_message: message,
      p_data: { availability_id: id, type: target.type, action: 'moved' },
    });

    await supabase
      .from('doctor_availability')
      .update({ notifications_sent: true })
      .eq('id', id);

    const invitees = target.extraInvitees ?? [];
    if (invitees.length > 0) {
      supabase.functions.invoke('send-availability-invite', {
        body: {
          availability_id: id,
          recipients: invitees,
          action: 'moved',
          old_scheduled_at: oldDate.toISOString(),
        },
      }).catch(err => console.warn('send-availability-invite failed (non-fatal):', err));
    }

    await fetchAvailabilities();
    return { success: true, notified: notifyCount, invitees: invitees.length };
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

  const deleteAvailabilities = async (ids: string[]) => {
    if (!supabaseUser?.id || ids.length === 0) return { success: false, error: 'Invalid' };

    const { error } = await supabase
      .from('doctor_availability')
      .delete()
      .in('id', ids)
      .eq('doctor_id', supabaseUser.id);

    if (error) return { success: false, error: error.message };

    await fetchAvailabilities();
    return { success: true };
  };

  return {
    availabilities,
    myAvailabilities,
    isLoading,
    createAvailability,
    updateAvailability,
    moveAvailability,
    notifyDateChange,
    confirmAvailability,
    cancelAvailability,
    notifySubscribers,
    deleteAvailabilities,
    getAvailabilitiesByDoctor,
    refresh: fetchAvailabilities,
  };
}
