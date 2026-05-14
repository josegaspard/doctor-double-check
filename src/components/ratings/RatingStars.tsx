import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export function RatingStars({
  rating,
  maxRating = 5,
  size = 'md',
  showValue = false,
  interactive = false,
  onChange,
}: RatingStarsProps) {
  const [hoverRating, setHoverRating] = React.useState(0);

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  const handleClick = (value: number) => {
    if (interactive && onChange) {
      onChange(value);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: maxRating }, (_, i) => {
          const value = i + 1;
          const displayRating = interactive && hoverRating > 0 ? hoverRating : rating;
          const isFilled = value <= displayRating;
          const isHalf = !isFilled && value - 0.5 <= displayRating;

          return (
            <button
              key={i}
              type="button"
              disabled={!interactive}
              onClick={() => handleClick(value)}
              onMouseEnter={() => interactive && setHoverRating(value)}
              onMouseLeave={() => interactive && setHoverRating(0)}
              className={cn(
                'focus:outline-none transition-transform',
                interactive && 'hover:scale-110 cursor-pointer',
                !interactive && 'cursor-default'
              )}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  'transition-colors',
                  isFilled
                    ? 'fill-warning text-warning'
                    : isHalf
                    ? 'fill-warning/50 text-warning'
                    : 'fill-transparent text-gray-300'
                )}
              />
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-medium text-muted-foreground ml-1">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
