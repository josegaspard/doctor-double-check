import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Transaction, TransactionStatus } from '@/types';
import { useAuth } from './AuthContext';

interface WalletContextType {
  balance: number;
  transactions: Transaction[];
  isLoading: boolean;
  topUp: (amount: number) => Promise<{ success: boolean; error?: string }>;
  purchase: (amount: number, description: string, metadata?: any) => Promise<{ success: boolean; error?: string }>;
  canAfford: (amount: number) => boolean;
  getTransactionHistory: () => Transaction[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Initial mock transactions
const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-001',
    userId: 'patient-001',
    type: 'topup',
    amount: 2000,
    description: 'Recarga inicial',
    status: 'paid',
    createdAt: new Date('2024-01-20'),
  },
  {
    id: 'tx-002',
    userId: 'patient-001',
    type: 'purchase',
    amount: -300,
    description: 'Grabación: Cardiología Básica',
    status: 'paid',
    createdAt: new Date('2024-02-15'),
    metadata: { recordingId: 'rec-001' },
  },
  {
    id: 'tx-003',
    userId: 'patient-001',
    type: 'purchase',
    amount: -200,
    description: 'Chat con Dr. Mendoza',
    status: 'paid',
    createdAt: new Date('2024-03-01'),
    metadata: { chatSessionId: 'chat-001' },
  },
];

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load transactions from localStorage
  useEffect(() => {
    if (user?.id) {
      const stored = localStorage.getItem(`drDoubleCheck_transactions_${user.id}`);
      if (stored) {
        const parsed = JSON.parse(stored).map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
        }));
        setTransactions(parsed);
      } else if (user.id === 'patient-001') {
        // Initialize with mock data for demo patient
        setTransactions(INITIAL_TRANSACTIONS);
        localStorage.setItem(
          `drDoubleCheck_transactions_${user.id}`,
          JSON.stringify(INITIAL_TRANSACTIONS)
        );
      }
    }
  }, [user?.id]);

  const getBalance = (): number => {
    if (!user) return 0;
    
    // Check if user has walletBalance property
    if ('walletBalance' in user) {
      return (user as any).walletBalance;
    }
    return 0;
  };

  const updateBalance = (newBalance: number) => {
    if (!user) return;
    
    // Update in localStorage
    const storedUser = localStorage.getItem('drDoubleCheck_user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      parsed.walletBalance = newBalance;
      localStorage.setItem('drDoubleCheck_user', JSON.stringify(parsed));
    }
    
    // Force re-render by updating a transaction
    setTransactions(prev => [...prev]);
  };

  const topUp = async (amount: number): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Usuario no autenticado' };
    if (amount <= 0) return { success: false, error: 'Monto inválido' };
    
    setIsLoading(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newTransaction: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      type: 'topup',
      amount: amount,
      description: `Recarga de saldo`,
      status: 'paid',
      createdAt: new Date(),
    };
    
    const newBalance = getBalance() + amount;
    updateBalance(newBalance);
    
    const newTransactions = [newTransaction, ...transactions];
    setTransactions(newTransactions);
    localStorage.setItem(
      `drDoubleCheck_transactions_${user.id}`,
      JSON.stringify(newTransactions)
    );
    
    setIsLoading(false);
    return { success: true };
  };

  const purchase = async (
    amount: number,
    description: string,
    metadata?: any
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Usuario no autenticado' };
    if (amount <= 0) return { success: false, error: 'Monto inválido' };
    
    const currentBalance = getBalance();
    if (currentBalance < amount) {
      return { success: false, error: 'Saldo insuficiente' };
    }
    
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newTransaction: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      type: 'purchase',
      amount: -amount,
      description,
      status: 'paid',
      createdAt: new Date(),
      metadata,
    };
    
    const newBalance = currentBalance - amount;
    updateBalance(newBalance);
    
    const newTransactions = [newTransaction, ...transactions];
    setTransactions(newTransactions);
    localStorage.setItem(
      `drDoubleCheck_transactions_${user.id}`,
      JSON.stringify(newTransactions)
    );
    
    setIsLoading(false);
    return { success: true };
  };

  const canAfford = (amount: number): boolean => {
    return getBalance() >= amount;
  };

  const getTransactionHistory = (): Transaction[] => {
    return transactions.filter(t => t.userId === user?.id);
  };

  return (
    <WalletContext.Provider
      value={{
        balance: getBalance(),
        transactions,
        isLoading,
        topUp,
        purchase,
        canAfford,
        getTransactionHistory,
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
