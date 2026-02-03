import { supabase } from '@/integrations/supabase/client';
import { ExtendedUser, UserRole, DoctorStatus } from './types';

export async function fetchUserProfile(userId: string): Promise<ExtendedUser | null> {
  try {
    // Fetch base profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) return null;

    // Fetch role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    const role = (roleData?.role as UserRole) || 'patient';

    const extendedUser: ExtendedUser = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role,
      avatarUrl: profile.avatar_url || undefined,
      createdAt: new Date(profile.created_at),
      onboardingCompleted: profile.onboarding_completed ?? true,
    };

    // Fetch role-specific data
    if (role === 'doctor') {
      const { data: doctorProfile } = await supabase
        .from('doctor_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (doctorProfile) {
        extendedUser.doctorProfile = {
          id: doctorProfile.id,
          specialty: doctorProfile.specialty,
          license: doctorProfile.license,
          bio: doctorProfile.bio || undefined,
          status: doctorProfile.status as DoctorStatus,
          consultationFee: Number(doctorProfile.consultation_fee),
          rating: Number(doctorProfile.rating),
          totalConsultations: doctorProfile.total_consultations,
          followersCount: doctorProfile.followers_count,
          availableForDoubleCheck: doctorProfile.available_for_double_check,
          availableForClinicalSessions: doctorProfile.available_for_clinical_sessions,
          cedulaProfesional: doctorProfile.cedula_profesional || undefined,
          numeroConsejo: doctorProfile.numero_consejo || undefined,
          location: doctorProfile.location || undefined,
        };
      }
    }

    if (role === 'resident') {
      const { data: residentProfile } = await supabase
        .from('resident_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (residentProfile) {
        extendedUser.residentProfile = {
          id: residentProfile.id,
          institution: residentProfile.institution,
          specialty: residentProfile.specialty,
          year: residentProfile.year,
          status: residentProfile.status as DoctorStatus,
          followersCount: residentProfile.followers_count,
          tituloMedicina: residentProfile.titulo_medicina || undefined,
          cedulaProfesional: residentProfile.cedula_profesional || undefined,
        };
      }
    }

    // Fetch wallet for patients and residents
    if (role === 'patient' || role === 'resident') {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (wallet) {
        extendedUser.wallet = {
          id: wallet.id,
          balance: Number(wallet.balance),
        };
      }
    }

    // Fetch entitlements
    const { data: entitlements } = await supabase
      .from('entitlements')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (entitlements) {
      extendedUser.entitlements = entitlements.map(e => ({
        type: e.type,
        isActive: e.is_active,
        expiresAt: e.expires_at ? new Date(e.expires_at) : undefined,
      }));
    }

    return extendedUser;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}
