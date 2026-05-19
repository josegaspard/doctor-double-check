import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLives } from '@/contexts/LivesContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, RefreshCw, X, Wrench } from 'lucide-react';

const STORAGE_KEY_OPEN = 'lives_debug_panel_open';
const STORAGE_KEY_HIDDEN = 'lives_debug_panel_hidden';

const readBool = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
};

const writeBool = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
};

/**
 * Floating admin-only debug panel showing the LivesContext doctor profile cache state.
 * State (open/hidden) is persisted in localStorage so admins don't need to reopen it
 * on every navigation. Use `window.__showLivesDebug()` from the console to restore
 * a hidden panel.
 */
export function LivesDebugPanel() {
  const { role } = useAuth();
  const { getDebugCacheSnapshot, retryCredentials } = useLives();
  const { t } = useLanguage();
  const [open, setOpen] = useState<boolean>(() => readBool(STORAGE_KEY_OPEN));
  const [hidden, setHidden] = useState<boolean>(() => readBool(STORAGE_KEY_HIDDEN));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    writeBool(STORAGE_KEY_OPEN, open);
  }, [open]);

  useEffect(() => {
    writeBool(STORAGE_KEY_HIDDEN, hidden);
  }, [hidden]);

  // Expose a console shortcut so admins can restore a hidden panel without
  // needing to clear localStorage manually.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__showLivesDebug = () => {
      try {
        localStorage.removeItem(STORAGE_KEY_HIDDEN);
      } catch {
        /* ignore */
      }
      setHidden(false);
      setOpen(true);
    };
    return () => {
      try {
        delete (window as any).__showLivesDebug;
      } catch {
        /* ignore */
      }
    };
  }, []);

  if (role !== 'admin' || hidden) return null;

  const snapshot = getDebugCacheSnapshot();

  const stateBadge = (state: 'value' | 'null' | 'undefined') => {
    if (state === 'value') return <Badge variant="success" className="text-[10px] px-1.5 py-0 h-4">{t('livesDebugPanel.badgeValue')}</Badge>;
    if (state === 'null') return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{t('livesDebugPanel.badgeNull')}</Badge>;
    return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">{t('livesDebugPanel.badgeUndefined')}</Badge>;
  };

  const handleRetry = async () => {
    setRefreshing(true);
    try {
      await retryCredentials();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="bg-background/95 backdrop-blur border-2 border-primary/30 shadow-xl">
        <div className="flex items-center justify-between gap-2 p-2 border-b border-border">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors"
            aria-label={t('livesDebugPanel.togglePanelAria')}
          >
            <Wrench className="w-3.5 h-3.5" />
            {t('livesDebugPanel.title')}
            <span className="text-muted-foreground font-normal">({snapshot.length})</span>
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setHidden(true)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t('livesDebugPanel.closeAria')}
            title={t('livesDebugPanel.closeTooltip')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {open && (
          <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
            {snapshot.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                {t('livesDebugPanel.emptyState')}
              </p>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr,auto,auto] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground px-1 pb-1 border-b border-border">
                  <span>{t('livesDebugPanel.columnDoctor')}</span>
                  <span>{t('livesDebugPanel.columnCedula')}</span>
                  <span>{t('livesDebugPanel.columnCofepris')}</span>
                </div>
                {snapshot.map(entry => (
                  <div
                    key={entry.doctorId}
                    className="grid grid-cols-[1fr,auto,auto] gap-2 items-center text-xs px-1 py-1 hover:bg-muted/50 rounded"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{entry.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {entry.doctorId.slice(0, 8)}…
                      </p>
                    </div>
                    {stateBadge(entry.cedulaState)}
                    {stateBadge(entry.cofeprisState)}
                  </div>
                ))}
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs"
              onClick={handleRetry}
              disabled={refreshing}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              {t('livesDebugPanel.clearCacheButton')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
