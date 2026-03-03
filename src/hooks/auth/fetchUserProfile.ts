import { supabase } from '@/integrations/supabase/client';
import { ExtendedUser, UserRole, DoctorStatus } from './types';

export async function fetchUserProfile(userId: string): Promise<ExtendedUser | null> {
  try {
    // Fetch ALL data in parallel (6 queries at once)
    const [profileResult, roleResult, walletResult, entitlementsResult, doctorResult, residentResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId).single(),
      supabase.from('wallets').select('*').eq('user_id', userId).single(),
      supabase.from('entitlements').select('*').eq('user_id', userId).eq('is_active', true),
      supabase.from('doctor_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('resident_profiles').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    const profile = profileResult.data;
    if (profileResult.error || !profile) return null;

    const role = (roleResult.data?.role as UserRole) || 'patient';

    const extendedUser: ExtendedUser = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role,
      avatarUrl: profile.avatar_url || undefined,
      createdAt: new Date(profile.created_at),
      onboardingCompleted: profile.onboarding_completed ?? true,
    };

    // Apply doctor profile (already fetched in parallel)
    const doctorProfile = doctorResult.data;
    if (role === 'doctor' && doctorProfile) {
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

    // Apply resident profile (already fetched in parallel)
    const residentProfile = residentResult.data;
    if (role === 'resident' && residentProfile) {
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

    // Apply wallet data (already fetched in parallel)
    if (walletResult.data && (role === 'patient' || role === 'resident' || role === 'doctor')) {
      extendedUser.wallet = {
        id: walletResult.data.id,
        balance: Number(walletResult.data.balance),
      };
    }

    // Apply entitlements (already fetched in parallel)
    if (entitlementsResult.data) {
      extendedUser.entitlements = entitlementsResult.data.map(e => ({
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
