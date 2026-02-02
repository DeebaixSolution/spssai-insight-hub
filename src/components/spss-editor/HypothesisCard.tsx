import { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, Lightbulb, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Hypothesis, Variable } from '@/hooks/useAnalysisWizard';
import { HypothesisType, getRecommendedTests, TestRecommendation, VariableMeasure } from '@/types/analysis';
import { cn } from '@/lib/utils';

interface HypothesisCardProps {
  hypothesis: Hypothesis;
  variables: Variable[];
  onUpdate: (updates: Partial<Hypothesis>) => void;
  onRemove: () => void;
  index: number;
}

const hypothesisTypes: { value: HypothesisType; label: string; description: string; icon: string }[] = [
  { value: 'difference', label: 'Difference', description: 'Compare groups (t-test, ANOVA)', icon: '⚖️' },
  { value: 'association', label: 'Association', description: 'Correlate variables', icon: '🔗' },
  { value: 'prediction', label: 'Prediction', description: 'Predict outcomes (regression)', icon: '🎯' },
];

export function HypothesisCard({
  hypothesis,
  variables,
  onUpdate,
  onRemove,
  index,
}: HypothesisCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Get variables by role
  const dependentVars = variables.filter(v => v.role === 'dependent');
  const independentVars = variables.filter(v => v.role === 'independent');
  const allVars = variables.filter(v => v.role !== 'id');

  // Get test recommendations based on current configuration
  const getRecommendations = (): TestRecommendation[] => {
    if (hypothesis.dependentVariables.length === 0) return [];
    
    const dvVar = variables.find(v => v.name === hypothesis.dependentVariables[0]);
    const ivVar = hypothesis.independentVariables.length > 0
      ? variables.find(v => v.name === hypothesis.independentVariables[0])
      : undefined;
    
    if (!dvVar) return [];

    // Estimate group count for nominal IV
    let groupCount: number | undefined;
    if (ivVar && (ivVar.measure === 'nominal' || ivVar.measure === 'ordinal')) {
      groupCount = Object.keys(ivVar.valueLabels || {}).length || 2;
    }

    return getRecommendedTests(variables, []);
  };

  const recommendations = getRecommendations();

  // Validation checks
  const hasValidDV = hypothesis.dependentVariables.length > 0;
  const hasValidIV = hypothesis.independentVariables.length > 0 || hypothesis.type === 'difference';
  const isValid = hasValidDV && hypothesis.statement.trim().length > 0;

  // Status icon
  const StatusIcon = hypothesis.status === 'supported' 
    ? CheckCircle 
    : hypothesis.status === 'rejected' 
    ? AlertCircle 
    : null;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn(
        'border rounded-lg overflow-hidden transition-all',
        hypothesis.status === 'supported' && 'border-green-500 bg-green-50/50 dark:bg-green-950/20',
        hypothesis.status === 'rejected' && 'border-red-500 bg-red-50/50 dark:bg-red-950/20',
        !hypothesis.status && 'border-border'
      )}>
        {/* Header */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold',
                isValid ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                {hypothesis.hypothesisId}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {hypothesis.statement.slice(0, 50) || 'Untitled Hypothesis'}
                    {hypothesis.statement.length > 50 && '...'}
                  </span>
                  {StatusIcon && (
                    <StatusIcon className={cn(
                      'w-4 h-4',
                      hypothesis.status === 'supported' && 'text-green-500',
                      hypothesis.status === 'rejected' && 'text-red-500'
                    )} />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {hypothesisTypes.find(t => t.value === hypothesis.type)?.icon}{' '}
                    {hypothesisTypes.find(t => t.value === hypothesis.type)?.label}
                  </Badge>
                  {hypothesis.dependentVariables.length > 0 && (
                    <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                      DV: {hypothesis.dependentVariables.join(', ')}
                    </Badge>
                  )}
                  {hypothesis.independentVariables.length > 0 && (
                    <Badge variant="secondary" className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300">
                      IV: {hypothesis.independentVariables.join(', ')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Content */}
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4 border-t">
            {/* Hypothesis Type */}
            <div className="space-y-2">
              <Label>Hypothesis Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {hypothesisTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => onUpdate({ type: type.value })}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-all',
                      hypothesis.type === type.value
                        ? 'border-primary bg-primary/10 ring-2 ring-primary'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="text-lg mb-1">{type.icon}</div>
                    <div className="font-medium text-sm">{type.label}</div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Hypothesis Statement */}
            <div className="space-y-2">
              <Label>Hypothesis Statement</Label>
              <Textarea
                value={hypothesis.statement}
                onChange={(e) => onUpdate({ statement: e.target.value })}
                placeholder={
                  hypothesis.type === 'difference'
                    ? 'e.g., There is a significant difference in test scores between male and female students.'
                    : hypothesis.type === 'association'
                    ? 'e.g., There is a significant relationship between study hours and exam performance.'
                    : 'e.g., Study hours and attendance significantly predict exam scores.'
                }
                className="min-h-[80px]"
              />
            </div>

            {/* Variable Assignment */}
            <div className="grid grid-cols-2 gap-4">
              {/* Dependent Variable */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Dependent Variable(s)
                </Label>
                <Select
                  value={hypothesis.dependentVariables[0] || ''}
                  onValueChange={(val) => onUpdate({ dependentVariables: val ? [val] : [] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select DV" />
                  </SelectTrigger>
                  <SelectContent>
                    {(dependentVars.length > 0 ? dependentVars : allVars).map((v) => (
                      <SelectItem key={v.name} value={v.name}>
                        <div className="flex items-center gap-2">
                          <span>{v.name}</span>
                          <span className="text-xs text-muted-foreground">({v.measure})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dependentVars.length === 0 && (
                  <p className="text-xs text-warning">
                    Tip: Assign DV role in Variable View for better guidance
                  </p>
                )}
              </div>

              {/* Independent Variable */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  Independent Variable(s)
                </Label>
                <Select
                  value={hypothesis.independentVariables[0] || ''}
                  onValueChange={(val) => onUpdate({ independentVariables: val ? [val] : [] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select IV" />
                  </SelectTrigger>
                  <SelectContent>
                    {(independentVars.length > 0 ? independentVars : allVars).map((v) => (
                      <SelectItem key={v.name} value={v.name}>
                        <div className="flex items-center gap-2">
                          <span>{v.name}</span>
                          <span className="text-xs text-muted-foreground">({v.measure})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Test Recommendations */}
            {recommendations.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                  <Lightbulb className="w-4 h-4" />
                  <span className="text-sm font-medium">Recommended Tests</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recommendations.map((rec) => (
                    <Badge
                      key={rec.testId}
                      variant="secondary"
                      className={cn(
                        'text-xs',
                        rec.confidence === 'high' && 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
                        rec.confidence === 'medium' && 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                      )}
                    >
                      {rec.testName}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {recommendations[0]?.reason}
                </p>
              </div>
            )}

            {/* Validation Warning */}
            {!isValid && (
              <div className="flex items-center gap-2 text-warning text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Complete the statement and select variables to proceed</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
