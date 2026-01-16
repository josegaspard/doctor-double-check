import React, { useState, useEffect, useRef } from 'react';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AnimatedViewerCountProps {
  count: number;
  showIcon?: boolean;
  className?: string;
  variant?: 'badge' | 'inline' | 'large';
}

export function AnimatedViewerCount({ 
  count, 
  showIcon = true, 
  className,
  variant = 'badge'
}: AnimatedViewerCountProps) {
  const [displayCount, setDisplayCount] = useState(count);
  const [trend, setTrend] = useState<'up' | 'down' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevCountRef = useRef(count);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (count !== prevCountRef.current) {
      const diff = count - prevCountRef.current;
      setTrend(diff > 0 ? 'up' : 'down');
      setIsAnimating(true);
      
      // Animate the number
      setDisplayCount(count);
      
      // Clear trend indicator after animation
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setTrend(null);
        setIsAnimating(false);
      }, 2000);
      
      prevCountRef.current = count;
    }
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [count]);

  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;
  const trendColor = trend === 'up' ? 'text-success' : 'text-destructive';

  if (variant === 'large') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {showIcon && <Users className="w-5 h-5 text-muted-foreground" />}
        <div className="relative flex items-center gap-1">
          <span 
            className={cn(
              "text-2xl font-bold tabular-nums transition-all duration-300",
              isAnimating && trend === 'up' && "text-success animate-bounce-subtle",
              isAnimating && trend === 'down' && "text-destructive"
            )}
          >
            {displayCount.toLocaleString()}
          </span>
          {trend && (
            <TrendIcon 
              className={cn(
                "w-4 h-4 animate-fade-in",
                trendColor
              )} 
            />
          )}
        </div>
        <span className="text-sm text-muted-foreground">viendo</span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        {showIcon && <Users className="w-4 h-4" />}
        <span 
          className={cn(
            "tabular-nums transition-all duration-300",
            isAnimating && trend === 'up' && "text-success font-semibold",
            isAnimating && trend === 'down' && "text-destructive font-semibold"
          )}
        >
          {displayCount}
        </span>
        {trend && (
          <TrendIcon 
            className={cn(
              "w-3 h-3 animate-fade-in",
              trendColor
            )} 
          />
        )}
      </span>
    );
  }

  // Default: badge variant
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "gap-1 bg-black/60 text-white border-0 transition-all duration-300",
        isAnimating && trend === 'up' && "bg-success/80 ring-2 ring-success/30",
        isAnimating && trend === 'down' && "bg-destructive/60",
        className
      )}
    >
      {showIcon && <Users className="w-3 h-3" />}
      <span className={cn(
        "tabular-nums transition-transform duration-300",
        isAnimating && "scale-110"
      )}>
        {displayCount}
      </span>
      {trend && (
        <TrendIcon 
          className={cn(
            "w-3 h-3 animate-fade-in ml-0.5",
            trend === 'up' ? "text-white" : "text-white/80"
          )} 
        />
      )}
      <span className="sr-only">viewers</span>
    </Badge>
  );
}
