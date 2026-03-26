import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PriceDisplay } from '@/components/currency/PriceDisplay';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';

export function ResidentBalanceCard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    const fetchBalance = async () => {
      // Spent: purchases by this user
      const { data: purchases } = await supabase
        .from('purchases')
        .select('amount')
        .eq('user_id', user.id);

      // Earned: purchases on content created by this user
      const { data: myContent } = await supabase
        .from('doctor_content')
        .select('id')
        .eq('creator_id', user.id);

      let earned = 0;
      if (myContent && myContent.length > 0) {
        const contentIds = myContent.map(c => c.id);
        const { data: sales } = await supabase
          .from('purchases')
          .select('amount')
          .in('content_id', contentIds);
        earned = sales?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      }

      setTotalSpent(purchases?.reduce((sum, p) => sum + Number(p.amount), 0) || 0);
      setTotalEarned(earned);
    };
    fetchBalance();
  }, [user?.id]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          {t('residents.balance')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-destructive/5 rounded-lg">
            <TrendingDown className="w-5 h-5 text-destructive mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground mb-1">{t('residents.totalSpent')}</p>
            <PriceDisplay amount={totalSpent} size="lg" />
          </div>
          <div className="text-center p-3 bg-success/5 rounded-lg">
            <TrendingUp className="w-5 h-5 text-success mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground mb-1">{t('residents.totalEarned')}</p>
            <PriceDisplay amount={totalEarned} size="lg" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
