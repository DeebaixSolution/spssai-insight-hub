import { useMemo } from 'react';
import { Brain, ArrowRight, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Variable, Hypothesis } from '@/hooks/useAnalysisWizard';
import { ParsedDataset } from '@/hooks/useAnalysisWizard';
import { cn } from '@/lib/utils';

interface StatisticalDecisionEngineProps {
  variables: Variable[];
  parsedData: ParsedDataset | null;
  hypotheses: Hypothesis[];
}

interface TestDecision {
  hypothesisId: string;
  dvType: string;
  ivGroupCount: number | null;
  sampleSize: number;
  samplePerGroup: number | null;
  recommendedTest: string;
  alternativeTest: string | null;
  reasoning: string[];
  assumptions: string[];
  effectSizeType: string;
  postHocRequired: boolean;
  direction: 'two-tailed' | 'one-tailed';
  autoH0: string;
}

function generateDecision(
  hypothesis: Hypothesis,
  variables: Variable[],
  parsedData: ParsedDataset | null
): TestDecision | null {
  if (hypothesis.dependentVariables.length === 0) return null;

  const dvVar = variables.find(v => v.name === hypothesis.dependentVariables[0]);
  const ivVar = hypothesis.independentVariables.length > 0
    ? variables.find(v => v.name === hypothesis.independentVariables[0])
    : undefined;

  if (!dvVar) return null;

  const sampleSize = parsedData?.rowCount || 0;
  const dvType = dvVar.measure;
  const reasoning: string[] = [];
  const assumptions: string[] = [];

  // Count IV groups
  let ivGroupCount: number | null = null;
  let samplePerGroup: number | null = null;
  if (ivVar && parsedData) {
    const uniqueGroups = new Set(parsedData.rows.map(r => String(r[ivVar.name])).filter(v => v && v !== 'undefined'));
    ivGroupCount = uniqueGroups.size;
    samplePerGroup = Math.floor(sampleSize / Math.max(ivGroupCount, 1));
  }

  let recommendedTest = '';
  let alternativeTest: string | null = null;
  let effectSizeType = '';
  let postHocRequired = false;

  reasoning.push(`DV "${dvVar.name}" is ${dvType}`);
  if (ivVar) reasoning.push(`IV "${ivVar.name}" is ${ivVar.measure} with ${ivGroupCount ?? '?'} groups`);
  reasoning.push(`Total N = ${sampleSize}`);

  // Decision logic
  if (hypothesis.type === 'difference') {
    if (dvType === 'scale' && ivVar && (ivVar.measure === 'nominal' || ivVar.measure === 'ordinal')) {
      if (ivGroupCount === 2) {
        recommendedTest = 'Independent Samples T-Test';
        alternativeTest = 'Mann-Whitney U Test';
        effectSizeType = "Cohen's d";
        assumptions.push('Normality (Shapiro-Wilk/K-S)', "Homogeneity of variance (Levene's)");
        reasoning.push('Scale DV + 2-group IV → T-Test (or Mann-Whitney if non-normal)');
      } else if (ivGroupCount && ivGroupCount >= 3) {
        recommendedTest = 'One-Way ANOVA';
        alternativeTest = 'Kruskal-Wallis H Test';
        effectSizeType = 'Eta-squared (η²)';
        postHocRequired = true;
        assumptions.push('Normality', "Homogeneity of variance (Levene's)");
        reasoning.push('Scale DV + 3+ groups → ANOVA (or Kruskal-Wallis if non-normal)');
      }
    } else if (dvType === 'nominal' && ivVar?.measure === 'nominal') {
      recommendedTest = 'Chi-Square Test';
      alternativeTest = "Fisher's Exact Test (if expected < 5)";
      effectSizeType = "Cramér's V";
      reasoning.push('Both nominal → Chi-Square test of independence');
    } else if (dvType === 'ordinal' || dvType === 'scale') {
      // Paired scenario when 2 DVs
      if (hypothesis.dependentVariables.length === 2) {
        recommendedTest = 'Paired Samples T-Test';
        alternativeTest = 'Wilcoxon Signed-Rank Test';
        effectSizeType = "Cohen's d";
        assumptions.push('Normality of differences');
        reasoning.push('Two related measures → Paired T-Test');
      }
    }
  } else if (hypothesis.type === 'association') {
    if (dvType === 'scale' && ivVar?.measure === 'scale') {
      recommendedTest = 'Pearson Correlation';
      alternativeTest = 'Spearman Correlation';
      effectSizeType = 'r (correlation coefficient)';
      assumptions.push('Normality', 'Linearity');
      reasoning.push('Both scale → Pearson (or Spearman if non-normal)');
    } else if (dvType === 'ordinal' || ivVar?.measure === 'ordinal') {
      recommendedTest = 'Spearman Correlation';
      alternativeTest = "Kendall's Tau";
      effectSizeType = 'ρ (rho)';
      reasoning.push('Ordinal data → Spearman rank correlation');
    }
  } else if (hypothesis.type === 'prediction') {
    if (dvType === 'scale') {
      if (hypothesis.independentVariables.length === 1) {
        recommendedTest = 'Simple Linear Regression';
        effectSizeType = 'R²';
        assumptions.push('Linearity', 'Normality of residuals', 'Homoscedasticity');
        reasoning.push('Scale DV + 1 predictor → Simple regression');
      } else {
        recommendedTest = 'Multiple Linear Regression';
        effectSizeType = 'R², Adjusted R²';
        assumptions.push('Linearity', 'Normality of residuals', 'Homoscedasticity', 'No multicollinearity');
        reasoning.push('Scale DV + multiple predictors → Multiple regression');
      }
      alternativeTest = null;
    } else if (dvType === 'nominal') {
      recommendedTest = 'Binary Logistic Regression';
      effectSizeType = 'Nagelkerke R², Odds Ratio';
      reasoning.push('Nominal DV → Logistic regression');
    }
  }

  if (!recommendedTest) {
    recommendedTest = 'Manual selection required';
    reasoning.push('Could not auto-determine test — please configure manually');
  }

  // Auto-generate H0
  const dvName = dvVar.label || dvVar.name;
  const ivName = ivVar ? (ivVar.label || ivVar.name) : '';
  let autoH0 = '';
  if (hypothesis.type === 'difference') {
    autoH0 = `There is no statistically significant difference in ${dvName} across ${ivName} groups.`;
  } else if (hypothesis.type === 'association') {
    autoH0 = `There is no statistically significant relationship between ${dvName} and ${ivName}.`;
  } else if (hypothesis.type === 'prediction') {
    autoH0 = `${ivName} does not significantly predict ${dvName}.`;
  }

  return {
    hypothesisId: hypothesis.hypothesisId,
    dvType,
    ivGroupCount,
    sampleSize,
    samplePerGroup,
    recommendedTest,
    alternativeTest,
    reasoning,
    assumptions,
    effectSizeType,
    postHocRequired,
    direction: 'two-tailed',
    autoH0,
  };
}

export function StatisticalDecisionEngine({ variables, parsedData, hypotheses }: StatisticalDecisionEngineProps) {
  const decisions = useMemo(
    () => hypotheses.map(h => ({ hypothesis: h, decision: generateDecision(h, variables, parsedData) })).filter(d => d.decision),
    [hypotheses, variables, parsedData]
  );

  if (decisions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Statistical Decision Engine</h4>
      </div>

      {decisions.map(({ hypothesis, decision }) => {
        if (!decision) return null;
        return (
          <div key={hypothesis.id} className="border border-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-primary/5 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-bold">{decision.hypothesisId}</Badge>
                <span className="text-sm font-medium text-foreground truncate max-w-sm">
                  {hypothesis.statement.slice(0, 60)}{hypothesis.statement.length > 60 ? '...' : ''}
                </span>
              </div>
              <Badge className="bg-primary text-primary-foreground">{decision.recommendedTest}</Badge>
            </div>

            <div className="p-4 space-y-3">
              {/* Auto H0 */}
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground uppercase mb-1">Auto-generated H₀</div>
                <p className="text-sm text-foreground italic">{decision.autoH0}</p>
              </div>

              {/* Reasoning Chain */}
              <div>
                <div className="text-xs text-muted-foreground uppercase mb-1">Decision Reasoning</div>
                <div className="flex flex-wrap items-center gap-1">
                  {decision.reasoning.map((r, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                      <Badge variant="secondary" className="text-xs">{r}</Badge>
                    </span>
                  ))}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Effect Size</span>
                  <div className="font-medium text-foreground">{decision.effectSizeType || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Direction</span>
                  <div className="font-medium text-foreground capitalize">{decision.direction}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Post-Hoc</span>
                  <div className="font-medium text-foreground">{decision.postHocRequired ? 'Required' : 'Not needed'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">N per Group</span>
                  <div className="font-medium text-foreground">{decision.samplePerGroup ?? 'N/A'}</div>
                </div>
              </div>

              {/* Assumptions */}
              {decision.assumptions.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">Required Assumptions</div>
                  <div className="flex flex-wrap gap-1.5">
                    {decision.assumptions.map((a, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Alternative */}
              {decision.alternativeTest && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="w-3.5 h-3.5" />
                  <span>If assumptions violated: <strong className="text-foreground">{decision.alternativeTest}</strong></span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { generateDecision };
export type { TestDecision };
