import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ReferralCode {
  id: string;
  code: string;
  usesCount: number;
  maxUses: number | null;
  discountPercentage: number;
  isActive: boolean;
  createdAt: Date;
}

export interface ReferralRedemption {
  id: string;
  referredUserId: string;
  discountApplied: number;
  createdAt: Date;
}

export function useReferrals() {
  const { supabaseUser } = useAuth();
  const [myCode, setMyCode] = useState<ReferralCode | null>(null);
  const [redemptions, setRedemptions] = useState<ReferralRedemption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRedeemed, setHasRedeemed] = useState(false);

  const fetchReferralData = useCallback(async () => {
    if (!supabaseUser?.id) return;

    try {
      // Fetch user's referral code
      const { data: codes } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .limit(1);

      if (codes && codes.length > 0) {
        const c = codes[0];
        setMyCode({
          id: c.id,
          code: c.code,
          usesCount: c.uses_count,
          maxUses: c.max_uses,
          discountPercentage: Number(c.discount_percentage),
          isActive: c.is_active,
          createdAt: new Date(c.created_at),
        });
      }

      // Fetch redemptions by referrer
      const { data: reds } = await supabase
        .from('referral_redemptions')
        .select('*')
        .eq('referrer_user_id', supabaseUser.id)
        .order('created_at', { ascending: false });

      if (reds) {
        setRedemptions(reds.map(r => ({
          id: r.id,
          referredUserId: r.referred_user_id,
          discountApplied: Number(r.discount_applied),
          createdAt: new Date(r.created_at),
        })));
      }

      // Check if user has already redeemed a code
      const { data: myRedemption } = await supabase
        .from('referral_redemptions')
        .select('id')
        .eq('referred_user_id', supabaseUser.id)
        .limit(1);

      setHasRedeemed((myRedemption?.length || 0) > 0);
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabaseUser?.id]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  const generateCode = async (): Promise<string | null> => {
    if (!supabaseUser?.id) return null;

    // Generate a unique 8-char code using crypto for security
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'MM-';
    const randomValues = crypto.getRandomValues(new Uint8Array(5));
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(randomValues[i] % chars.length);
    }

    try {
      const { data, error } = await supabase
        .from('referral_codes')
        .insert({ user_id: supabaseUser.id, code })
        .select()
        .single();

      if (error) throw error;

      setMyCode({
        id: data.id,
        code: data.code,
        usesCount: 0,
        maxUses: null,
        discountPercentage: 10,
        isActive: true,
        createdAt: new Date(data.created_at),
      });

      return data.code;
    } catch (error: any) {
      console.error('Error generating code:', error);
      toast.error('Error al generar código');
      return null;
    }
  };

  const redeemCode = async (code: string): Promise<{ success: boolean; bonus?: number; error?: string }> => {
    if (!supabaseUser?.id) return { success: false, error: 'No autenticado' };

    try {
      const { data, error } = await supabase.rpc('redeem_referral_code', { p_code: code });

      if (error) throw error;
      
      const result = data as any;
      if (!result.success) {
        return { success: false, error: result.error };
      }

      toast.success(`¡Código canjeado! Se agregaron $${result.bonus} MXN a tu wallet`);
      await fetchReferralData();
      return { success: true, bonus: result.bonus };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  return {
    myCode,
    redemptions,
    hasRedeemed,
    isLoading,
    generateCode,
    redeemCode,
    refresh: fetchReferralData,
  };
}
