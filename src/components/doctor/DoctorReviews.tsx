import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RatingStars } from '@/components/ratings/RatingStars';
import { Star, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  patientName: string;
  patientAvatar?: string;
}

interface DoctorReviewsProps {
  doctorId: string;
  onRatingCalculated?: (avg: number) => void;
}

export default function DoctorReviews({ doctorId, onRatingCalculated }: DoctorReviewsProps) {
  const { t, language } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [computedAverage, setComputedAverage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);
  const dateLocale = language === 'es' ? es : enUS;

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const { data, error } = await supabase
          .from('consultation_ratings')
          .select('id, rating, comment, created_at, patient_id')
          .eq('doctor_id', doctorId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error || !data || data.length === 0) {
          setIsLoading(false);
          return;
        }

        const patientIds = [...new Set(data.map(r => r.patient_id))];
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, name, avatar_url')
          .in('id', patientIds);

        const profileMap = new Map(
          (profiles || []).map((p: any) => [p.id, { name: p.name, avatar: p.avatar_url }])
        );

        const mappedReviews = data.map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: new Date(r.created_at),
          patientName: profileMap.get(r.patient_id)?.name || t('doctorProfile.anonymousPatient'),
          patientAvatar: profileMap.get(r.patient_id)?.avatar || undefined,
        }));

        setReviews(mappedReviews);

        // Compute average from actual data
        const avg = mappedReviews.reduce((sum, r) => sum + r.rating, 0) / mappedReviews.length;
        setComputedAverage(avg);
        onRatingCalculated?.(avg);
      } catch (err) {
        console.error('Error fetching reviews:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReviews();
  }, [doctorId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (reviews.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="w-5 h-5 text-premium fill-premium" />
          {t('doctorProfile.reviewsTitle')}
        </CardTitle>
        <div className="flex items-center gap-3 mt-1">
          <RatingStars rating={Math.round(computedAverage)} size="sm" />
          <span className="text-sm font-semibold">{computedAverage.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">
            ({reviews.length} {reviews.length === 1 ? t('doctorProfile.review') : t('doctorProfile.reviews')})
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleCount < reviews.length && (
          <p className="text-xs text-muted-foreground">
            {t('doctorProfile.showingReviews').replace('{count}', String(Math.min(visibleCount, reviews.length))).replace('{total}', String(reviews.length))}
          </p>
        )}
        {reviews.slice(0, visibleCount).map(review => (
          <div key={review.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={review.patientAvatar} />
                  <AvatarFallback className="text-xs">
                    {review.patientName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{review.patientName}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(review.createdAt, 'dd MMM yyyy', { locale: dateLocale })}
              </span>
            </div>
            <RatingStars rating={review.rating} size="sm" />
            {review.comment && review.comment.trim() && (
              <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{review.comment}</p>
            )}
          </div>
        ))}
        {visibleCount < reviews.length && (
          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={() => setVisibleCount(prev => prev + 10)}
          >
            <ChevronDown className="w-4 h-4 mr-1" />
            {t('doctorProfile.showMoreReviews')} ({reviews.length - visibleCount})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
