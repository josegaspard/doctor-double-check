import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDisclaimer } from '@/hooks/useDisclaimer';

interface Props {
  /** Optional context (e.g. { session_id: '...' }) saved with the acceptance */
  context?: Record<string, unknown>;
  /** Children render only after acceptance (or if disabled) */
  children: React.ReactNode;
  /** Show the persistent short banner above children */
  showBanner?: boolean;
}

/**
 * Mandatory acceptance modal + persistent banner for the
 * "Orientación médica" disclaimer.
 */
export function OrientacionDisclaimerGate({ context, children, showBanner = true }: Props) {
  const { content, accepted, loading, accept } = useDisclaimer();
  const [submitting, setSubmitting] = React.useState(false);

  if (loading) return null;
  if (!content.enabled) return <>{children}</>;

  const handleAccept = async () => {
    setSubmitting(true);
    await accept(context);
    setSubmitting(false);
  };

  // Render simple markdown-ish bold + line breaks safely (no HTML injection)
  const renderText = (text: string) =>
    text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} className="mb-2 last:mb-0 text-base leading-relaxed">
          {parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**') ? (
              <strong key={j}>{p.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{p}</span>
            )
          )}
        </p>
      );
    });

  return (
    <>
      <Dialog open={accepted === false}>
        <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
              Antes de continuar
            </DialogTitle>
            <DialogDescription>
              Debes leer y aceptar este aviso para usar la orientación médica.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh] pr-3">
            <div className="text-foreground">{renderText(content.long)}</div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={handleAccept} disabled={submitting} size="lg">
              {submitting ? 'Guardando…' : 'Acepto y continúo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {accepted && showBanner && (
        <div className="rounded-md border border-amber-300/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-100 flex items-start gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <span>{content.short}</span>
        </div>
      )}

      {accepted ? children : null}
    </>
  );
}
