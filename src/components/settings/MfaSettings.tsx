import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Loader2, Trash2, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface Factor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
}

export function MfaSettings() {
  const { t } = useLanguage();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      setFactors([...data.totp] as Factor[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setEnrolling(false);
    if (error || !data) {
      toast.error(error?.message || t('mfaSettings.errors.enrollStart'));
      return;
    }
    setEnrollData({
      id: data.id,
      qr: (data as any).totp?.qr_code || '',
      secret: (data as any).totp?.secret || '',
    });
  };

  const verifyEnroll = async () => {
    if (!enrollData) return;
    if (code.length !== 6) {
      toast.error(t('mfaSettings.errors.codeLength'));
      return;
    }
    setVerifying(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId: enrollData.id });
    if (challenge.error) {
      setVerifying(false);
      toast.error(challenge.error.message);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrollData.id,
      challengeId: challenge.data.id,
      code,
    });
    setVerifying(false);
    if (error) {
      toast.error(t('mfaSettings.errors.invalidCode'));
      return;
    }
    toast.success(t('mfaSettings.success.activated'));
    setEnrollData(null);
    setCode('');
    refresh();
  };

  const cancelEnroll = async () => {
    if (enrollData) {
      await supabase.auth.mfa.unenroll({ factorId: enrollData.id });
      setEnrollData(null);
      setCode('');
    }
  };

  const removeFactor = async (factorId: string) => {
    if (!confirm(t('mfaSettings.confirmDisable'))) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('mfaSettings.success.disabled'));
    refresh();
  };

  const verifiedFactors = factors.filter((f) => f.status === 'verified');
  const hasMFA = verifiedFactors.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t('mfaSettings.title')}
          {hasMFA && <Badge variant="success" className="ml-2">{t('mfaSettings.activeBadge')}</Badge>}
        </CardTitle>
        <CardDescription>
          {t('mfaSettings.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            {verifiedFactors.length > 0 && (
              <div className="space-y-2">
                {verifiedFactors.map((f) => (
                  <div key={f.id} className="flex items-center justify-between border rounded-md p-3">
                    <div className="flex items-center gap-3">
                      <KeyRound className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{f.friendly_name || t('mfaSettings.totpLabel')}</p>
                        <p className="text-xs text-muted-foreground">{t('mfaSettings.authenticatorApp')}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeFactor(f.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {enrollData ? (
              <div className="space-y-3 border rounded-md p-4 bg-muted/30">
                <p className="text-sm font-medium">{t('mfaSettings.step1ScanQr')}</p>
                {enrollData.qr && (
                  <img src={enrollData.qr} alt={t('mfaSettings.qrAlt')} className="w-48 h-48 mx-auto bg-white p-2 rounded" />
                )}
                <p className="text-xs text-muted-foreground text-center break-all">
                  {t('mfaSettings.orEnterManually')}<br />
                  <code className="font-mono text-xs">{enrollData.secret}</code>
                </p>

                <div>
                  <Label htmlFor="totp-code">{t('mfaSettings.step2EnterCode')}</Label>
                  <Input
                    id="totp-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="text-center font-mono text-lg tracking-widest"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={verifyEnroll} disabled={verifying || code.length !== 6} className="flex-1">
                    {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {t('mfaSettings.verifyAndActivate')}
                  </Button>
                  <Button variant="outline" onClick={cancelEnroll}>{t('mfaSettings.cancel')}</Button>
                </div>
              </div>
            ) : (
              !hasMFA && (
                <Button onClick={startEnroll} disabled={enrolling}>
                  {enrolling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                  {t('mfaSettings.activate2fa')}
                </Button>
              )
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
