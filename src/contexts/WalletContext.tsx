import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export type TransactionType = 'topup' | 'purchase' | 'refund' | 'subscription' | 'earning';
export type TransactionStatus = 'initiated' | 'paid' | 'failed';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  description: string;
  status: TransactionStatus;
  createdAt: Date;
  metadata?: Record<string, any>;
}

interface WalletContextType {
  balance: number;
  transactions: Transaction[];
  isLoading: boolean;
  topUp: (amount: number) => Promise<{ success: boolean; error?: string }>;
  purchase: (amount: number, description: string, metadata?: any) => Promise<{ success: boolean; error?: string }>;
  canAfford: (amount: number) => boolean;
  getTransactionHistory: () => Transaction[];
  refreshWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWalletData = useCallback(async () => {
    if (!user?.id || user.role === 'visitor') return;

    try {
      // Fetch wallet balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (wallet) {
        setBalance(Number(wallet.balance));
      }

      // Fetch transactions
      const { data: txns } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txns) {
        setTransactions(txns.map(t => ({
          id: t.id,
          userId: t.user_id,
          type: t.type as TransactionType,
          amount: Number(t.amount),
          description: t.description,
          status: t.status as TransactionStatus,
          createdAt: new Date(t.created_at),
          metadata: t.metadata as Record<string, any> | undefined,
        })));
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const refreshWallet = async () => {
    await fetchWalletData();
    await refreshUser();
  };

  const topUp = async (amount: number): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
    if (amount <= 0) return { success: false, error: 'Monto inválido' };

    setIsLoading(true);
    try {
      // Use secure server-side function for wallet operations
      const { data, error } = await supabase.rpc('process_wallet_topup', {
        p_amount: amount,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; new_balance?: number };
      
      if (!result.success) {
        setIsLoading(false);
        return { success: false, error: result.error || 'Error al recargar' };
      }

      await refreshWallet();
      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Error al recargar' };
    }
  };

  const purchase = async (
    amount: number,
    description: string,
    metadata?: any
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
    if (amount <= 0) return { success: false, error: 'Monto inválido' };

    setIsLoading(true);
    try {
      // Use secure server-side function for wallet operations
      const { data, error } = await supabase.rpc('process_wallet_purchase', {
        p_amount: amount,
        p_description: description,
        p_metadata: metadata || null,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; amount_charged?: number; new_balance?: number };
      
      if (!result.success) {
        setIsLoading(false);
        return { success: false, error: result.error || 'Error en la compra' };
      }

      await refreshWallet();
      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Error en la compra' };
    }
  };

  const canAfford = (amount: number): boolean => {
    return balance >= amount;
  };

  const getTransactionHistory = (): Transaction[] => {
    return transactions;
  };

  return (
    <WalletContext.Provider
      value={{
        balance,
        transactions,
        isLoading,
        topUp,
        purchase,
        canAfford,
        getTransactionHistory,
        refreshWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
