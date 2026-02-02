import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface EffectSizeResult {
  type: 'cohens_d' | 'eta_squared' | 'partial_eta_squared' | 'omega_squared' | 'r' | 'r_squared' | 'odds_ratio' | 'cramers_v';
  value: number;
  magnitude: 'negligible' | 'small' | 'medium' | 'large';
  interpretation: string;
  confidenceInterval?: [number, number];
}

interface EffectSizeDisplayProps {
  effectSize: EffectSizeResult;
  showConfidenceInterval?: boolean;
  compact?: boolean;
}

const effectSizeLabels: Record<EffectSizeResult['type'], string> = {
  cohens_d: "Cohen's d",
  eta_squared: "η²",
  partial_eta_squared: "Partial η²",
  omega_squared: "ω²",
  r: "r",
  r_squared: "R²",
  odds_ratio: "Odds Ratio",
  cramers_v: "Cramér's V",
};

const magnitudeColors: Record<EffectSizeResult['magnitude'], string> = {
  negligible: 'bg-muted text-muted-foreground',
  small: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  large: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export function EffectSizeDisplay({
  effectSize,
  showConfidenceInterval = true,
  compact = false,
}: EffectSizeDisplayProps) {
  const label = effectSizeLabels[effectSize.type];
  const formattedValue = effectSize.value.toFixed(3);

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className={cn('gap-1', magnitudeColors[effectSize.magnitude])}>
            {label} = {formattedValue}
            <span className="text-xs capitalize">({effectSize.magnitude})</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{effectSize.interpretation}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="p-4 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Effect Size
        </h4>
        <Badge className={magnitudeColors[effectSize.magnitude]}>
          {effectSize.magnitude.charAt(0).toUpperCase() + effectSize.magnitude.slice(1)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-semibold text-foreground">{formattedValue}</p>
        </div>

        {showConfidenceInterval && effectSize.confidenceInterval && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">95% CI</p>
            <p className="text-lg text-foreground">
              [{effectSize.confidenceInterval[0].toFixed(3)}, {effectSize.confidenceInterval[1].toFixed(3)}]
            </p>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground mt-3">
        {effectSize.interpretation}
      </p>
    </div>
  );
}

// Generate academic effect size narrative
export function generateEffectSizeNarrative(effectSize: EffectSizeResult, testType: string): string {
  const label = effectSizeLabels[effectSize.type];
  const value = effectSize.value.toFixed(2);
  
  const magnitudeDescriptions: Record<EffectSizeResult['magnitude'], string> = {
    negligible: 'negligible practical significance',
    small: 'a small practical effect',
    medium: 'a medium practical effect',
    large: 'a large practical effect',
  };

  const ciText = effectSize.confidenceInterval
    ? `, 95% CI [${effectSize.confidenceInterval[0].toFixed(2)}, ${effectSize.confidenceInterval[1].toFixed(2)}]`
    : '';

  switch (effectSize.type) {
    case 'cohens_d':
      return `The effect size was ${effectSize.magnitude} (${label} = ${value}${ciText}), indicating ${magnitudeDescriptions[effectSize.magnitude]} in the difference between groups.`;
    
    case 'eta_squared':
    case 'partial_eta_squared':
    case 'omega_squared':
      const percent = (effectSize.value * 100).toFixed(1);
      return `The effect size (${label} = ${value}${ciText}) indicated that approximately ${percent}% of the variance in the dependent variable was explained by the independent variable, representing ${magnitudeDescriptions[effectSize.magnitude]}.`;
    
    case 'r':
      const direction = effectSize.value >= 0 ? 'positive' : 'negative';
      return `The ${direction} correlation coefficient (${label} = ${value}${ciText}) indicated ${magnitudeDescriptions[effectSize.magnitude]} between the variables.`;
    
    case 'r_squared':
      const percentExplained = (effectSize.value * 100).toFixed(1);
      return `The model explained ${percentExplained}% of the variance in the outcome variable (${label} = ${value}${ciText}), representing ${magnitudeDescriptions[effectSize.magnitude]}.`;
    
    case 'odds_ratio':
      if (effectSize.value > 1) {
        return `The odds ratio (OR = ${value}${ciText}) indicated that the odds of the outcome were ${value} times higher in the exposed group, representing ${magnitudeDescriptions[effectSize.magnitude]}.`;
      } else {
        const inverseOR = (1 / effectSize.value).toFixed(2);
        return `The odds ratio (OR = ${value}${ciText}) indicated that the odds of the outcome were ${inverseOR} times lower in the exposed group, representing ${magnitudeDescriptions[effectSize.magnitude]}.`;
      }
    
    case 'cramers_v':
      return `Cramér's V (${value}${ciText}) indicated ${magnitudeDescriptions[effectSize.magnitude]} in the association between the categorical variables.`;
    
    default:
      return `The effect size (${label} = ${value}${ciText}) indicated ${magnitudeDescriptions[effectSize.magnitude]}.`;
  }
}

// Effect size thresholds by type
export function interpretEffectSize(type: EffectSizeResult['type'], value: number): EffectSizeResult['magnitude'] {
  const absValue = Math.abs(value);
  
  switch (type) {
    case 'cohens_d':
      if (absValue < 0.2) return 'negligible';
      if (absValue < 0.5) return 'small';
      if (absValue < 0.8) return 'medium';
      return 'large';
    
    case 'eta_squared':
    case 'partial_eta_squared':
    case 'omega_squared':
      if (absValue < 0.01) return 'negligible';
      if (absValue < 0.06) return 'small';
      if (absValue < 0.14) return 'medium';
      return 'large';
    
    case 'r':
    case 'cramers_v':
      if (absValue < 0.1) return 'negligible';
      if (absValue < 0.3) return 'small';
      if (absValue < 0.5) return 'medium';
      return 'large';
    
    case 'r_squared':
      if (absValue < 0.02) return 'negligible';
      if (absValue < 0.13) return 'small';
      if (absValue < 0.26) return 'medium';
      return 'large';
    
    case 'odds_ratio':
      const logOR = Math.log(value);
      if (Math.abs(logOR) < 0.2) return 'negligible';
      if (Math.abs(logOR) < 0.5) return 'small';
      if (Math.abs(logOR) < 0.8) return 'medium';
      return 'large';
    
    default:
      return 'medium';
  }
}
