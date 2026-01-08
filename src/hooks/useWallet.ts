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

  // Top up wallet
  const topUp = async (amount: number, description: string = 'Recarga de saldo'): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'No user' };

    try {
      // Create transaction
      const { error: txnError } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: userId,
          type: 'topup' as TransactionType,
          amount,
          description,
          status: 'paid',
        });

      if (txnError) {
        return { success: false, error: txnError.message };
      }

      // Update wallet balance
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ balance: balance + amount })
        .eq('user_id', userId);

      if (walletError) {
        return { success: false, error: walletError.message };
      }

      // Refresh data
      await fetchWallet();
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Error al recargar' };
    }
  };

  // Make a purchase
  const purchase = async (
    amount: number, 
    description: string, 
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'No user' };
    
    if (balance < amount) {
      return { success: false, error: 'Saldo insuficiente' };
    }

    try {
      // Create transaction
      const { error: txnError } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: userId,
          type: 'purchase' as TransactionType,
          amount: -amount,
          description,
          status: 'paid',
          metadata,
        });

      if (txnError) {
        return { success: false, error: txnError.message };
      }

      // Update wallet balance
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ balance: balance - amount })
        .eq('user_id', userId);

      if (walletError) {
        return { success: false, error: walletError.message };
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
