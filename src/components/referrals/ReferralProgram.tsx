import React, { useState } from 'react';
import { useReferrals } from '@/hooks/useReferrals';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Gift, Copy, Users, Wallet, Loader2, Check, Share2 } from 'lucide-react';

export function ReferralProgram() {
  const { myCode, redemptions, hasRedeemed, isLoading, generateCode, redeemCode } = useReferrals();
  const { language } = useLanguage();
  const [redeemInput, setRedeemInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    const code = await generateCode();
    if (code) {
      toast.success(language === 'es' ? '¡Código generado!' : 'Code generated!');
    }
    setIsGenerating(false);
  };

  const handleCopy = () => {
    if (myCode) {
      navigator.clipboard.writeText(myCode.code);
      setCopied(true);
      toast.success(language === 'es' ? 'Código copiado' : 'Code copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    if (myCode && navigator.share) {
      navigator.share({
        title: 'Medical Masters - Código de Referido',
        text: `¡Únete a Medical Masters con mi código ${myCode.code} y recibe $50 MXN de bono!`,
        url: window.location.origin,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  const handleRedeem = async () => {
    if (!redeemInput.trim()) return;
    setIsRedeeming(true);
    const result = await redeemCode(redeemInput.trim());
    if (!result.success) {
      toast.error(result.error);
    }
    setIsRedeeming(false);
    setRedeemInput('');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* My Referral Code */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            {language === 'es' ? 'Programa de Referidos' : 'Referral Program'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {language === 'es'
              ? 'Invita amigos y ambos reciben $50 MXN de bono en su wallet.'
              : 'Invite friends and both receive $50 MXN bonus in your wallet.'}
          </p>

          {myCode ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-lg font-bold text-center tracking-wider">
                  {myCode.code}
                </div>
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={handleShare}>
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{myCode.usesCount} {language === 'es' ? 'referidos' : 'referrals'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="w-4 h-4" />
                  <span>${myCode.usesCount * 50} MXN {language === 'es' ? 'ganados' : 'earned'}</span>
                </div>
              </div>
            </div>
          ) : (
            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
              {language === 'es' ? 'Generar mi Código' : 'Generate my Code'}
            </Button>
          )}

          {/* Recent redemptions */}
          {redemptions.length > 0 && (
            <div className="pt-3 border-t">
              <p className="text-sm font-medium mb-2">
                {language === 'es' ? 'Referidos recientes' : 'Recent referrals'}
              </p>
              <div className="space-y-2">
                {redemptions.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
                        day: 'numeric', month: 'short'
                      }).format(r.createdAt)}
                    </span>
                    <Badge variant="outline" className="text-success">
                      +${r.discountApplied} MXN
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redeem a Code */}
      {!hasRedeemed && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {language === 'es' ? '¿Tienes un código?' : 'Have a code?'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder={language === 'es' ? 'Ingresa código de referido' : 'Enter referral code'}
                value={redeemInput}
                onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
                className="font-mono"
              />
              <Button onClick={handleRedeem} disabled={isRedeeming || !redeemInput.trim()}>
                {isRedeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'es' ? 'Canjear' : 'Redeem')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
