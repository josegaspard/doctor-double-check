import { useMemo } from 'react';
import { useSubscriptions } from './useSubscriptions';

/**
 * Hook to check if a user has early access to a live stream
 * Premium subscribers get 5 minutes early access by default
 */
export function useEarlyAccess() {
  const { subscriptions, hasAnyPremium } = useSubscriptions();

  /**
   * Get early access minutes for a specific doctor's content
   * Premium subscribers get 5 minutes early access
   */
  const getEarlyAccessMinutes = (doctorId: string): number => {
    const sub = subscriptions.find(
      (s) => s.creatorId === doctorId && s.isActive && s.tier === 'premium'
    );
    return sub ? 5 : 0; // 5 minutes early access for premium
  };

  /**
   * Check if user has early access to a scheduled live
   * Returns true if:
   * - The live has already started
   * - OR the user is premium and we're within the early access window
   */
  const hasEarlyAccessTo = (
    doctorId: string,
    scheduledAt: Date | string
  ): boolean => {
    const now = new Date();
    const scheduled =
      typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;

    // Already started
    if (now >= scheduled) return true;

    // Check early access
    const earlyMinutes = getEarlyAccessMinutes(doctorId);
    if (earlyMinutes <= 0) return false;

    const earlyAccessTime = new Date(
      scheduled.getTime() - earlyMinutes * 60 * 1000
    );
    return now >= earlyAccessTime;
  };

  /**
   * Get time until user can access a scheduled live
   * Returns 0 if already accessible
   */
  const getTimeUntilAccess = (
    doctorId: string,
    scheduledAt: Date | string
  ): number => {
    const now = new Date();
    const scheduled =
      typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;

    const earlyMinutes = getEarlyAccessMinutes(doctorId);
    const accessTime = new Date(
      scheduled.getTime() - earlyMinutes * 60 * 1000
    );

    const diff = accessTime.getTime() - now.getTime();
    return Math.max(0, diff);
  };

  return {
    getEarlyAccessMinutes,
    hasEarlyAccessTo,
    getTimeUntilAccess,
    isPremiumUser: hasAnyPremium(),
  };
}
