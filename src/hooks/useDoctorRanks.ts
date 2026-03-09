import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DoctorRank {
  id: string;
  name: string;
  display_name: string;
  icon: string;
  color: string;
  min_consultations: number;
  min_earnings: number;
  min_months_active: number;
  min_rating: number;
  sort_order: number;
}

export function useDoctorRanks() {
  return useQuery({
    queryKey: ['doctor-ranks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_ranks')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as DoctorRank[];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Calculate the doctor's rank based on stats.
 * Returns the highest matching rank (by sort_order desc).
 */
export function calculateDoctorRank(
  ranks: DoctorRank[],
  stats: {
    totalConsultations: number;
    totalEarnings: number;
    monthsActive: number;
    rating: number;
  },
  rankOverrideId?: string | null,
): DoctorRank | null {
  if (!ranks.length) return null;

  // If there's an override, use that
  if (rankOverrideId) {
    const override = ranks.find(r => r.id === rankOverrideId);
    if (override) return override;
  }

  // Find highest matching rank (sorted desc by sort_order)
  const sorted = [...ranks].sort((a, b) => b.sort_order - a.sort_order);
  for (const rank of sorted) {
    if (
      stats.totalConsultations >= rank.min_consultations &&
      stats.totalEarnings >= rank.min_earnings &&
      stats.monthsActive >= rank.min_months_active &&
      stats.rating >= rank.min_rating
    ) {
      return rank;
    }
  }

  // Fallback to lowest rank
  return ranks[0] || null;
}

/** Calculate months since a date */
export function monthsSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}
