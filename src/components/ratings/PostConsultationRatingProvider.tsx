import React from 'react';
import { usePostConsultationRating } from '@/hooks/usePostConsultationRating';
import { RatingDialog } from '@/components/ratings/RatingDialog';

interface PostConsultationRatingProviderProps {
  children: React.ReactNode;
}

export function PostConsultationRatingProvider({ children }: PostConsultationRatingProviderProps) {
  const { pendingRating, isDialogOpen, closeDialog, onRated } = usePostConsultationRating();

  return (
    <>
      {children}
      {pendingRating && (
        <RatingDialog
          open={isDialogOpen}
          onClose={closeDialog}
          consultationId={pendingRating.consultationId}
          doctorId={pendingRating.doctorId}
          doctorName={pendingRating.doctorName}
          onRated={onRated}
        />
      )}
    </>
  );
}
