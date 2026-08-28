import React, { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { useProfileCategory } from '@/hooks/useProfileCategory';
import {
  useRatingSummary,
  useMyRating,
  canRate,
  type RatingTargetType,
} from '@/hooks/useContentRatings';
import { RatingStars } from './RatingStars';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

/**
 * Estrellas de una pieza (contenido, live o grabación) — cliente 2026-08-28.
 * En modo `compact` sólo muestra la media (para las tarjetas de la parrilla);
 * en modo normal deja puntuar si el rol lo permite.
 */
export function ContentRating({
  targetType,
  targetId,
  ownerId,
  compact = false,
  className,
}: {
  targetType: RatingTargetType;
  targetId?: string | null;
  ownerId?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { toggles } = useSiteToggles();
  const { avg, count } = useRatingSummary(targetType, targetId);
  const { authorRole } = useProfileCategory(ownerId);
  const { myRating, myComment, isSaving, submit } = useMyRating(targetType, targetId, user?.id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(0);
  const [draftComment, setDraftComment] = useState('');

  if (toggles.enable_content_ratings === false) return null;

  const isSelf = !!user?.id && !!ownerId && user.id === ownerId;
  const allowed = !!user?.id && canRate(role, authorRole, isSelf);

  // ── Sólo lectura (tarjetas de parrilla) ────────────────────────────────────
  if (compact) {
    if (count === 0) return null;
    return (
      <span
        className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}
        title={`${avg.toFixed(1)} / 5 · ${count} ${count === 1 ? t('contentRatings.review') : t('contentRatings.reviews')}`}
      >
        <Star className="w-3.5 h-3.5 fill-warning text-warning shrink-0" aria-hidden="true" />
        <span className="font-semibold text-foreground">{avg.toFixed(1)}</span>
        <span>({count})</span>
      </span>
    );
  }

  const openDialog = () => {
    setDraft(myRating ?? 0);
    setDraftComment(myComment ?? '');
    setOpen(true);
  };

  const save = async () => {
    if (draft < 1) {
      toast.error(t('contentRatings.pickStars'));
      return;
    }
    const { error } = await submit(draft, draftComment);
    if (error) {
      toast.error(t(`contentRatings.err${error === 'not_allowed' ? 'NotAllowed' : error === 'not_public' ? 'NotPublic' : error === 'not_found' ? 'NotFound' : 'Generic'}`));
      return;
    }
    toast.success(myRating ? t('contentRatings.updated') : t('contentRatings.saved'));
    setOpen(false);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      <div className="flex items-center gap-2">
        <RatingStars rating={avg} size="sm" />
        <span className="text-sm text-muted-foreground">
          {count === 0
            ? t('contentRatings.noReviews')
            : `${avg.toFixed(1)} · ${count} ${count === 1 ? t('contentRatings.review') : t('contentRatings.reviews')}`}
        </span>
      </div>

      {allowed && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={openDialog}
        >
          {myRating ? t('contentRatings.edit') : t('contentRatings.leave')}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{myRating ? t('contentRatings.titleEdit') : t('contentRatings.titleNew')}</DialogTitle>
            <DialogDescription>{t('contentRatings.desc')}</DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-2">
            <RatingStars rating={draft} size="lg" interactive onChange={setDraft} />
          </div>

          <Textarea
            value={draftComment}
            onChange={(e) => setDraftComment(e.target.value.slice(0, 2000))}
            placeholder={t('contentRatings.commentPlaceholder')}
            rows={3}
            maxLength={2000}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
              {t('contentRatings.cancel')}
            </Button>
            <Button onClick={save} disabled={isSaving || draft < 1}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('contentRatings.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
