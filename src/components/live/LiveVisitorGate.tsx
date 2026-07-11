import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  isVisitor: boolean;
  livePath: string;
  freeSeconds?: number;
}

/**
 * Visitor gating overlay for live streams.
 * Allows visitors to preview the live for `freeSeconds` (default 60s),
 * then blocks the video and prompts to sign up / log in.
 */
export function LiveVisitorGate({ isVisitor, livePath, freeSeconds = 60 }: Props) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [secondsLeft, setSecondsLeft] = useState(freeSeconds);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!isVisitor) return;
    if (secondsLeft <= 0) {
      setBlocked(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, isVisitor]);

  if (!isVisitor) return null;

  if (!blocked) {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div className="bg-black/70 backdrop-blur px-3 py-1.5 rounded-full text-white text-xs font-medium border border-white/20 flex items-center gap-2">
          <Lock className="w-3 h-3" />
          {t('visitorGate.freePreview').replace('{seconds}', String(secondsLeft))}
        </div>
      </div>
    );
  }

  const redirect = encodeURIComponent(livePath);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/95 backdrop-blur-md p-4 rounded-xl">
      <div className="text-center max-w-sm space-y-4 animate-in fade-in zoom-in-95">
        <div className="w-14 h-14 mx-auto rounded-full bg-primary/15 flex items-center justify-center">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h3 className="font-heading text-lg font-bold">{t('visitorGate.title')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('visitorGate.desc')}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={() => navigate(`/login?mode=signup&redirect=${redirect}`)} className="gap-2">
            <UserPlus className="w-4 h-4" /> {t('visitorGate.createFree')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/login?redirect=${redirect}`)} className="gap-2">
            <LogIn className="w-4 h-4" /> {t('visitorGate.haveAccount')}
          </Button>
        </div>
      </div>
    </div>
  );
}
