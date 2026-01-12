import { useState } from 'react';
import { ChevronRight, Info, Lock, GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Variable, AnalysisConfig } from '@/hooks/useAnalysisWizard';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { cn } from '@/lib/utils';

interface Step4SelectionProps {
  variables: Variable[];
  analysisConfig: AnalysisConfig | null;
  onConfigChange: (config: AnalysisConfig) => void;
  suggestedTest?: { category: string; type: string };
}

interface TestDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  requiredVariables: {
    dependent?: { type: string[]; min: number; max: number };
    independent?: { type: string[]; min: number; max: number };
    grouping?: { type: string[]; min?: number; max?: number };
  };
  isPro: boolean;
}

const testCategories = [
  { id: 'descriptive', name: 'Descriptive Statistics', icon: '📊' },
  { id: 'compare-means', name: 'Compare Means', icon: '📈' },
  { id: 'correlation', name: 'Correlation', icon: '🔗' },
  { id: 'regression', name: 'Regression', icon: '📉' },
  { id: 'nonparametric', name: 'Nonparametric Tests', icon: '📋' },
  { id: 'reliability', name: 'Scale Reliability', icon: '✓' },
];

const tests: TestDefinition[] = [
  // Descriptive
  {
    id: 'frequencies',
    name: 'Frequencies',
    description: 'Frequency tables and charts for categorical variables',
    category: 'descriptive',
    requiredVariables: { dependent: { type: ['nominal', 'ordinal'], min: 1, max: 10 } },
    isPro: false,
  },
  {
    id: 'descriptives',
    name: 'Descriptives',
    description: 'Mean, SD, min, max for scale variables',
    category: 'descriptive',
    requiredVariables: { dependent: { type: ['scale'], min: 1, max: 20 } },
    isPro: false,
  },
  {
    id: 'crosstabs',
    name: 'Crosstabs',
    description: 'Cross-tabulation with chi-square test',
    category: 'descriptive',
    requiredVariables: {
      dependent: { type: ['nominal', 'ordinal'], min: 1, max: 1 },
      independent: { type: ['nominal', 'ordinal'], min: 1, max: 1 },
    },
    isPro: false,
  },
  // Compare Means
  {
    id: 'independent-t-test',
    name: 'Independent Samples T-Test',
    description: 'Compare means of two independent groups',
    category: 'compare-means',
    requiredVariables: {
      dependent: { type: ['scale'], min: 1, max: 1 },
      grouping: { type: ['nominal', 'ordinal'], min: 1, max: 1 },
    },
    isPro: false,
  },
  {
    id: 'paired-t-test',
    name: 'Paired Samples T-Test',
    description: 'Compare means of two related measurements',
    category: 'compare-means',
    requiredVariables: { dependent: { type: ['scale'], min: 2, max: 2 } },
    isPro: false,
  },
  {
    id: 'one-way-anova',
    name: 'One-Way ANOVA',
    description: 'Compare means across 3+ groups',
    category: 'compare-means',
    requiredVariables: {
      dependent: { type: ['scale'], min: 1, max: 1 },
      grouping: { type: ['nominal', 'ordinal'], min: 1, max: 1 },
    },
    isPro: true,
  },
  {
    id: 'two-way-anova',
    name: 'Two-Way ANOVA',
    description: 'Factorial ANOVA with two factors',
    category: 'compare-means',
    requiredVariables: {
      dependent: { type: ['scale'], min: 1, max: 1 },
      independent: { type: ['nominal', 'ordinal'], min: 2, max: 2 },
    },
    isPro: true,
  },
  // Correlation
  {
    id: 'pearson',
    name: 'Pearson Correlation',
    description: 'Linear correlation between scale variables',
    category: 'correlation',
    requiredVariables: { dependent: { type: ['scale'], min: 2, max: 10 } },
    isPro: false,
  },
  {
    id: 'spearman',
    name: 'Spearman Correlation',
    description: 'Rank correlation for ordinal data',
    category: 'correlation',
    requiredVariables: { dependent: { type: ['scale', 'ordinal'], min: 2, max: 10 } },
    isPro: true,
  },
  // Regression
  {
    id: 'linear-regression',
    name: 'Linear Regression',
    description: 'Predict continuous outcome from predictors',
    category: 'regression',
    requiredVariables: {
      dependent: { type: ['scale'], min: 1, max: 1 },
      independent: { type: ['scale', 'nominal', 'ordinal'], min: 1, max: 20 },
    },
    isPro: true,
  },
  {
    id: 'multiple-regression',
    name: 'Multiple Regression',
    description: 'Multiple predictors for continuous outcome',
    category: 'regression',
    requiredVariables: {
      dependent: { type: ['scale'], min: 1, max: 1 },
      independent: { type: ['scale', 'nominal', 'ordinal'], min: 2, max: 20 },
    },
    isPro: true,
  },
  // Nonparametric
  {
    id: 'chi-square',
    name: 'Chi-Square Test',
    description: 'Test association between categorical variables',
    category: 'nonparametric',
    requiredVariables: {
      dependent: { type: ['nominal', 'ordinal'], min: 1, max: 1 },
      independent: { type: ['nominal', 'ordinal'], min: 1, max: 1 },
    },
    isPro: false,
  },
  {
    id: 'mann-whitney',
    name: 'Mann-Whitney U Test',
    description: 'Nonparametric alternative to t-test',
    category: 'nonparametric',
    requiredVariables: {
      dependent: { type: ['scale', 'ordinal'], min: 1, max: 1 },
      grouping: { type: ['nominal', 'ordinal'], min: 1, max: 1 },
    },
    isPro: true,
  },
  {
    id: 'kruskal-wallis',
    name: 'Kruskal-Wallis H Test',
    description: 'Nonparametric alternative to ANOVA',
    category: 'nonparametric',
    requiredVariables: {
      dependent: { type: ['scale', 'ordinal'], min: 1, max: 1 },
      grouping: { type: ['nominal', 'ordinal'], min: 1, max: 1 },
    },
    isPro: true,
  },
  // Reliability
  {
    id: 'cronbach-alpha',
    name: "Cronbach's Alpha",
    description: 'Internal consistency reliability',
    category: 'reliability',
    requiredVariables: { dependent: { type: ['scale', 'ordinal'], min: 2, max: 50 } },
    isPro: true,
  },
];

export function Step4Selection({
  variables,
  analysisConfig,
  onConfigChange,
  suggestedTest,
}: Step4SelectionProps) {
  const { isPro } = usePlanLimits();
  const [selectedCategory, setSelectedCategory] = useState<string>(
    suggestedTest?.category || 'descriptive'
  );
  const [selectedTest, setSelectedTest] = useState<TestDefinition | null>(
    suggestedTest ? tests.find((t) => t.id === suggestedTest.type) || null : null
  );

  const handleTestSelect = (test: TestDefinition) => {
    if (test.isPro && !isPro) return;
    setSelectedTest(test);
    onConfigChange({
      testCategory: test.category,
      testType: test.id,
      dependentVariables: [],
      independentVariables: [],
      options: {},
    });
  };

  const addVariable = (role: 'dependent' | 'independent' | 'grouping', variableName: string) => {
    if (!analysisConfig) return;

    const newConfig = { ...analysisConfig };
    if (role === 'dependent') {
      if (!newConfig.dependentVariables.includes(variableName)) {
        newConfig.dependentVariables = [...newConfig.dependentVariables, variableName];
      }
    } else if (role === 'independent') {
      if (!newConfig.independentVariables.includes(variableName)) {
        newConfig.independentVariables = [...newConfig.independentVariables, variableName];
      }
    } else if (role === 'grouping') {
      newConfig.groupingVariable = variableName;
    }
    onConfigChange(newConfig);
  };

  const removeVariable = (role: 'dependent' | 'independent' | 'grouping', variableName: string) => {
    if (!analysisConfig) return;

    const newConfig = { ...analysisConfig };
    if (role === 'dependent') {
      newConfig.dependentVariables = newConfig.dependentVariables.filter((v) => v !== variableName);
    } else if (role === 'independent') {
      newConfig.independentVariables = newConfig.independentVariables.filter(
        (v) => v !== variableName
      );
    } else if (role === 'grouping') {
      newConfig.groupingVariable = undefined;
    }
    onConfigChange(newConfig);
  };

  const categoryTests = tests.filter((t) => t.category === selectedCategory);

  const getVariablesByType = (types: string[]) => {
    return variables.filter((v) => types.includes(v.type));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Test Selection */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Select Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Choose the statistical test for your research
            </p>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {testCategories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span className="mr-1">{cat.icon}</span>
                {cat.name}
              </Button>
            ))}
          </div>

          {/* Tests in Category */}
          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="p-2 space-y-2">
              {categoryTests.map((test) => {
                const isLocked = test.isPro && !isPro;
                const isSelected = selectedTest?.id === test.id;

                return (
                  <button
                    key={test.id}
                    onClick={() => handleTestSelect(test)}
                    disabled={isLocked}
                    className={cn(
                      'w-full p-3 rounded-lg text-left transition-all',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : isLocked
                        ? 'bg-muted/50 opacity-60 cursor-not-allowed'
                        : 'bg-muted/30 hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{test.name}</span>
                          {isLocked && <Lock className="w-3 h-3" />}
                        </div>
                        <p
                          className={cn(
                            'text-xs mt-1',
                            isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                          )}
                        >
                          {test.description}
                        </p>
                      </div>
                      {isSelected && <ChevronRight className="w-4 h-4" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Variable Assignment */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Assign Variables</h3>
            <p className="text-sm text-muted-foreground">
              {selectedTest
                ? `Configure variables for ${selectedTest.name}`
                : 'Select a test first'}
            </p>
          </div>

          {selectedTest ? (
            <div className="space-y-4">
              {/* Dependent Variables */}
              {selectedTest.requiredVariables.dependent && (
                <VariableAssignment
                  label="Dependent Variable(s)"
                  description={`${selectedTest.requiredVariables.dependent.type.join('/')} variables`}
                  availableVariables={getVariablesByType(
                    selectedTest.requiredVariables.dependent.type
                  )}
                  selectedVariables={analysisConfig?.dependentVariables || []}
                  onAdd={(name) => addVariable('dependent', name)}
                  onRemove={(name) => removeVariable('dependent', name)}
                  min={selectedTest.requiredVariables.dependent.min}
                  max={selectedTest.requiredVariables.dependent.max}
                />
              )}

              {/* Independent Variables */}
              {selectedTest.requiredVariables.independent && (
                <VariableAssignment
                  label="Independent Variable(s)"
                  description={`${selectedTest.requiredVariables.independent.type.join('/')} variables`}
                  availableVariables={getVariablesByType(
                    selectedTest.requiredVariables.independent.type
                  )}
                  selectedVariables={analysisConfig?.independentVariables || []}
                  onAdd={(name) => addVariable('independent', name)}
                  onRemove={(name) => removeVariable('independent', name)}
                  min={selectedTest.requiredVariables.independent.min}
                  max={selectedTest.requiredVariables.independent.max}
                />
              )}

              {/* Grouping Variable */}
              {selectedTest.requiredVariables.grouping && (
                <VariableAssignment
                  label="Grouping Variable"
                  description={`${selectedTest.requiredVariables.grouping.type.join('/')} variable`}
                  availableVariables={getVariablesByType(
                    selectedTest.requiredVariables.grouping.type
                  )}
                  selectedVariables={
                    analysisConfig?.groupingVariable ? [analysisConfig.groupingVariable] : []
                  }
                  onAdd={(name) => addVariable('grouping', name)}
                  onRemove={(name) => removeVariable('grouping', name)}
                  min={1}
                  max={1}
                />
              )}
            </div>
          ) : (
            <div className="h-[300px] border border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
              Select a test from the left panel
            </div>
          )}
        </div>
      </div>

      {/* Test Info */}
      {selectedTest && (
        <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground">{selectedTest.name}</h4>
            <p className="text-sm text-muted-foreground mt-1">{selectedTest.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Variable Assignment Component
function VariableAssignment({
  label,
  description,
  availableVariables,
  selectedVariables,
  onAdd,
  onRemove,
  min,
  max,
}: {
  label: string;
  description: string;
  availableVariables: Variable[];
  selectedVariables: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  min: number;
  max: number;
}) {
  const canAdd = selectedVariables.length < max;
  const needsMore = selectedVariables.length < min;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground">
          {selectedVariables.length}/{max} {needsMore && `(need ${min - selectedVariables.length} more)`}
        </span>
      </div>

      {/* Selected Variables */}
      <div className="min-h-[60px] p-2 border rounded-lg bg-background">
        {selectedVariables.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedVariables.map((name) => (
              <Badge key={name} variant="secondary" className="gap-1">
                <GripVertical className="w-3 h-3" />
                {name}
                <button onClick={() => onRemove(name)} className="ml-1 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Click variables below to add them here
          </p>
        )}
      </div>

      {/* Available Variables */}
      <div className="flex flex-wrap gap-1">
        {availableVariables
          .filter((v) => !selectedVariables.includes(v.name))
          .map((v) => (
            <Tooltip key={v.name}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => canAdd && onAdd(v.name)}
                  disabled={!canAdd}
                  className="h-7 text-xs"
                >
                  {v.name}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{v.label || v.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{v.type}</p>
              </TooltipContent>
            </Tooltip>
          ))}
      </div>

      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
