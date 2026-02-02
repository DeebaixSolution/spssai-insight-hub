import { useMemo } from 'react';
import { Lightbulb, AlertTriangle, Ban, CheckCircle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { Variable, Hypothesis, TestDefinition } from '@/types/analysis';
import { ANALYSIS_TESTS, getRecommendedTests } from '@/types/analysis';

interface GuidedTestRecommendationProps {
  variables: Variable[];
  hypotheses: Hypothesis[];
  selectedTestId: string | null;
  onTestSelect: (testId: string) => void;
}

interface TestRecommendation {
  testId: string;
  status: 'recommended' | 'available' | 'warning' | 'disabled';
  reason: string;
  glow?: boolean;
}

export function GuidedTestRecommendation({
  variables,
  hypotheses,
  selectedTestId,
  onTestSelect,
}: GuidedTestRecommendationProps) {
  const dvVariables = variables.filter(v => v.role === 'dependent');
  const ivVariables = variables.filter(v => v.role === 'independent');

  const recommendations = useMemo(() => {
    const results: TestRecommendation[] = [];
    
    // Get AI recommendations based on variable structure
    const recommended = getRecommendedTests(variables, hypotheses);
    const recommendedSet = new Set(recommended.map(r => r.testId));

    ANALYSIS_TESTS.forEach(test => {
      let status: TestRecommendation['status'] = 'available';
      let reason = '';
      let glow = false;

      // Check if recommended
      if (recommendedSet.has(test.id)) {
        status = 'recommended';
        reason = recommended.find(r => r.testId === test.id)?.reason || 'Recommended based on variable configuration';
        glow = true;
      }

      // Check for DV measurement level conflicts
      if (test.requiredVariables.dependent) {
        const requiredMeasures = test.requiredVariables.dependent.measures;
        const hasSuitableDV = dvVariables.some(v => requiredMeasures.includes(v.measure || 'scale'));
        
        if (!hasSuitableDV && dvVariables.length > 0) {
          status = 'disabled';
          reason = `Requires ${requiredMeasures.join('/')} DV, but none available`;
        }
      }

      // Ordinal DV with Pearson = disable
      if (test.id === 'pearson') {
        const hasOrdinalDV = dvVariables.some(v => v.measure === 'ordinal');
        if (hasOrdinalDV) {
          status = 'disabled';
          reason = 'Ordinal data: Use Spearman or Kendall instead';
        }
      }

      // Scale DV + Nominal IV (2 groups) = recommend t-test
      if (test.id === 'independent-t-test') {
        const hasScaleDV = dvVariables.some(v => v.measure === 'scale');
        const hasNominalIV = ivVariables.some(v => 
          v.measure === 'nominal' && v.uniqueValues && v.uniqueValues <= 2
        );
        if (hasScaleDV && hasNominalIV && status !== 'disabled') {
          status = 'recommended';
          reason = 'Recommended: Scale DV with 2-group Nominal IV';
          glow = true;
        }
      }

      // Scale DV + Nominal IV (3+ groups) = recommend ANOVA
      if (test.id === 'one-way-anova') {
        const hasScaleDV = dvVariables.some(v => v.measure === 'scale');
        const hasNominalIV = ivVariables.some(v => 
          v.measure === 'nominal' && v.uniqueValues && v.uniqueValues > 2
        );
        if (hasScaleDV && hasNominalIV && status !== 'disabled') {
          status = 'recommended';
          reason = 'Recommended: Scale DV with 3+ group IV';
          glow = true;
        }
      }

      results.push({ testId: test.id, status, reason, glow });
    });

    return results;
  }, [variables, hypotheses, dvVariables, ivVariables]);

  const recommendedTests = recommendations.filter(r => r.status === 'recommended');
  const warningTests = recommendations.filter(r => r.status === 'warning');

  return (
    <div className="space-y-4">
      {/* Recommendations Summary */}
      {recommendedTests.length > 0 && (
        <Alert className="bg-primary/5 border-primary/20">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <span className="font-medium">Recommended tests based on your variables:</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {recommendedTests.map(rec => {
                const test = ANALYSIS_TESTS.find(t => t.id === rec.testId);
                return (
                  <button
                    key={rec.testId}
                    onClick={() => onTestSelect(rec.testId)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm transition-all',
                      'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30',
                      rec.glow && 'ring-2 ring-primary/50 ring-offset-1'
                    )}
                  >
                    {test?.name}
                  </button>
                );
              })}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Variable Analysis */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Dependent Variables ({dvVariables.length})</h4>
          <div className="space-y-1">
            {dvVariables.length === 0 ? (
              <p className="text-xs text-muted-foreground">No DV assigned in Step 2</p>
            ) : (
              dvVariables.map(v => (
                <div key={v.name} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-xs capitalize">
                    {v.measure}
                  </Badge>
                  <span>{v.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Independent Variables ({ivVariables.length})</h4>
          <div className="space-y-1">
            {ivVariables.length === 0 ? (
              <p className="text-xs text-muted-foreground">No IV assigned in Step 2</p>
            ) : (
              ivVariables.map(v => (
                <div key={v.name} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-xs capitalize">
                    {v.measure}
                  </Badge>
                  <span>{v.name}</span>
                  {v.uniqueValues && (
                    <span className="text-muted-foreground">({v.uniqueValues} groups)</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Hypothesis Check */}
      {hypotheses.length === 0 && (
        <Alert variant="destructive" className="bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No hypotheses defined. Inferential tests (t-tests, ANOVA, regression) require linked hypotheses.
            <br />
            <span className="text-xs">Go back to Step 3 to define your hypotheses.</span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Test Card with recommendation status
export function TestCard({
  test,
  recommendation,
  isSelected,
  isPro: testIsPro,
  canUsePro,
  onSelect,
}: {
  test: TestDefinition;
  recommendation?: TestRecommendation;
  isSelected: boolean;
  isPro: boolean;
  canUsePro: boolean;
  onSelect: () => void;
}) {
  const isLocked = testIsPro && !canUsePro;
  const isDisabled = recommendation?.status === 'disabled' || isLocked;

  return (
    <button
      onClick={() => !isDisabled && onSelect()}
      disabled={isDisabled}
      className={cn(
        'w-full p-3 rounded-lg text-left transition-all border',
        isSelected && 'bg-primary text-primary-foreground border-primary ring-2 ring-primary ring-offset-2',
        !isSelected && recommendation?.status === 'recommended' && 'border-primary/50 bg-primary/5',
        !isSelected && recommendation?.glow && 'ring-2 ring-primary/30',
        !isSelected && recommendation?.status === 'available' && 'bg-muted/30 border-border hover:bg-muted',
        !isSelected && recommendation?.status === 'warning' && 'bg-warning/5 border-warning/50',
        isDisabled && 'opacity-50 cursor-not-allowed bg-muted/20'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {isSelected && <CheckCircle className="w-4 h-4" />}
            {recommendation?.status === 'recommended' && !isSelected && (
              <Lightbulb className="w-4 h-4 text-primary" />
            )}
            {recommendation?.status === 'disabled' && (
              <Ban className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="font-medium text-sm">{test.name}</span>
            {testIsPro && <Badge variant="secondary" className="text-xs">PRO</Badge>}
          </div>
          <p className={cn(
            'text-xs mt-1',
            isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
          )}>
            {recommendation?.reason || test.description}
          </p>
        </div>
        {recommendation?.status === 'recommended' && !isSelected && (
          <ArrowRight className="w-4 h-4 text-primary" />
        )}
      </div>
    </button>
  );
}
