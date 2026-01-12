import { usePlanLimits } from '@/hooks/usePlanLimits';
import { cn } from '@/lib/utils';

interface UsageCounterProps {
  className?: string;
}

export function UsageCounter({ className }: UsageCounterProps) {
  const { isPro, usageStats, limits, getAnalysesRemaining } = usePlanLimits();

  if (isPro) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        <span className="text-success font-medium">Unlimited</span> analyses
      </div>
    );
  }

  const remaining = getAnalysesRemaining();
  const used = usageStats?.analysesThisMonth || 0;
  const total = limits.maxAnalysesPerMonth;
  const percentage = (used / total) * 100;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Analyses this month</span>
        <span className="font-medium text-foreground">
          {used} / {total}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            percentage >= 100
              ? 'bg-destructive'
              : percentage >= 80
              ? 'bg-warning'
              : 'bg-primary'
          )}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      {remaining <= 2 && remaining > 0 && (
        <p className="text-xs text-warning">Only {remaining} analyses remaining</p>
      )}
      {remaining === 0 && (
        <p className="text-xs text-destructive">
          Upgrade to Pro for unlimited analyses
        </p>
      )}
    </div>
  );
}
