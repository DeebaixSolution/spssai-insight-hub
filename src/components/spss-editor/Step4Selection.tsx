import { useState, useEffect } from 'react';
import { ChevronRight, Info, Lock, GripVertical, X, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Variable, AnalysisConfig } from '@/hooks/useAnalysisWizard';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { supabase } from '@/integrations/supabase/client';
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

interface CategoryDefinition {
  id: string;
  name: string;
  icon: string;
}

// Multi-test config to store configurations for multiple selected tests
interface MultiTestConfig {
  testId: string;
  testCategory: string;
  dependentVariables: string[];
  independentVariables: string[];
  groupingVariable?: string;
  options: Record<string, unknown>;
}

// Fallback data (used if database fetch fails)
const fallbackCategories: CategoryDefinition[] = [
  { id: 'descriptive', name: 'Descriptive Statistics', icon: '📊' },
  { id: 'compare-means', name: 'Compare Means', icon: '📈' },
  { id: 'correlation', name: 'Correlation', icon: '🔗' },
  { id: 'regression', name: 'Regression', icon: '📉' },
  { id: 'nonparametric', name: 'Nonparametric Tests', icon: '📋' },
  { id: 'reliability', name: 'Scale Reliability', icon: '✓' },
];

const fallbackTests: TestDefinition[] = [
  { id: 'frequencies', name: 'Frequencies', description: 'Frequency tables and charts for categorical variables', category: 'descriptive', requiredVariables: { dependent: { type: ['nominal', 'ordinal'], min: 1, max: 10 } }, isPro: false },
  { id: 'descriptives', name: 'Descriptives', description: 'Mean, SD, min, max for scale variables', category: 'descriptive', requiredVariables: { dependent: { type: ['scale'], min: 1, max: 20 } }, isPro: false },
  { id: 'crosstabs', name: 'Crosstabs', description: 'Cross-tabulation with chi-square test', category: 'descriptive', requiredVariables: { dependent: { type: ['nominal', 'ordinal'], min: 1, max: 1 }, independent: { type: ['nominal', 'ordinal'], min: 1, max: 1 } }, isPro: false },
  { id: 'independent-t-test', name: 'Independent Samples T-Test', description: 'Compare means of two independent groups', category: 'compare-means', requiredVariables: { dependent: { type: ['scale'], min: 1, max: 1 }, grouping: { type: ['nominal', 'ordinal'], min: 1, max: 1 } }, isPro: false },
  { id: 'paired-t-test', name: 'Paired Samples T-Test', description: 'Compare means of two related measurements', category: 'compare-means', requiredVariables: { dependent: { type: ['scale'], min: 2, max: 2 } }, isPro: false },
  { id: 'one-way-anova', name: 'One-Way ANOVA', description: 'Compare means across 3+ groups', category: 'compare-means', requiredVariables: { dependent: { type: ['scale'], min: 1, max: 1 }, grouping: { type: ['nominal', 'ordinal'], min: 1, max: 1 } }, isPro: true },
  { id: 'two-way-anova', name: 'Two-Way ANOVA', description: 'Factorial ANOVA with two factors', category: 'compare-means', requiredVariables: { dependent: { type: ['scale'], min: 1, max: 1 }, independent: { type: ['nominal', 'ordinal'], min: 2, max: 2 } }, isPro: true },
  { id: 'pearson', name: 'Pearson Correlation', description: 'Linear correlation between scale variables', category: 'correlation', requiredVariables: { dependent: { type: ['scale'], min: 2, max: 10 } }, isPro: false },
  { id: 'spearman', name: 'Spearman Correlation', description: 'Rank correlation for ordinal data', category: 'correlation', requiredVariables: { dependent: { type: ['scale', 'ordinal'], min: 2, max: 10 } }, isPro: true },
  { id: 'linear-regression', name: 'Linear Regression', description: 'Predict continuous outcome from predictors', category: 'regression', requiredVariables: { dependent: { type: ['scale'], min: 1, max: 1 }, independent: { type: ['scale', 'nominal', 'ordinal'], min: 1, max: 20 } }, isPro: true },
  { id: 'multiple-regression', name: 'Multiple Regression', description: 'Multiple predictors for continuous outcome', category: 'regression', requiredVariables: { dependent: { type: ['scale'], min: 1, max: 1 }, independent: { type: ['scale', 'nominal', 'ordinal'], min: 2, max: 20 } }, isPro: true },
  { id: 'chi-square', name: 'Chi-Square Test', description: 'Test association between categorical variables', category: 'nonparametric', requiredVariables: { dependent: { type: ['nominal', 'ordinal'], min: 1, max: 1 }, independent: { type: ['nominal', 'ordinal'], min: 1, max: 1 } }, isPro: false },
  { id: 'mann-whitney', name: 'Mann-Whitney U Test', description: 'Nonparametric alternative to t-test', category: 'nonparametric', requiredVariables: { dependent: { type: ['scale', 'ordinal'], min: 1, max: 1 }, grouping: { type: ['nominal', 'ordinal'], min: 1, max: 1 } }, isPro: true },
  { id: 'kruskal-wallis', name: 'Kruskal-Wallis H Test', description: 'Nonparametric alternative to ANOVA', category: 'nonparametric', requiredVariables: { dependent: { type: ['scale', 'ordinal'], min: 1, max: 1 }, grouping: { type: ['nominal', 'ordinal'], min: 1, max: 1 } }, isPro: true },
  { id: 'cronbach-alpha', name: "Cronbach's Alpha", description: 'Internal consistency reliability', category: 'reliability', requiredVariables: { dependent: { type: ['scale', 'ordinal'], min: 2, max: 50 } }, isPro: true },
];

export function Step4Selection({
  variables,
  analysisConfig,
  onConfigChange,
  suggestedTest,
}: Step4SelectionProps) {
  const { isPro } = usePlanLimits();
  const [categories, setCategories] = useState<CategoryDefinition[]>(fallbackCategories);
  const [tests, setTests] = useState<TestDefinition[]>(fallbackTests);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    suggestedTest?.category || 'descriptive'
  );
  
  // Multi-select state
  const [selectedTests, setSelectedTests] = useState<TestDefinition[]>([]);
  const [testConfigs, setTestConfigs] = useState<Map<string, MultiTestConfig>>(new Map());
  const [activeConfigTab, setActiveConfigTab] = useState<string | null>(null);

  // Fetch tests and categories from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesRes, testsRes] = await Promise.all([
          supabase.from('analysis_categories').select('*').eq('is_enabled', true).order('display_order'),
          supabase.from('analysis_tests').select('*').eq('is_enabled', true).order('display_order'),
        ]);

        if (categoriesRes.data && categoriesRes.data.length > 0) {
          setCategories(categoriesRes.data.map(c => ({
            id: c.category_id,
            name: c.name,
            icon: c.icon || '📊',
          })));
        }

        if (testsRes.data && testsRes.data.length > 0) {
          setTests(testsRes.data.map(t => ({
            id: t.test_id,
            name: t.name,
            description: t.description || '',
            category: t.category,
            requiredVariables: (t.required_variables as TestDefinition['requiredVariables']) || {},
            isPro: t.is_pro_only,
          })));
        }
      } catch (error) {
        console.error('Error fetching analysis config:', error);
        // Keep fallback data
      }
    };

    fetchData();
  }, []);

  // Initialize from suggested test or existing config
  useEffect(() => {
    if (suggestedTest && selectedTests.length === 0) {
      const test = tests.find(t => t.id === suggestedTest.type);
      if (test && (!test.isPro || isPro)) {
        handleTestToggle(test);
      }
    }
  }, [suggestedTest, tests]);

  // Sync config to parent whenever testConfigs change
  useEffect(() => {
    if (selectedTests.length > 0) {
      const configs = Array.from(testConfigs.values());
      // For backward compatibility, we pass the first test's config in the old format
      // but also include the full array in options
      const firstConfig = configs[0];
      if (firstConfig) {
        onConfigChange({
          testCategory: firstConfig.testCategory,
          testType: firstConfig.testId,
          dependentVariables: firstConfig.dependentVariables,
          independentVariables: firstConfig.independentVariables,
          groupingVariable: firstConfig.groupingVariable,
          options: {
            ...firstConfig.options,
            multipleTests: configs, // Store all configs here
          },
        });
      }
    }
  }, [testConfigs, selectedTests]);

  const handleTestToggle = (test: TestDefinition) => {
    if (test.isPro && !isPro) return;

    const isSelected = selectedTests.some(t => t.id === test.id);
    
    if (isSelected) {
      // Remove test
      setSelectedTests(prev => prev.filter(t => t.id !== test.id));
      setTestConfigs(prev => {
        const newMap = new Map(prev);
        newMap.delete(test.id);
        return newMap;
      });
      if (activeConfigTab === test.id) {
        const remaining = selectedTests.filter(t => t.id !== test.id);
        setActiveConfigTab(remaining.length > 0 ? remaining[0].id : null);
      }
    } else {
      // Add test
      setSelectedTests(prev => [...prev, test]);
      setTestConfigs(prev => {
        const newMap = new Map(prev);
        newMap.set(test.id, {
          testId: test.id,
          testCategory: test.category,
          dependentVariables: [],
          independentVariables: [],
          groupingVariable: undefined,
          options: {},
        });
        return newMap;
      });
      setActiveConfigTab(test.id);
    }
  };

  const updateTestConfig = (testId: string, updates: Partial<MultiTestConfig>) => {
    setTestConfigs(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(testId);
      if (existing) {
        newMap.set(testId, { ...existing, ...updates });
      }
      return newMap;
    });
  };

  const addVariable = (testId: string, role: 'dependent' | 'independent' | 'grouping', variableName: string) => {
    const config = testConfigs.get(testId);
    if (!config) return;

    if (role === 'dependent') {
      if (!config.dependentVariables.includes(variableName)) {
        updateTestConfig(testId, { dependentVariables: [...config.dependentVariables, variableName] });
      }
    } else if (role === 'independent') {
      if (!config.independentVariables.includes(variableName)) {
        updateTestConfig(testId, { independentVariables: [...config.independentVariables, variableName] });
      }
    } else if (role === 'grouping') {
      updateTestConfig(testId, { groupingVariable: variableName });
    }
  };

  const removeVariable = (testId: string, role: 'dependent' | 'independent' | 'grouping', variableName: string) => {
    const config = testConfigs.get(testId);
    if (!config) return;

    if (role === 'dependent') {
      updateTestConfig(testId, { dependentVariables: config.dependentVariables.filter(v => v !== variableName) });
    } else if (role === 'independent') {
      updateTestConfig(testId, { independentVariables: config.independentVariables.filter(v => v !== variableName) });
    } else if (role === 'grouping') {
      updateTestConfig(testId, { groupingVariable: undefined });
    }
  };

  const categoryTests = tests.filter(t => t.category === selectedCategory);

  const getVariablesByType = (types: string[]) => {
    return variables.filter(v => types.includes(v.type));
  };

  const getSelectedCountByCategory = (categoryId: string) => {
    return selectedTests.filter(t => t.category === categoryId).length;
  };

  return (
    <div className="space-y-6">
      {/* Selected Tests Summary */}
      {selectedTests.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-foreground">Selected Analyses ({selectedTests.length})</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedTests.map(test => (
              <Badge key={test.id} variant="default" className="gap-1 pr-1">
                {test.name}
                <button
                  onClick={() => handleTestToggle(test)}
                  className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Test Selection */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Select Analyses</h3>
            <p className="text-sm text-muted-foreground">
              Choose one or more statistical tests for your research
            </p>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => {
              const count = getSelectedCountByCategory(cat.id);
              return (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className="relative"
                >
                  <span className="mr-1">{cat.icon}</span>
                  {cat.name}
                  {count > 0 && (
                    <span className="ml-2 bg-primary-foreground text-primary text-xs rounded-full px-1.5 py-0.5 min-w-[18px]">
                      {count}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>

          {/* Tests in Category */}
          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="p-2 space-y-2">
              {categoryTests.map(test => {
                const isLocked = test.isPro && !isPro;
                const isSelected = selectedTests.some(t => t.id === test.id);

                return (
                  <button
                    key={test.id}
                    onClick={() => handleTestToggle(test)}
                    disabled={isLocked}
                    className={cn(
                      'w-full p-3 rounded-lg text-left transition-all',
                      isSelected
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                        : isLocked
                        ? 'bg-muted/50 opacity-60 cursor-not-allowed'
                        : 'bg-muted/30 hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-primary-foreground flex items-center justify-center">
                              <Check className="w-3 h-3 text-primary" />
                            </div>
                          )}
                          <span className="font-medium">{test.name}</span>
                          {isLocked && <Lock className="w-3 h-3" />}
                          {test.isPro && !isLocked && (
                            <Badge variant="secondary" className="text-xs">PRO</Badge>
                          )}
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
              {selectedTests.length > 0
                ? `Configure variables for each selected test`
                : 'Select tests from the left panel'}
            </p>
          </div>

          {selectedTests.length > 0 ? (
            <Tabs value={activeConfigTab || selectedTests[0]?.id} onValueChange={setActiveConfigTab}>
              <TabsList className="w-full flex-wrap h-auto gap-1">
                {selectedTests.map(test => (
                  <TabsTrigger key={test.id} value={test.id} className="text-xs">
                    {test.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {selectedTests.map(test => {
                const config = testConfigs.get(test.id);
                if (!config) return null;

                return (
                  <TabsContent key={test.id} value={test.id} className="space-y-4 mt-4">
                    {/* Dependent Variables */}
                    {test.requiredVariables.dependent && (
                      <VariableAssignment
                        label="Dependent Variable(s)"
                        description={`${test.requiredVariables.dependent.type.join('/')} variables`}
                        availableVariables={getVariablesByType(test.requiredVariables.dependent.type)}
                        selectedVariables={config.dependentVariables}
                        onAdd={(name) => addVariable(test.id, 'dependent', name)}
                        onRemove={(name) => removeVariable(test.id, 'dependent', name)}
                        min={test.requiredVariables.dependent.min}
                        max={test.requiredVariables.dependent.max}
                      />
                    )}

                    {/* Independent Variables */}
                    {test.requiredVariables.independent && (
                      <VariableAssignment
                        label="Independent Variable(s)"
                        description={`${test.requiredVariables.independent.type.join('/')} variables`}
                        availableVariables={getVariablesByType(test.requiredVariables.independent.type)}
                        selectedVariables={config.independentVariables}
                        onAdd={(name) => addVariable(test.id, 'independent', name)}
                        onRemove={(name) => removeVariable(test.id, 'independent', name)}
                        min={test.requiredVariables.independent.min}
                        max={test.requiredVariables.independent.max}
                      />
                    )}

                    {/* Grouping Variable */}
                    {test.requiredVariables.grouping && (
                      <VariableAssignment
                        label="Grouping Variable"
                        description={`${test.requiredVariables.grouping.type.join('/')} variable`}
                        availableVariables={getVariablesByType(test.requiredVariables.grouping.type)}
                        selectedVariables={config.groupingVariable ? [config.groupingVariable] : []}
                        onAdd={(name) => addVariable(test.id, 'grouping', name)}
                        onRemove={(name) => removeVariable(test.id, 'grouping', name)}
                        min={1}
                        max={1}
                      />
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <div className="h-[300px] border border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
              Select one or more tests from the left panel
            </div>
          )}
        </div>
      </div>

      {/* Test Info */}
      {selectedTests.length > 0 && activeConfigTab && (
        <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground">
              {selectedTests.find(t => t.id === activeConfigTab)?.name}
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedTests.find(t => t.id === activeConfigTab)?.description}
            </p>
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
    </div>
  );
}
