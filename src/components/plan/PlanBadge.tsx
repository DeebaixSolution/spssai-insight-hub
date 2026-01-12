import { Crown } from 'lucide-react';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { cn } from '@/lib/utils';

interface PlanBadgeProps {
  className?: string;
}

export function PlanBadge({ className }: PlanBadgeProps) {
  const { isPro } = usePlanLimits();

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        isPro
          ? 'bg-gradient-hero text-white'
          : 'bg-muted text-muted-foreground',
        className
      )}
    >
      {isPro && <Crown className="w-3 h-3" />}
      {isPro ? 'Pro' : 'Free'}
    </div>
  );
}
