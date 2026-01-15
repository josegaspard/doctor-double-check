import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WalletTransaction, TransactionType } from '@/types/database';

export function useWallet(userId: string | undefined) {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch wallet data
  const fetchWallet = useCallback(async () => {
    if (!userId) {
      setBalance(0);
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (walletError && walletError.code !== 'PGRST116') {
        console.error('Error fetching wallet:', walletError);
      } else if (wallet) {
        setBalance(Number(wallet.balance));
      }

      // Fetch transactions
      const { data: txns, error: txnsError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (txnsError) {
        console.error('Error fetching transactions:', txnsError);
      } else {
        setTransactions(txns as WalletTransaction[]);
      }
    } catch (error) {
      console.error('Error in fetchWallet:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Top up wallet - uses secure server-side function
  const topUp = async (amount: number, _description: string = 'Recarga de saldo'): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'No user' };

    try {
      // Use secure server-side function for wallet operations
      const { data, error } = await supabase.rpc('process_wallet_topup', {
        p_amount: amount,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      
      const result = data as { success: boolean; error?: string };
      
      if (!result.success) {
        return { success: false, error: result.error || 'Error al recargar' };
      }

      // Refresh data
      await fetchWallet();
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Error al recargar' };
    }
  };

  // Make a purchase - uses secure server-side function
  const purchase = async (
    amount: number, 
    description: string, 
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'No user' };

    try {
      // Use secure server-side function for wallet operations
      const { data, error } = await supabase.rpc('process_wallet_purchase', {
        p_amount: amount,
        p_description: description,
        p_metadata: metadata || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      
      const result = data as { success: boolean; error?: string };
      
      if (!result.success) {
        return { success: false, error: result.error || 'Error al procesar compra' };
      }

      // Refresh data
      await fetchWallet();
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Error al procesar compra' };
    }
  };

  // Check if user can afford an amount
  const canAfford = (amount: number): boolean => {
    return balance >= amount;
  };

  return {
    balance,
    transactions,
    isLoading,
    topUp,
    purchase,
    canAfford,
    refresh: fetchWallet,
  };
}
