import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';

export interface Purchase {
  id: string;
  recordingId: string;
  amount: number;
  createdAt: Date;
}

export function usePurchases() {
  const { supabaseUser, role } = useAuth();
  const { refreshWallet } = useWallet();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const fetchPurchases = useCallback(async () => {
    if (!supabaseUser?.id) {
      setPurchases([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPurchases(
        (data || []).map(p => ({
          id: p.id,
          recordingId: p.recording_id,
          amount: Number(p.amount),
          createdAt: new Date(p.created_at),
        }))
      );
    } catch (error: any) {
      console.error('Error fetching purchases:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabaseUser?.id]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const hasPurchased = useCallback((recordingId: string): boolean => {
    if (role === 'admin' || role === 'doctor') return true;
    return purchases.some(p => p.recordingId === recordingId);
  }, [purchases, role]);

  const purchaseWithWallet = async (recordingId: string): Promise<{ success: boolean; error?: string }> => {
    if (!supabaseUser?.id) {
      return { success: false, error: 'No autenticado' };
    }

    setIsPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('purchase-recording-wallet', {
        body: { recordingId },
      });

      if (error) throw error;

      if (data?.alreadyPurchased) {
        toast.info('Ya tienes esta grabación');
        return { success: true };
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Error en la compra');
      }

      toast.success(`¡Grabación comprada! Nuevo saldo: $${data.newBalance}`);
      
      // Refresh purchases and wallet
      await Promise.all([fetchPurchases(), refreshWallet()]);
      
      return { success: true };
    } catch (error: any) {
      const errorMsg = error.message || 'Error al procesar la compra';
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsPurchasing(false);
    }
  };

  const purchaseWithStripe = async (recordingId: string): Promise<{ success: boolean; url?: string; error?: string }> => {
    if (!supabaseUser?.id) {
      return { success: false, error: 'No autenticado' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-recording-checkout', {
        body: { recordingId },
      });

      if (error) throw error;

      if (data?.url) {
        return { success: true, url: data.url };
      }

      throw new Error('No se pudo crear la sesión de pago');
    } catch (error: any) {
      const errorMsg = error.message || 'Error al procesar el pago';
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  return {
    purchases,
    isLoading,
    isPurchasing,
    hasPurchased,
    purchaseWithWallet,
    purchaseWithStripe,
    refresh: fetchPurchases,
  };
}
