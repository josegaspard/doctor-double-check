import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { tContext } from '@/lib/i18n-context';
import { toast } from 'sonner';
import { useSubscriptionPricing } from '@/hooks/useSubscriptionPricing';

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
  purchase: (amount: number, description: string, metadata?: any) => Promise<{ success: boolean; error?: string }>;
  canAfford: (amount: number) => boolean;
  getEffectivePrice: (amount: number) => number;
  getTransactionHistory: () => Transaction[];
  refreshWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const { residentMultiplier } = useSubscriptionPricing();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const prevBalanceRef = useRef<number | null>(null);

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
        const newBal = Number(wallet.balance);
        if (prevBalanceRef.current === null) {
          prevBalanceRef.current = newBal;
        }
        setBalance(newBal);
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

    // Realtime subscription for wallet balance changes
    if (!user?.id || user.role === 'visitor') return;
    
    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const record = payload.new as { balance: number };
          const newBalance = Number(record.balance);
          const oldBalance = prevBalanceRef.current;
          
          // Show notification for balance changes (only after initial load)
          if (oldBalance !== null && oldBalance !== newBalance) {
            const diff = newBalance - oldBalance;
            if (diff > 0) {
              toast.success(`💰 +$${diff.toLocaleString()} recibidos. Saldo: $${newBalance.toLocaleString()}`);
            } else if (diff < 0) {
              toast.info(`💳 -$${Math.abs(diff).toLocaleString()} debitados. Saldo: $${newBalance.toLocaleString()}`);
            }
          }
          
          prevBalanceRef.current = newBalance;
          setBalance(newBalance);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const tx = payload.new as { type: string; amount: number; status: string; description: string };
          // Status-specific notifications
          if (tx.status === 'initiated' || tx.status === 'pending') {
            toast.loading(`⏳ Procesando: ${tx.description}`, { id: `tx-${tx.description}`, duration: 4000 });
          } else if (tx.status === 'failed') {
            toast.error(`❌ Pago fallido: ${tx.description}. Verifica tu método de pago.`, { duration: 6000 });
          }
          fetchWalletData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const tx = payload.new as { type: string; amount: number; status: string; description: string };
          const oldTx = payload.old as { status: string };
          // Status transitions
          if (oldTx.status !== tx.status) {
            if (tx.status === 'paid') {
              toast.success(`✅ Confirmado: ${tx.description}`, { duration: 4000 });
            } else if (tx.status === 'failed') {
              toast.error(`❌ Falló: ${tx.description}. Reintenta o contacta soporte.`, { duration: 6000 });
            }
          }
          fetchWalletData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchWalletData, user?.id, user?.role]);

  const refreshWallet = async () => {
    await fetchWalletData();
    await refreshUser();
  };

  // SECURITY (2026-05-11): direct wallet top-up via RPC removed. All top-ups
  // must go through Stripe checkout → stripe-webhook → credit_wallet_balance
  // (service-role only). The old RPC was reachable by any logged-in user.

  const purchase = async (
    amount: number,
    description: string,
    metadata?: any
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: tContext('contextErrors.notAuthenticated') };
    if (amount <= 0) return { success: false, error: tContext('contextErrors.invalidAmount') };

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
        return { success: false, error: result.error || tContext('contextErrors.purchaseError') };
      }

      await refreshWallet();
      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, error: error.message || tContext('contextErrors.purchaseError') };
    }
  };

  // Apply resident discount (admin-editable) when checking affordability
  const canAfford = (amount: number): boolean => {
    const effectiveAmount = user?.role === 'resident' ? amount * residentMultiplier : amount;
    return balance >= effectiveAmount;
  };

  // Get effective price (with discount for residents)
  const getEffectivePrice = (amount: number): number => {
    return user?.role === 'resident' ? amount * residentMultiplier : amount;
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
        purchase,
        canAfford,
        getEffectivePrice,
        getTransactionHistory,
        refreshWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

const WALLET_DEFAULTS: WalletContextType = {
  balance: 0,
  transactions: [],
  isLoading: false,
  purchase: async () => ({ success: false, error: 'Context not ready' }),
  canAfford: () => false,
  getEffectivePrice: (a: number) => a,
  getTransactionHistory: () => [],
  refreshWallet: async () => {},
};

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    console.warn('useWallet called outside WalletProvider – returning defaults');
    return WALLET_DEFAULTS;
  }
  return context;
}
