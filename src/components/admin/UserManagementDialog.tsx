import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  User, 
  Shield, 
  Stethoscope, 
  GraduationCap,
  Wallet,
  TrendingUp,
  Calendar,
  Mail,
  BadgeCheck,
  AlertTriangle,
  Trash2,
  Pause,
  Play,
  Loader2,
  DollarSign,
  ShoppingCart,
  Video,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface UserData {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  is_identity_verified: boolean;
  onboarding_completed: boolean;
  role?: string;
}

interface UserStats {
  walletBalance: number;
  totalTransactions: number;
  totalSpent: number;
  totalEarned: number;
  purchasesCount: number;
  consultationsCount: number;
  contentCount: number;
  livesCount: number;
}

interface UserManagementDialogProps {
  user: UserData | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

export function UserManagementDialog({ user, isOpen, onClose, onUserUpdated }: UserManagementDialogProps) {
  const { language, t } = useLanguage();
  const locale = language === 'es' ? es : enUS;
  const [activeTab, setActiveTab] = useState('info');
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (user && isOpen) {
      loadUserStats();
      loadUserTransactions();
    }
  }, [user, isOpen]);

  const loadUserStats = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Wallet balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      // Transactions summary
      const { data: txs } = await supabase
        .from('wallet_transactions')
        .select('type, amount')
        .eq('user_id', user.id);

      const totalSpent = (txs || [])
        .filter(t => t.type === 'purchase')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const totalEarned = (txs || [])
        .filter(t => t.type === 'earning')
        .reduce((sum, t) => sum + t.amount, 0);

      // Purchases count
      const { count: purchasesCount } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Consultations count
      const { count: consultationsCount } = await supabase
        .from('consultations')
        .select('*', { count: 'exact', head: true })
        .or(`patient_id.eq.${user.id},doctor_id.eq.${user.id}`);

      // Content count (for doctors)
      const { count: contentCount } = await supabase
        .from('doctor_content')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', user.id);

      // Lives count (for doctors)
      const { count: livesCount } = await supabase
        .from('lives')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', user.id);

      setStats({
        walletBalance: wallet?.balance || 0,
        totalTransactions: txs?.length || 0,
        totalSpent,
        totalEarned,
        purchasesCount: purchasesCount || 0,
        consultationsCount: consultationsCount || 0,
        contentCount: contentCount || 0,
        livesCount: livesCount || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserTransactions = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const handlePauseUser = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      // Real suspension: bans the account at the auth level so it can no longer
      // log in or refresh its session (not just a notification).
      const { data, error } = await supabase.functions.invoke('admin-suspend-user', {
        body: { userId: user.id, suspend: true, reason: actionReason || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success(t('autoI18n.userMgmt1'));
      onUserUpdated();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user || !deleteConfirm) return;
    setIsProcessing(true);
    try {
      // Call edge function to delete user completely from auth.users
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: user.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(t('autoI18n.userMgmt2'));
      onUserUpdated();
      onClose();
    } catch (error: any) {
      console.error('Delete user error:', error);
      toast.error(error.message || t('autoI18n.userMgmt3'));
    } finally {
      setIsProcessing(false);
      setDeleteConfirm(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'doctor': return <Stethoscope className="w-4 h-4" />;
      case 'resident': return <GraduationCap className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-secondary text-secondary',
      doctor: 'bg-primary text-primary',
      resident: 'bg-success text-success',
      patient: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge variant="outline" className={colors[role] || colors.patient}>
        {getRoleIcon(role)}
        <span className="ml-1 capitalize">{role}</span>
      </Badge>
    );
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={user.avatar_url || ''} />
              <AvatarFallback className="text-lg">{user.name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">{user.name}</h3>
              <p className="text-sm text-muted-foreground font-normal">{user.email}</p>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('autoI18n.userMgmt4')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">{t('autoI18n.userMgmt5')}</TabsTrigger>
            <TabsTrigger value="stats">{t('autoI18n.userMgmt6')}</TabsTrigger>
            <TabsTrigger value="transactions">{t('autoI18n.userMgmt7')}</TabsTrigger>
            <TabsTrigger value="actions">{t('autoI18n.userMgmt8')}</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{t('autoI18n.userMgmt9')}</p>
                <div className="mt-1">{getRoleBadge(user.role || 'patient')}</div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{t('autoI18n.userMgmt10')}</p>
                <Badge variant={user.is_identity_verified ? 'success' : 'secondary'} className="mt-1">
                  {user.is_identity_verified ? (
                    <><BadgeCheck className="w-3 h-3 mr-1" />{t('autoI18n.userMgmt11')}</>
                  ) : (
                    t('autoI18n.userMgmt12')
                  )}
                </Badge>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {t('autoI18n.userMgmt13')}
                </p>
                <p className="font-medium mt-1">
                  {format(new Date(user.created_at), "d MMM yyyy", { locale })}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {t('autoI18n.userMgmt14')}
                </p>
                <Badge variant={user.onboarding_completed ? 'success' : 'warning'} className="mt-1">
                  {user.onboarding_completed
                    ? t('autoI18n.userMgmt15')
                    : t('autoI18n.userMgmt16')}
                </Badge>
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">ID</p>
              <p className="font-mono text-xs mt-1 break-all">{user.id}</p>
            </div>
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm">{t('autoI18n.userMgmt17')}</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">${stats.walletBalance.toFixed(2)}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">{t('autoI18n.userMgmt18')}</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{stats.totalTransactions}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 text-destructive">
                    <ShoppingCart className="w-4 h-4" />
                    <span className="text-sm">{t('autoI18n.userMgmt19')}</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">${stats.totalSpent.toFixed(2)}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 text-success">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">{t('autoI18n.userMgmt20')}</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">${stats.totalEarned.toFixed(2)}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm">{t('autoI18n.userMgmt21')}</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{stats.consultationsCount}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Video className="w-4 h-4" />
                    <span className="text-sm">{t('autoI18n.userMgmt22')}</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{stats.livesCount}</p>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="transactions" className="mt-4">
            {transactions.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.created_at), "d MMM yyyy, HH:mm", { locale })}
                      </p>
                    </div>
                    <p className={`font-bold ${tx.amount > 0 ? 'text-success' : 'text-destructive'}`}>
                      {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {t('autoI18n.userMgmt23')}
              </p>
            )}
          </TabsContent>

          <TabsContent value="actions" className="mt-4 space-y-4">
            <div className="p-4 border border-warning/50 bg-warning/5 rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <Pause className="w-4 h-4" />
                {t('autoI18n.userMgmt24')}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {t('autoI18n.userMgmt25')}
              </p>
              <Textarea
                placeholder={t('autoI18n.userMgmt26')}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="mt-3"
                rows={2}
              />
              <Button 
                variant="warning" 
                className="mt-3" 
                onClick={handlePauseUser}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pause className="w-4 h-4 mr-2" />}
                {t('autoI18n.userMgmt27')}
              </Button>
            </div>

            <div className="p-4 border border-destructive/50 bg-destructive/5 rounded-lg">
              <h4 className="font-medium flex items-center gap-2 text-destructive">
                <Trash2 className="w-4 h-4" />
                {t('autoI18n.userMgmt28')}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {t('autoI18n.userMgmt29')}
              </p>
              {!deleteConfirm ? (
                <Button 
                  variant="destructive" 
                  className="mt-3"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('autoI18n.userMgmt30')}
                </Button>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Button 
                    variant="destructive"
                    onClick={handleDeleteUser}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {t('autoI18n.userMgmt31')}
                  </Button>
                  <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
                    {t('autoI18n.userMgmt32')}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
