import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle, Info, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface AssumptionResult {
  name: string;
  passed: boolean;
  value: string | number;
  threshold: string;
  interpretation: string;
  recommendation: string;
  testStatistic?: string;
}

interface AssumptionPanelProps {
  assumptions: AssumptionResult[];
  testType: string;
  onSwitchToNonparametric?: (alternativeTest: string) => void;
  onProceedAnyway?: () => void;
  isLoading?: boolean;
}

export function AssumptionPanel({
  assumptions,
  testType,
  onSwitchToNonparametric,
  onProceedAnyway,
  isLoading,
}: AssumptionPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const passedCount = assumptions.filter(a => a.passed).length;
  const totalCount = assumptions.length;
  const allPassed = passedCount === totalCount;
  const hasViolations = passedCount < totalCount;

  const getAlternativeTest = () => {
    switch (testType) {
      case 'independent-t-test': return 'mann-whitney';
      case 'paired-t-test': return 'wilcoxon';
      case 'one-way-anova': return 'kruskal-wallis';
      case 'repeated-measures-anova': return 'friedman';
      case 'pearson': return 'spearman';
      default: return null;
    }
  };

  const alternativeTest = getAlternativeTest();

  return (
    <div className={cn(
      'rounded-lg border transition-colors',
      allPassed ? 'bg-success/5 border-success/30' : 'bg-warning/5 border-warning/30'
    )}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center gap-3">
              {allPassed ? (
                <CheckCircle className="w-5 h-5 text-success" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-warning" />
              )}
              <div className="text-left">
                <h4 className="font-medium text-foreground">Assumption Checks</h4>
                <p className="text-sm text-muted-foreground">
                  {passedCount}/{totalCount} assumptions met
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={allPassed ? 'default' : 'secondary'}>
                {allPassed ? 'All Passed' : 'Review Required'}
              </Badge>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            {/* Assumption Results */}
            <div className="space-y-2">
              {assumptions.map((assumption, index) => (
                <AssumptionRow key={index} assumption={assumption} />
              ))}
            </div>

            {/* Actions for Violations */}
            {hasViolations && (
              <div className="pt-3 border-t border-border/50 space-y-3">
                <div className="text-sm text-muted-foreground">
                  <Info className="w-4 h-4 inline mr-2" />
                  Some assumptions are violated. You can:
                </div>
                <div className="flex flex-wrap gap-2">
                  {alternativeTest && onSwitchToNonparametric && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSwitchToNonparametric(alternativeTest)}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Switch to {alternativeTest.replace(/-/g, ' ')}
                    </Button>
                  )}
                  {onProceedAnyway && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onProceedAnyway}
                      className="text-muted-foreground"
                    >
                      Proceed Anyway (with caution)
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* All Passed Message */}
            {allPassed && (
              <div className="pt-3 border-t border-border/50">
                <p className="text-sm text-success flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  All assumptions are satisfied. Proceed with the parametric test.
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function AssumptionRow({ assumption }: { assumption: AssumptionResult }) {
  return (
    <div className={cn(
      'p-3 rounded-lg flex items-start gap-3',
      assumption.passed ? 'bg-success/10' : 'bg-warning/10'
    )}>
      {assumption.passed ? (
        <CheckCircle className="w-4 h-4 text-success mt-0.5" />
      ) : (
        <XCircle className="w-4 h-4 text-warning mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h5 className="font-medium text-sm text-foreground">{assumption.name}</h5>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-xs shrink-0">
                {typeof assumption.value === 'number' 
                  ? assumption.value.toFixed(3) 
                  : assumption.value}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Threshold: {assumption.threshold}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {assumption.interpretation}
        </p>
        {!assumption.passed && (
          <p className="text-xs text-warning mt-1 font-medium">
            → {assumption.recommendation}
          </p>
        )}
      </div>
    </div>
  );
}

// Academic assumption narrative generator
export function generateAssumptionNarrative(
  assumptions: AssumptionResult[],
  testType: string,
  allPassed: boolean
): string {
  if (assumptions.length === 0) return '';

  const testName = testType.replace(/-/g, ' ');
  
  if (allPassed) {
    const normalityCheck = assumptions.find(a => a.name.toLowerCase().includes('normality'));
    const homogeneityCheck = assumptions.find(a => a.name.toLowerCase().includes('homogeneity') || a.name.toLowerCase().includes('variance'));
    
    let narrative = `Preliminary assumption checks were conducted prior to performing the ${testName}. `;
    
    if (normalityCheck) {
      narrative += `The Shapiro-Wilk test indicated that the data were normally distributed (${normalityCheck.value}). `;
    }
    
    if (homogeneityCheck) {
      narrative += `Levene's test confirmed homogeneity of variances (${homogeneityCheck.value}). `;
    }
    
    narrative += `Therefore, the assumptions for the ${testName} were satisfied, and the analysis proceeded as planned.`;
    
    return narrative;
  } else {
    const violations = assumptions.filter(a => !a.passed);
    
    let narrative = `Preliminary assumption checks were conducted prior to performing the ${testName}. `;
    
    violations.forEach((v, i) => {
      if (i === 0) {
        narrative += `However, ${v.interpretation.toLowerCase()} `;
      } else {
        narrative += `Additionally, ${v.interpretation.toLowerCase()} `;
      }
    });
    
    narrative += `Given these violations, ${violations[0].recommendation.toLowerCase()}`;
    
    return narrative;
  }
}
