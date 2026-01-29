import React from 'react';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { Lock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PlanGateProps {
  feature: 
    | 'aiVariableDetection'
    | 'aiResearchSuggestions'
    | 'fullInterpretation'
    | 'apaResults'
    | 'discussion'
    | 'methodology'
    | 'fullResults'
    | 'export'
    | 'advancedTests';
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showOverlay?: boolean;
  className?: string;
}

const featureMap: Record<string, keyof ReturnType<typeof usePlanLimits>['limits']> = {
  aiVariableDetection: 'hasAIVariableDetection',
  aiResearchSuggestions: 'hasAIResearchSuggestions',
  fullInterpretation: 'hasFullAIInterpretation',
  apaResults: 'hasAPAResults',
  discussion: 'hasDiscussion',
  methodology: 'hasMethodology',
  fullResults: 'hasFullResults',
  export: 'hasExport',
  advancedTests: 'hasAdvancedTests',
};

export function PlanGate({
  feature,
  children,
  fallback,
  showOverlay = true,
  className,
}: PlanGateProps) {
  const { limits, isPro } = usePlanLimits();
  const limitKey = featureMap[feature];
  const hasAccess = limits[limitKey] as boolean;

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showOverlay) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      <div className="blur-sm pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg border border-border">
        <div className="text-center p-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">Pro Feature</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upgrade to Pro to unlock this feature
          </p>
          <Button variant="hero" size="sm">
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Pro
          </Button>
        </div>
      </div>
    </div>
  );
}
